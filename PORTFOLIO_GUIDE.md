# Förvaltningslista – Komplett Guide

## 🎯 Syfte

Förvaltningslistan är din **exit-cockpit** som svarar på en enda fråga varje dag:

> **"Behöver jag agera på någon position idag – eller kan jag låta marknaden jobba?"**

Den fokuserar på:
- ✅ Risk och kapitalskydd
- ✅ PnL och R-multiple
- ✅ Exit-signaler (HOLD / EXIT)
- ✅ Trailing stop-hantering

## 📋 10 Kolumner i Förvaltningslistan

| Kolumn | Beskrivning | Exempel |
|--------|-------------|---------|
| **Status** | EXIT-signal (🟢🟡🟠🔴⚫) | 🟢 HOLD |
| **Aktie** | Ticker | VOLV-B.ST |
| **Pris** | Nuvarande pris | 248.5 |
| **Entry** | Entry-pris | 241.0 |
| **PnL %** | Vinst/förlust i % | +3.1% |
| **R** | R-multiple | +1.6R |
| **Stop** | Trailing stop | 244.0 |
| **Target** | Initial target | 258.0 |
| **Trailing** | Stop-typ | EMA20 |
| **Dagar** | Tid i trade | 6d |

## 🚦 Status-nivåer

| Status | Ikon | Betydelse | Handling |
|--------|------|-----------|----------|
| **HOLD** | 🟢 | Allt OK | Ingenting - låt marknaden jobba |
| **TIGHTEN_STOP** | 🟡 | Skydda vinst | Flytta stop till break-even |
| **PARTIAL_EXIT** | 🟠 | Skala ut | Sälj 30-50% av position |
| **EXIT** | 🔴 | Säljsignal | Sälj hela positionen |
| **STOP_HIT** | ⚫ | Stop träffad | Automatisk exit |

## 🔄 Arbetsflöde

### 1. Lägg till position från analysvyn

När du hittar en bra entry via watchlist och analys:

1. Klicka på "Lägg till i Portfolio" i StockDetail
2. Ange:
   - **Entry price** (aktuellt pris)
   - **Quantity** (antal aktier)
   - **Initial stop** (t.ex. entry - 2×ATR)
   - **Target** (t.ex. entry + 2R)
3. Systemet sparar även:
   - Entry-datum
   - Initial EMA20, EMA50, RSI14
   - Setup-typ (Pullback, Breakout, etc.)

### 2. Kör daglig uppdatering

Varje dag (eller via cron):

```bash
curl -X POST http://localhost:3002/api/portfolio/update
```

Detta uppdaterar:
- ✅ Nuvarande pris från Yahoo Finance
- ✅ Trailing stop (baserat på EMA20 eller Higher Low)
- ✅ PnL % och R-multiple
- ✅ Exit-signaler (HOLD / EXIT / TIGHTEN_STOP)
- ✅ Dagar i trade

### 3. Agera på signaler

Öppna Dashboard och scanna förvaltningslistan (tar 10 sekunder):

```
🔴 EXIT | AAPL | ... | RSI overbought (72) - sälj innan reversal
🟡 TIGHTEN_STOP | VOLV-B | ... | +1.8R vinst - flytta stop till break-even
🟢 HOLD | MSFT | ... | null
```

**ACTION:** Sälj AAPL idag. Flytta stop för VOLV-B. MSFT - gör inget.

## 🧠 Exit-logik (portfolioLogic.js)

Systemet kontrollerar följande i prioritetsordning:

### 1. Stop Hit (🔴 EXIT)
```
Pris <= Trailing Stop → STOP_HIT
```

### 2. EMA20 Break (🔴 EXIT)
```
Pris < EMA20 → EXIT
"Pris under EMA20 - momentum bruten"
```

### 3. RSI Overbought (🔴 EXIT eller 🟠 PARTIAL_EXIT)
```
RSI >= 70 OCH R >= +2.0 → PARTIAL_EXIT
RSI >= 70 OCH R < +2.0 → EXIT
"RSI overbought (72) - skala ut 50%"
```

### 4. Tighten Stop (🟡 TIGHTEN_STOP)
```
R >= +1.5 OCH Pris > EMA20 × 1.05 → TIGHTEN_STOP
"+1.8R vinst - flytta stop till break-even eller EMA20"
```

### 5. Distribution Warning (🔴 EXIT)
```
Relativ Volym > 2.0 OCH PnL < -2% → EXIT
"Distribution-varning: Hög volym (2.3x) på nedgång"
```

### 6. Time Exit (🔴 EXIT)
```
Dagar >= 30 OCH |R| < 0.5 → EXIT
"30 dagar utan rörelse (<0.5R) - frigör kapital"
```

### 7. Hold (🟢 HOLD)
```
Ingen exit-signal → HOLD
```

## 💡 R-Multiple – Vad betyder det?

**R** = Risk per aktie (entry - stop)

**Exempel:**
```
Entry: 100 kr
Stop:  96 kr
R = 4 kr (risken)

Om pris går till 108 kr:
Vinst = 8 kr
R-multiple = 8 / 4 = +2.0R

→ Du vann 2× din risk
```

**Färgkodning:**
- 🟢 Grön: R >= +2.0 (utmärkt)
- 🔵 Blå: R >= +1.0 (bra)
- 🔴 Röd: R < 0 (förlust)

## 📊 Exempel på komplett position

```sql
ticker: VOLV-B.ST
entry_price: 241.0
entry_date: 2025-12-22
initial_stop: 237.0
initial_target: 249.0
initial_r: 4.0  (241 - 237)
trailing_type: EMA20

-- Efter 6 dagar (daglig uppdatering):
current_price: 248.5
current_stop: 244.0  (EMA20)
current_ema20: 244.0
current_rsi14: 58
pnl_pct: +3.1  ((248.5-241)/241 × 100)
r_multiple: +1.9  ((248.5-241)/4)
days_in_trade: 6
current_status: HOLD
exit_signal: null
```

## 🔧 Teknisk Implementation

### Filer som skapats/uppdaterats:

1. **lib/portfolioLogic.js** – Exit-logik
   - `updatePositionStatus()` – Huvudfunktion
   - `calculateRMultiple()` – R-beräkning
   - `calculateTrailingStop()` – Trailing stop
   - `suggestInitialStop()` – ATR-baserad stop

2. **server.js** – Ny endpoint
   - `POST /api/portfolio/update` – Daglig uppdatering

3. **src/components/Dashboard.jsx** – 10-kolumns tabell
   - Auto-sortering (EXIT först)
   - Färgkodning (PnL, R-multiple)
   - Exit-signaler under tabell

4. **PORTFOLIO_MIGRATION.md** – SQL-migration
   - Alla nya kolumner för exit-logik

## 🚀 Nästa steg

### 1. Kör SQL-migration

Öppna Supabase SQL Editor och kör SQL från [PORTFOLIO_MIGRATION.md](./PORTFOLIO_MIGRATION.md)

### 2. Testa med en position

```bash
# Lägg till en testposition via Dashboard/StockDetail

# Kör daglig uppdatering
curl -X POST http://localhost:3002/api/portfolio/update

# Kolla resultat i Dashboard
```

### 3. Automatisera daglig uppdatering

Skapa GitHub Actions workflow (se WATCHLIST_TRACKING.md för exempel)

```yaml
name: Daily Portfolio Update
on:
  schedule:
    - cron: '0 17 * * 1-5'  # Kl 18:00 svensk tid, vardagar
```

## 📝 Tips för bästa användning

### 🎯 Lägg till positioner med rätt data

När du lägger till position, se till att:
- **Initial stop** är satt (t.ex. entry - 2×ATR)
- **Target** är satt (t.ex. entry + 2R)
- **Trailing type** är EMA20 (default)

### 🔍 Scanna listan varje dag

**10-sekunders-regeln:**
1. Öppna Dashboard
2. Kolla förvaltningslistan (sorterad med EXIT först)
3. Agera på röda/orange signaler
4. Ignorera gröna (HOLD)

### 🚦 Respektera signalerna

Exit-logiken är byggd för att:
- ✅ Skydda vinster (trailing stop)
- ✅ Begränsa förluster (stop-loss)
- ✅ Undvika överköpta lägen (RSI)
- ✅ Frigöra kapital (time exit)

**Lita på systemet.**

## 🧪 Testscenario

### Scenario 1: Normal pullback-trade

```
Dag 1: Köp VOLV-B.ST @ 241 (stop 237, target 249)
Status: 🟢 HOLD

Dag 3: Pris 244 (+1.2%, +0.75R)
Status: 🟢 HOLD

Dag 6: Pris 248.5 (+3.1%, +1.9R)
Status: 🟡 TIGHTEN_STOP
Signal: "+1.9R vinst - flytta stop till break-even"
Action: Flytta stop från 237 → 241 (break-even)

Dag 8: Pris 252 (+4.6%, +2.75R)
Status: 🟡 TIGHTEN_STOP
Signal: "+2.75R vinst - skydda mer"
Action: Flytta stop till EMA20 (247)

Dag 10: Pris 246 (under EMA20)
Status: 🔴 EXIT
Signal: "Pris under EMA20 - momentum bruten"
Action: SÄLJ HELA
```

### Scenario 2: Stop hit

```
Dag 1: Köp AAPL @ 180 (stop 176, target 188)
Dag 2: Pris 175 (stop träffad)
Status: ⚫ STOP_HIT
Signal: "Stop träffad vid 176.00"
Action: Position automatiskt stängd
```

## 🎓 Sammanfattning

Förvaltningslistan ger dig:

✅ **Tydliga exit-signaler** – ingen gissning
✅ **Risk-baserad styrning** – R-multiple som guide
✅ **Automatisk trailing stop** – skydda vinster
✅ **10-sekunders överblick** – snabb daglig rutin
✅ **Kapitaleffektivitet** – time exits frigör pengar

**Detta är ditt "sell-side cockpit" – var disciplinerad och lita på logiken!**
