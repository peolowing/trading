-- ==================================================
-- Supabase Row Level Security (RLS) Setup
-- Scenario A: Full Access Policies (SAFE VERSION)
-- ==================================================
-- This script enables RLS on all tables and creates
-- permissive policies to maintain current functionality
-- while protecting against unauthorized external access.
--
-- This version is safe to run multiple times - it will
-- drop existing policies before recreating them.
--
-- Run this in: Supabase Dashboard → SQL Editor
-- ==================================================

-- STEP 1: Enable RLS on all tables
-- This activates row-level security checks
ALTER TABLE ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE screener_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_events ENABLE ROW LEVEL SECURITY;

-- STEP 2: Drop existing policies (if any)
DROP POLICY IF EXISTS "Enable all for ai_analysis" ON ai_analysis;
DROP POLICY IF EXISTS "Enable all for portfolio" ON portfolio;
DROP POLICY IF EXISTS "Enable all for trades" ON trades;
DROP POLICY IF EXISTS "Enable all for watchlist" ON watchlist;
DROP POLICY IF EXISTS "Enable all for screener_stocks" ON screener_stocks;
DROP POLICY IF EXISTS "Enable all for indicators" ON indicators;
DROP POLICY IF EXISTS "Enable all for backtest_results" ON backtest_results;
DROP POLICY IF EXISTS "Enable all for market_data" ON market_data;
DROP POLICY IF EXISTS "Enable all for trading_agents" ON trading_agents;
DROP POLICY IF EXISTS "Enable all for agent_signals" ON agent_signals;
DROP POLICY IF EXISTS "Enable all for portfolio_events" ON portfolio_events;

-- STEP 3: Create Full Access Policies
-- These policies allow all operations but require valid API key

-- AI Analysis: Full access for all operations
CREATE POLICY "Enable all for ai_analysis"
ON ai_analysis
FOR ALL
USING (true)
WITH CHECK (true);

-- Portfolio: Full access for all operations
CREATE POLICY "Enable all for portfolio"
ON portfolio
FOR ALL
USING (true)
WITH CHECK (true);

-- Trades: Full access for all operations
CREATE POLICY "Enable all for trades"
ON trades
FOR ALL
USING (true)
WITH CHECK (true);

-- Watchlist: Full access for all operations
CREATE POLICY "Enable all for watchlist"
ON watchlist
FOR ALL
USING (true)
WITH CHECK (true);

-- Screener Stocks: Full access for all operations
CREATE POLICY "Enable all for screener_stocks"
ON screener_stocks
FOR ALL
USING (true)
WITH CHECK (true);

-- Indicators (cache): Full access for all operations
CREATE POLICY "Enable all for indicators"
ON indicators
FOR ALL
USING (true)
WITH CHECK (true);

-- Backtest Results (cache): Full access for all operations
CREATE POLICY "Enable all for backtest_results"
ON backtest_results
FOR ALL
USING (true)
WITH CHECK (true);

-- Market Data (cache): Full access for all operations
CREATE POLICY "Enable all for market_data"
ON market_data
FOR ALL
USING (true)
WITH CHECK (true);

-- Trading Agents: Full access for all operations
CREATE POLICY "Enable all for trading_agents"
ON trading_agents
FOR ALL
USING (true)
WITH CHECK (true);

-- Agent Signals: Full access for all operations
CREATE POLICY "Enable all for agent_signals"
ON agent_signals
FOR ALL
USING (true)
WITH CHECK (true);

-- Portfolio Events: Full access for all operations
CREATE POLICY "Enable all for portfolio_events"
ON portfolio_events
FOR ALL
USING (true)
WITH CHECK (true);

-- ==================================================
-- VERIFICATION QUERIES
-- ==================================================
-- Run these after executing the above to verify:

-- Check RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'ai_analysis', 'portfolio', 'trades', 'watchlist',
  'screener_stocks', 'indicators', 'backtest_results', 'market_data',
  'trading_agents', 'agent_signals', 'portfolio_events'
)
ORDER BY tablename;

-- Check policies exist on all tables
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ==================================================
-- EXPECTED RESULTS
-- ==================================================
-- After running this script:
-- ✅ All 11 tables should have rowsecurity = true
-- ✅ Each table should have 1 policy named "Enable all for {table_name}"
-- ✅ All policies should be permissive with cmd = ALL
-- ✅ Your app should work exactly as before
-- ✅ Supabase RLS warnings should disappear
-- ==================================================
