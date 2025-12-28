/**
 * Portfolio Management Logic - Exit Signals & Risk Control
 *
 * Detta är kärnan i förvaltningslistans beslutslogik.
 * Fokus: HOLD eller EXIT – inget annat.
 */

/**
 * Beräkna R-multiple (risk/reward)
 * @param {number} entryPrice - Entry-pris
 * @param {number} currentPrice - Nuvarande pris
 * @param {number} initialR - Initial risk per aktie (entry - initialStop)
 * @returns {number} R-multiple (ex: +1.6R = 1.6x initial risk i vinst)
 */
export function calculateRMultiple(entryPrice, currentPrice, initialR) {
  if (!initialR || initialR === 0) return 0;
  const pnl = currentPrice - entryPrice;
  return parseFloat((pnl / initialR).toFixed(2));
}

/**
 * Beräkna PnL i procent
 */
export function calculatePnLPct(entryPrice, currentPrice) {
  return parseFloat((((currentPrice - entryPrice) / entryPrice) * 100).toFixed(2));
}

/**
 * Beräkna trailing stop baserat på EMA20
 */
export function calculateTrailingStop(trailingType, currentPrice, ema20, ema50, higherLow, initialStop) {
  if (trailingType === 'EMA20') {
    // Om pris är över EMA20, använd EMA20 som trailing stop
    if (currentPrice > ema20) {
      return Math.max(ema20, initialStop); // Aldrig lägre än initial stop
    }
  }

  if (trailingType === 'HL') {
    // Higher Low trailing (behöver candles för att hitta senaste higher low)
    // För nu använder vi EMA20 som fallback
    return ema20;
  }

  // Default: behåll initial stop
  return initialStop;
}

/**
 * HUVUDFUNKTION: Uppdatera portfolio position status
 *
 * Input-struktur:
 * {
 *   ticker: "VOLV-B.ST",
 *   entry: { price, stop, target, r, date, ema20, ema50, rsi14, setup },
 *   current: { price, ema20, ema50, rsi14, relVol },
 *   trailingType: "EMA20" | "HL"
 * }
 *
 * Output:
 * {
 *   status: "HOLD" | "TIGHTEN_STOP" | "PARTIAL_EXIT" | "EXIT" | "STOP_HIT",
 *   signal: "beskrivning av varför",
 *   currentStop: 244.0,
 *   pnlPct: +3.1,
 *   rMultiple: +1.6,
 *   daysInTrade: 6
 * }
 */
export function updatePositionStatus(input) {
  const {
    entry,
    current,
    trailingType = 'EMA20'
  } = input;

  const { price: entryPrice, stop: initialStop, target: initialTarget, r: initialR, date: entryDate } = entry;
  const { price: currentPrice, ema20, ema50, rsi14, relVol } = current;

  // ─────────────────────────
  // 1. BERÄKNA METRICS
  // ─────────────────────────
  const pnlPct = calculatePnLPct(entryPrice, currentPrice);
  const rMultiple = calculateRMultiple(entryPrice, currentPrice, initialR);
  const currentStop = calculateTrailingStop(trailingType, currentPrice, ema20, ema50, null, initialStop);

  // Dagar i trade
  const daysInTrade = entryDate
    ? Math.floor((new Date() - new Date(entryDate)) / (1000 * 60 * 60 * 24))
    : 0;

  // ─────────────────────────
  // 2. EXIT-LOGIK (prioritetsordning)
  // ─────────────────────────

  // 🔴 STOP HIT
  if (currentPrice <= currentStop) {
    return {
      status: 'STOP_HIT',
      signal: `Stop träffad vid ${currentStop.toFixed(2)}`,
      currentStop,
      pnlPct,
      rMultiple,
      daysInTrade
    };
  }

  // 🔴 EMA20 BREAK (exit-signal)
  if (currentPrice < ema20) {
    return {
      status: 'EXIT',
      signal: 'Pris under EMA20 - momentum bruten',
      currentStop,
      pnlPct,
      rMultiple,
      daysInTrade
    };
  }

  // 🔴 RSI OVERBOUGHT (partial exit eller full exit)
  if (rsi14 >= 70) {
    // Om vi är i bra vinst (>+2R) och RSI är extrem → partial exit
    if (rMultiple >= 2.0) {
      return {
        status: 'PARTIAL_EXIT',
        signal: `RSI overbought (${rsi14.toFixed(0)}) + ${rMultiple.toFixed(1)}R vinst - skala ut 50%`,
        currentStop,
        pnlPct,
        rMultiple,
        daysInTrade
      };
    }

    // Om vi inte är i stor vinst men RSI är extrem → full exit
    return {
      status: 'EXIT',
      signal: `RSI overbought (${rsi14.toFixed(0)}) - sälj innan reversal`,
      currentStop,
      pnlPct,
      rMultiple,
      daysInTrade
    };
  }

  // 🟠 TIGHTEN STOP (när vi är i vinst)
  if (rMultiple >= 1.5 && currentPrice > ema20 * 1.05) {
    // Pris är 5% över EMA20 OCH vi är +1.5R i vinst
    // → Dags att skydda vinsten mer aggressivt
    return {
      status: 'TIGHTEN_STOP',
      signal: `${rMultiple.toFixed(1)}R vinst - flytta stop till break-even eller EMA20`,
      currentStop,
      pnlPct,
      rMultiple,
      daysInTrade
    };
  }

  // 🟢 DISTRIBUTION WARNING (hög volym på ned-dag)
  if (relVol > 2.0 && pnlPct < -2) {
    return {
      status: 'EXIT',
      signal: `Distribution-varning: Hög volym (${relVol.toFixed(1)}x) på nedgång`,
      currentStop,
      pnlPct,
      rMultiple,
      daysInTrade
    };
  }

  // 🟢 TIME EXIT (för lång tid utan rörelse)
  if (daysInTrade >= 30 && Math.abs(rMultiple) < 0.5) {
    return {
      status: 'EXIT',
      signal: `${daysInTrade} dagar utan rörelse (<0.5R) - frigör kapital`,
      currentStop,
      pnlPct,
      rMultiple,
      daysInTrade
    };
  }

  // 🟢 HOLD - Allt OK
  return {
    status: 'HOLD',
    signal: null,
    currentStop,
    pnlPct,
    rMultiple,
    daysInTrade
  };
}

/**
 * Hjälpfunktion: Bygg input-objekt från candles och indicators
 */
export function buildPositionInput(ticker, entryData, candles, indicators) {
  const lastCandle = candles[candles.length - 1];
  const ema20Current = indicators.ema20[indicators.ema20.length - 1];
  const ema50Current = indicators.ema50[indicators.ema50.length - 1];
  const rsi14Current = indicators.rsi14[indicators.rsi14.length - 1];

  return {
    ticker,
    entry: {
      price: entryData.entry_price,
      stop: entryData.initial_stop,
      target: entryData.initial_target,
      r: entryData.initial_r,
      date: entryData.entry_date,
      ema20: entryData.initial_ema20,
      ema50: entryData.initial_ema50,
      rsi14: entryData.initial_rsi14,
      setup: entryData.entry_setup
    },
    current: {
      price: lastCandle.close,
      ema20: ema20Current,
      ema50: ema50Current,
      rsi14: rsi14Current,
      relVol: indicators.relativeVolume || 1.0
    },
    trailingType: entryData.trailing_type || 'EMA20'
  };
}

/**
 * Beräkna initial R (risk per aktie)
 * Används när position läggs till
 */
export function calculateInitialR(entryPrice, stopPrice) {
  return parseFloat(Math.abs(entryPrice - stopPrice).toFixed(2));
}

/**
 * Föreslå initial stop baserat på ATR
 * @param {number} entryPrice
 * @param {number} atr14 - ATR(14) värde
 * @param {number} atrMultiplier - Vanligtvis 2.0 för swing trading
 */
export function suggestInitialStop(entryPrice, atr14, atrMultiplier = 2.0) {
  return parseFloat((entryPrice - (atr14 * atrMultiplier)).toFixed(2));
}

/**
 * Föreslå initial target baserat på risk/reward ratio
 * @param {number} entryPrice
 * @param {number} initialR - Risk per aktie
 * @param {number} rrRatio - Risk/Reward ratio (vanligtvis 2.0 eller 3.0)
 */
export function suggestInitialTarget(entryPrice, initialR, rrRatio = 2.0) {
  return parseFloat((entryPrice + (initialR * rrRatio)).toFixed(2));
}
