# Utils - Single Source of Truth

Denna mapp innehåller **ren, återanvändbar logik** som används av både backend och frontend.

## 📁 Filer

### `calculations.js`
**Alla trading-beräkningar på ett ställe**

```javascript
import { calculateRMultiple, calculatePnlKr } from './utils/calculations.js';

// Beräkna R-multiple
const r = calculateRMultiple(240, 256.80, 5); // 3.36R

// Beräkna PnL i kr
const pnl = calculatePnlKr(100, 240, 256.80); // 1680 kr
```

**Funktioner:**
- Position calculations: `calculateInitialR`, `calculateRiskKr`, `calculateRRRatio`
- Exit calculations: `calculateRMultiple`, `calculatePnlPercent`, `calculatePnlKr`, `calculateDaysInTrade`
- Portfolio statistics: `calculateWinRate`, `calculateAverageR`, `calculateExpectancy`, `calculateProfitFactor`, `calculateSharpeRatio`, `calculateMaxDrawdown`
- MFE/MAE: `calculateUnrealizedR`, `calculateTradeEfficiency`
- Formatters: `formatRMultiple`, `formatPercent`, `formatKr`
- Colors: `getRMultipleColor`, `getPercentColor`

---

### `validators.js`
**Alla valideringar på ett ställe**

```javascript
import { validatePositionEntry, ValidationError } from './utils/validators.js';

try {
  validatePositionEntry({
    ticker: 'AAPL',
    entry_price: 180,
    quantity: 50,
    initial_stop: 177,
    initial_target: 187.5,
    risk_pct: 1.5
  });
} catch (err) {
  if (err instanceof ValidationError) {
    console.error(`Validation error in ${err.field}: ${err.message}`);
  }
}
```

**Funktioner:**
- `validatePositionEntry(data)` - Validera entry data
- `validatePositionExit(data)` - Validera exit data
- `validateEvaluation(data)` - Validera självutvärdering
- `validateStopTargetUpdate(field, value, position)` - Validera stop/target uppdatering
- `isValidTicker(ticker)` - Kontrollera ticker format
- `isValidDate(dateString)` - Kontrollera datum format
- `sanitizeString(input)` - Sanitera input (XSS-skydd)

---

### `constants.js`
**Alla konstanter på ett ställe**

```javascript
import { EXIT_TYPE, EDGE_TAG, WATCHLIST_STATUS_ICONS } from './utils/constants.js';

// Använd konstanter istället för magic strings
const exitType = EXIT_TYPE.TARGET; // 'TARGET'
const edgeTag = EDGE_TAG.A; // 'A'
const icon = WATCHLIST_STATUS_ICONS.READY; // '🟢'
```

**Konstanter:**
- `EXIT_STATUS` - HOLD, PARTIAL_EXIT, EXITED
- `EXIT_TYPE` - TARGET, STOP, EMA20, TIME, etc.
- `ENTRY_SETUP` - Pullback, Breakout, Range, etc.
- `TRAILING_TYPE` - EMA20, EMA50, ATR, Manual
- `WATCHLIST_STATUS` - WAIT_PULLBACK, READY, etc.
- `EDGE_TAG` - A, B, C
- `EVENT_TYPE` - ENTRY, EXIT, STOP_MOVED, etc.
- `RISK_LIMITS` - Max risk, R/R ratios
- `REGIME` - Bullish, Bearish, Sideways
- `RSI_LEVELS` - Oversold, Overbought levels
- `COLORS` - All färger för UI

---

## ✅ Fördelar

### 1. **Single Source of Truth**
```javascript
// ❌ FÖRE: Duplicerad kod
// ClosedPositions.jsx
const pnlKr = p.quantity * (p.exit_price - p.entry_price);

// ClosedPositionDetail.jsx
const pnlKr = position.quantity * (position.exit_price - position.entry_price);

// ✅ EFTER: EN implementation
import { calculatePnlKr } from '../utils/calculations.js';
const pnlKr = calculatePnlKr(quantity, entryPrice, exitPrice);
```

### 2. **Enkel att testa**
```javascript
// test/calculations.test.js
import { calculateRMultiple } from '../utils/calculations.js';

test('calculateRMultiple: vinnare', () => {
  expect(calculateRMultiple(240, 256.80, 5)).toBeCloseTo(3.36, 2);
});

test('calculateRMultiple: förlorare', () => {
  expect(calculateRMultiple(370, 365.50, 5)).toBeCloseTo(-0.9, 2);
});
```

### 3. **Återanvändbart**
```javascript
// Backend: server.js
import { calculateRMultiple } from './utils/calculations.js';

app.post('/api/portfolio/:ticker/exit', async (req, res) => {
  const r = calculateRMultiple(entry, exit, initialR);
  // ...
});

// Frontend: ClosedPositions.jsx
import { calculateRMultiple } from '../utils/calculations.js';

const r = calculateRMultiple(entry, exit, initialR);
```

### 4. **Type-safe med JSDoc**
```javascript
/**
 * Beräkna R-multiple vid exit
 * @param {number} entryPrice - Entry price
 * @param {number} exitPrice - Exit price
 * @param {number} initialR - Initial R value
 * @returns {number} R-multiple
 */
export function calculateRMultiple(entryPrice, exitPrice, initialR) {
  // ...
}
```

IDE visar autocomplete + parameter types!

---

## 🎯 Användning

### Backend (server.js)
```javascript
import { calculateRMultiple, calculatePnlPercent } from './utils/calculations.js';
import { validatePositionEntry } from './utils/validators.js';
import { EXIT_TYPE } from './utils/constants.js';

app.post('/api/portfolio/:ticker/exit', async (req, res) => {
  const r = calculateRMultiple(entry, exit, initialR);
  const pnl = calculatePnlPercent(entry, exit);

  await supabase.from('portfolio').update({
    r_multiple: r,
    pnl_pct: pnl,
    exit_type: EXIT_TYPE.TARGET
  });
});
```

### Frontend (React)
```javascript
import { calculatePnlKr, formatKr } from '../utils/calculations.js';
import { EDGE_TAG_COLORS } from '../utils/constants.js';

function ClosedPositionDetail({ position }) {
  const pnlKr = calculatePnlKr(
    position.quantity,
    position.entry_price,
    position.exit_price
  );

  return (
    <div>
      <span style={{ color: EDGE_TAG_COLORS[position.edge_tag] }}>
        {position.edge_tag}
      </span>
      <span>{formatKr(pnlKr)}</span>
    </div>
  );
}
```

---

## 🧪 Testning

```bash
# Skapa test/calculations.test.js
npm test
```

```javascript
import {
  calculateRMultiple,
  calculatePnlKr,
  calculateWinRate,
  calculateExpectancy
} from '../utils/calculations.js';

describe('Trading Calculations', () => {
  test('calculateRMultiple', () => {
    expect(calculateRMultiple(240, 256.80, 5)).toBeCloseTo(3.36, 2);
    expect(calculateRMultiple(370, 365.50, 5)).toBeCloseTo(-0.9, 2);
  });

  test('calculatePnlKr', () => {
    expect(calculatePnlKr(100, 240, 256.80)).toBe(1680);
    expect(calculatePnlKr(20, 370, 365.50)).toBe(-90);
  });

  test('calculateWinRate', () => {
    const trades = [
      { r_multiple: 3.36 },
      { r_multiple: 1.66 },
      { r_multiple: -0.9 },
      { r_multiple: -2.0 }
    ];
    expect(calculateWinRate(trades)).toBe(50);
  });
});
```

---

## 📋 Migrering (Nästa steg)

Se [ARCHITECTURE-PROPOSAL.md](../ARCHITECTURE-PROPOSAL.md) för fullständig plan.

**Fas 2: Repository Layer** (nästa)
- Flytta alla Supabase-queries till `/repositories`
- `portfolio.repository.js`
- `events.repository.js`
- `watchlist.repository.js`

**Fas 3: Service Layer**
- Flytta business logic till `/services`
- `position.service.js`
- `analysis.service.js`
- `backtest.service.js`
