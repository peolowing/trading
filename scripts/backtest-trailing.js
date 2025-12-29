/**
 * Backtest with Trailing Stop
 *
 * Testar trailing stop istället för fast stop
 *
 * STRATEGI:
 * - Entry: Vid setup-signal
 * - Initial Stop: Entry - (ATR × 2.0)
 * - Trailing Stop: Följer priset uppåt med ATR × 2.0 avstånd
 * - Target: Entry + (Risk × 1.5)
 *
 * KÖRNING:
 * node scripts/backtest-trailing.js
 */

import yahooFinance from 'yahoo-finance2';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// ============================================
// KONFIGURATION
// ============================================

const STOCKS = [
  'VOLV-B.ST',
  'ABB.ST',
  'ERIC-B.ST',
  'ASSA-B.ST',
  'SAND.ST',
  'ATCO-A.ST',
  'HM-B.ST',
  'SEB-A.ST',
  'SWED-A.ST',
  'ALIV-SDB.ST'
];

const MONTHS_BACK = 5;
const ATR_PERIOD = 14;
const ATR_MULTIPLIER = 2.0;
const RR_RATIO = 1.5;
const MAX_HOLD_DAYS = 10;

// ============================================
// TEKNISKA INDIKATORER
// ============================================

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

function calculateATR(candles, period = ATR_PERIOD) {
  const tr = calculateTR(candles);
  const atr = [];

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += tr[i];
  }
  atr.push(sum / period);

  for (let i = period; i < tr.length; i++) {
    atr.push((atr[atr.length - 1] * (period - 1) + tr[i]) / period);
  }

  return atr;
}

function calculateEMA(values, period) {
  const k = 2 / (period + 1);
  const ema = [values[0]];

  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }

  return ema;
}

function identifySetup(candles, index) {
  if (index < 50) return null;

  const closes = candles.slice(0, index + 1).map(c => c.close);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);

  const currentClose = candles[index].close;
  const currentEMA20 = ema20[ema20.length - 1];
  const currentEMA50 = ema50[ema50.length - 1];

  if (currentClose > currentEMA20 && currentEMA20 > currentEMA50) {
    return 'LONG';
  }

  if (currentClose < currentEMA20 && currentEMA20 < currentEMA50) {
    return 'SHORT';
  }

  return null;
}

// ============================================
// BACKTEST MOTOR MED TRAILING STOP
// ============================================

function simulateTradeWithTrailing(candles, entryIndex, entry, initialStop, target, direction, atr) {
  const maxExitIndex = Math.min(entryIndex + MAX_HOLD_DAYS, candles.length - 1);
  let trailingStop = initialStop;
  let highestPrice = entry;  // För LONG
  let lowestPrice = entry;   // För SHORT

  for (let i = entryIndex + 1; i <= maxExitIndex; i++) {
    const candle = candles[i];
    const currentATR = atr[i - ATR_PERIOD + 1];

    if (direction === 'LONG') {
      // Uppdatera högsta pris och trailing stop
      if (candle.high > highestPrice) {
        highestPrice = candle.high;
        const newStop = highestPrice - (currentATR * ATR_MULTIPLIER);
        // Trailing stop kan bara gå uppåt, aldrig nedåt
        if (newStop > trailingStop) {
          trailingStop = newStop;
        }
      }

      // Trailing stop träffad
      if (candle.low <= trailingStop) {
        return {
          exitIndex: i,
          exitPrice: trailingStop,
          exitReason: 'TRAILING_STOP',
          daysHeld: i - entryIndex,
          maxPrice: highestPrice
        };
      }

      // Target träffad
      if (candle.high >= target) {
        return {
          exitIndex: i,
          exitPrice: target,
          exitReason: 'TARGET',
          daysHeld: i - entryIndex,
          maxPrice: highestPrice
        };
      }
    } else if (direction === 'SHORT') {
      // Uppdatera lägsta pris och trailing stop
      if (candle.low < lowestPrice) {
        lowestPrice = candle.low;
        const newStop = lowestPrice + (currentATR * ATR_MULTIPLIER);
        // Trailing stop kan bara gå nedåt, aldrig uppåt
        if (newStop < trailingStop) {
          trailingStop = newStop;
        }
      }

      // Trailing stop träffad
      if (candle.high >= trailingStop) {
        return {
          exitIndex: i,
          exitPrice: trailingStop,
          exitReason: 'TRAILING_STOP',
          daysHeld: i - entryIndex,
          minPrice: lowestPrice
        };
      }

      // Target träffad
      if (candle.low <= target) {
        return {
          exitIndex: i,
          exitPrice: target,
          exitReason: 'TARGET',
          daysHeld: i - entryIndex,
          minPrice: lowestPrice
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
    daysHeld: maxExitIndex - entryIndex,
    maxPrice: direction === 'LONG' ? highestPrice : undefined,
    minPrice: direction === 'SHORT' ? lowestPrice : undefined
  };
}

function backtestStock(ticker, candles) {
  const trades = [];
  const atr = calculateATR(candles);

  let i = 60;

  while (i < candles.length - MAX_HOLD_DAYS) {
    const setup = identifySetup(candles, i);

    if (setup) {
      const entry = candles[i].close;
      const currentATR = atr[i - ATR_PERIOD + 1];

      if (!currentATR) {
        i++;
        continue;
      }

      let initialStop, target;

      if (setup === 'LONG') {
        initialStop = entry - (currentATR * ATR_MULTIPLIER);
        const risk = entry - initialStop;
        target = entry + (risk * RR_RATIO);
      } else {
        initialStop = entry + (currentATR * ATR_MULTIPLIER);
        const risk = initialStop - entry;
        target = entry - (risk * RR_RATIO);
      }

      const result = simulateTradeWithTrailing(candles, i, entry, initialStop, target, setup, atr);

      const risk = setup === 'LONG' ? (entry - initialStop) : (initialStop - entry);
      const pnl = setup === 'LONG' ? (result.exitPrice - entry) : (entry - result.exitPrice);
      const rMultiple = pnl / risk;

      trades.push({
        ticker,
        entryDate: candles[i].date,
        entryPrice: entry,
        initialStopPrice: initialStop,
        targetPrice: target,
        direction: setup,
        exitDate: candles[result.exitIndex].date,
        exitPrice: result.exitPrice,
        exitReason: result.exitReason,
        daysHeld: result.daysHeld,
        rMultiple: rMultiple,
        pnlPercent: (pnl / entry) * 100,
        maxPrice: result.maxPrice,
        minPrice: result.minPrice
      });

      i = result.exitIndex + 1;
    } else {
      i++;
    }
  }

  return trades;
}

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
      expectancy: 0,
      targetHits: 0,
      trailingStopHits: 0,
      timeouts: 0
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

  const targetHits = trades.filter(t => t.exitReason === 'TARGET').length;
  const trailingStopHits = trades.filter(t => t.exitReason === 'TRAILING_STOP').length;
  const timeouts = trades.filter(t => t.exitReason === 'TIMEOUT').length;

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
    expectancy: expectancy,
    targetHits: targetHits,
    trailingStopHits: trailingStopHits,
    timeouts: timeouts
  };
}

// ============================================
// HUVUDPROGRAM
// ============================================

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     BACKTEST WITH TRAILING STOP                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`📊 Aktier: ${STOCKS.length}`);
  console.log(`📅 Period: ${MONTHS_BACK} månader tillbaka`);
  console.log(`🎯 Strategi: Trailing Stop (ATR × ${ATR_MULTIPLIER}), ${RR_RATIO}:1 R/R`);
  console.log(`⏱️  Max hålltid: ${MAX_HOLD_DAYS} dagar\n`);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - MONTHS_BACK);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let allTrades = [];

  for (const ticker of STOCKS) {
    try {
      console.log(`Hämtar data för ${ticker}...`);

      const queryOptions = { period1: startDate, period2: endDate, interval: '1d' };
      const result = await yahooFinance.historical(ticker, queryOptions);

      if (!result || result.length < 60) {
        console.log(`  ⚠️  Inte tillräckligt med data\n`);
        continue;
      }

      const candles = result.map(r => ({
        date: r.date.toISOString().split('T')[0],
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume
      }));

      console.log(`  ✓ ${candles.length} dagar av data`);

      const trades = backtestStock(ticker, candles);
      allTrades = allTrades.concat(trades);

      const stats = calculateStats(trades);

      console.log(`  📈 ${trades.length} trades`);
      console.log(`  💰 Avg R: ${stats.avgR >= 0 ? '+' : ''}${stats.avgR.toFixed(2)}R`);
      console.log(`  🎯 Win Rate: ${stats.winRate.toFixed(1)}%\n`);

    } catch (error) {
      console.log(`  ❌ Fel: ${error.message}\n`);
    }
  }

  // ============================================
  // SAMMANFATTNING
  // ============================================

  const totalStats = calculateStats(allTrades);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📈 TOTAL STATISTIK (TRAILING STOP)\n');
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

  console.log('\n🚪 EXIT ANLEDNINGAR\n');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Target träffad:          ${totalStats.targetHits} (${((totalStats.targetHits / totalStats.totalTrades) * 100).toFixed(1)}%)`);
  console.log(`Trailing Stop träffad:   ${totalStats.trailingStopHits} (${((totalStats.trailingStopHits / totalStats.totalTrades) * 100).toFixed(1)}%)`);
  console.log(`Timeout (${MAX_HOLD_DAYS}d):           ${totalStats.timeouts} (${((totalStats.timeouts / totalStats.totalTrades) * 100).toFixed(1)}%)`);
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

  console.log('💡 TOLKNING\n');

  if (totalStats.expectancy > 0.3) {
    console.log('✅ Stark positiv expectancy med trailing stop!');
  } else if (totalStats.expectancy > 0) {
    console.log('⚠️  Svag positiv expectancy - trailing stop hjälper något');
  } else {
    console.log('❌ Trailing stop förbättrade inte strategin tillräckligt');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
