# Trading Agents - Setup Guide

## Översikt

Trading Agents är nu implementerat! Detta system söker automatiskt efter specifika trading-setups i screener-listan.

## Implementerad Funktionalitet

### ✅ Fas 1 - Grundläggande (Färdigt!)

1. **SMA200 & SMA50 Indikatorer** - Lagt till i server.js för agent-kriterier
2. **Databas Schema** - Tabeller för trading_agents och agent_signals
3. **Trend + Pullback Detection** - Komplett algoritm enligt specifikation
4. **API Endpoints**:
   - `GET /api/agents` - Lista alla agents
   - `GET /api/agents/:id` - Hämta specifik agent
   - `GET /api/agents/signals/active` - Alla aktiva signaler
   - `POST /api/agents/scan` - Kör agent-scan
   - `POST /api/agents/:id/toggle` - Aktivera/inaktivera agent
   - `POST /api/agents/signals/:id/deactivate` - Stäng signal
5. **Frontend Dashboard** - Komplett UI för agents och signaler

## Installation

### Steg 1: Kör Databas Migration

Öppna Supabase SQL Editor och kör följande SQL:

```bash
cat scripts/add-trading-agents.sql
```

Eller kör via terminalen:

```bash
node scripts/run-agents-migration.js
```

Detta skapar:
- Tabell `trading_agents` för agent-definitioner
- Tabell `agent_signals` för upptäckta signaler
- 4 pre-konfigurerade agents:
  1. **Trend + Pullback** (PULLBACK)
  2. **Breakout** (BREAKOUT) - *ej implementerad ännu*
  3. **Strong Momentum** (MOMENTUM) - *ej implementerad ännu*
  4. **Reversal** (REVERSAL) - *ej implementerad ännu*

### Steg 2: Verifiera Installation

```bash
# Starta servern
node server.js

# I annan terminal, testa API
curl http://localhost:3002/api/agents
```

Du bör se 4 agents i responsen.

### Steg 3: Kör Din Första Agent Scan

#### Via API:
```bash
curl -X POST http://localhost:3002/api/agents/scan
```

#### Via Frontend:
1. Starta frontend: `npm run dev`
2. Gå till Dashboard
3. Klicka på **🤖 Trading Agents** knappen
4. Klicka på **🔍 Kör Agent Scan**

Scannen kommer:
- Kör alla aktiverade agents mot screener-listan (40 aktier)
- Hämta 1 års historik för varje aktie
- Identifiera setups som matchar agent-kriterier
- Spara signaler i databasen
- Visa resultat i UI

**Observera:** Första scannen kan ta 2-5 minuter beroende på antal aktier.

## Trend + Pullback Agent

### Kriterier

```javascript
{
  "closeAboveSMA200": true,        // Långsiktig upptrend
  "sma50AboveSMA200": true,        // Medellång upptrend
  "pullbackDays": { "min": 2, "max": 6 },  // Pullback 2-6 dagar
  "pullbackTarget": "EMA20",       // Mot EMA20
  "minRelativeVolume": 0.5,        // Volym inte kollapsat
  "rsi": { "min": 30, "max": 50 }  // Översålt till neutral
}
```

### Signal Output

När en signal upptäcks sparas följande data:

```json
{
  "type": "TREND_PULLBACK",
  "pullbackDays": 3,
  "relativeVolume": 0.85,
  "rsi": 42.3,
  "entry": 285.50,
  "stop": 278.20,
  "target": 300.10,
  "strength": 85,
  "atr": 4.50
}
```

**Strength Calculation (0-100):**
- Base: 50
- Optimal pullback (3-4 dagar): +20
- Volym > 1.0: +15
- RSI 35-45: +15

## Användning

### Via Frontend

1. **Navigera till Agents Dashboard**
   - Klicka på **🤖 Trading Agents** i huvudmenyn

2. **Kör Agent Scan**
   - Klicka **🔍 Kör Agent Scan**
   - Vänta medan systemet scannar alla aktier
   - Se resultat: antal nya signaler

3. **Visa Aktiva Signaler**
   - Signaler visas automatiskt under "Aktiva Signaler"
   - Varje signal visar: ticker, type, strength, entry, stop, target

4. **Hantera Signaler**
   - Klicka **Stäng** för att inaktivera en signal
   - Inaktiverade signaler visas ej längre i listan

5. **Aktivera/Inaktivera Agents**
   - Klicka **Inaktivera** för att stänga av en agent
   - Inaktiva agents körs inte vid nästa scan

### Via API

#### Lista Agents
```bash
curl http://localhost:3002/api/agents
```

#### Kör Scan
```bash
curl -X POST http://localhost:3002/api/agents/scan
```

#### Hämta Aktiva Signaler
```bash
curl http://localhost:3002/api/agents/signals/active
```

#### Inaktivera Signal
```bash
curl -X POST http://localhost:3002/api/agents/signals/1/deactivate
```

## Automatisera Daglig Scan

### Med Cron (Linux/Mac)

```bash
# Lägg till i crontab (kör kl 18:00 varje börsdag)
0 18 * * 1-5 curl -X POST http://localhost:3002/api/agents/scan
```

### Med Windows Task Scheduler

Skapa en schemalagd task som kör:
```powershell
curl -X POST http://localhost:3002/api/agents/scan
```

## Nästa Steg (Fas 2)

För att aktivera fler funktioner, se [TRADING_AGENTS.md](TRADING_AGENTS.md):

- [ ] Email-notifikationer vid nya signaler
- [ ] Agent backtest (historisk prestanda)
- [ ] Custom agent builder (UI för att skapa egna agents)
- [ ] Signal historik och statistik

## Troubleshooting

### Problem: "agents table does not exist"

**Lösning:** Kör migration script:
```bash
node scripts/run-agents-migration.js
```
Kopiera SQL-koden och kör den i Supabase SQL Editor.

### Problem: "No stocks in screener"

**Lösning:** Lägg till aktier i screener-listan:
```bash
node scripts/update-screener-db.js
```

### Problem: "Scan takes too long"

Detta är normalt för första scannen. Yahoo Finance API kan vara långsam för svenska aktier.

**Optimering:**
- Minska antal aktier i screener
- Kör scan när börsen är stängd (mindre last på Yahoo API)

### Problem: "No signals found"

**Möjliga orsaker:**
1. Agents kan vara för strikta - justera kriterier i databasen
2. Marknaden saknar setups just nu
3. Felaktig data från Yahoo Finance

**Diagnostik:**
Kolla server logs för detaljer:
```bash
tail -f /tmp/server.log
```

## Databas Schema

### trading_agents
```sql
CREATE TABLE trading_agents (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  criteria JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### agent_signals
```sql
CREATE TABLE agent_signals (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES trading_agents(id),
  ticker TEXT NOT NULL,
  signal_date DATE NOT NULL,
  setup_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Support

För frågor eller buggar, se [TRADING_AGENTS.md](TRADING_AGENTS.md) för mer detaljer om systemet.
