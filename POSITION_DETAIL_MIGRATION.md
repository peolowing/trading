# Position Detail Migration

Detta är en tilläggsmigration för att lägga till funktionalitet för position detail view.

## 1. Skapa portfolio_events-tabell

```sql
CREATE TABLE IF NOT EXISTS portfolio_events (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  event_type TEXT NOT NULL, -- 'ENTRY', 'EXIT', 'PARTIAL_EXIT', 'STOP_HIT', 'STOP_MOVED', 'NOTE'
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index för snabbare queries
CREATE INDEX idx_portfolio_events_ticker ON portfolio_events(ticker);
CREATE INDEX idx_portfolio_events_date ON portfolio_events(event_date DESC);
```

## 2. Lägg till saknade kolumner i portfolio-tabellen

```sql
-- Exit-relaterade kolumner
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS exit_date DATE;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS exit_price NUMERIC(10, 2);
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS exit_type TEXT; -- 'FULL', 'PARTIAL', 'STOP_HIT'

-- Entry rationale (varför tog vi traden?)
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS entry_rationale TEXT;

-- Post-exit journal
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS lessons_learned TEXT;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS exit_checklist JSONB; -- { followed_plan, exit_too_early, etc }
```

## 3. Lägg till ENTRY-event för befintliga positioner

```sql
-- För varje position utan events, skapa en ENTRY-event
INSERT INTO portfolio_events (ticker, event_date, event_type, description)
SELECT
  ticker,
  entry_date,
  'ENTRY',
  'Köpt ' || quantity || ' aktier @ ' || entry_price
FROM portfolio
WHERE NOT EXISTS (
  SELECT 1 FROM portfolio_events
  WHERE portfolio_events.ticker = portfolio.ticker
  AND portfolio_events.event_type = 'ENTRY'
);
```

## 4. Verifiera

```sql
-- Kolla portfolio_events-tabellen
SELECT * FROM portfolio_events ORDER BY event_date DESC LIMIT 10;

-- Kolla att nya kolumner finns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'portfolio'
AND column_name IN ('exit_date', 'exit_price', 'exit_type', 'entry_rationale', 'lessons_learned', 'exit_checklist');
```

## Användning

1. Öppna Supabase SQL Editor
2. Kör varje SQL-block ovan i ordning
3. Verifiera att allt fungerar

## Exempel på entry_rationale

När du lägger till en position via StockDetail, lägg till entry rationale:

```sql
UPDATE portfolio
SET entry_rationale = 'Pullback mot EMA20 i stark upptrend. RSI 47 (CALM-zon). Låg volym i rekyl vilket indikerar sund profit-taking utan distribution.'
WHERE ticker = 'VOLV-B.ST';
```

## Exempel på exit_checklist

När du exiterar en position:

```json
{
  "followed_plan": true,
  "exit_too_early": false,
  "let_market_decide": true,
  "good_entry_bad_exit": false,
  "broke_rules": false
}
```

Detta sparas automatiskt när du använder PositionDetail-komponenten.
