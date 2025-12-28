# Watchlist Tracking System

## Översikt

Detta system spårar aktier i bevakningslistan över tid och ger dagliga statusuppdateringar baserat på tekniska indikatorer. Perfekt för veckotrading.

## Hur det fungerar

### 1. När en aktie läggs till i watchlist

När du lägger till en aktie via Dashboard sparas:

**Initial snapshot** (frysning av nuläget):
- `initial_price` - Pris när aktien lades till
- `initial_ema20` - EMA20 vid tillägg
- `initial_ema50` - EMA50 vid tillägg
- `initial_rsi14` - RSI14 vid tillägg
- `initial_regime` - Trend när aktien lades till (Bullish/Bearish/Consolidation)
- `initial_setup` - Setup när aktien lades till (Pullback/Breakout/etc)

**Första statusen beräknas direkt**:
- `current_status` - Status just nu (WAIT_PULLBACK, APPROACHING, READY, etc)
- `current_action` - Vad ska göras (WAIT, PREPARE_ENTRY, etc)
- `status_reason` - Förklaring
- `dist_ema20_pct` - Avstånd till EMA20 i procent
- `rsi_zone` - RSI-zon (WEAK, CALM, WARM, HOT)
- `volume_state` - Volymläge (LOW, NORMAL, HIGH)

### 2. Daglig uppdatering

Varje dag (eller när du vill) kör du:

```bash
POST /api/watchlist/update
```

Detta:
1. Hämtar alla aktier i watchlist
2. För varje aktie:
   - Hämtar senaste market data
   - Beräknar tekniska indikatorer (EMA20, EMA50, RSI14)
   - Kör watchlist-logiken (se nedan)
   - Uppdaterar status i databasen

### 3. Watchlist-logiken (lib/watchlistLogic.js)

#### Steg 1: Trendens hälsa (hård invalidering)

Aktien **MÅSTE** ha:
- Pris över EMA50
- EMA50 lutande uppåt (slope > 0)
- Higher low (senaste låg högre än föregående)

Om **INTE** → Status: `INVALIDATED` → Action: `REMOVE_FROM_WATCHLIST`

#### Steg 2: Avstånd till EMA20

| Avstånd från EMA20 | Proximity |
|--------------------|-----------|
| > 4% | FAR |
| 2-4% | APPROACHING |
| 0-2% | NEAR |
| < 0% (under) | TOO_DEEP |

#### Steg 3: RSI Momentum Zoner

| RSI | Zone |
|-----|------|
| < 40 | WEAK |
| 40-55 | CALM |
| 55-65 | WARM |
| > 65 | HOT |

#### Steg 4: Statusmaskin

```
FAR + any momentum → WAIT_PULLBACK
  "För långt från EMA20"

APPROACHING + any → APPROACHING
  "Drar sig mot pullback"

NEAR + CALM momentum → READY ✅
  "Pullback nära + lugnt momentum"

ANY + HOT momentum → BREAKOUT_ONLY
  "Momentum för starkt - ingen pullback"

TOO_DEEP or WEAK → WAIT_PULLBACK
  "Pullback för djup eller momentum svagt"
```

#### Steg 5: Volymjustering

Om status är READY men volym är LOW:
→ Nedgraderas till APPROACHING
→ "Pullback nära men låg volym - vänta på bekräftelse"

#### Steg 6: Tidsvarning

Om aktien varit i watchlist > 10 dagar och status ≠ READY:
→ `time_warning`: "Lång väntan (X dagar) – överväg att rensa"

## Status → UI Mappning

| Status | UI | Betydelse |
|--------|-----|----------|
| `WAIT_PULLBACK` | 🔵 Vänta | För långt från entry eller för svagt momentum |
| `APPROACHING` | 🟡 Närmar sig | Pullback på gång, håll koll |
| `READY` | 🟢 Klar | Perfekt läge för entry! |
| `BREAKOUT_ONLY` | 🟠 Endast breakout | Momentum för starkt - antingen breakout eller vänta |
| `INVALIDATED` | 🔴 Ta bort | Trenden bruten - rensa från watchlist |

## API Endpoints

### POST /api/watchlist
Lägg till aktie i watchlist med initial snapshot.

**Request:**
```json
{
  "ticker": "VOLV-B.ST",
  "indicators": {
    "price": 248.5,
    "ema20": 246.0,
    "ema50": 238.4,
    "rsi14": 47.3,
    "regime": "Bullish Trend",
    "setup": "Pullback",
    "relativeVolume": 0.62
  }
}
```

**Response:**
```json
{
  "ticker": "VOLV-B.ST",
  "current_status": "READY",
  "current_action": "PREPARE_ENTRY",
  "status_reason": "Pullback nära + lugnt momentum (RSI 47)",
  "dist_ema20_pct": "1.02",
  "rsi_zone": "CALM",
  "volume_state": "LOW"
}
```

### POST /api/watchlist/update
Uppdatera alla aktier i watchlist (daglig batch).

**Response:**
```json
{
  "message": "Watchlist updated successfully",
  "updated": 4,
  "total": 4,
  "results": [
    {
      "ticker": "VOLV-B.ST",
      "status": "READY",
      "action": "PREPARE_ENTRY",
      "reason": "Pullback nära + lugnt momentum (RSI 47)"
    },
    {
      "ticker": "INVE-A.ST",
      "status": "APPROACHING",
      "action": "WAIT",
      "reason": "Drar sig mot pullback (3.2%)"
    }
  ]
}
```

### GET /api/watchlist
Hämta alla aktier i watchlist med senaste status.

**Response:**
```json
{
  "stocks": [
    {
      "ticker": "VOLV-B.ST",
      "added_at": "2025-12-20T10:00:00",
      "initial_price": 245.0,
      "initial_regime": "Bullish Trend",
      "last_updated": "2025-12-27",
      "current_status": "READY",
      "current_action": "PREPARE_ENTRY",
      "status_reason": "Pullback nära + lugnt momentum (RSI 47)",
      "dist_ema20_pct": "1.02",
      "rsi_zone": "CALM",
      "volume_state": "LOW",
      "days_in_watchlist": 7,
      "time_warning": null
    }
  ]
}
```

## Databasschema

Kör denna SQL i Supabase för att aktivera funktionen:

```sql
-- Se SUPABASE_MIGRATION.md för fullständig migration
-- Här är watchlist-tabellen:

CREATE TABLE IF NOT EXISTS watchlist (
  ticker TEXT PRIMARY KEY,
  added_at TIMESTAMP DEFAULT NOW(),

  -- Initial snapshot när aktien lades till
  initial_price DECIMAL(10, 2),
  initial_ema20 DECIMAL(10, 2),
  initial_ema50 DECIMAL(10, 2),
  initial_rsi14 DECIMAL(5, 2),
  initial_regime TEXT,
  initial_setup TEXT,

  -- Senaste dagliga uppdatering
  last_updated DATE,
  current_status TEXT DEFAULT 'WAIT_PULLBACK',
  current_action TEXT DEFAULT 'WAIT',
  status_reason TEXT,

  -- Diagnostics från senaste uppdatering
  dist_ema20_pct DECIMAL(6, 2),
  rsi_zone TEXT,
  volume_state TEXT,
  time_warning TEXT,

  -- Räknare
  days_in_watchlist INTEGER DEFAULT 0,

  -- Extra metadata
  notes TEXT
);
```

## Daglig rutin (manuell eller automatiserad)

### Manuellt (via frontend eller curl)

```bash
# Uppdatera alla watchlist-aktier
curl -X POST http://localhost:3002/api/watchlist/update
```

### Automatiserat (cron job eller GitHub Actions)

**Exempel - GitHub Actions (varje dag kl 18:00):**

```yaml
name: Update Watchlist
on:
  schedule:
    - cron: '0 18 * * 1-5'  # Måndag-fredag kl 18:00 UTC
  workflow_dispatch:  # Tillåt manuell trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Update watchlist
        run: |
          curl -X POST https://weekly-trading-ai.vercel.app/api/watchlist/update
```

**Exempel - Cron job (lokal server):**

```bash
# Lägg till i crontab (crontab -e)
0 18 * * 1-5 curl -X POST http://localhost:3002/api/watchlist/update
```

## Exempel: Volvo B dag-för-dag

### Dag 1 (2025-12-20) - Läggs till i watchlist

```
Input:
  Price: 245.0
  EMA20: 243.0 (+0.8%)
  EMA50: 235.0
  RSI: 58

Output:
  Status: APPROACHING
  Action: WAIT
  Reason: "Drar sig mot pullback (0.8%)"
```

### Dag 3 (2025-12-22) - Pullback närmar sig

```
Input:
  Price: 246.5
  EMA20: 245.0 (+0.6%)
  EMA50: 236.0
  RSI: 52

Output:
  Status: APPROACHING
  Action: WAIT
  Reason: "Drar sig mot pullback (0.6%)"
```

### Dag 6 (2025-12-27) - KLAR FÖR ENTRY!

```
Input:
  Price: 248.5
  EMA20: 246.0 (+1.0%)
  EMA50: 238.4
  RSI: 47.3
  RelVol: 0.62

Output:
  Status: READY ✅
  Action: PREPARE_ENTRY
  Reason: "Pullback nära + lugnt momentum (RSI 47)"
```

### Dag 12 (2026-01-05) - Tidsvarning

```
Input:
  Price: 252.0
  EMA20: 248.0 (+1.6%)
  EMA50: 242.0
  RSI: 61
  Days: 12

Output:
  Status: APPROACHING
  Action: WAIT
  Reason: "Drar sig mot pullback (1.6%)"
  TimeWarning: "Lång väntan (12 dagar) – överväg att rensa"
```

## Nästa steg: UI-integration

Se nästa sektion för hur Dashboard.jsx ska visa denna data!
