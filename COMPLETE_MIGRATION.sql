-- Complete Migration for Position Detail + Journal Integration
-- Date: 2025-12-28
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE portfolio_events TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS portfolio_events (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL, -- 'ENTRY', 'EXIT', 'PARTIAL_EXIT', 'STOP_HIT', 'STOP_MOVED', 'NOTE'
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_portfolio_events_ticker ON portfolio_events(ticker);
CREATE INDEX IF NOT EXISTS idx_portfolio_events_date ON portfolio_events(event_date DESC);

-- ============================================
-- 2. ADD MISSING COLUMNS TO portfolio TABLE
-- ============================================
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS exit_date DATE;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS exit_price NUMERIC(10, 2);
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS exit_type TEXT; -- 'FULL', 'PARTIAL', 'STOP_HIT'
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS entry_rationale TEXT;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS lessons_learned TEXT;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS exit_checklist JSONB;

-- ============================================
-- 3. UPDATE trades TABLE CONSTRAINT
-- ============================================
-- Drop existing check constraint on trades.type
ALTER TABLE trades DROP CONSTRAINT IF EXISTS trades_type_check;

-- Add new check constraint with expanded allowed values
ALTER TABLE trades ADD CONSTRAINT trades_type_check
  CHECK (type IN (
    -- Original trade types
    'long', 'short',
    -- Journal entry types
    'observation', 'decision', 'emotion', 'lesson', 'mistake'
  ));

-- ============================================
-- 4. VERIFY TABLES
-- ============================================
-- Check portfolio_events table exists
SELECT
  'portfolio_events' as table_name,
  COUNT(*) as row_count
FROM portfolio_events;

-- Check trades constraint
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'trades'::regclass
  AND conname = 'trades_type_check';

-- ============================================
-- 5. MIGRATE EXISTING PORTFOLIO DATA
-- ============================================
-- Create ENTRY events for existing portfolio positions
INSERT INTO portfolio_events (ticker, event_date, event_type, description)
SELECT
  ticker,
  entry_date,
  'ENTRY',
  'Köpt ' || quantity || ' aktier @ ' || entry_price
FROM portfolio
WHERE NOT EXISTS (
  SELECT 1 FROM portfolio_events
  WHERE portfolio_events.ticker = portfolio.ticker
    AND portfolio_events.event_type = 'ENTRY'
);

-- ============================================
-- DONE!
-- ============================================
SELECT
  'Migration completed successfully!' as message,
  (SELECT COUNT(*) FROM portfolio_events) as total_events,
  (SELECT COUNT(*) FROM portfolio_events WHERE event_type = 'ENTRY') as entry_events;
