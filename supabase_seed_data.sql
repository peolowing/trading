-- ==================================================
-- Seed Data for Trading App
-- ==================================================
-- This script adds initial data to your Supabase database
-- Run this in: Supabase Dashboard → SQL Editor
-- ==================================================

-- Insert sample screener stocks (Swedish stocks)
INSERT INTO screener_stocks (ticker, name, bucket, is_active)
VALUES
  ('AAPL', 'Apple Inc', 'TECH', true),
  ('MSFT', 'Microsoft Corporation', 'TECH', true),
  ('GOOGL', 'Alphabet Inc', 'TECH', true),
  ('TSLA', 'Tesla Inc', 'TECH', true),
  ('NVDA', 'NVIDIA Corporation', 'TECH', true),
  ('ESSITY-B.ST', 'Essity B', 'SWEDISH', true),
  ('ALFA.ST', 'Alfa Laval', 'SWEDISH', true),
  ('LIFCO-B.ST', 'Lifco B', 'SWEDISH', true)
ON CONFLICT (ticker) DO NOTHING;

-- Verify data was inserted
SELECT COUNT(*) as screener_count FROM screener_stocks;

-- Show all screener stocks
SELECT ticker, name, bucket, is_active
FROM screener_stocks
ORDER BY ticker;
