/**
 * Analysis Service
 *
 * Business logic for technical analysis.
 * Handles indicator calculations, strategy detection, and market regime analysis.
 */

import { EMA, RSI, ATR } from 'technicalindicators';
import yahooFinance from 'yahoo-finance2';
import dayjs from 'dayjs';
import { marketdataRepo } from '../repositories/index.js';

/**
 * Fetch historical data with caching
 * @param {string} ticker - Stock ticker
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @returns {Promise<Array>}
 */
export async function fetchHistoricalData(ticker, startDate) {
  // Try to get cached data first
  let cachedData = await marketdataRepo.findByTickerFromDate(ticker, startDate);

  const today = dayjs().format('YYYY-MM-DD');
  const needsFetch = !cachedData || cachedData.length === 0 ||
                     !cachedData.some(c => c.date === today);

  if (needsFetch) {
    console.log(`Fetching fresh data for ${ticker} from Yahoo Finance...`);

    const data = await yahooFinance.historical(ticker, {
      period1: startDate,
      interval: '1d'
    });

    if (!data || data.length < 50) {
      throw new Error(`Insufficient data for ${ticker}`);
    }

    const candles = data.map(d => ({
      date: dayjs(d.date).format('YYYY-MM-DD'),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume
    }));

    // Save to cache
    await marketdataRepo.saveCandles(ticker, candles);
    return candles;
  }

  return cachedData;
}

/**
 * Calculate technical indicators
 * @param {Array} candles - Historical candle data
 * @returns {Object}
 */
export function calculateIndicators(candles) {
  if (!candles || candles.length < 50) {
    throw new Error('Insufficient data for indicator calculation');
  }

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  // Calculate indicators
  const ema20Result = EMA.calculate({ period: 20, values: closes });
  const ema50Result = EMA.calculate({ period: 50, values: closes });
  const rsi14Result = RSI.calculate({ period: 14, values: closes });
  const atr14Result = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });

  // Get latest values
  const lastClose = closes[closes.length - 1];
  const lastHigh = highs[highs.length - 1];
  const lastLow = lows[lows.length - 1];
  const lastVolume = volumes[volumes.length - 1];

  const lastEma20 = ema20Result[ema20Result.length - 1];
  const lastEma50 = ema50Result[ema50Result.length - 1];
  const lastRsi = rsi14Result[rsi14Result.length - 1];
  const lastAtr = atr14Result[atr14Result.length - 1];

  // Calculate relative volume (vs 20-day average)
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const relativeVolume = avgVolume > 0 ? lastVolume / avgVolume : 1;

  // Calculate distances
  const distEma20Pct = ((lastClose - lastEma20) / lastEma20) * 100;
  const distEma50Pct = ((lastClose - lastEma50) / lastEma50) * 100;

  return {
    price: {
      close: lastClose,
      high: lastHigh,
      low: lastLow
    },
    ema20: parseFloat(lastEma20.toFixed(2)),
    ema50: parseFloat(lastEma50.toFixed(2)),
    rsi14: parseFloat(lastRsi.toFixed(2)),
    atr14: parseFloat(lastAtr.toFixed(2)),
    volume: lastVolume,
    avgVolume,
    relativeVolume: parseFloat(relativeVolume.toFixed(2)),
    distEma20Pct: parseFloat(distEma20Pct.toFixed(2)),
    distEma50Pct: parseFloat(distEma50Pct.toFixed(2)),
    // Return full series for charting
    series: {
      ema20: ema20Result.map(v => parseFloat(v.toFixed(2))),
      ema50: ema50Result.map(v => parseFloat(v.toFixed(2))),
      rsi14: rsi14Result.map(v => parseFloat(v.toFixed(2))),
      atr14: atr14Result.map(v => parseFloat(v.toFixed(2)))
    }
  };
}

/**
 * Detect market regime
 * @param {Object} indicators - Technical indicators
 * @returns {string}
 */
export function detectRegime(indicators) {
  const { price, ema20, ema50 } = indicators;
  const close = price.close;

  const priceAboveEma20 = close > ema20;
  const priceAboveEma50 = close > ema50;
  const ema20AboveEma50 = ema20 > ema50;

  if (ema20AboveEma50 && priceAboveEma20) {
    return 'Bullish Trend';
  } else if (!ema20AboveEma50 && !priceAboveEma20) {
    return 'Bearish Trend';
  } else {
    return 'Consolidation';
  }
}

/**
 * Detect trading strategy/setup
 * @param {Object} indicators - Technical indicators
 * @param {string} regime - Market regime
 * @returns {string}
 */
export function detectStrategy(indicators, regime) {
  const { price, ema20, ema50, rsi14, relativeVolume } = indicators;
  const close = price.close;

  const priceAboveEma20 = close > ema20;
  const priceAboveEma50 = close > ema50;
  const ema20AboveEma50 = ema20 > ema50;

  // Pullback Strategy
  if (regime === 'Bullish Trend' && priceAboveEma50 && !priceAboveEma20 && rsi14 < 50) {
    return 'Pullback';
  }

  // Breakout Strategy
  if (regime === 'Consolidation' && relativeVolume > 1.5 && priceAboveEma20) {
    return 'Breakout';
  }

  // Reversal Strategy
  if (regime === 'Bearish Trend' && rsi14 < 30 && relativeVolume > 1.3) {
    return 'Reversal';
  }

  // Trend Following
  if (regime === 'Bullish Trend' && priceAboveEma20 && ema20AboveEma50 && rsi14 > 50 && rsi14 < 70) {
    return 'Trend Following';
  }

  return 'Hold';
}

/**
 * Calculate edge score (0-10)
 * @param {Object} indicators - Technical indicators
 * @param {string} regime - Market regime
 * @param {string} setup - Trading setup
 * @returns {number}
 */
export function calculateEdgeScore(indicators, regime, setup) {
  const { rsi14, relativeVolume } = indicators;

  let score = 5; // Base score

  // Regime bonus
  if (regime === 'Bullish Trend') score += 2;
  else if (regime === 'Bearish Trend') score -= 2;

  // RSI in sweet spot
  if (rsi14 >= 40 && rsi14 <= 60) score += 1;
  if (rsi14 < 30 || rsi14 > 70) score -= 1;

  // Volume confirmation
  if (relativeVolume > 1.5) score += 1;
  if (relativeVolume < 0.8) score -= 0.5;

  // Setup bonus
  if (setup !== 'Hold') score += 0.5;

  // Clamp to 0-10
  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

/**
 * Perform full analysis on a ticker
 * @param {string} ticker - Stock ticker
 * @param {string} startDate - Start date for historical data
 * @returns {Promise<Object>}
 */
export async function analyzeStock(ticker, startDate = null) {
  const start = startDate || dayjs().subtract(1, 'year').format('YYYY-MM-DD');

  // Fetch data
  const candles = await fetchHistoricalData(ticker, start);

  // Calculate indicators
  const indicators = calculateIndicators(candles);

  // Detect regime and strategy
  const regime = detectRegime(indicators);
  const setup = detectStrategy(indicators, regime);
  const edgeScore = calculateEdgeScore(indicators, regime, setup);

  return {
    ticker,
    date: dayjs().format('YYYY-MM-DD'),
    price: indicators.price.close,
    indicators: {
      ema20: indicators.ema20,
      ema50: indicators.ema50,
      rsi14: indicators.rsi14,
      atr14: indicators.atr14,
      relativeVolume: indicators.relativeVolume,
      distEma20Pct: indicators.distEma20Pct,
      distEma50Pct: indicators.distEma50Pct
    },
    regime,
    setup,
    edgeScore,
    series: indicators.series,
    candles: candles.slice(-100) // Last 100 candles for charting
  };
}

/**
 * Calculate support and resistance levels
 * @param {Array} candles - Historical candles
 * @param {number} lookback - Lookback period (default 50)
 * @returns {Object}
 */
export function calculateSupportResistance(candles, lookback = 50) {
  if (!candles || candles.length < lookback) {
    return { support: null, resistance: null };
  }

  const recentCandles = candles.slice(-lookback);
  const highs = recentCandles.map(c => c.high);
  const lows = recentCandles.map(c => c.low);

  // Simple approach: highest high and lowest low
  const resistance = Math.max(...highs);
  const support = Math.min(...lows);

  return {
    support: parseFloat(support.toFixed(2)),
    resistance: parseFloat(resistance.toFixed(2)),
    range: parseFloat((resistance - support).toFixed(2)),
    rangePct: parseFloat(((resistance - support) / support * 100).toFixed(2))
  };
}

/**
 * Calculate suggested stop and target levels
 * @param {number} entryPrice - Entry price
 * @param {number} atr - ATR value
 * @param {number} riskMultiple - Risk multiple (default 2)
 * @param {number} rewardMultiple - Reward multiple (default 4)
 * @returns {Object}
 */
export function calculateStopTarget(entryPrice, atr, riskMultiple = 2, rewardMultiple = 4) {
  const stop = entryPrice - (atr * riskMultiple);
  const target = entryPrice + (atr * rewardMultiple);
  const initialR = entryPrice - stop;
  const rrRatio = (target - entryPrice) / initialR;

  return {
    suggestedStop: parseFloat(stop.toFixed(2)),
    suggestedTarget: parseFloat(target.toFixed(2)),
    initialR: parseFloat(initialR.toFixed(2)),
    rrRatio: parseFloat(rrRatio.toFixed(2)),
    atrUsed: atr,
    riskMultiple,
    rewardMultiple
  };
}
