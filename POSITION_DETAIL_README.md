# Position Detail System - README

## 📦 Vad har implementerats?

Ett komplett **Position Detail View**-system som är hjärtat i din trade management – din "black box + cockpit" per position.

---

## 🧩 Komponenter

### Frontend
- **[src/components/PositionDetail.jsx](src/components/PositionDetail.jsx)** (ny)
  - 5-sektions vy: Header, Entry Journal, Aktuell Förvaltning, Händelselogg, Post-Exit Journal
  - Exit-formulär med självutvärdering
  - Note-formulär för händelselogg
  - Quick actions (flytta stop till break-even)

### Backend (server.js)
- `GET /api/portfolio/events?ticker=X` - Hämta händelselogg
- `POST /api/portfolio/exit/:ticker` - Exitera position (full/partial/stop)
- `POST /api/portfolio/notes/:ticker` - Lägg till notering
- `POST /api/portfolio/move-stop/:ticker` - Flytta stop

### Database
- **[POSITION_DETAIL_MIGRATION.md](POSITION_DETAIL_MIGRATION.md)**
  - Ny tabell: `portfolio_events` (händelselogg)
  - Nya kolumner i `portfolio`: exit_date, exit_price, exit_type, entry_rationale, lessons_learned, exit_checklist

### Integration
- **[src/App.jsx](src/App.jsx)** - Ny route för `position-detail`
- **[src/components/Dashboard.jsx](src/components/Dashboard.jsx)** - Klick på förvaltningslista öppnar Position Detail

### Dokumentation
- **[POSITION_DETAIL_GUIDE.md](POSITION_DETAIL_GUIDE.md)** - Komplett användarguide
- **[POSITION_DETAIL_MIGRATION.md](POSITION_DETAIL_MIGRATION.md)** - SQL-migration
- **POSITION_DETAIL_README.md** (denna fil) - Teknisk översikt

---

## 🚀 Setup

### 1. Kör SQL-migration

```bash
# Öppna Supabase SQL Editor
# Kör all SQL från POSITION_DETAIL_MIGRATION.md
```

### 2. Testa systemet

```bash
# Starta backend
npm run server

# Starta frontend (i ny terminal)
npm run dev

# Öppna http://localhost:5174
```

### 3. Workflow

1. **Öppna Dashboard**
2. **Klicka på en position** i förvaltningslistan
3. **Position Detail öppnas**
4. **Se:**
   - Entry journal (varför tog du traden?)
   - Exit-status (måste du agera?)
   - Händelselogg (vad har hänt?)
5. **Agera:**
   - Flytta stop till break-even
   - Lägg till notering
   - Exitera position (full/partial)

---

## 📋 5 Sektioner i Position Detail

### 1️⃣ HEADER - Position Snapshot
```
VOLV-B   🟢 HOLD     +1.6R   +3.1%     6 dagar
```

### 2️⃣ ENTRY JOURNAL (🔒 Låst)
- Entry-datum, pris, quantity, risk
- Initial stop, target, setup
- **Entry rationale** (viktigast!)

### 3️⃣ AKTUELL FÖRVALTNING
- Live pris, stop, R-multiple
- **Exit-status** (från portfolioLogic.js)
- Quick actions (flytta stop, lägg till note)

### 4️⃣ HÄNDELSELOGG
```
2025-12-27  ENTRY        Köpt 1000 @ 241.00
2025-12-30  STOP_MOVED   Stop flyttad: 237.00 → 241.00
2026-01-02  PARTIAL_EXIT Sålt 300 @ 250.00
```

### 5️⃣ POST-EXIT JOURNAL (efter exit)
- Exit-fakta (datum, pris, R-resultat)
- **Självutvärdering** (checklist)
- **Lärdom** (fri text)

---

## 🔄 Trade Lifecycle

```
SCREENER
  ↓
WATCHLIST
  ↓ (READY)
STOCK DETAIL (analys)
  ↓ (Lägg till i Portfolio)
FÖRVALTNINGSLISTA
  ↓ (klicka på position)
POSITION DETAIL
  ↓ (daglig förvaltning)
EXIT + POST-EXIT JOURNAL
  ↓
LÄRDOM & EDGE-BUILDING
```

---

## 🧠 Varför detta är viktigt

### Problem med traditionell trading journal:
- ❌ Entry och exit separata
- ❌ Ingen koppling mellan plan och utfall
- ❌ Glömmer varför du tog traden
- ❌ Svårt att identifiera mönster

### Lösning med Position Detail:
- ✅ Allt på ett ställe (entry → förvaltning → exit → lärdom)
- ✅ Entry rationale låst (kan inte ändra i efterhand)
- ✅ Händelselogg visar exakt vad du gjorde
- ✅ Självutvärdering tvingar reflektion
- ✅ Efter 50 trades: **analysera mönster och förbättra**

---

## 📊 API Endpoints

### GET /api/portfolio/events?ticker=VOLV-B.ST
Hämta händelselogg för en position.

**Response:**
```json
{
  "events": [
    {
      "id": 1,
      "ticker": "VOLV-B.ST",
      "event_date": "2025-12-27",
      "event_type": "ENTRY",
      "description": "Köpt 1000 aktier @ 241.00",
      "created_at": "2025-12-27T10:00:00Z"
    },
    {
      "id": 2,
      "ticker": "VOLV-B.ST",
      "event_date": "2025-12-30",
      "event_type": "STOP_MOVED",
      "description": "Stop flyttad: 237.00 → 241.00",
      "created_at": "2025-12-30T14:23:00Z"
    }
  ]
}
```

### POST /api/portfolio/exit/:ticker
Exitera en position.

**Request:**
```json
{
  "exit_type": "FULL",
  "exit_price": 253.20,
  "lessons_learned": "Partial exit vid +2R fungerade bra...",
  "followed_plan": true,
  "exit_too_early": false,
  "let_market_decide": true,
  "good_entry_bad_exit": false,
  "broke_rules": false
}
```

**Exit types:**
- `FULL` - Sälja allt
- `PARTIAL` - Sälja del (exit_quantity krävs)
- `STOP_HIT` - Stop träffad

### POST /api/portfolio/notes/:ticker
Lägg till notering.

**Request:**
```json
{
  "note": "Volym ovanligt hög idag - rapport imorgon"
}
```

### POST /api/portfolio/move-stop/:ticker
Flytta stop.

**Request:**
```json
{
  "new_stop": 241.00
}
```

---

## 🗄️ Database Schema

### portfolio_events
```sql
CREATE TABLE portfolio_events (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL, -- ENTRY, EXIT, PARTIAL_EXIT, STOP_HIT, STOP_MOVED, NOTE
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### portfolio (nya kolumner)
```sql
ALTER TABLE portfolio ADD COLUMN exit_date DATE;
ALTER TABLE portfolio ADD COLUMN exit_price NUMERIC(10, 2);
ALTER TABLE portfolio ADD COLUMN exit_type TEXT;
ALTER TABLE portfolio ADD COLUMN entry_rationale TEXT;
ALTER TABLE portfolio ADD COLUMN lessons_learned TEXT;
ALTER TABLE portfolio ADD COLUMN exit_checklist JSONB;
```

---

## 💡 Best Practices

### Entry Rationale
Skriv VARFÖR, inte VAD:

❌ **Dåligt:**
```
"RSI 47"
```

✅ **Bra:**
```
"Pullback mot EMA20 i stark upptrend. RSI 47 (CALM-zon)
vilket ger utrymme för uppgång utan att vara oversold.
Låg volym i rekyl = sund profit-taking, inte distribution.
Higher low bekräftad vid 240."
```

### Lärdom
Fokusera på det du kan kontrollera:

❌ **Dåligt:**
```
"Marknaden gick ner"
```

✅ **Bra:**
```
"Följde planen och tog exit vid EMA20-break. Partial exit
vid +2R fungerade bra. Nästa gång: låt andra halvan rida
till EMA20-break istället för att sälja för tidigt vid +2.5R."
```

---

## 🎯 Komplett Exempel: VOLV-B Trade

### Entry (2025-12-27)
```
Entry: 241.00
Stop: 237.00
Target: 249.00
R: 4.00 kr
Quantity: 1000 aktier

Entry rationale:
"Pullback mot EMA20 i stark upptrend. RSI 47 (CALM).
Låg volym i rekyl. Higher low vid 240. Tight stop under
previous day low ger 1:2 R/R till target."
```

### Händelselogg
```
2025-12-27  ENTRY        Köpt 1000 @ 241.00
2025-12-30  STOP_MOVED   Stop flyttad: 237.00 → 241.00 (BE)
2026-01-02  NOTE         Rapport Q4 imorgon
2026-01-03  TIGHTEN_STOP +2.0R nådd, flytta stop till 244.00
2026-01-05  PARTIAL_EXIT Sålt 500 @ 250.00 (kvar: 500)
2026-01-08  EXIT         Sålt 500 @ 253.20
```

### Post-Exit
```
Exit-pris: 251.60 (snitt)
Resultat: +2.65R
Exit-typ: Partial → Full

Självutvärdering:
✅ Följde planen
⚠️ Tog exit för tidigt (första 50%)
✅ Lät marknaden slå ut mig (andra 50%)

Lärdom:
"Partial exit vid +2R säkrade vinst och minskade stress.
Andra halvan kunde hållas längre - EMA20 bröts 3 dagar
senare vid 258. Nästa gång: partial vid +2R, men lägg
stop på entry för resten och låt den rida till EMA20-break.
Entry-timing perfekt - låg RSI + låg volym + HL."
```

---

## 📚 Filer

| Fil | Beskrivning |
|-----|-------------|
| [src/components/PositionDetail.jsx](src/components/PositionDetail.jsx) | React-komponent för Position Detail View |
| [server.js](server.js) | Backend endpoints (events, exit, notes, move-stop) |
| [src/App.jsx](src/App.jsx) | Routing till Position Detail |
| [src/components/Dashboard.jsx](src/components/Dashboard.jsx) | Integration med förvaltningslista |
| [POSITION_DETAIL_MIGRATION.md](POSITION_DETAIL_MIGRATION.md) | SQL-migration |
| [POSITION_DETAIL_GUIDE.md](POSITION_DETAIL_GUIDE.md) | Användarguide |
| POSITION_DETAIL_README.md | Detta dokument |

---

## ✅ Nästa Steg

1. **Kör SQL-migration** i Supabase
2. **Testa Position Detail** genom att klicka på en position i Dashboard
3. **Lägg till entry rationale** för befintliga positioner
4. **Exitera en testposition** och fyll i post-exit journal
5. **Efter 50 trades:** Analysera mönster och förbättra

---

## 🎯 Sammanfattning

Position Detail View ger dig:

✅ Entry journal – Vad visste du när du köpte?
✅ Exit-status – Måste du agera idag?
✅ Händelselogg – Vad hände på vägen?
✅ Post-exit journal – Vad lärde du dig?

**Detta är din edge-building machine.**

Din edge över tid = systematisk reflektion efter varje trade.
