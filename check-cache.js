import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
);

// Check today's cache
const today = new Date().toISOString().split('T')[0];
console.log(`Today: ${today}`);

const { data, error } = await supabase
  .from('indicators')
  .select('ticker, date')
  .eq('date', today)
  .order('ticker');

if (error) {
  console.error('Error:', error);
} else {
  console.log(`\nCached entries for ${today}:`);
  console.table(data);
  console.log(`\nTotal entries today: ${data.length}`);
}

// Also check all entries
const { data: all } = await supabase
  .from('indicators')
  .select('ticker, date')
  .order('date', { ascending: false })
  .limit(10);

console.log('\nAll recent entries:');
console.table(all);
