# Migration: AI Analysis - Tillåt flera analyser per dag

## Problem
Den nuvarande databasen har en UNIQUE constraint på `(ticker, analysis_date)` vilket förhindrar att spara flera AI-analyser samma dag för samma aktie.

## Lösning
Ta bort UNIQUE constraint och lägg till index för bättre performance.

## Steg 1: Kör SQL i Supabase

Gå till Supabase Dashboard → SQL Editor och kör:

```sql
-- Ta bort UNIQUE constraint
ALTER TABLE ai_analysis DROP CONSTRAINT IF EXISTS ai_analysis_ticker_analysis_date_key;

-- Lägg till index för snabbare queries (sorterat på created_at)
CREATE INDEX IF NOT EXISTS idx_ai_analysis_ticker_date_created
ON ai_analysis(ticker, analysis_date, created_at DESC);

-- Verifiera att det fungerar
SELECT
  COUNT(*) as total_analyses,
  COUNT(DISTINCT ticker) as unique_tickers,
  COUNT(DISTINCT analysis_date) as unique_dates
FROM ai_analysis;
```

## Steg 2: Testa funktionaliteten

Efter migration, testa genom att:

1. Öppna en aktie (t.ex. ERIC-B.ST)
2. Klicka "🔄 Ny analys"
3. Vänta tills analysen genereras
4. Klicka "🔄 Ny analys" igen
5. Du bör nu se diff-rutan med ändringar!

## Förväntat resultat

Efter migration kan systemet:
- Spara upp till 3 AI-analyser per aktie per dag
- Automatiskt rensa gamla analyser (behåller bara de 3 senaste)
- Jämföra senaste med näst senaste analys
- Visa diff med Edge Score förändringar och rekommendationer

## Rollback (om något går fel)

```sql
-- Återställ UNIQUE constraint
ALTER TABLE ai_analysis ADD CONSTRAINT ai_analysis_ticker_analysis_date_key
UNIQUE (ticker, analysis_date);

-- Ta bort index
DROP INDEX IF EXISTS idx_ai_analysis_ticker_date_created;
```
