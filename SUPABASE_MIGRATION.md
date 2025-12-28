# Supabase Database Migration

Kör denna SQL i Supabase SQL Editor för att aktivera persistent cache:

## Steg 1: Öppna Supabase SQL Editor

1. Gå till https://supabase.com/dashboard
2. Välj ditt projekt
3. Klicka på "SQL Editor" i vänstermenyn
4. Klicka "New Query"

## Steg 2: Kör denna SQL

```sql
-- Lägg till JSONB-kolumner för cache-data i indicators-tabellen
ALTER TABLE indicators
ADD COLUMN IF NOT EXISTS candles JSONB,
ADD COLUMN IF NOT EXISTS ema20_series JSONB,
ADD COLUMN IF NOT EXISTS ema50_series JSONB,
ADD COLUMN IF NOT EXISTS rsi14_series JSONB,
ADD COLUMN IF NOT EXISTS atr14_series JSONB,
ADD COLUMN IF NOT EXISTS indicators_data JSONB;

-- Lägg till index för snabbare uppslag
CREATE INDEX IF NOT EXISTS idx_indicators_ticker_date
ON indicators(ticker, date);

-- Skapa tabell för AI-analys cache
CREATE TABLE IF NOT EXISTS ai_analysis (
  ticker TEXT NOT NULL,
  analysis_date DATE NOT NULL,
  analysis_text TEXT NOT NULL,
  edge_score DECIMAL(3, 1),
  edge_label TEXT,
  win_rate DECIMAL(5, 4),
  total_return DECIMAL(7, 4),
  trades_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (ticker, analysis_date)
);

-- Index för AI-analys
CREATE INDEX IF NOT EXISTS idx_ai_analysis_ticker_date
ON ai_analysis(ticker, analysis_date);

-- Skapa tabell för bevakningslista (watchlist)
CREATE TABLE IF NOT EXISTS watchlist (
  ticker TEXT PRIMARY KEY,
  added_at TIMESTAMP DEFAULT NOW(),

  -- Initial snapshot när aktien lades till
  initial_price DECIMAL(10, 2),
  initial_ema20 DECIMAL(10, 2),
  initial_ema50 DECIMAL(10, 2),
  initial_rsi14 DECIMAL(5, 2),
  initial_regime TEXT,
  initial_setup TEXT,

  -- Senaste dagliga uppdatering
  last_updated DATE,
  current_status TEXT DEFAULT 'WAIT_PULLBACK',
  current_action TEXT DEFAULT 'WAIT',
  status_reason TEXT,

  -- Diagnostics från senaste uppdatering
  dist_ema20_pct DECIMAL(6, 2),
  rsi_zone TEXT,
  volume_state TEXT,
  time_warning TEXT,

  -- Räknare
  days_in_watchlist INTEGER DEFAULT 0,

  -- Extra metadata
  notes TEXT
);

-- Skapa tabell för förvaltningslista (portfolio)
CREATE TABLE IF NOT EXISTS portfolio (
  ticker TEXT PRIMARY KEY,
  entry_price DECIMAL(10, 2),
  quantity INTEGER,
  added_at TIMESTAMP DEFAULT NOW()
);

-- Skapa tabell för backtest-resultat
CREATE TABLE IF NOT EXISTS backtest_results (
  ticker TEXT NOT NULL,
  analysis_date DATE NOT NULL,
  strategy TEXT NOT NULL,
  total_signals INTEGER,
  wins INTEGER,
  losses INTEGER,
  win_rate DECIMAL(6, 2),
  avg_win DECIMAL(10, 2),
  avg_loss DECIMAL(10, 2),
  total_return DECIMAL(10, 2),
  max_drawdown DECIMAL(10, 2),
  sharpe_ratio DECIMAL(10, 4),
  trades_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (ticker, analysis_date, strategy)
);

-- Index för backtest-resultat
CREATE INDEX IF NOT EXISTS idx_backtest_results_ticker_date
ON backtest_results(ticker, analysis_date);
```

## Steg 3: Klicka "Run" för att köra SQL

## Steg 4: Verifiera

Kör denna SQL för att bekräfta att kolumnerna lades till:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'indicators'
ORDER BY ordinal_position;
```

Du bör se de nya kolumnerna med data_type = 'jsonb'.

## Efter migration

När SQL är körda kommer applikationen automatiskt att använda persistent cache, vilket ger:

### Data & Indikatorer:
- ✅ Mycket snabbare laddning (0.1-0.2s istället för 0.8s)
- ✅ Cache överlever serverless function restarts
- ✅ Automatisk uppdatering varje dag

### AI-Analys:
- ✅ Första anropet: ~10s (OpenAI API)
- ✅ Efterföljande anrop samma dag: ~0.1s (från cache)
- ✅ Sparar OpenAI API-kostnader
- ✅ Delade analyser mellan användare
