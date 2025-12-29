-- Add bucket column to screener_stocks table
-- This column will store "LARGE_CAP" or "MID_CAP"

ALTER TABLE screener_stocks
ADD COLUMN IF NOT EXISTS bucket TEXT CHECK (bucket IN ('LARGE_CAP', 'MID_CAP'));

-- Create index for faster filtering by bucket
CREATE INDEX IF NOT EXISTS idx_screener_stocks_bucket ON screener_stocks(bucket);

-- Add comment
COMMENT ON COLUMN screener_stocks.bucket IS 'Market cap classification: LARGE_CAP (≥50M SEK/day) or MID_CAP (15-49.9M SEK/day)';
