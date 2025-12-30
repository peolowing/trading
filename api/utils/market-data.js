import yahooFinance from "yahoo-finance2";

export default async function handler(req, res) {
  const { ticker = "AAPL" } = req.query;
  try {
    const data = await yahooFinance.historical(ticker, {
      period1: "2024-01-01",
      interval: "1d"
    });
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch market data" });
  }
}