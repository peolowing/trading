# Edge Score Priority System

## Översikt

Agent-signaler visar nu både **Agent Strength** och **Edge Score** för att hjälpa dig prioritera vilka setups som är mest tradable.

## Skillnad: Agent Strength vs Edge Score

### Agent Strength (0-100)
**Vad den mäter:** Hur BRA setupen är enligt agent-kriterierna

**Exempel - Trend + Pullback:**
```javascript
strength = 50 (base)
  + 20 (optimal pullback 3-4 dagar)
  + 15 (volym > 1.0)
  + 15 (RSI i sweet spot 35-45)
= 100 (perfekt setup!)
```

**Användning:** Visar hur väl aktien matchar den specifika strategin

---

### Edge Score (0-100)
**Vad den mäter:** Hur TRADABLE aktien är (likviditet, trend, volatilitet)

**Komponenter:**
- **Liquidity (30pts):** Daglig omsättning i SEK
- **Trend (36pts):** Upptrend + slope-styrka
- **Volatility (20pts):** ATR i "sweet spot" 2-5%
- **Momentum (20pts):** RSI + relativ volym

**Användning:** Visar hur lätt det är att handla aktien med tight spread och god likviditet

---

## Prioriteringssystem

### 🔥 HÖG PRIO (Edge Score ≥ 70)
**Karakteristik:**
- Hög omsättning (>50M SEK/dag)
- Stark upptrend
- Bra volatilitet och momentum

**Exempel:**
```
VOLV-B.ST
  Agent Strength: 85/100  (Perfekt pullback-setup)
  Edge Score: 78/100      (Hög likviditet, stark trend)
  Priority: 🔥 HÖG PRIO

  → BÄSTA TRADE: Perfekt setup + lätt att handla
```

---

### ⚡ MEDEL (Edge Score 50-69)
**Karakteristik:**
- Acceptabel omsättning (30-50M SEK/dag)
- Upptrend men svagare momentum
- Kan ha högre spread

**Exempel:**
```
NIBE-B.ST
  Agent Strength: 75/100  (Bra pullback-setup)
  Edge Score: 58/100      (Medium likviditet)
  Priority: ⚡ MEDEL

  → BRA TRADE: Bra setup men lite högre spread
```

---

### ⚠️ LÅG PRIO (Edge Score < 50)
**Karakteristik:**
- Låg omsättning (<30M SEK/dag)
- Svag trend eller låg volatilitet
- Kan ha stora spreads

**Exempel:**
```
TREL-B.ST
  Agent Strength: 75/100  (Bra pullback-setup)
  Edge Score: 45/100      (Låg likviditet, låg ATR)
  Priority: ⚠️ LÅG PRIO

  → RISKABEL TRADE: Bra setup men svår att handla
     Kan funka för swing trading om du accepterar lägre likviditet
```

---

## Handlingsplan

### Scenario 1: Hög Strength + Hög Edge
```
Strength: 85  Edge: 78  Priority: 🔥 HÖG PRIO
```
**Action:** Trade direkt! Perfekt kombination.

---

### Scenario 2: Hög Strength + Medel Edge
```
Strength: 75  Edge: 58  Priority: ⚡ MEDEL
```
**Action:** Trade men var medveten om:
- Något högre spread
- Kan ta längre tid att fylla order
- Använd limit orders

---

### Scenario 3: Hög Strength + Låg Edge
```
Strength: 75  Edge: 45  Priority: ⚠️ LÅG PRIO
```
**Action:** Överväg noga:
- ✅ Bra för swing trading (håll 3-10 dagar)
- ✅ Om du accepterar lägre likviditet
- ❌ Undvik för day trading
- ❌ Undvik stora positioner (svårt att exit)

**Tips:**
- Använd smaller position size
- Limit orders ALLTID
- Bred stop (högre slippage-risk)

---

### Scenario 4: Låg Strength + Hög Edge
```
Strength: 55  Edge: 75  Priority: 🔥 HÖG PRIO
```
**Action:** Överväg försiktigt:
- ✅ Lätt att handla (hög likviditet)
- ❌ Setupen är inte perfekt enligt agent-kriterier
- Kan vara värt att trade ändå om du ser värde i chartet

---

## Frontend Display

### Signal Sortning
Signaler sorteras automatiskt efter Edge Score (högst först):
```
1. VOLV-B.ST  🔥 HÖG PRIO   Edge: 78
2. NIBE-B.ST  ⚡ MEDEL      Edge: 58
3. TREL-B.ST  ⚠️ LÅG PRIO  Edge: 45
```

### Signal Detaljer
Varje signal visar nu:
```
Agent: Trend + Pullback
Ticker: TREL-B.ST
Priority: ⚠️ LÅG PRIO

Type: TREND_PULLBACK
Strength: 75/100 (gul om 60-79, grön om 80+, röd <60)
Edge Score: 45/100 (röd <50, orange 50-69, grön 70+)
Entry: 150.00
Stop: 145.00
Target: 160.00
Pullback: 3 dagar
```

---

## Edge Score Breakdown - Exempel

### VOLV-B.ST (Edge Score: 78)
```javascript
Liquidity: +30  (omsättning >200M SEK/dag)
Trend:     +30  (Close > SMA200, stark slope)
Volatility:+20  (ATR 2.3%, sweet spot)
Momentum:  -2   (RSI 77 = lite overbought)
─────────────────
TOTAL:     78/100
```

### TREL-B.ST (Edge Score: 45)
```javascript
Liquidity: +10  (omsättning 20M SEK/dag, lågt)
Trend:     +30  (Close > SMA200, stark slope)
Volatility: +5  (ATR 1.5%, för låg)
Momentum:   +0  (RSI 42, utanför 40-60 range)
─────────────────
TOTAL:     45/100
```

---

## Rekommendationer

### För Day Trading
**Minimum Edge Score:** 60
**Varför:** Behöver tight spreads och snabba fills

### För Swing Trading (3-10 dagar)
**Minimum Edge Score:** 40
**Varför:** Spread mindre viktigt, kan vänta på fills

### För Position Trading (veckor/månader)
**Minimum Edge Score:** 30
**Varför:** Setup viktigare än likviditet

---

## Justera Agent-Filter (Optional)

Om du **ENDAST** vill ha signaler med Edge Score ≥ 50, lägg till filter i `detectTrendPullback()`:

```javascript
// I server.js, efter edge score beräkning
if (edgeScore < 50) {
  console.log(`  ⊘ ${ticker}: Signal ${signal.strength} skippad (edge ${edgeScore} < 50)`);
  continue;
}
```

**Rekommendation:** Behåll alla signaler men använd prioritering för att välja trades.

---

## Sammanfattning

| Priority | Edge Score | Användning |
|----------|------------|------------|
| 🔥 HÖG PRIO | ≥70 | Perfekt för day/swing trading |
| ⚡ MEDEL | 50-69 | Bra för swing trading |
| ⚠️ LÅG PRIO | <50 | Endast swing om du accepterar risk |

**Nyckel:**
- **Agent Strength** = Hur bra setupen är
- **Edge Score** = Hur tradable aktien är
- **Priority Badge** = Kombinerad rekommendation

Nu kan du se direkt vilka signaler som är mest värda att trade! 🎯
