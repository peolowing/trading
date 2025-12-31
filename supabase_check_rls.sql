-- ==================================================
-- Check RLS Status and Policies
-- ==================================================

-- 1. Check if RLS is enabled on tables
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'ai_analysis', 'portfolio', 'trades', 'watchlist',
  'screener_stocks', 'indicators', 'backtest_results', 'market_data',
  'trading_agents', 'agent_signals', 'portfolio_events'
)
ORDER BY tablename;

-- 2. Check existing policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Count rows in important tables
SELECT 'screener_stocks' as table_name, COUNT(*) as row_count FROM screener_stocks
UNION ALL
SELECT 'portfolio', COUNT(*) FROM portfolio
UNION ALL
SELECT 'watchlist', COUNT(*) FROM watchlist
UNION ALL
SELECT 'trades', COUNT(*) FROM trades;
