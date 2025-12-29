import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
);

async function runMigration() {
  console.log('🔧 Running migration: add trading_agents tables...\n');

  // Read SQL file
  const sql = fs.readFileSync('./scripts/add-trading-agents.sql', 'utf8');

  console.log('📝 SQL to execute:');
  console.log('----------------------------------------');
  console.log(sql);
  console.log('----------------------------------------\n');

  console.log('⚠️  Please run this SQL manually in Supabase SQL Editor');
  console.log('   1. Open Supabase Dashboard → SQL Editor');
  console.log('   2. Create a new query');
  console.log('   3. Copy the SQL above');
  console.log('   4. Execute the query\n');

  // Try to verify if tables exist (won't create them)
  try {
    const { data, error } = await supabase
      .from('trading_agents')
      .select('count')
      .limit(1);

    if (!error) {
      console.log('✅ trading_agents table already exists!');

      const { data: agents } = await supabase
        .from('trading_agents')
        .select('*');

      if (agents && agents.length > 0) {
        console.log(`\n📊 Found ${agents.length} trading agents:`);
        agents.forEach(agent => {
          console.log(`  - ${agent.name} (${agent.type}) - ${agent.enabled ? 'Enabled' : 'Disabled'}`);
        });
      } else {
        console.log('\n⚠️  No agents found in database. Run the SQL migration first.');
      }
    } else {
      console.log('\n⚠️  trading_agents table does not exist yet. Run the SQL migration first.');
    }
  } catch (err) {
    console.log('\n⚠️  Could not verify tables:', err.message);
  }
}

runMigration()
  .then(() => {
    console.log('\n✅ Migration script completed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
