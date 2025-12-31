# Trade Calculations - Entry, Stop Loss & Target

Denna dokumentation beskriver hur entry-nivå, stop-loss och target beräknas i Weekly Trading AI-systemet.

## Översikt

Systemet beräknar automatiskt trade-nivåer baserat på:
- **ATR (Average True Range)** - mäter volatilitet
- **Risk/Reward Ratio** - fast på 1:2.0
- **Regime** - upptrend eller nedtrend

## Beräkningsmetod

Beräkningarna sker i [server.js:607-644](server.js#L607-L644).

### LONG-positioner (Standard)

Används när aktien är i upptrend eller neutral trend.

```javascript
entry = lastClose  // Senaste stängningskursen
stop = entry - (ATR14 × 1.5)
target = entry + ((entry - stop) × 2.0)
```

**Exempel:**
- Entry: 100 SEK
- ATR14: 2.0 SEK
- Stop: 100 - (2.0 × 1.5) = **97 SEK**
- Risk: 3 SEK
- Target: 100 + (3 × 2.0) = **106 SEK**
- Risk/Reward: **1:2.0**

### SHORT-positioner (Sällsynt)

Används **endast** när `regime === "Bearish Trend"` (EMA20 < EMA50 OCH pris < EMA20).

```javascript
entry = lastClose
stop = entry + (ATR14 × 1.5)
target = entry - ((stop - entry) × 2.0)
```

**Exempel:**
- Entry: 100 SEK
- ATR14: 2.0 SEK
- Stop: 100 + (2.0 × 1.5) = **103 SEK**
- Risk: 3 SEK
- Target: 100 - (3 × 2.0) = **94 SEK**
- Risk/Reward: **1:2.0**

> **OBS:** SHORT-positioner filtreras bort i praktiken eftersom:
> - Screener tar bort bearish aktier
> - Watchlist rekommenderar REMOVE för bearish trend
> - Svenskt aktiehandel för privatpersoner är främst LONG-orienterad

## Parametrar

### ATR Multiplier: 1.5

Stop-loss placeras på **1.5 × ATR** från entry för att:
- Ge utrymme för normal volatilitet
- Undvika för tidiga stop-outs
- Balansera risk mot potential

### Risk/Reward Ratio: 2.0

Target placeras alltid på **2× risken** för att:
- Säkerställa positiv expectancy över tid
- Kompensera för vinstprocent < 100%
- Följa best practice för swing trading

### ATR Period: 14 dagar

Använder 14-dagars ATR eftersom:
- Standardperiod för swing trading
- Väl testat i backtest
- Balans mellan känslighet och stabilitet

## Användning i Systemet

Dessa beräknade värden används konsekvent i:

1. **Trade-plan diagram** - visar entry/stop/target visuellt
2. **AI-analys** - under "RISK & POSITIONSSTORLEK"
3. **Köp-dialog** - föreslår entry/stop/target när du klickar "Köp"

Alla tre använder **exakt samma** beräknade värden från backend för att garantera konsistens.

## Kodplacering

- **Beräkning:** [server.js:607-644](server.js#L607-L644)
- **API response:** [server.js:647-680](server.js#L647-L680) (inkluderar `trade` object)
- **Frontend användning:** [src/App.jsx:420-423](src/App.jsx#L420-L423)

## Exempel från Kod

```javascript
// server.js
const entry = lastClose;
const atrMultiplier = 1.5;
const rrRatio = 2.0;

// För LONG
const stop = entry - (lastATR * atrMultiplier);
const target = entry + ((entry - stop) * rrRatio);

trade = {
  direction: "LONG",
  entry: parseFloat(entry.toFixed(2)),
  stop: parseFloat(stop.toFixed(2)),
  target: parseFloat(target.toFixed(2)),
  rr: rrRatio,
  atr: parseFloat(lastATR.toFixed(2))
};
```

## Justeringar

För att ändra beräkningarna:

1. **Tightare stop:** Minska `atrMultiplier` från 1.5 till t.ex. 1.0
2. **Högre target:** Öka `rrRatio` från 2.0 till t.ex. 3.0
3. **Annan entry:** Ändra från `lastClose` till t.ex. `last.high`

⚠️ **Viktigt:** Ändringar påverkar både live-handel och backtest-resultat.
