# Vercel Serverless Endpoints

This document lists all serverless functions deployed to Vercel and their purposes.

## Current Endpoints (10/12 used)

### 1. `/api/analyze` - Technical Analysis
**File:** `api/analyze.js`  
**Methods:** POST  
**Purpose:** Fetch market data, calculate indicators, detect setup, compute edge score  
**Returns:** Candles, indicators, trade object (entry/stop/target), backtest results

### 2. `/api/ai-analysis` - AI Analysis Generation
**File:** `api/ai-analysis.js`  
**Methods:** POST  
**Purpose:** Generate OpenAI analysis for a ticker  
**Returns:** AI-generated trading analysis text

### 3. `/api/ai-analysis/history/:ticker` - AI Analysis History
**File:** `api/ai-analysis/history/[ticker].js`  
**Methods:** GET  
**Purpose:** Fetch last 3 AI analyses and comparison  
**Returns:** Array of analyses with diff comparison

### 4. `/api/portfolio` - Portfolio Management
**File:** `api/portfolio.js`  
**Methods:** GET, POST, DELETE  
**Purpose:** Manage open positions  
**Returns:** List of portfolio stocks with entry prices

### 5. `/api/trades` - Trade Journal
**File:** `api/trades.js`  
**Methods:** GET, POST, PUT, DELETE  
**Purpose:** Full CRUD for trade journal entries  
**Returns:** List of historical trades

### 6. `/api/watchlist` - Watchlist Management
**File:** `api/watchlist.js`  
**Methods:** GET, POST, DELETE  
**Purpose:** Manage stocks being watched for setups  
**Routes:**
- `GET /api/watchlist` - List all watchlist stocks
- `POST /api/watchlist` - Add to watchlist
- `DELETE /api/watchlist/:ticker` - Remove from watchlist
- `GET /api/watchlist/live?tickers=X,Y` - Live quotes from Yahoo Finance
- `POST /api/watchlist/update` - Daily batch status update

### 7. `/api/screener/stocks` - Screener Stock List
**File:** `api/screener/stocks/index.js`  
**Methods:** GET, POST  
**Purpose:** Manage which stocks to include in screener  
**Returns:** List of tickers with bucket classification

### 8. `/api/screener/stocks/:ticker` - Individual Stock Management
**File:** `api/screener/stocks/[ticker].js`  
**Methods:** DELETE, PATCH  
**Purpose:** Remove stock or toggle active status  
**Returns:** Updated stock object

### 9. `/api/backtest` - Backtest Engine
**File:** `api/backtest.js`  
**Methods:** POST  
**Purpose:** Simple backtest of strategy on candle data  
**Returns:** Trade count and win rate

### 10. `/api/market-data` - Market Data Fetcher
**File:** `api/market-data.js`  
**Methods:** GET  
**Purpose:** Fetch historical data from Yahoo Finance  
**Returns:** Array of OHLCV candles

## Not Deployed (Local Only)

### `api/utils/index.js` (formerly `api/index.js`)
Monolithic Express server for local development (`npm run server`).  
Contains all endpoint logic in one file but not used in Vercel.

### `api/utils/watchlistLogic.js`
Shared logic for watchlist status updates.  
Imported by `watchlist.js` endpoint.

## Architecture Notes

**Local Development:**
- Uses `server.js` which imports `api/utils/index.js`
- Single Express server with all routes

**Vercel Production:**
- Each endpoint is a separate serverless function
- Vercel automatically routes based on file structure:
  - `/api/analyze` → `api/analyze.js`
  - `/api/screener/stocks` → `api/screener/stocks/index.js`
  - `/api/screener/stocks/:ticker` → `api/screener/stocks/[ticker].js`
- Dynamic routes use `[param].js` syntax
- Max 12 functions on Hobby plan (currently using 10)

## Environment Variables Required

Both local and Vercel need:
```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://....supabase.co
SUPABASE_KEY=eyJhbG...
```

## Testing Endpoints

```bash
# Test analyze with trade object
curl -X POST https://weekly-trading-ai.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"ticker":"AAPL"}' | jq '.trade'

# Test portfolio
curl https://weekly-trading-ai.vercel.app/api/portfolio | jq '.stocks | length'

# Test screener stocks list
curl https://weekly-trading-ai.vercel.app/api/screener/stocks | jq '.stocks | length'

# Test AI history
curl https://weekly-trading-ai.vercel.app/api/ai-analysis/history/AAPL | jq '.count'
```
