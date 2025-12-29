# Trading Agents - Dokumentation

## Översikt

Trading Agents är ett automatiserat system som övervakar screener-listan och flaggar aktier när specifika trading-setups uppstår. Varje agent har sina egna kriterier och körs automatiskt varje dag.

## Agent Typer

### 1. Trend + Pullback Agent

**Syfte:** Identifiera starka trender med lågrisk pullback-entry

**Kriterier:**
```javascript
✓ Close > SMA200          // Långsiktig upptrend
✓ SMA50 > SMA200         // Medellång upptrend
✓ Pullback 2-6 dagar     // Kortsiktig retracement mot EMA20
✓ Volym inte kollapsat   // MinVolym > 50% av genomsnitt
✓ RSI 30-50              // Översålt till neutral
```

**Entry Trigger:**
- Pris studsar från EMA20 (close > EMA20 efter 2-6 dagar under)
- Volym ökar på studs-dagen (relVol > 1.0)

---

### 2. Breakout Agent

**Syfte:** Identifiera konsolideringar som bryter uppåt med volym

**Kriterier:**
```javascript
✓ Konsolidering 10-30 dagar  // Range < ATR × 2
✓ Close > Range High         // Breakout
✓ Volym × 1.5                // Kraftig volym
✓ ATR expansiv               // Volatilitet ökar
```

---

### 3. Strong Momentum Agent

**Syfte:** Identifiera aktier i stark uppstigande trend

**Kriterier:**
```javascript
✓ Close > EMA20 > EMA50 > SMA200
✓ EMA20 slope > 0.05         // Stark stigande trend
✓ RSI 60-75                  // Starkt momentum men ej extremt
✓ Volym > genomsnitt         // Bekräftelse
```

---

### 4. Reversal Agent

**Syfte:** Identifiera potentiella vändningar från översålda nivåer

**Kriterier:**
```javascript
✓ RSI < 30                   // Översålt
✓ Close > EMA20              // Pris över kortsiktig trend
✓ Volym × 1.5                // Volym-spike
✓ Bullish candle             // Close > Open
```

---

## Implementation

### Databas Schema

```sql
CREATE TABLE trading_agents (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  criteria JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE agent_signals (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES trading_agents(id),
  ticker TEXT NOT NULL,
  signal_date DATE NOT NULL,
  setup_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_signals_date ON agent_signals(signal_date DESC);
CREATE INDEX idx_agent_signals_ticker ON agent_signals(ticker);
```

### API Endpoints

#### `GET /api/agents`
Lista alla agents och deras status

#### `GET /api/agents/:id/signals`
Hämta aktiva signaler för en specifik agent

#### `POST /api/agents/scan`
Kör alla agents mot screener-listan

---

## Exempel: Trend + Pullback Agent

### Kriterier Definition
```javascript
const trendPullbackAgent = {
  name: "Trend + Pullback",
  type: "PULLBACK",
  criteria: {
    // Långsiktig trend
    closAboveSMA200: true,
    sma50AboveSMA200: true,

    // Pullback kriterier
    pullbackDays: { min: 2, max: 6 },
    pullbackTarget: "EMA20",

    // Volym
    minRelativeVolume: 0.5,

    // Momentum
    rsi: { min: 30, max: 50 }
  }
};
```

### Detection Algoritm
```javascript
function detectTrendPullback(candles, indicators) {
  const { sma200, sma50, ema20, rsi, volumes } = indicators;
  const closes = candles.map(c => c.close);

  // 1. Check trend conditions
  const lastClose = closes.at(-1);
  const lastSMA200 = sma200.at(-1);
  const lastSMA50 = sma50.at(-1);

  if (lastClose <= lastSMA200) return null;  // Close must be above SMA200
  if (lastSMA50 <= lastSMA200) return null;  // SMA50 must be above SMA200

  // 2. Count pullback days
  let pullbackDays = 0;
  for (let i = closes.length - 1; i >= 0; i--) {
    if (closes[i] < ema20[i]) {
      pullbackDays++;
    } else {
      break;  // Exit when price was above EMA20
    }
  }

  // 3. Check if in pullback range (2-6 days)
  if (pullbackDays < 2 || pullbackDays > 6) return null;

  // 4. Check volume hasn't collapsed
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b) / 20;
  const currentVolume = volumes.at(-1);
  const relVol = currentVolume / avgVolume;

  if (relVol < 0.5) return null;  // Volume too low

  // 5. Check RSI
  const currentRSI = rsi.at(-1);
  if (currentRSI < 30 || currentRSI > 50) return null;

  // ✓ All criteria met!
  return {
    type: "TREND_PULLBACK",
    pullbackDays,
    relativeVolume: relVol,
    rsi: currentRSI,
    entry: lastClose,
    stop: Math.min(...closes.slice(-pullbackDays)),  // Recent low
    strength: calculateStrength(pullbackDays, relVol, currentRSI)
  };
}
```

### Strength Calculation
```javascript
function calculateStrength(pullbackDays, relVol, rsi) {
  let strength = 50;  // Base

  // Optimal pullback duration (3-4 days)
  if (pullbackDays >= 3 && pullbackDays <= 4) strength += 20;
  else if (pullbackDays === 2 || pullbackDays === 5) strength += 10;

  // Volume strength
  if (relVol > 1.0) strength += 15;
  else if (relVol > 0.75) strength += 10;

  // RSI sweet spot (35-45)
  if (rsi >= 35 && rsi <= 45) strength += 15;
  else if (rsi >= 30 && rsi <= 50) strength += 5;

  return Math.min(100, strength);
}
```

---

## Usage

### 1. Skapa Agent
```javascript
POST /api/agents
{
  "name": "Trend + Pullback",
  "type": "PULLBACK",
  "enabled": true,
  "criteria": { /* ... */ }
}
```

### 2. Kör Daglig Scan
```bash
# Cron job som körs kl 18:00 varje börsdag
0 18 * * 1-5 curl -X POST http://localhost:3002/api/agents/scan
```

### 3. Hämta Aktiva Signaler
```javascript
GET /api/agents/1/signals?active=true

Response:
{
  "agent": "Trend + Pullback",
  "signals": [
    {
      "ticker": "VOLV-B.ST",
      "signalDate": "2025-12-29",
      "setup": {
        "type": "TREND_PULLBACK",
        "pullbackDays": 3,
        "relativeVolume": 0.85,
        "rsi": 42,
        "entry": 285.50,
        "stop": 278.20,
        "strength": 85
      }
    }
  ]
}
```

---

## Frontend Integration

### Agent Dashboard
```jsx
<div className="agents-dashboard">
  <h2>Trading Agents</h2>

  {agents.map(agent => (
    <AgentCard key={agent.id} agent={agent}>
      <AgentStatus enabled={agent.enabled} />
      <SignalCount count={agent.activeSignals} />
      <SignalList signals={agent.signals} />
    </AgentCard>
  ))}
</div>
```

### Signal Alert
```jsx
<div className="signal-alert">
  <span className="agent-badge">Trend + Pullback</span>
  <strong>{signal.ticker}</strong>
  <span className="strength">{signal.strength}/100</span>
  <button onClick={() => viewDetails(signal)}>Detaljer</button>
</div>
```

---

## Notifications

### Email Alert (Optional)
```javascript
// När ny signal upptäcks
sendEmail({
  to: user.email,
  subject: `🚨 Ny signal: ${signal.ticker}`,
  body: `
    Agent: ${agent.name}
    Ticker: ${signal.ticker}
    Setup: ${signal.setup.type}
    Strength: ${signal.strength}/100
    Entry: ${signal.entry}
    Stop: ${signal.stop}
  `
});
```

### Push Notification
```javascript
// Browser notification
new Notification("Ny Trading Signal", {
  body: `${signal.ticker} - ${agent.name}`,
  icon: "/icon.png"
});
```

---

## Backtest Agents

### Historisk Prestanda
```javascript
GET /api/agents/1/backtest?period=3m

Response:
{
  "agent": "Trend + Pullback",
  "period": "3 months",
  "stats": {
    "totalSignals": 24,
    "winners": 17,
    "losers": 7,
    "winRate": 70.8,
    "avgReturn": 4.2,
    "expectancy": 2.8
  }
}
```

---

## Roadmap

### Fas 1 (Grundläggande)
- [x] Agent kriterier definition
- [ ] Detection algoritmer
- [ ] Databas schema
- [ ] API endpoints
- [ ] Frontend integration

### Fas 2 (Förbättrad)
- [ ] Email notifikationer
- [ ] Agent backtest
- [ ] Custom agent builder (UI)
- [ ] Signal historik

### Fas 3 (Avancerad)
- [ ] Machine learning för agent optimization
- [ ] Multi-timeframe agents
- [ ] Portfolio allocation baserat på agent signals
- [ ] Auto-trading integration (med confirmation)

---

## Best Practices

### 1. Agent Design
- Håll kriterier specifika och testbara
- Max 5-7 kriterier per agent
- Balansera sensitivitet vs specificitet

### 2. Signal Management
- Archivera gamla signaler (>30 dagar)
- Track outcome för varje signal
- Learn från false positives

### 3. Risk Management
- Använd agent strength för position sizing
- Max 3-5 signaler samtidigt per agent
- Diversifiera över olika agent typer

---

## FAQ

### Q: Hur många agents kan jag ha?
**A:** Ingen teknisk begränsning, men rekommenderat max 5-10 för att hålla översikt.

### Q: Kan jag skapa egna agents?
**A:** Ja, i Fas 2 kommer en Custom Agent Builder i UI.

### Q: Hur ofta scannas agents?
**A:** En gång per dag efter börsens stängning (18:00 CET).

### Q: Vad händer när en signal triggas?
**A:** Signalen sparas i databasen och visas i frontend. Du kan också aktivera email/push notifications.

---

## Kontakt

För frågor eller feature requests, kontakta utvecklingsteamet.
