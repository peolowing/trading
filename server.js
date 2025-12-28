import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import yahooFinance from "yahoo-finance2";
import { EMA, RSI, ATR } from "technicalindicators";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import { updateWatchlistStatus, buildWatchlistInput } from "./lib/watchlistLogic.js";
import {
  portfolioRepo,
  eventsRepo,
  watchlistRepo,
  backtestRepo,
  marketdataRepo,
  screenerRepo
} from "./repositories/index.js";
import {
  positionService,
  analysisService,
  watchlistService
} from "./services/index.js";

dotenv.config({ path: ".env.local" });

const app = express();
const PORT = 3002;

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

// Strategy detection
function detectStrategy(indicators) {
  const { ema20, ema50, rsi14, relativeVolume, regime, close } = indicators;

  if (!ema20 || !ema50 || !rsi14) return "Hold";

  const priceAboveEMA20 = close > ema20;
  const priceAboveEMA50 = close > ema50;
  const ema20AboveEMA50 = ema20 > ema50;

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

  return "Hold";
}

// Helper: Get backtest results from Supabase
async function getBacktestResults(ticker, date, strategy) {
  return backtestRepo.findByTickerDateStrategy(ticker, date, strategy);
}

// Helper: Save backtest results to Supabase
async function saveBacktestResults(ticker, date, results) {
  if (!backtestRepo.hasDatabase()) return;
  try {
    await backtestRepo.upsert(ticker, date, {
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
    });
  } catch (e) {
    console.error("saveBacktestResults error:", e);
  }
}

// Helper: Spara marknadsdata till Supabase
async function saveMarketData(ticker, candles) {
  if (!marketdataRepo.hasDatabase()) return;
  try {
    await marketdataRepo.saveCandles(ticker, candles);
  } catch (e) {
    console.error("saveMarketData error:", e);
  }
}

// Helper: Hämta marknadsdata från Supabase
async function getMarketData(ticker, startDate) {
  try {
    return await marketdataRepo.findByTickerFromDate(ticker, startDate);
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

// Helper: Spara AI-analys (max 1 per dag)
async function saveAIAnalysis(ticker, analysisText, scoring, backtest) {
  if (!supabase) return false;
  try {
    const today = new Date().toISOString().split('T')[0];

    // Kolla om AI-analys redan finns för idag
    const { data: existing } = await supabase
      .from('ai_analysis')
      .select('id')
      .eq('ticker', ticker)
      .eq('analysis_date', today)
      .single();

    if (existing) {
      console.log(`AI analysis already exists for ${ticker} today, skipping save`);
      return false;
    }

    const { error } = await supabase
      .from('ai_analysis')
      .insert({
        ticker,
        analysis_date: today,
        analysis_text: analysisText,
        edge_score: scoring?.score,
        edge_label: scoring?.label,
        win_rate: backtest?.stats?.winRate,
        total_return: backtest?.stats?.totalReturn,
        trades_count: backtest?.stats?.trades
      });

    if (error) console.error("Supabase ai_analysis error:", error);
    return true;
  } catch (e) {
    console.error("saveAIAnalysis error:", e);
    return false;
  }
}

// Helper: Hämta AI-analys för idag
async function getAIAnalysis(ticker) {
  if (!supabase) return null;
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('ai_analysis')
      .select('*')
      .eq('ticker', ticker)
      .eq('analysis_date', today)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Supabase getAIAnalysis error:", error);
      return null;
    }

    return data;
  } catch (e) {
    console.error("getAIAnalysis error:", e);
    return null;
  }
}

// Helper: Spara backtest-resultat
async function saveBacktestResult(ticker, backtest) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('backtest_results')
      .insert({
        ticker,
        trades_count: backtest.stats.trades,
        win_rate: backtest.stats.winRate,
        total_return: backtest.stats.totalReturn,
        avg_win: backtest.stats.avgWin,
        avg_loss: backtest.stats.avgLoss,
        expectancy: backtest.stats.expectancy,
        current_position: backtest.currentPosition,
        trades: backtest.trades
      });

    if (error) console.error("Supabase backtest_results error:", error);
  } catch (e) {
    console.error("saveBacktestResult error:", e);
  }
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

function computeScore({ regime, indicators, setup, backtest }) {
  let score = 5;

  score += regime === "UPTREND" ? 2 : -2;
  if (indicators.rsi14 >= 40 && indicators.rsi14 <= 60) score += 1;
  if (indicators.rsi14 < 30 || indicators.rsi14 > 70) score -= 1;
  if (indicators.relativeVolume > 1.5) score += 1;
  if (indicators.relativeVolume < 0.8) score -= 0.5;
  if (setup === "LONG_PULLBACK") score += 0.5;
  if (backtest.stats.winRate > 0.55) score += 0.5;
  if (backtest.stats.totalReturn < 0) score -= 0.5;

  const clamped = Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  let label = "Neutral";
  if (clamped >= 8) label = "Stark edge";
  else if (clamped >= 5.5) label = "OK";
  else label = "Svag edge";

  return { score: clamped, label };
}

// GET /api/market-data?ticker=AAPL
app.get("/api/market-data", async (req, res) => {
  const { ticker = "AAPL" } = req.query;
  try {
    const startDate = "2023-01-01";

    // Försök hämta från Supabase först
    let cachedData = await getMarketData(ticker, startDate);

    // Om data finns i cache och är relativt färsk (från idag), använd den
    const today = new Date().toISOString().split('T')[0];
    if (cachedData && cachedData.length > 0) {
      const latestDate = cachedData[cachedData.length - 1].date;
      if (latestDate === today) {
        console.log(`Using cached market data for ${ticker}`);
        return res.status(200).json(cachedData);
      }
    }

    // Annars hämta från Yahoo Finance
    console.log(`Fetching fresh market data for ${ticker} from Yahoo Finance`);
    const data = await yahooFinance.historical(ticker, {
      period1: startDate,
      interval: "1d"
    });

    // Spara till Supabase för framtida användning
    await saveMarketData(ticker, data);

    res.status(200).json(data);
  } catch (e) {
    console.error("Market data error:", e);
    res.status(500).json({ error: "Failed to fetch market data" });
  }
});

// POST /api/analyze
app.post("/api/analyze", async (req, res) => {
  try {
    const { ticker, candles: providedCandles } = req.body;

    // If ticker is provided, fetch candles from Yahoo Finance
    let candles = providedCandles;
    if (ticker && !providedCandles) {
      const startDate = dayjs().subtract(1, 'year').format('YYYY-MM-DD');
      const today = dayjs().format('YYYY-MM-DD');

      // Try to get cached market data first
      let cachedData = await getMarketData(ticker, startDate);
      const needsFetch = !cachedData || cachedData.length === 0 ||
                        !cachedData.some(c => c.date === today);

      if (needsFetch) {
        console.log(`Fetching fresh data for ${ticker} from Yahoo Finance...`);
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
          volume: q.volume,
          adjClose: q.adjclose || q.close
        }));

        // Save to cache
        await saveMarketData(ticker, candles);
      } else {
        console.log(`Using cached data for ${ticker}`);
        candles = cachedData;
      }
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
      console.error("Missing indicator values");
      return res.status(500).json({ error: "Failed to calculate indicators" });
    }

    if (lastEma20 > lastEma50 && lastClose > lastEma20) {
      regime = "Bullish Trend";
    } else if (lastEma20 < lastEma50 && lastClose < lastEma20) {
      regime = "Bearish Trend";
    }

    let setup = "Hold";
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

    const indicators = {
      ema20: lastEma20,
      ema50: lastEma50,
      rsi14: rsi14[rsi14.length - 1],
      atr14: atr14[atr14.length - 1],
      relativeVolume,
      regime,
      setup
    };

    // Calculate edge score (0-10 scale)
    let edgeScore = 5;
    if (regime === "Bullish Trend") edgeScore += 2;
    else if (regime === "Bearish Trend") edgeScore -= 2;
    if (indicators.rsi14 >= 40 && indicators.rsi14 <= 60) edgeScore += 1;
    if (indicators.rsi14 < 30 || indicators.rsi14 > 70) edgeScore -= 1;
    if (relativeVolume > 1.5) edgeScore += 1;
    if (relativeVolume < 0.8) edgeScore -= 0.5;
    if (setup !== "Hold") edgeScore += 0.5;

    const finalEdgeScore = Math.max(0, Math.min(10, Math.round(edgeScore * 10) / 10));

    const scoring = {
      score: finalEdgeScore,
      label: finalEdgeScore >= 7 ? "Strong Edge" : finalEdgeScore >= 5 ? "OK" : "Weak Edge"
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
    const lastATR = atr14[atr14.length - 1];
    let trade = null;

    if (setup !== "Hold" && lastATR) {
      const entry = lastClose;
      const atrMultiplier = 1.5; // Stop distance
      const rrRatio = 2.0; // Risk/Reward ratio

      // For long setups
      if (regime === "Bullish Trend" || setup.includes("Pullback") || setup.includes("Breakout")) {
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
      // For short setups
      else if (regime === "Bearish Trend") {
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
    }

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
      backtest: backtestResult
    });
  } catch (error) {
    console.error("Error in /api/analyze:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai-analysis
app.post("/api/ai-analysis", async (req, res) => {
  const data = req.body;

  try {
    // Extrahera ticker från data
    const ticker = data.ticker || "UNKNOWN";

    // Försök hämta AI-analys från cache (max 1 per dag)
    const cachedAnalysis = await getAIAnalysis(ticker);
    if (cachedAnalysis) {
      console.log(`Using cached AI analysis for ${ticker}`);
      return res.json({ analysis: cachedAnalysis.analysis_text });
    }

    // Om ingen cache finns, anropa OpenAI
    console.log(`Fetching fresh AI analysis for ${ticker}`);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Du är en erfaren svensk swing trader som analyserar veckotrading-möjligheter.

KRITISKT VIKTIGT:
- Svara ENDAST på svenska
- ALLA rubriker ska börja med ##
- ALDRIG på engelska
- Använd exakt denna struktur:

Ge ditt svar i exakt följande format:

## MARKNADSLÄGE
[2-3 meningar om trenden, nuvarande prisnivå och om aktien är i en uppåt-, nedåt- eller sidledes trend]

## TEKNISKA SIGNALER
• **RSI:** [Nuvarande RSI-värde och vad det betyder - överköpt/översålt/neutralt]
• **EMAs:** [Relation mellan pris, EMA20 och EMA50 - är det bullish/bearish crossover?]
• **Volym:** [Jämför senaste volymen med genomsnittet - stigande/fallande aktivitet]
• **Volatilitet (ATR):** [Kommentera nuvarande volatilitet och vad det betyder för risk]

## STRATEGI & RESONEMANG
[Förklara VILKEN strategi som passar bäst för nuvarande setup och VARFÖR. Diskutera om det är läge för pullback, breakout, reversal, trendföljning etc. Motivera med de tekniska signalerna.]

## HANDELSBESLUT
**Rekommendation:** [KÖP / INVÄNTA / UNDVIK]
**Motivering:** [1-2 meningar om varför detta beslut]
**Entry-nivå:** [Konkret prisnivå för entry om setup finns]

## RISK & POSITIONSSTORLEK
**Stop Loss:** [Konkret stop loss-nivå baserat på ATR eller support/resistance]
**Target:** [Konkret målpris baserat på risk/reward ratio]
**Risk/Reward:** [Förhållande, t.ex. 1:2 eller 1:3]
**Position Size:** [Förslag baserat på ATR och risk - t.ex. "Med 2% kontorisk motsvarar detta X aktier"]

## BACKTEST-INSIKTER
[2-3 meningar om vad backtestet visar - vinstprocent, genomsnittlig vinst/förlust, antal signaler]

## SAMMANFATTNING
[1-2 meningar med tydlig konklusion - finns setup eller inte, vad är nästa steg]`
        },
        { role: "user", content: JSON.stringify(data) }
      ]
    });

    const analysisText = completion.choices[0].message.content;

    // Spara AI-analysen till Supabase
    await saveAIAnalysis(ticker, analysisText, data.scoring, data.backtest);

    res.json({ analysis: analysisText });
  } catch (e) {
    console.error("AI analysis error:", e);
    res.status(500).json({ error: "Failed to get AI analysis" });
  }
});

// ==================== SCREENER ====================
const UNIVERSE_SE = [
  "VOLV-B.ST", "ATCO-A.ST", "ATCO-B.ST", "SAND.ST", "ABB.ST",
  "INVE-A.ST", "INVE-B.ST", "ASSA-B.ST", "SKF-B.ST",
  "SEB-A.ST", "SWED-A.ST", "SHB-A.ST", "ERIC-B.ST"
];

let screenerCache = null;
let screenerCacheDate = null;

// Volume filter: turnover (close * volume), relative volume, stability
function passesVolumeFilter(candles) {
  if (!candles || candles.length < 20) return false;

  const last = candles.at(-1);
  const turnoverSEK = last.close * last.volume;

  // Turnover > 30M SEK
  if (turnoverSEK < 30_000_000) return false;

  // Relative volume
  const volumes = candles.slice(-20).map(c => c.volume);
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const relVol = last.volume / avgVol;

  // Stability (standard deviation / mean)
  const mean = avgVol;
  const variance = volumes.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / volumes.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean; // coefficient of variation

  // Skip if too unstable (cv > 1.0 means volume varies wildly)
  if (cv > 1.0) return false;

  return true;
}

// Compute features for ranking
function computeFeatures(candles) {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  const ema20 = EMA.calculate({ period: 20, values: closes }).at(-1);
  const ema50 = EMA.calculate({ period: 50, values: closes }).at(-1);
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

  return { ema20, ema50, rsi14, atr14, close, relVol, regime, slope };
}

// Ranking: 0-100 score
function computeRanking(features, candles) {
  let score = 0;

  // 1. Liquidity (30 pts)
  const last = candles.at(-1);
  const turnoverM = (last.close * last.volume) / 1_000_000;
  if (turnoverM > 200) score += 30;
  else if (turnoverM > 100) score += 20;
  else if (turnoverM > 30) score += 10;

  // 2. Trend (30 pts)
  if (features.regime === "UPTREND") {
    score += 15;
    if (features.slope > 0.05) score += 10; // strong uptrend
    else if (features.slope > 0) score += 5;
  } else {
    if (features.slope < -0.05) score -= 5; // penalize strong downtrend
  }

  // 3. Volatility (20 pts) - prefer moderate ATR/price
  const atrPct = features.atr14 / features.close;
  if (atrPct >= 0.02 && atrPct <= 0.05) score += 20; // sweet spot
  else if (atrPct > 0.05) score += 10; // high volatility ok
  else score += 5; // low volatility less interesting

  // 4. Momentum (20 pts)
  if (features.rsi14 >= 40 && features.rsi14 <= 60) score += 15; // neutral/bullish
  else if (features.rsi14 > 60 && features.rsi14 <= 70) score += 10; // strong but not overbought
  else if (features.rsi14 < 30) score += 5; // oversold = potential

  if (features.relVol > 1.3) score += 5; // above-average volume

  return Math.max(0, Math.min(100, score));
}

// GET /api/screener
app.get("/api/screener", async (req, res) => {
  try {
    const today = dayjs().format("YYYY-MM-DD");

    // Check cache
    if (screenerCache && screenerCacheDate === today) {
      console.log("Using cached screener data");
      return res.json({ stocks: screenerCache });
    }

    console.log("Running fresh screener...");

    // Get dynamic stock list from database, fallback to hardcoded list
    let stockList = UNIVERSE_SE;

    if (screenerRepo.hasDatabase()) {
      try {
        const dbStocks = await screenerRepo.findAllActive();
        if (dbStocks && dbStocks.length > 0) {
          stockList = dbStocks.map(s => s.ticker);
          console.log(`Using ${stockList.length} stocks from database`);
        } else {
          console.log(`Using ${UNIVERSE_SE.length} stocks from hardcoded list (fallback)`);
        }
      } catch (dbError) {
        console.warn("Failed to fetch stocks from database, using fallback:", dbError.message);
      }
    }

    const results = await Promise.all(
      stockList.map(async (ticker) => {
        try {
          const startDate = dayjs().subtract(1, 'year').format('YYYY-MM-DD');

          // Try to get cached market data first
          let cachedData = await getMarketData(ticker, startDate);
          const needsFetch = !cachedData || cachedData.length === 0 ||
                            !cachedData.some(c => c.date === today);

          let candles;
          if (needsFetch) {
            console.log(`Fetching fresh data for ${ticker} from Yahoo Finance...`);
            const data = await yahooFinance.historical(ticker, {
              period1: startDate,
              interval: "1d"
            });

            if (!data || data.length < 50) return null;

            candles = data.map(d => ({
              date: dayjs(d.date).format('YYYY-MM-DD'),
              open: d.open,
              high: d.high,
              low: d.low,
              close: d.close,
              volume: d.volume
            }));

            await saveMarketData(ticker, candles);
          } else {
            candles = cachedData;
          }

          if (candles.length < 50) return null;

          const closes = candles.map(c => c.close);
          const highs = candles.map(c => c.high);
          const lows = candles.map(c => c.low);
          const volumes = candles.map(c => c.volume);

          const ema20Result = EMA.calculate({ period: 20, values: closes });
          const ema50Result = EMA.calculate({ period: 50, values: closes });
          const rsi14Result = RSI.calculate({ period: 14, values: closes });
          const atr14Result = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });

          const lastEma20 = ema20Result[ema20Result.length - 1];
          const lastEma50 = ema50Result[ema50Result.length - 1];
          const lastRsi = rsi14Result[rsi14Result.length - 1];
          const lastAtr = atr14Result[atr14Result.length - 1];
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

          // Calculate edge score (0-10 scale)
          let edgeScore = 5;
          if (regime === "Bullish Trend") edgeScore += 2;
          else if (regime === "Bearish Trend") edgeScore -= 2;
          if (lastRsi >= 40 && lastRsi <= 60) edgeScore += 1;
          if (lastRsi < 30 || lastRsi > 70) edgeScore -= 1;
          if (relativeVolume > 1.5) edgeScore += 1;
          if (relativeVolume < 0.8) edgeScore -= 0.5;
          if (setup !== "Hold") edgeScore += 0.5;

          const finalEdgeScore = Math.max(0, Math.min(10, Math.round(edgeScore * 10) / 10));

          // Calculate turnover in MSEK
          const lastVolume = candles.at(-1).volume;
          const turnoverMSEK = (lastClose * lastVolume) / 1_000_000;

          return {
            ticker,
            price: lastClose,
            volume: lastVolume,
            turnoverMSEK: parseFloat(turnoverMSEK.toFixed(1)),
            ema20: lastEma20,
            ema50: lastEma50,
            rsi: lastRsi,
            atr: lastAtr,
            relativeVolume,
            regime,
            setup,
            edgeScore: finalEdgeScore
          };
        } catch (e) {
          console.warn(`Skipping ${ticker}:`, e.message);
          return null;
        }
      })
    );

    // Filter out nulls and sort by edge score
    const filtered = results.filter(r => r !== null);
    filtered.sort((a, b) => b.edgeScore - a.edgeScore);

    // Cache results
    screenerCache = filtered;
    screenerCacheDate = today;

    res.json({ stocks: filtered });
  } catch (e) {
    console.error("Screener error:", e);
    res.status(500).json({ error: "Failed to run screener" });
  }
});

// ==================== SCREENER STOCKS MANAGEMENT ====================

// GET /api/screener/stocks - Hämta alla screener aktier
app.get("/api/screener/stocks", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { data, error } = await supabase
      .from('screener_stocks')
      .select('*')
      .order('added_at', { ascending: false });

    if (error) throw error;
    res.json({ stocks: data || [] });
  } catch (e) {
    console.error("Get screener stocks error:", e);
    res.status(500).json({ error: "Failed to fetch screener stocks" });
  }
});

// POST /api/screener/stocks - Lägg till ny aktie i screener
app.post("/api/screener/stocks", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { ticker, name } = req.body;

    if (!ticker) {
      return res.status(400).json({ error: "Ticker is required" });
    }

    const normalizedTicker = ticker.toUpperCase().trim();

    // Validate stock exists and has sufficient volume
    try {
      console.log(`Validating ${normalizedTicker}...`);
      const data = await yahooFinance.historical(normalizedTicker, {
        period1: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
        interval: "1d"
      });

      if (!data || data.length < 20) {
        return res.status(400).json({
          error: "Aktien hittades inte eller har otillräcklig historik på Yahoo Finance"
        });
      }

      // Check volume filter
      if (!passesVolumeFilter(data)) {
        const last = data.at(-1);
        const turnoverM = (last.close * last.volume) / 1_000_000;
        return res.status(400).json({
          error: `Aktien uppfyller inte volymkraven. Nuvarande omsättning: ${turnoverM.toFixed(1)}M (krav: >30M)`
        });
      }

      console.log(`✓ ${normalizedTicker} validated successfully`);
    } catch (validationError) {
      console.error(`Validation failed for ${normalizedTicker}:`, validationError);
      return res.status(400).json({
        error: `Kunde inte validera ${normalizedTicker} på Yahoo Finance. Kontrollera att ticker-symbolen är korrekt.`
      });
    }

    // Add to database
    const { data, error } = await supabase
      .from('screener_stocks')
      .insert([{ ticker: normalizedTicker, name: name || null }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: "Aktien finns redan i screener" });
      }
      throw error;
    }

    // Clear screener cache to force refresh
    screenerCache = null;
    screenerCacheDate = null;

    res.status(201).json(data);
  } catch (e) {
    console.error("Add screener stock error:", e);
    res.status(500).json({ error: "Failed to add stock to screener" });
  }
});

// PATCH /api/screener/stocks/:ticker - Toggle active status
app.patch("/api/screener/stocks/:ticker", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { ticker } = req.params;
    const { is_active } = req.body;

    const { data, error } = await supabase
      .from('screener_stocks')
      .update({ is_active })
      .eq('ticker', ticker)
      .select()
      .single();

    if (error) throw error;

    // Clear screener cache to force refresh
    screenerCache = null;
    screenerCacheDate = null;

    res.json(data);
  } catch (e) {
    console.error("Toggle screener stock error:", e);
    res.status(500).json({ error: "Failed to update stock" });
  }
});

// DELETE /api/screener/stocks/:ticker - Ta bort aktie från screener
app.delete("/api/screener/stocks/:ticker", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { ticker } = req.params;

    const { error } = await supabase
      .from('screener_stocks')
      .delete()
      .eq('ticker', ticker);

    if (error) throw error;

    // Clear screener cache to force refresh
    screenerCache = null;
    screenerCacheDate = null;

    res.status(204).send();
  } catch (e) {
    console.error("Delete screener stock error:", e);
    res.status(500).json({ error: "Failed to delete stock" });
  }
});

// ==================== TRADE JOURNAL ====================

// GET /api/trades - Hämta alla trades (eller filter på ticker)
app.get("/api/trades", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { ticker } = req.query;

    let query = supabase
      .from('trades')
      .select('*')
      .order('date', { ascending: false });

    // Filter by ticker if provided
    if (ticker) {
      query = query.eq('ticker', ticker);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ trades: data || [] });
  } catch (e) {
    console.error("Get trades error:", e);
    res.status(500).json({ error: "Failed to fetch trades" });
  }
});

// POST /api/trades - Skapa ny trade
app.post("/api/trades", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const trade = req.body;

    const { data, error } = await supabase
      .from('trades')
      .insert([trade])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    console.error("Create trade error:", e);
    res.status(500).json({ error: "Failed to create trade" });
  }
});

// PUT /api/trades/:id - Uppdatera trade
app.put("/api/trades/:id", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
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
    res.json(data);
  } catch (e) {
    console.error("Update trade error:", e);
    res.status(500).json({ error: "Failed to update trade" });
  }
});

// DELETE /api/trades/:id - Ta bort trade
app.delete("/api/trades/:id", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
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

// ==================== WATCHLIST ====================

// GET /api/watchlist - Hämta bevakningslistan
app.get("/api/watchlist", async (req, res) => {
  if (!watchlistRepo.hasDatabase()) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const stocks = await watchlistRepo.findAll();

    // Enrich with current price and turnover
    const enrichedStocks = await Promise.all(
      stocks.map(async (stock) => {
        try {
          const today = dayjs().format('YYYY-MM-DD');
          const startDate = dayjs().subtract(5, 'days').format('YYYY-MM-DD');

          // Get latest market data
          const data = await yahooFinance.historical(stock.ticker, {
            period1: startDate,
            interval: "1d"
          });

          if (data && data.length > 0) {
            const latest = data[data.length - 1];
            const turnoverMSEK = (latest.close * latest.volume) / 1_000_000;

            return {
              ...stock,
              current_price: latest.close,
              turnoverMSEK: parseFloat(turnoverMSEK.toFixed(1))
            };
          }

          return stock;
        } catch (e) {
          console.warn(`Failed to enrich ${stock.ticker}:`, e.message);
          return stock;
        }
      })
    );

    res.json({ stocks: enrichedStocks });
  } catch (e) {
    console.error("Get watchlist error:", e);
    res.status(500).json({ error: "Failed to fetch watchlist" });
  }
});

// POST /api/watchlist - Lägg till i bevakningslistan
app.post("/api/watchlist", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { ticker, indicators } = req.body;

    if (!ticker) {
      return res.status(400).json({ error: "Ticker is required" });
    }

    // Bygg initial snapshot
    const today = dayjs().format('YYYY-MM-DD');
    const insertData = {
      ticker,
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
        // Bygg input för watchlist-logik
        const input = {
          ticker,
          price: {
            close: indicators.price || 0,
            high: indicators.price || 0,
            low: indicators.price || 0
          },
          indicators: {
            ema20: indicators.ema20,
            ema50: indicators.ema50,
            ema50_slope: 0.001, // Approximation - kan förbättras senare
            rsi14: indicators.rsi14
          },
          volume: {
            relVol: indicators.relativeVolume || 1
          },
          structure: {
            higherLow: true // Default optimistisk
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
      .insert(insertData)
      .select();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: "Already in watchlist" });
      }
      throw error;
    }

    res.status(201).json(data[0]);
  } catch (e) {
    console.error("Add to watchlist error:", e);
    res.status(500).json({ error: "Failed to add to watchlist" });
  }
});

// DELETE /api/watchlist/:ticker - Ta bort från bevakningslistan
app.delete("/api/watchlist/:ticker", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { ticker } = req.params;

    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('ticker', ticker);

    if (error) throw error;
    res.status(204).send();
  } catch (e) {
    console.error("Delete from watchlist error:", e);
    res.status(500).json({ error: "Failed to delete from watchlist" });
  }
});

// POST /api/watchlist/update - Uppdatera alla watchlist-statusar (daglig batch)
app.post("/api/watchlist/update", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const today = dayjs().format('YYYY-MM-DD');

    // Hämta alla aktier i watchlist
    const { data: watchlistStocks, error: fetchError } = await supabase
      .from('watchlist')
      .select('*');

    if (fetchError) throw fetchError;

    if (!watchlistStocks || watchlistStocks.length === 0) {
      return res.json({ message: "No stocks in watchlist", updated: 0 });
    }

    const updates = [];

    // Uppdatera varje aktie
    for (const stock of watchlistStocks) {
      try {
        const ticker = stock.ticker;

        // Hämta fresh market data
        const startDate = dayjs().subtract(1, 'year').format('YYYY-MM-DD');
        let cachedData = await getMarketData(ticker, startDate);
        const needsFetch = !cachedData || cachedData.length === 0 ||
                          !cachedData.some(c => c.date === today);

        let candles;
        if (needsFetch) {
          console.log(`[Watchlist Update] Fetching fresh data for ${ticker}`);
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

        if (candles.length < 50) {
          console.warn(`[Watchlist Update] Skipping ${ticker} - insufficient data`);
          continue;
        }

        // Beräkna indikatorer
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

        // Bygg input för watchlist-logik
        const input = buildWatchlistInput(
          ticker,
          candles,
          { ema20, ema50, rsi14, relativeVolume },
          stock.current_status,
          stock.added_at
        );

        // Kör watchlist-logik
        const result = updateWatchlistStatus(input);

        // Uppdatera i databasen
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

        if (updateError) {
          console.error(`[Watchlist Update] Error updating ${ticker}:`, updateError);
        } else {
          console.log(`[Watchlist Update] ✓ ${ticker} → ${result.status}`);
          updates.push({
            ticker,
            status: result.status,
            action: result.action,
            reason: result.reason
          });
        }

      } catch (stockError) {
        console.error(`[Watchlist Update] Error processing ${stock.ticker}:`, stockError);
      }
    }

    res.json({
      message: "Watchlist updated successfully",
      updated: updates.length,
      total: watchlistStocks.length,
      results: updates
    });

  } catch (e) {
    console.error("Watchlist update error:", e);
    res.status(500).json({ error: "Failed to update watchlist" });
  }
});

// ==================== PORTFOLIO ====================

// GET /api/portfolio - Hämta förvaltningslistan
app.get("/api/portfolio", async (req, res) => {
  if (!portfolioRepo.hasDatabase()) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { ticker } = req.query;

    let stocks;
    if (ticker) {
      const stock = await portfolioRepo.findByTicker(ticker);
      stocks = stock ? [stock] : [];
    } else {
      stocks = await portfolioRepo.findAllActive();
    }

    res.json({ stocks });
  } catch (e) {
    console.error("Get portfolio error:", e);
    res.status(500).json({ error: "Failed to fetch portfolio" });
  }
});

// POST /api/portfolio - Lägg till i förvaltningslistan
app.post("/api/portfolio", async (req, res) => {
  if (!portfolioRepo.hasDatabase()) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { ticker, entry_price, quantity } = req.body;

    // Check if already exists
    const exists = await portfolioRepo.exists(ticker);
    if (exists) {
      return res.status(409).json({ error: "Already in portfolio" });
    }

    const data = await portfolioRepo.create({ ticker, entry_price, quantity });
    res.status(201).json(data);
  } catch (e) {
    console.error("Add to portfolio error:", e);
    if (e.code === '23505') {
      return res.status(409).json({ error: "Already in portfolio" });
    }
    res.status(500).json({ error: "Failed to add to portfolio" });
  }
});

// DELETE /api/portfolio/:ticker - Ta bort från förvaltningslistan
app.delete("/api/portfolio/:ticker", async (req, res) => {
  if (!portfolioRepo.hasDatabase()) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { ticker } = req.params;
    await portfolioRepo.remove(ticker);
    res.status(204).send();
  } catch (e) {
    console.error("Delete from portfolio error:", e);
    res.status(500).json({ error: "Failed to delete from portfolio" });
  }
});

// POST /api/portfolio/update - Daglig uppdatering av förvaltningslistan
app.post("/api/portfolio/update", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    console.log('[Portfolio Update] Starting daily portfolio update...');

    // Hämta alla positioner
    const { data: positions, error: fetchError } = await supabase
      .from('portfolio')
      .select('*');

    if (fetchError) throw fetchError;

    if (!positions || positions.length === 0) {
      return res.json({ message: "No positions to update", updated: 0 });
    }

    const { updatePositionStatus, buildPositionInput } = await import('./lib/portfolioLogic.js');
    let updated = 0;

    for (const position of positions) {
      try {
        console.log(`[Portfolio Update] Updating ${position.ticker}...`);

        // Hämta färsk data från Yahoo Finance
        const historical = await yahooFinance.historical(position.ticker, {
          period1: dayjs().subtract(6, 'month').format('YYYY-MM-DD'),
          period2: dayjs().format('YYYY-MM-DD'),
          interval: '1d'
        });

        if (!historical || historical.length === 0) {
          console.error(`[Portfolio Update] No data for ${position.ticker}`);
          continue;
        }

        const candles = historical.map(d => ({
          date: dayjs(d.date).format('YYYY-MM-DD'),
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume
        }));

        // Beräkna indikatorer
        const closes = candles.map(c => c.close);
        const ema20Result = EMA.calculate({ period: 20, values: closes });
        const ema50Result = EMA.calculate({ period: 50, values: closes });
        const rsi14Result = RSI.calculate({ period: 14, values: closes });

        const ema20 = ema20Result.map(v => parseFloat(v.toFixed(2)));
        const ema50 = ema50Result.map(v => parseFloat(v.toFixed(2)));
        const rsi14 = rsi14Result.map(v => parseFloat(v.toFixed(2)));

        // Beräkna relativ volym
        const lastCandle = candles[candles.length - 1];
        const avgVolume = candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
        const relativeVolume = avgVolume > 0 ? lastCandle.volume / avgVolume : 1.0;

        const indicators = {
          ema20,
          ema50,
          rsi14,
          relativeVolume
        };

        // Bygg input för portfolioLogic
        const input = buildPositionInput(position.ticker, position, candles, indicators);

        // Beräkna ny status
        const result = updatePositionStatus(input);

        // Beräkna PnL amount
        const pnlAmount = position.quantity
          ? (lastCandle.close - position.entry_price) * position.quantity
          : 0;

        // Uppdatera i databasen
        const { error: updateError } = await supabase
          .from('portfolio')
          .update({
            current_price: lastCandle.close,
            current_stop: result.currentStop,
            current_ema20: ema20[ema20.length - 1],
            current_ema50: ema50[ema50.length - 1],
            current_rsi14: rsi14[rsi14.length - 1],
            current_volume_rel: parseFloat(relativeVolume.toFixed(2)),
            pnl_pct: result.pnlPct,
            pnl_amount: parseFloat(pnlAmount.toFixed(2)),
            r_multiple: result.rMultiple,
            days_in_trade: result.daysInTrade,
            current_status: result.status,
            exit_signal: result.signal,
            last_updated: dayjs().format('YYYY-MM-DD')
          })
          .eq('ticker', position.ticker);

        if (updateError) {
          console.error(`[Portfolio Update] Error updating ${position.ticker}:`, updateError);
          continue;
        }

        console.log(`[Portfolio Update] ✓ ${position.ticker} → ${result.status}`);
        updated++;
      } catch (e) {
        console.error(`[Portfolio Update] Error processing ${position.ticker}:`, e);
      }
    }

    res.json({
      message: `Portfolio updated successfully`,
      updated,
      total: positions.length
    });
  } catch (e) {
    console.error("[Portfolio Update] Error:", e);
    res.status(500).json({ error: "Failed to update portfolio" });
  }
});

// GET /api/portfolio/events - Hämta händelselogg för en position
app.get("/api/portfolio/events", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { ticker } = req.query;

    if (!ticker) {
      return res.status(400).json({ error: "ticker required" });
    }

    // Check if portfolio_events table exists, if not return empty array
    const { data, error } = await supabase
      .from('portfolio_events')
      .select('*')
      .eq('ticker', ticker)
      .order('created_at', { ascending: false });

    if (error) {
      // If table doesn't exist yet, return empty array
      if (error.code === '42P01') {
        return res.json({ events: [] });
      }
      throw error;
    }

    res.json({ events: data || [] });
  } catch (e) {
    console.error("Get portfolio events error:", e);
    res.status(500).json({ error: "Failed to get events" });
  }
});

// POST /api/portfolio/exit/:ticker - Exit en position
app.post("/api/portfolio/exit/:ticker", async (req, res) => {
  if (!portfolioRepo.hasDatabase()) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { ticker } = req.params;
    const exitData = req.body;

    // Use position service to handle exit logic
    const result = await positionService.exitPosition(ticker, exitData);

    res.json({
      message: "Position exited successfully",
      position: result,
      metrics: result.exit_metrics
    });
  } catch (e) {
    console.error("Exit position error:", e);
    res.status(500).json({ error: "Failed to exit position" });
  }
});

// POST /api/portfolio/notes/:ticker - Lägg till notering
app.post("/api/portfolio/notes/:ticker", async (req, res) => {
  if (!portfolioRepo.hasDatabase()) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { ticker } = req.params;
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({ error: "note required" });
    }

    const updatedPosition = await positionService.addNotes(ticker, note);
    res.json({ message: "Note added successfully", position: updatedPosition });
  } catch (e) {
    console.error("Add note error:", e);
    res.status(500).json({ error: e.message || "Failed to add note" });
  }
});

// POST /api/portfolio/move-stop/:ticker - Flytta stop
app.post("/api/portfolio/move-stop/:ticker", async (req, res) => {
  if (!portfolioRepo.hasDatabase()) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { ticker } = req.params;
    const { new_stop, reason } = req.body;

    if (!new_stop) {
      return res.status(400).json({ error: "new_stop required" });
    }

    const newStopNum = parseFloat(new_stop);
    const updatedPosition = await positionService.moveStop(ticker, newStopNum, reason);

    res.json({ message: "Stop moved successfully", position: updatedPosition });
  } catch (e) {
    console.error("Move stop error:", e);
    res.status(500).json({ error: e.message || "Failed to move stop" });
  }
});

// GET /api/quote/:ticker - Hämta realtidspris från Yahoo Finance
app.get("/api/quote/:ticker", async (req, res) => {
  try {
    const { ticker } = req.params;

    // Hämta quote från Yahoo Finance
    const quote = await yahooFinance.quote(ticker);

    res.json({
      price: quote.regularMarketPrice,
      previousClose: quote.regularMarketPreviousClose,
      timestamp: quote.regularMarketTime,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent
    });
  } catch (e) {
    console.error("Get quote error:", e);
    res.status(500).json({ error: "Failed to fetch quote" });
  }
});

// GET /api/portfolio/closed - Get all closed positions
app.get("/api/portfolio/closed", async (req, res) => {
  if (!portfolioRepo.hasDatabase()) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const data = await portfolioRepo.findAllClosed();
    res.json(data);
  } catch (e) {
    console.error("Get closed positions error:", e);
    res.status(500).json({ error: "Failed to fetch closed positions" });
  }
});

// GET /api/portfolio/:ticker - Get single position details
app.get("/api/portfolio/:ticker", async (req, res) => {
  if (!portfolioRepo.hasDatabase()) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { ticker } = req.params;
    const data = await portfolioRepo.findByTicker(ticker);

    if (!data) {
      return res.status(404).json({ error: "Position not found" });
    }

    res.json(data);
  } catch (e) {
    console.error("Get portfolio position error:", e);
    res.status(500).json({ error: "Failed to fetch position" });
  }
});

// GET /api/portfolio/:ticker/events - Get all events for a position
app.get("/api/portfolio/:ticker/events", async (req, res) => {
  if (!eventsRepo.hasDatabase()) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { ticker } = req.params;
    const data = await eventsRepo.findByTicker(ticker);
    res.json(data);
  } catch (e) {
    console.error("Get portfolio events error:", e);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// POST /api/portfolio/:ticker/evaluation - Save self-evaluation for closed position
app.post("/api/portfolio/:ticker/evaluation", async (req, res) => {
  if (!portfolioRepo.hasDatabase()) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { ticker } = req.params;
    const {
      plan_followed,
      exited_early,
      stopped_out,
      broke_rule,
      could_scale_better,
      edge_tag,
      lesson_learned
    } = req.body;

    const data = await portfolioRepo.updateEvaluation(ticker, {
      plan_followed,
      exited_early,
      stopped_out,
      broke_rule,
      could_scale_better,
      edge_tag,
      lesson_learned,
      last_updated: new Date().toISOString().split('T')[0]
    });

    res.json({ message: "Evaluation saved successfully", data });
  } catch (e) {
    console.error("Save evaluation error:", e);
    res.status(500).json({ error: "Failed to save evaluation" });
  }
});

// POST /api/portfolio/update-field/:ticker - Update editable portfolio fields
app.post("/api/portfolio/update-field/:ticker", async (req, res) => {
  if (!portfolioRepo.hasDatabase()) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { ticker } = req.params;
    const { field, value, event_description } = req.body;

    // Allowed editable fields
    const allowedFields = ['current_stop', 'current_target', 'trailing_type'];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({ error: `Field '${field}' is not editable` });
    }

    if (value === undefined || value === null) {
      return res.status(400).json({ error: "Value required" });
    }

    // Update the field
    await portfolioRepo.update(ticker, {
      [field]: value,
      last_updated: dayjs().format('YYYY-MM-DD')
    });

    // Log event if description provided
    if (event_description) {
      try {
        await eventsRepo.create({
          ticker,
          event_date: dayjs().format('YYYY-MM-DD'),
          event_type: field === 'current_stop' ? 'STOP_MOVED' : 'NOTE',
          description: event_description
        });
      } catch (e) {
        console.log("Event logging skipped (table may not exist yet)");
      }
    }

    res.json({ message: "Field updated successfully" });
  } catch (e) {
    console.error("Update field error:", e);
    res.status(500).json({ error: "Failed to update field" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});
