# Supabase Setup Guide

## 1. Skapa ett Supabase-projekt

1. Gå till [supabase.com](https://supabase.com)
2. Skapa ett konto eller logga in
3. Klicka på "New Project"
4. Fyll i projektnamn, databas-lösenord och välj region (t.ex. "North Europe")
5. Vänta medan projektet skapas (~2 minuter)

## 2. Kör SQL-schema

1. I din Supabase-dashboard, gå till **SQL Editor** (ikonen till vänster)
2. Klicka på **New Query**
3. Kopiera hela innehållet från filen `supabase-schema.sql`
4. Klistra in i SQL-editorn
5. Klicka på **Run** (eller tryck Ctrl+Enter / Cmd+Enter)

Detta skapar följande tabeller:
- `market_data` - Börsdata (OHLCV)
- `indicators` - Tekniska indikatorer (EMA, RSI, ATR, etc.)
- `ai_analysis` - AI-analyser (max 1 per dag per aktie)
- `backtest_results` - Backtest-resultat

## 3. Hämta API-nycklar

1. I Supabase-dashboard, gå till **Settings** → **API**
2. Kopiera följande värden:
   - **Project URL** (under "Project URL")
   - **anon public** key (under "Project API keys")

## 4. Uppdatera .env.local

Öppna `.env.local` och ersätt placeholder-värdena:

```env
OPENAI_API_KEY=din-openai-key-här

# Supabase credentials
SUPABASE_URL=https://ditt-projekt-id.supabase.co
SUPABASE_ANON_KEY=din-anon-key-här
```

## 5. Starta om backend

```bash
# Stoppa backend om den kör (Ctrl+C)
# Starta om
npm run server
```

## Hur det fungerar

### Börsdata (market_data)
- Första gången en aktie laddas: Hämtas från Yahoo Finance och sparas i Supabase
- Nästa gånger: Hämtas från Supabase om data finns för idag
- Fördel: Snabbare, mindre API-anrop till Yahoo Finance

### AI-analys (ai_analysis)
- **Max 1 AI-analys per aktie per dag**
- Första gången per dag: Anropar OpenAI och sparar resultat
- Resten av dagen: Använder cachad analys från Supabase
- Fördel: Sparar OpenAI-kostnader och undviker rate limits

### Indikatorer & Backtest
- Sparas automatiskt varje gång `/api/analyze` anropas
- Kan användas för historisk analys och tracking

## Verifiera att det fungerar

1. Starta både backend och frontend
2. Ladda en aktie (t.ex. AAPL)
3. Kolla backend-loggen:
   - Första gången: "Fetching fresh market data for AAPL from Yahoo Finance"
   - Andra gången samma dag: "Using cached market data for AAPL"
4. Kolla Supabase Table Editor:
   - Gå till **Table Editor** i Supabase
   - Se att data finns i `market_data`, `indicators`, och `ai_analysis`

## Optional: Row Level Security (RLS)

Om du vill aktivera säkerhet (rekommenderas för produktion):

1. Avkommentera RLS-raderna längst ner i `supabase-schema.sql`
2. Kör SQL igen
3. Konfigurera policies baserat på dina behov

## Troubleshooting

### "Failed to fetch market data"
- Kontrollera att `SUPABASE_URL` och `SUPABASE_ANON_KEY` är korrekt ifyllda i `.env.local`
- Kontrollera att backend har startats om efter att du lagt till credentials

### "Supabase ... error"
- Kolla backend-loggen för exakta felmeddelanden
- Verifiera att alla tabeller skapades korrekt i Supabase Table Editor

### AI-analys körs fortfarande varje gång
- Kontrollera att `ticker` skickas korrekt från frontend
- Kolla `ai_analysis`-tabellen i Supabase för att se om data sparas
