/**
 * Watchlist Status Logic - Pure Functions
 *
 * Detta är kärnan i bevakningslistans beslutslogik.
 * Funktionerna är "pure" - de tar input och returnerar output utan sidoeffekter.
 */

/**
 * Klassificera RSI i zoner
 */
export function rsiZone(rsi) {
  if (rsi < 40) return "WEAK";
  if (rsi <= 55) return "CALM";
  if (rsi <= 65) return "WARM";
  return "HOT";
}

/**
 * Beräkna avstånd till EMA20 i procent
 */
export function ema20DistancePct(close, ema20) {
  return ((close - ema20) / ema20) * 100;
}

/**
 * Beräkna EMA50 slope (lutning)
 * @param {Array} ema50Series - Array av EMA50-värden (sista 5-10 dagar)
 */
export function calculateEma50Slope(ema50Series) {
  if (ema50Series.length < 2) return 0;

  const current = ema50Series[ema50Series.length - 1];
  const previous = ema50Series[ema50Series.length - 2];

  return ((current - previous) / previous);
}

/**
 * Detektera högre låg (higher low) - förenklad version
 * @param {Array} candles - Senaste 5-10 candles
 */
export function hasHigherLow(candles) {
  if (candles.length < 3) return false;

  const recentCandles = candles.slice(-5);
  const lows = recentCandles.map(c => c.low);

  // Kolla om senaste lågen är högre än föregående
  const currentLow = lows[lows.length - 1];
  const prevLow = Math.min(...lows.slice(0, -1));

  return currentLow > prevLow;
}

/**
 * HUVUDFUNKTION: Uppdatera watchlist-status
 *
 * Input-struktur:
 * {
 *   ticker: "VOLV-B.ST",
 *   price: { close, high, low },
 *   indicators: { ema20, ema50, ema50_slope, rsi14 },
 *   volume: { relVol },
 *   structure: { higherLow },
 *   prevStatus: "APPROACHING",
 *   daysInWatchlist: 6
 * }
 */
export function updateWatchlistStatus(input) {
  const {
    price,
    indicators,
    volume,
    structure,
    prevStatus,
    daysInWatchlist
  } = input;

  const { close } = price;
  const { ema20, ema50, ema50_slope, rsi14 } = indicators;

  // ─────────────────────────
  // 1. TRENDENS HÄLSA (hård invalidering)
  // ─────────────────────────
  const trendOk =
    close > ema50 &&
    ema50_slope > 0 &&
    structure.higherLow === true;

  if (!trendOk) {
    return {
      status: "INVALIDATED",
      action: "REMOVE_FROM_WATCHLIST",
      reason: "Trend bruten (pris under EMA50 eller negativ slope eller lägre låg)",
      diagnostics: {
        distEma20Pct: ema20DistancePct(close, ema20).toFixed(2),
        rsiZone: rsiZone(rsi14),
        volumeState: volume.relVol > 1.5 ? "HIGH" : volume.relVol < 0.5 ? "LOW" : "NORMAL"
      },
      timeWarning: null
    };
  }

  // ─────────────────────────
  // 2. AVSTÅND TILL EMA20
  // ─────────────────────────
  const distEma20 = ema20DistancePct(close, ema20);

  let proximity;
  if (distEma20 > 4) proximity = "FAR";
  else if (distEma20 > 2) proximity = "APPROACHING";
  else if (distEma20 >= 0) proximity = "NEAR";
  else proximity = "TOO_DEEP";

  // ─────────────────────────
  // 3. MOMENTUM (lugnt?)
  // ─────────────────────────
  const momentum = rsiZone(rsi14);

  // ─────────────────────────
  // 4. VOLYM (kontekst)
  // ─────────────────────────
  const volumeState =
    volume.relVol > 1.5 ? "HIGH" :
    volume.relVol < 0.5 ? "LOW" :
    "NORMAL";

  // ─────────────────────────
  // 5. STATUSMASKIN
  // ─────────────────────────
  let status = "WAIT_PULLBACK";
  let action = "WAIT";
  let reason = "";

  if (proximity === "FAR") {
    status = "WAIT_PULLBACK";
    action = "WAIT";
    reason = "För långt från EMA20 (" + distEma20.toFixed(1) + "%)";
  }

  if (proximity === "APPROACHING") {
    status = "APPROACHING";
    action = "WAIT";
    reason = "Drar sig mot pullback (" + distEma20.toFixed(1) + "%)";
  }

  if (proximity === "NEAR" && momentum === "CALM") {
    status = "READY";
    action = "PREPARE_ENTRY";
    reason = "Pullback nära + lugnt momentum (RSI " + rsi14.toFixed(0) + ")";
  }

  if (momentum === "HOT") {
    status = "BREAKOUT_ONLY";
    action = "WAIT_OR_BREAKOUT";
    reason = "Momentum för starkt (RSI " + rsi14.toFixed(0) + ") - ingen pullback";
  }

  if (proximity === "TOO_DEEP" || momentum === "WEAK") {
    status = "WAIT_PULLBACK";
    action = "WAIT";
    reason = proximity === "TOO_DEEP"
      ? "Pullback för djup (under EMA20)"
      : "Momentum för svagt (RSI " + rsi14.toFixed(0) + ")";
  }

  // Special case: Om momentum är CALM och vi är NEAR, men volymen är extremt låg
  if (status === "READY" && volumeState === "LOW") {
    status = "APPROACHING";
    action = "WAIT";
    reason = "Pullback nära men låg volym - vänta på bekräftelse";
  }

  // ─────────────────────────
  // 6. TIDSBASERAD VARNING
  // ─────────────────────────
  let timeWarning = null;
  if (daysInWatchlist >= 10 && status !== "READY") {
    timeWarning = "Lång väntan (" + daysInWatchlist + " dagar) – överväg att rensa";
  }

  return {
    status,
    action,
    reason,
    diagnostics: {
      distEma20Pct: distEma20.toFixed(2),
      rsiZone: momentum,
      volumeState
    },
    timeWarning
  };
}

/**
 * Hjälpfunktion: Bygg input-objekt från candles och indicators
 */
export function buildWatchlistInput(ticker, candles, indicators, prevStatus = null, addedAt = null) {
  const lastCandle = candles[candles.length - 1];
  const ema50Series = indicators.ema50.slice(-5).filter(v => v !== null);

  const daysInWatchlist = addedAt
    ? Math.floor((new Date() - new Date(addedAt)) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    ticker,
    price: {
      close: lastCandle.close,
      high: lastCandle.high,
      low: lastCandle.low
    },
    indicators: {
      ema20: indicators.ema20[indicators.ema20.length - 1],
      ema50: indicators.ema50[indicators.ema50.length - 1],
      ema50_slope: calculateEma50Slope(ema50Series),
      rsi14: indicators.rsi14[indicators.rsi14.length - 1]
    },
    volume: {
      relVol: indicators.relativeVolume
    },
    structure: {
      higherLow: hasHigherLow(candles.slice(-10))
    },
    prevStatus,
    daysInWatchlist
  };
}
