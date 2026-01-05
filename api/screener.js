/**
 * Screener API - Now with Yahoo Finance v3 integration
 *
 * Routes:
 * - GET /api/screener - Main screener (fetches live data from Yahoo Finance v3)
 * - GET /api/screener?cached=true - Use cached data from database
 * - GET /api/screener/stocks - Stock list management
 * - POST /api/screener/stocks - Add stock
 * - DELETE /api/screener/stocks/:ticker - Remove stock
 * - PATCH /api/screener/stocks/:ticker - Update stock
 */

import YahooFinanceClass from 'yahoo-finance2';
import dayjs from 'dayjs';
import { supabase } from '../config/supabase.js';

// Initialize Yahoo Finance v3
const yahooFinance = new YahooFinanceClass({
  queue: { timeout: 60000 },
  suppressNotices: ['yahooSurvey', 'ripHistorical']
});

// Technical indicator calculations
function calculateEMA(data, period) {
  if (!data || data.length < period) return null;
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateATR(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trs.push(tr);
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function determineRegime(ema20, ema50, rsi) {
  if (ema20 > ema50 && rsi > 50) return "Bullish Trend";
  if (ema20 < ema50 && rsi < 50) return "Bearish Trend";
  if (Math.abs(ema20 - ema50) / ema50 < 0.02) return "Consolidation";
  return "Transition";
}

function determineSetup(regime, rsi, relativeVolume) {
  if (regime === "Bullish Trend" && rsi < 70) return "Trend Following";
  if (regime === "Consolidation" && relativeVolume > 1.2) return "Near Breakout";
  if (rsi > 70) return "Overbought";
  if (rsi < 30) return "Oversold";
  return "No Setup";
}

function calculateEdgeScore(regime, setup, rsi, relativeVolume, atr, price) {
  let score = 50;
  if (regime === "Bullish Trend") score += 15;
  else if (regime === "Consolidation") score += 10;
  else if (regime === "Bearish Trend") score -= 10;

  if (setup === "Trend Following") score += 20;
  else if (setup === "Near Breakout") score += 15;
  else if (setup === "Oversold") score += 10;

  if (rsi > 40 && rsi < 70) score += 10;
  else if (rsi > 70 || rsi < 30) score -= 15;

  if (relativeVolume > 1.5) score += 10;
  else if (relativeVolume < 0.5) score -= 10;

  const atrPercent = (atr / price) * 100;
  if (atrPercent > 1 && atrPercent < 4) score += 5;
  else if (atrPercent > 6) score -= 10;

  return Math.min(100, Math.max(0, Math.round(score)));
}

export default async function handler(req, res) {
  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const useCached = url.searchParams.get('cached') === 'true';

  // GET /api/screener - Main screener
  if (method === 'GET' && pathname === '/api/screener') {
    // If cached mode requested, return data from database
    if (useCached) {
      try {
        if (!supabase) return res.json({ stocks: [] });

        const { data: stocks, error } = await supabase
          .from('screener_stocks')
          .select('*')
          .eq('is_active', true);

        if (error) throw error;

        const sortedStocks = (stocks || []).sort((a, b) => {
          if (b.edge_score !== a.edge_score) return b.edge_score - a.edge_score;
          return a.ticker.localeCompare(b.ticker);
        });

        const stocksWithScores = sortedStocks.map(stock => ({
          ticker: stock.ticker,
          name: stock.name,
          bucket: stock.bucket,
          edgeScore: stock.edge_score || 50,
          price: stock.price,
          ema20: stock.ema20,
          ema50: stock.ema50,
          rsi: stock.rsi,
          atr: stock.atr,
          relativeVolume: stock.relative_volume,
          regime: stock.regime,
          setup: stock.setup,
          volume: stock.volume,
          turnoverMSEK: stock.turnover_msek,
          lastCalculated: stock.last_calculated
        }));

        return res.json({
          stocks: stocksWithScores,
          lastUpdate: stocks[0]?.last_calculated || null,
          cached: true
        });
      } catch (error) {
        console.error("Error in cached screener:", error);
        return res.status(500).json({ error: error.message });
      }
    }

    // LIVE MODE - Fetch from Yahoo Finance v3
    try {
      if (!supabase) return res.json({ stocks: [] });

      // Get active stocks from database
      const { data: dbStocks, error: dbError } = await supabase
        .from('screener_stocks')
        .select('ticker, bucket')
        .eq('is_active', true);

      if (dbError) throw dbError;
      if (!dbStocks || dbStocks.length === 0) {
        return res.json({ stocks: [], message: 'No active stocks found' });
      }

      console.log(`[Screener] Processing ${dbStocks.length} stocks with Yahoo Finance v3...`);

      const results = [];
      const startDate = dayjs().subtract(1, 'year').toDate();
      const batchSize = 5; // Process in small batches

      // Process stocks in batches
      for (let i = 0; i < dbStocks.length; i += batchSize) {
        const batch = dbStocks.slice(i, i + batchSize);

        const batchResults = await Promise.all(
          batch.map(async ({ ticker, bucket }) => {
            try {
              const result = await yahooFinance.chart(ticker, {
                period1: startDate,
                period2: new Date(),
                interval: '1d'
              });

              const candles = result?.quotes || [];
              if (candles.length < 50) {
                console.log(`[Screener] Skipping ${ticker}: only ${candles.length} candles`);
                return null;
              }

              const recentCandles = candles.slice(-250);
              const closes = recentCandles.map(c => c.close);
              const volumes = recentCandles.map(c => c.volume);

              const lastClose = closes[closes.length - 1];
              const lastVolume = volumes[volumes.length - 1];
              const ema20 = calculateEMA(closes, 20);
              const ema50 = calculateEMA(closes, 50);
              const rsi = calculateRSI(closes);
              const atr = calculateATR(recentCandles);

              const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
              const relativeVolume = lastVolume / avgVolume;
              const turnoverMSEK = (lastClose * lastVolume) / 1000000;

              const regime = determineRegime(ema20, ema50, rsi);
              const setup = determineSetup(regime, rsi, relativeVolume);
              const edgeScore = calculateEdgeScore(regime, setup, rsi, relativeVolume, atr, lastClose);

              console.log(`[Screener] ✓ ${ticker}: ${lastClose.toFixed(2)} SEK, Edge: ${edgeScore}`);

              return {
                ticker,
                price: lastClose,
                volume: lastVolume,
                turnoverMSEK: parseFloat(turnoverMSEK.toFixed(1)),
                ema20,
                ema50,
                rsi: parseFloat(rsi.toFixed(2)),
                atr: parseFloat(atr.toFixed(2)),
                relativeVolume: parseFloat(relativeVolume.toFixed(2)),
                regime,
                setup,
                edgeScore,
                bucket: bucket || 'UNKNOWN'
              };
            } catch (error) {
              console.error(`[Screener] ✗ ${ticker}:`, error.message);
              return null;
            }
          })
        );

        // Add successful results
        results.push(...batchResults.filter(r => r !== null));

        // Small delay between batches
        if (i + batchSize < dbStocks.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Sort by edge score
      results.sort((a, b) => b.edgeScore - a.edgeScore);

      console.log(`[Screener] Complete: ${results.length}/${dbStocks.length} stocks`);

      return res.json({
        stocks: results,
        lastUpdate: new Date().toISOString(),
        totalProcessed: results.length,
        totalRequested: dbStocks.length,
        cached: false
      });

    } catch (error) {
      console.error('[Screener] Error:', error);
      return res.status(500).json({
        error: 'Failed to fetch screener data',
        message: error.message
      });
    }
  }

  // GET /api/screener/stocks - List stocks
  if (method === 'GET' && pathname.includes('/stocks')) {
    const parts = pathname.split('/');
    if (parts.length > 4) {
      return res.status(405).json({ error: 'Use DELETE or PATCH for individual stocks' });
    }

    try {
      if (!supabase) return res.json({ stocks: [] });

      const { data, error } = await supabase
        .from('screener_stocks')
        .select('*')
        .order('ticker', { ascending: true });

      if (error) throw error;
      return res.json({ stocks: data || [] });
    } catch (e) {
      console.error("Get screener stocks error:", e);
      return res.status(500).json({ error: "Failed to fetch stocks" });
    }
  }

  // POST /api/screener/stocks - Add stock
  if (method === 'POST' && pathname.includes('/stocks')) {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured" });
    }

    try {
      const { ticker, name, bucket } = req.body;

      if (!ticker) {
        return res.status(400).json({ error: "Ticker is required" });
      }

      const { data, error } = await supabase
        .from('screener_stocks')
        .insert([{
          ticker: ticker.toUpperCase(),
          name: name || null,
          bucket: bucket || 'UNKNOWN'
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: "Ticker already exists" });
        }
        throw error;
      }

      return res.status(201).json({ stock: data });
    } catch (e) {
      console.error("Add stock error:", e);
      return res.status(500).json({ error: "Failed to add stock" });
    }
  }

  // DELETE /api/screener/stocks/:ticker
  if (method === 'DELETE' && pathname.includes('/stocks/')) {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured" });
    }

    try {
      const ticker = pathname.split('/').pop();

      const { error } = await supabase
        .from('screener_stocks')
        .delete()
        .eq('ticker', ticker.toUpperCase());

      if (error) throw error;
      return res.json({ success: true });
    } catch (e) {
      console.error("Delete stock error:", e);
      return res.status(500).json({ error: "Failed to delete stock" });
    }
  }

  // PATCH /api/screener/stocks/:ticker
  if (method === 'PATCH' && pathname.includes('/stocks/')) {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured" });
    }

    try {
      const ticker = pathname.split('/').pop();
      const { is_active } = req.body;

      const { data, error } = await supabase
        .from('screener_stocks')
        .update({ is_active })
        .eq('ticker', ticker.toUpperCase())
        .select()
        .single();

      if (error) throw error;
      return res.json({ stock: data });
    } catch (e) {
      console.error("Update stock error:", e);
      return res.status(500).json({ error: "Failed to update stock" });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: `Method ${method} not allowed for ${pathname}` });
}
