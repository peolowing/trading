/**
 * Backtest Comparison: Mid-Cap vs Small-Cap
 *
 * Testar 20 mid-cap och 20 small-cap separat
 * för att jämföra strategins prestanda per marknadssegment
 *
 * KÖRNING:
 * node scripts/backtest-midcap-vs-smallcap.js
 */

import yahooFinance from 'yahoo-finance2';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// ============================================
// KONFIGURATION
// ============================================

const MID_CAP_STOCKS = [
  'ESSITY-B.ST',   // Essity B
  'INVE-B.ST',     // Investor B
  'KINV-B.ST',     // Kinnevik B
  'ELUX-B.ST',     // Electrolux B
  'SKF-B.ST',      // SKF B
  'SSAB-A.ST',     // SSAB A
  'BOL.ST',        // Boliden
  'TELIA.ST',      // Telia
  'NIBE-B.ST',     // NIBE B
  'ALFA.ST',       // Alfa Laval
  'GETI-B.ST',     // Getinge B
  'EPI-B.ST',      // Epiroc B
  'HUSQ-B.ST',     // Husqvarna B
  'INDU-A.ST',     // Industrivärden A
  'LUND-B.ST',     // Lundin Mining
  'MSON-B.ST',     // Millicom (Tigo)
  'NDA-SE.ST',     // Nordea
  'SECU-B.ST',     // Securitas B
  'SHB-A.ST',      // Handelsbanken A
  'SWMA.ST'        // Swedish Match (Philip Morris)
];

const SMALL_CAP_STOCKS = [
  'AXFO.ST',       // Axfood
  'BIL.ST',        // Billerud
  'CAST.ST',       // Castellum
  'FABG.ST',       // Fabege
  'HEBA-B.ST',     // Heba
  'HUFV-A.ST',     // Hufvudstaden A
  'LIFCO-B.ST',    // Lifco B
  'LOOMIS.ST',     // Loomis
  'MYCR.ST',       // Mycronic
  'NCC-B.ST',      // NCC B
  'PEAB-B.ST',     // PEAB B
  'SWEC-B.ST',     // Sweco B
  'TREL-B.ST',     // Trelleborg B
  'WALL-B.ST',     // Wallenstam B
  'WIHL.ST',       // Wihlborgs
  'ASSA-B.ST',     // Note: Moved to small for diversity
  'BETCO.ST',      // Betsson
  'ELUX-B.ST',     // Note: Duplicate, will be replaced
  'HOLM-B.ST',     // Holmen B
  'KINV-B.ST'      // Note: Duplicate, will be replaced
];

// Fix duplicates in SMALL_CAP
const SMALL_CAP_FIXED = [
  'AXFO.ST',
  'BIL.ST',
  'CAST.ST',
  'FABG.ST',
  'HEBA-B.ST',
  'HUFV-A.ST',
  'LIFCO-B.ST',
  'LOOMIS.ST',
  'MYCR.ST',
  'NCC-B.ST',
  'PEAB-B.ST',
  'SWEC-B.ST',
  'TREL-B.ST',
  'WALL-B.ST',
  'WIHL.ST',
  'BETCO.ST',
  'HOLM-B.ST',
  'CATE.ST',       // Cloetta
  'DUST.ST',       // Dustin Group
  'INDT.ST'        // Indutrade
];

const MONTHS_BACK = 5;
const ATR_PERIOD = 14;
const ATR_MULTIPLIER = 2.0;
const RR_RATIO = 1.5;

// Test bara de bästa konfigurationerna från tidigare test
const TEST_CONFIGS = [
  { maxHold: 15, entryFilter: 'NONE', exitStrategy: 'FIXED' },
  { maxHold: 15, entryFilter: 'VOLUME', exitStrategy: 'FIXED' },
  { maxHold: 30, entryFilter: 'VOLUME', exitStrategy: 'FIXED' }
];

// ============================================
// TEKNISKA INDIKATORER (SAMMA SOM TIDIGARE)
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
  for (let i = 0; i < period; i++) sum += tr[i];
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

function calculateRelativeVolume(candles, index, period = 20) {
  if (index < period) return 1;
  let avgVolume = 0;
  for (let i = index - period; i < index; i++) {
    avgVolume += candles[i].volume;
  }
  avgVolume /= period;
  return candles[index].volume / avgVolume;
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
  }

  return setupType;
}

function simulateTrade(candles, entryIndex, entry, stop, target, direction, maxHoldDays, exitStrategy) {
  const maxExitIndex = Math.min(entryIndex + maxHoldDays, candles.length - 1);
  const risk = direction === 'LONG' ? (entry - stop) : (stop - entry);

  for (let i = entryIndex + 1; i <= maxExitIndex; i++) {
    const candle = candles[i];

    if (direction === 'LONG') {
      if (candle.low <= stop) {
        const exitR = (stop - entry) / risk;
        return {
          exitIndex: i,
          exitPrice: stop,
          exitReason: 'STOP',
          daysHeld: i - entryIndex,
          rMultiple: exitR
        };
      }

      if (candle.high >= target) {
        const targetR = (target - entry) / risk;
        return {
          exitIndex: i,
          exitPrice: target,
          exitReason: 'TARGET',
          daysHeld: i - entryIndex,
          rMultiple: targetR
        };
      }
    } else if (direction === 'SHORT') {
      if (candle.high >= stop) {
        const exitR = (entry - stop) / risk;
        return {
          exitIndex: i,
          exitPrice: stop,
          exitReason: 'STOP',
          daysHeld: i - entryIndex,
          rMultiple: exitR
        };
      }

      if (candle.low <= target) {
        const targetR = (entry - target) / risk;
        return {
          exitIndex: i,
          exitPrice: target,
          exitReason: 'TARGET',
          daysHeld: i - entryIndex,
          rMultiple: targetR
        };
      }
    }
  }

  const exitCandle = candles[maxExitIndex];
  const pnl = direction === 'LONG' ? (exitCandle.close - entry) : (entry - exitCandle.close);
  const exitR = pnl / risk;

  return {
    exitIndex: maxExitIndex,
    exitPrice: exitCandle.close,
    exitReason: 'TIMEOUT',
    daysHeld: maxExitIndex - entryIndex,
    rMultiple: exitR
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
        rMultiple: result.rMultiple
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
  console.log('║       MID-CAP VS SMALL-CAP COMPARISON                  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`📊 Mid-Cap aktier: ${MID_CAP_STOCKS.length}`);
  console.log(`📊 Small-Cap aktier: ${SMALL_CAP_FIXED.length}`);
  console.log(`📅 Period: ${MONTHS_BACK} månader tillbaka\n`);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - MONTHS_BACK);

  // ============================================
  // HÄMTA MID-CAP DATA
  // ============================================

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📈 HÄMTAR MID-CAP DATA\n');

  const midCapData = [];

  for (const ticker of MID_CAP_STOCKS) {
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

      midCapData.push({ ticker, candles });
      console.log(`✓ ${ticker}: ${candles.length} dagar`);
    } catch (error) {
      console.log(`❌ ${ticker}: ${error.message}`);
    }
  }

  // ============================================
  // HÄMTA SMALL-CAP DATA
  // ============================================

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📉 HÄMTAR SMALL-CAP DATA\n');

  const smallCapData = [];

  for (const ticker of SMALL_CAP_FIXED) {
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

      smallCapData.push({ ticker, candles });
      console.log(`✓ ${ticker}: ${candles.length} dagar`);
    } catch (error) {
      console.log(`❌ ${ticker}: ${error.message}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ============================================
  // KÖR BACKTESTS
  // ============================================

  console.log('Kör backtests...\n');

  const midCapResults = [];
  const smallCapResults = [];

  for (const config of TEST_CONFIGS) {
    console.log(`Testar: ${config.maxHold}d | ${config.entryFilter} | ${config.exitStrategy}`);

    // Mid-Cap
    let midCapTrades = [];
    for (const { ticker, candles } of midCapData) {
      const trades = backtestStock(ticker, candles, config.maxHold, config.entryFilter, config.exitStrategy);
      midCapTrades = midCapTrades.concat(trades);
    }
    const midCapStats = calculateStats(midCapTrades);
    midCapResults.push({ config, stats: midCapStats });

    // Small-Cap
    let smallCapTrades = [];
    for (const { ticker, candles } of smallCapData) {
      const trades = backtestStock(ticker, candles, config.maxHold, config.entryFilter, config.exitStrategy);
      smallCapTrades = smallCapTrades.concat(trades);
    }
    const smallCapStats = calculateStats(smallCapTrades);
    smallCapResults.push({ config, stats: smallCapStats });

    console.log(`  Mid-Cap:   ${midCapStats.totalTrades} trades, ${midCapStats.expectancy >= 0 ? '+' : ''}${midCapStats.expectancy.toFixed(3)}R`);
    console.log(`  Small-Cap: ${smallCapStats.totalTrades} trades, ${smallCapStats.expectancy >= 0 ? '+' : ''}${smallCapStats.expectancy.toFixed(3)}R\n`);
  }

  // ============================================
  // JÄMFÖRELSETABELL
  // ============================================

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📊 JÄMFÖRELSE: MID-CAP VS SMALL-CAP\n');
  console.log('─────────────────────────────────────────────────────────────────────────────────────────────');
  console.log('Konfiguration                      Mid-Cap                        Small-Cap');
  console.log('                            Trades Win%  Exp       Trades Win%  Exp');
  console.log('─────────────────────────────────────────────────────────────────────────────────────────────');

  for (let i = 0; i < TEST_CONFIGS.length; i++) {
    const config = TEST_CONFIGS[i];
    const midStats = midCapResults[i].stats;
    const smallStats = smallCapResults[i].stats;

    const configName = `${config.maxHold}d ${config.entryFilter} ${config.exitStrategy}`.padEnd(27);

    const midTrades = midStats.totalTrades.toString().padStart(6);
    const midWin = midStats.winRate.toFixed(1).padStart(4);
    const midExp = (midStats.expectancy >= 0 ? '+' : '') + midStats.expectancy.toFixed(3).padStart(7);

    const smallTrades = smallStats.totalTrades.toString().padStart(6);
    const smallWin = smallStats.winRate.toFixed(1).padStart(4);
    const smallExp = (smallStats.expectancy >= 0 ? '+' : '') + smallStats.expectancy.toFixed(3).padStart(7);

    console.log(`${configName}  ${midTrades} ${midWin}% ${midExp}R     ${smallTrades} ${smallWin}% ${smallExp}R`);
  }

  console.log('─────────────────────────────────────────────────────────────────────────────────────────────');

  // ============================================
  // BÄSTA KONFIGURATION PER SEGMENT
  // ============================================

  const bestMidCap = [...midCapResults].sort((a, b) => b.stats.expectancy - a.stats.expectancy)[0];
  const bestSmallCap = [...smallCapResults].sort((a, b) => b.stats.expectancy - a.stats.expectancy)[0];

  console.log('\n🏆 BÄSTA KONFIGURATION PER SEGMENT\n');
  console.log('─────────────────────────────────────────────────────────');
  console.log('MID-CAP:');
  console.log(`  Config:        ${bestMidCap.config.maxHold}d | ${bestMidCap.config.entryFilter} | ${bestMidCap.config.exitStrategy}`);
  console.log(`  Trades:        ${bestMidCap.stats.totalTrades}`);
  console.log(`  Win Rate:      ${bestMidCap.stats.winRate.toFixed(1)}%`);
  console.log(`  Avg R:         ${bestMidCap.stats.avgR >= 0 ? '+' : ''}${bestMidCap.stats.avgR.toFixed(2)}R`);
  console.log(`  Total R:       ${bestMidCap.stats.totalR >= 0 ? '+' : ''}${bestMidCap.stats.totalR.toFixed(1)}R`);
  console.log(`  Expectancy:    ${bestMidCap.stats.expectancy >= 0 ? '+' : ''}${bestMidCap.stats.expectancy.toFixed(3)}R`);

  console.log('\nSMALL-CAP:');
  console.log(`  Config:        ${bestSmallCap.config.maxHold}d | ${bestSmallCap.config.entryFilter} | ${bestSmallCap.config.exitStrategy}`);
  console.log(`  Trades:        ${bestSmallCap.stats.totalTrades}`);
  console.log(`  Win Rate:      ${bestSmallCap.stats.winRate.toFixed(1)}%`);
  console.log(`  Avg R:         ${bestSmallCap.stats.avgR >= 0 ? '+' : ''}${bestSmallCap.stats.avgR.toFixed(2)}R`);
  console.log(`  Total R:       ${bestSmallCap.stats.totalR >= 0 ? '+' : ''}${bestSmallCap.stats.totalR.toFixed(1)}R`);
  console.log(`  Expectancy:    ${bestSmallCap.stats.expectancy >= 0 ? '+' : ''}${bestSmallCap.stats.expectancy.toFixed(3)}R`);
  console.log('─────────────────────────────────────────────────────────');

  // ============================================
  // SLUTSATSER
  // ============================================

  console.log('\n💡 SLUTSATSER\n');

  const midCapBestExp = bestMidCap.stats.expectancy;
  const smallCapBestExp = bestSmallCap.stats.expectancy;

  if (midCapBestExp > smallCapBestExp + 0.05) {
    console.log('✅ MID-CAP presterar BETYDLIGT BÄTTRE än small-cap');
    console.log(`   Skillnad: ${(midCapBestExp - smallCapBestExp).toFixed(3)}R i expectancy`);
  } else if (smallCapBestExp > midCapBestExp + 0.05) {
    console.log('✅ SMALL-CAP presterar BETYDLIGT BÄTTRE än mid-cap');
    console.log(`   Skillnad: ${(smallCapBestExp - midCapBestExp).toFixed(3)}R i expectancy`);
  } else {
    console.log('⚖️  MID-CAP och SMALL-CAP presterar LIKNANDE');
    console.log(`   Skillnad: ${Math.abs(midCapBestExp - smallCapBestExp).toFixed(3)}R i expectancy`);
  }

  if (midCapBestExp > 0 && smallCapBestExp > 0) {
    console.log('\n✅ Båda segmenten visar POSITIV expectancy');
    console.log('   Strategin fungerar på både mid-cap och small-cap');
  } else if (midCapBestExp > 0) {
    console.log('\n⚠️  Endast MID-CAP visar positiv expectancy');
    console.log('   Strategin bör fokusera på mid-cap aktier');
  } else if (smallCapBestExp > 0) {
    console.log('\n⚠️  Endast SMALL-CAP visar positiv expectancy');
    console.log('   Strategin bör fokusera på small-cap aktier');
  } else {
    console.log('\n❌ VARKEN mid-cap eller small-cap visar positiv expectancy');
    console.log('   Strategin behöver justeras för denna period');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
