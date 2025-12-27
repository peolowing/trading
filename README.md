# Weekly Trading AI

En Vite/React-app med serverlösa API-endpoints för marknadsdata, indikatorer och AI-analyser av aktier.

## Krav
- Node 18+ (krävs av Vite 5)
- npm

## Miljövariabler
Skapa `.env.local` (använd `.env.local.example` som mall).

| Nyckel | Beskrivning |
| --- | --- |
| `OPENAI_API_KEY` | Krävs för AI-analys. |
| `SUPABASE_URL` | Valfritt. Endast om du vill spara data i Supabase. |
| `SUPABASE_KEY` / `SUPABASE_ANON_KEY` | Valfritt. API-nyckel för Supabase. |

## Kom igång lokalt
```bash
npm install
npm run dev       # frontend på http://localhost:5173
npm run server    # (valfritt) startar express-servern på http://localhost:3002
```

## Bygga
```bash
npm run build     # output till dist/
```

## API
Serverlösa endpoints ligger i `api/` och kan köras av Vercel. Express-servern (`server.js`) kan köras lokalt om du vill ha en samlad backend.

## Publicera till GitHub
1. Initiera repo och kontrollera att `.env.local` inte är staged:
   ```bash
   git init
   git status
   ```
2. Första commit:
   ```bash
   git add .
   git commit -m "Initial commit"
   ```
3. Skapa ett tomt repo på GitHub och lägg till remote (justera `USER`/`REPO`):
   ```bash
   git branch -M main
   git remote add origin git@github.com:USER/REPO.git
   git push -u origin main
   ```

## Deploy till Vercel
1. Installera Vercel CLI och logga in:
   ```bash
   npm install -g vercel
   vercel login
   ```
2. Första deploy (skapa nytt projekt):
   ```bash
   vercel           # svara på frågorna
   ```
   Vercel upptäcker Vite och `api/` automatiskt. Build-kommando: `npm run build`. Output: `dist/`.
3. Sätt miljövariabler i Vercel-projektet (Dashboard eller CLI):
   - `OPENAI_API_KEY` (krävs)
   - `SUPABASE_URL` och `SUPABASE_KEY` / `SUPABASE_ANON_KEY` om du använder Supabase
4. När allt är klart:
   ```bash
   vercel --prod
   ```
