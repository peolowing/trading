/**
 * Migration: Remove UNIQUE constraint from ai_analysis table
 * This allows multiple AI analyses per day for the same ticker
 *
 * Run with: node scripts/migrate-ai-analysis.js
 */

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;

if (!supabaseUrl) {
  console.error('❌ Missing SUPABASE_URL in .env.local');
  process.exit(1);
}

// Extract database connection details from Supabase URL
// Format: https://[project-ref].supabase.co
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

console.log('⚠️  This script requires direct database access.');
console.log('📝 Please run the following SQL manually in Supabase Dashboard → SQL Editor:\n');
console.log('━'.repeat(70));
console.log(`
-- Step 1: Drop UNIQUE constraint
ALTER TABLE ai_analysis
DROP CONSTRAINT IF EXISTS ai_analysis_ticker_analysis_date_key;

-- Step 2: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_ai_analysis_ticker_date_created
ON ai_analysis(ticker, analysis_date, created_at DESC);

-- Step 3: Verify (optional)
SELECT
  COUNT(*) as total_analyses,
  COUNT(DISTINCT ticker) as unique_tickers,
  COUNT(DISTINCT analysis_date) as unique_dates
FROM ai_analysis;
`);
console.log('━'.repeat(70));
console.log('\n✨ After running the SQL, test by:');
console.log('   1. Open a stock in the app (e.g. ERIC-B.ST)');
console.log('   2. Click "🔄 Ny analys"');
console.log('   3. Wait for analysis to complete');
console.log('   4. Click "🔄 Ny analys" again');
console.log('   5. You should see the orange diff box! 📊\n');
console.log(`🔗 Go to: https://supabase.com/dashboard/project/${projectRef}/sql/new\n`);
