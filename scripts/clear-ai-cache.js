import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearAICache(ticker) {
  try {
    if (ticker) {
      // Clear for specific ticker
      const { error } = await supabase
        .from('ai_analysis')
        .delete()
        .eq('ticker', ticker);

      if (error) throw error;
      console.log(`✅ Cleared AI analysis cache for ${ticker}`);
    } else {
      // Clear all (use with caution!)
      const { error } = await supabase
        .from('ai_analysis')
        .delete()
        .neq('ticker', ''); // Delete all non-empty tickers (essentially all)

      if (error) throw error;
      console.log(`✅ Cleared ALL AI analysis cache`);
    }
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    process.exit(1);
  }
}

// Get ticker from command line argument
const ticker = process.argv[2];

if (!ticker) {
  console.log('Usage: node scripts/clear-ai-cache.js <TICKER>');
  console.log('Example: node scripts/clear-ai-cache.js SHB-A.ST');
  process.exit(1);
}

clearAICache(ticker);
