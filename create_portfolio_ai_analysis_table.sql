-- Create portfolio_ai_analysis table for storing AI analysis history
CREATE TABLE IF NOT EXISTS portfolio_ai_analysis (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker text NOT NULL,
  analysis text NOT NULL,
  metrics jsonb,
  timestamp timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_portfolio_ai_analysis_ticker ON portfolio_ai_analysis(ticker);
CREATE INDEX IF NOT EXISTS idx_portfolio_ai_analysis_created_at ON portfolio_ai_analysis(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE portfolio_ai_analysis ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your auth requirements)
CREATE POLICY "Enable all access for portfolio_ai_analysis" ON portfolio_ai_analysis
  FOR ALL USING (true);
