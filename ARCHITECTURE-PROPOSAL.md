# 🏗️ Arkitekturförslag - Robust & Centraliserad Logik

## 📊 Nuvarande Problem

### Logik är utspridd:
- **Backend**: `server.js` (2100+ rader), `api/analyze.js`, `api/backtest.js`, `api/ai-analysis.js`
- **Frontend**: Beräkningar i React-komponenter (PnL, dagar, etc.)
- **Duplicerad kod**: PnL-beräkningar både i `ClosedPositions.jsx` och `ClosedPositionDetail.jsx`
- **Svårt att testa**: Logik hårdkopplad till Express routes
- **Ingen separation**: Business logic blandat med API routes och databas-queries

---

## ✅ Föreslagen Lösning: Layered Architecture

```
┌─────────────────────────────────────────┐
│         PRESENTATION LAYER              │
│  (React Components - UI Only)           │
│  - Dashboard.jsx                        │
│  - ClosedPositions.jsx                  │
│  - PositionDetail.jsx                   │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         API LAYER                       │
│  (Express Routes - Thin Controllers)    │
│  - server.js (routing only)             │
│  - api/*.js (Vercel functions)          │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         SERVICE LAYER ⭐                │
│  (Business Logic - Single Source)       │
│  - portfolio.service.js                 │
│  - position.service.js                  │
│  - analysis.service.js                  │
│  - backtest.service.js                  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         REPOSITORY LAYER                │
│  (Data Access - Database Only)          │
│  - portfolio.repository.js              │
│  - events.repository.js                 │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         DATABASE                        │
│  (Supabase PostgreSQL)                  │
└─────────────────────────────────────────┘
```

---

## 📁 Föreslagen Mappstruktur

```
/services/               ← NY: All business logic här
  ├── portfolio.service.js
  ├── position.service.js
  ├── watchlist.service.js
  ├── market-data.service.js
  ├── analysis.service.js
  ├── backtest.service.js
  └── ai.service.js

/repositories/           ← NY: Databas-access isolerat
  ├── portfolio.repository.js
  ├── watchlist.repository.js
  └── events.repository.js

/utils/                  ← NY: Ren logik (no side effects)
  ├── calculations.js    # PnL, R-multiple, win rate
  ├── validators.js      # Input validation
  ├── formatters.js      # Datum, nummer, etc.
  └── constants.js       # Exit types, status, etc.

/models/                 ← NY: Domain models
  ├── Position.js
  ├── ClosedPosition.js
  └── Trade.js

/routes/                 ← BEFINTLIG: Refaktoreras till thin controllers
  server.js              # Express routes (använder services)

/api/                    ← BEFINTLIG: Vercel functions (använder services)
  analyze.js
  backtest.js
  ai-analysis.js

/src/components/         ← BEFINTLIG: React (använder API, ingen business logic)
  Dashboard.jsx
  ClosedPositions.jsx
  ClosedPositionDetail.jsx
```

---

## 🔧 Konkreta Exempel

### **1. Service Layer: position.service.js**

```javascript
// services/position.service.js
import * as calculations from '../utils/calculations.js';
import * as validators from '../utils/validators.js';
import PortfolioRepository from '../repositories/portfolio.repository.js';
import EventsRepository from '../repositories/events.repository.js';

export default class PositionService {

  /**
   * Öppna ny position
   */
  static async openPosition(positionData) {
    // 1. Validera
    validators.validatePositionEntry(positionData);

    // 2. Beräkna värden
    const initialR = calculations.calculateInitialR(
      positionData.entry_price,
      positionData.initial_stop
    );

    const riskKr = calculations.calculateRiskKr(
      positionData.quantity,
      initialR
    );

    // 3. Spara till databas
    const position = await PortfolioRepository.create({
      ...positionData,
      initial_r: initialR,
      risk_kr: riskKr,
      exit_status: 'HOLD'
    });

    // 4. Skapa ENTRY event
    await EventsRepository.create({
      ticker: position.ticker,
      event_type: 'ENTRY',
      event_date: positionData.entry_date,
      description: `Köpt ${positionData.quantity} aktier @ ${positionData.entry_price} kr`
    });

    return position;
  }

  /**
   * Exit position
   */
  static async exitPosition(ticker, exitData) {
    // 1. Hämta position
    const position = await PortfolioRepository.findByTicker(ticker);
    if (!position) throw new Error('Position not found');

    // 2. Beräkna exit-värden
    const rMultiple = calculations.calculateRMultiple(
      position.entry_price,
      exitData.exit_price,
      position.initial_r
    );

    const pnlPct = calculations.calculatePnlPercent(
      position.entry_price,
      exitData.exit_price
    );

    const pnlKr = calculations.calculatePnlKr(
      position.quantity,
      position.entry_price,
      exitData.exit_price
    );

    // 3. Uppdatera position
    const updatedPosition = await PortfolioRepository.update(ticker, {
      exit_date: exitData.exit_date,
      exit_price: exitData.exit_price,
      exit_type: exitData.exit_type,
      exit_status: 'EXITED',
      r_multiple: rMultiple,
      pnl_pct: pnlPct,
      last_updated: new Date().toISOString().split('T')[0]
    });

    // 4. Skapa EXIT event
    await EventsRepository.create({
      ticker,
      event_type: 'EXIT',
      event_date: exitData.exit_date,
      description: `Såld @ ${exitData.exit_price} kr (${exitData.exit_type})`
    });

    return {
      ...updatedPosition,
      pnl_kr: pnlKr
    };
  }

  /**
   * Hämta alla avslutade positioner med beräknade värden
   */
  static async getClosedPositions() {
    const positions = await PortfolioRepository.findByExitStatus('EXITED');

    return positions.map(p => ({
      ...p,
      pnl_kr: calculations.calculatePnlKr(p.quantity, p.entry_price, p.exit_price),
      days_in_trade: calculations.calculateDaysInTrade(p.entry_date, p.exit_date)
    }));
  }

  /**
   * Uppdatera självutvärdering
   */
  static async updateEvaluation(ticker, evaluationData) {
    validators.validateEvaluation(evaluationData);

    return await PortfolioRepository.update(ticker, {
      ...evaluationData,
      last_updated: new Date().toISOString().split('T')[0]
    });
  }
}
```

---

### **2. Utils: calculations.js (Ren matematik)**

```javascript
// utils/calculations.js

/**
 * Beräkna initial R (risk per aktie)
 */
export function calculateInitialR(entryPrice, stopPrice) {
  return Math.abs(entryPrice - stopPrice);
}

/**
 * Beräkna risk i kronor
 */
export function calculateRiskKr(quantity, initialR) {
  return quantity * initialR;
}

/**
 * Beräkna R-multiple vid exit
 */
export function calculateRMultiple(entryPrice, exitPrice, initialR) {
  if (!initialR || initialR === 0) return 0;
  return (exitPrice - entryPrice) / initialR;
}

/**
 * Beräkna PnL i procent
 */
export function calculatePnlPercent(entryPrice, exitPrice) {
  if (!entryPrice || entryPrice === 0) return 0;
  return ((exitPrice - entryPrice) / entryPrice) * 100;
}

/**
 * Beräkna PnL i kronor
 */
export function calculatePnlKr(quantity, entryPrice, exitPrice) {
  return quantity * (exitPrice - entryPrice);
}

/**
 * Beräkna dagar i trade
 */
export function calculateDaysInTrade(entryDate, exitDate) {
  if (!entryDate || !exitDate) return null;
  const entry = new Date(entryDate);
  const exit = new Date(exitDate);
  return Math.ceil((exit - entry) / (1000 * 60 * 60 * 24));
}

/**
 * Beräkna win rate
 */
export function calculateWinRate(trades) {
  if (!trades || trades.length === 0) return 0;
  const winners = trades.filter(t => t.r_multiple > 0).length;
  return (winners / trades.length) * 100;
}

/**
 * Beräkna genomsnittlig R
 */
export function calculateAverageR(trades) {
  if (!trades || trades.length === 0) return 0;
  const totalR = trades.reduce((sum, t) => sum + (t.r_multiple || 0), 0);
  return totalR / trades.length;
}

/**
 * Beräkna Sharpe Ratio (förenklad)
 */
export function calculateSharpeRatio(trades) {
  if (!trades || trades.length < 2) return 0;

  const avgR = calculateAverageR(trades);
  const rValues = trades.map(t => t.r_multiple || 0);
  const variance = rValues.reduce((sum, r) => sum + Math.pow(r - avgR, 2), 0) / trades.length;
  const stdDev = Math.sqrt(variance);

  return stdDev === 0 ? 0 : avgR / stdDev;
}
```

---

### **3. Repository: portfolio.repository.js**

```javascript
// repositories/portfolio.repository.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default class PortfolioRepository {

  /**
   * Skapa ny position
   */
  static async create(positionData) {
    const { data, error } = await supabase
      .from('portfolio')
      .insert([positionData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Hämta position per ticker
   */
  static async findByTicker(ticker) {
    const { data, error } = await supabase
      .from('portfolio')
      .select('*')
      .eq('ticker', ticker)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Hämta alla positioner med viss exit_status
   */
  static async findByExitStatus(exitStatus) {
    const { data, error } = await supabase
      .from('portfolio')
      .select('*')
      .eq('exit_status', exitStatus)
      .order('exit_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Uppdatera position
   */
  static async update(ticker, updates) {
    const { data, error } = await supabase
      .from('portfolio')
      .update(updates)
      .eq('ticker', ticker)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Ta bort position
   */
  static async delete(ticker) {
    const { error } = await supabase
      .from('portfolio')
      .delete()
      .eq('ticker', ticker);

    if (error) throw error;
  }
}
```

---

### **4. Validators: validators.js**

```javascript
// utils/validators.js

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validera position entry
 */
export function validatePositionEntry(data) {
  if (!data.ticker) {
    throw new ValidationError('Ticker krävs');
  }

  if (!data.entry_price || data.entry_price <= 0) {
    throw new ValidationError('Entry price måste vara > 0');
  }

  if (!data.quantity || data.quantity <= 0) {
    throw new ValidationError('Quantity måste vara > 0');
  }

  if (!data.initial_stop || data.initial_stop >= data.entry_price) {
    throw new ValidationError('Stop måste vara lägre än entry price');
  }

  if (!data.initial_target || data.initial_target <= data.entry_price) {
    throw new ValidationError('Target måste vara högre än entry price');
  }

  if (data.risk_pct && data.risk_pct > 3) {
    throw new ValidationError('Risk får inte överstiga 3%');
  }
}

/**
 * Validera exit data
 */
export function validatePositionExit(data) {
  if (!data.exit_price || data.exit_price <= 0) {
    throw new ValidationError('Exit price måste vara > 0');
  }

  if (!data.exit_type) {
    throw new ValidationError('Exit type krävs');
  }

  const validExitTypes = ['TARGET', 'STOP', 'EMA20', 'ATR', 'TIME', 'PARTIAL_SCALE', 'PANIC'];
  if (!validExitTypes.includes(data.exit_type)) {
    throw new ValidationError(`Exit type måste vara en av: ${validExitTypes.join(', ')}`);
  }
}

/**
 * Validera självutvärdering
 */
export function validateEvaluation(data) {
  if (data.edge_tag && !['A', 'B', 'C'].includes(data.edge_tag)) {
    throw new ValidationError('Edge tag måste vara A, B eller C');
  }

  if (data.lesson_learned && data.lesson_learned.length > 500) {
    throw new ValidationError('Lärdom får max vara 500 tecken');
  }
}
```

---

### **5. Refaktorerad server.js (Thin Controller)**

```javascript
// server.js
import express from 'express';
import PositionService from './services/position.service.js';

const app = express();
app.use(express.json());

// ============================================
// PORTFOLIO ENDPOINTS - Använder PositionService
// ============================================

// GET /api/portfolio/closed
app.get("/api/portfolio/closed", async (req, res) => {
  try {
    const positions = await PositionService.getClosedPositions();
    res.json(positions);
  } catch (e) {
    console.error("Get closed positions error:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/portfolio/open
app.post("/api/portfolio/open", async (req, res) => {
  try {
    const position = await PositionService.openPosition(req.body);
    res.json(position);
  } catch (e) {
    console.error("Open position error:", e);
    res.status(400).json({ error: e.message });
  }
});

// POST /api/portfolio/:ticker/exit
app.post("/api/portfolio/:ticker/exit", async (req, res) => {
  try {
    const position = await PositionService.exitPosition(req.params.ticker, req.body);
    res.json(position);
  } catch (e) {
    console.error("Exit position error:", e);
    res.status(400).json({ error: e.message });
  }
});

// POST /api/portfolio/:ticker/evaluation
app.post("/api/portfolio/:ticker/evaluation", async (req, res) => {
  try {
    const position = await PositionService.updateEvaluation(req.params.ticker, req.body);
    res.json(position);
  } catch (e) {
    console.error("Update evaluation error:", e);
    res.status(400).json({ error: e.message });
  }
});
```

---

## 🎯 Fördelar med denna arkitektur

### **1. Single Source of Truth**
- **Före**: PnL beräknas i både `ClosedPositions.jsx` OCH `ClosedPositionDetail.jsx`
- **Efter**: `calculations.js` innehåller EN implementation som används överallt

### **2. Testbarhet**
```javascript
// Test exempel
import { calculateRMultiple } from '../utils/calculations.js';

test('calculateRMultiple: vinnare', () => {
  const result = calculateRMultiple(240, 256.80, 5);
  expect(result).toBeCloseTo(3.36, 2);
});

test('calculateRMultiple: förlorare', () => {
  const result = calculateRMultiple(370, 365.50, 5);
  expect(result).toBeCloseTo(-0.9, 2);
});
```

### **3. Återanvändbarhet**
- Services kan användas i BÅDE Express (`server.js`) OCH Vercel (`api/*.js`)
- Frontend kan använda samma `calculations.js` för client-side preview

### **4. Maintainability**
- **Bugfix**: Ändra EN fil (`calculations.js`) istället för 5+ komponenter
- **Feature**: Lägg till i Service layer, alla consumers får det automatiskt
- **Refactoring**: Databas-schema ändras? Uppdatera Repository, Service-layer opåverkad

### **5. Separation of Concerns**
- **Routes**: Routing + HTTP only
- **Services**: Business logic only
- **Repositories**: Database access only
- **Utils**: Pure functions only
- **Components**: UI rendering only

---

## 📋 Migrationsplan (Steg-för-steg)

### **Fas 1: Setup (1-2h)**
1. Skapa nya mappar: `/services`, `/repositories`, `/utils`, `/models`
2. Skapa `calculations.js` med alla matematiska funktioner
3. Skapa `validators.js` med all validering
4. Skapa `constants.js` med EXIT_TYPES, STATUS, etc.

### **Fas 2: Repository Layer (2-3h)**
1. Skapa `portfolio.repository.js` - flytta alla Supabase queries från `server.js`
2. Skapa `events.repository.js` - flytta event-queries
3. Skapa `watchlist.repository.js` - flytta watchlist-queries

### **Fas 3: Service Layer (3-4h)**
1. Skapa `position.service.js` - flytta position-logik från `server.js`
2. Skapa `analysis.service.js` - flytta från `api/analyze.js`
3. Skapa `backtest.service.js` - flytta från `api/backtest.js`

### **Fas 4: Refactor Controllers (2-3h)**
1. Uppdatera `server.js` routes att använda Services
2. Uppdatera `api/*.js` Vercel functions att använda Services

### **Fas 5: Frontend Cleanup (1-2h)**
1. Ta bort PnL-beräkningar från React-komponenter
2. Använd backend-beräknade värden istället

### **Fas 6: Testing (2-3h)**
1. Skriv unit tests för `calculations.js`
2. Skriv unit tests för `validators.js`
3. Skriv integration tests för Services

**Total tid: ~12-18h**

---

## 🚀 Nästa Steg (Om du vill börja)

### **Quick Win: Starta med calculations.js**

1. Skapa `/utils/calculations.js`
2. Flytta alla beräkningar dit
3. Använd i både backend OCH frontend
4. Skriv tests

Detta ger dig:
- ✅ Single source of truth för beräkningar
- ✅ Enklare att testa
- ✅ Mindre duplicerad kod
- ✅ Konsistenta resultat överallt

Vill du att jag implementerar Fas 1 direkt? Det tar ~30 minuter och ger dig grunden att bygga vidare på.
