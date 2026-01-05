-- Add quote-specific fields to stock_metadata table
ALTER TABLE stock_metadata
ADD COLUMN IF NOT EXISTS quote_price NUMERIC,
ADD COLUMN IF NOT EXISTS quote_change NUMERIC,
ADD COLUMN IF NOT EXISTS quote_change_percent NUMERIC,
ADD COLUMN IF NOT EXISTS quote_volume BIGINT,
ADD COLUMN IF NOT EXISTS quote_day_high NUMERIC,
ADD COLUMN IF NOT EXISTS quote_day_low NUMERIC,
ADD COLUMN IF NOT EXISTS quote_open NUMERIC,
ADD COLUMN IF NOT EXISTS quote_prev_close NUMERIC,
ADD COLUMN IF NOT EXISTS quote_market_state TEXT,
ADD COLUMN IF NOT EXISTS quote_long_name TEXT,
ADD COLUMN IF NOT EXISTS quote_short_name TEXT,
ADD COLUMN IF NOT EXISTS quote_last_updated TIMESTAMP WITH TIME ZONE;

-- Create index on quote_last_updated for efficient cache lookups
CREATE INDEX IF NOT EXISTS idx_stock_metadata_quote_updated
ON stock_metadata(quote_last_updated);
