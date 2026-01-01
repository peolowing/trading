/**
 * Watchlist API endpoint
 * Handles GET, POST, DELETE for watchlist
 * Also handles /live and /update sub-routes
 */

import { supabase } from '../config/supabase.js';
import yahooFinance from 'yahoo-finance2';
import dayjs from 'dayjs';
import { EMA, RSI } from 'technicalindicators';
import { updateWatchlistStatus, buildWatchlistInput } from './utils/watchlistLogic.js';

export default async function handler(req, res) {
  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // GET /api/watchlist/live - Fetch live quotes
  if (method === 'GET' && pathname.includes('/live')) {
    try {
      const tickers = url.searchParams.get('tickers');
      if (!tickers) {
        return res.status(400).json({ error: "Tickers parameter required" });
      }

      const tickerList = tickers.split(',').map(t => t.trim());
      const quotes = {};

      await Promise.all(
        tickerList.map(async (ticker) => {
          try {
            const quote = await yahooFinance.quote(ticker);
            quotes[ticker] = {
              regularMarketPrice: quote.regularMarketPrice,
              regularMarketChange: quote.regularMarketChange,
              regularMarketChangePercent: quote.regularMarketChangePercent,
              regularMarketVolume: quote.regularMarketVolume,
              regularMarketDayHigh: quote.regularMarketDayHigh,
              regularMarketDayLow: quote.regularMarketDayLow,
              regularMarketOpen: quote.regularMarketOpen,
              regularMarketPreviousClose: quote.regularMarketPreviousClose,
              marketState: quote.marketState,
              currency: quote.currency,
              longName: quote.longName,
              shortName: quote.shortName,
            };
          } catch (e) {
            console.warn(`Failed to fetch quote for ${ticker}:`, e.message);
            quotes[ticker] = { error: "Failed to fetch" };
          }
        })
      );

      return res.json({ quotes });
    } catch (e) {
      console.error("Get live watchlist error:", e);
      return res.status(500).json({ error: "Failed to fetch live data" });
    }
  }

  // POST /api/watchlist/update - Update all watchlist statuses (daily batch)
  if (method === 'POST' && pathname.includes('/update')) {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured" });
    }

    try {
      const today = dayjs().format('YYYY-MM-DD');

      const { data: watchlistStocks, error: fetchError } = await supabase
        .from('watchlist')
        .select('*');

      if (fetchError) throw fetchError;

      if (!watchlistStocks || watchlistStocks.length === 0) {
        return res.json({ message: "No stocks in watchlist", updated: 0 });
      }

      const updates = [];

      // FAS 1: Fetch edge scores, totalTrades och avgTurnover för alla watchlist tickers
      const tickers = watchlistStocks.map(s => s.ticker);
      const { data: screenerData } = await supabase
        .from('screener_stocks')
        .select('ticker, edge_score, total_trades, avg_turnover')
        .in('ticker', tickers);

      const edgeScoreMap = new Map();
      const totalTradesMap = new Map();
      const avgTurnoverMap = new Map();
      screenerData?.forEach(s => {
        edgeScoreMap.set(s.ticker, s.edge_score);
        totalTradesMap.set(s.ticker, s.total_trades);
        avgTurnoverMap.set(s.ticker, s.avg_turnover);
      });

      for (const stock of watchlistStocks) {
        try {
          const ticker = stock.ticker;
          const startDate = dayjs().subtract(1, 'year').format('YYYY-MM-DD');

          // Fetch fresh data for today
          const rawCandles = await yahooFinance.chart(ticker, {
            period1: startDate,
            period2: today
          });

          if (!rawCandles || !rawCandles.quotes || rawCandles.quotes.length === 0) {
            console.warn(`No data for ${ticker}`);
            continue;
          }

          const candles = rawCandles.quotes.map(q => ({
            date: q.date.toISOString().split('T')[0],
            open: q.open,
            high: q.high,
            low: q.low,
            close: q.close,
            volume: q.volume
          }));

          // Calculate indicators
          const closes = candles.map(c => c.close);
          const highs = candles.map(c => c.high);
          const lows = candles.map(c => c.low);
          const volumes = candles.map(c => c.volume);

          const ema20 = EMA.calculate({ period: 20, values: closes });
          const ema50 = EMA.calculate({ period: 50, values: closes });
          const rsi14 = RSI.calculate({ period: 14, values: closes });

          // Calculate relative volume
          const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
          const relativeVolume = avgVolume > 0 ? volumes[volumes.length - 1] / avgVolume : 1;

          // Calculate days in watchlist
          const addedDate = dayjs(stock.added_at);
          const daysInWatchlist = dayjs().diff(addedDate, 'day');

          // FAS 1: Hämta edge_score, totalTrades och avgTurnover
          const edge_score = edgeScoreMap.get(ticker);
          const totalTrades = totalTradesMap.get(ticker);
          const avgTurnover = avgTurnoverMap.get(ticker);

          // Build input for status update
          const input = buildWatchlistInput(
            ticker,
            candles,
            { ema20, ema50, rsi14, relativeVolume },
            stock.current_status,
            stock.added_at,
            edge_score,
            stock.last_invalidated_date,
            totalTrades,
            avgTurnover
          );

          const result = updateWatchlistStatus(input);

          // Update database
          const updateData = {
            last_updated: today,
            days_in_watchlist: daysInWatchlist,
            current_status: result.status,
            current_action: result.action,
            status_reason: result.reason,
            dist_ema20_pct: parseFloat(result.diagnostics.distEma20Pct),
            rsi_zone: result.diagnostics.rsiZone,
            volume_state: result.diagnostics.volumeState,
            time_warning: result.timeWarning,
            last_invalidated_date: result.lastInvalidatedDate || stock.last_invalidated_date
          };

          const { error: updateError } = await supabase
            .from('watchlist')
            .update(updateData)
            .eq('ticker', ticker);

          if (updateError) {
            console.error(`Failed to update ${ticker}:`, updateError);
          } else {
            updates.push(ticker);
          }
        } catch (e) {
          console.error(`Error processing ${stock.ticker}:`, e);
        }
      }

      return res.json({
        message: "Watchlist updated",
        updated: updates.length,
        tickers: updates
      });
    } catch (e) {
      console.error("Update watchlist error:", e);
      return res.status(500).json({ error: "Failed to update watchlist" });
    }
  }

  // GET /api/watchlist - Fetch all watchlist stocks
  if (method === 'GET') {
    if (!supabase) {
      return res.json({ stocks: [] });
    }

    try {
      // First get all watchlist items
      const { data: watchlistData, error: watchlistError } = await supabase
        .from('watchlist')
        .select('*')
        .order('added_at', { ascending: false });

      if (watchlistError) throw watchlistError;

      // Then fetch edge scores for these tickers from screener_stocks
      const tickers = watchlistData?.map(w => w.ticker) || [];
      const { data: screenerData } = await supabase
        .from('screener_stocks')
        .select('ticker, edge_score, regime, setup')
        .in('ticker', tickers);

      // Create a map of ticker -> screener data
      const screenerMap = new Map();
      (screenerData || []).forEach(s => {
        screenerMap.set(s.ticker, s);
      });

      // Merge the data
      const stocks = (watchlistData || []).map(stock => {
        const screenerInfo = screenerMap.get(stock.ticker);
        console.log(`[Watchlist] ${stock.ticker}: edge_score=${screenerInfo?.edge_score}`);
        return {
          ...stock,
          edge_score: screenerInfo?.edge_score,
          regime: screenerInfo?.regime || stock.initial_regime,
          setup: screenerInfo?.setup || stock.initial_setup
        };
      });

      return res.json({ stocks });
    } catch (e) {
      console.error("Get watchlist error:", e);
      return res.status(500).json({ error: "Failed to fetch watchlist" });
    }
  }

  // POST /api/watchlist - Add to watchlist
  if (method === 'POST') {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured" });
    }

    try {
      const { ticker, indicators } = req.body;

      if (!ticker) {
        return res.status(400).json({ error: "Ticker is required" });
      }

      const normalizedTicker = ticker.toUpperCase();
      const today = dayjs().format('YYYY-MM-DD');

      const insertData = {
        ticker: normalizedTicker,
        last_updated: today,
        days_in_watchlist: 0
      };

      // If indicators provided, save initial snapshot
      if (indicators) {
        insertData.initial_price = indicators.price || null;
        insertData.initial_ema20 = indicators.ema20 || null;
        insertData.initial_ema50 = indicators.ema50 || null;
        insertData.initial_rsi14 = indicators.rsi14 || null;
        insertData.initial_regime = indicators.regime || null;
        insertData.initial_setup = indicators.setup || null;

        // Run initial status update
        if (indicators.ema20 && indicators.ema50 && indicators.rsi14) {
          const input = {
            ticker: normalizedTicker,
            price: {
              close: indicators.price || 0,
              high: indicators.price || 0,
              low: indicators.price || 0
            },
            indicators: {
              ema20: indicators.ema20,
              ema50: indicators.ema50,
              ema50_slope: 0.001,
              rsi14: indicators.rsi14
            },
            volume: {
              relVol: indicators.relativeVolume || 1
            },
            structure: {
              higherLow: true
            },
            prevStatus: null,
            daysInWatchlist: 0
          };

          const result = updateWatchlistStatus(input);

          insertData.current_status = result.status;
          insertData.current_action = result.action;
          insertData.status_reason = result.reason;
          insertData.dist_ema20_pct = parseFloat(result.diagnostics.distEma20Pct);
          insertData.rsi_zone = result.diagnostics.rsiZone;
          insertData.volume_state = result.diagnostics.volumeState;
          insertData.time_warning = result.timeWarning;
        }
      }

      const { data, error } = await supabase
        .from('watchlist')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: "Already in watchlist" });
        }
        throw error;
      }

      return res.status(201).json({ stock: data });
    } catch (e) {
      console.error("Add to watchlist error:", e);
      return res.status(500).json({ error: "Failed to add to watchlist" });
    }
  }

  // DELETE /api/watchlist/:ticker - Remove from watchlist
  if (method === 'DELETE') {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured" });
    }

    try {
      // Extract ticker from pathname
      const ticker = pathname.split('/').pop();

      if (!ticker || ticker === 'watchlist') {
        return res.status(400).json({ error: "Ticker is required" });
      }

      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('ticker', ticker.toUpperCase());

      if (error) throw error;
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error("Delete from watchlist error:", e);
      return res.status(500).json({ error: "Failed to delete from watchlist" });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: `Method ${method} not allowed` });
}
