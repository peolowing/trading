# 🚀 Installation Guide - Avslutade Affärer (Closed Positions)

## ⚠️ Kör i EXAKT denna ordning!

### Steg 1: Cleanup (Ta bort eventuell gammal testdata)

1. Öppna **Supabase Dashboard** → **SQL Editor**
2. Kopiera hela innehållet från `scripts/cleanup-testdata.sql`
3. Klistra in och klicka **RUN**
4. Du bör se: `Cleanup klar!`

**Detta tar bort:**
- Alla events för de 8 testdata-tickers
- Alla EXITED-positioner för de 8 testdata-tickers

**OBS:** Detta påverkar INTE dina riktiga positioner!

---

### Steg 2: Migration (Lägg till kolumner)

1. Kopiera hela innehållet från `scripts/migration-closed-positions.sql`
2. Klistra in i SQL Editor och klicka **RUN**
3. Du bör se meddelanden om att kolumner läggs till

**Detta lägger till:**
- 40+ nya kolumner i `portfolio`-tabellen
- Index för snabbare queries
- Constraints för data-validering

**OBS:** `IF NOT EXISTS` betyder att det är säkert att köra flera gånger!

---

### Steg 3: Testdata (8 avslutade positioner)

1. Kopiera hela innehållet från `scripts/testdata-closed-positions.sql`
2. Klistra in i SQL Editor och klicka **RUN**
3. Du bör se INSERT-meddelanden för 8 positioner + events

**Detta lägger till:**
- **5 vinnare:** VOLV-B.ST (+3.36R), AAPL (+1.66R), TSLA (+5.0R), GOOGL (+0.83R), AMZN (+1.88R)
- **3 förlorare:** MSFT (-0.9R), NVDA (-2.0R), META (-1.0R)
- **Events:** ENTRY, EXIT, PARTIAL_EXIT, STOP_MOVED

---

### Steg 4: Verifiera i Appen

1. Gå till din app: http://localhost:5173
2. Klicka **"📚 Avslutade affärer"** från Dashboard
3. Du bör nu se **8 avslutade positioner** i listan!

**Testa följande:**
- ✅ Sortera: "Bästa R först" vs "Senaste först"
- ✅ Klicka på en position → Se detaljvy
- ✅ Öppna t.ex. TSLA (+5.0R) → Redigera utvärdering
- ✅ Bocka i checkboxar, ändra Edge-tag, skriv lärdom
- ✅ Klicka "💾 Spara utvärdering"

---

## 🐛 Felsökning

### "Duplicate key violation" error
**Lösning:** Kör Steg 1 (cleanup-testdata.sql) först!

### "Column does not exist" error
**Lösning:** Kör Steg 2 (migration-closed-positions.sql) först!

### "Inga avslutade affärer ännu"
**Lösning:** Kör Steg 3 (testdata-closed-positions.sql)!

### Listan visar inga positioner i appen
**Lösning:**
1. Kontrollera att backend körs: `node server.js`
2. Testa endpoint: `curl http://localhost:3002/api/portfolio/closed`
3. Refresha browsern (Cmd+R / Ctrl+R)

---

## 📊 Vad du kan testa med testdata

### 1. Setup-analys
- Pullback vs Breakout performance
- Vilken setup ger högst genomsnittlig R?

### 2. Exit-metod analys
- TARGET vs STOP vs EMA20 vs TIME
- Vilken exit-metod fungerar bäst för dig?

### 3. Disciplin-tracking
- Korrelation: Plan-följd → R-multiple?
- Hur många % följde planen?

### 4. MFE/MAE-insikter
- AAPL: MFE +2.8R men exitade vid +1.66R → lämnade 1.14R på bordet
- Genomsnittlig (MFE - exit) = förbättringspotential

### 5. Edge-tag mönster
- **A-trades gemensamt:** Plan-följd ✓, RSI 45-55, Clean exit
- **C-trades gemensamt:** Bröt regler, FOMO (RSI >65), Panik-exit

---

## 📝 Nästa steg efter testdata

När du har bekantat dig med listan kan du:

1. **Redigera utvärderingar:** Öppna valfri position → Ändra checkboxar/edge-tag → Spara
2. **Lägg till egna positioner:** När du stänger en riktig position, sätt `exit_status = 'EXITED'`
3. **Filtrera och analysera:** Bygga på listan med filter (t.ex. visa bara A-trades)

---

**Lycka till! 🚀**
