-- Add columns to screener_stocks table for cached technical data
-- Run this in Supabase SQL Editor

ALTER TABLE screener_stocks
ADD COLUMN IF NOT EXISTS price NUMERIC,
ADD COLUMN IF NOT EXISTS ema20 NUMERIC,
ADD COLUMN IF NOT EXISTS ema50 NUMERIC,
ADD COLUMN IF NOT EXISTS rsi NUMERIC,
ADD COLUMN IF NOT EXISTS atr NUMERIC,
ADD COLUMN IF NOT EXISTS relative_volume NUMERIC,
ADD COLUMN IF NOT EXISTS regime TEXT,
ADD COLUMN IF NOT EXISTS setup TEXT,
ADD COLUMN IF NOT EXISTS edge_score INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS last_calculated DATE,
ADD COLUMN IF NOT EXISTS volume BIGINT,
ADD COLUMN IF NOT EXISTS turnover_msek NUMERIC;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_screener_last_calculated ON screener_stocks(last_calculated);
CREATE INDEX IF NOT EXISTS idx_screener_edge_score ON screener_stocks(edge_score DESC);

-- Add comment
COMMENT ON COLUMN screener_stocks.last_calculated IS 'Date when technical indicators were last calculated';
COMMENT ON COLUMN screener_stocks.edge_score IS 'Edge score 0-100 for ranking';
