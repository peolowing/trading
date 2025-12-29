import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
);

async function runMigration() {
  console.log('🔧 Running migration: add bucket column...\n');

  // Read SQL file
  const sql = fs.readFileSync('./scripts/add-bucket-column.sql', 'utf8');

  // Execute SQL
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    // If exec_sql function doesn't exist, try alternative approach
    console.log('⚠️  exec_sql function not available');
    console.log('Please run this SQL manually in Supabase SQL Editor:');
    console.log('----------------------------------------');
    console.log(sql);
    console.log('----------------------------------------');
    return;
  }

  console.log('✅ Migration completed successfully!');
}

runMigration()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
