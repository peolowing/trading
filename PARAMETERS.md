# Parameteröversikt

Sammanfattning av beräkningar och fält som används i watchlist, edge score, setup och status.

## Watchlist-status (updateWatchlistStatus)
- `status` (READY, APPROACHING, WAIT_PULLBACK, BREAKOUT_ONLY, INVALIDATED)
- `action` (PREPARE_ENTRY, WAIT, WAIT_OR_BREAKOUT, REMOVE_FROM_WATCHLIST)
- `reason` (kort text om varför statusen sattes)
- `distEma20Pct` (avstånd pris→EMA20 i %, sparas som `dist_ema20_pct`)
- `rsiZone` (WEAK <40, CALM 40-55, WARM 56-65, HOT >65)
- `volumeState` (HIGH >1.5x, LOW <0.5x, annars NORMAL)
- `ema50_slope` (lutning mellan två senaste EMA50-värden)
- `higherLow` (true om senaste lågen är högre än tidigare låga)
- `daysInWatchlist` (dagar sedan tillagd, används för `timeWarning` om >=10)
- `timeWarning` (textvarning om lång väntan)

## Setup/strategi-detektering
- Regime: Bullish Trend, Consolidation, Bearish (baserat på EMA20/EMA50 och prisrelationer)
- `distToEMA20Pct` (prisavstånd till EMA20) används för Near Breakout-trigger (<=0.5% i konsolidering med EMA20>EMA50 och RSI 40-60)
- Trend Pullback: kräver Close>SMA200, SMA50>SMA200, 2-6 dagar under EMA20, relVol >0.5, RSI 30-50

## Edge Score (computeRanking, 0-100)
- Likviditet: `turnoverM` (pris*vol/1e6) ger 0-30p (högre omsättning → fler poäng)
- Trend: `regime` + `slope` (EMA20-lutning 10 dagar) ger upp till ~30p (UPTREND + positiv slope väger tungt)
- Volatilitet: `atrPct = ATR14/close` sweet spot 2-5% ger 20p, annars reducerat
- Bucket-straff: MID_CAP med låg ATR (<1.8%) får -10
- Momentum: `rsi14` 40-60 (15p), 60-70 (10p), <30 (5p)
- Volymboost: `relVol > 1.3` ger +5
- `edge_label`: Stark edge (≥70), OK (50-69), Svag (<50)

## Indikatorer som sparas/visas
- EMA20, EMA50, SMA50, SMA200, RSI14, ATR14
- `relativeVolume` (senaste vol / snitt 20 dagar)
- `regime`, `setup` (t.ex. Near Breakout, Hold)
- Backtestfält: `win_rate`, `total_return`, `trades_count`, `expectancy`, `avg_win`, `avg_loss`

## Databasfält (watchlist)
- `current_status`, `current_action`, `status_reason`
- `dist_ema20_pct`, `rsi_zone`, `volume_state`, `time_warning`, `days_in_watchlist`
- `edge_score`, `edge_label` (när beräknat)
