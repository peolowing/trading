import YahooFinanceClass from 'yahoo-finance2';
import { EMA, RSI, ATR } from 'technicalindicators';

// Initialize Yahoo Finance v3 (required for yahoo-finance2 >= 3.0)
const yahooFinance = new YahooFinanceClass({
  queue: { timeout: 60000 },
  suppressNotices: ['yahooSurvey', 'ripHistorical']
});
import dayjs from 'dayjs';
import { createClient } from '@supabase/supabase-js';

// In-memory cache (fallback when DB cache unavailable)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Supabase for persistent cache
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

async function getBacktestResults(ticker, date, strategy) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('backtest_results')
      .select('*')
      .eq('ticker', ticker)
      .eq('analysis_date', date)
      .eq('strategy', strategy)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error("Supabase backtest_results error:", error);
      return null;
    }

    return data;
  } catch (e) {
    console.error("getBacktestResults error:", e);
    return null;
  }
}

async function saveBacktestResults(ticker, date, results) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('backtest_results')
      .upsert({
        ticker,
        analysis_date: date,
        strategy: results.strategy,
        total_signals: results.totalSignals,
        wins: results.wins,
        losses: results.losses,
        win_rate: results.winRate,
        avg_win: results.avgWin,
        avg_loss: results.avgLoss,
        total_return: results.totalReturn,
        max_drawdown: results.maxDrawdown,
        sharpe_ratio: results.sharpeRatio,
        trades_data: results.trades
      }, { onConflict: 'ticker,analysis_date,strategy' });

    if (error) console.error("Supabase backtest_results error:", error);
  } catch (e) {
    console.error("saveBacktestResults error:", e);
  }
}

function alignSeries(series, totalLength) {
  const padding = totalLength - series.length;
  return Array(padding).fill(null).concat(series);
}

function detectStrategy(indicators) {
  const { ema20, ema50, rsi14, relativeVolume, regime, close } = indicators;

  if (!ema20 || !ema50 || !rsi14) return "Hold";

  const priceAboveEMA20 = close > ema20;
  const priceAboveEMA50 = close > ema50;
  const ema20AboveEMA50 = ema20 > ema50;

  // Calculate distance to EMA20 as percentage
  const distToEMA20Pct = Math.abs((close - ema20) / ema20) * 100;

  // Pullback Strategy
  if (regime === "Bullish Trend" && priceAboveEMA50 && !priceAboveEMA20 && rsi14 < 50) {
    return "Pullback";
  }

  // Breakout Strategy
  if (regime === "Consolidation" && relativeVolume > 1.5 && close > ema20) {
    return "Breakout";
  }

  // Reversal Strategy
  if (regime === "Bearish Trend" && rsi14 < 30 && relativeVolume > 1.3) {
    return "Reversal";
  }

  // Trend Following
  if (regime === "Bullish Trend" && priceAboveEMA20 && ema20AboveEMA50 && rsi14 > 50 && rsi14 < 70) {
    return "Trend Following";
  }

  // Near Breakout - Added to catch stocks very close to breakout
  // Criteria: Within 0.5% of EMA20, bullish structure (EMA20 > EMA50), neutral RSI
  if (regime === "Consolidation" && ema20AboveEMA50 && distToEMA20Pct <= 0.5 && rsi14 >= 40 && rsi14 <= 60) {
    return "Near Breakout";
  }

  return "Hold";
}

function runBacktest(candles, strategy) {
  let trades = [];
  let position = null;
  let equity = 10000;
  let peak = 10000;
  let maxDrawdown = 0;
  const returns = [];

  for (let i = 50; i < candles.length; i++) {
    const closes = candles.slice(0, i + 1).map(c => c.close);
    const highs = candles.slice(0, i + 1).map(c => c.high);
    const lows = candles.slice(0, i + 1).map(c => c.low);

    if (closes.length < 50) continue;

    const ema20Result = EMA.calculate({ period: 20, values: closes });
    const ema50Result = EMA.calculate({ period: 50, values: closes });
    const rsi14Result = RSI.calculate({ period: 14, values: closes });
    const atr14Result = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14
    });

    const ema20 = ema20Result[ema20Result.length - 1];
    const ema50 = ema50Result[ema50Result.length - 1];
    const rsi14 = rsi14Result[rsi14Result.length - 1];
    const atr14 = atr14Result[atr14Result.length - 1];

    const current = candles[i];
    const avgVolume = candles.slice(Math.max(0, i - 20), i).reduce((sum, c) => sum + c.volume, 0) / 20;
    const relativeVolume = avgVolume > 0 ? current.volume / avgVolume : 1;

    let regime = "Consolidation";
    if (ema20 > ema50 && current.close > ema20) regime = "Bullish Trend";
    else if (ema20 < ema50 && current.close < ema20) regime = "Bearish Trend";

    const indicators = {
      ema20,
      ema50,
      rsi14,
      relativeVolume,
      regime,
      close: current.close,
      high: current.high,
      low: current.low
    };

    const detectedStrategy = detectStrategy(indicators);
    const signal = detectedStrategy === strategy ? "BUY" : "HOLD";

    if (!position && signal === "BUY") {
      const shares = Math.floor(equity / current.close);
      if (shares > 0) {
        position = {
          entryPrice: current.close,
          shares,
          entryDate: current.date,
          stopLoss: current.close - 2 * atr14
        };
      }
    }

    if (position) {
      if (current.low <= position.stopLoss || rsi14 > 70) {
        const exitPrice = current.low <= position.stopLoss ? position.stopLoss : current.close;
        const profit = (exitPrice - position.entryPrice) * position.shares;
        equity += profit;
        const returnPct = (profit / (position.entryPrice * position.shares)) * 100;

        trades.push({
          entry: position.entryDate,
          exit: current.date,
          entryPrice: position.entryPrice,
          exitPrice,
          shares: position.shares,
          profit,
          returnPct
        });

        returns.push(returnPct / 100);
        position = null;

        if (equity > peak) peak = equity;
        const drawdown = ((peak - equity) / peak) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }
    }
  }

  if (position && candles.length > 0) {
    const lastCandle = candles[candles.length - 1];
    const profit = (lastCandle.close - position.entryPrice) * position.shares;
    equity += profit;
    const returnPct = (profit / (position.entryPrice * position.shares)) * 100;

    trades.push({
      entry: position.entryDate,
      exit: lastCandle.date,
      entryPrice: position.entryPrice,
      exitPrice: lastCandle.close,
      shares: position.shares,
      profit,
      returnPct
    });

    returns.push(returnPct / 100);
  }

  const wins = trades.filter(t => t.profit > 0);
  const losses = trades.filter(t => t.profit <= 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.returnPct, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.returnPct, 0) / losses.length : 0;
  const totalReturn = ((equity - 10000) / 10000) * 100;

  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length > 0
    ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length)
    : 0;
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  return {
    strategy,
    totalSignals: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    avgWin,
    avgLoss,
    totalReturn,
    maxDrawdown,
    sharpeRatio,
    trades
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ticker } = req.body;

    if (!ticker) {
      return res.status(400).json({ error: "Missing ticker" });
    }

    const today = dayjs().format('YYYY-MM-DD');
    const cacheKey = `${ticker}-${today}`;

    // Try Supabase cache first (persistent)
    if (supabase) {
      try {
        const { data: dbCached } = await supabase
          .from('indicators')
          .select('candles, ema20_series, ema50_series, rsi14_series, atr14_series, indicators_data')
          .eq('ticker', ticker)
          .eq('date', today)
          .maybeSingle();

        if (dbCached && dbCached.candles) {
          console.log(`[DB Cache HIT] ${ticker}`);

          const indicators = dbCached.indicators_data;

          // Fetch edge score from screener_stocks table (0-100 scale)
          let edgeScoreFromDB = null;
          try {
            const { data: screenerData } = await supabase
              .from('screener_stocks')
              .select('edge_score')
              .eq('ticker', ticker)
              .maybeSingle();

            edgeScoreFromDB = screenerData?.edge_score;
          } catch (e) {
            console.error(`Failed to fetch edge_score for ${ticker}:`, e);
          }

          // Use database edge_score if available, otherwise calculate fallback
          let finalEdgeScore;
          let scoreLabel;

          if (edgeScoreFromDB !== null && edgeScoreFromDB !== undefined) {
            // Use database score (0-100 scale)
            finalEdgeScore = edgeScoreFromDB;
            scoreLabel = finalEdgeScore >= 70 ? "Strong Edge" : finalEdgeScore >= 50 ? "OK" : "Weak Edge";
          } else {
            // Fallback: calculate basic score (0-10 scale)
            const regime = indicators.regime;
            const setup = indicators.setup;
            const rsi14 = indicators.rsi14;
            const relativeVolume = indicators.relativeVolume;

            let edgeScore = 5;
            if (regime === "Bullish Trend") edgeScore += 2;
            else if (regime === "Bearish Trend") edgeScore -= 2;
            if (rsi14 >= 40 && rsi14 <= 60) edgeScore += 1;
            if (rsi14 < 30 || rsi14 > 70) edgeScore -= 1;
            if (relativeVolume > 1.5) edgeScore += 1;
            if (relativeVolume < 0.8) edgeScore -= 0.5;
            if (setup !== "Hold") edgeScore += 0.5;

            finalEdgeScore = Math.max(0, Math.min(10, Math.round(edgeScore * 10) / 10));
            scoreLabel = finalEdgeScore >= 7 ? "Strong Edge" : finalEdgeScore >= 5 ? "OK" : "Weak Edge";
          }

          const scoring = {
            score: finalEdgeScore,
            label: scoreLabel
          };

          // Run backtest if setup is not Hold
          let backtestResult = null;
          if (setup !== "Hold") {
            const cached = await getBacktestResults(ticker, today, setup);
            if (cached) {
              backtestResult = {
                strategy: setup,
                stats: {
                  trades: cached.total_signals,
                  winRate: cached.win_rate,
                  totalReturn: cached.total_return,
                  avgWin: cached.avg_win,
                  avgLoss: cached.avg_loss,
                  expectancy: cached.avg_win * (cached.win_rate / 100) + cached.avg_loss * (1 - cached.win_rate / 100)
                },
                currentPosition: null
              };
            }
          }

          // Calculate trade recommendations even from cache
          const lastATR = dbCached.atr14_series[dbCached.atr14_series.length - 1];
          const lastClose = dbCached.candles[dbCached.candles.length - 1].close;
          let trade = null;

          if (lastATR) {
            const entry = lastClose;
            const atrMultiplier = 1.5;
            const rrRatio = 2.0;

            if (regime === "Bearish Trend") {
              const stop = entry + (lastATR * atrMultiplier);
              const target = entry - ((stop - entry) * rrRatio);

              trade = {
                direction: "SHORT",
                entry: parseFloat(entry.toFixed(2)),
                stop: parseFloat(stop.toFixed(2)),
                target: parseFloat(target.toFixed(2)),
                rr: rrRatio,
                atr: parseFloat(lastATR.toFixed(2))
              };
            } else {
              const stop = entry - (lastATR * atrMultiplier);
              const target = entry + ((entry - stop) * rrRatio);

              trade = {
                direction: "LONG",
                entry: parseFloat(entry.toFixed(2)),
                stop: parseFloat(stop.toFixed(2)),
                target: parseFloat(target.toFixed(2)),
                rr: rrRatio,
                atr: parseFloat(lastATR.toFixed(2))
              };
            }
          }

          return res.json({
            candles: dbCached.candles,
            ema20: dbCached.ema20_series,
            ema50: dbCached.ema50_series,
            rsi14: dbCached.rsi14_series,
            atr14: dbCached.atr14_series,
            indicators,
            scoring,
            trade,
            backtest: backtestResult
          });
        }
      } catch (e) {
        console.warn(`[DB Cache] ${e.message}`);
      }
    }

    // Fallback to in-memory cache
    const memCached = cache.get(cacheKey);
    if (memCached && Date.now() - memCached.timestamp < CACHE_TTL) {
      console.log(`[Memory Cache HIT] ${ticker}`);
      return res.json(memCached.data);
    }

    console.log(`[Cache MISS] ${ticker}`);

    // Fetch candles from Yahoo Finance (1 year for calculations)
    const startDate = dayjs().subtract(1, 'year').toDate();
    const rawCandles = await yahooFinance.chart(ticker, {
      period1: startDate,
      period2: new Date(),
      interval: '1d'
    });

    const candles = rawCandles.quotes.map(q => ({
      date: q.date.toISOString(),
      open: Math.round(q.open * 100) / 100,
      high: Math.round(q.high * 100) / 100,
      low: Math.round(q.low * 100) / 100,
      close: Math.round(q.close * 100) / 100,
      volume: q.volume,
      adjClose: Math.round((q.adjclose || q.close) * 100) / 100
    }));

    if (candles.length < 50) {
      return res.status(400).json({ error: "Need at least 50 candles for analysis" });
    }

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    const ema20Result = EMA.calculate({ period: 20, values: closes });
    const ema50Result = EMA.calculate({ period: 50, values: closes });
    const rsi14Result = RSI.calculate({ period: 14, values: closes });
    const atr14Result = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14
    });

    const ema20 = alignSeries(ema20Result, closes.length);
    const ema50 = alignSeries(ema50Result, closes.length);
    const rsi14 = alignSeries(rsi14Result, closes.length);
    const atr14 = alignSeries(atr14Result, closes.length);

    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const relativeVolume = avgVolume > 0 ? volumes[volumes.length - 1] / avgVolume : 1;

    let regime = "Consolidation";
    const lastEma20 = ema20[ema20.length - 1];
    const lastEma50 = ema50[ema50.length - 1];
    const lastClose = closes[closes.length - 1];

    if (!lastEma20 || !lastEma50 || !lastClose) {
      return res.status(500).json({ error: "Failed to calculate indicators" });
    }

    if (lastEma20 > lastEma50 && lastClose > lastEma20) {
      regime = "Bullish Trend";
    } else if (lastEma20 < lastEma50 && lastClose < lastEma20) {
      regime = "Bearish Trend";
    }

    let setup = "Hold";
    try {
      setup = detectStrategy({
        ema20: lastEma20,
        ema50: lastEma50,
        rsi14: rsi14[rsi14.length - 1],
        relativeVolume,
        regime,
        close: lastClose,
        high: highs[highs.length - 1],
        low: lows[lows.length - 1]
      });
    } catch (e) {
      console.error("detectStrategy error:", e);
    }

    const indicators = {
      ema20: lastEma20,
      ema50: lastEma50,
      rsi14: rsi14[rsi14.length - 1],
      atr14: atr14[atr14.length - 1],
      relativeVolume,
      regime,
      setup
    };

    // Fetch edge score from screener_stocks table (0-100 scale)
    let edgeScoreFromDB = null;
    if (supabase) {
      try {
        const { data: screenerData } = await supabase
          .from('screener_stocks')
          .select('edge_score')
          .eq('ticker', ticker)
          .maybeSingle();

        edgeScoreFromDB = screenerData?.edge_score;
      } catch (e) {
        console.error(`Failed to fetch edge_score for ${ticker}:`, e);
      }
    }

    // Use database edge_score if available, otherwise calculate fallback (0-10 scale)
    let finalEdgeScore;
    let scoreLabel;

    if (edgeScoreFromDB !== null && edgeScoreFromDB !== undefined) {
      // Use database score (0-100 scale)
      finalEdgeScore = edgeScoreFromDB;
      scoreLabel = finalEdgeScore >= 70 ? "Strong Edge" : finalEdgeScore >= 50 ? "OK" : "Weak Edge";
    } else {
      // Fallback: calculate basic score (0-10 scale)
      let edgeScore = 5;
      if (regime === "Bullish Trend") edgeScore += 2;
      else if (regime === "Bearish Trend") edgeScore -= 2;
      if (indicators.rsi14 >= 40 && indicators.rsi14 <= 60) edgeScore += 1;
      if (indicators.rsi14 < 30 || indicators.rsi14 > 70) edgeScore -= 1;
      if (relativeVolume > 1.5) edgeScore += 1;
      if (relativeVolume < 0.8) edgeScore -= 0.5;
      if (setup !== "Hold") edgeScore += 0.5;

      finalEdgeScore = Math.max(0, Math.min(10, Math.round(edgeScore * 10) / 10));
      scoreLabel = finalEdgeScore >= 7 ? "Strong Edge" : finalEdgeScore >= 5 ? "OK" : "Weak Edge";
    }

    const scoring = {
      score: finalEdgeScore,
      label: scoreLabel
    };

    // Run backtest with detected strategy
    let backtestResult = null;

    if (ticker && setup !== "Hold") {
      // Try to get cached backtest results first
      const cached = await getBacktestResults(ticker, today, setup);
      if (cached) {
        backtestResult = {
          strategy: setup,
          stats: {
            trades: cached.total_signals,
            winRate: cached.win_rate,
            totalReturn: cached.total_return,
            avgWin: cached.avg_win,
            avgLoss: cached.avg_loss,
            expectancy: cached.avg_win * (cached.win_rate / 100) + cached.avg_loss * (1 - cached.win_rate / 100)
          },
          currentPosition: null
        };
      } else {
        // Run fresh backtest
        const bt = runBacktest(candles, setup);
        await saveBacktestResults(ticker, today, bt);

        backtestResult = {
          strategy: setup,
          stats: {
            trades: bt.totalSignals,
            winRate: bt.winRate,
            totalReturn: bt.totalReturn,
            avgWin: bt.avgWin,
            avgLoss: bt.avgLoss,
            expectancy: bt.winRate > 0 ? (bt.avgWin * bt.winRate / 100) + (bt.avgLoss * (1 - bt.winRate / 100)) : 0
          },
          currentPosition: null
        };
      }
    }

    // Calculate trade recommendations (entry, stop, target)
    // Always provide trade object for manual entry, even if setup is "Hold"
    const lastATR = atr14[atr14.length - 1];
    let trade = null;

    if (lastATR) {
      const entry = lastClose;
      const atrMultiplier = 1.5; // Stop distance
      const rrRatio = 2.0; // Risk/Reward ratio

      // For short setups (bearish)
      if (regime === "Bearish Trend") {
        const stop = entry + (lastATR * atrMultiplier);
        const target = entry - ((stop - entry) * rrRatio);

        trade = {
          direction: "SHORT",
          entry: parseFloat(entry.toFixed(2)),
          stop: parseFloat(stop.toFixed(2)),
          target: parseFloat(target.toFixed(2)),
          rr: rrRatio,
          atr: parseFloat(lastATR.toFixed(2))
        };
      }
      // Default to long setups for all other cases (including "Hold")
      else {
        const stop = entry - (lastATR * atrMultiplier);
        const target = entry + ((entry - stop) * rrRatio);

        trade = {
          direction: "LONG",
          entry: parseFloat(entry.toFixed(2)),
          stop: parseFloat(stop.toFixed(2)),
          target: parseFloat(target.toFixed(2)),
          rr: rrRatio,
          atr: parseFloat(lastATR.toFixed(2))
        };
      }
    }

    // Only send last 6 months of candles to reduce response size
    const sixMonthsAgo = dayjs().subtract(6, 'month').format('YYYY-MM-DD');
    const recentCandles = candles.filter(c => c.date >= sixMonthsAgo);
    const startIndex = candles.length - recentCandles.length;

    const responseData = {
      candles: recentCandles.map(c => ({
        ...c,
        date: String(c.date).slice(0, 10)
      })),
      ema20: ema20.slice(startIndex),
      ema50: ema50.slice(startIndex),
      rsi14: rsi14.slice(startIndex),
      atr14: atr14.slice(startIndex),
      indicators,
      scoring,
      trade,
      backtest: backtestResult
    };

    // Save to Supabase cache (persistent)
    if (supabase) {
      try {
        await supabase
          .from('indicators')
          .upsert({
            ticker,
            date: today,
            ema20: indicators.ema20,
            ema50: indicators.ema50,
            rsi14: indicators.rsi14,
            atr14: indicators.atr14,
            relative_volume: indicators.relativeVolume,
            regime: indicators.regime,
            setup: indicators.setup,
            candles: responseData.candles,
            ema20_series: responseData.ema20,
            ema50_series: responseData.ema50,
            rsi14_series: responseData.rsi14,
            atr14_series: responseData.atr14,
            indicators_data: indicators
          }, { onConflict: 'ticker,date' });
        console.log(`[DB Cache SAVED] ${ticker}`);
      } catch (e) {
        console.warn(`[DB Cache Save Failed] ${e.message}`);
        // Fallback to in-memory cache
        cache.set(cacheKey, {
          data: responseData,
          timestamp: Date.now()
        });
      }
    } else {
      // No database - use in-memory cache
      cache.set(cacheKey, {
        data: responseData,
        timestamp: Date.now()
      });
    }

    // Clean old in-memory cache entries (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [key, value] of cache.entries()) {
      if (value.timestamp < oneHourAgo) {
        cache.delete(key);
      }
    }

    res.json(responseData);
  } catch (error) {
    console.error("Error in /api/analyze:", error);
    res.status(500).json({ error: error.message });
  }
}
