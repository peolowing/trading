import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import yahooFinance from "yahoo-finance2";
import { EMA, RSI, ATR } from "technicalindicators";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import { updateWatchlistStatus, buildWatchlistInput } from "./watchlistLogic.js";

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
  try {
    const { error } = await supabase
      .from('ai_analysis')
      .upsert({
        ticker,
        analysis_date: date,
        analysis_text: analysis
      }, { onConflict: 'ticker,analysis_date' });

    if (error) console.error("Supabase ai_analysis error:", error);
  } catch (e) {
    console.error("saveAIAnalysis error:", e);
  }
}

// Helper: Hämta AI-analys
async function getAIAnalysis(ticker, date) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('ai_analysis')
      .select('*')
      .eq('ticker', ticker)
      .eq('analysis_date', date)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
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
      backtest: backtestResult
    });
  } catch (error) {
    console.error("Error in /api/analyze:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai-analysis", async (req, res) => {
  try {
    const { ticker, candles, indicators } = req.body;

    if (!ticker || !candles || !indicators) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const today = dayjs().format('YYYY-MM-DD');
    let cached = await getAIAnalysis(ticker, today);

    if (cached) {
      console.log(`Using cached AI analysis for ${ticker}`);
      return res.json({ analysis: cached.analysis_text });
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
[2-3 meningar om trenden, nuvarande prisnivå och om aktien är i en uppåt-, nedåt- eller sidledes trend]

## TEKNISKA SIGNALER
• **RSI:** [Nuvarande RSI-värde och vad det betyder - överköpt/översålt/neutralt]
• **EMAs:** [Relation mellan pris, EMA20 och EMA50 - är det bullish/bearish crossover?]
• **Volym:** [Jämför senaste volymen med genomsnittet - stigande/fallande aktivitet]
• **Volatilitet (ATR):** [Kommentera nuvarande volatilitet och vad det betyder för risk]

## STRATEGI & RESONEMANG
[Förklara VILKEN strategi som passar bäst för nuvarande setup och VARFÖR. Jämför resultaten från backtesten för de olika strategierna (Pullback, Breakout, Reversal, Trend Following) och förklara varför den ena är bättre än den andra i nuläget.]

## HANDELSBESLUT
**Rekommendation:** [KÖP / INVÄNTA / UNDVIK]
**Motivering:** [1-2 meningar om varför detta beslut]
**Entry-nivå:** [Konkret prisnivå för entry om setup finns]

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
- EMA20: ${indicators.ema20?.toFixed(2) || 'N/A'}
- EMA50: ${indicators.ema50?.toFixed(2) || 'N/A'}
- RSI(14): ${indicators.rsi14?.toFixed(2) || 'N/A'}
- ATR(14): ${indicators.atr14?.toFixed(2) || 'N/A'}
- Relativ volym: ${indicators.relativeVolume?.toFixed(2) || 'N/A'}
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
    await saveAIAnalysis(ticker, today, analysis);

    res.json({ analysis });
  } catch (error) {
    console.error("Error in /api/ai-analysis:", error);
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
