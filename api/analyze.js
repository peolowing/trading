import { EMA, RSI, ATR } from "technicalindicators";

export default async function handler(req, res) {
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

  res.json({
    regime,
    indicators: {
      ema20, ema50, rsi14, atr14,
      relativeVolume: volumes.at(-1) / avgVol20
    },
    setup: pullback ? "LONG_PULLBACK" : "NONE"
  });
}