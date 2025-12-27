-- Migration script to populate screener_stocks table with initial Swedish stocks
-- Run this script in your Supabase SQL editor to add the default stocks

INSERT INTO screener_stocks (ticker, name, is_active) VALUES
  ('VOLV-B.ST', 'Volvo B', true),
  ('ATCO-A.ST', 'Atlas Copco A', true),
  ('ATCO-B.ST', 'Atlas Copco B', true),
  ('SAND.ST', 'Sandvik', true),
  ('ABB.ST', 'ABB', true),
  ('INVE-A.ST', 'Investor A', true),
  ('INVE-B.ST', 'Investor B', true),
  ('ASSA-B.ST', 'ASSA ABLOY B', true),
  ('SKF-B.ST', 'SKF B', true),
  ('SEB-A.ST', 'SEB A', true),
  ('SWED-A.ST', 'Swedbank A', true),
  ('SHB-A.ST', 'Handelsbanken A', true),
  ('ERIC-B.ST', 'Ericsson B', true)
ON CONFLICT (ticker) DO NOTHING;
