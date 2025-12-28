-- Testdata för avslutade affärer
-- Kör detta i Supabase SQL Editor eller din lokala databas

-- 1. VINNARE - Följde planen perfekt (A-kvalitet)
INSERT INTO portfolio (
  ticker, entry_date, exit_date, entry_price, exit_price, quantity,
  initial_stop, current_stop, initial_target, current_target, initial_r,
  entry_setup, exit_status, exit_type, trailing_type,
  initial_ema20, initial_ema50, current_ema20, current_ema50, initial_rsi14,
  risk_kr, risk_pct, rr_ratio, entry_rationale, watchlist_status, source,
  r_multiple, pnl_pct, max_mfe, max_mae,
  plan_followed, exited_early, stopped_out, broke_rule, could_scale_better,
  edge_tag, lesson_learned, last_updated
) VALUES (
  'VOLV-B.ST', '2025-12-01', '2025-12-10', 240.00, 256.80, 100,
  235.00, 240.00, 250.00, 250.00, 5.00,
  'Pullback', 'EXITED', 'TARGET', 'EMA20',
  238.50, 235.00, 238.50, 235.00, 48.5,
  500, 2.0, 2.0, 'Pullback till EMA20 i stark upptrend. RSI 48.5 (CALM). Volym låg, perfekt setup.', 'READY', 'WATCHLIST',
  3.36, 7.0, 3.5, -0.4,
  true, false, false, false, false,
  'A', 'Perfekt entry vid EMA20. Höll planen hela vägen. Target-exit fungerade utmärkt.', '2025-12-10'
);

-- 2. VINNARE - Men exitade för tidigt (B-kvalitet)
INSERT INTO portfolio (
  ticker, entry_date, exit_date, entry_price, exit_price, quantity,
  initial_stop, current_stop, initial_target, current_target, initial_r,
  entry_setup, exit_status, exit_type, trailing_type,
  initial_ema20, initial_ema50, current_ema20, current_ema50, initial_rsi14,
  risk_kr, risk_pct, rr_ratio, entry_rationale, watchlist_status, source,
  r_multiple, pnl_pct, max_mfe, max_mae,
  plan_followed, exited_early, stopped_out, broke_rule, could_scale_better,
  edge_tag, lesson_learned, last_updated
) VALUES (
  'AAPL', '2025-12-05', '2025-12-12', 180.50, 186.30, 50,
  177.00, 180.50, 187.50, 187.50, 3.50,
  'Breakout', 'EXITED', 'EMA20', 'EMA20',
  179.00, 175.00, 179.00, 175.00, 52.0,
  175, 1.5, 2.0, 'Breakout över resistance med hög volym. Stark momentum.', 'READY', 'WATCHLIST',
  1.66, 3.2, 2.8, -0.3,
  false, true, false, false, true,
  'B', 'Exitade vid EMA20-break men aktien fortsatte upp 2 dagar till. Kunde låtit löpa längre.', '2025-12-12'
);

-- 3. FÖRLUST - Stoppades ut (B-kvalitet)
INSERT INTO portfolio (
  ticker, entry_date, exit_date, entry_price, exit_price, quantity,
  initial_stop, current_stop, initial_target, current_target, initial_r,
  entry_setup, exit_status, exit_type, trailing_type,
  initial_ema20, initial_ema50, current_ema20, current_ema50, initial_rsi14,
  risk_kr, risk_pct, rr_ratio, entry_rationale, watchlist_status, source,
  r_multiple, pnl_pct, max_mfe, max_mae,
  plan_followed, exited_early, stopped_out, broke_rule, could_scale_better,
  edge_tag, lesson_learned, last_updated
) VALUES (
  'MSFT', '2025-12-08', '2025-12-15', 370.00, 365.50, 20,
  365.00, 365.00, 380.00, 380.00, 5.00,
  'Pullback', 'EXITED', 'STOP', 'Manual',
  368.00, 365.00, 368.00, 365.00, 45.0,
  100, 1.0, 2.0, 'Pullback-setup men RSI lite för låg. Tog chansen ändå.', 'APPROACHING', 'WATCHLIST',
  -0.9, -1.2, 0.4, -1.0,
  true, false, true, false, false,
  'B', 'Stop var korrekt placerad. Marknaden vände snabbt. Accepterar förlusten.', '2025-12-15'
);

-- 4. STOR VINNARE - Skalad perfekt (A-kvalitet)
INSERT INTO portfolio (
  ticker, entry_date, exit_date, entry_price, exit_price, quantity,
  initial_stop, current_stop, initial_target, current_target, initial_r,
  entry_setup, exit_status, exit_type, trailing_type,
  initial_ema20, initial_ema50, current_ema20, current_ema50, initial_rsi14,
  risk_kr, risk_pct, rr_ratio, entry_rationale, watchlist_status, source,
  r_multiple, pnl_pct, max_mfe, max_mae,
  plan_followed, exited_early, stopped_out, broke_rule, could_scale_better,
  edge_tag, lesson_learned, last_updated
) VALUES (
  'TSLA', '2025-12-10', '2025-12-20', 240.00, 265.00, 40,
  235.00, 255.00, 250.00, 260.00, 5.00,
  'Pullback', 'EXITED', 'PARTIAL_SCALE', 'ATR',
  238.00, 230.00, 238.00, 230.00, 50.0,
  200, 1.8, 2.0, 'Pullback efter stark uppgång. RSI 50 (perfekt). Hög relativ volym.', 'READY', 'WATCHLIST',
  5.0, 10.4, 5.4, -0.2,
  true, false, false, false, false,
  'A', 'Del-exit vid +2R fungerade perfekt. Lät resten löpa till +5R med trailing stop.', '2025-12-20'
);

-- 5. FÖRLUST - Bröt regel (C-kvalitet)
INSERT INTO portfolio (
  ticker, entry_date, exit_date, entry_price, exit_price, quantity,
  initial_stop, current_stop, initial_target, current_target, initial_r,
  entry_setup, exit_status, exit_type, trailing_type,
  initial_ema20, initial_ema50, current_ema20, current_ema50, initial_rsi14,
  risk_kr, risk_pct, rr_ratio, entry_rationale, watchlist_status, source,
  r_multiple, pnl_pct, max_mfe, max_mae,
  plan_followed, exited_early, stopped_out, broke_rule, could_scale_better,
  edge_tag, lesson_learned, last_updated
) VALUES (
  'NVDA', '2025-12-12', '2025-12-14', 480.00, 470.00, 15,
  475.00, 475.00, 490.00, 490.00, 5.00,
  'Breakout', 'EXITED', 'PANIC', 'Manual',
  478.00, 475.00, 478.00, 475.00, 68.0,
  75, 0.8, 2.0, 'FOMO-entry. RSI för högt men tog ändå.', 'WAIT_PULLBACK', 'MANUAL',
  -2.0, -2.1, 0.2, -2.2,
  false, true, false, true, false,
  'C', 'RSI 68 = för högt. Tog entry ändå (FOMO). Panikexitade innan stop. Dålig trade.', '2025-12-14'
);

-- 6. LITEN VINNARE - Time-based exit (B-kvalitet)
INSERT INTO portfolio (
  ticker, entry_date, exit_date, entry_price, exit_price, quantity,
  initial_stop, current_stop, initial_target, current_target, initial_r,
  entry_setup, exit_status, exit_type, trailing_type,
  initial_ema20, initial_ema50, current_ema20, current_ema50, initial_rsi14,
  risk_kr, risk_pct, rr_ratio, entry_rationale, watchlist_status, source,
  r_multiple, pnl_pct, max_mfe, max_mae,
  plan_followed, exited_early, stopped_out, broke_rule, could_scale_better,
  edge_tag, lesson_learned, last_updated
) VALUES (
  'GOOGL', '2025-12-15', '2025-12-25', 138.00, 140.50, 70,
  135.00, 138.00, 144.00, 144.00, 3.00,
  'Pullback', 'EXITED', 'TIME', 'EMA20',
  136.50, 133.00, 136.50, 133.00, 49.0,
  210, 1.5, 2.0, 'Perfekt pullback-setup vid EMA20. RSI 49.', 'READY', 'WATCHLIST',
  0.83, 1.8, 1.2, -0.5,
  true, false, false, false, false,
  'B', '10-dagars regel fungerade. Aktien rörde sig inte mot target så exitade enligt plan.', '2025-12-25'
);

-- 7. FÖRLUST - Men följde planen (B-kvalitet)
INSERT INTO portfolio (
  ticker, entry_date, exit_date, entry_price, exit_price, quantity,
  initial_stop, current_stop, initial_target, current_target, initial_r,
  entry_setup, exit_status, exit_type, trailing_type,
  initial_ema20, initial_ema50, current_ema20, current_ema50, initial_rsi14,
  risk_kr, risk_pct, rr_ratio, entry_rationale, watchlist_status, source,
  r_multiple, pnl_pct, max_mfe, max_mae,
  plan_followed, exited_early, stopped_out, broke_rule, could_scale_better,
  edge_tag, lesson_learned, last_updated
) VALUES (
  'META', '2025-12-18', '2025-12-22', 355.00, 350.00, 25,
  350.00, 350.00, 365.00, 365.00, 5.00,
  'Pullback', 'EXITED', 'STOP', 'ATR',
  352.00, 348.00, 352.00, 348.00, 46.5,
  125, 1.2, 2.0, 'Pullback i upptrend. Setup var korrekt.', 'READY', 'WATCHLIST',
  -1.0, -1.4, 0.3, -1.0,
  true, false, true, false, false,
  'B', 'Setup var rätt men marknaden vände. Stop-loss gjorde sitt jobb.', '2025-12-22'
);

-- 8. VINNARE - Med partial exit (A-kvalitet)
INSERT INTO portfolio (
  ticker, entry_date, exit_date, entry_price, exit_price, quantity,
  initial_stop, current_stop, initial_target, current_target, initial_r,
  entry_setup, exit_status, exit_type, trailing_type,
  initial_ema20, initial_ema50, current_ema20, current_ema50, initial_rsi14,
  risk_kr, risk_pct, rr_ratio, entry_rationale, watchlist_status, source,
  r_multiple, pnl_pct, max_mfe, max_mae,
  plan_followed, exited_early, stopped_out, broke_rule, could_scale_better,
  edge_tag, lesson_learned, last_updated
) VALUES (
  'AMZN', '2025-12-20', '2025-12-28', 175.00, 182.50, 60,
  171.00, 175.00, 183.00, 183.00, 4.00,
  'Pullback', 'EXITED', 'PARTIAL_SCALE', 'EMA20',
  173.50, 170.00, 173.50, 170.00, 51.0,
  240, 1.6, 2.0, 'Klassisk pullback. RSI 51. Hög confidence.', 'READY', 'WATCHLIST',
  1.88, 4.3, 2.2, -0.3,
  true, false, false, false, true,
  'A', 'Del-exit vid +1.5R. Flyttade stop till BE. Låt resten löpa.', '2025-12-28'
);

-- Lägg till events för positionerna
INSERT INTO portfolio_events (ticker, event_date, event_type, description, created_at) VALUES
('VOLV-B.ST', '2025-12-01', 'ENTRY', 'Köpt 100 aktier @ 240.00 kr', '2025-12-01T09:00:00Z'),
('VOLV-B.ST', '2025-12-10', 'EXIT', 'Såld @ 256.80 kr (TARGET)', '2025-12-10T15:30:00Z'),

('AAPL', '2025-12-05', 'ENTRY', 'Köpt 50 aktier @ 180.50 kr', '2025-12-05T09:00:00Z'),
('AAPL', '2025-12-12', 'EXIT', 'Såld @ 186.30 kr (EMA20)', '2025-12-12T14:00:00Z'),

('MSFT', '2025-12-08', 'ENTRY', 'Köpt 20 aktier @ 370.00 kr', '2025-12-08T09:00:00Z'),
('MSFT', '2025-12-15', 'EXIT', 'Såld @ 365.50 kr (STOP)', '2025-12-15T11:30:00Z'),

('TSLA', '2025-12-10', 'ENTRY', 'Köpt 40 aktier @ 240.00 kr', '2025-12-10T09:00:00Z'),
('TSLA', '2025-12-15', 'PARTIAL_EXIT', 'Såld 20 aktier @ 250.00 kr (+2R)', '2025-12-15T14:00:00Z'),
('TSLA', '2025-12-17', 'STOP_MOVED', 'Stop flyttad från 235.00 → 240.00 (BE)', '2025-12-17T10:00:00Z'),
('TSLA', '2025-12-20', 'EXIT', 'Såld 20 aktier @ 265.00 kr (PARTIAL_SCALE)', '2025-12-20T15:00:00Z'),

('NVDA', '2025-12-12', 'ENTRY', 'Köpt 15 aktier @ 480.00 kr', '2025-12-12T09:00:00Z'),
('NVDA', '2025-12-14', 'EXIT', 'Såld @ 470.00 kr (PANIC)', '2025-12-14T10:30:00Z'),

('GOOGL', '2025-12-15', 'ENTRY', 'Köpt 70 aktier @ 138.00 kr', '2025-12-15T09:00:00Z'),
('GOOGL', '2025-12-25', 'EXIT', 'Såld @ 140.50 kr (TIME)', '2025-12-25T15:30:00Z'),

('META', '2025-12-18', 'ENTRY', 'Köpt 25 aktier @ 355.00 kr', '2025-12-18T09:00:00Z'),
('META', '2025-12-22', 'EXIT', 'Såld @ 350.00 kr (STOP)', '2025-12-22T11:00:00Z'),

('AMZN', '2025-12-20', 'ENTRY', 'Köpt 60 aktier @ 175.00 kr', '2025-12-20T09:00:00Z'),
('AMZN', '2025-12-24', 'PARTIAL_EXIT', 'Såld 30 aktier @ 179.00 kr (+1R)', '2025-12-24T14:00:00Z'),
('AMZN', '2025-12-28', 'EXIT', 'Såld 30 aktier @ 182.50 kr (PARTIAL_SCALE)', '2025-12-28T15:00:00Z');
