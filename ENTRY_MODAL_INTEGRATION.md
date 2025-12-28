# Entry Modal - Integration Guide

## 📦 Vad har skapats?

En komplett **Entry Modal**-komponent ([EntryModal.jsx](src/components/EntryModal.jsx:1-1)) som hanterar övergången från **Watchlist → Portfolio**.

---

## 🎯 Funktionalitet

### 3 Sektioner (exakt enligt spec)

#### 1️⃣ Market Snapshot (automatisk, read-only)
Visar marknadsdatan vid entry-beslutet:
- Ticker, status, dagar i watchlist
- Tekniska indikatorer (RSI, EMAs, volym)
- Edge score
- Watchlist-reason

#### 2️⃣ Entry Form (manuell, obligatorisk)
Kräver att tradern fyller i:
- **Entry-pris** (kr)
- **Position size** (antal aktier)
- **Initial stop** (kr)
- **Initial target** (kr)
- **Entry rationale** (minst 20 tecken / 1-2 meningar)
- **5 checkboxar** (regelbekräftelse):
  - ✅ Trenden är upp
  - ✅ Entry följer min setup
  - ✅ Stop är definierad
  - ✅ R/R ≥ 2.0
  - ✅ Ingen regel bryts

#### 3️⃣ Risk Preview (live uträkningar)
Uppdateras automatiskt när du fyller i formuläret:
- **1R** (kr/aktie) - Risk per aktie
- **Risk (total)** - Total risk i kr
- **R/R-ratio** - Reward/Risk-förhållande
- **Avstånd till stop** (%)
- **Avstånd till target** (%)
- **Initial status** (HOLD)

---

## ✅ Validering

### Automatiska checks:
1. **Alla checkboxar måste bockas** - annars visas alert
2. **Entry rationale minst 20 tecken** - annars visas alert
3. **R/R < 2.0** - warning med confirm-dialog
4. **Alla numeriska fält måste fyllas** - HTML5 required

---

## 🔧 Integration i Watchlist

### Steg 1: Importera komponenten

Där Watchlist-komponenten finns (troligen i `src/components/Dashboard.jsx` eller en separat fil):

```jsx
import EntryModal from './EntryModal';
```

### Steg 2: Lägg till state

```jsx
const [showEntryModal, setShowEntryModal] = useState(false);
const [selectedStock, setSelectedStock] = useState(null);
```

### Steg 3: Lägg till modal i JSX

Längst ner i komponenten (efter all annan JSX):

```jsx
{showEntryModal && selectedStock && (
  <EntryModal
    stock={selectedStock}
    onClose={() => {
      setShowEntryModal(false);
      setSelectedStock(null);
    }}
    onConfirm={handleAddToPortfolio}
  />
)}
```

### Steg 4: Skapa handleAddToPortfolio

```jsx
async function handleAddToPortfolio(entryData) {
  try {
    const res = await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entryData)
    });

    if (res.ok) {
      // Close modal
      setShowEntryModal(false);
      setSelectedStock(null);

      // Refresh portfolio
      await fetchPortfolio();

      // Optional: Navigate to Position Detail
      // navigate(`/position-detail/${entryData.ticker}`);

      alert(`✅ ${entryData.ticker} tillagd i portfolio!`);
    } else {
      const error = await res.json();
      alert(`❌ Kunde inte lägga till: ${error.error}`);
    }
  } catch (e) {
    console.error('Add to portfolio error:', e);
    alert(`❌ Fel: ${e.message}`);
  }
}
```

### Steg 5: Ersätt "KÖP"-knappen i watchlist

Hitta den nuvarande knappen (sök efter "KÖP" eller "Lägg till i portfolio") och ersätt onClick:

**Tidigare:**
```jsx
<button onClick={() => handleAddToPortfolio(stock)}>
  KÖP
</button>
```

**Nu:**
```jsx
<button onClick={() => {
  setSelectedStock(stock);
  setShowEntryModal(true);
}}>
  KÖP
</button>
```

---

## 📊 Backend (server.js)

Entry Modal skickar ett komplett `entryData`-objekt till `POST /api/portfolio`.

### Förväntad payload:

```javascript
{
  // Automatic snapshot (från watchlist)
  ticker: "VOLV-B.ST",
  entry_date: "2025-12-28",
  source: "WATCHLIST",
  watchlist_status: "READY",
  days_in_watchlist: 3,
  snapshot_ema20: 240.5,
  snapshot_ema50: 235.2,
  snapshot_rsi14: 47.3,
  snapshot_rsi_zone: "CALM",
  snapshot_volume_rel: 0.9,
  snapshot_trend_health: true,
  edge_score: 7.2,
  watchlist_reason: "Pullback nära EMA20",

  // Manual entry data
  entry_price: 241.00,
  quantity: 1000,
  initial_stop: 237.00,
  initial_target: 249.00,
  initial_r: 4.00,
  entry_rationale: "Pullback mot EMA20 i upptrend. RSI 47 (CALM). Låg volym.",
  entry_setup: "Pullback",

  // Risk calculations
  risk_kr: 4000,
  risk_pct: 1.66,
  rr_ratio: 2.0,

  // Initial management
  current_price: 241.00,
  current_stop: 237.00,
  current_target: 249.00,
  current_status: "HOLD",
  trailing_type: "EMA20",
  initial_ema20: 240.5,
  initial_ema50: 235.2,
  current_ema20: 240.5,
  current_ema50: 235.2,
  initial_rsi14: 47.3
}
```

### Backend ska:

1. **Verifiera** att alla obligatoriska fält finns
2. **Skapa position** i `portfolio`-tabellen
3. **Skapa ENTRY-händelse** i `portfolio_events`-tabellen
4. **Ta bort/arkivera** från watchlist (om tillämpligt)
5. **Returnera** success-svar

Exempel backend-kod (lägg till i `server.js`):

```javascript
app.post("/api/portfolio", async (req, res) => {
  try {
    const entryData = req.body;

    // Insert into portfolio
    const { data, error } = await supabase
      .from('portfolio')
      .insert([entryData])
      .select()
      .single();

    if (error) throw error;

    // Log ENTRY event
    await supabase
      .from('portfolio_events')
      .insert({
        ticker: entryData.ticker,
        event_date: entryData.entry_date,
        event_type: 'ENTRY',
        description: `Köpt ${entryData.quantity} aktier @ ${entryData.entry_price}`
      });

    res.json({ success: true, position: data });
  } catch (e) {
    console.error("Add to portfolio error:", e);
    res.status(500).json({ error: e.message });
  }
});
```

---

## 🎨 UX-Flöde (komplett)

```
1. Användaren ser READY-position i Watchlist
   ↓
2. Klickar på "KÖP"-knapp
   ↓
3. Entry Modal öppnas (full-screen overlay)
   ↓
4. Sektion 1 (Snapshot) fylls automatiskt
   ↓
5. Användaren fyller i Sektion 2 (Entry Form)
   ↓
6. Risk Preview (Sektion 3) uppdateras live
   ↓
7. Användaren bockar i alla checkboxar
   ↓
8. Klickar "✅ Bekräfta & Lägg till i Portfolio"
   ↓
9. Validering körs (checkboxar + rationale)
   ↓
10. Om allt OK → POST /api/portfolio
   ↓
11. Modal stängs, portfolio laddas om
   ↓
12. Alert: "✅ VOLV-B.ST tillagd i portfolio!"
   ↓
13. (Optional) Position Detail öppnas automatiskt
```

---

## 🔥 Exempel: Komplett integration i Dashboard.jsx

```jsx
import { useState } from 'react';
import EntryModal from './EntryModal';

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);

  async function handleAddToPortfolio(entryData) {
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entryData)
      });

      if (res.ok) {
        setShowEntryModal(false);
        setSelectedStock(null);
        await fetchPortfolio();
        alert(`✅ ${entryData.ticker} tillagd i portfolio!`);
      } else {
        const error = await res.json();
        alert(`❌ ${error.error}`);
      }
    } catch (e) {
      alert(`❌ ${e.message}`);
    }
  }

  return (
    <div>
      {/* Watchlist */}
      {watchlist.map(stock => (
        <div key={stock.ticker}>
          <h3>{stock.ticker}</h3>
          <button onClick={() => {
            setSelectedStock(stock);
            setShowEntryModal(true);
          }}>
            KÖP
          </button>
        </div>
      ))}

      {/* Entry Modal */}
      {showEntryModal && selectedStock && (
        <EntryModal
          stock={selectedStock}
          onClose={() => {
            setShowEntryModal(false);
            setSelectedStock(null);
          }}
          onConfirm={handleAddToPortfolio}
        />
      )}
    </div>
  );
}
```

---

## ✅ Sammanfattning

**Vad du har nu:**
- ✅ Komplett Entry Modal-komponent med 3 sektioner
- ✅ Automatisk snapshot från watchlist
- ✅ Manuellt entry-formulär med validering
- ✅ Live risk-preview uträkningar
- ✅ Regelcheckboxar (minskar impulstrades)
- ✅ Full dokumentation

**Nästa steg:**
1. Kör SQL-migrationen ([COMPLETE_MIGRATION.sql](COMPLETE_MIGRATION.sql:1-87)) om du inte redan gjort det
2. Integrera Entry Modal i Dashboard/Watchlist (följ stegen ovan)
3. Uppdatera backend `POST /api/portfolio` för att ta emot hela `entryData`-objektet
4. Testa Entry Modal med en READY-position

**Resultat:**
Ett komplett entry-system där:
- Automatisk data följer med från watchlist
- Tradern måste ta ansvar för manuella beslut
- Risk visas INNAN traden läggs till
- Alla checks måste passera innan entry

**Detta är edge-building på systemnivå.**
