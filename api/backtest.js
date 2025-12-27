export default async function handler(req, res) {
  const candles = req.body;

  let trades = 0;
  let wins = 0;

  for (let i = 60; i < candles.length - 10; i++) {
    const entry = candles[i].close;
    const stop = entry * 0.95;
    const target = entry * 1.1;

    for (let j = i + 1; j < i + 10; j++) {
      if (candles[j].low <= stop) break;
      if (candles[j].high >= target) { wins++; break; }
    }
    trades++;
  }

  res.json({ trades, winrate: ((wins / trades) * 100).toFixed(1) });
}