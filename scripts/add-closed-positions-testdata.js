// Script för att lägga till testdata för avslutade affärer
// Kör med: node scripts/add-closed-positions-testdata.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const testPositions = [
  // 1. VINNARE - Följde planen perfekt (A-kvalitet)
  {
    ticker: 'VOLV-B.ST',
    entry_date: '2025-12-01',
    exit_date: '2025-12-10',
    entry_price: 240.00,
    exit_price: 256.80,
    quantity: 100,
    initial_stop: 235.00,
    current_stop: 240.00,
    initial_target: 250.00,
    current_target: 250.00,
    initial_r: 5.00,
    entry_setup: 'Pullback',
    exit_status: 'EXITED',
    exit_type: 'TARGET',
    trailing_type: 'EMA20',
    initial_ema20: 238.50,
    initial_ema50: 235.00,
    current_ema20: 238.50,
    current_ema50: 235.00,
    initial_rsi14: 48.5,
    risk_kr: 500,
    risk_pct: 2.0,
    rr_ratio: 2.0,
    entry_rationale: 'Pullback till EMA20 i stark upptrend. RSI 48.5 (CALM). Volym låg, perfekt setup.',
    watchlist_status: 'READY',
    source: 'WATCHLIST',
    // Beräknade värden
    r_multiple: 3.36,  // (256.80 - 240) / 5
    pnl_pct: 7.0,      // ((256.80 - 240) / 240) * 100
    max_mfe: 3.5,
    max_mae: -0.4,
    // Utvärdering
    plan_followed: true,
    exited_early: false,
    stopped_out: false,
    broke_rule: false,
    could_scale_better: false,
    edge_tag: 'A',
    lesson_learned: 'Perfekt entry vid EMA20. Höll planen hela vägen. Target-exit fungerade utmärkt.',
    last_updated: '2025-12-10'
  },

  // 2. VINNARE - Men exitade för tidigt (B-kvalitet)
  {
    ticker: 'AAPL',
    entry_date: '2025-12-05',
    exit_date: '2025-12-12',
    entry_price: 180.50,
    exit_price: 186.30,
    quantity: 50,
    initial_stop: 177.00,
    current_stop: 180.50,
    initial_target: 187.50,
    current_target: 187.50,
    initial_r: 3.50,
    entry_setup: 'Breakout',
    exit_status: 'EXITED',
    exit_type: 'EMA20',
    trailing_type: 'EMA20',
    initial_ema20: 179.00,
    initial_ema50: 175.00,
    current_ema20: 179.00,
    current_ema50: 175.00,
    initial_rsi14: 52.0,
    risk_kr: 175,
    risk_pct: 1.5,
    rr_ratio: 2.0,
    entry_rationale: 'Breakout över resistance med hög volym. Stark momentum.',
    watchlist_status: 'READY',
    source: 'WATCHLIST',
    r_multiple: 1.66,   // (186.30 - 180.50) / 3.50
    pnl_pct: 3.2,
    max_mfe: 2.8,
    max_mae: -0.3,
    plan_followed: false,
    exited_early: true,
    stopped_out: false,
    broke_rule: false,
    could_scale_better: true,
    edge_tag: 'B',
    lesson_learned: 'Exitade vid EMA20-break men aktien fortsatte upp 2 dagar till. Kunde låtit löpa längre.',
    last_updated: '2025-12-12'
  },

  // 3. FÖRLUST - Stoppades ut (B-kvalitet)
  {
    ticker: 'MSFT',
    entry_date: '2025-12-08',
    exit_date: '2025-12-15',
    entry_price: 370.00,
    exit_price: 365.50,
    quantity: 20,
    initial_stop: 365.00,
    current_stop: 365.00,
    initial_target: 380.00,
    current_target: 380.00,
    initial_r: 5.00,
    entry_setup: 'Pullback',
    exit_status: 'EXITED',
    exit_type: 'STOP',
    trailing_type: 'Manual',
    initial_ema20: 368.00,
    initial_ema50: 365.00,
    current_ema20: 368.00,
    current_ema50: 365.00,
    initial_rsi14: 45.0,
    risk_kr: 100,
    risk_pct: 1.0,
    rr_ratio: 2.0,
    entry_rationale: 'Pullback-setup men RSI lite för låg. Tog chansen ändå.',
    watchlist_status: 'APPROACHING',
    source: 'WATCHLIST',
    r_multiple: -0.9,   // (365.50 - 370) / 5
    pnl_pct: -1.2,
    max_mfe: 0.4,
    max_mae: -1.0,
    plan_followed: true,
    exited_early: false,
    stopped_out: true,
    broke_rule: false,
    could_scale_better: false,
    edge_tag: 'B',
    lesson_learned: 'Stop var korrekt placerad. Marknaden vände snabbt. Accepterar förlusten.',
    last_updated: '2025-12-15'
  },

  // 4. STOR VINNARE - Skalad perfekt (A-kvalitet)
  {
    ticker: 'TSLA',
    entry_date: '2025-12-10',
    exit_date: '2025-12-20',
    entry_price: 240.00,
    exit_price: 265.00,
    quantity: 40,
    initial_stop: 235.00,
    current_stop: 255.00,
    initial_target: 250.00,
    current_target: 260.00,
    initial_r: 5.00,
    entry_setup: 'Pullback',
    exit_status: 'EXITED',
    exit_type: 'PARTIAL_SCALE',
    trailing_type: 'ATR',
    initial_ema20: 238.00,
    initial_ema50: 230.00,
    current_ema20: 238.00,
    current_ema50: 230.00,
    initial_rsi14: 50.0,
    risk_kr: 200,
    risk_pct: 1.8,
    rr_ratio: 2.0,
    entry_rationale: 'Pullback efter stark uppgång. RSI 50 (perfekt). Hög relativ volym.',
    watchlist_status: 'READY',
    source: 'WATCHLIST',
    r_multiple: 5.0,    // (265 - 240) / 5
    pnl_pct: 10.4,
    max_mfe: 5.4,
    max_mae: -0.2,
    plan_followed: true,
    exited_early: false,
    stopped_out: false,
    broke_rule: false,
    could_scale_better: false,
    edge_tag: 'A',
    lesson_learned: 'Del-exit vid +2R fungerade perfekt. Lät resten löpa till +5R med trailing stop.',
    last_updated: '2025-12-20'
  },

  // 5. FÖRLUST - Bröt regel (C-kvalitet)
  {
    ticker: 'NVDA',
    entry_date: '2025-12-12',
    exit_date: '2025-12-14',
    entry_price: 480.00,
    exit_price: 470.00,
    quantity: 15,
    initial_stop: 475.00,
    current_stop: 475.00,
    initial_target: 490.00,
    current_target: 490.00,
    initial_r: 5.00,
    entry_setup: 'Breakout',
    exit_status: 'EXITED',
    exit_type: 'PANIC',
    trailing_type: 'Manual',
    initial_ema20: 478.00,
    initial_ema50: 475.00,
    current_ema20: 478.00,
    current_ema50: 475.00,
    initial_rsi14: 68.0,
    risk_kr: 75,
    risk_pct: 0.8,
    rr_ratio: 2.0,
    entry_rationale: 'FOMO-entry. RSI för högt men tog ändå.',
    watchlist_status: 'WAIT_PULLBACK',
    source: 'MANUAL',
    r_multiple: -2.0,   // (470 - 480) / 5
    pnl_pct: -2.1,
    max_mfe: 0.2,
    max_mae: -2.2,
    plan_followed: false,
    exited_early: true,
    stopped_out: false,
    broke_rule: true,
    could_scale_better: false,
    edge_tag: 'C',
    lesson_learned: 'RSI 68 = för högt. Tog entry ändå (FOMO). Panikexitade innan stop. Dålig trade.',
    last_updated: '2025-12-14'
  },

  // 6. LITEN VINNARE - Time-based exit (B-kvalitet)
  {
    ticker: 'GOOGL',
    entry_date: '2025-12-15',
    exit_date: '2025-12-25',
    entry_price: 138.00,
    exit_price: 140.50,
    quantity: 70,
    initial_stop: 135.00,
    current_stop: 138.00,
    initial_target: 144.00,
    current_target: 144.00,
    initial_r: 3.00,
    entry_setup: 'Pullback',
    exit_status: 'EXITED',
    exit_type: 'TIME',
    trailing_type: 'EMA20',
    initial_ema20: 136.50,
    initial_ema50: 133.00,
    current_ema20: 136.50,
    current_ema50: 133.00,
    initial_rsi14: 49.0,
    risk_kr: 210,
    risk_pct: 1.5,
    rr_ratio: 2.0,
    entry_rationale: 'Perfekt pullback-setup vid EMA20. RSI 49.',
    watchlist_status: 'READY',
    source: 'WATCHLIST',
    r_multiple: 0.83,   // (140.50 - 138) / 3
    pnl_pct: 1.8,
    max_mfe: 1.2,
    max_mae: -0.5,
    plan_followed: true,
    exited_early: false,
    stopped_out: false,
    broke_rule: false,
    could_scale_better: false,
    edge_tag: 'B',
    lesson_learned: '10-dagars regel fungerade. Aktien rörde sig inte mot target så exitade enligt plan.',
    last_updated: '2025-12-25'
  },

  // 7. FÖRLUST - Men följde planen (B-kvalitet)
  {
    ticker: 'META',
    entry_date: '2025-12-18',
    exit_date: '2025-12-22',
    entry_price: 355.00,
    exit_price: 350.00,
    quantity: 25,
    initial_stop: 350.00,
    current_stop: 350.00,
    initial_target: 365.00,
    current_target: 365.00,
    initial_r: 5.00,
    entry_setup: 'Pullback',
    exit_status: 'EXITED',
    exit_type: 'STOP',
    trailing_type: 'ATR',
    initial_ema20: 352.00,
    initial_ema50: 348.00,
    current_ema20: 352.00,
    current_ema50: 348.00,
    initial_rsi14: 46.5,
    risk_kr: 125,
    risk_pct: 1.2,
    rr_ratio: 2.0,
    entry_rationale: 'Pullback i upptrend. Setup var korrekt.',
    watchlist_status: 'READY',
    source: 'WATCHLIST',
    r_multiple: -1.0,   // (350 - 355) / 5
    pnl_pct: -1.4,
    max_mfe: 0.3,
    max_mae: -1.0,
    plan_followed: true,
    exited_early: false,
    stopped_out: true,
    broke_rule: false,
    could_scale_better: false,
    edge_tag: 'B',
    lesson_learned: 'Setup var rätt men marknaden vände. Stop-loss gjorde sitt jobb.',
    last_updated: '2025-12-22'
  },

  // 8. VINNARE - Med partial exit (A-kvalitet)
  {
    ticker: 'AMZN',
    entry_date: '2025-12-20',
    exit_date: '2025-12-28',
    entry_price: 175.00,
    exit_price: 182.50,
    quantity: 60,
    initial_stop: 171.00,
    current_stop: 175.00,
    initial_target: 183.00,
    current_target: 183.00,
    initial_r: 4.00,
    entry_setup: 'Pullback',
    exit_status: 'EXITED',
    exit_type: 'PARTIAL_SCALE',
    trailing_type: 'EMA20',
    initial_ema20: 173.50,
    initial_ema50: 170.00,
    current_ema20: 173.50,
    current_ema50: 170.00,
    initial_rsi14: 51.0,
    risk_kr: 240,
    risk_pct: 1.6,
    rr_ratio: 2.0,
    entry_rationale: 'Klassisk pullback. RSI 51. Hög confidence.',
    watchlist_status: 'READY',
    source: 'WATCHLIST',
    r_multiple: 1.88,   // (182.50 - 175) / 4
    pnl_pct: 4.3,
    max_mfe: 2.2,
    max_mae: -0.3,
    plan_followed: true,
    exited_early: false,
    stopped_out: false,
    broke_rule: false,
    could_scale_better: true,
    edge_tag: 'A',
    lesson_learned: 'Del-exit vid +1.5R. Flyttade stop till BE. Låt resten löpa.',
    last_updated: '2025-12-28'
  }
];

async function insertTestData() {
  console.log('🚀 Lägger till testdata för avslutade affärer...\n');

  for (const position of testPositions) {
    console.log(`📊 Lägger till ${position.ticker}...`);

    const { data, error } = await supabase
      .from('portfolio')
      .insert([position])
      .select();

    if (error) {
      console.error(`❌ Fel för ${position.ticker}:`, error.message);
    } else {
      console.log(`✅ ${position.ticker} tillagd (${position.r_multiple > 0 ? '+' : ''}${position.r_multiple.toFixed(1)}R)`);
    }

    // Lägg till ENTRY-event för varje position
    const entryEvent = {
      ticker: position.ticker,
      event_date: position.entry_date,
      event_type: 'ENTRY',
      description: `Köpt ${position.quantity} aktier @ ${position.entry_price.toFixed(2)} kr`,
      created_at: new Date(position.entry_date).toISOString()
    };

    await supabase.from('portfolio_events').insert([entryEvent]);

    // Lägg till EXIT-event
    const exitEvent = {
      ticker: position.ticker,
      event_date: position.exit_date,
      event_type: 'EXIT',
      description: `Såld @ ${position.exit_price.toFixed(2)} kr (${position.exit_type})`,
      created_at: new Date(position.exit_date).toISOString()
    };

    await supabase.from('portfolio_events').insert([exitEvent]);
  }

  console.log('\n✅ Testdata tillagd!');
  console.log(`\n📊 Sammanfattning:`);
  console.log(`   - Totalt: ${testPositions.length} avslutade positioner`);
  console.log(`   - Vinnare: ${testPositions.filter(p => p.r_multiple > 0).length}`);
  console.log(`   - Förlorare: ${testPositions.filter(p => p.r_multiple <= 0).length}`);
  console.log(`   - A-kvalitet: ${testPositions.filter(p => p.edge_tag === 'A').length}`);
  console.log(`   - B-kvalitet: ${testPositions.filter(p => p.edge_tag === 'B').length}`);
  console.log(`   - C-kvalitet: ${testPositions.filter(p => p.edge_tag === 'C').length}`);
}

insertTestData().catch(console.error);
