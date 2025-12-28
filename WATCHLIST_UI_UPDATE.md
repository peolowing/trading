# Watchlist UI Update - Sammanfattning

## Vad har uppdaterats

Dashboard.jsx har uppdaterats för att visa alla nya watchlist tracking-fält.

## Nya funktioner i UI

### 1. Status-ikoner och labels

Varje aktie i watchlist visar nu:

- **🔵 Vänta** - För långt från entry (WAIT_PULLBACK)
- **🟡 Närmar sig** - Pullback på gång (APPROACHING)
- **🟢 Klar** - Perfekt läge för entry (READY)
- **🟠 Endast breakout** - Momentum för starkt (BREAKOUT_ONLY)
- **🔴 Ta bort** - Trenden bruten (INVALIDATED)

### 2. Status-förklaring

Under varje aktie visas `status_reason` som förklarar varför aktien har den statusen:

Exempel:
- "För långt från EMA20 (4.2%)"
- "Drar sig mot pullback (2.8%)"
- "Pullback nära + lugnt momentum (RSI 47)"
- "Momentum för starkt (RSI 68) - ingen pullback"

### 3. Diagnostics

Tre nyckeltal visas under varje aktie:

- **EMA20:** Avstånd till EMA20 i procent (ex: "+1.5%", "-0.8%")
- **RSI:** Momentum-zon (WEAK, CALM, WARM, HOT)
- **Vol:** Volymläge (LOW, NORMAL, HIGH)

### 4. Tidsvarning

Om en aktie varit i watchlist i mer än 10 dagar utan att bli READY, visas en varning:

```
⚠️ Lång väntan (12 dagar) – överväg att rensa
```

### 5. Dagräknare

Visar hur länge aktien varit i watchlist (ex: "7d")

### 6. Initial snapshot från screener

När du lägger till en aktie från screener skickas nu alla indicators med:
- Pris, EMA20, EMA50, RSI14
- Regime, Setup, Relativ volym

Detta ger watchlist-logiken direkt tillgång till data för första statusberäkningen.

## Visuell layout

```
🟢 VOLV-B.ST  Klar                              7d  ✕
   Pullback nära + lugnt momentum (RSI 47)
   EMA20: +1.0%  RSI: CALM  Vol: LOW
```

Med tidsvarning:
```
🟡 ATCO-B.ST  Närmar sig                        12d  ✕
   Drar sig mot pullback (3.2%)
   EMA20: +3.2%  RSI: WARM  Vol: NORMAL
   ⚠️ Lång väntan (12 dagar) – överväg att rensa
```

## Nästa steg

### För användaren:

1. **Kör SQL-migration** i Supabase (se SUPABASE_MIGRATION.md)
2. **Testa frontend** på http://localhost:5174
3. **Lägg till aktier** från screener till watchlist
4. **Kör daglig uppdatering** med: `curl -X POST http://localhost:3002/api/watchlist/update`

### För automatisering:

Sätt upp GitHub Actions eller cron job för daglig uppdatering (se WATCHLIST_TRACKING.md sektion "Daglig rutin").

## Tekniska detaljer

### Nya funktioner i Dashboard.jsx

```javascript
// Status icon mapping
function getStatusIcon(status) {
  switch(status) {
    case 'WAIT_PULLBACK': return '🔵';
    case 'APPROACHING': return '🟡';
    case 'READY': return '🟢';
    case 'BREAKOUT_ONLY': return '🟠';
    case 'INVALIDATED': return '🔴';
    default: return '⚪';
  }
}

// Status label mapping
function getStatusLabel(status) {
  switch(status) {
    case 'WAIT_PULLBACK': return 'Vänta';
    case 'APPROACHING': return 'Närmar sig';
    case 'READY': return 'Klar';
    case 'BREAKOUT_ONLY': return 'Endast breakout';
    case 'INVALIDATED': return 'Ta bort';
    default: return 'Okänd';
  }
}
```

### Uppdaterad addToWatchlist

```javascript
async function addToWatchlist(ticker, indicators = null) {
  const payload = { ticker };

  // Include indicators from screener for initial snapshot
  if (indicators) {
    payload.indicators = indicators;
  }

  await fetch("/api/watchlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  await loadWatchlist();
}
```

## Testscenario

1. Öppna Dashboard (http://localhost:5174)
2. Se screener-listan
3. Klicka på ★ för en aktie med bra edge score
4. Aktien läggs till i watchlist med initial snapshot
5. Se status-ikon, förklaring, diagnostics
6. Kör `POST /api/watchlist/update` efter några dagar
7. Status uppdateras baserat på nya marknadsdata

## Sammanfattning

Dashboard UI visar nu fullständig watchlist tracking med:
- ✅ Status-ikoner (🔵🟡🟢🟠🔴)
- ✅ Status-förklaringar
- ✅ Diagnostics (EMA20, RSI-zon, Volym)
- ✅ Tidsvarningar
- ✅ Dagräknare
- ✅ Initial snapshot från screener
- ✅ Legend för statusar

Detta ger dig full överblick över alla bevakade aktier och exakt när de är redo för entry!
