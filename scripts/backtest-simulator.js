/**
 * Backtest Simulator - Swing Trading Strategy
 *
 * Simulerar swing-trading strategin på 10 svenska aktier över 5 månader
 *
 * STRATEGI:
 * - Entry: Vid setup-signal (Bullish Trend, Pullback, Breakout)
 * - Stop: Entry - (ATR × 1.5)
 * - Target: Entry + (Risk × 2.0)
 * - Exit: När stop eller target träffas, eller efter 10 dagar
 *
 * KÖRNING:
 * node scripts/backtest-simulator.js
 */

import yahooFinance from 'yahoo-finance2';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// ============================================
// KONFIGURATION
// ============================================

const STOCKS = [
  'VOLV-B.ST',   // Volvo B
  'ABB.ST',      // ABB
  'ERIC-B.ST',   // Ericsson B
  'ASSA-B.ST',   // Assa Abloy B
  'SAND.ST',     // Sandvik
  'ATCO-A.ST',   // Atlas Copco A
  'HM-B.ST',     // H&M B
  'SEB-A.ST',    // SEB A
  'SWED-A.ST',   // Swedbank A
  'ALIV-SDB.ST'  // Alleima (f.d. Sandvik Materials Tech)
];

const MONTHS_BACK = 5;
const ATR_PERIOD = 14;
const ATR_MULTIPLIER = 1.5;
const RR_RATIO = 2.0;
const MAX_HOLD_DAYS = 10;

// ============================================
// TEKNISKA INDIKATORER
// ============================================

/**
 * Beräkna True Range
 */
function calculateTR(candles) {
  const tr = [candles[0].high - candles[0].low];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    tr.push(Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    ));
  }

  return tr;
}

/**
 * Beräkna ATR (Average True Range)
 */
function calculateATR(candles, period = ATR_PERIOD) {
  const tr = calculateTR(candles);
  const atr = [];

  // First ATR = SMA of TR
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += tr[i];
  }
  atr.push(sum / period);

  // Smoothed ATR
  for (let i = period; i < tr.length; i++) {
    atr.push((atr[atr.length - 1] * (period - 1) + tr[i]) / period);
  }

  return atr;
}

/**
 * Beräkna EMA
 */
function calculateEMA(values, period) {
  const k = 2 / (period + 1);
  const ema = [values[0]];

  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }

  return ema;
}

/**
 * Identifiera setup (förenklad version)
 */
function identifySetup(candles, index) {
  if (index < 50) return null; // Behöver tillräckligt med data

  const closes = candles.slice(0, index + 1).map(c => c.close);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);

  const currentClose = candles[index].close;
  const currentEMA20 = ema20[ema20.length - 1];
  const currentEMA50 = ema50[ema50.length - 1];

  // Bullish Trend: Pris > EMA20 > EMA50
  if (currentClose > currentEMA20 && currentEMA20 > currentEMA50) {
    return 'LONG';
  }

  // Bearish Trend: Pris < EMA20 < EMA50
  if (currentClose < currentEMA20 && currentEMA20 < currentEMA50) {
    return 'SHORT';
  }

  return null;
}

// ============================================
// BACKTEST MOTOR
// ============================================

/**
 * Simulera en trade
 */
function simulateTrade(candles, entryIndex, entry, stop, target, direction) {
  const maxExitIndex = Math.min(entryIndex + MAX_HOLD_DAYS, candles.length - 1);

  for (let i = entryIndex + 1; i <= maxExitIndex; i++) {
    const candle = candles[i];

    if (direction === 'LONG') {
      // Stop hit
      if (candle.low <= stop) {
        return {
          exitIndex: i,
          exitPrice: stop,
          exitReason: 'STOP',
          daysHeld: i - entryIndex
        };
      }

      // Target hit
      if (candle.high >= target) {
        return {
          exitIndex: i,
          exitPrice: target,
          exitReason: 'TARGET',
          daysHeld: i - entryIndex
        };
      }
    } else if (direction === 'SHORT') {
      // Stop hit (för short)
      if (candle.high >= stop) {
        return {
          exitIndex: i,
          exitPrice: stop,
          exitReason: 'STOP',
          daysHeld: i - entryIndex
        };
      }

      // Target hit (för short)
      if (candle.low <= target) {
        return {
          exitIndex: i,
          exitPrice: target,
          exitReason: 'TARGET',
          daysHeld: i - entryIndex
        };
      }
    }
  }

  // Timeout - exit at current price
  const exitCandle = candles[maxExitIndex];
  return {
    exitIndex: maxExitIndex,
    exitPrice: exitCandle.close,
    exitReason: 'TIMEOUT',
    daysHeld: maxExitIndex - entryIndex
  };
}

/**
 * Kör backtest för en aktie
 */
function backtestStock(ticker, candles) {
  const trades = [];
  const atr = calculateATR(candles);

  let i = 60; // Start efter tillräckligt med data

  while (i < candles.length - MAX_HOLD_DAYS) {
    const setup = identifySetup(candles, i);

    if (setup) {
      const entry = candles[i].close;
      const currentATR = atr[i - ATR_PERIOD + 1];

      if (!currentATR) {
        i++;
        continue;
      }

      let stop, target;

      if (setup === 'LONG') {
        stop = entry - (currentATR * ATR_MULTIPLIER);
        const risk = entry - stop;
        target = entry + (risk * RR_RATIO);
      } else {
        stop = entry + (currentATR * ATR_MULTIPLIER);
        const risk = stop - entry;
        target = entry - (risk * RR_RATIO);
      }

      // Simulera trade
      const result = simulateTrade(candles, i, entry, stop, target, setup);

      // Beräkna R-multiple
      const risk = setup === 'LONG' ? (entry - stop) : (stop - entry);
      const pnl = setup === 'LONG' ? (result.exitPrice - entry) : (entry - result.exitPrice);
      const rMultiple = pnl / risk;

      trades.push({
        ticker,
        entryDate: candles[i].date,
        entryPrice: entry,
        stopPrice: stop,
        targetPrice: target,
        direction: setup,
        exitDate: candles[result.exitIndex].date,
        exitPrice: result.exitPrice,
        exitReason: result.exitReason,
        daysHeld: result.daysHeld,
        rMultiple: rMultiple,
        pnlPercent: (pnl / entry) * 100
      });

      // Hoppa över de dagar som traden varade
      i = result.exitIndex + 1;
    } else {
      i++;
    }
  }

  return trades;
}

/**
 * Beräkna statistik
 */
function calculateStats(trades) {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winners: 0,
      losers: 0,
      winRate: 0,
      avgR: 0,
      avgWin: 0,
      avgLoss: 0,
      totalR: 0,
      maxWin: 0,
      maxLoss: 0,
      profitFactor: 0,
      expectancy: 0
    };
  }

  const winners = trades.filter(t => t.rMultiple > 0);
  const losers = trades.filter(t => t.rMultiple <= 0);

  const totalR = trades.reduce((sum, t) => sum + t.rMultiple, 0);
  const avgR = totalR / trades.length;

  const avgWin = winners.length > 0
    ? winners.reduce((sum, t) => sum + t.rMultiple, 0) / winners.length
    : 0;

  const avgLoss = losers.length > 0
    ? losers.reduce((sum, t) => sum + t.rMultiple, 0) / losers.length
    : 0;

  const maxWin = winners.length > 0
    ? Math.max(...winners.map(t => t.rMultiple))
    : 0;

  const maxLoss = losers.length > 0
    ? Math.min(...losers.map(t => t.rMultiple))
    : 0;

  const grossProfit = winners.reduce((sum, t) => sum + t.rMultiple, 0);
  const grossLoss = Math.abs(losers.reduce((sum, t) => sum + t.rMultiple, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);

  const winRate = (winners.length / trades.length) * 100;
  const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * Math.abs(avgLoss);

  return {
    totalTrades: trades.length,
    winners: winners.length,
    losers: losers.length,
    winRate: winRate,
    avgR: avgR,
    avgWin: avgWin,
    avgLoss: avgLoss,
    totalR: totalR,
    maxWin: maxWin,
    maxLoss: maxLoss,
    profitFactor: profitFactor,
    expectancy: expectancy
  };
}

// ============================================
// HUVUDPROGRAM
// ============================================

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     BACKTEST SIMULATOR - SWING TRADING STRATEGY        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`📊 Aktier: ${STOCKS.length}`);
  console.log(`📅 Period: ${MONTHS_BACK} månader tillbaka`);
  console.log(`🎯 Strategi: ATR × ${ATR_MULTIPLIER} stop, ${RR_RATIO}:1 R/R`);
  console.log(`⏱️  Max hålltid: ${MAX_HOLD_DAYS} dagar\n`);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - MONTHS_BACK);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let allTrades = [];
  const stockResults = [];

  for (const ticker of STOCKS) {
    try {
      console.log(`Hämtar data för ${ticker}...`);

      const queryOptions = { period1: startDate, period2: endDate, interval: '1d' };
      const result = await yahooFinance.historical(ticker, queryOptions);

      if (!result || result.length < 60) {
        console.log(`  ⚠️  Inte tillräckligt med data\n`);
        continue;
      }

      // Konvertera till vårt format
      const candles = result.map(r => ({
        date: r.date.toISOString().split('T')[0],
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume
      }));

      console.log(`  ✓ ${candles.length} dagar av data`);

      // Kör backtest
      const trades = backtestStock(ticker, candles);
      allTrades = allTrades.concat(trades);

      // Beräkna statistik för denna aktie
      const stats = calculateStats(trades);
      stockResults.push({ ticker, stats, trades });

      console.log(`  📈 ${trades.length} trades`);
      console.log(`  💰 Avg R: ${stats.avgR.toFixed(2)}R`);
      console.log(`  🎯 Win Rate: ${stats.winRate.toFixed(1)}%\n`);

    } catch (error) {
      console.log(`  ❌ Fel: ${error.message}\n`);
    }
  }

  // ============================================
  // SAMMANFATTNING
  // ============================================

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📊 RESULTAT PER AKTIE\n');
  console.log('─────────────────────────────────────────────────────────');

  // Tabell header
  console.log('Ticker        Trades  Win%   Avg R   Total R  Max Win  Max Loss');
  console.log('─────────────────────────────────────────────────────────');

  for (const { ticker, stats } of stockResults) {
    const tickerPad = ticker.padEnd(12);
    const tradesPad = stats.totalTrades.toString().padStart(6);
    const winRatePad = stats.winRate.toFixed(1).padStart(5);
    const avgRPad = stats.avgR.toFixed(2).padStart(7);
    const totalRPad = (stats.totalR >= 0 ? '+' : '') + stats.totalR.toFixed(1).padStart(7);
    const maxWinPad = ('+' + stats.maxWin.toFixed(1)).padStart(8);
    const maxLossPad = stats.maxLoss.toFixed(1).padStart(9);

    console.log(`${tickerPad} ${tradesPad}  ${winRatePad}%  ${avgRPad}R  ${totalRPad}R  ${maxWinPad}R  ${maxLossPad}R`);
  }

  console.log('─────────────────────────────────────────────────────────');

  // ============================================
  // TOTAL STATISTIK
  // ============================================

  const totalStats = calculateStats(allTrades);

  console.log('\n📈 TOTAL STATISTIK (ALLA AKTIER)\n');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Totalt antal trades:     ${totalStats.totalTrades}`);
  console.log(`Vinnare:                 ${totalStats.winners} (${totalStats.winRate.toFixed(1)}%)`);
  console.log(`Förlorare:               ${totalStats.losers} (${(100 - totalStats.winRate).toFixed(1)}%)`);
  console.log(`\nGenomsnittlig R:         ${totalStats.avgR >= 0 ? '+' : ''}${totalStats.avgR.toFixed(2)}R`);
  console.log(`Genomsnittlig vinst:     +${totalStats.avgWin.toFixed(2)}R`);
  console.log(`Genomsnittlig förlust:   ${totalStats.avgLoss.toFixed(2)}R`);
  console.log(`\nTotal R:                 ${totalStats.totalR >= 0 ? '+' : ''}${totalStats.totalR.toFixed(1)}R`);
  console.log(`Största vinst:           +${totalStats.maxWin.toFixed(1)}R`);
  console.log(`Största förlust:         ${totalStats.maxLoss.toFixed(1)}R`);
  console.log(`\nProfit Factor:           ${totalStats.profitFactor === Infinity ? '∞' : totalStats.profitFactor.toFixed(2)}`);
  console.log(`Expectancy:              ${totalStats.expectancy >= 0 ? '+' : ''}${totalStats.expectancy.toFixed(2)}R`);
  console.log('─────────────────────────────────────────────────────────');

  // ============================================
  // EXIT REASONS
  // ============================================

  const exitReasons = {
    TARGET: allTrades.filter(t => t.exitReason === 'TARGET').length,
    STOP: allTrades.filter(t => t.exitReason === 'STOP').length,
    TIMEOUT: allTrades.filter(t => t.exitReason === 'TIMEOUT').length
  };

  console.log('\n🚪 EXIT ANLEDNINGAR\n');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Target träffad:          ${exitReasons.TARGET} (${((exitReasons.TARGET / totalStats.totalTrades) * 100).toFixed(1)}%)`);
  console.log(`Stop träffad:            ${exitReasons.STOP} (${((exitReasons.STOP / totalStats.totalTrades) * 100).toFixed(1)}%)`);
  console.log(`Timeout (${MAX_HOLD_DAYS}d):           ${exitReasons.TIMEOUT} (${((exitReasons.TIMEOUT / totalStats.totalTrades) * 100).toFixed(1)}%)`);
  console.log('─────────────────────────────────────────────────────────');

  // ============================================
  // BÄSTA & SÄMSTA TRADES
  // ============================================

  const sortedTrades = [...allTrades].sort((a, b) => b.rMultiple - a.rMultiple);
  const best3 = sortedTrades.slice(0, 3);
  const worst3 = sortedTrades.slice(-3).reverse();

  console.log('\n🏆 BÄSTA TRADES\n');
  console.log('─────────────────────────────────────────────────────────');
  for (const trade of best3) {
    console.log(`${trade.ticker.padEnd(12)} ${trade.entryDate}  ${trade.direction.padEnd(5)}  +${trade.rMultiple.toFixed(2)}R  (${trade.exitReason})`);
  }

  console.log('\n💔 SÄMSTA TRADES\n');
  console.log('─────────────────────────────────────────────────────────');
  for (const trade of worst3) {
    console.log(`${trade.ticker.padEnd(12)} ${trade.entryDate}  ${trade.direction.padEnd(5)}  ${trade.rMultiple.toFixed(2)}R  (${trade.exitReason})`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ============================================
  // INTERPRETATION
  // ============================================

  console.log('💡 TOLKNING\n');

  if (totalStats.expectancy > 0.3) {
    console.log('✅ Positiv expectancy - strategin har god potential');
  } else if (totalStats.expectancy > 0) {
    console.log('⚠️  Svag positiv expectancy - strategin kan förbättras');
  } else {
    console.log('❌ Negativ expectancy - strategin behöver justeras');
  }

  if (totalStats.winRate >= 50) {
    console.log('✅ Win rate över 50% - bra träffsäkerhet');
  } else {
    console.log('⚠️  Win rate under 50% - kräver större vinstmarginaler');
  }

  if (totalStats.profitFactor >= 2) {
    console.log('✅ Profit factor över 2.0 - stark strategi');
  } else if (totalStats.profitFactor >= 1.5) {
    console.log('✅ Profit factor över 1.5 - acceptabel strategi');
  } else if (totalStats.profitFactor > 1) {
    console.log('⚠️  Profit factor under 1.5 - marginal strategi');
  } else {
    console.log('❌ Profit factor under 1.0 - förlorande strategi');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Kör simulatorn
main().catch(console.error);
