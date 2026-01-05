import YahooFinanceClass from "yahoo-finance2";
import dayjs from "dayjs";

// Initialize Yahoo Finance v3
const yahooFinance = new YahooFinanceClass({
  queue: { timeout: 60000 },
  suppressNotices: ['yahooSurvey', 'ripHistorical']
});

export default async function handler(req, res) {
  const { ticker = "AAPL" } = req.query;
  try {
    const result = await yahooFinance.chart(ticker, {
      period1: dayjs().subtract(1, 'year').toDate(),
      period2: new Date(),
      interval: "1d"
    });
    const data = result?.quotes || [];
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch market data" });
  }
}
