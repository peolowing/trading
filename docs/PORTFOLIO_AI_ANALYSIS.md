# Portfolio AI-Analys Dokumentation

## Översikt

Portfolio AI-analysen är ett regelbaserat beslutsstödsystem som hjälper dig att hantera aktiva positioner enligt professionella swing trading-principer. Systemet använder OpenAI GPT-4 för att analysera dina positioner mot ett strikt definierat regelset.

## Hur det fungerar

### 1. Endpoint

**POST** `/api/portfolio/analyze/:ticker`

**Request Body:**
```json
{
  "currentPrice": 705.50
}
```

**Response:**
```json
{
  "analysis": "... AI-genererad analys ...",
  "metrics": {
    "currentR": "0.82",
    "daysInTrade": 5,
    "distanceToTarget": "21.91",
    "distanceToStop": "33.61",
    "targetPrice": "727.41",
    "rValue": "18.51"
  },
  "timestamp": "2026-01-12T15:30:00Z"
}
```

### 2. Regelbaserad Analys

AI:n analyserar positionen mot två huvudregelset:

#### A) STOP-FLYTT-SCHEMA (5 nivåer)

##### 🔒 Nivå 0 – INITIALT LÄGE
- **Villkor:** Priset mellan initial stop och ~entry + 0.5R, ingen ny struktur
- **Åtgärd:** Stop = initial stop, INGEN flytt, INGEN delvinst
- **Filosofi:** De flesta förstör trades genom att göra något i onödan

##### 🟡 Nivå 1 – Tidig rörelse (+0.5R till +1R)
- **Villkor:** Pris når +0.5R till +1R
- **Åtgärd:** Stop FLYTTAS INTE, ingen vinst tas, endast observation
- **Filosofi:** Vinst är inte intjänad förrän marknaden skapar struktur

##### 🟢 Nivå 2 – Första BEKRÄFTADE styrkan
- **Trigger:**
  - Dagstängning ≥ Entry + 1R, ELLER
  - Högre high + tydlig rekyl + ny högre botten
- **Åtgärd:** Flytta stop till break-even (entry-pris) eller entry + liten buffert
- **Filosofi:** Nu är traden riskfri – men fortfarande levande

##### 🔵 Nivå 3 – Strukturell trend etablerad
- **Trigger:** Nytt högre high + kontrollerad rekyl + nytt högre swing-low
- **Åtgärd:** Flytta stop till under senaste swing-low
- **Filosofi:** Här börjar du låsa marknadsstruktur, inte kronor

##### 🟣 Nivå 4 – Target-zon (≥2R)
- **Trigger:** Pris ≥ target
- **Åtgärd:**
  - Mekanisk exit (hela positionen vid target), ELLER
  - Ta 50% vid target + trailing stop på resterande
- **Filosofi:** Här slutar analys – nu är det förvaltning

#### B) TIDSGRÄNSER (Time Stops)

##### 🟡 Nivå 1 – Early warning (3-5 dagar)
- **Fråga:** Har aktien gjort något som bekräftar idén?
- **Bekräftelse:** Högre high, stängning över entry, volymexpansion
- **Åtgärd:** Markera som svag i journal om NEJ (men ingen exit än)

##### 🟠 Nivå 2 – Operativ time stop (8-12 dagar)
- **Villkor:** Priset har INTE nått ≥ +1R eller skapat ny struktur
- **Åtgärd:** Exit vid nästa rimliga tillfälle
- **Filosofi:** Momentumhypotesen är förbrukad, kapitalet kan arbeta bättre någon annanstans

##### 🔴 Nivå 3 – Absolut maxgräns (15-20 dagar)
- **Åtgärd:** Exit oavsett P/L
- **Filosofi:** Disciplinregel – inte marknadsanalys

### 3. KÄRNREGEL (aldrig bryt denna)

❌ **Flytta ALDRIG stop uppåt utan:**
- Ny struktur (högre swing-low bekräftad), ELLER
- Tydlig regel aktiverad (1R nådd → BE, target nådd → trailing)

**Varför?** Om du bryter denna regel kollapsar din expectancy, även bra analyser slutar fungera.

## Användningsexempel

### Scenario 1: Position i initialt läge

**Input:**
- Entry: 690.40
- Current price: 697.00
- Days in trade: 2
- Initial stop: 671.89
- Current R: +0.36R

**AI Output:**
```
📊 Aktuell nivå: Nivå 0 (INITIALT LÄGE)

💡 Stop-rekommendation: Behåll 671.89 kr

🟢 Time stop-status: GRÖN (2 dagar, inom normal tid)

✅ Konkret åtgärd: GÖR INGENTING. Positionen är för tidig för handling.

🔔 Nästa trigger: Om dagstängning ≥ 709 kr (Entry + 1R) → flytta till BE

⚠️ Riskbedömning: Normal rekyl kan ta priset mot 680-685. Det är OK.
```

### Scenario 2: Position nära 1R med timewarning

**Input:**
- Entry: 690.40
- Current price: 704.00
- Days in trade: 9
- Initial stop: 671.89
- Current R: +0.73R

**AI Output:**
```
📊 Aktuell nivå: Nivå 1 (Tidig rörelse)

💡 Stop-rekommendation: Behåll 671.89 kr (ännu ingen strukturbekräftelse)

🟡 Time stop-status: GUL (9 dagar utan 1R - övervaka)

⚠️ Konkret åtgärd: Förbered mental exit om inte stängning >709 inom 2-3 dagar

🔔 Nästa trigger:
- Om stängning ≥709: flytta stop → BE
- Om dag 12 utan struktur: exit vid nästa öppning

⚠️ Riskbedömning: Momentum försvagat. Trade riskerar bli kapitalbindning.
```

### Scenario 3: Position över 1R med bekräftelse

**Input:**
- Entry: 690.40
- Current price: 715.00
- Days in trade: 6
- Initial stop: 671.89
- Current stop: 690.40 (already moved to BE)
- Current R: +1.33R

**AI Output:**
```
📊 Aktuell nivå: Nivå 3 (Strukturell trend etablerad)

💡 Stop-rekommendation: Flytta till 708 kr (under senaste swing-low ~710)

🟢 Time stop-status: GRÖN (6 dagar, stark bekräftelse)

✅ Konkret åtgärd: Uppdatera stop till 708 kr NU. Låt vinnaren löpa.

🔔 Nästa trigger: Vid 727 kr (target) → besluta om full exit eller 50% + trail

⚠️ Riskbedömning: Minimal. Traden är riskfri och strukturellt stark.
```

### Scenario 4: Position vid target

**Input:**
- Entry: 690.40
- Current price: 728.00
- Days in trade: 8
- Current R: +2.03R

**AI Output:**
```
📊 Aktuell nivå: Nivå 4 (TARGET-ZON)

💡 Stop-rekommendation: N/A (exit-beslut)

🟢 Time stop-status: GRÖN (perfekt timing)

✅ Konkret åtgärd: VÄLJ NU:
A) Sälj 100% vid 728 kr (realisera +2R)
B) Sälj 50%, flytta stop till 720 kr på resterande 50%

🔔 Nästa trigger: Om B valts - trail med daily low eller 2×ATR

⚠️ Riskbedömning: Om du inte tar vinst nu kan momentum vända snabbt.
```

## Beräknade Metrics

AI:n får följande beräknade värden:

```javascript
// R-värde (initial risk)
rValue = entry_price - initial_stop

// Nuvarande R (P/L i risk-enheter)
currentR = (currentPrice - entry_price) / rValue

// Target-pris (standardmål 2R)
targetPrice = entry_price + (2 × rValue)

// Avstånd till target
distanceToTarget = targetPrice - currentPrice

// Avstånd till stop
distanceToStop = currentPrice - current_stop

// Dagar i trade
daysInTrade = today - entry_date
```

## AI-Prompt Struktur

AI:n får exakt denna information:

```
# POSITION
- Ticker: ABB.ST
- Entry: 690.40 kr
- Entry-datum: 2026-01-07
- Dagar i trade: 5
- Initial stop: 671.89 kr
- Current stop: 671.89 kr
- Target: 727.41 kr
- 1R (risk): 18.51 kr
- Nuvarande pris: 705.50 kr
- Nuvarande P/L: 0.82R (8200 kr)
- Entry setup: EMA Bounce
- Entry rationale: Pullback mot EMA20 med RSI CALM

# REGLER
[Hela regelverket inkluderat ovan]

# UPPGIFT
Analysera positionen och ge:
1. Aktuell nivå (0-4) enligt stop-schemat
2. Stop-rekommendation (exakt pris eller "behåll")
3. Time stop-status (grön/gul/röd baserat på dagar + framsteg)
4. Konkret åtgärd (gör detta NU)
5. Nästa trigger (när ska du ompröva?)
6. Riskbedömning (vad kan gå fel?)

Var MEKANISK och SPECIFIK. Ingen fluff. Ge exakta priser och datum.
```

## AI-Systemroll

```
Du är en strikt, regelbaserad swing trading-rådgivare som ger konkreta,
testbara rekommendationer. Använd BARA reglerna som ges.
Ingen subjektiv tolkning.
```

**Temperature:** 0.3 (låg kreativitet, hög precision)
**Max tokens:** 1500

## Säkerhet och Begränsningar

### Vad AI:n GÖR:
✅ Tillämpar regler mekaniskt
✅ Beräknar exakta nivåer
✅ Identifierar regelbrott
✅ Ger konkreta åtgärder

### Vad AI:n INTE GÖR:
❌ Förutsäga framtida prisrörelser
❌ Ge "känslobaserade" råd
❌ Avvika från regelverket
❌ Tolka makroekonomisk data

### När AI-analys INTE ska användas:
- För nya entries (använd watchlist-regler istället)
- För långsiktiga investeringar (detta är swing trading)
- När du vill ha "second opinion" på ditt eget påhitt

## Integrering med Frontend

### Dashboard Integration (TODO)

```javascript
// Knapp i portfolio-vyn
<button onClick={() => analyzePosition(stock.ticker, currentPrice)}>
  📊 AI-Analys
</button>

// API-anrop
async function analyzePosition(ticker, currentPrice) {
  const res = await fetch(`/api/portfolio/analyze/${ticker}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPrice })
  });

  const data = await res.json();
  showAnalysisModal(data);
}
```

### Modal Visning

Modal bör visa:
- 📊 Analys-text (markdown-formaterad)
- 📈 Metrics (R, dagar, avstånd till stop/target)
- 🔔 Eventuell varning (time stop gul/röd)
- ✅ Quick actions (uppdatera stop, exit position)

## Felsökning

### "OpenAI not configured"
- Kontrollera att `OPENAI_API_KEY` finns i `.env.local`
- Restart backend-server

### "Position not found"
- Ticker finns inte i portfolio-tabellen
- Kontrollera stavning (case-sensitive)

### AI ger vaga svar
- Borde inte hända med temperature 0.3
- Kontrollera att prompt innehåller alla metrics
- Verifiera att regelverket är komplett i request

### Stop-rekommendation verkar fel
- AI följer reglerna exakt - dubbelkolla regellogiken
- Jämför med manuell beräkning av nivåer
- Kolla att currentPrice är korrekt (hämtas realtid)

## Vidareutveckling

### Framtida förbättringar:
1. **Automatisk prisuppdatering** - Hämta live-pris från Yahoo Finance
2. **Historisk analys** - Visa tidigare AI-rekommendationer för samma position
3. **Batch-analys** - Analysera alla positioner samtidigt
4. **Alert-system** - Notifiera när time stop når gul/röd nivå
5. **Backtesting** - Validera AI-rekommendationer mot historiska trades

### Regeluppdateringar:
- Lägg till fler scenariotyper (gap up/down, earnings, etc.)
- Justera tidsgränser baserat på volatilitet/ATR
- Integrera sektorrotation/marknadsregim

## Slutsats

Portfolio AI-analysen är ett **regelbaserat beslutsstöd** som:
- Eliminerar emotionella beslut
- Tillämpar beprövade swing trading-principer
- Ger konkreta, testbara rekommendationer
- Hjälper dig hålla disciplin när det är svårt

**Det ersätter INTE** ditt eget omdöme, men ger dig en objektiv second opinion baserad på professionella regler.

---

**Skapat:** 2026-01-12
**Version:** 1.0
**Författare:** Weekly Trading AI System
