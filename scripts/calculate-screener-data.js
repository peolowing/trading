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
  let strength = 0;
  const { ema20, ema50, ema50_slope, rsi14, relativeVolume } = features;
  const lastClose = candles[candles.length - 1].close;

  // Trend strength (0-30 points)
  if (ema20 > ema50 && lastClose > ema20) {
    strength += 15;
    if (ema50_slope > 0.002) strength += 10;
    else if (ema50_slope > 0.001) strength += 5;
  }

  // RSI zone (0-25 points)
  if (rsi14 >= 40 && rsi14 <= 60) strength += 25;
  else if (rsi14 >= 30 && rsi14 <= 70) strength += 15;
  else if (rsi14 >= 30 && rsi14 <= 50) strength += 5;

  // Volume (0-20 points)
  if (relativeVolume >= 1.5) strength += 20;
  else if (relativeVolume >= 1.2) strength += 15;
  else if (relativeVolume >= 1.0) strength += 10;
  else if (relativeVolume >= 0.8) strength += 5;

  // Pullback setup bonus (0-15 points)
  const distEma20Pct = ((lastClose - ema20) / ema20) * 100;
  if (distEma20Pct >= -1 && distEma20Pct <= 2 && rsi14 >= 40 && rsi14 <= 60) {
    strength += 15;
  }

  // Bucket adjustment (0-10 points)
  if (bucket === "LARGE_CAP") strength += 10;
  else if (bucket === "MID_CAP") strength += 5;

  return Math.min(100, strength);
}

function computeFeatures(candles) {
  const closes = candles.map(c => c.close);
  const ema20Result = EMA.calculate({ period: 20, values: closes });
  const ema50Result = EMA.calculate({ period: 50, values: closes });
  const rsi14Result = RSI.calculate({ period: 14, values: closes });

  const ema20 = ema20Result[ema20Result.length - 1];
  const ema50 = ema50Result[ema50Result.length - 1];
  const ema50_prev = ema50Result[ema50Result.length - 2];
  const ema50_slope = (ema50 - ema50_prev) / ema50_prev;
  const rsi14 = rsi14Result[rsi14Result.length - 1];

  const volumes = candles.map(c => c.volume);
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const relativeVolume = avgVolume > 0 ? volumes[volumes.length - 1] / avgVolume : 1;

  return { ema20, ema50, ema50_slope, rsi14, relativeVolume };
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
      const closes = candles.map(c => c.close);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const volumes = candles.map(c => c.volume);

      const atr14Result = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
      const lastAtr = atr14Result[atr14Result.length - 1];
      const lastClose = closes[closes.length - 1];
      const lastVolume = volumes[volumes.length - 1];

      // Determine regime
      let regime = "Consolidation";
      if (features.ema20 > features.ema50 && lastClose > features.ema20) {
        regime = "Bullish Trend";
      } else if (features.ema20 < features.ema50 && lastClose < features.ema20) {
        regime = "Bearish Trend";
      }

      // Detect setup
      const setup = detectStrategy({
        ema20: features.ema20,
        ema50: features.ema50,
        rsi14: features.rsi14,
        relativeVolume: features.relativeVolume,
        regime,
        close: lastClose,
        high: highs[highs.length - 1],
        low: lows[lows.length - 1]
      });

      // Calculate edge score
      const edgeScore = computeRanking(features, candles, stock.bucket);

      // Calculate turnover
      const turnoverMSEK = (lastClose * lastVolume) / 1_000_000;

      // Update database
      const { error: updateError } = await supabase
        .from('screener_stocks')
        .update({
          price: parseFloat(lastClose.toFixed(2)),
          ema20: parseFloat(features.ema20.toFixed(2)),
          ema50: parseFloat(features.ema50.toFixed(2)),
          rsi: parseFloat(features.rsi14.toFixed(2)),
          atr: parseFloat(lastAtr.toFixed(2)),
          relative_volume: parseFloat(features.relativeVolume.toFixed(2)),
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
