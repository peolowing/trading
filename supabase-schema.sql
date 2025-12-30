-- Tabell för börsdata och indikatorer
CREATE TABLE IF NOT EXISTS market_data (
  id BIGSERIAL PRIMARY KEY,
  ticker VARCHAR(20) NOT NULL,
  date DATE NOT NULL,
  open DECIMAL(10, 2),
  high DECIMAL(10, 2),
  low DECIMAL(10, 2),
  close DECIMAL(10, 2),
  volume BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, date)
);

-- Index för snabbare queries
CREATE INDEX IF NOT EXISTS idx_market_data_ticker ON market_data(ticker);
CREATE INDEX IF NOT EXISTS idx_market_data_date ON market_data(date);
CREATE INDEX IF NOT EXISTS idx_market_data_ticker_date ON market_data(ticker, date);

-- Tabell för beräknade indikatorer
CREATE TABLE IF NOT EXISTS indicators (
  id BIGSERIAL PRIMARY KEY,
  ticker VARCHAR(20) NOT NULL,
  date DATE NOT NULL,
  ema20 DECIMAL(10, 2),
  ema50 DECIMAL(10, 2),
  rsi14 DECIMAL(10, 2),
  atr14 DECIMAL(10, 2),
  relative_volume DECIMAL(10, 4),
  regime VARCHAR(20),
  setup VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, date)
);

CREATE INDEX IF NOT EXISTS idx_indicators_ticker ON indicators(ticker);
CREATE INDEX IF NOT EXISTS idx_indicators_ticker_date ON indicators(ticker, date);

-- Tabell för AI-analyser (upp till 3 per dag per aktie)
CREATE TABLE IF NOT EXISTS ai_analysis (
  id BIGSERIAL PRIMARY KEY,
  ticker VARCHAR(20) NOT NULL,
  analysis_date DATE NOT NULL,
  analysis_text TEXT,
  edge_score DECIMAL(3, 1),
  edge_label VARCHAR(50),
  win_rate DECIMAL(5, 4),
  total_return DECIMAL(10, 4),
  trades_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index för snabba queries sorterade på created_at
CREATE INDEX IF NOT EXISTS idx_ai_analysis_ticker_date_created
ON ai_analysis(ticker, analysis_date, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_ticker ON ai_analysis(ticker);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_date ON ai_analysis(analysis_date);

-- Tabell för backtest-resultat (körs manuellt)
CREATE TABLE IF NOT EXISTS backtest_results (
  id BIGSERIAL PRIMARY KEY,
  ticker VARCHAR(20) NOT NULL,
  run_date TIMESTAMPTZ DEFAULT NOW(),
  trades_count INTEGER,
  win_rate DECIMAL(5, 4),
  total_return DECIMAL(10, 4),
  avg_win DECIMAL(10, 4),
  avg_loss DECIMAL(10, 4),
  expectancy DECIMAL(10, 4),
  current_position JSONB,
  trades JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backtest_ticker ON backtest_results(ticker);
CREATE INDEX IF NOT EXISTS idx_backtest_run_date ON backtest_results(run_date);

-- Funktion för att uppdatera updated_at automatiskt
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers för updated_at
CREATE TRIGGER update_market_data_updated_at BEFORE UPDATE ON market_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_indicators_updated_at BEFORE UPDATE ON indicators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) - Optional, om du vill ha säkerhet
-- ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE indicators ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_analysis ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE backtest_results ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Allow all access" ON market_data FOR ALL USING (true);
-- CREATE POLICY "Allow all access" ON indicators FOR ALL USING (true);
-- CREATE POLICY "Allow all access" ON ai_analysis FOR ALL USING (true);
-- CREATE POLICY "Allow all access" ON backtest_results FOR ALL USING (true);

-- Tabell för screener aktielista (dynamisk)
CREATE TABLE IF NOT EXISTS screener_stocks (
  id BIGSERIAL PRIMARY KEY,
  ticker VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_screener_stocks_ticker ON screener_stocks(ticker);
CREATE INDEX IF NOT EXISTS idx_screener_stocks_active ON screener_stocks(is_active);

-- Tabell för handelsjournal
CREATE TABLE IF NOT EXISTS trades (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  ticker VARCHAR(20) NOT NULL,
  type VARCHAR(10) NOT NULL,
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  strategy VARCHAR(50),
  stop_loss DECIMAL(10, 2),
  target DECIMAL(10, 2),
  result_kr DECIMAL(10, 2),
  result_pct DECIMAL(10, 4),
  setup_notes TEXT,
  lessons_learned TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(date);

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
