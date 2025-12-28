# Portfolio Migration – Förvaltningslista

Detta dokument beskriver SQL-migrationen för att uppgradera portfolio-tabellen från en enkel lista till en komplett förvaltningslista med exit-logik och riskkontroll.

## Steg 1: Öppna Supabase SQL Editor

1. Gå till [Supabase Dashboard](https://supabase.com/dashboard)
2. Välj ditt projekt
3. Klicka på "SQL Editor" i vänstermenyn
4. Klicka på "New Query"

## Steg 2: Kör SQL-migration

Kopiera och klistra in denna SQL-kod:

```sql
-- =====================================================
-- PORTFOLIO MIGRATION – FÖRVALTNINGSLISTA
-- =====================================================
-- Lägger till kolumner för exit-logik, risk och PnL
-- =====================================================

ALTER TABLE portfolio
-- Entry snapshot (när positionen öppnades)
ADD COLUMN IF NOT EXISTS entry_date DATE,
ADD COLUMN IF NOT EXISTS initial_stop DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS initial_target DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS initial_r DECIMAL(10, 2), -- Risk per aktie (entry - stop)
ADD COLUMN IF NOT EXISTS initial_ema20 DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS initial_ema50 DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS initial_rsi14 DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS entry_setup TEXT, -- Pullback, Breakout, etc

-- Current state (uppdateras dagligen)
ADD COLUMN IF NOT EXISTS current_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS current_stop DECIMAL(10, 2), -- Trailing stop
ADD COLUMN IF NOT EXISTS current_target DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS current_ema20 DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS current_ema50 DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS current_rsi14 DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS current_volume_rel DECIMAL(6, 2),

-- PnL & Risk metrics
ADD COLUMN IF NOT EXISTS pnl_pct DECIMAL(7, 2), -- +3.1%
ADD COLUMN IF NOT EXISTS pnl_amount DECIMAL(12, 2), -- SEK/USD
ADD COLUMN IF NOT EXISTS r_multiple DECIMAL(6, 2), -- +1.6R
ADD COLUMN IF NOT EXISTS days_in_trade INTEGER DEFAULT 0,

-- Exit logic
ADD COLUMN IF NOT EXISTS current_status TEXT DEFAULT 'HOLD', -- HOLD, TIGHTEN_STOP, PARTIAL_EXIT, EXIT, STOP_HIT
ADD COLUMN IF NOT EXISTS exit_signal TEXT, -- "EMA20 break", "RSI >70", etc
ADD COLUMN IF NOT EXISTS trailing_type TEXT DEFAULT 'EMA20', -- EMA20, HL (Higher Low), ATR
ADD COLUMN IF NOT EXISTS last_updated DATE,

-- Optional metadata
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS partial_exit_done BOOLEAN DEFAULT FALSE;

-- Skapa index för snabbare queries
CREATE INDEX IF NOT EXISTS idx_portfolio_status ON portfolio(current_status);
CREATE INDEX IF NOT EXISTS idx_portfolio_last_updated ON portfolio(last_updated);

-- Uppdatera entry_date för befintliga rader (om de inte har ett värde)
UPDATE portfolio
SET entry_date = added_at::DATE
WHERE entry_date IS NULL;
```

## Steg 3: Klicka "Run" för att köra SQL

## Steg 4: Verifiera

Kör denna SQL för att bekräfta att kolumnerna lades till:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'portfolio'
ORDER BY ordinal_position;
```

Du ska nu se alla nya kolumner listade.

## Vad händer med befintliga rader?

- Alla nya kolumner får `NULL` eller default-värden
- `entry_date` sätts till `added_at` för befintliga rader
- Nästa gång `/api/portfolio/update` körs fylls alla värden i

## Nästa steg

Efter denna migration:
1. Skapa `lib/portfolioLogic.js` med exit-logik
2. Skapa endpoint `POST /api/portfolio/update` för daglig uppdatering
3. Uppdatera Dashboard.jsx med 10-kolumns tabell
4. Testa exit-signaler

## Kolumn-översikt

| Kolumn | Syfte | Exempel |
|--------|-------|---------|
| **entry_price** | Entry-pris | 241.0 |
| **initial_stop** | Initial stop-loss | 237.0 |
| **initial_r** | Risk per aktie | 4.0 (241-237) |
| **current_price** | Nuvarande pris | 248.5 |
| **current_stop** | Trailing stop | 244.0 |
| **pnl_pct** | Vinst/förlust % | +3.1% |
| **r_multiple** | R-multiple | +1.6R |
| **current_status** | EXIT-signal | HOLD / EXIT |
| **exit_signal** | Förklaring | "EMA20 break" |
| **trailing_type** | Stop-typ | EMA20 / HL |
| **days_in_trade** | Tid i trade | 6 |

## Exempel på komplett rad efter uppdatering

```
ticker: VOLV-B.ST
entry_price: 241.0
entry_date: 2025-12-22
initial_stop: 237.0
initial_r: 4.0
current_price: 248.5
current_stop: 244.0
pnl_pct: +3.1
r_multiple: +1.6
current_status: HOLD
exit_signal: null
trailing_type: EMA20
days_in_trade: 6
```

## Daglig rutin (automatisering)

Senare kan du köra detta via GitHub Actions eller cron:

```bash
curl -X POST http://localhost:3002/api/portfolio/update
```

Detta uppdaterar alla positioner med:
- Nuvarande pris från Yahoo Finance
- Beräknad trailing stop
- PnL och R-multiple
- Exit-signaler (HOLD / EXIT)
