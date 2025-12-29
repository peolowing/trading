# Screener Algoritm - Dokumentation

## Översikt

Screenern använder en **deterministisk, bucket-baserad selection-algoritm** för att alltid returnera exakt 40 svenska aktier: 20 från Large Cap och 20 från Mid Cap-listorna på Nasdaq Stockholm.

## Tre-stegs Process

### STEG 1: Bucket-klassificering (Nasdaq Stockholm Listor)

Aktier klassificeras baserat på vilken **officiell Nasdaq Stockholm-lista** de tillhör, **inte** baserat på daglig omsättning.

```javascript
// Klassificering sparas i databasen
LARGE_CAP: Aktier från Nasdaq Stockholm Large Cap-listan
MID_CAP:   Aktier från Nasdaq Stockholm Mid Cap-listan
```

**Exempel:**
- `SEB-A.ST` = **LARGE_CAP** (storbank, finns på Large Cap-listan)
- `ESSITY-B.ST` = **MID_CAP** (finns på Mid Cap-listan, trots hög omsättning)

**Viktigt:** Bucket-klassificering är **statisk** och kommer från databasen (`screener_stocks.bucket`), inte från dynamisk omsättningsberäkning.

---

### STEG 2: Hårda Filter (Volym & Stabilitet)

Innan edge score beräknas måste aktier passera följande hårda filter:

#### A. Minimikrav
```javascript
- Data: Minst 50 dagars historik
- Omsättning: Minst 15M SEK/dag (senaste dagen)
- Volymstabilitet: CV (Coefficient of Variation) < 1.2
```

#### B. Volymstabilitet Beräkning
```javascript
volumes = senaste 20 dagarnas volym
avgVol = medelvärde(volumes)
stdDev = standardavvikelse(volumes)
cv = stdDev / avgVol

// CV < 1.2 = godkänd (stabil volym)
// CV ≥ 1.2 = avvisad (för volatil volym)
```

**Kod:** [`server.js:778-803`](server.js#L778-L803) - `passesVolumeFilter()`

---

### STEG 3: Edge Score Ranking (0-100 Skala)

Varje aktie som passerar de hårda filtren får ett edge score (0-100) baserat på:

#### Poängfördelning

| Kategori | Max Poäng | Beskrivning |
|----------|-----------|-------------|
| **Liquidity** | 30 | Omsättning (MSEK/dag) |
| **Trend** | 36 | Upptrend + slope-styrka |
| **Volatility** | 20 | ATR% i "sweet spot" (2-5%) |
| **Momentum** | 20 | RSI + relativ volym |
| **TOTAL** | **106** | (max möjligt) |

#### 1. Liquidity (30 poäng)
```javascript
if (turnoverM > 200)  → +30 pts  // Mycket hög likviditet
if (turnoverM > 100)  → +25 pts  // Hög likviditet
if (turnoverM > 50)   → +20 pts  // Bra likviditet
if (turnoverM > 30)   → +15 pts  // Acceptabel likviditet
if (turnoverM > 15)   → +10 pts  // Minimal likviditet
```

#### 2. Trend (36 poäng) ⚠️ Högre vikt
```javascript
if (regime === "UPTREND") {
  score += 18;  // Baspoäng för upptrend (ökat från 15)

  if (slope > 0.05)      → +12 pts  // Stark upptrend (ökat från 10)
  else if (slope > 0)    → +6 pts   // Positiv trend (ökat från 5)
}

if (regime === "DOWNTREND" && slope < -0.05) {
  score -= 5;  // Straff för stark nedåtgående trend
}
```

**Slope-beräkning:**
```javascript
slope = (EMA20[dag -1] - EMA20[dag -10]) / EMA20[dag -10]
```

#### 3. Volatility (20 poäng)
```javascript
atrPct = ATR14 / Close Price

if (atrPct >= 0.02 && atrPct <= 0.05)  → +20 pts  // Sweet spot (2-5%)
else if (atrPct > 0.05)                 → +10 pts  // Hög volatilitet
else                                    → +5 pts   // Låg volatilitet
```

**Mid-Cap ATR Straff:**
```javascript
if (bucket === "MID_CAP" && atrPct < 0.018) {
  score -= 10;  // Straffa för låg volatilitet i mid-cap
}
```

#### 4. Momentum (20 poäng)
```javascript
// RSI Momentum
if (rsi >= 40 && rsi <= 60)      → +15 pts  // Neutral/bullish
else if (rsi > 60 && rsi <= 70)  → +10 pts  // Starkt men ej overbought
else if (rsi < 30)               → +5 pts   // Oversold (potential)

// Relativ Volym
if (relVol > 1.3)                → +5 pts   // Över genomsnitt
```

**Kod:** [`server.js:825-865`](server.js#L825-L865) - `computeRanking()`

---

### STEG 4: Deterministisk Selection (20 + 20)

Efter att alla aktier har fått sina edge scores:

```javascript
// 1. Dela upp i buckets
largeCaps = candidates.filter(s => s.bucket === "LARGE_CAP");
midCaps   = candidates.filter(s => s.bucket === "MID_CAP");

// 2. Sortera varje bucket (högst score först)
largeCaps.sort((a, b) => b.edgeScore - a.edgeScore);
midCaps.sort((a, b) => b.edgeScore - a.edgeScore);

// 3. Ta topp 20 från varje bucket
finalLarge = largeCaps.slice(0, 20);
finalMid   = midCaps.slice(0, 20);

// 4. Kombinera för slutgiltig lista
finalList = [...finalLarge, ...finalMid];  // Alltid exakt 40 aktier
```

**Kod:** [`server.js:1004-1020`](server.js#L1004-L1020) - `/api/screener` endpoint

---

## Exempel: BOL.ST Edge Score Breakdown

```javascript
BOL.ST:
  - Omsättning: 591.7M SEK/dag    → +30 (>200M)
  - Trend: Bullish, slope > 0.05  → +30 (18 base + 12 strong)
  - ATR: 2.06% (sweet spot)       → +20 (2-5%)
  - RSI: 77.2 (overbought)        → +0  (>70)
  - Rel Vol: 1.04                 → +0  (<1.3)
  ─────────────────────────────────
  TOTAL EDGE SCORE: 80/100
```

---

## Databas Schema

### Tabell: `screener_stocks`

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| `ticker` | TEXT | Aktiesymbol (t.ex. "BOL.ST") |
| `bucket` | TEXT | "LARGE_CAP" eller "MID_CAP" |
| `is_active` | BOOLEAN | Om aktien är aktiv i screener |
| `created_at` | TIMESTAMP | När posten skapades |

**SQL för att lägga till bucket-kolumn:**
```sql
ALTER TABLE screener_stocks
ADD COLUMN IF NOT EXISTS bucket TEXT
CHECK (bucket IN ('LARGE_CAP', 'MID_CAP'));

CREATE INDEX IF NOT EXISTS idx_screener_stocks_bucket
ON screener_stocks(bucket);
```

---

## Uppdatera Screener-listan

### Script: `scripts/update-screener-db.js`

```bash
node scripts/update-screener-db.js
```

Detta script:
1. Rensar alla gamla aktier från `screener_stocks`
2. Lägger till 40 nya aktier med bucket-klassificering
3. Verifierar fördelningen (20 Large Cap + 20 Mid Cap)

**Exempel:**
```javascript
const STOCKS = [
  // Large-cap (20 aktier från Nasdaq Stockholm Large Cap)
  { ticker: "VOLV-B.ST", bucket: "LARGE_CAP" },
  { ticker: "SEB-A.ST", bucket: "LARGE_CAP" },
  // ...

  // Mid-cap (20 aktier från Nasdaq Stockholm Mid Cap)
  { ticker: "ESSITY-B.ST", bucket: "MID_CAP" },
  { ticker: "NIBE-B.ST", bucket: "MID_CAP" },
  // ...
];
```

---

## Vanliga Frågor

### Q: Varför använder ni Nasdaq-listor istället för omsättning?

**A:** Nasdaq Stockholm-listorna (Large Cap, Mid Cap) är officiella klassificeringar baserade på börsvärde, inte daglig omsättning. Detta ger:
- **Stabilitet**: Klassificeringen ändras inte från dag till dag
- **Korrekthet**: SEB-A.ST är LARGE_CAP även på dagar med låg volym
- **Transparens**: Samma klassificering som Nasdaq använder

### Q: Vad händer om färre än 20 aktier passerar filtren?

**A:** Screenern returnerar de aktier som passerar:
- Om 18 mid-cap passerar → returnerar 20 large + 18 mid = 38 totalt
- Om 15 mid-cap passerar → returnerar 20 large + 15 mid = 35 totalt

**Nuvarande status:** 20 Large Cap + 17 Mid Cap = 37 aktier (3 filtrerades bort pga låg volymstabilitet)

### Q: Vilka aktier filtrerades bort?

**A:** ATCO-B.ST, HEBA-B.ST, och LOOMIS.ST (troligen pga CV > 1.2 eller <50 dagars data)

### Q: Kan edge score bli högre än 100?

**A:** Teoretiskt ja (max 106), men resultatet begränsas till 0-100:
```javascript
return Math.max(0, Math.min(100, score));
```

### Q: Varför är trend-vikt högre (36 pts)?

**A:** Baserat på backtest-resultat visar trend-following strategier bäst resultat. Högre vikt på trend säkerställer att aktier i starka uptrends prioriteras.

---

## Teknisk Implementation

### Filstruktur

```
server.js
├── passesVolumeFilter()      # STEG 1: Hårda filter
├── computeFeatures()          # Beräkna indikatorer
├── computeRanking()           # STEG 2: Edge score (0-100)
└── GET /api/screener          # STEG 3: Deterministisk selection

repositories/
└── screener.repository.js
    ├── findAllActive()        # Hämta aktier + bucket från DB
    └── findByTicker()         # Hämta enskild aktie

scripts/
└── update-screener-db.js      # Uppdatera screener-lista
```

### API Endpoints

#### `GET /api/screener`
Returnerar screener-resultatet (20+20 aktier).

**Response:**
```json
{
  "stocks": [
    {
      "ticker": "BOL.ST",
      "bucket": "LARGE_CAP",
      "price": 507.40,
      "turnoverMSEK": 591.7,
      "edgeScore": 80,
      "regime": "Bullish Trend",
      "rsi": 77.2,
      "atr": 10.44,
      "relativeVolume": 1.04,
      "setup": "Hold"
    }
  ]
}
```

#### `POST /api/analyze`
Returnerar detaljerad analys för en specifik aktie.

**Request:**
```json
{
  "ticker": "BOL.ST"
}
```

**Response inkluderar:**
- Edge score (0-100)
- Bucket-klassificering
- Indikatorer (EMA, RSI, ATR)
- Backtest-resultat
- Trade-recommendations (om applicable)

---

## Changelog

### 2025-12-29
- ✅ Implementerad deterministisk bucket-baserad selection (20+20)
- ✅ Bucket-klassificering från Nasdaq Stockholm-listor (databas)
- ✅ Ökad trend-vikt (18 baspoäng, 12 för stark slope)
- ✅ Mid-cap ATR-straff (-10 om ATR < 1.8%)
- ✅ Edge score på 0-100 skala (tidigare 0-10)
- ✅ Backtest körs alltid (även för "Hold" setup)

---

## Kontakt & Support

För frågor eller förbättringsförslag, kontakta utvecklingsteamet.
