-- Migration för Avslutade Affärer - Lägg till nödvändiga kolumner
-- Kör detta FÖRST innan testdata

-- Entry-relaterade fält (grundläggande)
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS ticker TEXT;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS entry_date DATE;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS entry_price NUMERIC;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS initial_stop NUMERIC;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS current_stop NUMERIC;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS initial_target NUMERIC;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS current_target NUMERIC;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS initial_r NUMERIC;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS entry_setup TEXT; -- Pullback, Breakout, etc.
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS trailing_type TEXT; -- EMA20, EMA50, ATR, Manual
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS entry_rationale TEXT;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS watchlist_status TEXT;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS source TEXT; -- WATCHLIST, MANUAL, SCREENER

-- Tekniska indikatorer vid entry
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS initial_ema20 NUMERIC;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS initial_ema50 NUMERIC;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS current_ema20 NUMERIC;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS current_ema50 NUMERIC;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS initial_rsi14 NUMERIC;

-- Risk-relaterade fält
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS risk_kr NUMERIC;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS risk_pct NUMERIC;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS rr_ratio NUMERIC;

-- Exit-relaterade fält
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS exit_date DATE;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS exit_price NUMERIC;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS exit_status TEXT;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS exit_type TEXT; -- TARGET, STOP, EMA20, ATR, TIME, PARTIAL_SCALE, PANIC

-- R-multiple och PnL
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS r_multiple NUMERIC;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS pnl_pct NUMERIC;

-- MFE/MAE tracking
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS max_mfe NUMERIC; -- Max Favorable Excursion
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS max_mae NUMERIC; -- Max Adverse Excursion

-- Självutvärdering (redigerbar efter exit)
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS plan_followed BOOLEAN DEFAULT false;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS exited_early BOOLEAN DEFAULT false;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS stopped_out BOOLEAN DEFAULT false;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS broke_rule BOOLEAN DEFAULT false;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS could_scale_better BOOLEAN DEFAULT false;

-- Edge-tag och lärdom
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS edge_tag TEXT;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS lesson_learned TEXT;

-- Timestamps
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS last_updated DATE;

-- Sätt default exit_status för befintliga rader
UPDATE portfolio SET exit_status = 'HOLD' WHERE exit_status IS NULL;

-- Skapa index för snabbare queries
CREATE INDEX IF NOT EXISTS idx_portfolio_ticker ON portfolio(ticker);
CREATE INDEX IF NOT EXISTS idx_portfolio_exit_status ON portfolio(exit_status);
CREATE INDEX IF NOT EXISTS idx_portfolio_exit_date ON portfolio(exit_date);
CREATE INDEX IF NOT EXISTS idx_portfolio_edge_tag ON portfolio(edge_tag);
CREATE INDEX IF NOT EXISTS idx_portfolio_entry_date ON portfolio(entry_date);

-- Skapa unique constraint om ticker är primary key
-- ALTER TABLE portfolio ADD CONSTRAINT portfolio_ticker_unique UNIQUE (ticker);

-- Kommentar för dokumentation
COMMENT ON COLUMN portfolio.exit_status IS 'HOLD (aktiv), PARTIAL_EXIT (delvis såld), EXITED (helt avslutad)';
COMMENT ON COLUMN portfolio.exit_type IS 'TARGET, STOP, EMA20, ATR, TIME, PARTIAL_SCALE, PANIC';
COMMENT ON COLUMN portfolio.r_multiple IS 'R-multiple vid exit: (exit_price - entry_price) / initial_r';
COMMENT ON COLUMN portfolio.pnl_pct IS 'Procent P&L: ((exit_price - entry_price) / entry_price) * 100';
COMMENT ON COLUMN portfolio.max_mfe IS 'Max Favorable Excursion - bästa R under traden';
COMMENT ON COLUMN portfolio.max_mae IS 'Max Adverse Excursion - sämsta R under traden';
COMMENT ON COLUMN portfolio.edge_tag IS 'A (perfekt), B (bra), C (dålig) - kvalitetsbedömning';

-- Ta bort eventuella constraints som kan orsaka problem
ALTER TABLE portfolio DROP CONSTRAINT IF EXISTS portfolio_exit_status_check;
ALTER TABLE portfolio DROP CONSTRAINT IF EXISTS portfolio_edge_tag_check;

-- Lägg till nya constraints
ALTER TABLE portfolio ADD CONSTRAINT portfolio_exit_status_check
  CHECK (exit_status IS NULL OR exit_status IN ('HOLD', 'PARTIAL_EXIT', 'EXITED'));

ALTER TABLE portfolio ADD CONSTRAINT portfolio_edge_tag_check
  CHECK (edge_tag IS NULL OR edge_tag IN ('A', 'B', 'C'));
