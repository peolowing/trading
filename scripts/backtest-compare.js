/**
 * Backtest Parameter Comparison
 *
 * Jämför olika strategiparametrar för att hitta optimal konfiguration
 *
 * KÖRNING:
 * node scripts/backtest-compare.js
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
const MAX_HOLD_DAYS = 10;

// Olika konfigurationer att testa
const CONFIGS = [
  { name: 'Original (ATR×1.5, 2:1 R/R)', atrMultiplier: 1.5, rrRatio: 2.0 },
  { name: 'Wider Stop (ATR×2.0, 2:1 R/R)', atrMultiplier: 2.0, rrRatio: 2.0 },
  { name: 'Conservative (ATR×1.5, 1.5:1 R/R)', atrMultiplier: 1.5, rrRatio: 1.5 },
  { name: 'Balanced (ATR×2.0, 1.5:1 R/R)', atrMultiplier: 2.0, rrRatio: 1.5 },
  { name: 'Tight Stop (ATR×1.0, 2:1 R/R)', atrMultiplier: 1.0, rrRatio: 2.0 }
];

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
// BACKTEST MOTOR
// ============================================

function simulateTrade(candles, entryIndex, entry, stop, target, direction) {
  const maxExitIndex = Math.min(entryIndex + MAX_HOLD_DAYS, candles.length - 1);

  for (let i = entryIndex + 1; i <= maxExitIndex; i++) {
    const candle = candles[i];

    if (direction === 'LONG') {
      if (candle.low <= stop) {
        return {
          exitIndex: i,
          exitPrice: stop,
          exitReason: 'STOP',
          daysHeld: i - entryIndex
        };
      }

      if (candle.high >= target) {
        return {
          exitIndex: i,
          exitPrice: target,
          exitReason: 'TARGET',
          daysHeld: i - entryIndex
        };
      }
    } else if (direction === 'SHORT') {
      if (candle.high >= stop) {
        return {
          exitIndex: i,
          exitPrice: stop,
          exitReason: 'STOP',
          daysHeld: i - entryIndex
        };
      }

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

  const exitCandle = candles[maxExitIndex];
  return {
    exitIndex: maxExitIndex,
    exitPrice: exitCandle.close,
    exitReason: 'TIMEOUT',
    daysHeld: maxExitIndex - entryIndex
  };
}

function backtestStock(ticker, candles, atrMultiplier, rrRatio) {
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

      let stop, target;

      if (setup === 'LONG') {
        stop = entry - (currentATR * atrMultiplier);
        const risk = entry - stop;
        target = entry + (risk * rrRatio);
      } else {
        stop = entry + (currentATR * atrMultiplier);
        const risk = stop - entry;
        target = entry - (risk * rrRatio);
      }

      const result = simulateTrade(candles, i, entry, stop, target, setup);

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
      stopHits: 0,
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
  const stopHits = trades.filter(t => t.exitReason === 'STOP').length;
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
    stopHits: stopHits,
    timeouts: timeouts
  };
}

// ============================================
// HUVUDPROGRAM
// ============================================

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     BACKTEST PARAMETER COMPARISON                      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`📊 Aktier: ${STOCKS.length}`);
  console.log(`📅 Period: ${MONTHS_BACK} månader tillbaka`);
  console.log(`🧪 Konfigurationer att testa: ${CONFIGS.length}\n`);

  // Hämta data en gång
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - MONTHS_BACK);

  console.log('Hämtar marknadsdata...\n');

  const stockData = [];

  for (const ticker of STOCKS) {
    try {
      const queryOptions = { period1: startDate, period2: endDate, interval: '1d' };
      const result = await yahooFinance.historical(ticker, queryOptions);

      if (!result || result.length < 60) {
        console.log(`⚠️  ${ticker}: Inte tillräckligt med data`);
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

      stockData.push({ ticker, candles });
      console.log(`✓ ${ticker}: ${candles.length} dagar`);
    } catch (error) {
      console.log(`❌ ${ticker}: ${error.message}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Testa varje konfiguration
  const results = [];

  for (const config of CONFIGS) {
    console.log(`\n🧪 Testar: ${config.name}\n`);

    let allTrades = [];

    for (const { ticker, candles } of stockData) {
      const trades = backtestStock(ticker, candles, config.atrMultiplier, config.rrRatio);
      allTrades = allTrades.concat(trades);
    }

    const stats = calculateStats(allTrades);
    results.push({ config, stats });

    console.log(`   Trades: ${stats.totalTrades}`);
    console.log(`   Win Rate: ${stats.winRate.toFixed(1)}%`);
    console.log(`   Avg R: ${stats.avgR >= 0 ? '+' : ''}${stats.avgR.toFixed(2)}R`);
    console.log(`   Total R: ${stats.totalR >= 0 ? '+' : ''}${stats.totalR.toFixed(1)}R`);
    console.log(`   Profit Factor: ${stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}`);
    console.log(`   Expectancy: ${stats.expectancy >= 0 ? '+' : ''}${stats.expectancy.toFixed(2)}R`);
  }

  // ============================================
  // JÄMFÖRELSETABELL
  // ============================================

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📊 JÄMFÖRELSETABELL\n');
  console.log('─────────────────────────────────────────────────────────────────────────────');
  console.log('Konfiguration                       Trades  Win%   Avg R   Total R   PF    Exp');
  console.log('─────────────────────────────────────────────────────────────────────────────');

  for (const { config, stats } of results) {
    const namePad = config.name.padEnd(35);
    const tradesPad = stats.totalTrades.toString().padStart(6);
    const winRatePad = stats.winRate.toFixed(1).padStart(5);
    const avgRPad = (stats.avgR >= 0 ? '+' : '') + stats.avgR.toFixed(2).padStart(6);
    const totalRPad = (stats.totalR >= 0 ? '+' : '') + stats.totalR.toFixed(1).padStart(8);
    const pfPad = (stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)).padStart(5);
    const expPad = (stats.expectancy >= 0 ? '+' : '') + stats.expectancy.toFixed(2).padStart(5);

    console.log(`${namePad} ${tradesPad}  ${winRatePad}%  ${avgRPad}R  ${totalRPad}R  ${pfPad}  ${expPad}R`);
  }

  console.log('─────────────────────────────────────────────────────────────────────────────');

  // ============================================
  // DETALJERAD ANALYS AV BÄSTA KONFIGURATION
  // ============================================

  const sortedResults = [...results].sort((a, b) => b.stats.expectancy - a.stats.expectancy);
  const best = sortedResults[0];

  console.log('\n🏆 BÄSTA KONFIGURATION\n');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Namn:                    ${best.config.name}`);
  console.log(`ATR Multiplier:          ${best.config.atrMultiplier}`);
  console.log(`R/R Ratio:               ${best.config.rrRatio}:1`);
  console.log(`\nResultat:`);
  console.log(`  Total Trades:          ${best.stats.totalTrades}`);
  console.log(`  Vinnare:               ${best.stats.winners} (${best.stats.winRate.toFixed(1)}%)`);
  console.log(`  Förlorare:             ${best.stats.losers} (${(100 - best.stats.winRate).toFixed(1)}%)`);
  console.log(`  \n  Genomsnittlig R:       ${best.stats.avgR >= 0 ? '+' : ''}${best.stats.avgR.toFixed(2)}R`);
  console.log(`  Genomsnittlig vinst:   +${best.stats.avgWin.toFixed(2)}R`);
  console.log(`  Genomsnittlig förlust: ${best.stats.avgLoss.toFixed(2)}R`);
  console.log(`  \n  Total R:               ${best.stats.totalR >= 0 ? '+' : ''}${best.stats.totalR.toFixed(1)}R`);
  console.log(`  Profit Factor:         ${best.stats.profitFactor === Infinity ? '∞' : best.stats.profitFactor.toFixed(2)}`);
  console.log(`  Expectancy:            ${best.stats.expectancy >= 0 ? '+' : ''}${best.stats.expectancy.toFixed(2)}R`);
  console.log(`  \n  Exit Reasons:`);
  console.log(`    Target:              ${best.stats.targetHits} (${((best.stats.targetHits / best.stats.totalTrades) * 100).toFixed(1)}%)`);
  console.log(`    Stop:                ${best.stats.stopHits} (${((best.stats.stopHits / best.stats.totalTrades) * 100).toFixed(1)}%)`);
  console.log(`    Timeout:             ${best.stats.timeouts} (${((best.stats.timeouts / best.stats.totalTrades) * 100).toFixed(1)}%)`);
  console.log('─────────────────────────────────────────────────────────');

  // ============================================
  // REKOMMENDATION
  // ============================================

  console.log('\n💡 REKOMMENDATION\n');

  if (best.stats.expectancy > 0.3) {
    console.log(`✅ ${best.config.name} visar stark positiv expectancy!`);
    console.log('   Detta är en lovande konfiguration att använda.');
  } else if (best.stats.expectancy > 0) {
    console.log(`⚠️  ${best.config.name} visar svag positiv expectancy.`);
    console.log('   Konfigurationen kan fungera men är marginell.');
  } else {
    console.log(`❌ Ingen konfiguration visar positiv expectancy under denna period.`);
    console.log('   Strategin behöver fundamentala förändringar eller passar inte marknadsmiljön.');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
