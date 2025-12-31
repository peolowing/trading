# Supabase Row Level Security (RLS) Fix

## Problem

Supabase varnar om att Row Level Security (RLS) inte är aktiverat på dina tabeller. Detta betyder att:

- **ALLA med din API-nyckel kan läsa/skriva data**
- **Ingen autentisering krävs för CRUD-operationer**
- **Din data är potentiellt exponerad**

## Vilka Tabeller Behöver RLS?

Baserat på din app:
1. `ai_analysis` - AI-analyser
2. `portfolio` - Positioner
3. `trades` - Trade journal
4. `watchlist` - Bevakningslista
5. `screener_stocks` - Screener-lista
6. `indicators` - Tekniska indikatorer (cache)
7. `backtest_results` - Backtest-resultat (cache)
8. `market_data` - Market data (cache)

## Lösning: Aktivera RLS

### Steg 1: Aktivera RLS på Alla Tabeller

Kör detta SQL i Supabase SQL Editor:

```sql
-- Aktivera RLS på alla tabeller
ALTER TABLE ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE screener_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
```

### Steg 2: Skapa Policies (Välj Ett Scenario)

#### Scenario A: Single-User App (Enklast - Din App)

Om du är den enda användaren och vill att appen ska ha full access:

```sql
-- AI Analysis: Full access
CREATE POLICY "Enable all access for ai_analysis"
ON ai_analysis FOR ALL
USING (true)
WITH CHECK (true);

-- Portfolio: Full access
CREATE POLICY "Enable all access for portfolio"
ON portfolio FOR ALL
USING (true)
WITH CHECK (true);

-- Trades: Full access
CREATE POLICY "Enable all access for trades"
ON trades FOR ALL
USING (true)
WITH CHECK (true);

-- Watchlist: Full access
CREATE POLICY "Enable all access for watchlist"
ON watchlist FOR ALL
USING (true)
WITH CHECK (true);

-- Screener Stocks: Full access
CREATE POLICY "Enable all access for screener_stocks"
ON screener_stocks FOR ALL
USING (true)
WITH CHECK (true);

-- Indicators (cache): Full access
CREATE POLICY "Enable all access for indicators"
ON indicators FOR ALL
USING (true)
WITH CHECK (true);

-- Backtest Results (cache): Full access
CREATE POLICY "Enable all access for backtest_results"
ON backtest_results FOR ALL
USING (true)
WITH CHECK (true);

-- Market Data (cache): Full access
CREATE POLICY "Enable all access for market_data"
ON market_data FOR ALL
USING (true)
WITH CHECK (true);
```

**Fördelar:**
- Enkelt
- Appen fungerar exakt som förut
- Skyddar mot externa API-anrop (kräver fortfarande ANON_KEY)

**Nackdelar:**
- Ingen användarspecifik data-isolation
- Alla med ANON_KEY har full access

#### Scenario B: Service Role Key (Säkrare)

Använd en dedikerad Service Role Key för backend:

1. **Hämta Service Role Key** från Supabase Dashboard → Settings → API
2. **Skapa ny miljövariabel** `SUPABASE_SERVICE_KEY`
3. **Uppdatera backend** för att använda Service Role Key

**config/supabase.js:**
```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Service role key
const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export { supabase };
```

**RLS Policies (Endast service role):**
```sql
-- Neka public access, tillåt endast service_role
CREATE POLICY "Service role only for ai_analysis"
ON ai_analysis FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Upprepa för alla tabeller...
```

**Fördelar:**
- Mycket säkrare
- ANON_KEY har ingen access
- Endast backend kan skriva

**Nackdelar:**
- Kräver kod-ändringar
- Service Role Key är känslig (måste skyddas)

#### Scenario C: Multi-User med Autentisering (Mest Komplett)

Om du senare vill ha flera användare:

```sql
-- Portfolio: Varje user ser bara sina egna
CREATE POLICY "Users see own portfolio"
ON portfolio FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users create own portfolio"
ON portfolio FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Trades: Varje user ser bara sina egna
CREATE POLICY "Users see own trades"
ON trades FOR SELECT
USING (auth.uid() = user_id);

-- Watchlist: Varje user ser bara sin egen
CREATE POLICY "Users see own watchlist"
ON watchlist FOR SELECT
USING (auth.uid() = user_id);

-- AI Analysis: Shared (alla kan läsa)
CREATE POLICY "Public read ai_analysis"
ON ai_analysis FOR SELECT
USING (true);

CREATE POLICY "Authenticated insert ai_analysis"
ON ai_analysis FOR INSERT
TO authenticated
WITH CHECK (true);
```

**OBS:** Detta kräver:
- Lägg till `user_id UUID` kolumner i tabellerna
- Implementera Supabase Auth i frontend
- Uppdatera alla inserts för att inkludera `auth.uid()`

## Rekommenderad Lösning för Din App

**Steg-för-steg:**

1. **Aktivera RLS på alla tabeller** (körs alltid)
2. **Använd Scenario A** (full access policies) för enkelhetens skull
3. **Senare:** Uppgradera till Scenario B om du vill ha mer säkerhet

## SQL Script - Kör Detta Nu

```sql
-- 1. Aktivera RLS
ALTER TABLE ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE screener_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;

-- 2. Skapa Full Access Policies (Scenario A)
CREATE POLICY "Enable all for ai_analysis" ON ai_analysis FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for portfolio" ON portfolio FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for trades" ON trades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for watchlist" ON watchlist FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for screener_stocks" ON screener_stocks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for indicators" ON indicators FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for backtest_results" ON backtest_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for market_data" ON market_data FOR ALL USING (true) WITH CHECK (true);
```

## Verifiera att det Fungerar

Efter att ha kört SQL:

1. **Testa appen** - allt ska fungera som vanligt
2. **Kolla Supabase Dashboard** - varningar borde vara borta
3. **Testa API** - portfolio, trades, watchlist ska funka

## Framtida Förbättringar

1. **Lägg till autentisering** med Supabase Auth
2. **Använd Service Role Key** för backend
3. **Implementera user-specific policies** för multi-user support

## Säkerhetsnivåer

**Nuvarande (INGEN RLS):**
```
Externa API-anrop → Din Supabase → Full Access ❌
```

**Efter Scenario A (RLS + Full Access Policy):**
```
Externa API-anrop → Supabase RLS Check → Full Access (men kräver ANON_KEY) ✅
```

**Efter Scenario B (Service Role):**
```
Externa API-anrop → Neka ❌
Din Backend (Service Key) → Full Access ✅
```

**Efter Scenario C (User Auth):**
```
User A → Ser bara User A's data ✅
User B → Ser bara User B's data ✅
```
