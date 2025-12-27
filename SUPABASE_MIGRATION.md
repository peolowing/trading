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
  date DATE NOT NULL,
  analysis TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (ticker, date)
);

-- Index för AI-analys
CREATE INDEX IF NOT EXISTS idx_ai_analysis_ticker_date
ON ai_analysis(ticker, date);
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
