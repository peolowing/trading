import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function updateSchema() {
  console.log('Updating database schema...');

  // Using Supabase SQL editor equivalent - we'll use raw SQL
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      -- Add JSONB columns for cache data
      ALTER TABLE indicators
      ADD COLUMN IF NOT EXISTS candles JSONB,
      ADD COLUMN IF NOT EXISTS ema20_series JSONB,
      ADD COLUMN IF NOT EXISTS ema50_series JSONB,
      ADD COLUMN IF NOT EXISTS rsi14_series JSONB,
      ADD COLUMN IF NOT EXISTS atr14_series JSONB,
      ADD COLUMN IF NOT EXISTS indicators_data JSONB;
    `
  });

  if (error) {
    console.error('RPC not available, trying direct approach...');

    // Alternative: Insert a test record with new structure
    const testData = {
      ticker: '_SCHEMA_TEST',
      date: new Date().toISOString().split('T')[0],
      ema20: 0,
      ema50: 0,
      rsi14: 0,
      atr14: 0,
      relative_volume: 0,
      regime: 'TEST',
      setup: 'TEST',
      candles: [{ test: 'data' }],
      ema20_series: [1, 2, 3],
      ema50_series: [1, 2, 3],
      rsi14_series: [50, 51],
      atr14_series: [1, 1],
      indicators_data: { test: true }
    };

    const { error: insertError } = await supabase
      .from('indicators')
      .upsert(testData, { onConflict: 'ticker,date' });

    if (insertError) {
      console.error('Schema update needed. Error:', insertError.message);
      console.log('\nPlease run this SQL in Supabase SQL Editor:');
      console.log(`
ALTER TABLE indicators
ADD COLUMN IF NOT EXISTS candles JSONB,
ADD COLUMN IF NOT EXISTS ema20_series JSONB,
ADD COLUMN IF NOT EXISTS ema50_series JSONB,
ADD COLUMN IF NOT EXISTS rsi14_series JSONB,
ADD COLUMN IF NOT EXISTS atr14_series JSONB,
ADD COLUMN IF NOT EXISTS indicators_data JSONB;
      `);
    } else {
      console.log('Schema appears to support new columns!');
      // Clean up test data
      await supabase
        .from('indicators')
        .delete()
        .eq('ticker', '_SCHEMA_TEST');
    }
  } else {
    console.log('Schema updated successfully!');
  }
}

updateSchema();
