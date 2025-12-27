import yahooFinance from 'yahoo-finance2';
import { EMA, RSI, ATR } from 'technicalindicators';
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
  
  if (regime === "Bullish Trend" && priceAboveEMA50 && !priceAboveEMA20 && rsi14 < 50) {
    return "Pullback";
  }
  
  if (regime === "Consolidation" && relativeVolume > 1.5 && close > ema20) {
    return "Breakout";
  }
  
  if (regime === "Bearish Trend" && rsi14 < 30 && relativeVolume > 1.3) {
    return "Reversal";
  }
  
  if (regime === "Bullish Trend" && priceAboveEMA20 && ema20AboveEMA50 && rsi14 > 50 && rsi14 < 70) {
    return "Trend Following";
  }
  
  return "Hold";
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
          return res.json({
            candles: dbCached.candles,
            ema20: dbCached.ema20_series,
            ema50: dbCached.ema50_series,
            rsi14: dbCached.rsi14_series,
            atr14: dbCached.atr14_series,
            indicators: dbCached.indicators_data
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
    const startDate = dayjs().subtract(1, 'year').format('YYYY-MM-DD');
    const rawCandles = await yahooFinance.chart(ticker, {
      period1: startDate,
      period2: dayjs().format('YYYY-MM-DD')
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
      indicators
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
