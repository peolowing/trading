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
 * FAS 2 FIX #4: Detektera pivot lows (swing lows)
 * En pivot low är en low som är lägre än 2 candles före och 2 candles efter
 * @param {Array} candles - Array av candles
 * @param {number} lookback - Antal candles för pivot-detektion (default 2)
 * @returns {Array} Array av pivot low-objekt med index och värde
 */
export function findPivotLows(candles, lookback = 2) {
  const pivots = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const currentLow = candles[i].low;
    let isPivot = true;

    // Kontrollera att current är lägre än alla inom lookback-fönstret
    for (let j = 1; j <= lookback; j++) {
      if (currentLow >= candles[i - j].low || currentLow >= candles[i + j].low) {
        isPivot = false;
        break;
      }
    }

    if (isPivot) {
      pivots.push({ index: i, value: currentLow });
    }
  }

  return pivots;
}

/**
 * FAS 2 FIX #4: Förbättrad higher-low detection baserad på pivot lows
 * Kräver att senaste pivot low är högre än föregående pivot low
 * @param {Array} candles - Senaste 10-20 candles
 * @returns {boolean} true om strukturen visar högre lows
 */
export function hasHigherLow(candles) {
  if (candles.length < 10) return false;

  const pivots = findPivotLows(candles);

  // Behöver minst 2 pivot lows för att jämföra
  if (pivots.length < 2) return false;

  // Jämför senaste två pivot lows
  const latestPivot = pivots[pivots.length - 1];
  const previousPivot = pivots[pivots.length - 2];

  return latestPivot.value > previousPivot.value;
}

/**
 * FAS 2 FIX #5: Hitta 20-dagars high
 * @param {Array} candles - Senaste 20+ candles
 * @returns {number} Högsta high senaste 20 dagarna
 */
export function calculate20DayHigh(candles) {
  if (candles.length < 20) return null;

  const recent20 = candles.slice(-20);
  return Math.max(...recent20.map(c => c.high));
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
 *   structure: { higherLow, high20D },
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
  // 1. TRENDENS HÄLSA (hård invalidering + RECLAIM)
  // ─────────────────────────
  const distEma20 = ema20DistancePct(close, ema20);

  // FAS 2 FIX #6: RECLAIM-branch - tillåt kort dip under EMA20
  const inReclaimZone = distEma20 >= -1.0 && distEma20 < 0;  // -1% till 0% under EMA20

  // Huvudtrendkrav (för både normal och reclaim)
  const baseTrendOk =
    ema20 > ema50 &&
    ema50_slope > 0 &&
    ema20_slope > 0 &&
    structure.higherLow === true;

  // Full trend OK (för normala READY-setups)
  const trendOk = close > ema20 && baseTrendOk;

  // Om INTE i reclaim-zon och INTE trend OK => invaliderad
  if (!trendOk && !inReclaimZone) {
    return {
      status: "INVALIDATED",
      action: "REMOVE_FROM_WATCHLIST",
      reason: "Trend bruten (kräver pris > EMA20 > EMA50, positiva slopes och högre låg)",
      lastInvalidatedDate: new Date().toISOString().split('T')[0],
      diagnostics: {
        distEma20Pct: distEma20.toFixed(2),
        rsiZone: rsiZone(rsi14),
        volumeState: volume.relVol > 1.5 ? "HIGH" : volume.relVol < 0.5 ? "LOW" : "NORMAL"
      },
      timeWarning: null
    };
  }

  // Om i reclaim-zon men baseTrend ej OK => invaliderad (trenden är för svag även för reclaim)
  if (inReclaimZone && !baseTrendOk) {
    return {
      status: "INVALIDATED",
      action: "REMOVE_FROM_WATCHLIST",
      reason: "Trend för svag för reclaim (kräver EMA20 > EMA50 + positiva slopes + högre låg)",
      lastInvalidatedDate: new Date().toISOString().split('T')[0],
      diagnostics: {
        distEma20Pct: distEma20.toFixed(2),
        rsiZone: rsiZone(rsi14),
        volumeState: volume.relVol > 1.5 ? "HIGH" : volume.relVol < 0.5 ? "LOW" : "NORMAL"
      },
      timeWarning: null
    };
  }

  // ─────────────────────────
  // 2. AVSTÅND TILL EMA20
  // ─────────────────────────
  // distEma20 redan beräknad i trendfilter ovan

  // FAS 2 FIX #6: Uppdaterad proximity med RECLAIM-zon
  let proximity;
  if (distEma20 > 4) proximity = "FAR";
  else if (distEma20 > 2) proximity = "APPROACHING";
  else if (distEma20 > 1) proximity = "NEAR";
  else if (distEma20 >= 0) proximity = "PERFECT";  // Sweet spot 0-1%
  else if (distEma20 >= -1.0) proximity = "RECLAIM";  // -1% till 0% under EMA20
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

  // FAS 2 FIX #6: RECLAIM-status - väntar på reclaim över EMA20
  if (proximity === "RECLAIM" && momentum === "CALM") {
    if (volume.relVol >= 1.0) {
      status = "WATCH_RECLAIM";
      action = "WAIT_FOR_RECLAIM";
      reason = "🔄 RECLAIM-zon: Dippat under EMA20 (" + distEma20.toFixed(1) + "%), väntar på reclaim över EMA20 med volym (" + volume.relVol.toFixed(2) + "x)";
    } else {
      status = "APPROACHING";
      action = "WAIT";
      reason = "Under EMA20 men för låg volym för reclaim (" + volume.relVol.toFixed(2) + "x, kräver ≥1.0x)";
    }
  }

  // FAS 2 FIX #5: BREAKOUT_READY med nivåkrav (pris > 20D high)
  if (momentum === "HOT") {
    const high20D = structure.high20D;
    const aboveBreakoutLevel = high20D ? close > high20D : close > ema20;

    if (aboveBreakoutLevel && volume.relVol >= 1.2) {
      status = "BREAKOUT_READY";
      action = "PREPARE_BREAKOUT_ENTRY";
      const levelText = high20D ? "20D high (" + high20D.toFixed(2) + ")" : "EMA20";
      reason = "🚀 Breakout setup: Pris > " + levelText + " + HOT momentum (RSI " + rsi14.toFixed(0) + ") + hög volym (" + volume.relVol.toFixed(2) + "x)";
    } else {
      status = "BREAKOUT_ONLY";
      action = "WAIT_FOR_CONFIRMATION";
      const levelText = high20D ? "20D high (" + high20D.toFixed(2) + ")" : "EMA20";
      reason = "Momentum för starkt (RSI " + rsi14.toFixed(0) + ") - vänta på breakout över " + levelText + " med volym ≥1.2x";
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
 * FAS 1+2: Uppdaterad för 5-dagars slope, nya filter och pivot-baserad struktur
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
      higherLow: hasHigherLow(candles.slice(-20)),  // FAS 2 FIX #4: Pivot-baserad, behöver mer data
      high20D: calculate20DayHigh(candles)  // FAS 2 FIX #5: 20-dagars high för breakout-nivå
    },
    edge_score,
    totalTrades,  // FAS 1 FIX #1: Sample size för confidence adjustment
    prevStatus,
    lastInvalidatedDate,
    daysInWatchlist
  };
}
