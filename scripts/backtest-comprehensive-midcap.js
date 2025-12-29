/**
 * Comprehensive Backtest - Large + Mid Cap
 *
 * Testar 25 svenska aktier (10 large-cap + 15 mid-cap)
 * Med alla parameterkombinationer
 *
 * KÖRNING:
 * node scripts/backtest-comprehensive-midcap.js
 */

import yahooFinance from 'yahoo-finance2';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// ============================================
// KONFIGURATION
// ============================================

const LARGE_CAP_STOCKS = [
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

const MID_CAP_STOCKS = [
  'ESSITY-B.ST',   // Essity B (hygien/hälsa)
  'INVE-B.ST',     // Investor B (investmentbolag)
  'KINV-B.ST',     // Kinnevik B (investmentbolag)
  'ELUX-B.ST',     // Electrolux B (vitvaror)
  'SKF-B.ST',      // SKF B (lager)
  'SSAB-A.ST',     // SSAB A (stål)
  'SKAB.ST',       // Skanska B (bygg)
  'BOL.ST',        // Boliden (gruvbolag)
  'TELIA.ST',      // Telia (telekom)
  'NIBE-B.ST',     // NIBE B (värmepumpar)
  'ALFA.ST',       // Alfa Laval (värmeväxlare)
  'HEXAB.ST',      // Hexagon AB (mätteknik)
  'GETI-B.ST',     // Getinge B (medicinteknik)
  'EPI-B.ST',      // Epiroc B (gruvutrustning)
  'HUSQ-B.ST'      // Husqvarna B (trädgårdsutrustning)
];

const STOCKS = [...LARGE_CAP_STOCKS, ...MID_CAP_STOCKS];

const MONTHS_BACK = 5;
const ATR_PERIOD = 14;
const ATR_MULTIPLIER = 2.0;
const RR_RATIO = 1.5;

// Parametrar att testa
const MAX_HOLD_VARIANTS = [10, 15, 20, 30, 999];
const ENTRY_FILTERS = ['NONE', 'VOLUME', 'EDGE', 'COMBO'];
const EXIT_STRATEGIES = ['FIXED', 'PARTIAL', 'BREAKEVEN'];

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

function calculateRSI(closes, period = 14) {
  const rsi = [];
  for (let i = 0; i < period; i++) {
    rsi.push(50);
  }

  for (let i = period; i < closes.length; i++) {
    let gains = 0;
    let losses = 0;

    for (let j = i - period; j < i; j++) {
      const change = closes[j + 1] - closes[j];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }

  return rsi;
}

function calculateRelativeVolume(candles, index, period = 20) {
  if (index < period) return 1;

  let avgVolume = 0;
  for (let i = index - period; i < index; i++) {
    avgVolume += candles[i].volume;
  }
  avgVolume /= period;

  return candles[index].volume / avgVolume;
}

function calculateEdgeScore(candles, index) {
  if (index < 50) return 50;

  const closes = candles.slice(0, index + 1).map(c => c.close);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const rsi = calculateRSI(closes, 14);
  const relVol = calculateRelativeVolume(candles, index, 20);

  let score = 50;

  const currentClose = closes[closes.length - 1];
  const currentEMA20 = ema20[ema20.length - 1];
  const currentEMA50 = ema50[ema50.length - 1];

  if (currentClose > currentEMA20 && currentEMA20 > currentEMA50) {
    const trendStrength = ((currentClose - currentEMA50) / currentEMA50) * 100;
    score += Math.min(trendStrength * 3, 30);
  }

  const currentRSI = rsi[rsi.length - 1];
  if (currentRSI > 40 && currentRSI < 70) {
    score += 20;
  } else if (currentRSI > 30 && currentRSI < 80) {
    score += 10;
  }

  if (relVol > 2) score += 20;
  else if (relVol > 1.5) score += 15;
  else if (relVol > 1.2) score += 10;

  return Math.min(Math.max(score, 0), 100);
}

function identifySetup(candles, index, entryFilter) {
  if (index < 50) return null;

  const closes = candles.slice(0, index + 1).map(c => c.close);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);

  const currentClose = candles[index].close;
  const currentEMA20 = ema20[ema20.length - 1];
  const currentEMA50 = ema50[ema50.length - 1];

  let setupType = null;

  if (currentClose > currentEMA20 && currentEMA20 > currentEMA50) {
    setupType = 'LONG';
  } else if (currentClose < currentEMA20 && currentEMA20 < currentEMA50) {
    setupType = 'SHORT';
  }

  if (!setupType) return null;

  if (entryFilter === 'VOLUME') {
    const relVol = calculateRelativeVolume(candles, index, 20);
    if (relVol < 1.5) return null;
  } else if (entryFilter === 'EDGE') {
    const edgeScore = calculateEdgeScore(candles, index);
    if (edgeScore < 60) return null;
  } else if (entryFilter === 'COMBO') {
    const relVol = calculateRelativeVolume(candles, index, 20);
    const edgeScore = calculateEdgeScore(candles, index);
    if (relVol < 1.5 || edgeScore < 60) return null;
  }

  return setupType;
}

// ============================================
// BACKTEST MOTOR
// ============================================

function simulateTrade(candles, entryIndex, entry, stop, target, direction, maxHoldDays, exitStrategy) {
  const maxExitIndex = Math.min(entryIndex + maxHoldDays, candles.length - 1);
  const risk = direction === 'LONG' ? (entry - stop) : (stop - entry);

  let breakevenActivated = false;
  let partialExited = false;
  let partialExitPrice = null;

  for (let i = entryIndex + 1; i <= maxExitIndex; i++) {
    const candle = candles[i];
    const currentPnL = direction === 'LONG' ? (candle.close - entry) : (entry - candle.close);
    const currentR = currentPnL / risk;

    if (exitStrategy === 'BREAKEVEN' && !breakevenActivated && currentR >= 0.5) {
      stop = entry;
      breakevenActivated = true;
    }

    if (exitStrategy === 'PARTIAL' && !partialExited && currentR >= 1.0) {
      partialExited = true;
      partialExitPrice = direction === 'LONG' ? entry + risk : entry - risk;
    }

    if (direction === 'LONG') {
      if (candle.low <= stop) {
        const exitPrice = stop;
        const exitR = (exitPrice - entry) / risk;
        const finalR = partialExited ? (1.0 + exitR) / 2 : exitR;

        return {
          exitIndex: i,
          exitPrice: exitPrice,
          exitReason: breakevenActivated ? 'BREAKEVEN' : 'STOP',
          daysHeld: i - entryIndex,
          rMultiple: finalR,
          partialExited: partialExited
        };
      }

      if (candle.high >= target) {
        const exitPrice = target;
        const targetR = (exitPrice - entry) / risk;
        const finalR = partialExited ? (1.0 + targetR) / 2 : targetR;

        return {
          exitIndex: i,
          exitPrice: exitPrice,
          exitReason: 'TARGET',
          daysHeld: i - entryIndex,
          rMultiple: finalR,
          partialExited: partialExited
        };
      }
    } else if (direction === 'SHORT') {
      if (candle.high >= stop) {
        const exitPrice = stop;
        const exitR = (entry - exitPrice) / risk;
        const finalR = partialExited ? (1.0 + exitR) / 2 : exitR;

        return {
          exitIndex: i,
          exitPrice: exitPrice,
          exitReason: breakevenActivated ? 'BREAKEVEN' : 'STOP',
          daysHeld: i - entryIndex,
          rMultiple: finalR,
          partialExited: partialExited
        };
      }

      if (candle.low <= target) {
        const exitPrice = target;
        const targetR = (entry - exitPrice) / risk;
        const finalR = partialExited ? (1.0 + targetR) / 2 : targetR;

        return {
          exitIndex: i,
          exitPrice: exitPrice,
          exitReason: 'TARGET',
          daysHeld: i - entryIndex,
          rMultiple: finalR,
          partialExited: partialExited
        };
      }
    }
  }

  const exitCandle = candles[maxExitIndex];
  const pnl = direction === 'LONG' ? (exitCandle.close - entry) : (entry - exitCandle.close);
  const exitR = pnl / risk;
  const finalR = partialExited ? (1.0 + exitR) / 2 : exitR;

  return {
    exitIndex: maxExitIndex,
    exitPrice: exitCandle.close,
    exitReason: 'TIMEOUT',
    daysHeld: maxExitIndex - entryIndex,
    rMultiple: finalR,
    partialExited: partialExited
  };
}

function backtestStock(ticker, candles, maxHoldDays, entryFilter, exitStrategy) {
  const trades = [];
  const atr = calculateATR(candles);

  let i = 60;

  while (i < candles.length - maxHoldDays) {
    const setup = identifySetup(candles, i, entryFilter);

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

      const result = simulateTrade(candles, i, entry, stop, target, setup, maxHoldDays, exitStrategy);

      trades.push({
        ticker,
        entryDate: candles[i].date,
        direction: setup,
        exitReason: result.exitReason,
        daysHeld: result.daysHeld,
        rMultiple: result.rMultiple,
        partialExited: result.partialExited || false
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
      totalR: 0,
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
    totalR: totalR,
    profitFactor: profitFactor,
    expectancy: expectancy
  };
}

// ============================================
// HUVUDPROGRAM
// ============================================

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   COMPREHENSIVE BACKTEST - LARGE + MID CAP             ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`📊 Aktier: ${STOCKS.length} (${LARGE_CAP_STOCKS.length} large-cap + ${MID_CAP_STOCKS.length} mid-cap)`);
  console.log(`📅 Period: ${MONTHS_BACK} månader tillbaka`);
  console.log(`🧪 Kombinationer: ${MAX_HOLD_VARIANTS.length} × ${ENTRY_FILTERS.length} × ${EXIT_STRATEGIES.length} = ${MAX_HOLD_VARIANTS.length * ENTRY_FILTERS.length * EXIT_STRATEGIES.length}\n`);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - MONTHS_BACK);

  console.log('Hämtar marknadsdata...\n');

  const stockData = [];
  const largeCapData = [];
  const midCapData = [];

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

      const stockEntry = { ticker, candles };
      stockData.push(stockEntry);

      if (LARGE_CAP_STOCKS.includes(ticker)) {
        largeCapData.push(stockEntry);
      } else {
        midCapData.push(stockEntry);
      }

      console.log(`✓ ${ticker}: ${candles.length} dagar`);
    } catch (error) {
      console.log(`❌ ${ticker}: ${error.message}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Kör simuleringar...\n');

  const results = [];
  let simulationCount = 0;
  const totalSimulations = MAX_HOLD_VARIANTS.length * ENTRY_FILTERS.length * EXIT_STRATEGIES.length;

  for (const maxHold of MAX_HOLD_VARIANTS) {
    for (const entryFilter of ENTRY_FILTERS) {
      for (const exitStrategy of EXIT_STRATEGIES) {
        simulationCount++;

        const maxHoldLabel = maxHold === 999 ? 'None' : `${maxHold}d`;
        const configName = `${maxHoldLabel} | ${entryFilter} | ${exitStrategy}`;

        process.stdout.write(`\r[${simulationCount}/${totalSimulations}] ${configName.padEnd(40)}`);

        let allTrades = [];
        let largeCapTrades = [];
        let midCapTrades = [];

        for (const { ticker, candles } of stockData) {
          const trades = backtestStock(ticker, candles, maxHold, entryFilter, exitStrategy);
          allTrades = allTrades.concat(trades);

          if (LARGE_CAP_STOCKS.includes(ticker)) {
            largeCapTrades = largeCapTrades.concat(trades);
          } else {
            midCapTrades = midCapTrades.concat(trades);
          }
        }

        const stats = calculateStats(allTrades);
        const largeCapStats = calculateStats(largeCapTrades);
        const midCapStats = calculateStats(midCapTrades);

        results.push({
          maxHold,
          entryFilter,
          exitStrategy,
          configName,
          stats,
          largeCapStats,
          midCapStats
        });
      }
    }
  }

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const sortedResults = [...results].sort((a, b) => b.stats.expectancy - a.stats.expectancy);

  // ============================================
  // TOP 10 KONFIGURATIONER
  // ============================================

  console.log('\n🏆 TOP 10 BÄSTA KONFIGURATIONER (ALLA AKTIER)\n');
  console.log('─────────────────────────────────────────────────────────────────────────────────────');
  console.log('Rank  Hold    Filter  Exit       Trades  Win%   Avg R   Total R   PF    Expectancy');
  console.log('─────────────────────────────────────────────────────────────────────────────────────');

  for (let i = 0; i < Math.min(10, sortedResults.length); i++) {
    const r = sortedResults[i];
    const rank = (i + 1).toString().padStart(2);
    const holdLabel = (r.maxHold === 999 ? 'None' : `${r.maxHold}d`).padEnd(7);
    const filterLabel = r.entryFilter.padEnd(7);
    const exitLabel = r.exitStrategy.padEnd(10);
    const trades = r.stats.totalTrades.toString().padStart(6);
    const winRate = r.stats.winRate.toFixed(1).padStart(5);
    const avgR = (r.stats.avgR >= 0 ? '+' : '') + r.stats.avgR.toFixed(2).padStart(6);
    const totalR = (r.stats.totalR >= 0 ? '+' : '') + r.stats.totalR.toFixed(1).padStart(8);
    const pf = (r.stats.profitFactor === Infinity ? '∞' : r.stats.profitFactor.toFixed(2)).padStart(5);
    const exp = (r.stats.expectancy >= 0 ? '+' : '') + r.stats.expectancy.toFixed(3);

    console.log(`${rank}.   ${holdLabel} ${filterLabel} ${exitLabel} ${trades}  ${winRate}%  ${avgR}R  ${totalR}R  ${pf}  ${exp}R`);
  }

  console.log('─────────────────────────────────────────────────────────────────────────────────────');

  // ============================================
  // LARGE CAP VS MID CAP
  // ============================================

  const best = sortedResults[0];

  console.log('\n📊 LARGE CAP VS MID CAP (BÄSTA KONFIGURATION)\n');
  console.log('─────────────────────────────────────────────────────────');
  console.log('                      Large Cap        Mid Cap          All');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Trades:               ${best.largeCapStats.totalTrades.toString().padStart(9)}       ${best.midCapStats.totalTrades.toString().padStart(7)}       ${best.stats.totalTrades.toString().padStart(7)}`);
  console.log(`Win Rate:             ${best.largeCapStats.winRate.toFixed(1).padStart(8)}%      ${best.midCapStats.winRate.toFixed(1).padStart(6)}%      ${best.stats.winRate.toFixed(1).padStart(6)}%`);
  console.log(`Avg R:                ${(best.largeCapStats.avgR >= 0 ? '+' : '') + best.largeCapStats.avgR.toFixed(2).padStart(8)}R      ${(best.midCapStats.avgR >= 0 ? '+' : '') + best.midCapStats.avgR.toFixed(2).padStart(6)}R      ${(best.stats.avgR >= 0 ? '+' : '') + best.stats.avgR.toFixed(2).padStart(6)}R`);
  console.log(`Total R:              ${(best.largeCapStats.totalR >= 0 ? '+' : '') + best.largeCapStats.totalR.toFixed(1).padStart(8)}R      ${(best.midCapStats.totalR >= 0 ? '+' : '') + best.midCapStats.totalR.toFixed(1).padStart(6)}R      ${(best.stats.totalR >= 0 ? '+' : '') + best.stats.totalR.toFixed(1).padStart(6)}R`);
  console.log(`Expectancy:           ${(best.largeCapStats.expectancy >= 0 ? '+' : '') + best.largeCapStats.expectancy.toFixed(3).padStart(8)}R      ${(best.midCapStats.expectancy >= 0 ? '+' : '') + best.midCapStats.expectancy.toFixed(3).padStart(6)}R      ${(best.stats.expectancy >= 0 ? '+' : '') + best.stats.expectancy.toFixed(3).padStart(6)}R`);
  console.log('─────────────────────────────────────────────────────────');

  // ============================================
  // ANALYS PER KATEGORI
  // ============================================

  console.log('\n📊 ANALYS PER KATEGORI\n');

  console.log('🕐 MAX HÅLLTID:');
  for (const maxHold of MAX_HOLD_VARIANTS) {
    const configs = results.filter(r => r.maxHold === maxHold);
    const avgExpectancy = configs.reduce((sum, r) => sum + r.stats.expectancy, 0) / configs.length;
    const label = (maxHold === 999 ? 'Ingen timeout' : `${maxHold} dagar`).padEnd(15);
    const exp = (avgExpectancy >= 0 ? '+' : '') + avgExpectancy.toFixed(3);
    console.log(`  ${label}  Avg Expectancy: ${exp}R`);
  }

  console.log('\n🎯 ENTRY FILTER:');
  for (const filter of ENTRY_FILTERS) {
    const configs = results.filter(r => r.entryFilter === filter);
    const avgExpectancy = configs.reduce((sum, r) => sum + r.stats.expectancy, 0) / configs.length;
    const label = filter.padEnd(10);
    const exp = (avgExpectancy >= 0 ? '+' : '') + avgExpectancy.toFixed(3);
    console.log(`  ${label}     Avg Expectancy: ${exp}R`);
  }

  console.log('\n🚪 EXIT STRATEGI:');
  for (const exit of EXIT_STRATEGIES) {
    const configs = results.filter(r => r.exitStrategy === exit);
    const avgExpectancy = configs.reduce((sum, r) => sum + r.stats.expectancy, 0) / configs.length;
    const label = exit.padEnd(10);
    const exp = (avgExpectancy >= 0 ? '+' : '') + avgExpectancy.toFixed(3);
    console.log(`  ${label}     Avg Expectancy: ${exp}R`);
  }

  // ============================================
  // BÄSTA KONFIGURATION DETALJER
  // ============================================

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🥇 ABSOLUT BÄSTA KONFIGURATION\n');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Max Hålltid:             ${best.maxHold === 999 ? 'Ingen timeout' : `${best.maxHold} dagar`}`);
  console.log(`Entry Filter:            ${best.entryFilter}`);
  console.log(`Exit Strategi:           ${best.exitStrategy}`);
  console.log(`\nResultat:`);
  console.log(`  Total Trades:          ${best.stats.totalTrades}`);
  console.log(`  Vinnare:               ${best.stats.winners} (${best.stats.winRate.toFixed(1)}%)`);
  console.log(`  Förlorare:             ${best.stats.losers} (${(100 - best.stats.winRate).toFixed(1)}%)`);
  console.log(`  \n  Genomsnittlig R:       ${best.stats.avgR >= 0 ? '+' : ''}${best.stats.avgR.toFixed(2)}R`);
  console.log(`  Total R:               ${best.stats.totalR >= 0 ? '+' : ''}${best.stats.totalR.toFixed(1)}R`);
  console.log(`  Profit Factor:         ${best.stats.profitFactor === Infinity ? '∞' : best.stats.profitFactor.toFixed(2)}`);
  console.log(`  Expectancy:            ${best.stats.expectancy >= 0 ? '+' : ''}${best.stats.expectancy.toFixed(3)}R`);
  console.log('─────────────────────────────────────────────────────────');

  // ============================================
  // REKOMMENDATION
  // ============================================

  console.log('\n💡 REKOMMENDATION\n');

  if (best.stats.expectancy > 0.2) {
    console.log(`✅ Stark positiv expectancy (+${best.stats.expectancy.toFixed(3)}R)!`);
    console.log('   Denna konfiguration är lovande och bör användas i appen.');
  } else if (best.stats.expectancy > 0) {
    console.log(`⚠️  Svag positiv expectancy (+${best.stats.expectancy.toFixed(3)}R).`);
    console.log('   Konfigurationen kan fungera men är marginell.');
  } else {
    console.log(`❌ Ingen konfiguration visar positiv expectancy (bäst: ${best.stats.expectancy.toFixed(3)}R).`);
    console.log('   Strategin behöver fundamentala förändringar eller passar inte marknadsmiljön.');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
