/**
 * Calculate and save screener technical data
 * Run this daily to update screener_stocks table with fresh indicators
 *
 * Usage: node scripts/calculate-screener-data.js
 */

import { createClient } from '@supabase/supabase-js';
import yahooFinance from 'yahoo-finance2';
import dayjs from 'dayjs';
import { EMA, RSI, ATR } from 'technicalindicators';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
);

// Helper functions from server.js
function passesVolumeFilter(candles) {
  const recent = candles.slice(-20);
  const avgVolume = recent.reduce((sum, c) => sum + c.volume, 0) / recent.length;
  const lastClose = candles[candles.length - 1].close;
  const avgTurnover = (avgVolume * lastClose) / 1_000_000;

  return avgTurnover >= 10;
}

function detectStrategy(indicators) {
  const { ema20, ema50, rsi14, relativeVolume, regime, close } = indicators;

  if (regime === "Bullish Trend") {
    const distEma20Pct = ((close - ema20) / ema20) * 100;
    if (distEma20Pct >= -1 && distEma20Pct <= 2 && rsi14 >= 40 && rsi14 <= 60) {
      return "Pullback";
    }
    if (rsi14 >= 60 && relativeVolume >= 1.5) {
      return "Breakout";
    }
    return "Trend Following";
  }

  if (regime === "Consolidation") {
    if (rsi14 <= 35) return "Oversold Bounce";
    if (rsi14 >= 65) return "Overbought";
    return "Range Bound";
  }

  return "Hold";
}

function computeRanking(features, candles, bucket) {
  let score = 0;

  // 1. Liquidity (30 pts) - justerat för mid-cap
  const last = candles.at(-1);
  const turnoverM = (last.close * last.volume) / 1_000_000;
  if (turnoverM > 200) score += 30;      // Large-cap
  else if (turnoverM > 100) score += 25; // Large-cap
  else if (turnoverM > 50) score += 20;  // Large/Mid-cap
  else if (turnoverM > 30) score += 15;  // Mid-cap
  else if (turnoverM > 15) score += 10;  // Mid-cap

  // 2. Trend (30 pts) - ÖKA BETYDELSE från 15→18 baspoäng
  if (features.regime === "UPTREND") {
    score += 18; // Istället för 15
    if (features.slope > 0.05) score += 12; // Istället för 10
    else if (features.slope > 0) score += 6; // Istället för 5
  } else {
    if (features.slope < -0.05) score -= 5; // penalize strong downtrend
  }

  // 3. Volatility (20 pts) - prefer moderate ATR/price
  const atrPct = features.atr14 / features.close;
  if (atrPct >= 0.02 && atrPct <= 0.05) score += 20; // sweet spot
  else if (atrPct > 0.05) score += 10; // high volatility ok
  else score += 5; // low volatility less interesting

  // STEG 2: Straffa Mid Cap med låg ATR
  if (bucket === "MID_CAP" && atrPct < 0.018) {
    score -= 10;
  }

  // 4. Momentum (20 pts)
  if (features.rsi14 >= 40 && features.rsi14 <= 60) score += 15; // neutral/bullish
  else if (features.rsi14 > 60 && features.rsi14 <= 70) score += 10; // strong but not overbought
  else if (features.rsi14 < 30) score += 5; // oversold = potential

  if (features.relVol > 1.3) score += 5; // above-average volume

  return Math.max(0, Math.min(100, score));
}

function computeFeatures(candles) {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  const ema20 = EMA.calculate({ period: 20, values: closes }).at(-1);
  const ema50 = EMA.calculate({ period: 50, values: closes }).at(-1);
  const rsi14 = RSI.calculate({ period: 14, values: closes }).at(-1);
  const atr14 = ATR.calculate({ period: 14, high: highs, low: lows, close: closes }).at(-1);

  const close = closes.at(-1);
  const avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const relVol = volumes.at(-1) / avgVol20;

  const regime = ema20 > ema50 ? "UPTREND" : "DOWNTREND";

  // EMA20 slope (change over last 10 days)
  const ema20Series = EMA.calculate({ period: 20, values: closes });
  const slope = ema20Series.length >= 10
    ? (ema20Series.at(-1) - ema20Series.at(-10)) / ema20Series.at(-10)
    : 0;

  return { ema20, ema50, rsi14, atr14, close, relVol, regime, slope };
}

async function calculateScreenerData() {
  console.log('🔄 Starting screener data calculation...\n');

  const today = dayjs().format('YYYY-MM-DD');
  const startDate = dayjs().subtract(1, 'year').format('YYYY-MM-DD');

  // Get all active stocks
  const { data: stocks, error: fetchError } = await supabase
    .from('screener_stocks')
    .select('*')
    .eq('is_active', true);

  if (fetchError) {
    console.error('❌ Failed to fetch stocks:', fetchError);
    return;
  }

  if (!stocks || stocks.length === 0) {
    console.log('⚠️  No active stocks found in screener_stocks table');
    return;
  }

  console.log(`📊 Processing ${stocks.length} stocks...\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const stock of stocks) {
    try {
      console.log(`Processing ${stock.ticker}...`);

      // Fetch data from Yahoo Finance
      const data = await yahooFinance.historical(stock.ticker, {
        period1: startDate,
        interval: '1d'
      });

      if (!data || data.length < 50) {
        console.log(`  ⚠️  Insufficient data (${data?.length || 0} candles)`);
        skipped++;
        continue;
      }

      const candles = data.map(d => ({
        date: dayjs(d.date).format('YYYY-MM-DD'),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume
      }));

      // Apply volume filter
      if (!passesVolumeFilter(candles)) {
        console.log(`  ⚠️  Failed volume filter`);
        skipped++;
        continue;
      }

      // Calculate indicators
      const features = computeFeatures(candles);
      const volumes = candles.map(c => c.volume);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);

      const lastVolume = volumes[volumes.length - 1];

      // Determine regime (map from UPTREND/DOWNTREND to UI format)
      let regime = "Consolidation";
      if (features.regime === "UPTREND") {
        regime = "Bullish Trend";
      } else if (features.regime === "DOWNTREND") {
        regime = "Bearish Trend";
      }

      // Detect setup
      const setup = detectStrategy({
        ema20: features.ema20,
        ema50: features.ema50,
        rsi14: features.rsi14,
        relativeVolume: features.relVol,
        regime,
        close: features.close,
        high: highs[highs.length - 1],
        low: lows[lows.length - 1]
      });

      // Calculate edge score
      const edgeScore = computeRanking(features, candles, stock.bucket);

      // Calculate turnover
      const turnoverMSEK = (features.close * lastVolume) / 1_000_000;

      // Update database
      const { error: updateError } = await supabase
        .from('screener_stocks')
        .update({
          price: parseFloat(features.close.toFixed(2)),
          ema20: parseFloat(features.ema20.toFixed(2)),
          ema50: parseFloat(features.ema50.toFixed(2)),
          rsi: parseFloat(features.rsi14.toFixed(2)),
          atr: parseFloat(features.atr14.toFixed(2)),
          relative_volume: parseFloat(features.relVol.toFixed(2)),
          regime,
          setup,
          edge_score: edgeScore,
          volume: lastVolume,
          turnover_msek: parseFloat(turnoverMSEK.toFixed(1)),
          last_calculated: today
        })
        .eq('ticker', stock.ticker);

      if (updateError) {
        console.log(`  ❌ Update failed:`, updateError.message);
        failed++;
      } else {
        console.log(`  ✅ Updated (score: ${edgeScore}, regime: ${regime}, setup: ${setup})`);
        updated++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.log(`  ❌ Error:`, error.message);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📈 Screener calculation complete!');
  console.log('='.repeat(50));
  console.log(`✅ Updated: ${updated}`);
  console.log(`⚠️  Skipped: ${skipped}`);
  console.log(`❌ Failed:  ${failed}`);
  console.log(`📊 Total:   ${stocks.length}`);
}

// Run the calculation
calculateScreenerData()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
