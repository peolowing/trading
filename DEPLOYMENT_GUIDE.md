# Deployment Guide - Development & Production

## Miljöer

### Development (Lokal utveckling)
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend**: http://localhost:3002 (Express local server)
- **Databas**: Supabase DEV project

### Production
- **Frontend**: https://weekly-trading-ai.vercel.app (Vercel CDN)
- **Backend**: https://weekly-trading-ai.vercel.app/api/* (Vercel Serverless)
- **Databas**: Supabase PROD project

## Initial Setup

### 1. Skapa Två Supabase-projekt

**Development Project:**
```
1. Gå till https://supabase.com/dashboard
2. Skapa nytt projekt: "weekly-trading-ai-dev"
3. Kopiera:
   - Project URL
   - Service Role Key (Settings → API)
   - Anon Key (Settings → API)
4. Importera schema från supabase-schema.sql
```

**Production Project:**
```
1. Skapa nytt projekt: "weekly-trading-ai-prod"
2. Kopiera samma credentials
3. Importera samma schema
```

### 2. Konfigurera Environment Variables Lokalt

**Kopiera och redigera development environment:**
```bash
cp .env.development.example .env.development
```

Redigera `.env.development`:
```bash
NODE_ENV=development
VITE_API_URL=http://localhost:3002

# Dina riktiga DEV credentials
OPENAI_API_KEY=sk-proj-xxxxxxx
SUPABASE_URL=https://xxx-dev.supabase.co
SUPABASE_KEY=eyJhbGxxxxxxxx-dev-service
SUPABASE_ANON_KEY=eyJhbGxxxxxxxx-dev-anon

PORT=3002
```

**Skapa symlink till aktiv environment:**
```bash
ln -sf .env.development .env.local
```

### 3. Konfigurera Environment Variables i Vercel

**Via Vercel Dashboard:**
```
1. Gå till https://vercel.com/dashboard
2. Välj projekt "weekly-trading-ai"
3. Settings → Environment Variables
4. Lägg till följande för Production:
```

| Name | Value | Environment |
|------|-------|-------------|
| `NODE_ENV` | `production` | Production |
| `VITE_API_URL` | `https://weekly-trading-ai.vercel.app` | Production |
| `OPENAI_API_KEY` | `sk-prod-xxxxxxx` | Production |
| `SUPABASE_URL` | `https://xxx-prod.supabase.co` | Production |
| `SUPABASE_KEY` | `eyJxxx-prod-service` | Production |
| `SUPABASE_ANON_KEY` | `eyJxxx-prod-anon` | Production |

**För Preview Deployments (valfritt):**
```
Samma variabler men med Environment = "Preview"
Använd DEV Supabase credentials för previews
```

## Utvecklingsworkflow

### Daglig Utveckling

**1. Starta utvecklingsmiljö:**
```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
npm run server:dev
```

**2. Öppna browser:**
```
http://localhost:5173
```

**3. Utveckla och testa:**
- Frontend hot-reloads automatiskt vid ändringar i `/src`
- Backend kräver omstart vid ändringar i `server.js` eller `/services`

**4. Testa API endpoints:**
```bash
# Testa portfolio endpoint
curl http://localhost:3002/api/portfolio | jq

# Testa analysis
curl -X POST http://localhost:3002/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"ticker":"AAPL"}' | jq
```

### Commit och Push

**1. Kontrollera ändringar:**
```bash
git status
git diff
```

**2. Commit:**
```bash
git add .
git commit -m "Beskrivning av ändring"
```

**3. Push till GitHub:**
```bash
git push origin main
```

**4. Vercel deployer automatiskt:**
- Bygg startar automatiskt vid push
- Preview deployment skapas (om inte main branch)
- Production deployment vid push till main

### Testa Preview Deployment

**1. Hitta preview URL:**
```
Vercel mailar en länk, eller:
https://vercel.com/dashboard → ditt projekt → Deployments
```

**2. Testa preview:**
```
Öppna preview URL
Testa alla funktioner
Verifiera att data går till DEV Supabase
```

**3. Merge till production (om godkänd):**
```bash
git checkout main
git merge feature-branch
git push origin main
```

## Production Deployment

### Automatisk Deployment

**När du pushar till main branch:**
```bash
git push origin main
```

**Vercel:**
1. Detekterar push till main
2. Kör `npm run build`
3. Deployer frontend till CDN
4. Deployer API handlers till serverless functions
5. Laddar production environment variables
6. Går live på https://weekly-trading-ai.vercel.app

**Deployment tar ~2-3 minuter**

### Manuell Deployment via CLI

**1. Installera Vercel CLI:**
```bash
npm i -g vercel
```

**2. Login:**
```bash
vercel login
```

**3. Deploy preview:**
```bash
npm run deploy:preview
```

**4. Deploy production:**
```bash
npm run deploy:prod
```

### Verifiera Production Deployment

**1. Testa frontend:**
```
https://weekly-trading-ai.vercel.app
```

**2. Testa API:**
```bash
curl https://weekly-trading-ai.vercel.app/api/portfolio | jq
```

**3. Kontrollera logs:**
```
Vercel Dashboard → Deployment → Function Logs
```

## Database Migrations

### Schema-ändringar

**1. Utveckla i DEV Supabase:**
```sql
-- Gör ändringar via Supabase SQL Editor
ALTER TABLE portfolio ADD COLUMN new_field TEXT;
```

**2. Exportera migration:**
```
Supabase → Database → Copy schema
Spara i: /migrations/YYYYMMDD_beskrivning.sql
```

**3. Commit migration:**
```bash
git add migrations/
git commit -m "Migration: Add new_field to portfolio"
git push
```

**4. Kör i Production (MANUELLT):**
```
1. Gå till PROD Supabase → SQL Editor
2. Kör migration SQL
3. Verifiera att det fungerar
```

### Data Seeding

**Development testdata:**
```bash
# Skapa seed script
cat > migrations/seed-dev-data.sql << 'EOF'
-- Insert test data for development
INSERT INTO portfolio (ticker, entry_price, ...)
VALUES ('TEST', 100.0, ...);
EOF

# Kör endast i DEV Supabase
```

**ALDRIG seed production med testdata!**

## Rollback

### Rollback till tidigare deployment

**Via Vercel Dashboard:**
```
1. Gå till Deployments
2. Hitta tidigare working deployment
3. Klicka "..." → "Promote to Production"
```

**Via CLI:**
```bash
vercel rollback
```

### Rollback database migration

**Skapa down migration:**
```sql
-- migrations/YYYYMMDD_rollback_description.sql
ALTER TABLE portfolio DROP COLUMN new_field;
```

**Kör manuellt i Supabase SQL Editor**

## Monitoring & Logs

### Vercel Logs

**Realtime logs:**
```bash
vercel logs --follow
```

**Specific deployment:**
```bash
vercel logs [deployment-url]
```

**Via Dashboard:**
```
Vercel → Projekt → Deployments → Klicka deployment → Runtime Logs
```

### Supabase Logs

**Database logs:**
```
Supabase Dashboard → Logs → Database
```

**API logs:**
```
Supabase Dashboard → Logs → API
```

## Felsökning

### Frontend bygger inte

**Fel:** `VITE_API_URL is not defined`
**Lösning:**
```bash
# Kontrollera att .env.local finns
ls -la .env*

# Verifiera innehåll
cat .env.local
```

### Backend fungerar lokalt men inte i production

**Problem:** Environment variables saknas
**Lösning:**
```
1. Vercel Dashboard → Settings → Environment Variables
2. Kontrollera att alla variabler finns för Production
3. Redeploy
```

### API timeout i production

**Problem:** Serverless function timeout (10s på Hobby plan)
**Lösning:**
1. Optimera långsamma queries
2. Lägg till caching
3. Uppgradera till Pro plan ($20/månad för 50s timeout)

### Database connection error

**Problem:** Fel Supabase credentials
**Lösning:**
```bash
# Verifiera credentials
curl https://xxx.supabase.co/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY"

# Ska returnera 404, inte 401
```

## Säkerhet

### Secrets Management

**ALDRIG commit:**
- `.env`
- `.env.local`
- `.env.development`
- `.env.production`

**Alltid commit:**
- `.env.example`
- `.env.development.example`
- `.env.production.example`

### API Keys

**Development:**
- Använd separata OpenAI API keys för dev/prod
- Sätt spending limits i OpenAI dashboard

**Production:**
- Rotera keys regelbundet
- Använd Vercel Environment Variables (encrypted)
- Aktivera rate limiting

### Supabase Security

**Row Level Security (RLS):**
```sql
-- Aktivera RLS på alla tabeller
ALTER TABLE portfolio ENABLE ROW LEVEL SECURITY;

-- Skapa policies (exempel)
CREATE POLICY "Allow authenticated access"
ON portfolio FOR ALL
USING (auth.role() = 'authenticated');
```

## Performance

### Caching

**Market Data:**
```javascript
// Already implemented in marketdata.repository.js
// Cachar Yahoo Finance data i Supabase
```

**Frontend:**
```javascript
// Vercel CDN cachar automatiskt static assets
// API responses kan cachas med headers:
res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
```

### Optimization

**Bundle size:**
```bash
npm run build
# Check dist/ size
du -sh dist/
```

**Lighthouse score:**
```
Chrome DevTools → Lighthouse → Run audit
Sikta på 90+ i Performance
```

## Kostnader

### Nuvarande (Free Tiers)

**Vercel:**
- 100GB bandwidth/månad
- 100GB-hours serverless execution
- Unlimited deployments

**Supabase:**
- 500MB databas
- 2GB dataöverföring
- 50,000 monthly active users

**OpenAI:**
- Pay-as-you-go
- ~$0.002 per API call (GPT-4o-mini)
- Sätt spending limit!

### När du behöver uppgradera

**Vercel Pro ($20/månad):**
- 1TB bandwidth
- 50s function timeout
- Team collaboration

**Supabase Pro ($25/månad):**
- 8GB databas
- 250GB dataöverföring
- Daily backups

## Checklista: Innan Production Deploy

- [ ] Alla tester passerar (`npm run test`)
- [ ] Build fungerar (`npm run build`)
- [ ] Environment variables konfigurerade i Vercel
- [ ] Database migration körda i PROD Supabase
- [ ] API keys för production satta
- [ ] .gitignore inkluderar alla secrets
- [ ] README uppdaterad
- [ ] Breaking changes dokumenterade
- [ ] Rollback-plan finns

## Support & Resources

**Vercel Docs:**
- https://vercel.com/docs

**Supabase Docs:**
- https://supabase.com/docs

**Frågor:**
- Skapa issue i GitHub repo
- Vercel Support (för Pro-användare)
- Supabase Discord
