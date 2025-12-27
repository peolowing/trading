import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Try to get one row to see the structure
const { data, error } = await supabase
  .from('indicators')
  .select('*')
  .limit(1);

if (error) {
  console.error('Error:', error);
} else if (data && data.length > 0) {
  console.log('Existing columns:', Object.keys(data[0]));
  console.log('\nSample data:');
  console.log(JSON.stringify(data[0], null, 2));
} else {
  console.log('No data in table - checking what columns exist by trying to insert...');
}
