# Testdata för Avslutade Affärer

## 📊 Översikt

Detta testdata innehåller **8 avslutade positioner** som demonstrerar olika scenarios:

### Vinnare (5 st)
1. **VOLV-B.ST** - +3.36R (A) - Perfekt trade enligt plan
2. **AAPL** - +1.66R (B) - Exitade för tidigt
3. **TSLA** - +5.0R (A) - Stor vinnare med skalning
4. **GOOGL** - +0.83R (B) - Time-based exit
5. **AMZN** - +1.88R (A) - Partial exit

### Förlorare (3 st)
6. **MSFT** - -0.9R (B) - Stoppades ut (bra disciplin)
7. **NVDA** - -2.0R (C) - FOMO-trade, bröt regler
8. **META** - -1.0R (B) - Stop-loss gjorde sitt jobb

## 📈 Kvalitetsfördelning

- **A-kvalitet** (3 st) - Perfekt execution
- **B-kvalitet** (4 st) - Bra men inte perfekt
- **C-kvalitet** (1 st) - Regelbrott

## 🚀 Hur du använder testdata

### ⚠️ VIKTIGT: Kör i rätt ordning!

**Steg 1: Migration (kolumner)**
```sql
-- Kör FÖRST: migration-closed-positions.sql
-- Detta lägger till alla nödvändiga kolumner i portfolio-tabellen
```

**Steg 2: Testdata**
```sql
-- Kör SEDAN: testdata-closed-positions.sql
-- Detta lägger till 8 avslutade positioner med events
```

### Alternativ 1: SQL i Supabase (Rekommenderat)

1. Öppna Supabase Dashboard
2. Gå till SQL Editor
3. **FÖRST:** Kopiera innehållet från `migration-closed-positions.sql` → Kör
4. **SEDAN:** Kopiera innehållet från `testdata-closed-positions.sql` → Kör

### Alternativ 2: Lokalt (om du kör lokal databas)

```bash
# Kör migration först
psql -d your_database < scripts/migration-closed-positions.sql

# Sedan testdata
psql -d your_database < scripts/testdata-closed-positions.sql
```

## ✅ Vad testdata demonstrerar

### 1. Olika Exit-typer
- `TARGET` - Nådde target
- `EMA20` - EMA20-break
- `STOP` - Stoppades ut
- `PARTIAL_SCALE` - Skalad exit
- `TIME` - Time-based exit
- `PANIC` - Panik-exit (dålig)

### 2. Olika Setups
- `Pullback` - Klassiska pullbacks
- `Breakout` - Breakout-trades

### 3. Självutvärdering
Varje position har:
- ✅ Plan-följd (ja/nej)
- ✅ Exitade för tidigt (ja/nej)
- ✅ Stoppades ut (ja/nej)
- ✅ Bröt regel (ja/nej)
- ✅ Kunde skala bättre (ja/nej)
- ✅ Edge-tag (A/B/C)
- ✅ Lärdom (1-3 meningar)

### 4. MFE/MAE-tracking
- **MFE** (Max Favorable Excursion) - Bästa läget
- **MAE** (Max Adverse Excursion) - Värsta läget

Exempel: AAPL hade MFE +2.8R men exitade vid +1.66R → lämnade 1.14R på bordet

## 🎯 Användningsscenarier

### Testa Listvy
```
Navigera till: Dashboard → "📚 Avslutade affärer"
```

Se:
- Alla 8 positioner i tabellformat
- Sortering: Bästa R först / Senaste först
- Färgkodning: 🟢 vinnare, 🔴 förlorare
- Edge-tags: A/B/C i färg

### Testa Detaljvy
```
Klicka på någon position → Detaljvy öppnas
```

Se:
- **Header**: Resultat-snapshot
- **Entry Snapshot**: Alla entry-data (låst)
- **Händelselogg**: Events (ENTRY → EXIT)
- **Exit-fakta**: MFE/MAE
- **Självutvärdering**: Checkboxar + Edge-tag
- **Lärdom**: Fri text

### Testa Redigering
```
1. Öppna t.ex. TSLA (+5.0R)
2. Bocka i/ur checkboxar
3. Ändra Edge-tag
4. Skriv egen lärdom
5. Klicka "💾 Spara utvärdering"
```

## 📚 Pattern-analys du kan göra

Med denna testdata kan du filtrera och analysera:

1. **Setup-performance**
   - Pullback vs Breakout
   - Vilken setup har bäst R/R?

2. **Exit-metod**
   - EMA20 vs ATR vs Manual
   - Vilket funkar bäst?

3. **Disciplin-tracking**
   - Hur många % följde planen?
   - Korrelation: Plan-följd → R-multiple?

4. **MFE/MAE-insikter**
   - Hur ofta lämnar du pengar på bordet?
   - Genomsnittlig MFE - exit = improvement potential

## 🔧 Databasschema

**Migration finns redan klar:** [migration-closed-positions.sql](migration-closed-positions.sql:1-1)

Detta lägger till:
- `exit_date`, `exit_price`, `exit_status`, `exit_type`
- `r_multiple`, `pnl_pct`
- `max_mfe`, `max_mae`
- `plan_followed`, `exited_early`, `stopped_out`, `broke_rule`, `could_scale_better`
- `edge_tag`, `lesson_learned`

Kör migration-filen INNAN testdata!

## 🎓 Lärdomar från testdata

### Vad A-trades har gemensamt
- Plan-följd: ✓
- RSI 45-55 vid entry
- Clean exit (inte PANIC)
- MFE/MAE-ratio bra

### Vad C-trades har gemensamt
- Bröt regler
- FOMO-entry (RSI >65)
- Panik-exit

**Mönster → Edge.**

---

**Tips:** Efter att du testat listan, skriv din egen lärdom för någon position. Se hur det känns att utvärdera en trade objektivt.
