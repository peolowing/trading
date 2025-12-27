import yahooFinance from 'yahoo-finance2';
import { EMA, RSI, ATR } from 'technicalindicators';
import dayjs from 'dayjs';

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

    // Fetch candles from Yahoo Finance
    const startDate = dayjs().subtract(3, 'year').format('YYYY-MM-DD');
    const rawCandles = await yahooFinance.chart(ticker, {
      period1: startDate,
      period2: dayjs().format('YYYY-MM-DD')
    });

    const candles = rawCandles.quotes.map(q => ({
      date: q.date.toISOString(),
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume,
      adjClose: q.adjclose || q.close
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

    res.json({
      candles: candles.map(c => ({
        ...c,
        date: String(c.date).slice(0, 10)
      })),
      ema20,
      ema50,
      rsi14,
      atr14,
      indicators
    });
  } catch (error) {
    console.error("Error in /api/analyze:", error);
    res.status(500).json({ error: error.message });
  }
}
