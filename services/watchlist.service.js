/**
 * Watchlist Service
 *
 * Business logic for watchlist management.
 * Handles adding stocks, updating status, and watchlist logic.
 */

import dayjs from 'dayjs';
import { watchlistRepo } from '../repositories/index.js';
import * as analysisService from './analysis.service.js';

/**
 * Add stock to watchlist with analysis
 * @param {string} ticker - Stock ticker
 * @param {Object} options - Optional parameters
 * @returns {Promise<Object>}
 */
export async function addToWatchlist(ticker, options = {}) {
  // Check if already exists
  const existing = await watchlistRepo.findByTicker(ticker);
  if (existing) {
    throw new Error('Stock already in watchlist');
  }

  // Get current analysis
  const analysis = await analysisService.analyzeStock(ticker);

  const today = dayjs().format('YYYY-MM-DD');

  // Create watchlist entry
  const watchlistData = {
    ticker,
    added_date: today,
    last_updated: today,
    days_in_watchlist: 0,
    initial_price: analysis.price,
    initial_ema20: analysis.indicators.ema20,
    initial_ema50: analysis.indicators.ema50,
    initial_rsi14: analysis.indicators.rsi14,
    initial_regime: analysis.regime,
    initial_setup: analysis.setup,
    current_status: determineWatchlistStatus(analysis.indicators),
    current_action: determineWatchlistAction(analysis.indicators, analysis.regime),
    ...options
  };

  const created = await watchlistRepo.create(watchlistData);

  return {
    ...created,
    analysis
  };
}

/**
 * Update watchlist stock with fresh analysis
 * @param {string} ticker - Stock ticker
 * @returns {Promise<Object>}
 */
export async function updateWatchlistStock(ticker) {
  const existing = await watchlistRepo.findByTicker(ticker);
  if (!existing) {
    throw new Error('Stock not in watchlist');
  }

  // Get fresh analysis
  const analysis = await analysisService.analyzeStock(ticker);

  const today = dayjs().format('YYYY-MM-DD');
  const daysInWatchlist = dayjs(today).diff(dayjs(existing.added_date), 'day');

  // Update with fresh data
  const updates = {
    last_updated: today,
    days_in_watchlist: daysInWatchlist,
    current_price: analysis.price,
    current_ema20: analysis.indicators.ema20,
    current_ema50: analysis.indicators.ema50,
    current_rsi14: analysis.indicators.rsi14,
    current_regime: analysis.regime,
    current_setup: analysis.setup,
    current_status: determineWatchlistStatus(analysis.indicators),
    current_action: determineWatchlistAction(analysis.indicators, analysis.regime),
    dist_ema20_pct: analysis.indicators.distEma20Pct,
    dist_ema50_pct: analysis.indicators.distEma50Pct,
    relative_volume: analysis.indicators.relativeVolume
  };

  const updated = await watchlistRepo.update(ticker, updates);

  return {
    ...updated,
    analysis
  };
}

/**
 * Update all watchlist stocks
 * @returns {Promise<Array>}
 */
export async function updateAllWatchlistStocks() {
  const stocks = await watchlistRepo.findAll();

  const results = [];

  for (const stock of stocks) {
    try {
      const updated = await updateWatchlistStock(stock.ticker);
      results.push({ ticker: stock.ticker, success: true, data: updated });
    } catch (error) {
      console.error(`Failed to update ${stock.ticker}:`, error.message);
      results.push({ ticker: stock.ticker, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Remove stock from watchlist
 * @param {string} ticker - Stock ticker
 * @returns {Promise<void>}
 */
export async function removeFromWatchlist(ticker) {
  await watchlistRepo.remove(ticker);
}

/**
 * Get ready-to-enter stocks
 * @returns {Promise<Array>}
 */
export async function getReadyStocks() {
  return await watchlistRepo.findReady();
}

/**
 * Determine watchlist status based on indicators
 * @param {Object} indicators - Technical indicators
 * @returns {string}
 */
function determineWatchlistStatus(indicators) {
  const { rsi14, distEma20Pct, relativeVolume } = indicators;

  // READY: RSI 40-55, close to EMA20, decent volume
  if (rsi14 >= 40 && rsi14 <= 55 && Math.abs(distEma20Pct) < 2 && relativeVolume > 0.8) {
    return 'READY';
  }

  // WAIT_PULLBACK: Price above EMA20, RSI > 60
  if (distEma20Pct > 2 && rsi14 > 60) {
    return 'WAIT_PULLBACK';
  }

  // TOO_WEAK: RSI < 35, below EMA50
  if (rsi14 < 35 && distEma20Pct < -5) {
    return 'TOO_WEAK';
  }

  // MONITORING: Default state
  return 'MONITORING';
}

/**
 * Determine watchlist action based on indicators and regime
 * @param {Object} indicators - Technical indicators
 * @param {string} regime - Market regime
 * @returns {string}
 */
function determineWatchlistAction(indicators, regime) {
  const { rsi14, distEma20Pct, relativeVolume } = indicators;

  // BUY_SIGNAL: Bullish trend, RSI 45-55, near EMA20
  if (regime === 'Bullish Trend' &&
      rsi14 >= 45 && rsi14 <= 55 &&
      Math.abs(distEma20Pct) < 1.5 &&
      relativeVolume > 1.0) {
    return 'BUY_SIGNAL';
  }

  // WAIT: Good conditions but need confirmation
  if (regime === 'Bullish Trend' && rsi14 > 40 && rsi14 < 65) {
    return 'WAIT';
  }

  // REMOVE: Weak conditions
  if (regime === 'Bearish Trend' || rsi14 < 30) {
    return 'REMOVE';
  }

  // HOLD: Neutral
  return 'HOLD';
}

/**
 * Get watchlist summary statistics
 * @returns {Promise<Object>}
 */
export async function getWatchlistSummary() {
  const stocks = await watchlistRepo.findAll();

  const summary = {
    total: stocks.length,
    byStatus: {},
    byAction: {},
    ready: stocks.filter(s => s.current_status === 'READY').length,
    avgDaysInWatchlist: stocks.length > 0
      ? stocks.reduce((sum, s) => sum + (s.days_in_watchlist || 0), 0) / stocks.length
      : 0
  };

  // Count by status
  stocks.forEach(s => {
    const status = s.current_status || 'UNKNOWN';
    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
  });

  // Count by action
  stocks.forEach(s => {
    const action = s.current_action || 'UNKNOWN';
    summary.byAction[action] = (summary.byAction[action] || 0) + 1;
  });

  return summary;
}
