-- Create stock_metadata table if it doesn't exist
CREATE TABLE IF NOT EXISTS stock_metadata (
  ticker TEXT PRIMARY KEY,
  market_cap NUMERIC,
  currency TEXT,
  exchange TEXT,
  last_updated TIMESTAMP WITH TIME ZONE,
  -- Quote-specific fields for live data caching
  quote_price NUMERIC,
  quote_change NUMERIC,
  quote_change_percent NUMERIC,
  quote_volume BIGINT,
  quote_day_high NUMERIC,
  quote_day_low NUMERIC,
  quote_open NUMERIC,
  quote_prev_close NUMERIC,
  quote_market_state TEXT,
  quote_long_name TEXT,
  quote_short_name TEXT,
  quote_last_updated TIMESTAMP WITH TIME ZONE
);

-- Create index on quote_last_updated for efficient cache lookups
CREATE INDEX IF NOT EXISTS idx_stock_metadata_quote_updated
ON stock_metadata(quote_last_updated);

-- Create index on ticker for faster lookups
CREATE INDEX IF NOT EXISTS idx_stock_metadata_ticker
ON stock_metadata(ticker);
