// Migration endpoint - run once to add cache columns
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Security: require a secret key
  if (req.headers.authorization !== `Bearer ${process.env.SUPABASE_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Missing Supabase credentials' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test if columns already exist by trying to insert
    const testRecord = {
      ticker: '_MIGRATION_TEST',
      date: new Date().toISOString().split('T')[0],
      ema20: 0,
      ema50: 0,
      rsi14: 0,
      atr14: 0,
      relative_volume: 0,
      regime: 'TEST',
      setup: 'TEST',
      candles: [{ test: true }],
      ema20_series: [1],
      ema50_series: [1],
      rsi14_series: [1],
      atr14_series: [1],
      indicators_data: { test: true }
    };

    const { error } = await supabase
      .from('indicators')
      .insert(testRecord);

    if (error) {
      return res.json({
        success: false,
        message: 'Columns need to be added manually',
        error: error.message,
        sql: `
-- Run this SQL in Supabase SQL Editor:

ALTER TABLE indicators
ADD COLUMN IF NOT EXISTS candles JSONB,
ADD COLUMN IF NOT EXISTS ema20_series JSONB,
ADD COLUMN IF NOT EXISTS ema50_series JSONB,
ADD COLUMN IF NOT EXISTS rsi14_series JSONB,
ADD COLUMN IF NOT EXISTS atr14_series JSONB,
ADD COLUMN IF NOT EXISTS indicators_data JSONB;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_indicators_ticker_date ON indicators(ticker, date);
        `
      });
    }

    // Clean up test record
    await supabase
      .from('indicators')
      .delete()
      .eq('ticker', '_MIGRATION_TEST');

    return res.json({
      success: true,
      message: 'Schema already supports cache columns!'
    });

  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e.message
    });
  }
}
