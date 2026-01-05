/**
 * Simulation API endpoint
 * Runs historical backtest simulation showing all trades
 */

import YahooFinanceClass from 'yahoo-finance2';
import dayjs from 'dayjs';

// Initialize Yahoo Finance v3
const yahooFinance = new YahooFinanceClass({
  queue: { timeout: 60000 },
  suppressNotices: ['yahooSurvey', 'ripHistorical']
});
import { EMA, RSI } from 'technicalindicators';
import { updateWatchlistStatus, buildWatchlistInput } from './utils/watchlistLogic.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { ticker, startDate, endDate } = req.body;

    if (!ticker || !startDate || !endDate) {
      return res.status(400).json({ error: "ticker, startDate and endDate are required" });
    }

    console.log(`[Simulation] ${ticker} from ${startDate} to ${endDate}`);

    // Fetch historical data (need extra lookback for indicators)
    const lookbackStart = dayjs(startDate).subtract(6, 'month').toDate();

    const rawCandles = await yahooFinance.chart(ticker, {
      period1: lookbackStart,
      period2: dayjs(endDate).toDate(),
      interval: '1d'
    });

    if (!rawCandles || !rawCandles.quotes || rawCandles.quotes.length === 0) {
      return res.status(404).json({ error: `No data found for ${ticker}` });
    }

    const candles = rawCandles.quotes.map(q => ({
      date: q.date.toISOString().split('T')[0],
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume
    }));

    // Calculate indicators for entire period
    const closes = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);

    const ema20All = EMA.calculate({ period: 20, values: closes });
    const ema50All = EMA.calculate({ period: 50, values: closes });
    const rsi14All = RSI.calculate({ period: 14, values: closes });

    // Pad arrays to match candles length
    const ema20Padded = [...Array(closes.length - ema20All.length).fill(null), ...ema20All];
    const ema50Padded = [...Array(closes.length - ema50All.length).fill(null), ...ema50All];
    const rsi14Padded = [...Array(closes.length - rsi14All.length).fill(null), ...rsi14All];

    // Find start index (first candle within simulation period)
    const startIdx = candles.findIndex(c => c.date >= startDate);
    if (startIdx === -1) {
      return res.status(400).json({ error: "Start date is after all available data" });
    }

    // Simulate trading day by day
    const trades = [];
    let currentTrade = null;
    let totalReturn = 1.0; // Multiplicative return (starts at 1.0 = 100%)

    for (let i = startIdx; i < candles.length; i++) {
      const candle = candles[i];
      const date = candle.date;

      // Skip if we don't have enough data for indicators
      if (ema20Padded[i] === null || ema50Padded[i] === null || rsi14Padded[i] === null) {
        continue;
      }

      // Calculate relative volume (20-day average)
      const recentVolumes = volumes.slice(Math.max(0, i - 19), i + 1);
      const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
      const relativeVolume = avgVolume > 0 ? volumes[i] / avgVolume : 1;

      // Get indicators for this day
      const ema20Series = ema20Padded.slice(Math.max(0, i - 5), i + 1).filter(v => v !== null);
      const ema50Series = ema50Padded.slice(Math.max(0, i - 5), i + 1).filter(v => v !== null);

      // Build watchlist input
      const recentCandles = candles.slice(Math.max(0, i - 50), i + 1);
      const input = buildWatchlistInput(
        ticker,
        recentCandles,
        {
          ema20: ema20Padded.slice(Math.max(0, i - 5), i + 1),
          ema50: ema50Padded.slice(Math.max(0, i - 5), i + 1),
          rsi14: rsi14Padded.slice(Math.max(0, i - 5), i + 1),
          relativeVolume
        },
        currentTrade ? 'IN_TRADE' : 'WAITING',
        null, // addedAt
        undefined, // edge_score (not used in simulation)
        null, // lastInvalidatedDate
        undefined, // totalTrades
        undefined  // avgTurnover
      );

      const result = updateWatchlistStatus(input);

      // If we're not in a trade, check for entry signal
      if (!currentTrade) {
        if (result.status === 'READY' || result.status === 'BREAKOUT_READY') {
          // Calculate stop and target using ATR-based method
          const atr = calculateATR(candles.slice(Math.max(0, i - 13), i + 1));
          const stop = candle.close - (2 * atr);
          const target = candle.close + (4 * atr); // 2:1 R:R

          currentTrade = {
            entryDate: date,
            entryPrice: candle.close,
            stop,
            target,
            atr,
            status: result.status,
            daysInTrade: 0
          };

          console.log(`[Entry] ${date}: ${candle.close.toFixed(2)} SEK (${result.status})`);
        }
      }
      // If we're in a trade, check for exit conditions
      else {
        currentTrade.daysInTrade++;

        let exitTriggered = false;
        let exitPrice = null;
        let exitReason = null;

        // Check stop loss
        if (candle.low <= currentTrade.stop) {
          exitTriggered = true;
          exitPrice = currentTrade.stop;
          exitReason = 'STOP_LOSS';
        }
        // Check target
        else if (candle.high >= currentTrade.target) {
          exitTriggered = true;
          exitPrice = currentTrade.target;
          exitReason = 'TARGET_HIT';
        }
        // Check invalidation (trend break)
        else if (result.status === 'INVALIDATED') {
          exitTriggered = true;
          exitPrice = candle.close;
          exitReason = 'INVALIDATED';
        }
        // Check time-based exit (max 20 days)
        else if (currentTrade.daysInTrade >= 20) {
          exitTriggered = true;
          exitPrice = candle.close;
          exitReason = 'TIME_EXIT';
        }

        if (exitTriggered) {
          const returnPct = (exitPrice - currentTrade.entryPrice) / currentTrade.entryPrice;
          const risk = currentTrade.entryPrice - currentTrade.stop;
          const rMultiple = risk > 0 ? (exitPrice - currentTrade.entryPrice) / risk : 0;

          trades.push({
            entryDate: currentTrade.entryDate,
            entryPrice: currentTrade.entryPrice,
            exitDate: date,
            exitPrice,
            stop: currentTrade.stop,
            target: currentTrade.target,
            return: returnPct,
            rMultiple,
            daysInTrade: currentTrade.daysInTrade,
            exitReason
          });

          totalReturn *= (1 + returnPct);

          console.log(`[Exit] ${date}: ${exitPrice.toFixed(2)} SEK (${exitReason}, ${(returnPct * 100).toFixed(2)}%, ${rMultiple.toFixed(2)}R)`);

          currentTrade = null;
        }
      }
    }

    // If there's an open trade at the end, mark it as open
    if (currentTrade) {
      const lastCandle = candles[candles.length - 1];
      const risk = currentTrade.entryPrice - currentTrade.stop;
      const unrealizedReturn = (lastCandle.close - currentTrade.entryPrice) / currentTrade.entryPrice;
      const unrealizedR = risk > 0 ? (lastCandle.close - currentTrade.entryPrice) / risk : 0;

      trades.push({
        entryDate: currentTrade.entryDate,
        entryPrice: currentTrade.entryPrice,
        exitDate: null,
        exitPrice: null,
        stop: currentTrade.stop,
        target: currentTrade.target,
        return: unrealizedReturn,
        rMultiple: unrealizedR,
        daysInTrade: currentTrade.daysInTrade,
        exitReason: 'OPEN'
      });
    }

    // Calculate summary statistics
    const closedTrades = trades.filter(t => t.exitDate !== null);
    const winners = closedTrades.filter(t => t.return > 0);
    const losers = closedTrades.filter(t => t.return <= 0);

    const winRate = closedTrades.length > 0 ? winners.length / closedTrades.length : 0;
    const avgWin = winners.length > 0 ? winners.reduce((sum, t) => sum + t.return, 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((sum, t) => sum + t.return, 0) / losers.length) : 0;
    const avgWinLoss = avgLoss > 0 ? avgWin / avgLoss : 0;
    const edgeScore = winRate * avgWinLoss * 100;

    // Calculate max drawdown
    let peak = 1.0;
    let maxDrawdown = 0;
    let equity = 1.0;

    for (const trade of closedTrades) {
      equity *= (1 + trade.return);
      if (equity > peak) {
        peak = equity;
      }
      const drawdown = (peak - equity) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    const summary = {
      totalTrades: closedTrades.length,
      openTrades: trades.length - closedTrades.length,
      winners: winners.length,
      losers: losers.length,
      winRate,
      avgWin,
      avgLoss,
      avgWinLoss,
      edgeScore,
      totalReturn: totalReturn - 1, // Convert back to percentage gain/loss
      maxDrawdown
    };

    return res.json({
      ticker,
      startDate,
      endDate,
      summary,
      trades
    });

  } catch (error) {
    console.error('Simulation error:', error);
    return res.status(500).json({
      error: 'Failed to run simulation',
      details: error.message
    });
  }
}

/**
 * Calculate Average True Range (ATR)
 */
function calculateATR(candles) {
  if (candles.length < 2) return 0;

  const trueRanges = [];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );

    trueRanges.push(tr);
  }

  return trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
}
