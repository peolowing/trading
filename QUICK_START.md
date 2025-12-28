# Quick Start Guide

## 🚀 Snabbstart för Utveckling

### 1. Clone och Install
```bash
git clone <repo-url>
cd weekly-trading-ai
npm install
```

### 2. Konfigurera Environment
```bash
# Kopiera development environment
cp .env.development.example .env.development

# Redigera med dina riktiga credentials
nano .env.development
```

Fyll i:
```bash
OPENAI_API_KEY=sk-proj-xxxxx        # Från https://platform.openai.com/api-keys
SUPABASE_URL=https://xxx.supabase.co # Från https://supabase.com/dashboard
SUPABASE_KEY=eyJxxxx                 # Service Role Key
SUPABASE_ANON_KEY=eyJxxxx            # Anon Key
```

### 3. Starta Development Server
```bash
# Terminal 1: Frontend (Vite)
npm run dev

# Terminal 2: Backend (Express)
npm run server:dev
```

### 4. Öppna Browser
```
Frontend: http://localhost:5173
Backend:  http://localhost:3002
```

---

## 📦 Production Deployment

### Första gången

**1. Skapa Production Supabase:**
```
1. Gå till https://supabase.com/dashboard
2. Skapa nytt projekt: "weekly-trading-ai-prod"
3. Importera schema från supabase-schema.sql
4. Kopiera credentials
```

**2. Konfigurera Vercel:**
```
1. Gå till https://vercel.com/dashboard
2. Import Git Repository
3. Lägg till Environment Variables i Settings:
   - NODE_ENV=production
   - VITE_API_URL=https://weekly-trading-ai.vercel.app
   - OPENAI_API_KEY=sk-prod-xxxxx
   - SUPABASE_URL=https://xxx-prod.supabase.co
   - SUPABASE_KEY=eyJxxx
   - SUPABASE_ANON_KEY=eyJxxx
```

### Deployment

**Automatisk (Rekommenderat):**
```bash
git add .
git commit -m "Your changes"
git push origin main
# Vercel deployer automatiskt!
```

**Manuell:**
```bash
npm run deploy:prod
```

---

## 🏗️ Arkitektur

```
┌─────────────────────────────────────────────┐
│           Development (Lokalt)               │
├─────────────────────────────────────────────┤
│                                              │
│  Frontend (localhost:5173)                   │
│       ↓                                      │
│  Backend (localhost:3002)                    │
│       ↓                                      │
│  Supabase DEV Database                       │
│                                              │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│              Production                      │
├─────────────────────────────────────────────┤
│                                              │
│  Frontend (Vercel CDN)                       │
│       ↓                                      │
│  Backend (Vercel Serverless)                 │
│       ↓                                      │
│  Supabase PROD Database                      │
│                                              │
└─────────────────────────────────────────────┘
```

---

## 📁 Projektstruktur

```
weekly-trading-ai/
├── src/                    # Frontend (React)
│   ├── App.jsx            # Main component
│   ├── components/        # UI components
│   └── index.css          # Styles
│
├── api/                   # Backend (Vercel Serverless)
│   └── index.js          # API handler
│
├── services/              # Business logic
│   ├── position.service.js
│   ├── analysis.service.js
│   └── watchlist.service.js
│
├── repositories/          # Database access
│   ├── portfolio.repository.js
│   ├── events.repository.js
│   └── watchlist.repository.js
│
├── utils/                 # Utilities
│   └── calculations.js
│
├── server.js             # Local development server
│
├── .env.development      # Dev environment (git-ignored)
├── .env.production       # Prod environment (git-ignored)
└── DEPLOYMENT_GUIDE.md   # Full deployment docs
```

---

## 🔧 Användbara Kommandon

### Development
```bash
npm run dev              # Start frontend (Vite)
npm run server:dev       # Start backend (Express)
npm run build            # Build frontend
npm run preview          # Preview production build
```

### Testing
```bash
npm run test             # Run tests
npm run test:watch       # Watch mode

# Test API manually
curl http://localhost:3002/api/portfolio | jq
```

### Deployment
```bash
npm run deploy:preview   # Deploy preview
npm run deploy:prod      # Deploy production
vercel logs --follow     # Watch logs
```

### Database
```bash
# Run migration (manual in Supabase SQL Editor)
cat migrations/YYYYMMDD_migration.sql | pbcopy
```

---

## 🐛 Vanliga Problem

### "VITE_API_URL is not defined"
```bash
# Kontrollera att .env.development finns
cat .env.development

# Skapa symlink om den saknas
ln -sf .env.development .env.local
```

### "Supabase connection failed"
```bash
# Testa credentials
curl https://xxx.supabase.co/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY"
# Ska ge 404, inte 401
```

### "Port 3002 already in use"
```bash
# Hitta process
lsof -i :3002

# Döda process
kill -9 <PID>
```

### Frontend kan inte nå backend
```bash
# Kontrollera CORS i server.js
# Kontrollera att VITE_API_URL är rätt
echo $VITE_API_URL
```

---

## 📚 Mer Information

- **Full Deployment Guide**: Se [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Architecture Overview**: Se [/tmp/environment-architecture.md](/tmp/environment-architecture.md)
- **API Documentation**: Se [README.md](README.md)

---

## 🔐 Säkerhet

**ALDRIG commit:**
- `.env`
- `.env.local`
- `.env.development`
- `.env.production`

**Alltid commit:**
- `.env.example`
- `.env.development.example`
- `.env.production.example`

**Checka före commit:**
```bash
git diff
# Leta efter secrets!
```

---

## 🎯 Nästa Steg

1. ✅ Setup development environment
2. ✅ Konfigurera Supabase DEV
3. ✅ Starta local development
4. ✅ Skapa första commit
5. 🔲 Konfigurera Supabase PROD
6. 🔲 Konfigurera Vercel Environment Variables
7. 🔲 Deploy till production

**Lycka till! 🚀**
