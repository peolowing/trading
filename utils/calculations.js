/**
 * Trading Calculations - Single Source of Truth
 * Pure functions for all trading-related calculations
 * Used by both backend and frontend
 */

// ============================================
// POSITION CALCULATIONS
// ============================================

/**
 * Beräkna initial R (risk per aktie)
 * @param {number} entryPrice - Entry price
 * @param {number} stopPrice - Initial stop price
 * @returns {number} Initial R value
 */
export function calculateInitialR(entryPrice, stopPrice) {
  if (!entryPrice || !stopPrice) return 0;
  return Math.abs(entryPrice - stopPrice);
}

/**
 * Beräkna risk i kronor
 * @param {number} quantity - Number of shares
 * @param {number} initialR - Initial R value
 * @returns {number} Risk in SEK
 */
export function calculateRiskKr(quantity, initialR) {
  if (!quantity || !initialR) return 0;
  return quantity * initialR;
}

/**
 * Beräkna risk i procent av portfölj
 * @param {number} riskKr - Risk in SEK
 * @param {number} portfolioValue - Total portfolio value
 * @returns {number} Risk in percent
 */
export function calculateRiskPercent(riskKr, portfolioValue) {
  if (!riskKr || !portfolioValue || portfolioValue === 0) return 0;
  return (riskKr / portfolioValue) * 100;
}

/**
 * Beräkna R/R ratio (reward/risk)
 * @param {number} entryPrice - Entry price
 * @param {number} targetPrice - Target price
 * @param {number} stopPrice - Stop price
 * @returns {number} R/R ratio
 */
export function calculateRRRatio(entryPrice, targetPrice, stopPrice) {
  if (!entryPrice || !targetPrice || !stopPrice) return 0;

  const risk = Math.abs(entryPrice - stopPrice);
  const reward = Math.abs(targetPrice - entryPrice);

  if (risk === 0) return 0;
  return reward / risk;
}

// ============================================
// EXIT CALCULATIONS
// ============================================

/**
 * Beräkna R-multiple vid exit
 * @param {number} entryPrice - Entry price
 * @param {number} exitPrice - Exit price
 * @param {number} initialR - Initial R value
 * @returns {number} R-multiple
 */
export function calculateRMultiple(entryPrice, exitPrice, initialR) {
  if (!entryPrice || !exitPrice || !initialR || initialR === 0) return 0;
  return (exitPrice - entryPrice) / initialR;
}

/**
 * Beräkna PnL i procent
 * @param {number} entryPrice - Entry price
 * @param {number} exitPrice - Exit price
 * @returns {number} PnL in percent
 */
export function calculatePnlPercent(entryPrice, exitPrice) {
  if (!entryPrice || !exitPrice || entryPrice === 0) return 0;
  return ((exitPrice - entryPrice) / entryPrice) * 100;
}

/**
 * Beräkna PnL i kronor
 * @param {number} quantity - Number of shares
 * @param {number} entryPrice - Entry price
 * @param {number} exitPrice - Exit price
 * @returns {number} PnL in SEK
 */
export function calculatePnlKr(quantity, entryPrice, exitPrice) {
  if (!quantity || !entryPrice || !exitPrice) return 0;
  return quantity * (exitPrice - entryPrice);
}

/**
 * Beräkna dagar i trade
 * @param {string|Date} entryDate - Entry date
 * @param {string|Date} exitDate - Exit date
 * @returns {number|null} Days in trade
 */
export function calculateDaysInTrade(entryDate, exitDate) {
  if (!entryDate || !exitDate) return null;

  const entry = new Date(entryDate);
  const exit = new Date(exitDate);

  if (isNaN(entry.getTime()) || isNaN(exit.getTime())) return null;

  return Math.ceil((exit - entry) / (1000 * 60 * 60 * 24));
}

// ============================================
// PORTFOLIO STATISTICS
// ============================================

/**
 * Beräkna win rate
 * @param {Array} trades - Array of trades with r_multiple
 * @returns {number} Win rate in percent
 */
export function calculateWinRate(trades) {
  if (!trades || trades.length === 0) return 0;

  const winners = trades.filter(t => (t.r_multiple || 0) > 0).length;
  return (winners / trades.length) * 100;
}

/**
 * Beräkna genomsnittlig R
 * @param {Array} trades - Array of trades with r_multiple
 * @returns {number} Average R
 */
export function calculateAverageR(trades) {
  if (!trades || trades.length === 0) return 0;

  const totalR = trades.reduce((sum, t) => sum + (t.r_multiple || 0), 0);
  return totalR / trades.length;
}

/**
 * Beräkna expectancy (förväntad vinst per trade)
 * @param {Array} trades - Array of trades with r_multiple
 * @returns {number} Expectancy in R
 */
export function calculateExpectancy(trades) {
  if (!trades || trades.length === 0) return 0;

  const winners = trades.filter(t => (t.r_multiple || 0) > 0);
  const losers = trades.filter(t => (t.r_multiple || 0) <= 0);

  if (winners.length === 0 || losers.length === 0) {
    return calculateAverageR(trades);
  }

  const winRate = winners.length / trades.length;
  const avgWin = calculateAverageR(winners);
  const avgLoss = Math.abs(calculateAverageR(losers));

  return (winRate * avgWin) - ((1 - winRate) * avgLoss);
}

/**
 * Beräkna profit factor
 * @param {Array} trades - Array of trades with r_multiple
 * @returns {number} Profit factor
 */
export function calculateProfitFactor(trades) {
  if (!trades || trades.length === 0) return 0;

  const grossProfit = trades
    .filter(t => (t.r_multiple || 0) > 0)
    .reduce((sum, t) => sum + t.r_multiple, 0);

  const grossLoss = Math.abs(
    trades
      .filter(t => (t.r_multiple || 0) < 0)
      .reduce((sum, t) => sum + t.r_multiple, 0)
  );

  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
  return grossProfit / grossLoss;
}

/**
 * Beräkna Sharpe Ratio (förenklad för trading)
 * @param {Array} trades - Array of trades with r_multiple
 * @returns {number} Sharpe ratio
 */
export function calculateSharpeRatio(trades) {
  if (!trades || trades.length < 2) return 0;

  const avgR = calculateAverageR(trades);
  const rValues = trades.map(t => t.r_multiple || 0);

  // Calculate standard deviation
  const variance = rValues.reduce((sum, r) => sum + Math.pow(r - avgR, 2), 0) / trades.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;
  return avgR / stdDev;
}

/**
 * Beräkna max drawdown (i R)
 * @param {Array} trades - Array of trades with r_multiple (i kronologisk ordning)
 * @returns {number} Max drawdown in R
 */
export function calculateMaxDrawdown(trades) {
  if (!trades || trades.length === 0) return 0;

  let peak = 0;
  let maxDrawdown = 0;
  let cumulative = 0;

  for (const trade of trades) {
    cumulative += (trade.r_multiple || 0);

    if (cumulative > peak) {
      peak = cumulative;
    }

    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

// ============================================
// MFE/MAE CALCULATIONS
// ============================================

/**
 * Beräkna unrealized R (current R om positionen är öppen)
 * @param {number} entryPrice - Entry price
 * @param {number} currentPrice - Current price
 * @param {number} initialR - Initial R value
 * @returns {number} Unrealized R
 */
export function calculateUnrealizedR(entryPrice, currentPrice, initialR) {
  if (!entryPrice || !currentPrice || !initialR || initialR === 0) return 0;
  return (currentPrice - entryPrice) / initialR;
}

/**
 * Beräkna efficiency (exit R / MFE)
 * Visar hur mycket av potentialen som fångades
 * @param {number} exitR - R-multiple at exit
 * @param {number} maxMFE - Maximum favorable excursion
 * @returns {number} Efficiency in percent (0-100)
 */
export function calculateTradeEfficiency(exitR, maxMFE) {
  if (!maxMFE || maxMFE === 0) return 0;
  if (!exitR) return 0;

  // För vinnare: exit R / MFE * 100
  if (exitR > 0 && maxMFE > 0) {
    return Math.min((exitR / maxMFE) * 100, 100);
  }

  return 0;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format number as R-multiple string
 * @param {number} rMultiple - R-multiple value
 * @param {number} decimals - Number of decimals (default 1)
 * @returns {string} Formatted string (e.g., "+3.2R" or "-1.0R")
 */
export function formatRMultiple(rMultiple, decimals = 1) {
  if (rMultiple == null) return '—';
  const sign = rMultiple > 0 ? '+' : '';
  return `${sign}${rMultiple.toFixed(decimals)}R`;
}

/**
 * Format number as percentage string
 * @param {number} percent - Percentage value
 * @param {number} decimals - Number of decimals (default 1)
 * @returns {string} Formatted string (e.g., "+7.5%" or "-2.1%")
 */
export function formatPercent(percent, decimals = 1) {
  if (percent == null) return '—';
  const sign = percent > 0 ? '+' : '';
  return `${sign}${percent.toFixed(decimals)}%`;
}

/**
 * Format number as SEK string
 * @param {number} amount - Amount in SEK
 * @param {number} decimals - Number of decimals (default 0)
 * @returns {string} Formatted string (e.g., "+1,680 kr" or "-450 kr")
 */
export function formatKr(amount, decimals = 0) {
  if (amount == null) return '—';
  const sign = amount > 0 ? '+' : '';
  const formatted = Math.abs(amount).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${amount < 0 ? '-' : ''}${formatted} kr`;
}

/**
 * Get color for R-multiple value
 * @param {number} rMultiple - R-multiple value
 * @returns {string} CSS color code
 */
export function getRMultipleColor(rMultiple) {
  if (rMultiple == null || rMultiple === 0) return '#64748b'; // gray
  return rMultiple > 0 ? '#16a34a' : '#dc2626'; // green or red
}

/**
 * Get color for percentage value
 * @param {number} percent - Percentage value
 * @returns {string} CSS color code
 */
export function getPercentColor(percent) {
  if (percent == null || percent === 0) return '#64748b'; // gray
  return percent > 0 ? '#16a34a' : '#dc2626'; // green or red
}
