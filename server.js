import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import yahooFinance from "yahoo-finance2";
import { EMA, RSI, ATR } from "technicalindicators";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";

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

function runBacktest(candles) {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  const ema20Series = alignSeries(EMA.calculate({ period: 20, values: closes }), candles.length);
  const ema50Series = alignSeries(EMA.calculate({ period: 50, values: closes }), candles.length);
  const rsi14Series = alignSeries(RSI.calculate({ period: 14, values: closes }), candles.length);
  const atr14Series = alignSeries(ATR.calculate({ period: 14, high: highs, low: lows, close: closes }), candles.length);

  const trades = [];
  let position = null;

  for (let i = 0; i < candles.length; i++) {
    const ema20 = ema20Series[i];
    const ema50 = ema50Series[i];
    const rsi14 = rsi14Series[i];
    const atr14 = atr14Series[i];
    const candle = candles[i];

    if (!ema20 || !ema50 || !rsi14 || !atr14) continue;

    const uptrend = ema20 > ema50;

    if (!position && uptrend && rsi14 >= 40 && rsi14 <= 55 && candle.close > ema20) {
      position = {
        entryPrice: candle.close,
        entryIndex: i,
        stop: candle.close - atr14 * 1.5,
        date: candle.date
      };
      continue;
    }

    if (position) {
      position.stop = Math.max(position.stop, candle.close - atr14); // trail slightly
      const hitStop = candle.close < position.stop;
      const brokeTrend = candle.close < ema50;
      const overbought = rsi14 > 70;
      const timedExit = i - position.entryIndex >= 10;

      if (hitStop || brokeTrend || overbought || timedExit) {
        const pnlPct = (candle.close - position.entryPrice) / position.entryPrice;
        trades.push({
          entryDate: position.date,
          exitDate: candle.date,
          entry: position.entryPrice,
          exit: candle.close,
          holdingDays: i - position.entryIndex,
          pnlPct
        });
        position = null;
      }
    }
  }

  const wins = trades.filter(t => t.pnlPct > 0);
  const losses = trades.filter(t => t.pnlPct <= 0);
  const equity = trades.reduce((acc, t) => acc * (1 + t.pnlPct), 1);
  const totalReturn = equity - 1;

  // Calculate current position if exists
  let currentPosition = null;
  if (position) {
    const avgWinPct = wins.length ? wins.reduce((a, t) => a + t.pnlPct, 0) / wins.length : 0.1;
    const targetPrice = position.entryPrice * (1 + avgWinPct);

    currentPosition = {
      entry: position.entryPrice,
      stop: position.stop,
      target: targetPrice,
      entryDate: position.date
    };
  }

  return {
    trades,
    currentPosition,
    stats: {
      trades: trades.length,
      winRate: trades.length ? wins.length / trades.length : 0,
      avgWin: wins.length ? wins.reduce((a, t) => a + t.pnlPct, 0) / wins.length : 0,
      avgLoss: losses.length ? losses.reduce((a, t) => a + t.pnlPct, 0) / losses.length : 0,
      totalReturn,
      expectancy: trades.length ? trades.reduce((a, t) => a + t.pnlPct, 0) / trades.length : 0
    }
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
  const candles = req.body;

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  const ema20 = EMA.calculate({ period: 20, values: closes }).at(-1);
  const ema50 = EMA.calculate({ period: 50, values: closes }).at(-1);
  const rsi14 = RSI.calculate({ period: 14, values: closes }).at(-1);
  const atr14 = ATR.calculate({ period: 14, high: highs, low: lows, close: closes }).at(-1);

  const close = closes.at(-1);
  const avgVol20 = volumes.slice(-20).reduce((a,b)=>a+b,0)/20;

  const regime = ema20 > ema50 ? "UPTREND" : "DOWNTREND";
  const pullback = regime === "UPTREND" && close > ema50 && rsi14 >= 40 && rsi14 <= 55;
  const backtest = runBacktest(candles);

  const analysis = {
    regime,
    indicators: {
      ema20, ema50, rsi14, atr14,
      relativeVolume: volumes.at(-1) / avgVol20
    },
    setup: pullback ? "LONG_PULLBACK" : "NONE",
    backtest
  };

  const scoring = computeScore({
    regime,
    indicators: analysis.indicators,
    setup: analysis.setup,
    backtest
  });

  // Spara indikatorer till Supabase
  const ticker = candles[0]?.ticker || "UNKNOWN";
  const latestDate = candles.at(-1)?.date;
  if (ticker && latestDate) {
    await saveIndicators(ticker, latestDate, {
      ...analysis.indicators,
      regime: analysis.regime,
      setup: analysis.setup
    });

    // Spara backtest-resultat
    await saveBacktestResult(ticker, backtest);
  }

  res.json({ ...analysis, scoring });
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

  // Turnover > 50M SEK
  if (turnoverSEK < 50_000_000) return false;

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
  else if (turnoverM > 50) score += 10;

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
      return res.json(screenerCache);
    }

    console.log("Running fresh screener...");
    const results = [];

    // Get dynamic stock list from database, fallback to hardcoded list
    let stockList = UNIVERSE_SE;

    if (supabase) {
      try {
        const { data: dbStocks, error } = await supabase
          .from('screener_stocks')
          .select('ticker')
          .eq('is_active', true);

        if (!error && dbStocks && dbStocks.length > 0) {
          stockList = dbStocks.map(s => s.ticker);
          console.log(`Using ${stockList.length} stocks from database`);
        } else {
          console.log(`Using ${UNIVERSE_SE.length} stocks from hardcoded list (fallback)`);
        }
      } catch (dbError) {
        console.warn("Failed to fetch stocks from database, using fallback:", dbError.message);
      }
    }

    for (const ticker of stockList) {
      try {
        // Fetch market data
        const data = await yahooFinance.historical(ticker, {
          period1: "2023-01-01",
          interval: "1d"
        });

        if (!data || data.length < 50) continue;

        // Volume filter
        if (!passesVolumeFilter(data)) continue;

        // Compute features
        const features = computeFeatures(data);
        const ranking = computeRanking(features, data);

        results.push({
          ticker,
          ranking,
          features: {
            regime: features.regime,
            rsi14: features.rsi14,
            relVol: features.relVol,
            slope: features.slope
          }
        });
      } catch (e) {
        console.warn(`Skipping ${ticker}:`, e.message);
      }
    }

    // Sort by ranking desc
    results.sort((a, b) => b.ranking - a.ranking);

    // Cache results
    screenerCache = results;
    screenerCacheDate = today;

    res.json(results);
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
    res.json(data || []);
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
          error: `Aktien uppfyller inte volymkraven. Nuvarande omsättning: ${turnoverM.toFixed(1)}M (krav: >50M)`
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

// GET /api/trades - Hämta alla trades
app.get("/api/trades", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;
    res.json(data || []);
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

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});
