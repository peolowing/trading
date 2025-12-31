# Screener Setup Guide

This guide explains how to set up and maintain the screener functionality with cached technical data.

## 🎯 Overview

The screener system works in two parts:
1. **Background calculation** - Daily script that fetches data from Yahoo Finance and calculates technical indicators
2. **API endpoint** - Fast endpoint that reads pre-calculated data from database

## 📋 Setup Steps

### 1. Run SQL Migration

Execute the SQL migration in Supabase SQL Editor:

```bash
# Open Supabase Dashboard > SQL Editor
# Copy and paste contents of: supabase_add_screener_columns.sql
```

This adds the following columns to `screener_stocks`:
- `price` - Current stock price
- `ema20` - 20-period EMA
- `ema50` - 50-period EMA
- `rsi` - 14-period RSI
- `atr` - 14-period ATR
- `relative_volume` - Relative volume vs 20-day average
- `regime` - Market regime (Bullish Trend, Bearish Trend, Consolidation)
- `setup` - Detected setup (Pullback, Breakout, etc.)
- `edge_score` - Ranking score 0-100
- `last_calculated` - Date of last calculation
- `volume` - Latest volume
- `turnover_msek` - Turnover in millions SEK

### 2. Calculate Initial Data

Run the calculation script to populate the database:

```bash
node scripts/calculate-screener-data.js
```

This will:
- Fetch 1 year of historical data for each stock
- Calculate all technical indicators
- Apply volume filters
- Compute edge scores
- Save everything to database

**Expected time**: 2-5 minutes for 40 stocks (with rate limiting)

### 3. Verify Data

Check that data was saved correctly:

```bash
# Via API
curl https://weekly-trading-ai.vercel.app/api/screener | jq '.stocks[0]'

# Or check Supabase dashboard
# Table Editor > screener_stocks > check that price, ema20, etc. have values
```

## 🔄 Daily Updates

### Manual Update

Run the script whenever you want fresh data:

```bash
node scripts/calculate-screener-data.js
```

### Automated Update (Recommended)

**Option 1: Vercel Cron Job** (Coming soon)
- Create `/api/cron/update-screener.js` endpoint
- Add cron schedule in `vercel.json`
- Runs automatically every day

**Option 2: Local Cron Job**

Add to your crontab:

```bash
# Run every day at 6 PM Stockholm time (after market close)
0 18 * * * cd /path/to/weekly-trading-ai && node scripts/calculate-screener-data.js >> logs/screener.log 2>&1
```

**Option 3: GitHub Actions**

Create `.github/workflows/update-screener.yml`:

```yaml
name: Update Screener Data
on:
  schedule:
    - cron: '0 17 * * 1-5'  # Weekdays at 5 PM UTC (6 PM Stockholm)
  workflow_dispatch:  # Allow manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: node scripts/calculate-screener-data.js
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
```

## 📊 How It Works

### Data Flow

```
┌─────────────────┐
│ Yahoo Finance   │
│ Historical Data │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Calculation     │
│ Script          │
│ - EMA, RSI, ATR │
│ - Edge Score    │
│ - Setup         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Supabase        │
│ screener_stocks │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ API Endpoint    │
│ /api/screener   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Frontend        │
│ Screener List   │
└─────────────────┘
```

### Calculation Details

The script processes each stock:

1. **Fetch Data** - 1 year of daily candles from Yahoo Finance
2. **Volume Filter** - Requires avg turnover ≥ 10M SEK/day
3. **Calculate Indicators**:
   - EMA 20, EMA 50
   - RSI 14
   - ATR 14
   - Relative volume
4. **Detect Regime**:
   - Bullish Trend: EMA20 > EMA50 && Price > EMA20
   - Bearish Trend: EMA20 < EMA50 && Price < EMA20
   - Consolidation: Everything else
5. **Detect Setup**:
   - Pullback: Price near EMA20, RSI 40-60
   - Breakout: RSI > 60, high volume
   - Trend Following: Following EMA20
   - etc.
6. **Compute Edge Score** (0-100):
   - Trend strength: 0-30 points
   - RSI zone: 0-25 points
   - Volume: 0-20 points
   - Pullback setup: 0-15 points
   - Bucket bonus: 0-10 points (Large cap gets +10)
7. **Save to Database**

## 🚀 API Usage

### Get Screener Data

```bash
GET /api/screener
```

Returns stocks sorted by edge_score (highest first):

```json
{
  "stocks": [
    {
      "ticker": "VOLV-B.ST",
      "name": null,
      "bucket": "LARGE_CAP",
      "edgeScore": 85,
      "price": 240.50,
      "ema20": 238.20,
      "ema50": 235.10,
      "rsi": 52.4,
      "atr": 3.8,
      "relativeVolume": 1.2,
      "regime": "Bullish Trend",
      "setup": "Pullback",
      "volume": 5234567,
      "turnoverMSEK": 1259.4,
      "lastCalculated": "2025-12-31"
    }
  ],
  "lastUpdate": "2025-12-31"
}
```

## 🔧 Troubleshooting

### No data showing in Vercel

1. Check that SQL migration was run
2. Verify calculation script completed successfully
3. Check Supabase table has data:
   ```sql
   SELECT ticker, price, ema20, edge_score, last_calculated
   FROM screener_stocks
   WHERE is_active = true
   LIMIT 5;
   ```

### Script fails with rate limiting

Yahoo Finance may rate limit. The script includes 200ms delay between stocks, but you can increase it:

```javascript
// In calculate-screener-data.js, line ~240
await new Promise(resolve => setTimeout(resolve, 500)); // Increase to 500ms
```

### Data is stale

Check `last_calculated` date. If old, run the script again:

```bash
node scripts/calculate-screener-data.js
```

## 📝 Notes

- **Data freshness**: Yahoo Finance data is typically 15-20 minutes delayed
- **Calculation time**: ~2-5 minutes for 40 stocks
- **Best time to run**: After market close (6 PM Stockholm time)
- **Storage**: Each stock uses ~500 bytes, 40 stocks = 20KB total
- **Performance**: API endpoint is very fast (<100ms) since it reads from cache
