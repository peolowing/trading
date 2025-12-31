-- ==================================================
-- QUICK FIX: Disable RLS completely
-- ==================================================
-- This disables RLS entirely so your app works immediately
-- Run this NOW to fix the empty data issue
-- ==================================================

-- Disable RLS on all tables
ALTER TABLE IF EXISTS ai_analysis DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS portfolio DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trades DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS watchlist DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS screener_stocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS indicators DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS backtest_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS market_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trading_agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_signals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS portfolio_events DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'ai_analysis', 'portfolio', 'trades', 'watchlist',
  'screener_stocks', 'indicators', 'backtest_results', 'market_data',
  'trading_agents', 'agent_signals', 'portfolio_events'
)
ORDER BY tablename;

-- Expected result: All rowsecurity should be 'false'
