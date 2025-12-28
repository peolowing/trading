# Förvaltningslista – Testguide

## Steg-för-steg: Lägg in testdata och testa

### Steg 1: Kör SQL-migration

1. Öppna [Supabase Dashboard](https://supabase.com/dashboard)
2. Välj ditt projekt
3. Klicka på **SQL Editor** i vänstermenyn
4. Klicka på **New Query**
5. Kopiera SQL från [PORTFOLIO_MIGRATION.md](./PORTFOLIO_MIGRATION.md) (raderna 17-66)
6. Klistra in och klicka **Run**

Du ska se:
```
Success. No rows returned
```

### Steg 2: Lägg in testdata

1. Öppna **SQL Editor** igen (ny query)
2. Kopiera hela [PORTFOLIO_TESTDATA.sql](./PORTFOLIO_TESTDATA.sql)
3. Klistra in och klicka **Run**

Du ska se en tabell med 5 rader:

```
ticker      entry_price  current_price  pnl      r        current_status   dagar
AAPL        180.00       175.20        -2.7%    -1.2R    EXIT            3d
TSLA        240.00       252.00        +5.0%    +2.4R    PARTIAL_EXIT    8d
VOLV-B.ST   241.00       248.50        +3.1%    +1.9R    TIGHTEN_STOP    6d
MSFT        375.00       380.50        +1.5%    +1.1R    HOLD            2d
ERIC-B.ST    56.00        56.80        +1.4%    +0.53R   HOLD            1d
```

### Steg 3: Öppna Dashboard

```bash
# Starta frontend (om inte redan igång)
npm run dev

# Öppna i browser
http://localhost:5174
```

### Steg 4: Se förvaltningslistan

Du ska nu se **5 positioner** i förvaltningslistan, sorterade med EXIT först:

#### 🔴 EXIT - AAPL
```
Status: 🔴
Aktie: AAPL
Pris: 175.20
Entry: 180.00
PnL %: -2.7%
R: -1.2R (röd)
Stop: 176.00
Target: 188.00
Trailing: EMA20
Dagar: 3d

Exit-signal: "Pris under EMA20 - momentum bruten"
```
**→ ACTION: Sälj AAPL idag!**

#### 🟠 PARTIAL_EXIT - TSLA
```
Status: 🟠
Aktie: TSLA
Pris: 252.00
Entry: 240.00
PnL %: +5.0%
R: +2.4R (grön)
Stop: 246.00
Target: 250.00
Trailing: EMA20
Dagar: 8d

Exit-signal: "RSI overbought (72) + +2.4R vinst - skala ut 50%"
```
**→ ACTION: Sälj 50% av TSLA (20 av 40 aktier)**

#### 🟡 TIGHTEN_STOP - VOLV-B.ST
```
Status: 🟡
Aktie: VOLV-B.ST
Pris: 248.50
Entry: 241.00
PnL %: +3.1%
R: +1.9R (blå)
Stop: 244.00
Target: 249.00
Trailing: EMA20
Dagar: 6d

Exit-signal: "+1.9R vinst - flytta stop till break-even eller EMA20"
```
**→ ACTION: Flytta stop från 237 → 241 (break-even)**

#### 🟢 HOLD - MSFT
```
Status: 🟢
Aktie: MSFT
Pris: 380.50
Entry: 375.00
PnL %: +1.5%
R: +1.1R (blå)
Stop: 374.00
Target: 385.00
Trailing: EMA20
Dagar: 2d
```
**→ ACTION: Gör inget - låt marknaden jobba**

#### 🟢 HOLD - ERIC-B.ST
```
Status: 🟢
Aktie: ERIC-B.ST
Pris: 56.80
Entry: 56.00
PnL %: +1.4%
R: +0.53R (grå)
Stop: 55.80
Target: 59.00
Trailing: EMA20
Dagar: 1d
```
**→ ACTION: Gör inget - ny position, låt den utvecklas**

## Visuell testlista

Du ska se:

### Färgkodning:
- **🔴 Röd rad** (AAPL) - EXIT-signal
- **🟠 Orange ikon** (TSLA) - PARTIAL_EXIT
- **🟡 Gul ikon** (VOLV-B) - TIGHTEN_STOP
- **🟢 Gröna ikoner** (MSFT, ERIC-B) - HOLD

### PnL-färger:
- **Grön** för positiv (TSLA +5.0%, VOLV-B +3.1%, MSFT +1.5%, ERIC-B +1.4%)
- **Röd** för negativ (AAPL -2.7%)

### R-multiple-färger:
- **Grön** för R >= +2.0 (TSLA +2.4R)
- **Blå** för R >= +1.0 (VOLV-B +1.9R, MSFT +1.1R)
- **Grå** för R < +1.0 (ERIC-B +0.53R)
- **Röd** för negativ (AAPL -1.2R)

### Exit-signaler under tabellen:
```
Exit-signaler:
• AAPL: Pris under EMA20 - momentum bruten
• TSLA: RSI overbought (72) + +2.4R vinst - skala ut 50%
• VOLV-B.ST: +1.9R vinst - flytta stop till break-even eller EMA20
```

## Steg 5: Testa daglig uppdatering

För att se hur exit-logiken fungerar, kör daglig uppdatering:

```bash
curl -X POST http://localhost:3002/api/portfolio/update
```

**OBS:** Detta kommer att hämta *riktiga* priser från Yahoo Finance och uppdatera alla värden. Testdata kommer att skrivas över med live-data.

Om du vill **behålla testdata**, skippa detta steg.

## Steg 6: Klicka på aktier

Klicka på en rad i tabellen → Du ska komma till StockDetail-vyn för den aktien.

## Steg 7: Ta bort en position

Klicka på **✕** för att ta bort en position från förvaltningslistan.

## Förväntad workflow (10 sekunder dagligen)

1. Öppna Dashboard
2. Scanna förvaltningslistan (automatiskt sorterad)
3. Se **🔴 EXIT** överst → Sälj AAPL
4. Se **🟠 PARTIAL_EXIT** → Sälj 50% TSLA
5. Se **🟡 TIGHTEN_STOP** → Flytta stop för VOLV-B
6. Se **🟢 HOLD** → Ignorera MSFT och ERIC-B
7. Stäng Dashboard

**Total tid: 10 sekunder.**

## Testscenarier att prova

### Scenario 1: Simulera "nästa dag"
```sql
-- Uppdatera MSFT till högre pris (simulera vinst)
UPDATE portfolio
SET
  current_price = 385.0,  -- +10 USD
  pnl_pct = 2.7,
  r_multiple = 2.0,       -- +2R
  current_status = 'TIGHTEN_STOP',
  exit_signal = '+2.0R vinst - skydda vinsten',
  days_in_trade = 3
WHERE ticker = 'MSFT';
```

Refresh Dashboard → MSFT ska nu vara 🟡 TIGHTEN_STOP

### Scenario 2: Simulera stop hit
```sql
-- ERIC-B stop träffad
UPDATE portfolio
SET
  current_price = 54.0,   -- under stop
  pnl_pct = -3.6,
  r_multiple = -1.33,
  current_status = 'STOP_HIT',
  exit_signal = 'Stop träffad vid 54.50',
  days_in_trade = 2
WHERE ticker = 'ERIC-B.ST';
```

Refresh Dashboard → ERIC-B ska nu vara ⚫ STOP_HIT (röd rad)

### Scenario 3: Återställ testdata
Kör [PORTFOLIO_TESTDATA.sql](./PORTFOLIO_TESTDATA.sql) igen för att återställa alla 5 positioner.

## Troubleshooting

### Problem: Ser inga positioner i Dashboard

**Lösning:**
1. Kolla att SQL kördes utan fel
2. Verifiera data i Supabase Table Editor: `portfolio`
3. Kolla browser console för fel

### Problem: Kolumner saknas eller fel format

**Lösning:**
1. Kör migration igen: [PORTFOLIO_MIGRATION.md](./PORTFOLIO_MIGRATION.md)
2. Verifiera schema:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'portfolio'
ORDER BY ordinal_position;
```

### Problem: Exit-signaler visas inte

**Lösning:**
Kontrollera att `exit_signal` är satt i databasen:
```sql
SELECT ticker, current_status, exit_signal
FROM portfolio
WHERE exit_signal IS NOT NULL;
```

## Nästa steg

Efter att du testat med dessa 5 positioner:

1. **Rensa testdata** (om du vill):
```sql
DELETE FROM portfolio;
```

2. **Lägg till riktiga positioner** via StockDetail-vyn

3. **Automatisera daglig uppdatering** via GitHub Actions eller cron

## Sammanfattning

Du har nu:
✅ 5 testpositioner med olika status-nivåer
✅ En komplett förvaltningslista med 10 kolumner
✅ Auto-sortering (EXIT först)
✅ Färgkodning (PnL, R-multiple)
✅ Exit-signaler som talar om exakt vad du ska göra

**10-sekunders daglig rutin:**
Öppna Dashboard → Scanna förvaltningslistan → Agera på röda/orange → Klart!
