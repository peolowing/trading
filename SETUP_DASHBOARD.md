# Setup Dashboard - Bevakningslista & Förvaltningslista

## Steg 1: Kör SQL i Supabase

1. Gå till https://supabase.com/dashboard
2. Välj ditt projekt
3. Klicka på **"SQL Editor"** i vänstermenyn
4. Klicka **"New Query"**
5. Klistra in SQL nedan:

```sql
-- Skapa tabell för bevakningslista (watchlist)
CREATE TABLE IF NOT EXISTS watchlist (
  ticker TEXT PRIMARY KEY,
  added_at TIMESTAMP DEFAULT NOW()
);

-- Skapa tabell för förvaltningslista (portfolio)
CREATE TABLE IF NOT EXISTS portfolio (
  ticker TEXT PRIMARY KEY,
  entry_price DECIMAL(10, 2),
  quantity INTEGER,
  added_at TIMESTAMP DEFAULT NOW()
);
```

6. Klicka **"Run"**

## Steg 2: Verifiera tabellerna

Kör denna SQL för att se att tabellerna skapades:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('watchlist', 'portfolio');
```

Du ska se båda tabellerna i resultatet.

## Steg 3: Testa Dashboard lokalt

1. Öppna http://localhost:5173/
2. Du kommer se Dashboard med tre sektioner:
   - **Bevakningslista** (tom initialt)
   - **Förvaltningslista** (tom initialt)
   - **Screener** (med Edge-score)

3. Klicka på en aktie i Screener → Analysvyn öppnas
4. Från Analysvyn kan du:
   - **⭐ Lägg till i Bevakningslista** - Klicka för att bevaka aktien
   - **💼 Lägg till i Förvaltningslista** - Ange köppris och antal

5. Gå tillbaka till Dashboard (klicka "← Dashboard") för att se dina sparade aktier!

## Troubleshooting

Om du får fel "Could not find the table 'public.watchlist'":
- Kontrollera att du körde SQL:en i steg 1
- Starta om API-servern (döda och starta node-processen igen)

## Deploy till Vercel

När allt fungerar lokalt:

```bash
git add -A
git commit -m "Add Dashboard with Watchlist and Portfolio"
git push
```

Vercel kommer automatiskt deploya de nya ändringarna!
