# Vercel Serverless Endpoints

## Current Endpoints (7/12 used)

### 1. `/api/analyze` - Technical Analysis
**File:** `api/analyze.js`  
**Methods:** POST  
**Purpose:** Complete technical analysis with indicators, setup detection, edge scoring  
**Returns:** Candles, indicators, **trade object** (entry/stop/target), backtest

### 2. `/api/ai-analysis` - AI Analysis
**File:** `api/ai-analysis.js`  
**Methods:** POST  
**Purpose:** Generate OpenAI trading analysis  
**Returns:** AI-generated analysis text

### 3. `/api/ai-analysis/history/:ticker` - AI History
**File:** `api/ai-analysis/history/[ticker].js`  
**Methods:** GET  
**Purpose:** Fetch last 3 analyses with comparison  
**Returns:** Analyses array + diff comparison

### 4. `/api/portfolio` - Portfolio Management
**File:** `api/portfolio.js`  
**Methods:** GET, POST, DELETE  
**Purpose:** Manage open positions  
**Routes:**
- `GET /api/portfolio` - List all positions
- `POST /api/portfolio` - Add new position
- `DELETE /api/portfolio/:ticker` - Close position

### 5. `/api/trades` - Trade Journal
**File:** `api/trades.js`  
**Methods:** GET, POST, PUT, DELETE  
**Purpose:** Complete trade journal CRUD  
**Routes:**
- `GET /api/trades` - List all trades
- `POST /api/trades` - Create trade
- `PUT /api/trades/:id` - Update trade
- `DELETE /api/trades/:id` - Delete trade

### 6. `/api/watchlist` - Watchlist Management
**File:** `api/watchlist.js`  
**Methods:** GET, POST, DELETE  
**Purpose:** Track stocks for setups  
**Routes:**
- `GET /api/watchlist` - List watchlist
- `POST /api/watchlist` - Add to watchlist
- `DELETE /api/watchlist/:ticker` - Remove from watchlist
- `GET /api/watchlist/live?tickers=X,Y` - Live Yahoo quotes
- `POST /api/watchlist/update` - Daily batch update

### 7. `/api/screener` - Screener (Combined Endpoint)
**File:** `api/screener.js`  
**Methods:** GET, POST, DELETE, PATCH  
**Purpose:** All screener functionality in one endpoint  
**Routes:**
- `GET /api/screener` - Main screener with scores (Dashboard view)
- `GET /api/screener/stocks` - Stock list (Admin view)
- `POST /api/screener/stocks` - Add stock to screener
- `DELETE /api/screener/stocks/:ticker` - Remove stock
- `PATCH /api/screener/stocks/:ticker` - Update stock (toggle active)

**Note:** Uses rewrite rule in `vercel.json` to route `/api/screener/stocks/*` to `/api/screener`

## Architecture

**Local Development:**
- `server.js` → `api/utils/index.js` (Express monolith)
- All routes in one file

**Vercel Production:**
- Each endpoint = separate serverless function
- Vercel auto-routes based on file structure
- Dynamic routes use `[param].js` syntax
- Rewrites handle nested paths to single file

## Why Only 7 Functions?

Initially had 11+ endpoints but hit Vercel Hobby's 12-function limit. Optimized by:

1. **Combined screener routes** - All screener logic in one file using pathname routing
2. **Moved utilities** - `backtest.js`, `market-data.js` to `api/utils/`
3. **Used rewrites** - Route `/api/screener/stocks/*` to `/api/screener.js`

## Testing

```bash
# Analyze with trade object
curl -X POST https://weekly-trading-ai.vercel.app/api/analyze \
  -H "Content-Type: application/json" -d '{"ticker":"AAPL"}' | jq '.trade'

# Screener (main)
curl https://weekly-trading-ai.vercel.app/api/screener | jq '.stocks | length'

# Screener stocks (admin)
curl https://weekly-trading-ai.vercel.app/api/screener/stocks | jq '.stocks | length'

# Portfolio
curl https://weekly-trading-ai.vercel.app/api/portfolio | jq '.stocks'

# AI history
curl https://weekly-trading-ai.vercel.app/api/ai-analysis/history/AAPL | jq '.count'
```

## Important Files

- `vercel.json` - Config with rewrites for nested routes
- `api/utils/` - Shared logic, local-only endpoints
- `config/supabase.js` - Database client
- `repositories/` - Data access layer
