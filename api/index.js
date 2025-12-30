import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import yahooFinance from "yahoo-finance2";
import { EMA, RSI, ATR, SMA } from "technicalindicators";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import { updateWatchlistStatus, buildWatchlistInput } from "./watchlistLogic.js";
import { aiAnalysisRepo } from "../repositories/index.js";

dotenv.config({ path: ".env.local" });

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Supabase client (optional - only if credentials are configured)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const hasSupabase = supabaseUrl && supabaseKey && supabaseUrl !== "your-supabase-url-here";

const supabase = hasSupabase
  ? createClient(supabaseUrl, supabaseKey)
  : null;

function alignSeries(series, totalLength) {
  const padding = totalLength - series.length;
  return Array(padding).fill(null).concat(series);
}

// Helper: Spara marknadsdata till Supabase
async function saveMarketData(ticker, candles) {
  if (!supabase) return;
  try {
    const records = candles.map(c => ({
      ticker,
      date: c.date,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    }));

    const { error } = await supabase
      .from('market_data')
      .upsert(records, { onConflict: 'ticker,date' });

    if (error) console.error("Supabase market_data error:", error);
  } catch (e) {
    console.error("saveMarketData error:", e);
  }
}

// Helper: Hämta marknadsdata från Supabase
async function getMarketData(ticker, startDate) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('market_data')
      .select('*')
      .eq('ticker', ticker)
      .gte('date', startDate)
      .order('date', { ascending: true });

    if (error) {
      console.error("Supabase getMarketData error:", error);
      return null;
    }

    return data;
  } catch (e) {
    console.error("getMarketData error:", e);
    return null;
  }
}

// Helper: Spara indikatorer
async function saveIndicators(ticker, date, indicators) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('indicators')
      .upsert({
        ticker,
        date,
        ema20: indicators.ema20,
        ema50: indicators.ema50,
        rsi14: indicators.rsi14,
        atr14: indicators.atr14,
        relative_volume: indicators.relativeVolume,
        regime: indicators.regime,
        setup: indicators.setup
      }, { onConflict: 'ticker,date' });

    if (error) console.error("Supabase indicators error:", error);
  } catch (e) {
    console.error("saveIndicators error:", e);
  }
}

// Helper: Spara AI-analys
async function saveAIAnalysis(ticker, date, analysis) {
  if (!supabase) return;
  return await aiAnalysisRepo.saveAnalysis(ticker, {
    analysis_text: analysis,
    edge_score: null,
    edge_label: null,
    win_rate: null,
    total_return: null,
    trades_count: null
  });
}

// Helper: Hämta senaste AI-analys (oavsett datum)
async function getAIAnalysis(ticker) {
  return await aiAnalysisRepo.getLatestAnalysis(ticker);
}

// Helper: Spara backtest-resultat
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

// Helper: Hämta backtest-resultat
async function getBacktestResults(ticker, date, strategy) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('backtest_results')
      .select('*')
      .eq('ticker', ticker)
      .eq('analysis_date', date)
      .eq('strategy', strategy)
      .single();

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

// Helper: Hämta screener aktier från Supabase
async function getScreenerStocks() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('screener_stocks')
      .select('*')
      .eq('is_active', true)
      .order('ticker', { ascending: true });

    if (error) {
      console.error("Supabase getScreenerStocks error:", error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error("getScreenerStocks error:", e);
    return [];
  }
}

function detectStrategy(indicators) {
  const { ema20, ema50, rsi14, relativeVolume, regime, close, high, low } = indicators;

  if (!ema20 || !ema50 || !rsi14) return "Hold";

  const priceAboveEMA20 = close > ema20;
  const priceAboveEMA50 = close > ema50;
  const ema20AboveEMA50 = ema20 > ema50;

  // Calculate distance to EMA20 as percentage
  const distToEMA20Pct = Math.abs((close - ema20) / ema20) * 100;

  // Debug: Log all values for Consolidation regime
  if (regime === "Consolidation" && distToEMA20Pct <= 1.0) {
    console.log(`[detectStrategy Debug] close: ${close}, ema20: ${ema20}, ema50: ${ema50}, rsi14: ${rsi14}`);
    console.log(`[detectStrategy Debug] ema20AboveEMA50: ${ema20AboveEMA50}, distToEMA20Pct: ${distToEMA20Pct.toFixed(3)}%`);
    console.log(`[detectStrategy Debug] All checks: regime=${regime}, ema20>ema50=${ema20AboveEMA50}, dist<0.5=${distToEMA20Pct <= 0.5}, rsi 40-60=${rsi14 >= 40 && rsi14 <= 60}`);
  }

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
    console.log(`[Near Breakout Triggered] Regime: ${regime}, EMA20>${EMA50}: ${ema20AboveEMA50}, Dist: ${distToEMA20Pct.toFixed(3)}%, RSI: ${rsi14}`);
    return "Near Breakout";
  }

  // Debug: Log why Near Breakout didn't trigger
  if (regime === "Consolidation" && distToEMA20Pct <= 0.5) {
    console.log(`[Near Breakout Check Failed] ema20AboveEMA50: ${ema20AboveEMA50} (${ema20} > ${ema50}), RSI: ${rsi14} (need 40-60)`);
  }

  return "Hold";
}

// Compute features for ranking
function computeFeatures(candles) {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  const ema20 = EMA.calculate({ period: 20, values: closes }).at(-1);
  const ema50 = EMA.calculate({ period: 50, values: closes }).at(-1);
  const sma50 = SMA.calculate({ period: 50, values: closes }).at(-1);
  const sma200 = SMA.calculate({ period: 200, values: closes }).at(-1);
  const rsi14 = RSI.calculate({ period: 14, values: closes }).at(-1);
  const atr14 = ATR.calculate({ period: 14, high: highs, low: lows, close: closes }).at(-1);

  const close = closes.at(-1);
  const avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const relVol = volumes.at(-1) / avgVol20;

  const regime = ema20 > ema50 ? "UPTREND" : "DOWNTREND";

  // EMA20 slope (change over last 10 days)
  const ema20Series = EMA.calculate({ period: 20, values: closes });
  const slope = ema20Series.length >= 10
    ? (ema20Series.at(-1) - ema20Series.at(-10)) / ema20Series.at(-10)
    : 0;

  return { ema20, ema50, sma50, sma200, rsi14, atr14, close, relVol, regime, slope };
}

// Ranking: 0-100 score
function computeRanking(features, candles, bucket = "UNKNOWN") {
  let score = 0;

  // 1. Liquidity (30 pts)
  const last = candles.at(-1);
  const turnoverM = (last.close * last.volume) / 1_000_000;
  if (turnoverM > 200) score += 30;      // Large-cap
  else if (turnoverM > 100) score += 25; // Large-cap
  else if (turnoverM > 50) score += 20;  // Large/Mid-cap
  else if (turnoverM > 30) score += 15;  // Mid-cap
  else if (turnoverM > 15) score += 10;  // Mid-cap

  // 2. Trend (30 pts)
  if (features.regime === "UPTREND") {
    score += 18;
    if (features.slope > 0.05) score += 12;
    else if (features.slope > 0) score += 6;
  } else {
    if (features.slope < -0.05) score -= 5;
  }

  // 3. Volatility (20 pts)
  const atrPct = features.atr14 / features.close;
  if (atrPct >= 0.02 && atrPct <= 0.05) score += 20; // sweet spot
  else if (atrPct > 0.05) score += 10; // high volatility ok
  else score += 5; // low volatility less interesting

  // Penalty for Mid Cap with low ATR
  if (bucket === "MID_CAP" && atrPct < 0.018) {
    score -= 10;
  }

  // 4. Momentum (20 pts)
  if (features.rsi14 >= 40 && features.rsi14 <= 60) score += 15; // neutral/bullish
  else if (features.rsi14 > 60 && features.rsi14 <= 70) score += 10; // strong but not overbought
  else if (features.rsi14 < 30) score += 5; // oversold = potential

  if (features.relVol > 1.3) score += 5; // above-average volume

  return Math.max(0, Math.min(100, score));
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

app.get("/api/market-data", async (req, res) => {
  try {
    const { ticker } = req.query;
    if (!ticker) return res.status(400).json({ error: "Missing ticker" });

    const startDate = dayjs().subtract(3, 'year').format('YYYY-MM-DD');

    let cachedData = await getMarketData(ticker, startDate);
    const today = dayjs().format('YYYY-MM-DD');
    const needsFetch = !cachedData || cachedData.length === 0 ||
                       !cachedData.find(d => d.date === today);

    if (needsFetch) {
      console.log(`Fetching fresh market data for ${ticker} from Yahoo Finance`);
      const result = await yahooFinance.historical(ticker, {
        period1: startDate,
        period2: dayjs().format('YYYY-MM-DD')
      });

      if (!result || result.length === 0) {
        return res.status(404).json({ error: "No data from Yahoo Finance" });
      }

      const candles = result.map(r => ({
        date: dayjs(r.date).format('YYYY-MM-DD'),
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume
      }));

      await saveMarketData(ticker, candles);
      cachedData = candles;
    } else {
      console.log(`Using cached market data for ${ticker}`);
    }

    res.json({ candles: cachedData });
  } catch (error) {
    console.error("Error fetching market data:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { ticker, candles: providedCandles } = req.body;

    // If ticker is provided, fetch candles from Yahoo Finance
    let candles = providedCandles;
    if (ticker && !providedCandles) {
      const startDate = dayjs().subtract(3, 'year').format('YYYY-MM-DD');
      const rawCandles = await yahooFinance.chart(ticker, {
        period1: startDate,
        period2: dayjs().format('YYYY-MM-DD')
      });

      candles = rawCandles.quotes.map(q => ({
        date: q.date.toISOString(),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume,
        adjClose: q.adjclose || q.close
      }));
    }

    if (!candles || candles.length === 0) {
      return res.status(400).json({ error: "Missing candles data" });
    }

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
      console.error("Missing indicator values:", { lastEma20, lastEma50, lastClose, ema20Length: ema20.length, ema50Length: ema50.length });
      return res.status(500).json({ error: "Failed to calculate indicators" });
    }

    if (lastEma20 > lastEma50 && lastClose > lastEma20) {
      regime = "Bullish Trend";
    } else if (lastEma20 < lastEma50 && lastClose < lastEma20) {
      regime = "Bearish Trend";
    }

    let setup = "Hold";
    let debugInfo = null;
    try {
      const strategyInput = {
        ema20: lastEma20,
        ema50: lastEma50,
        rsi14: rsi14[rsi14.length - 1],
        relativeVolume,
        regime,
        close: lastClose,
        high: highs[highs.length - 1],
        low: lows[lows.length - 1]
      };

      // Debug info
      const distToEMA20 = Math.abs((lastClose - lastEma20) / lastEma20) * 100;
      debugInfo = {
        close: lastClose,
        ema20: lastEma20,
        ema50: lastEma50,
        rsi: rsi14[rsi14.length - 1],
        regime,
        distToEMA20Pct: distToEMA20,
        ema20AboveEMA50: lastEma20 > lastEma50,
        shouldTriggerNearBreakout: regime === "Consolidation" && lastEma20 > lastEma50 && distToEMA20 <= 0.5 && rsi14[rsi14.length - 1] >= 40 && rsi14[rsi14.length - 1] <= 60
      };

      setup = detectStrategy(strategyInput);
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

    // Calculate edge score (0-100 scale) using computeRanking
    const features = computeFeatures(candles);
    const finalEdgeScore = computeRanking(features, candles, "UNKNOWN");

    const scoring = {
      score: finalEdgeScore,
      label: finalEdgeScore >= 70 ? "Strong Edge" : finalEdgeScore >= 50 ? "OK" : "Weak Edge"
    };

    // Run backtest with detected strategy
    const today = dayjs().format('YYYY-MM-DD');
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
          currentPosition: null // Not tracking current position in cached data
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
          currentPosition: null // Not tracking current position
        };
      }
    }

    // Calculate trade recommendations (entry, stop, target)
    // Always provide trade object for manual entry, even if setup is "Hold"
    const lastATR = atr14[atr14.length - 1];
    let trade = null;

    console.log('Trade calculation debug:', { lastATR, lastClose, regime });

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

    console.log('Trade object before response:', trade);

    res.json({
      candles: candles.map(c => ({
        ...c,
        date: String(c.date).slice(0, 10)
      })),
      ema20,
      ema50,
      rsi14,
      atr14,
      indicators,
      scoring,
      trade,
      backtest: backtestResult,
      debug: debugInfo  // Temporary debug info
    });
  } catch (error) {
    console.error("Error in /api/analyze:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai-analysis", async (req, res) => {
  try {
    const { ticker, candles, indicators, force } = req.body;

    if (!ticker || !candles || !indicators) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const forceRefresh = force === true;

    if (!forceRefresh) {
      let cached = await getAIAnalysis(ticker);
      if (cached) {
        console.log(`Using cached AI analysis for ${ticker}`);
        return res.json({ analysis: cached.analysis_text });
      }
    }

    console.log(`Fetching fresh AI analysis for ${ticker}`);

    const recentCandles = candles.slice(-30);
    const priceChange = ((candles[candles.length - 1].close - candles[candles.length - 2].close) / candles[candles.length - 2].close) * 100;

    const strategies = ["Pullback", "Breakout", "Reversal", "Trend Following"];
    const backtestPromises = strategies.map(async (strat) => {
      let cached = await getBacktestResults(ticker, today, strat);
      if (cached) {
        return {
          strategy: strat,
          totalSignals: cached.total_signals,
          wins: cached.wins,
          losses: cached.losses,
          winRate: cached.win_rate,
          avgWin: cached.avg_win,
          avgLoss: cached.avg_loss,
          totalReturn: cached.total_return,
          maxDrawdown: cached.max_drawdown,
          sharpeRatio: cached.sharpe_ratio,
          trades: cached.trades_data
        };
      }

      const result = runBacktest(candles, strat);
      await saveBacktestResults(ticker, today, result);
      return result;
    });

    const backtestResults = await Promise.all(backtestPromises);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Du är en erfaren swing trader som analyserar veckotrading-möjligheter.

VIKTIGT: Svara ENDAST på svenska. All text ska vara på svenska.

Ge ditt svar i exakt följande struktur på svenska:

## MARKNADSLÄGE
[2-3 meningar om trenden. Beskriv TYDLIGT förhållandet mellan Pris, EMA20 och EMA50 med konkreta siffror. Exempel: "Priset (79 kr) ligger UNDER EMA20 (90 kr) vilket indikerar svaghet" eller "Priset (95 kr) ligger ÖVER både EMA20 (90 kr) och EMA50 (88 kr) vilket bekräftar upptrend". Förklara om det är uppåt-, nedåt- eller sidledes trend och VARFÖR.]

## TEKNISKA SIGNALER
• **RSI:** [Nuvarande RSI-värde och vad det betyder - överköpt/översålt/neutralt. Förklara om det stödjer eller motsäger trenden.]
• **EMAs:** [Ange EXAKT förhållande med siffror: "Pris (X kr) vs EMA20 (Y kr) vs EMA50 (Z kr)". Förklara om detta är bullish (Pris > EMA20 > EMA50) eller bearish (Pris < EMA20 < EMA50) eller consolidation.]
• **Volym:** [Relativ volym X.XX - är det hög (>1.0), normal (0.7-1.0) eller låg (<0.7) aktivitet? Vad betyder det?]
• **Volatilitet (ATR):** [ATR X.XX kr vilket motsvarar Y% av priset - är det hög (>3%), normal (1.5-3%) eller låg (<1.5%) volatilitet?]

## STRATEGI & RESONEMANG
[Systemet har identifierat marknadsregimen och trading setup (se Tekniska indikatorer). Förklara VARFÖR denna klassificering gjorts baserat på förhållandet mellan Pris, EMA20 och EMA50. Jämför backtestresultaten för de olika strategierna och förklara vilken som fungerat bäst historiskt OCH om nuvarande marknadsläge matchar den strategin. Om ingen strategi passar (Setup = "Hold") - förklara exakt VARFÖR och vad som behöver förändras för att få en tradable setup. Om Setup = "Near Breakout" - förklara att priset är MYCKET NÄRA (inom 0.5%) att bryta över EMA20 och detta är en perfekt bevakningssituation - en liten uppgång kan trigga ett köptillfälle.]

## HANDELSBESLUT
**Rekommendation:** [KÖP / INVÄNTA / UNDVIK]
**Motivering:** [2-3 meningar som FÖRKLARAR varför detta beslut. Om INVÄNTA - förklara exakt VAD som saknas (t.ex. "Priset måste över EMA20 (X kr)", "Vänta på volym >1.0x", "RSI behöver nå 50-60"). Om KÖP - förklara vad som är BRA. Om UNDVIK - förklara vad som är DÅLIGT.]
**Entry-nivå:** [Om KÖP: konkret prisnivå. Om INVÄNTA: "Vänta tills [KONKRET VILLKOR uppfylls]"]
**Vad händer nästa:** [Beskriv exakt vad som behöver hända för att setupen ska bli tradable]

## RISK & POSITIONSSTORLEK
**Stop Loss:** [Konkret stop loss-nivå baserat på ATR eller support/resistance]
**Target:** [Konkret målpris baserat på risk/reward ratio]
**Risk/Reward:** [Förhållande, t.ex. 1:2 eller 1:3]
**Position Size:** [Förslag baserat på ATR och risk, t.ex. "Max 2-3% av portföljen med stopp på X kr"]

## BACKTEST-INSIKTER
[2-3 meningar om vad backtestet visar för de olika strategierna - vinstprocent, genomsnittlig vinst/förlust, antal signaler. Vilken strategi har fungerat bäst historiskt?]

## SAMMANFATTNING
[1-2 meningar med tydlig konklusion - finns setup eller inte, vad är nästa steg]`
        },
        {
          role: "user",
          content: `Analysera ${ticker}:

Senaste stängning: ${candles[candles.length - 1].close.toFixed(2)} (${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%)

Tekniska indikatorer:
- Nuvarande pris: ${candles[candles.length - 1].close.toFixed(2)} kr
- EMA20: ${indicators.ema20?.toFixed(2) || 'N/A'} kr
- EMA50: ${indicators.ema50?.toFixed(2) || 'N/A'} kr
- RSI(14): ${indicators.rsi14?.toFixed(2) || 'N/A'}
- ATR(14): ${indicators.atr14?.toFixed(2) || 'N/A'} kr (${indicators.atr14 && candles[candles.length - 1].close ? ((indicators.atr14 / candles[candles.length - 1].close) * 100).toFixed(2) : 'N/A'}%)
- Relativ volym: ${indicators.relativeVolume?.toFixed(2) || 'N/A'}x
- Regime: ${indicators.regime || 'N/A'}
- Setup: ${indicators.setup || 'N/A'}

Backtest-resultat (senaste 3 åren):
${backtestResults.map(bt => `
${bt.strategy}:
- Signaler: ${bt.totalSignals}
- Vinstprocent: ${bt.winRate.toFixed(1)}%
- Genomsnittlig vinst: ${bt.avgWin.toFixed(0)} kr
- Genomsnittlig förlust: ${bt.avgLoss.toFixed(0)} kr
- Total avkastning: ${bt.totalReturn.toFixed(1)}%
- Max drawdown: ${bt.maxDrawdown.toFixed(1)}%
- Sharpe ratio: ${bt.sharpeRatio.toFixed(2)}
`).join('\n')}

Senaste 30 dagars prisdata: ${recentCandles.map(c => c.close.toFixed(2)).join(', ')}

Ge konkret trading-rekommendation baserat på nuläget.`
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const analysis = completion.choices[0].message.content;
    await saveAIAnalysis(ticker, dayjs().format('YYYY-MM-DD'), analysis);

    res.json({ analysis });
  } catch (error) {
    console.error("Error in /api/ai-analysis:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get AI analysis history for a ticker
app.get("/api/ai-analysis/history/:ticker", async (req, res) => {
  try {
    const { ticker } = req.params;
    const analyses = await aiAnalysisRepo.getRecentAnalyses(ticker, 3);

    let comparison = null;
    if (analyses.length >= 2) {
      comparison = aiAnalysisRepo.compareAnalyses(analyses[0], analyses[1]);
    }

    res.json({
      analyses,
      comparison,
      count: analyses.length
    });
  } catch (error) {
    console.error("Error in /api/ai-analysis/history:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/screener", async (req, res) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');

    const dbStocks = await getScreenerStocks();

    const tickers = dbStocks.length > 0
      ? dbStocks.map(s => s.ticker)
      : ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA", "VOLV-B.ST"];

    console.log(`Running ${req.query.force === 'true' ? 'fresh' : 'cached'} screener...`);

    const results = await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const startDate = dayjs().subtract(3, 'year').format('YYYY-MM-DD');

          let cachedData = await getMarketData(ticker, startDate);
          const needsFetch = !cachedData || cachedData.length === 0 ||
                            !cachedData.find(d => d.date === today);

          let candles;
          if (needsFetch) {
            console.log(`Fetching fresh market data for ${ticker} from Yahoo Finance`);
            const result = await yahooFinance.historical(ticker, {
              period1: startDate,
              period2: today
            });

            if (!result || result.length === 0) return null;

            candles = result.map(r => ({
              date: dayjs(r.date).format('YYYY-MM-DD'),
              open: r.open,
              high: r.high,
              low: r.low,
              close: r.close,
              volume: r.volume
            }));

            await saveMarketData(ticker, candles);
          } else {
            console.log(`Using cached market data for ${ticker}`);
            candles = cachedData;
          }

          if (candles.length < 50) return null;

          const closes = candles.map(c => c.close);
          const highs = candles.map(c => c.high);
          const lows = candles.map(c => c.low);
          const volumes = candles.map(c => c.volume);

          const ema20 = EMA.calculate({ period: 20, values: closes });
          const ema50 = EMA.calculate({ period: 50, values: closes });
          const rsi14 = RSI.calculate({ period: 14, values: closes });
          const atr14 = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });

          const lastEma20 = ema20[ema20.length - 1];
          const lastEma50 = ema50[ema50.length - 1];
          const lastRsi = rsi14[rsi14.length - 1];
          const lastAtr = atr14[atr14.length - 1];
          const lastClose = closes[closes.length - 1];
          const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
          const relativeVolume = avgVolume > 0 ? volumes[volumes.length - 1] / avgVolume : 1;

          let regime = "Consolidation";
          if (lastEma20 > lastEma50 && lastClose > lastEma20) regime = "Bullish Trend";
          else if (lastEma20 < lastEma50 && lastClose < lastEma20) regime = "Bearish Trend";

          const setup = detectStrategy({
            ema20: lastEma20,
            ema50: lastEma50,
            rsi14: lastRsi,
            relativeVolume,
            regime,
            close: lastClose,
            high: highs[highs.length - 1],
            low: lows[lows.length - 1]
          });

          // Calculate edge score (0-100 scale) using computeRanking
          const features = computeFeatures(candles);
          const bucket = dbStocks.find(s => s.ticker === ticker)?.bucket || "UNKNOWN";
          const finalEdgeScore = computeRanking(features, candles, bucket);

          // Skip AI analysis in screener for performance
          // AI analysis will be loaded when user selects a specific stock
          return {
            ticker,
            price: lastClose,
            ema20: lastEma20,
            ema50: lastEma50,
            rsi: lastRsi,
            atr: lastAtr,
            relativeVolume,
            regime,
            setup,
            edgeScore: finalEdgeScore
          };
        } catch (error) {
          console.error(`Error processing ${ticker}:`, error);
          return null;
        }
      })
    );

    const filtered = results.filter(r => r !== null);
    res.json({ stocks: filtered });
  } catch (error) {
    console.error("Error in /api/screener:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/screener/stocks", async (req, res) => {
  try {
    const stocks = await getScreenerStocks();
    res.json({ stocks });
  } catch (e) {
    console.error("Get screener stocks error:", e);
    res.status(500).json({ error: "Failed to fetch stocks" });
  }
});

app.post("/api/screener/stocks", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  try {
    const { ticker, name } = req.body;

    if (!ticker) {
      return res.status(400).json({ error: "Ticker is required" });
    }

    const { data, error } = await supabase
      .from('screener_stocks')
      .insert([{ ticker: ticker.toUpperCase(), name: name || null }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: "Ticker already exists" });
      }
      throw error;
    }

    res.status(201).json({ stock: data });
  } catch (e) {
    console.error("Add stock error:", e);
    res.status(500).json({ error: "Failed to add stock" });
  }
});

app.delete("/api/screener/stocks/:ticker", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  try {
    const { ticker } = req.params;

    const { error } = await supabase
      .from('screener_stocks')
      .delete()
      .eq('ticker', ticker.toUpperCase());

    if (error) throw error;

    res.status(204).send();
  } catch (e) {
    console.error("Delete stock error:", e);
    res.status(500).json({ error: "Failed to delete stock" });
  }
});

app.get("/api/trades", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  try {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;
    res.json({ trades: data || [] });
  } catch (e) {
    console.error("Get trades error:", e);
    res.status(500).json({ error: "Failed to fetch trades" });
  }
});

app.post("/api/trades", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  try {
    const trade = req.body;
    const { data, error } = await supabase
      .from('trades')
      .insert([trade])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ trade: data });
  } catch (e) {
    console.error("Create trade error:", e);
    res.status(500).json({ error: "Failed to create trade" });
  }
});

app.put("/api/trades/:id", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  try {
    const { id } = req.params;
    const trade = req.body;

    const { data, error } = await supabase
      .from('trades')
      .update(trade)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ trade: data });
  } catch (e) {
    console.error("Update trade error:", e);
    res.status(500).json({ error: "Failed to update trade" });
  }
});

app.delete("/api/trades/:id", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.status(204).send();
  } catch (e) {
    console.error("Delete trade error:", e);
    res.status(500).json({ error: "Failed to delete trade" });
  }
});

// Watchlist endpoints
app.get("/api/watchlist", async (req, res) => {
  if (!supabase) {
    return res.json({ stocks: [] });
  }

  try {
    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .order('added_at', { ascending: false });

    if (error) throw error;
    res.json({ stocks: data || [] });
  } catch (e) {
    console.error("Get watchlist error:", e);
    res.status(500).json({ error: "Failed to fetch watchlist" });
  }
});

app.post("/api/watchlist", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  try {
    const { ticker, indicators } = req.body;

    if (!ticker) {
      return res.status(400).json({ error: "Ticker is required" });
    }

    const normalizedTicker = ticker.toUpperCase();

    // Bygg initial snapshot
    const today = dayjs().format('YYYY-MM-DD');
    const insertData = {
      ticker: normalizedTicker,
      last_updated: today,
      days_in_watchlist: 0
    };

    // Om indicators finns med (från frontend), spara initial snapshot
    if (indicators) {
      insertData.initial_price = indicators.price || null;
      insertData.initial_ema20 = indicators.ema20 || null;
      insertData.initial_ema50 = indicators.ema50 || null;
      insertData.initial_rsi14 = indicators.rsi14 || null;
      insertData.initial_regime = indicators.regime || null;
      insertData.initial_setup = indicators.setup || null;

      // Kör första statusuppdateringen direkt
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

    res.status(201).json({ stock: data });
  } catch (e) {
    console.error("Add to watchlist error:", e);
    res.status(500).json({ error: "Failed to add to watchlist" });
  }
});

app.delete("/api/watchlist/:ticker", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  try {
    const { ticker } = req.params;
    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('ticker', ticker.toUpperCase());

    if (error) throw error;
    res.status(204).send();
  } catch (e) {
    console.error("Delete from watchlist error:", e);
    res.status(500).json({ error: "Failed to delete from watchlist" });
  }
});

// GET /api/watchlist/live - Hämta live quotes från Yahoo Finance
app.get("/api/watchlist/live", async (req, res) => {
  try {
    const { tickers } = req.query;
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

    res.json({ quotes });
  } catch (e) {
    console.error("Get live watchlist error:", e);
    res.status(500).json({ error: "Failed to fetch live data" });
  }
});

// POST /api/watchlist/update - Uppdatera alla watchlist-statusar (daglig batch)
app.post("/api/watchlist/update", async (req, res) => {
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

    for (const stock of watchlistStocks) {
      try {
        const ticker = stock.ticker;

        const startDate = dayjs().subtract(1, 'year').format('YYYY-MM-DD');
        let cachedData = await getMarketData(ticker, startDate);
        const needsFetch = !cachedData || cachedData.length === 0 ||
                          !cachedData.some(c => c.date === today);

        let candles;
        if (needsFetch) {
          console.log(`[Watchlist Update] Fetching ${ticker}`);
          const rawCandles = await yahooFinance.chart(ticker, {
            period1: startDate,
            period2: today
          });

          candles = rawCandles.quotes.map(q => ({
            date: dayjs(q.date).format('YYYY-MM-DD'),
            open: q.open,
            high: q.high,
            low: q.low,
            close: q.close,
            volume: q.volume
          }));

          await saveMarketData(ticker, candles);
        } else {
          candles = cachedData;
        }

        if (candles.length < 50) continue;

        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const volumes = candles.map(c => c.volume);

        const ema20Result = EMA.calculate({ period: 20, values: closes });
        const ema50Result = EMA.calculate({ period: 50, values: closes });
        const rsi14Result = RSI.calculate({ period: 14, values: closes });

        const ema20 = alignSeries(ema20Result, closes.length);
        const ema50 = alignSeries(ema50Result, closes.length);
        const rsi14 = alignSeries(rsi14Result, closes.length);

        const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const relativeVolume = avgVolume > 0 ? volumes[volumes.length - 1] / avgVolume : 1;

        const input = buildWatchlistInput(
          ticker,
          candles,
          { ema20, ema50, rsi14, relativeVolume },
          stock.current_status,
          stock.added_at
        );

        const result = updateWatchlistStatus(input);

        const { error: updateError } = await supabase
          .from('watchlist')
          .update({
            last_updated: today,
            current_status: result.status,
            current_action: result.action,
            status_reason: result.reason,
            dist_ema20_pct: parseFloat(result.diagnostics.distEma20Pct),
            rsi_zone: result.diagnostics.rsiZone,
            volume_state: result.diagnostics.volumeState,
            time_warning: result.timeWarning,
            days_in_watchlist: input.daysInWatchlist
          })
          .eq('ticker', ticker);

        if (!updateError) {
          console.log(`[Watchlist Update] ✓ ${ticker} → ${result.status}`);
          updates.push({
            ticker,
            status: result.status,
            action: result.action
          });
        }

      } catch (stockError) {
        console.error(`[Watchlist Update] Error ${stock.ticker}:`, stockError.message);
      }
    }

    res.json({
      message: "Watchlist updated",
      updated: updates.length,
      total: watchlistStocks.length,
      results: updates
    });

  } catch (e) {
    console.error("Watchlist update error:", e);
    res.status(500).json({ error: "Failed to update watchlist" });
  }
});

// Portfolio endpoints
app.get("/api/portfolio", async (req, res) => {
  if (!supabase) {
    return res.json({ stocks: [] });
  }

  try {
    const { data, error } = await supabase
      .from('portfolio')
      .select('*')
      .order('added_at', { ascending: false });

    if (error) throw error;
    res.json({ stocks: data || [] });
  } catch (e) {
    console.error("Get portfolio error:", e);
    res.status(500).json({ error: "Failed to fetch portfolio" });
  }
});

app.post("/api/portfolio", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  try {
    const { ticker, entryPrice, quantity } = req.body;
    const { data, error } = await supabase
      .from('portfolio')
      .insert([{
        ticker: ticker.toUpperCase(),
        entry_price: entryPrice,
        quantity: quantity
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: "Already in portfolio" });
      }
      throw error;
    }

    res.status(201).json({ stock: data });
  } catch (e) {
    console.error("Add to portfolio error:", e);
    res.status(500).json({ error: "Failed to add to portfolio" });
  }
});

app.delete("/api/portfolio/:ticker", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  try {
    const { ticker } = req.params;
    const { error } = await supabase
      .from('portfolio')
      .delete()
      .eq('ticker', ticker.toUpperCase());

    if (error) throw error;
    res.status(204).send();
  } catch (e) {
    console.error("Delete from portfolio error:", e);
    res.status(500).json({ error: "Failed to delete from portfolio" });
  }
});

app.patch("/api/screener/stocks/:ticker", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  try {
    const { ticker } = req.params;
    const { is_active } = req.body;

    const { data, error } = await supabase
      .from('screener_stocks')
      .update({ is_active })
      .eq('ticker', ticker.toUpperCase())
      .select()
      .single();

    if (error) throw error;
    res.json({ stock: data });
  } catch (e) {
    console.error("Update stock error:", e);
    res.status(500).json({ error: "Failed to update stock" });
  }
});

export default app;

// Vercel serverless function handler
export const handler = app;
