-- =====================================================
-- PORTFOLIO TESTDATA
-- =====================================================
-- Fem realistiska positioner med olika status-nivåer
-- Kör detta EFTER att du kört PORTFOLIO_MIGRATION.md
-- =====================================================

-- Rensa eventuell gammal testdata
DELETE FROM portfolio WHERE ticker IN ('VOLV-B.ST', 'AAPL', 'MSFT', 'TSLA', 'ERIC-B.ST');

-- =====================================================
-- POSITION 1: VOLV-B.ST - TIGHTEN_STOP (vinst, skydda)
-- =====================================================
INSERT INTO portfolio (
  ticker,
  entry_price,
  quantity,
  entry_date,
  initial_stop,
  initial_target,
  initial_r,
  initial_ema20,
  initial_ema50,
  initial_rsi14,
  entry_setup,
  current_price,
  current_stop,
  current_ema20,
  current_ema50,
  current_rsi14,
  current_volume_rel,
  pnl_pct,
  pnl_amount,
  r_multiple,
  days_in_trade,
  current_status,
  exit_signal,
  trailing_type,
  last_updated,
  added_at
) VALUES (
  'VOLV-B.ST',
  241.0,                -- entry
  100,                  -- quantity
  CURRENT_DATE - INTERVAL '6 days',  -- 6 dagar sedan
  237.0,                -- initial stop (4 kr risk)
  249.0,                -- target (+2R)
  4.0,                  -- R = 4 kr
  240.0,                -- initial EMA20
  235.0,                -- initial EMA50
  45.0,                 -- initial RSI
  'Pullback',           -- setup
  248.5,                -- current price (+7.5 kr = +1.9R)
  244.0,                -- current stop (flyttad upp till EMA20)
  244.0,                -- current EMA20
  238.0,                -- current EMA50
  58.0,                 -- current RSI
  0.9,                  -- relativ volym (normal)
  3.1,                  -- PnL% (+3.1%)
  750.0,                -- PnL amount (7.5 kr × 100 aktier)
  1.9,                  -- R-multiple (+1.9R)
  6,                    -- 6 dagar i trade
  'TIGHTEN_STOP',       -- status
  '+1.9R vinst - flytta stop till break-even eller EMA20',
  'EMA20',
  CURRENT_DATE,
  CURRENT_DATE - INTERVAL '6 days'
);

-- =====================================================
-- POSITION 2: AAPL - EXIT (EMA20 break)
-- =====================================================
INSERT INTO portfolio (
  ticker,
  entry_price,
  quantity,
  entry_date,
  initial_stop,
  initial_target,
  initial_r,
  initial_ema20,
  initial_ema50,
  initial_rsi14,
  entry_setup,
  current_price,
  current_stop,
  current_ema20,
  current_ema50,
  current_rsi14,
  current_volume_rel,
  pnl_pct,
  pnl_amount,
  r_multiple,
  days_in_trade,
  current_status,
  exit_signal,
  trailing_type,
  last_updated,
  added_at
) VALUES (
  'AAPL',
  180.0,
  50,
  CURRENT_DATE - INTERVAL '3 days',
  176.0,                -- stop
  188.0,                -- target
  4.0,                  -- R = 4 USD
  179.0,
  175.0,
  48.0,
  'Pullback',
  175.2,                -- current price (under stop!)
  176.0,                -- stop (inte uppdaterad)
  177.0,                -- current EMA20 (pris under!)
  174.0,
  42.0,                 -- RSI falling
  1.2,
  -2.7,                 -- PnL% (-2.7%)
  -240.0,               -- förlust
  -1.2,                 -- R-multiple (förlorat 1.2R)
  3,
  'EXIT',               -- SÄLJSIGNAL
  'Pris under EMA20 - momentum bruten',
  'EMA20',
  CURRENT_DATE,
  CURRENT_DATE - INTERVAL '3 days'
);

-- =====================================================
-- POSITION 3: MSFT - HOLD (allt OK)
-- =====================================================
INSERT INTO portfolio (
  ticker,
  entry_price,
  quantity,
  entry_date,
  initial_stop,
  initial_target,
  initial_r,
  initial_ema20,
  initial_ema50,
  initial_rsi14,
  entry_setup,
  current_price,
  current_stop,
  current_ema20,
  current_ema50,
  current_rsi14,
  current_volume_rel,
  pnl_pct,
  pnl_amount,
  r_multiple,
  days_in_trade,
  current_status,
  exit_signal,
  trailing_type,
  last_updated,
  added_at
) VALUES (
  'MSFT',
  375.0,
  25,
  CURRENT_DATE - INTERVAL '2 days',
  370.0,
  385.0,
  5.0,                  -- R = 5 USD
  374.0,
  368.0,
  50.0,
  'Pullback',
  380.5,                -- current price (+5.5 = +1.1R)
  374.0,                -- trailing stop (EMA20)
  374.0,
  370.0,
  54.0,
  0.8,                  -- låg volym
  1.5,                  -- +1.5%
  137.5,
  1.1,                  -- +1.1R
  2,
  'HOLD',               -- allt lugnt
  NULL,
  'EMA20',
  CURRENT_DATE,
  CURRENT_DATE - INTERVAL '2 days'
);

-- =====================================================
-- POSITION 4: TSLA - PARTIAL_EXIT (RSI overbought + stor vinst)
-- =====================================================
INSERT INTO portfolio (
  ticker,
  entry_price,
  quantity,
  entry_date,
  initial_stop,
  initial_target,
  initial_r,
  initial_ema20,
  initial_ema50,
  initial_rsi14,
  entry_setup,
  current_price,
  current_stop,
  current_ema20,
  current_ema50,
  current_rsi14,
  current_volume_rel,
  pnl_pct,
  pnl_amount,
  r_multiple,
  days_in_trade,
  current_status,
  exit_signal,
  trailing_type,
  last_updated,
  added_at
) VALUES (
  'TSLA',
  240.0,
  40,
  CURRENT_DATE - INTERVAL '8 days',
  235.0,
  250.0,
  5.0,                  -- R = 5 USD
  238.0,
  230.0,
  52.0,
  'Breakout',
  252.0,                -- current price (+12 = +2.4R)
  246.0,                -- trailing stop
  246.0,
  238.0,
  72.0,                 -- RSI OVERBOUGHT!
  1.6,                  -- hög volym
  5.0,                  -- +5%
  480.0,
  2.4,                  -- +2.4R (utmärkt!)
  8,
  'PARTIAL_EXIT',       -- skala ut 50%
  'RSI overbought (72) + +2.4R vinst - skala ut 50%',
  'EMA20',
  CURRENT_DATE,
  CURRENT_DATE - INTERVAL '8 days'
);

-- =====================================================
-- POSITION 5: ERIC-B.ST - HOLD (liten vinst, väntar)
-- =====================================================
INSERT INTO portfolio (
  ticker,
  entry_price,
  quantity,
  entry_date,
  initial_stop,
  initial_target,
  initial_r,
  initial_ema20,
  initial_ema50,
  initial_rsi14,
  entry_setup,
  current_price,
  current_stop,
  current_ema20,
  current_ema50,
  current_rsi14,
  current_volume_rel,
  pnl_pct,
  pnl_amount,
  r_multiple,
  days_in_trade,
  current_status,
  exit_signal,
  trailing_type,
  last_updated,
  added_at
) VALUES (
  'ERIC-B.ST',
  56.0,
  200,
  CURRENT_DATE - INTERVAL '1 day',
  54.5,
  59.0,
  1.5,                  -- R = 1.5 kr
  55.8,
  54.0,
  46.0,
  'Pullback',
  56.8,                 -- current price (+0.8 = +0.53R)
  55.8,                 -- stop (EMA20)
  55.8,
  54.2,
  51.0,
  1.0,
  1.4,                  -- +1.4%
  160.0,
  0.53,                 -- +0.53R (liten vinst)
  1,
  'HOLD',
  NULL,
  'EMA20',
  CURRENT_DATE,
  CURRENT_DATE - INTERVAL '1 day'
);

-- Verifiera att allt lades till
SELECT
  ticker,
  entry_price,
  current_price,
  pnl_pct || '%' as pnl,
  r_multiple || 'R' as r,
  current_status,
  days_in_trade || 'd' as dagar
FROM portfolio
ORDER BY
  CASE current_status
    WHEN 'EXIT' THEN 1
    WHEN 'STOP_HIT' THEN 2
    WHEN 'PARTIAL_EXIT' THEN 3
    WHEN 'TIGHTEN_STOP' THEN 4
    WHEN 'HOLD' THEN 5
    ELSE 99
  END;
