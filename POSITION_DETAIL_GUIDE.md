# Position Detail View - Komplett Guide

## 🎯 Syfte

Position Detail View är din **trade cockpit per aktie** – den vy du öppnar varje dag för att svara på:

1. **Vad är planen?** (Entry journal)
2. **Måste jag agera idag?** (Exit-status)
3. **Vad har hänt?** (Händelselogg)
4. **Vad lärde jag mig?** (Post-exit journal)

Detta är **kärnan i din edge över tid** – inte bara för att hantera risk, utan för att systematiskt förbättra ditt beslutsfattande.

---

## 📋 Vad visas i Position Detail View?

### 1️⃣ HEADER - Position Snapshot

**Alltid synligt högst upp:**

```
VOLV-B   🟢 HOLD     +1.6R   +3.1%     6 dagar
```

- **Aktie**: Ticker
- **Status**: HOLD / TIGHTEN_STOP / PARTIAL_EXIT / EXIT / STOP_HIT
- **R-multiple**: Hur många R du är i vinst/förlust
- **PnL %**: Procent vinst/förlust
- **Dagar**: Antal dagar i trade
- **Entry-datum**: När du köpte

👉 **På 1 sekund vet du om du måste agera.**

---

### 2️⃣ ENTRY JOURNAL (🔒 Låst)

**Detta är din "orörliga sanning"** – vad du visste när du tog traden.

| Fält           | Beskrivning                      |
| -------------- | -------------------------------- |
| Entry-datum    | När du köpte                     |
| Entry-pris     | Pris vid köp                     |
| Position size  | Antal aktier                     |
| Initial risk   | R per aktie (entry - stop)       |
| Initial stop   | Ursprunglig stop-loss            |
| Target         | Initial target (+2R eller liknande) |
| Setup          | Pullback / Breakout / etc        |

**Entry Rationale (viktigt!):**

> *"Pullback mot EMA20 i stark upptrend. RSI 47 (CALM-zon). Låg volym i rekyl vilket indikerar sund profit-taking utan distribution."*

📌 **Varför detta är viktigt:**
- Efter 50 trades kan du analysera: "Vilka entry-rationales har högst winrate?"
- Du bygger en edge genom att lära dig vilka setups som faktiskt fungerar för DIG

---

### 3️⃣ AKTUELL FÖRVALTNING

**Live risk & exit-status:**

| Fält              | Beskrivning                           |
| ----------------- | ------------------------------------- |
| Aktuellt pris     | Senaste pris från daglig uppdatering  |
| Stop (nu)         | Trailing stop (EMA20 eller Higher Low) |
| Avstånd till stop | % till stop (röd om <2%)              |
| Trailing-metod    | EMA20 / HL                            |
| Target kvar       | % till target                         |
| R nu              | Nuvarande R-multiple                  |

**Exit-status (maskinellt från portfolioLogic.js):**

```
🟢 HOLD
Orsak: Pris över EMA20, ingen distribution
```

eller

```
🔴 EXIT
Orsak: Close under EMA20 + volymspike
```

👉 **Detta kommer direkt från din sell-decision-engine** – ingen gissning.

**Quick Actions:**
- 🔘 Flytta stop till break-even
- 📝 Lägg till notering

---

### 4️⃣ TIDSAXEL / HÄNDELSELOGG

**Append-only log över allt som hänt:**

```
2025-12-27  ENTRY        Köpt 1000 @ 241.00
2025-12-30  STOP_MOVED   Stop flyttad: 237.00 → 241.00 (break-even)
2026-01-02  NOTE         Volym ovanligt hög idag
2026-01-02  PARTIAL_EXIT Sålt 300 aktier @ 250.00 (kvar: 700)
2026-01-05  HOLD         Ingen åtgärd
2026-01-08  EXIT         Sålt hela positionen @ 253.20 (+2.4R)
```

📌 **Detta är guld för efteranalys:**
- "Var jag för snabb med partial exit?"
- "Följde jag planen?"
- "Vad hände egentligen på vägen?"

---

### 5️⃣ POST-EXIT JOURNAL (visas efter exit)

**När du stänger traden får du fylla i:**

#### Exit-fakta
- Exit-datum
- Exit-pris (snitt om partial)
- Resultat (R-multiple)
- Exit-typ (FULL / PARTIAL / STOP_HIT)

#### Självutvärdering (checklist)
- ✅ Följde planen
- ⚠️ Tog exit för tidigt
- ✅ Lät marknaden slå ut mig
- ⚠️ Bra entry men dålig exit
- ❌ Bröt mot regler

#### Lärdom (fri text)
> *"Del-exit vid +2R fungerade bra. Kunde hållit sista delen längre eftersom EMA20 inte bröts förrän 3 dagar senare. Nästa gång: exitera 50% vid +2R, men låt resten rida till EMA20-break eller +5R."*

📌 **Detta är där din edge faktiskt byggs.**

---

## 🔄 Komplett Trade Lifecycle

### Steg 1: ENTRY (från StockDetail)

1. Screener → Watchlist → READY
2. Öppna StockDetail
3. Analysera chart + AI + backtest
4. Klicka "Lägg till i Portfolio"
5. **Ange entry rationale** (viktigt!)
6. Entry-event skapas automatiskt i händelseloggen

### Steg 2: FÖRVALTNING (daglig rutin)

1. Kör daglig uppdatering (backend):
   ```bash
   curl -X POST http://localhost:3002/api/portfolio/update
   ```

2. Öppna Dashboard → Scanna förvaltningslistan:
   - 🟢 HOLD → Gör inget
   - 🟡 TIGHTEN_STOP → Klicka på position → Flytta stop
   - 🟠 PARTIAL_EXIT → Klicka → Exitera 50%
   - 🔴 EXIT → Klicka → Säljformulär

3. När du klickar på en position i förvaltningslistan:
   - Position Detail View öppnas
   - Se exit-status + rationale
   - Agera enligt signal

### Steg 3: EXIT (när du säljer)

1. I Position Detail, klicka "Exit Position"
2. Välj exit-typ:
   - **FULL**: Sälja allt
   - **PARTIAL**: Sälja 50% (eller custom)
   - **STOP_HIT**: Stop träffad

3. Fyll i själv utvärdering (checklist)
4. Skriv lärdom (fri text)
5. Klicka "Bekräfta Exit"

👉 Position markeras som EXITED, post-exit journal visas

---

## 🧠 Varför detta system fungerar

### Problem med "vanlig" trading journal:
- ❌ Separate exit loggen från entry-beslutet
- ❌ Glömmer varför du tog traden
- ❌ Ingen koppling mellan plan och utfall
- ❌ Svårt att se mönster över tid

### Solution med Position Detail View:
- ✅ Allt på ett ställe: entry → förvaltning → exit → lärdom
- ✅ Entry rationale låst (kan inte ändra i efterhand)
- ✅ Händelselogg visar exakt vad du gjorde
- ✅ Självutvärdering tvingar dig att reflektera
- ✅ Efter 50 trades: analysera mönster och förbättra

---

## 📊 Exempel på komplett trade

### VOLV-B.ST - Pullback Trade

**1. Entry Journal (2025-12-27)**
```
Entry-pris: 241.00
Antal: 1000 aktier
Initial stop: 237.00
Target: 249.00
R: 4.00 kr/aktie
Setup: Pullback

Entry rationale:
"Pullback mot EMA20 i stark upptrend. RSI 47 (CALM-zon).
Låg volym i rekyl vilket indikerar sund profit-taking
utan distribution. Higher low bekräftad. Tight stop under
previous day low."
```

**2. Händelselogg**
```
2025-12-27  ENTRY        Köpt 1000 @ 241.00
2025-12-30  STOP_MOVED   Stop flyttad: 237.00 → 241.00 (BE)
2026-01-02  NOTE         Rapport Q4 imorgon - vänta
2026-01-03  NOTE         Rapport positiv, volym hög
2026-01-03  TIGHTEN_STOP +2.0R nådd, flytta stop till 244.00
2026-01-05  PARTIAL_EXIT Sålt 500 aktier @ 250.00 (kvar: 500)
2026-01-08  EXIT         Sålt resterande 500 @ 253.20
```

**3. Post-Exit Journal**
```
Exit-datum: 2026-01-08
Exit-pris: 251.60 (snitt av 250.00 och 253.20)
Resultat: +2.65R
Exit-typ: Partial → Full

Självutvärdering:
✅ Följde planen
⚠️ Tog exit för tidigt (första 50%)
✅ Lät marknaden slå ut mig (andra 50%)
❌ Bra entry men dålig exit (nej, entry var bra)
❌ Bröt mot regler (nej)

Lärdom:
"Partial exit vid +2R fungerade bra för att säkra vinst.
Andra halvan kunde hållas längre - EMA20 bröts 3 dagar
senare vid 258. Nästa gång: partial vid +2R, men lägg
stop på entry-pris för resten och låt den rida till
EMA20-break. Entry-timing var perfekt - låg RSI + låg
volym + higher low."
```

---

## 🚀 Nästa steg: Implementera

### 1. Kör SQL-migration

Öppna Supabase SQL Editor och kör [POSITION_DETAIL_MIGRATION.md](./POSITION_DETAIL_MIGRATION.md)

### 2. Lägg till entry rationale för befintliga positioner

```sql
UPDATE portfolio
SET entry_rationale = 'Skriv varför du tog traden här'
WHERE ticker = 'DITT-TICKER';
```

### 3. Testa Position Detail View

1. Öppna Dashboard
2. Klicka på en position i förvaltningslistan
3. Position Detail öppnas
4. Se entry journal, exit-status, händelselogg

### 4. Exitera en testposition

1. Klicka "Exit Position"
2. Välj FULL eller PARTIAL
3. Fyll i själv utvärdering
4. Skriv lärdom
5. Bekräfta

---

## 💡 Pro Tips

### Entry Rationale Best Practices
- Skriv VARFÖR, inte VAD
  - ❌ "RSI 47"
  - ✅ "RSI 47 (CALM-zon) vilket ger utrymme för uppgång utan att vara oversold"

- Inkludera:
  - Teknisk setup (pullback, breakout, etc)
  - RSI-zon + implication
  - Volym (distribution-varning eller inte)
  - Trend-kontext (higher low? EMA alignment?)

### Händelseloggen
- Lägg till notes när något ovanligt händer:
  - Rapport inom 3 dagar
  - Volymspike
  - Gap up/down
  - Sektorrotation

### Lärdom Best Practices
- Fokusera på vad du kan kontrollera:
  - ❌ "Marknaden gick ner" (okontrollerbart)
  - ✅ "Följde planen och tog exit vid EMA20-break" (kontrollerbart)

- Skriv konkreta action items:
  - ❌ "Bättre timing nästa gång"
  - ✅ "Nästa pullback: vänta på RSI <45 OCH låg volym samtidigt"

---

## 🎯 Sammanfattning

Position Detail View ger dig:

✅ **Entry journal** – Vad visste du när du köpte?
✅ **Exit-status** – Måste du agera idag?
✅ **Händelselogg** – Vad hände på vägen?
✅ **Post-exit journal** – Vad lärde du dig?

**Detta är inte bara en journal – det är din edge-building machine.**

Efter 50 trades med full dokumentation kan du:
- Se vilka setups som fungerar bäst
- Identifiera dina psykologiska mönster
- Förbättra din exit-timing
- Bygga en personlig playbook

**Din edge över tid = systematisk reflektion efter varje trade.**
