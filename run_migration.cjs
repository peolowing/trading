const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://tqqmnngbjjfnmqbvzeeg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxcW1ubmdiampmbm1xYnZ6ZWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MTIwMDgsImV4cCI6MjA4MjM4ODAwOH0.se3p_egJGzZHgtMn-wda1xIgzewB2P8m9bnVWdJnSZE';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  const sql = fs.readFileSync('add_quote_fields.sql', 'utf8');

  console.log('Running migration to add quote fields...');
  console.log('SQL:', sql);

  // Split by semicolon to run statements separately
  const statements = sql.split(';').filter(s => s.trim());

  for (const statement of statements) {
    if (!statement.trim()) continue;

    console.log(`\nExecuting: ${statement.trim().substring(0, 80)}...`);

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement.trim() });

      if (error) {
        console.error('Error:', error.message);
        // Try using direct query if RPC fails
        console.log('Trying direct approach...');

        // For ALTER TABLE, we need to use the REST API directly
        // This is a limitation - Supabase client doesn't support DDL directly
        console.log('Note: You may need to run this SQL in the Supabase SQL Editor:');
        console.log(statement.trim());
      } else {
        console.log('✓ Success');
      }
    } catch (err) {
      console.error('Exception:', err.message);
      console.log('\nPlease run this SQL manually in Supabase SQL Editor:');
      console.log(statement.trim());
    }
  }

  console.log('\nMigration script completed.');
  console.log('If there were errors, please copy the SQL from add_quote_fields.sql');
  console.log('and run it in the Supabase SQL Editor at:');
  console.log(`${supabaseUrl.replace('.supabase.co', '')}/project/default/sql/new`);
}

runMigration();
