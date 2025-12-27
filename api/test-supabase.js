import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.json({ error: 'Missing env vars', hasUrl: !!supabaseUrl, hasKey: !!supabaseKey });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to write a test entry
    const testData = {
      ticker: 'TEST',
      date: new Date().toISOString().split('T')[0],
      candles: [{ test: 'data' }],
      ema20: [1, 2, 3],
      ema50: [1, 2, 3],
      rsi14: [50, 51, 52],
      atr14: [1, 1, 1],
      indicators: { test: true }
    };

    const { data, error } = await supabase
      .from('indicators')
      .upsert(testData, { onConflict: 'ticker,date' })
      .select();

    if (error) {
      return res.json({ success: false, error: error.message, code: error.code, details: error.details });
    }

    return res.json({ success: true, data });
  } catch (e) {
    return res.json({ success: false, error: e.message, stack: e.stack });
  }
}
