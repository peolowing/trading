# Weekly Trading AI - Teknisk Specifikation

**Version:** 2.1 (Fas 1 - Statistisk Robusthet)
**Datum:** 2026-01-01
**Applikation:** Swing Trading Decision System för svenska aktier

---

## 1. ÖVERSIKT

### 1.1 Syfte
Automatiserad bevakningslista för swing trading med fokus på pullback-strategier på svenska aktier (Stockholm Stock Exchange). Systemet analyserar tekniska indikatorer, backtestade edge-scores och beslutslogik för att generera trade-signaler.

### 1.2 Arkitektur
- **Frontend:** React (Vite)
- **Backend:** Node.js serverless functions (Vercel)
- **Databas:** Supabase (PostgreSQL)
- **Dataflöde:** Yahoo Finance → Teknisk analys → Beslutslogik → UI
- **AI-analys:** OpenAI GPT-4o-mini för kontextuell analys

### 1.3 Kärnfiler
- `lib/watchlistLogic.js` - Huvudbeslutslogik (pure functions)
- `api/watchlist.js` - API för bevakningslista (update/CRUD)
- `api/analyze.js` - Teknisk analys och backtest
- `src/components/Dashboard.jsx` - UI för bevakningslista

---

## 2. TEKNISKA INDIKATORER

### 2.1 Exponential Moving Averages (EMA)

**EMA20 - Kortsiktig trend**
```javascript
// Beräkning via technicalindicators.js
const ema20 = EMA.calculate({ period: 20, values: closes });

// FAS 1 FIX #2: Slope över 5 dagar (mindre bruskänslig)
const ema20_slope = (current - ema20Series[length - 6]) / ema20Series[length - 6];
```
- **Input:** Dagliga stängningskurser (senaste 60+ dagar)
- **Output:** Array av EMA20-värden
- **Användning:** Proximitetsberäkning, trendvalidering
- **Kritisk tröskel:** Slope > 0 (stigande)
- **🆕 FAS 1:** Slope beräknas nu över 5 dagar istället för 1 dag för att minska brus

**EMA50 - Långsiktig trend**
```javascript
const ema50 = EMA.calculate({ period: 50, values: closes });

// FAS 1 FIX #2: Slope över 5 dagar (mindre bruskänslig)
const ema50_slope = (current - ema50Series[length - 6]) / ema50Series[length - 6];
```
- **Input:** Dagliga stängningskurser (senaste 100+ dagar)
- **Output:** Array av EMA50-värden
- **Användning:** Trendfilter, support-nivå
- **Kritisk tröskel:** Slope > 0 (stigande)
- **🆕 FAS 1:** Slope beräknas nu över 5 dagar istället för 1 dag för att minska brus

### 2.2 Relative Strength Index (RSI)

```javascript
const rsi14 = RSI.calculate({ period: 14, values: closes });
```

**RSI-zoner (beslutslogik):**
```javascript
function rsiZone(rsi) {
  if (rsi < 40) return "WEAK";      // Översålt
  if (rsi <= 55) return "CALM";     // Neutralt (optimal för pullback)
  if (rsi <= 65) return "WARM";     // Lätt överköpt
  return "HOT";                     // Överköpt (breakout-läge)
}
```

| Zon | RSI-range | Betydelse | Trading-implikation |
|-----|-----------|-----------|-------------------|
| WEAK | <40 | Översålt, svag momentum | Vänta på återhämtning |
| CALM | 40-55 | Neutralt, balanserat | **Optimal för pullback entry** |
| WARM | 56-65 | Lätt överköpt | Varning, nära breakout |
| HOT | >65 | Överköpt, starkt momentum | Endast breakout-strategi |

### 2.3 Relativ Volym

```javascript
// Genomsnittlig volym senaste 20 dagarna
const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;

// Relativ volym (dagens volym / genomsnitt)
const relativeVolume = currentVolume / avgVolume;
```

**Volymstater:**
```javascript
const volumeState =
  relVol > 1.5 ? "HIGH" :      // Hög aktivitet
  relVol < 0.5 ? "LOW" :       // Låg aktivitet
  "NORMAL";                    // Normal aktivitet
```

| Tillstånd | relVol | Betydelse | Trading-implikation |
|-----------|--------|-----------|-------------------|
| LOW | <0.5x | Låg likviditet | Blockerar READY |
| NORMAL | 0.5-1.5x | Normal handel | Accepteras ej för READY |
| HIGH | >1.5x | Hög aktivitet | Bekräftelse av move |

**Kritiska trösklar:**
- **READY:** Kräver ≥1.0x
- **BREAKOUT_READY:** Kräver ≥1.2x

### 2.4 Strukturell Analys (Higher Lows)

```javascript
export function hasHigherLow(candles) {
  if (candles.length < 5) return false;

  const recentLows = candles.slice(-5).map(c => c.low);

  // Kräv sekvens av 3 stigande lows
  return recentLows[4] > recentLows[3] &&
         recentLows[3] > recentLows[2];
}
```

**Input:** Senaste 5 dagars candles
**Output:** Boolean (true = strukturen intakt)
**Logik:** De tre senaste dagarna måste ha stigande lågpunkter

**Före förbättring #4:**
```javascript
// Gammal logik (för generös)
const currentLow = lows[lows.length - 1];
const prevLow = Math.min(...lows.slice(0, -1));
return currentLow > prevLow;  // Bara 1 högre låg
```

**Effekt:** Skärpt krav på strukturell styrka, minskar falska "trendOk"

---

## 3. AVSTÅND TILL EMA20 (PROXIMITY)

### 3.1 Beräkning

```javascript
function ema20DistancePct(close, ema20) {
  return ((close - ema20) / ema20) * 100;
}
```

**Exempel:**
- Pris: 100 SEK, EMA20: 98 SEK → distEma20 = 2.04%
- Pris: 97 SEK, EMA20: 100 SEK → distEma20 = -3.0%

### 3.2 Proximity-zoner

```javascript
let proximity;
if (distEma20 > 4) proximity = "FAR";           // >4% över EMA20
else if (distEma20 > 2) proximity = "APPROACHING";  // 2-4% över
else if (distEma20 > 1) proximity = "NEAR";         // 1-2% över
else if (distEma20 >= 0) proximity = "PERFECT";     // 0-1% över (sweet spot)
else proximity = "TOO_DEEP";                        // Under EMA20
```

| Zon | Distans | Betydelse | Trading-action |
|-----|---------|-----------|----------------|
| FAR | >4% | För långt från support | WAIT_PULLBACK |
| APPROACHING | 2-4% | Närmar sig pullback-zon | APPROACHING |
| NEAR | 1-2% | Pullback-zon | READY (om villkor OK) |
| **PERFECT** | **0-1%** | **Optimal entry-zon** | **READY (prioritet)** |
| TOO_DEEP | <0% | Under EMA20, för djup | WAIT_PULLBACK |

**Kritiska insikter:**
- PERFECT-zonen (0-1%) ger "🎯 OPTIMAL" i UI
- NEAR-zonen (1-2%) är fortfarande acceptabel men mindre optimal
- Allt under EMA20 betraktas som "bruten pullback"

---

## 4. EDGE SCORE (BACKTEST-KVALITET)

### 4.1 Beräkning

Edge score beräknas från backtest-data för varje strategi på varje ticker:

```javascript
// Från backtest-resultat
const edge_score = (backtest.winRate * backtest.avgWinLoss * 100);
```

**Komponenter:**
- `winRate`: Andel vinnande trades (0-1)
- `avgWinLoss`: Genomsnittlig vinst/förlust-ratio
- Multipliceras till procentuell "edge"

**Exempel:**
- WinRate: 60% (0.6)
- Avg Win/Loss: 1.5
- Edge = 0.6 × 1.5 × 100 = 90%

### 4.2 Edge-klassificering

| Edge Score | Kvalitet | Trading-beslut |
|-----------|----------|----------------|
| ≥80% | Excellent | Hög prioritet |
| 70-79% | Good | Acceptabel för READY |
| 60-69% | Fair | Diskretionär entry |
| 50-59% | Weak | Endast i kombination med stark teknik |
| <50% | Poor | Undvik |

### 4.3 Kritisk tröskel

```javascript
// KRITISK FÖRBÄTTRING #1
if ((status === "READY" || status === "BREAKOUT_READY") &&
    edge_score < 70) {
  status = "APPROACHING";
  reason = "Tekniskt setup OK men edge för svag (X%, kräver ≥70%)";
}
```

**Motivering:** En setup med edge <70% har historiskt underpresterande avkastning

---

## 5. BESLUTSLOGIK - STATUSMASKIN

### 5.1 Flödesschema

```
Input: price, indicators, volume, structure, edge_score
  ↓
[1] TRENDVALIDERING (hård invalidering)
  ↓ (pass)
[2] PROXIMITY-beräkning (avstånd till EMA20)
  ↓
[3] MOMENTUM-klassificering (RSI-zon)
  ↓
[4] STATUSMASKIN (preliminär status)
  ↓
[5] EDGE-FILTER (≥70% för READY/BREAKOUT_READY)
  ↓
[6] COOLDOWN-CHECK (dagar sedan INVALIDATED)
  ↓
[7] TIDSBASERAD HANTERING (auto-remove vid 15d)
  ↓
Output: status, action, reason, diagnostics
```

### 5.2 Steg 1: Trendvalidering (Hård invalidering)

```javascript
const trendOk =
  close > ema20 &&              // Pris över kortsiktig trend
  ema20 > ema50 &&              // Bullish EMA-ordning
  ema50_slope > 0 &&            // Långsiktig trend stigande
  ema20_slope > 0 &&            // Kortsiktig trend stigande
  structure.higherLow === true; // Strukturell styrka
```

**Om !trendOk → INVALIDATED**
```javascript
return {
  status: "INVALIDATED",
  action: "REMOVE_FROM_WATCHLIST",
  reason: "Trend bruten (kräver pris > EMA20 > EMA50, positiva slopes och högre låg)",
  lastInvalidatedDate: today  // Sparas för cooldown
};
```

**Kritiska krav (ALLA måste vara sanna):**
1. Pris > EMA20 (inte bara >EMA50 som tidigare)
2. EMA20 > EMA50 (bullish crossover-ordning)
3. EMA50-slope > 0 (långsiktig trend OK)
4. EMA20-slope > 0 (kortsiktig acceleration)
5. Higher low-sekvens (strukturell förbättring)

### 5.3 Steg 2-4: Statusmaskin (Preliminär status)

**FAR (>4% över EMA20):**
```javascript
status = "WAIT_PULLBACK";
action = "WAIT";
reason = "För långt från EMA20 (X.X%)";
```

**APPROACHING (2-4% över EMA20):**
```javascript
status = "APPROACHING";
action = "WAIT";
reason = "Drar sig mot pullback (X.X%)";
```

**PERFECT (0-1% över EMA20) + CALM momentum:**
```javascript
if (volume.relVol >= 1.0) {
  status = "READY";
  action = "PREPARE_ENTRY";
  reason = "🎯 OPTIMAL: Perfect pullback (0-1%) + lugnt momentum + volym OK";
} else {
  status = "APPROACHING";
  reason = "Perfect pullback men för låg volym";
}
```

**NEAR (1-2% över EMA20) + CALM momentum:**
```javascript
if (volume.relVol >= 1.0) {
  status = "READY";
  action = "PREPARE_ENTRY";
  reason = "Pullback nära + lugnt momentum + volym OK";
} else {
  status = "APPROACHING";
  reason = "Pullback nära men för låg volym";
}
```

**HOT momentum (RSI >65):**
```javascript
if (close > ema20 && volume.relVol >= 1.2) {
  status = "BREAKOUT_READY";
  action = "PREPARE_BREAKOUT_ENTRY";
  reason = "Breakout setup: Pris > EMA20 + HOT momentum + hög volym";
} else {
  status = "BREAKOUT_ONLY";
  action = "WAIT_FOR_CONFIRMATION";
  reason = "Momentum för starkt - vänta på breakout med volym ≥1.2x";
}
```

**TOO_DEEP eller WEAK momentum:**
```javascript
status = "WAIT_PULLBACK";
action = "WAIT";
reason = proximity === "TOO_DEEP"
  ? "Pullback för djup (under EMA20)"
  : "Momentum för svagt (RSI <40)";
```

### 5.4 Steg 5: Edge-filter

```javascript
// Gäller BÅDE READY och BREAKOUT_READY
if ((status === "READY" || status === "BREAKOUT_READY") &&
    edge_score < 70) {
  status = "APPROACHING";
  action = "WAIT";
  reason = "Tekniskt setup OK men edge för svag (X%, kräver ≥70%)";
}
```

**Motivering:** Historisk edge <70% → dålig risk/reward

### 5.5 Steg 6: Cooldown

```javascript
const daysSinceInvalidation = lastInvalidatedDate
  ? Math.floor((new Date() - new Date(lastInvalidatedDate)) / (1000*60*60*24))
  : 999;

if ((status === "READY" || status === "BREAKOUT_READY") &&
    daysSinceInvalidation < 3) {
  const requiredDays = (status === "BREAKOUT_READY") ? 1 : 3;
  if (daysSinceInvalidation < requiredDays) {
    status = "APPROACHING";
    reason = "För tidigt efter invalidering (X dagar sedan, kräver Y dagar)";
  }
}
```

**Cooldown-krav:**
- READY: 3 dagar efter INVALIDATED
- BREAKOUT_READY: 1 dag efter INVALIDATED (breakouts är snabbare)

**Motivering:** Förhindrar whipsaw när trend bryts och återhämtar sig snabbt

### 5.6 Steg 7: Tidsbaserad hantering

```javascript
// Auto-remove efter 15 dagar utan setup
if (daysInWatchlist >= 15 &&
    status !== "READY" &&
    status !== "BREAKOUT_READY") {
  return {
    status: "EXPIRED",
    action: "REMOVE_FROM_WATCHLIST",
    reason: "För lång väntan utan setup (X dagar) - automatiskt borttagen"
  };
}

// Varning vid 10 dagar
if (daysInWatchlist >= 10 &&
    status !== "READY" &&
    status !== "BREAKOUT_READY") {
  timeWarning = "Lång väntan (X dagar) – överväg att rensa (auto-remove vid 15 dagar)";
}
```

---

## 6. STATUSAR OCH ACTIONS

### 6.1 Alla statusar

| Status | Action | Betydelse | UI-ikon |
|--------|--------|-----------|---------|
| READY | PREPARE_ENTRY | Pullback-setup klart, alla villkor uppfyllda | 🟢 |
| BREAKOUT_READY | PREPARE_BREAKOUT_ENTRY | Breakout-setup klart, HOT momentum + volym | 🔴 |
| APPROACHING | WAIT | Närmar sig pullback-zon, bevaka | 🟡 |
| WAIT_PULLBACK | WAIT | För långt från EMA20 eller för djupt | 🔵 |
| BREAKOUT_ONLY | WAIT_FOR_CONFIRMATION | HOT momentum men saknar volym/pris-krav | 🟠 |
| INVALIDATED | REMOVE_FROM_WATCHLIST | Trend bruten, ta bort från bevakning | 🔴 |
| EXPIRED | REMOVE_FROM_WATCHLIST | >15 dagar utan setup, auto-borttagen | ⏰ |

### 6.2 Status-transitions (exempel)

```
Scenario 1: Lyckad pullback
WAIT_PULLBACK (>4%) → APPROACHING (2-4%) → READY (0-2%, volym OK, edge OK) → [TRADE]

Scenario 2: Blockerad av edge
APPROACHING (2-4%) → READY (tekniskt) → APPROACHING (edge <70%, nedgraderad)

Scenario 3: Breakout
WAIT_PULLBACK → BREAKOUT_ONLY (RSI >65) → BREAKOUT_READY (volym ≥1.2x, edge OK) → [TRADE]

Scenario 4: Trend-brott
READY → INVALIDATED (pris <EMA20) → [3 dagars cooldown] → APPROACHING (åter OK)

Scenario 5: Timeout
APPROACHING (10 dagar) → APPROACHING (varning) → EXPIRED (15 dagar) → [AUTO-REMOVE]
```

---

## 7. KRITISKA FÖRBÄTTRINGAR (2025-01-01)

### 7.1 Före vs Efter

| Aspekt | Före | Efter | Impact |
|--------|------|-------|--------|
| **Edge-krav READY** | Inget | ≥70% | 🔴 Kritisk |
| **Edge-krav BREAKOUT** | Inget | ≥70% | 🔴 Kritisk |
| **Volym READY** | ≥0.5x | ≥1.0x | 🔴 Kritisk |
| **Volym BREAKOUT** | Inget | ≥1.2x | 🔴 Kritisk |
| **Trendvalidering** | Pris >EMA50 | Pris >EMA20 >EMA50 + slopes | 🔴 Kritisk |
| **Higher low** | 1 högre låg | 3 stigande lows i rad | 🟡 Viktigt |
| **Cooldown READY** | Inget | 3 dagar | 🟡 Viktigt |
| **Cooldown BREAKOUT** | Inget | 1 dag | 🟡 Viktigt |
| **Proximity-zoner** | 3 zoner | 5 zoner (+ PERFECT) | 🟡 Viktigt |
| **Auto-remove** | Manuellt | Automatiskt vid 15d | 🟢 Nice-to-have |

### 7.2 Effekt på signalkvalitet

**Estimerad påverkan:**
- **Antal READY-signaler:** -60% (färre men högre kvalitet)
- **Win-rate på signaler:** +15-20% (förväntat)
- **False positives:** -70% (edge-filter + cooldown)
- **Whipsaw efter INVALIDATED:** -80% (cooldown)

---

## 8. DATAFLÖDE OCH API-STRUKTUR

### 8.1 Bevakningslista-update

```
1. GET /api/watchlist → Hämta alla watchlist-stocks från Supabase
2. För varje stock:
   a. Yahoo Finance API → Hämta 1 års historisk data
   b. Beräkna indikatorer (EMA20, EMA50, RSI14, relVol)
   c. Hämta edge_score från screener_stocks-tabell
   d. buildWatchlistInput() → Sammanställ input-objekt
   e. updateWatchlistStatus() → Kör beslutslogik
   f. Uppdatera watchlist-tabellen med resultat
3. Return: Lista med uppdaterade statusar
```

**Databas-schema (watchlist):**
```sql
CREATE TABLE watchlist (
  ticker TEXT PRIMARY KEY,
  added_at TIMESTAMP,
  current_status TEXT,           -- READY, APPROACHING, etc.
  current_action TEXT,            -- PREPARE_ENTRY, WAIT, etc.
  status_reason TEXT,             -- Förklaring
  dist_ema20_pct NUMERIC,         -- Avstånd till EMA20
  rsi_zone TEXT,                  -- CALM, HOT, WEAK, WARM
  volume_state TEXT,              -- HIGH, NORMAL, LOW
  time_warning TEXT,              -- Varning vid 10+ dagar
  days_in_watchlist INTEGER,
  last_invalidated_date DATE,     -- För cooldown
  last_updated DATE
);
```

### 8.2 Teknisk analys-endpoint

```
POST /api/analyze
Input: { ticker: "SHB-A.ST" }

1. Yahoo Finance → Hämta historisk data
2. Beräkna indikatorer (EMA20, EMA50, RSI, etc.)
3. Kör backtest för alla strategier
4. Beräkna edge_score för bästa strategi
5. Generera entry/stop/target-nivåer
6. Return: Komplett analys-objekt

Output:
{
  ticker: "SHB-A.ST",
  current: { close, high, low, volume },
  indicators: { ema20, ema50, rsi14, atr },
  regime: "Bullish" | "Bearish" | "Sideways",
  setup: "pullback" | "breakout" | "reversal",
  edge_score: 75,
  trade: {
    entry: 145.2,
    stop: 142.8,
    target: 150.5,
    rr: 2.2  // Risk/Reward
  },
  backtest: {
    strategy: "pullback_ema20",
    winRate: 0.65,
    avgWin: 4.2,
    avgLoss: -2.1,
    totalTrades: 23
  }
}
```

---

## 9. PARAMETRAR FÖR TUNING

### 9.1 Kritiska trösklar (nuvarande värden)

```javascript
// Edge-filter
const EDGE_THRESHOLD = 70;  // Procent

// 🆕 FAS 1: Statistisk robusthet
const MIN_TRADES = 30;              // Minimum antal trades i backtest
const CONFIDENCE_FULL_TRADES = 50;  // Antal trades för full confidence
const MIN_TURNOVER = 5000000;       // Minimum dagsomsättning (5M SEK)
const SLOPE_PERIOD = 5;             // Dagar för slope-beräkning (tidigare 1)

// Volymkrav
const READY_VOLUME_MIN = 1.0;        // Multipel av genomsnitt
const BREAKOUT_VOLUME_MIN = 1.2;     // Högre krav för breakouts

// Proximity-zoner (% från EMA20)
const PROXIMITY_FAR = 4;
const PROXIMITY_APPROACHING = 2;
const PROXIMITY_NEAR = 1;
const PROXIMITY_PERFECT = 0;

// RSI-zoner
const RSI_WEAK = 40;
const RSI_CALM_MAX = 55;
const RSI_WARM_MAX = 65;
// >65 = HOT

// Cooldown (dagar)
const COOLDOWN_READY = 3;
const COOLDOWN_BREAKOUT = 1;

// Tidsbaserad hantering
const WARNING_DAYS = 10;
const EXPIRY_DAYS = 15;

// Strukturkrav
const HIGHER_LOW_SEQUENCE = 3;  // Antal stigande lows
```

### 9.2 Tuning-rekommendationer

**För mer konservativ approach (färre signaler, högre kvalitet):**
```javascript
const EDGE_THRESHOLD = 75;           // +5%
const READY_VOLUME_MIN = 1.2;        // +0.2x
const COOLDOWN_READY = 5;            // +2 dagar
const RSI_CALM_MAX = 50;             // -5 (smalare CALM-zon)
```

**För mer aggressiv approach (fler signaler, lägre kvalitet):**
```javascript
const EDGE_THRESHOLD = 65;           // -5%
const READY_VOLUME_MIN = 0.8;        // -0.2x
const COOLDOWN_READY = 2;            // -1 dag
const PROXIMITY_NEAR = 2.5;          // +1.5% (bredare NEAR-zon)
```

---

## 10. BACKTESTING OCH VALIDERING

### 10.1 Backtest-strategier

Systemet kör backtests för följande strategier:

```javascript
const strategies = [
  {
    name: "pullback_ema20",
    entry: "Pris korsar över EMA20 efter pullback",
    stop: "Under senaste swing low",
    target: "2x risk (R:R 1:2)"
  },
  {
    name: "breakout_high",
    entry: "Breakout över senaste high + volym",
    stop: "Under breakout-candle low",
    target: "ATR-baserad (2x ATR)"
  },
  {
    name: "reversal_rsi",
    entry: "RSI <30 + bullish candle",
    stop: "Under reversal-low",
    target: "Till EMA20"
  }
  // ... totalt 10 strategier
];
```

### 10.2 Backtest-metrik

```javascript
{
  totalTrades: 23,
  winningTrades: 15,
  losingTrades: 8,
  winRate: 0.65,          // 65%
  avgWin: 4.2,            // 4.2% genomsnittlig vinst
  avgLoss: -2.1,          // -2.1% genomsnittlig förlust
  avgWinLoss: 2.0,        // Ratio
  profitFactor: 1.8,      // Total vinst / total förlust
  maxDrawdown: -8.5,      // Största drawdown i %
  sharpeRatio: 1.2        // Risk-justerad avkastning
}
```

**Edge score-beräkning:**
```javascript
edge_score = winRate × avgWinLoss × 100;
// Exempel: 0.65 × 2.0 × 100 = 130% (excellent)
```

**🆕 FAS 1: Confidence-Adjusted Edge Score**
```javascript
// Justering baserad på sample size för att undvika överoptimism
function adjustedEdgeScore(edge_score, totalTrades) {
  const confidenceFactor = Math.sqrt(Math.min(totalTrades / 50, 1));
  return edge_score * confidenceFactor;
}

// Exempel:
// edge_score = 130%, totalTrades = 25
// confidenceFactor = sqrt(25/50) = sqrt(0.5) ≈ 0.71
// adjustedEdge = 130 × 0.71 ≈ 92%
```

**Krav för READY-status:**
1. Raw edge_score ≥ 70% (gammal regel)
2. **🆕 totalTrades ≥ 30** (FAS 1 - minimum sample size)
3. **🆕 adjustedEdge ≥ 70%** (FAS 1 - confidence-justerad)

### 10.3 Validering av beslutslogik

**Test-cases (finns i test/functions.test.js):**

```javascript
describe('Watchlist Logic Tests', () => {
  it('READY: PERFECT proximity + CALM + volym ≥1.0 + edge ≥70', () => {
    const input = {
      price: { close: 100.5 },
      indicators: {
        ema20: 100,
        ema50: 98,
        ema20_slope: 0.001,
        ema50_slope: 0.001,
        rsi14: 50
      },
      volume: { relVol: 1.2 },
      structure: { higherLow: true },
      edge_score: 75,
      lastInvalidatedDate: "2025-01-01",
      daysInWatchlist: 5
    };

    const result = updateWatchlistStatus(input);
    expect(result.status).toBe("READY");
    expect(result.reason).toContain("OPTIMAL");
  });

  // ... 20+ test-cases
});
```

---

## 11. PRESTANDAKRAV

### 11.1 API-responstider

| Endpoint | Max tid | Typisk tid |
|----------|---------|------------|
| GET /api/watchlist | 2s | 500ms |
| POST /api/watchlist/update | 30s | 15s |
| POST /api/analyze | 5s | 2s |
| POST /api/ai-analysis | 10s | 4s |

### 11.2 Caching-strategi

**Teknisk data (Yahoo Finance):**
- Cache: Ingen (alltid live data)
- Update: Vid varje watchlist-refresh

**Edge scores (backtest):**
- Cache: Supabase screener_stocks-tabell
- Update: Manuellt eller vid strategi-ändring

**AI-analys:**
- Cache: Supabase ai_analysis-tabell + in-memory
- TTL: 1 dag (per ticker + datum)

---

## 12. FÖRBÄTTRINGSMÖJLIGHETER

### 12.1 Identifierade svagheter (ej implementerade)

**ATR-baserad risk (#8):**
```javascript
// Möjlig implementation
const suggestedStop = Math.max(
  recentSwingLow,
  close - (1.5 * atr)
);
const riskPct = ((close - suggestedStop) / close) * 100;
```
**Påverkan:** Nice-to-have, förbättrar risk-visualisering

**Förbättrad higher-low med slope:**
```javascript
export function hasHigherLowWithTrend(candles) {
  const recentLows = candles.slice(-5).map(c => c.low);
  const risingLows = recentLows[4] > recentLows[3] &&
                     recentLows[3] > recentLows[2];
  const slope = (recentLows[4] - recentLows[0]) / 4;
  return risingLows && slope > 0;
}
```
**Påverkan:** Marginell förbättring av strukturdetektering

### 12.2 Framtida utveckling

1. **Machine Learning-modell för edge-prediction**
   - Input: Tekniska indikatorer + marknadsregime
   - Output: Predikterad edge för nästa 5 dagar

2. **Multi-timeframe analys**
   - Daglig + vecko-trend alignment
   - Starkare konfirmation vid multiple timeframe-confluences

3. **Sektoranalys**
   - Relativ styrka vs sektor-index
   - Sektormomentoum som filter

4. **Adaptiva trösklar**
   - Edge-threshold justeras baserat på marknadsregim
   - Volymkrav lägre i låg-volatilitet-miljö

---

## 13. BENCHMARKING-METRIK

### 13.1 Systemprestanda (KPIs)

```javascript
// Mät dessa för benchmarking
const benchmarkMetrics = {
  // Signal-kvalitet
  readySignalsPerWeek: 0,        // Antal READY-signaler
  falsePositiveRate: 0,          // % READY som ej resulterar i trade
  avgTimeToEntry: 0,             // Dagar från READY till entry

  // Trade-resultat (från faktiska trades)
  actualWinRate: 0,              // % vinnande trades
  actualAvgRR: 0,                // Genomsnittlig R:R
  actualProfitFactor: 0,         // Total vinst / förlust

  // System-effektivitet
  watchlistTurnover: 0,          // % aktier som INVALIDATED/månad
  avgDaysInWatchlist: 0,         // Genomsnittlig tid i bevakningslista
  expiredStocksPerMonth: 0,      // Auto-borttagna per månad

  // Backtest vs Reality
  backtestEdgeAccuracy: 0,       // Hur väl edge_score predicerar
  edgeScoreCorrelation: 0        // Korrelation edge vs faktisk R:R
};
```

### 13.2 Jämförelse mot andra system

**Jämförelsepunkter:**
```
1. Signal-frequency: Antal READY-signaler per månad
2. Signal-quality: Win-rate på faktiska trades från READY
3. False-positive rate: % READY som inte leder till entry
4. Drawdown-protection: Max drawdown under 6 månader
5. Sharpe ratio: Risk-justerad avkastning
6. Implementation-gap: Backtest-edge vs faktisk edge
```

---

## 14. CHANGELOG

### Version 2.1 - FAS 1: Statistisk Robusthet (2026-01-01)

**🔴 KRITISKA STATISTISKA FIXAR:**

**FIX #1: Edge Score Robustness**
- ✅ Kräver minst 30 trades i backtestet för READY/BREAKOUT_READY
- ✅ Implementerad confidence-adjusted edge score: `adjustedEdge = edge_score × sqrt(min(totalTrades/50, 1))`
- ✅ Edge-score minskas automatiskt vid låg sample size
  - Vid 50+ trades: full confidence (100%)
  - Vid 25 trades: 71% confidence
  - Vid 10 trades: 45% confidence
- **Motivering:** Förhindrar falsk trygghet från överoptimistiska backtests med låg sample size
- **Impact:** Minskar multiple testing bias och data-mining risk drastiskt

**FIX #2: 5-dagars Slope (mindre brus)**
- ✅ EMA20 slope beräknas nu över 5 dagar istället för 1 dag
- ✅ EMA50 slope beräknas nu över 5 dagar istället för 1 dag
- **Före:** `slope = (current - previous) / previous` (1-dags delta)
- **Efter:** `slope = (current - ema[t-5]) / ema[t-5]` (5-dagars delta)
- **Motivering:** 1-dags slope flippar på minimal brus, särskilt i sidledes marknader
- **Impact:** Minskar onödiga INVALIDATED och churn i watchlisten

**FIX #3: Likviditetsfilter (absolut nivå)**
- ✅ Ny funktion: `hasAdequateLiquidity(avgTurnover, minTurnover = 5M SEK)`
- ✅ Kräver genomsnittlig dagsomsättning ≥5M SEK
- ✅ Hårt invalidering-filter (INVALIDATED om ej uppfyllt)
- **Motivering:** relVol säger "jämfört med sig själv", men en aktie kan ha relVol 1.2 och ändå vara illikvid
- **Impact:** Filtrerar bort lågomsatta aktier med hög slippage-risk

**DATAFLÖDE - NYA PARAMETRAR:**
```javascript
// Uppdaterad input-struktur
{
  // ... existerande fält
  totalTrades: 45,              // FIX #1: För confidence adjustment
  volume: {
    relVol: 1.2,
    avgTurnover: 8500000        // FIX #3: Genomsnittlig dagsomsättning (SEK)
  }
}
```

**API-ÄNDRINGAR:**
- `api/watchlist.js`: Fetchar nu `total_trades` och `avg_turnover` från `screener_stocks`
- `lib/watchlistLogic.js`: Nya funktioner `adjustedEdgeScore()` och `hasAdequateLiquidity()`
- `buildWatchlistInput()`: Uppdaterad signatur för nya parametrar

---

### Version 2.0 (2026-01-01)
- ✅ KRITISK: Edge-filter ≥70% för READY och BREAKOUT_READY
- ✅ KRITISK: Volymkrav ≥1.0x för READY, ≥1.2x för BREAKOUT_READY
- ✅ KRITISK: Starkare trendvalidering (pris >EMA20 >EMA50 + slopes)
- ✅ VIKTIGT: 3 stigande lows i rad (från 1 högre låg)
- ✅ VIKTIGT: Cooldown 3d för READY, 1d för BREAKOUT_READY
- ✅ VIKTIGT: PERFECT-zon 0-1% från EMA20
- ✅ MEDIUM: BREAKOUT_READY status med konkreta krav
- ✅ MEDIUM: Auto-remove efter 15 dagar

### Version 1.0 (2025-12-01)
- Initial release med grundläggande watchlist-logik
- EMA20/50, RSI14, volym-indikatorer
- Enkel proximity-beräkning
- Backtest-integration
- AI-analys med OpenAI

---

## 15. KONTAKT & BIDRAG

**Dokumentägare:** Trading AI Development Team
**Senast uppdaterad:** 2026-01-01
**Nästa review:** 2026-02-01

**För frågor om:**
- Teknisk implementation → Se kod i `lib/watchlistLogic.js`
- Backtest-metodik → Se `api/analyze.js`
- Parameterjustering → Se avsnitt 9.1-9.2

**Bidrag välkomnas:**
- Nya backtest-strategier
- Förbättrade tröskelvärden (med data)
- Machine learning-modeller för edge-prediction

---

**SLUT PÅ TEKNISK SPECIFIKATION**
