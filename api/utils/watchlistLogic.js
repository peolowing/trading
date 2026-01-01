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
 * FAS 1 FIX #2: Beräkna EMA50 slope (lutning) över 5 dagar
 * Mindre bruskänslig än 1-dags slope
 * @param {Array} ema50Series - Array av EMA50-värden (minst 6 dagar)
 */
export function calculateEma50Slope(ema50Series) {
  if (ema50Series.length < 6) return 0;

  const current = ema50Series[ema50Series.length - 1];
  const previous5 = ema50Series[ema50Series.length - 6];

  return ((current - previous5) / previous5);
}

/**
 * FAS 1 FIX #2: Beräkna EMA20 slope (lutning) över 5 dagar
 * Mindre bruskänslig än 1-dags slope
 * @param {Array} ema20Series - Array av EMA20-värden (minst 6 dagar)
 */
export function calculateEma20Slope(ema20Series) {
  if (ema20Series.length < 6) return 0;

  const current = ema20Series[ema20Series.length - 1];
  const previous5 = ema20Series[ema20Series.length - 6];

  return ((current - previous5) / previous5);
}

/**
 * FAS 1 FIX #1: Beräkna confidence-adjusted edge score
 * Minskar edge_score vid låg sample size för att undvika överoptimism
 * @param {number} edge_score - Raw edge score från backtest
 * @param {number} totalTrades - Antal trades i backtestet
 * @returns {number} Justerad edge score
 */
export function adjustedEdgeScore(edge_score, totalTrades) {
  if (!edge_score || !totalTrades) return 0;

  // Confidence factor: sqrt(min(totalTrades/50, 1))
  // Vid 50+ trades = full confidence (factor = 1.0)
  // Vid 25 trades = factor ≈ 0.71
  // Vid 10 trades = factor ≈ 0.45
  const confidenceFactor = Math.sqrt(Math.min(totalTrades / 50, 1));

  return edge_score * confidenceFactor;
}

/**
 * FAS 1 FIX #3: Kontrollera om aktien uppfyller likviditetskrav
 * @param {number} avgTurnover - Genomsnittlig dagsomsättning i SEK
 * @param {number} minTurnover - Minimum dagsomsättning (default 5M SEK)
 * @returns {boolean} true om likviditeten är OK
 */
export function hasAdequateLiquidity(avgTurnover, minTurnover = 5000000) {
  return avgTurnover >= minTurnover;
}

/**
 * FÖRBÄTTRING #4: Detektera högre låg (higher low) - sekvensbaserad
 * Kräver sekvens av stigande lows, inte bara senaste > min
 * @param {Array} candles - Senaste 5-10 candles
 */
export function hasHigherLow(candles) {
  if (candles.length < 5) return false;

  const recentLows = candles.slice(-5).map(c => c.low);

  // Kräv att de senaste 3 lowsen är stigande
  return recentLows[4] > recentLows[3] && recentLows[3] > recentLows[2];
}

/**
 * HUVUDFUNKTION: Uppdatera watchlist-status
 *
 * Input-struktur:
 * {
 *   ticker: "VOLV-B.ST",
 *   price: { close, high, low },
 *   indicators: { ema20, ema50, ema20_slope, ema50_slope, rsi14 },
 *   volume: { relVol, avgTurnover },
 *   structure: { higherLow },
 *   edge_score: 75,
 *   totalTrades: 45,
 *   prevStatus: "APPROACHING",
 *   lastInvalidatedDate: "2025-01-01",
 *   daysInWatchlist: 6
 * }
 */
export function updateWatchlistStatus(input) {
  const {
    price,
    indicators,
    volume,
    structure,
    edge_score,
    totalTrades,
    prevStatus,
    lastInvalidatedDate,
    daysInWatchlist
  } = input;

  const { close } = price;
  const { ema20, ema50, ema20_slope, ema50_slope, rsi14 } = indicators;

  // ─────────────────────────
  // FAS 1 FIX #3: LIKVIDITETSFILTER (hård invalidering)
  // ─────────────────────────
  if (volume.avgTurnover !== undefined && !hasAdequateLiquidity(volume.avgTurnover)) {
    return {
      status: "INVALIDATED",
      action: "REMOVE_FROM_WATCHLIST",
      reason: "Otillräcklig likviditet (kräver genomsnittlig omsättning ≥5M SEK, aktuell: " + (volume.avgTurnover / 1000000).toFixed(1) + "M SEK)",
      lastInvalidatedDate: new Date().toISOString().split('T')[0],
      diagnostics: {
        distEma20Pct: ema20DistancePct(close, ema20).toFixed(2),
        rsiZone: rsiZone(rsi14),
        volumeState: volume.relVol > 1.5 ? "HIGH" : volume.relVol < 0.5 ? "LOW" : "NORMAL"
      },
      timeWarning: null
    };
  }

  // ─────────────────────────
  // 1. TRENDENS HÄLSA (hård invalidering)
  // ─────────────────────────
  // KRITISK FÖRBÄTTRING #3: Kräv pris > EMA20 > EMA50 och positiv EMA20-slope
  const trendOk =
    close > ema20 &&
    ema20 > ema50 &&
    ema50_slope > 0 &&
    ema20_slope > 0 &&
    structure.higherLow === true;

  if (!trendOk) {
    return {
      status: "INVALIDATED",
      action: "REMOVE_FROM_WATCHLIST",
      reason: "Trend bruten (kräver pris > EMA20 > EMA50, positiva slopes och högre låg)",
      lastInvalidatedDate: new Date().toISOString().split('T')[0], // FÖRBÄTTRING #5: Spara invaliderings-datum
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

  // FÖRBÄTTRING #6: PERFECT-zon för sweet spot 0-1%
  let proximity;
  if (distEma20 > 4) proximity = "FAR";
  else if (distEma20 > 2) proximity = "APPROACHING";
  else if (distEma20 > 1) proximity = "NEAR";
  else if (distEma20 >= 0) proximity = "PERFECT";  // Sweet spot 0-1%
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

  // FÖRBÄTTRING #6: PERFECT-zon ger högsta prioritet
  if (proximity === "PERFECT" && momentum === "CALM") {
    if (volume.relVol >= 1.0) {
      status = "READY";
      action = "PREPARE_ENTRY";
      reason = "🎯 OPTIMAL: Perfect pullback (0-1%) + lugnt momentum + volym OK (RSI " + rsi14.toFixed(0) + ", vol " + volume.relVol.toFixed(2) + "x)";
    } else {
      status = "APPROACHING";
      action = "WAIT";
      reason = "Perfect pullback men för låg volym (" + volume.relVol.toFixed(2) + "x, kräver ≥1.0x)";
    }
  }

  // KRITISK FÖRBÄTTRING #2: Kräv relVol > 1.0 för READY (NEAR-zon 1-2%)
  if (proximity === "NEAR" && momentum === "CALM") {
    if (volume.relVol >= 1.0) {
      status = "READY";
      action = "PREPARE_ENTRY";
      reason = "Pullback nära + lugnt momentum + volym OK (RSI " + rsi14.toFixed(0) + ", vol " + volume.relVol.toFixed(2) + "x)";
    } else {
      status = "APPROACHING";
      action = "WAIT";
      reason = "Pullback nära men för låg volym (" + volume.relVol.toFixed(2) + "x, kräver ≥1.0x)";
    }
  }

  // FÖRBÄTTRING #7: BREAKOUT_READY med konkreta krav
  if (momentum === "HOT") {
    if (close > ema20 && volume.relVol >= 1.2) {
      status = "BREAKOUT_READY";
      action = "PREPARE_BREAKOUT_ENTRY";
      reason = "Breakout setup: Pris > EMA20 + HOT momentum (RSI " + rsi14.toFixed(0) + ") + hög volym (" + volume.relVol.toFixed(2) + "x)";
    } else {
      status = "BREAKOUT_ONLY";
      action = "WAIT_FOR_CONFIRMATION";
      reason = "Momentum för starkt (RSI " + rsi14.toFixed(0) + ") - vänta på breakout med volym ≥1.2x";
    }
  }

  if (proximity === "TOO_DEEP" || momentum === "WEAK") {
    status = "WAIT_PULLBACK";
    action = "WAIT";
    reason = proximity === "TOO_DEEP"
      ? "Pullback för djup (under EMA20)"
      : "Momentum för svagt (RSI " + rsi14.toFixed(0) + ")";
  }

  // FAS 1 FIX #1: ROBUSTHET EDGE-FILTER
  // Kräv minTrades ≥ 30 OCH använd confidence-adjusted edge score
  if (status === "READY" || status === "BREAKOUT_READY") {
    // Kräv minst 30 trades i backtestet
    if (totalTrades !== undefined && totalTrades < 30) {
      status = "APPROACHING";
      action = "WAIT";
      reason = "Tekniskt setup OK men för få backtest-trades (" + totalTrades + " st, kräver ≥30 för tillförlitlighet)";
    }
    // Använd confidence-adjusted edge score
    else if (edge_score !== undefined && totalTrades !== undefined) {
      const adjEdge = adjustedEdgeScore(edge_score, totalTrades);
      if (adjEdge < 70) {
        status = "APPROACHING";
        action = "WAIT";
        reason = "Tekniskt setup OK men edge för svag (justerad edge: " + adjEdge.toFixed(0) + "%, raw: " + edge_score.toFixed(0) + "%, " + totalTrades + " trades, kräver ≥70%)";
      }
    }
    // Fallback: gammal logik om totalTrades saknas
    else if (edge_score !== undefined && edge_score < 70) {
      status = "APPROACHING";
      action = "WAIT";
      reason = "Tekniskt setup OK men edge för svag (" + edge_score.toFixed(0) + "%, kräver ≥70%)";
    }
  }

  // FÖRBÄTTRING #5: Cooldown efter INVALIDATED - kräv 3 dagar för READY, 1 dag för BREAKOUT
  const daysSinceInvalidation = lastInvalidatedDate
    ? Math.floor((new Date() - new Date(lastInvalidatedDate)) / (1000 * 60 * 60 * 24))
    : 999;

  if ((status === "READY" || status === "BREAKOUT_READY") && daysSinceInvalidation < 3) {
    const requiredDays = (status === "BREAKOUT_READY") ? 1 : 3;
    if (daysSinceInvalidation < requiredDays) {
      status = "APPROACHING";
      action = "WAIT";
      reason = "För tidigt efter invalidering (" + daysSinceInvalidation + " dagar sedan, kräver " + requiredDays + " dagar)";
    }
  }

  // ─────────────────────────
  // 6. TIDSBASERAD HANTERING
  // ─────────────────────────
  let timeWarning = null;

  // FÖRBÄTTRING #9: Auto-remove efter 15 dagar
  if (daysInWatchlist >= 15 && status !== "READY" && status !== "BREAKOUT_READY") {
    return {
      status: "EXPIRED",
      action: "REMOVE_FROM_WATCHLIST",
      reason: "För lång väntan utan setup (" + daysInWatchlist + " dagar) - automatiskt borttagen",
      diagnostics: {
        distEma20Pct: distEma20.toFixed(2),
        rsiZone: momentum,
        volumeState
      },
      timeWarning: null
    };
  }

  if (daysInWatchlist >= 10 && status !== "READY" && status !== "BREAKOUT_READY") {
    timeWarning = "Lång väntan (" + daysInWatchlist + " dagar) – överväg att rensa (auto-remove vid 15 dagar)";
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
 * FAS 1: Uppdaterad för att stödja 5-dagars slope och nya filter
 */
export function buildWatchlistInput(ticker, candles, indicators, prevStatus = null, addedAt = null, edge_score = undefined, lastInvalidatedDate = null, totalTrades = undefined, avgTurnover = undefined) {
  const lastCandle = candles[candles.length - 1];

  // FAS 1 FIX #2: Behöver 6 dagar för 5-dagars slope
  const ema50Series = indicators.ema50.slice(-6).filter(v => v !== null);
  const ema20Series = indicators.ema20.slice(-6).filter(v => v !== null);

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
      ema20_slope: calculateEma20Slope(ema20Series),
      ema50_slope: calculateEma50Slope(ema50Series),
      rsi14: indicators.rsi14[indicators.rsi14.length - 1]
    },
    volume: {
      relVol: indicators.relativeVolume,
      avgTurnover: avgTurnover  // FAS 1 FIX #3: Likviditetsdata
    },
    structure: {
      higherLow: hasHigherLow(candles.slice(-10))
    },
    edge_score,
    totalTrades,  // FAS 1 FIX #1: Sample size för confidence adjustment
    prevStatus,
    lastInvalidatedDate,
    daysInWatchlist
  };
}
