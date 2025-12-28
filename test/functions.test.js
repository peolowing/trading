import { describe, it, expect, beforeEach } from 'vitest';
import { updateWatchlistStatus, buildWatchlistInput } from '../lib/watchlistLogic.js';

describe('Watchlist Logic Tests', () => {
  describe('updateWatchlistStatus', () => {
    it('should return WAIT_PULLBACK when price is far above EMA20', () => {
      const input = {
        ticker: 'TEST.ST',
        price: { close: 110, high: 111, low: 109 },
        indicators: {
          ema20: 100,
          ema50: 95,
          ema50_slope: 0.002,
          rsi14: 55
        },
        volume: { relVol: 1.0 },
        structure: { higherLow: true },
        prevStatus: null,
        daysInWatchlist: 0
      };

      const result = updateWatchlistStatus(input);

      expect(result.status).toBe('WAIT_PULLBACK');
      expect(result.action).toBe('WAIT');
      expect(parseFloat(result.diagnostics.distEma20Pct)).toBeGreaterThan(5);
    });

    it('should return READY when conditions are perfect for entry', () => {
      const input = {
        ticker: 'TEST.ST',
        price: { close: 101, high: 102, low: 100 },
        indicators: {
          ema20: 100,
          ema50: 95,
          ema50_slope: 0.002,
          rsi14: 45
        },
        volume: { relVol: 0.8 },
        structure: { higherLow: true },
        prevStatus: null,
        daysInWatchlist: 0
      };

      const result = updateWatchlistStatus(input);

      expect(result.status).toBe('READY');
      expect(result.action).toBe('PREPARE_ENTRY');
      expect(result.diagnostics.rsiZone).toBe('CALM');
    });

    it('should return APPROACHING when price is moving toward EMA20', () => {
      const input = {
        ticker: 'TEST.ST',
        price: { close: 103, high: 104, low: 102 },
        indicators: {
          ema20: 100,
          ema50: 95,
          ema50_slope: 0.002,
          rsi14: 52
        },
        volume: { relVol: 1.0 },
        structure: { higherLow: true },
        prevStatus: null,
        daysInWatchlist: 0
      };

      const result = updateWatchlistStatus(input);

      expect(result.status).toBe('APPROACHING');
      expect(parseFloat(result.diagnostics.distEma20Pct)).toBeGreaterThan(0);
      expect(parseFloat(result.diagnostics.distEma20Pct)).toBeLessThan(5);
    });

    it('should return BREAKOUT_ONLY when RSI is too hot for pullback', () => {
      const input = {
        ticker: 'TEST.ST',
        price: { close: 110, high: 111, low: 109 },
        indicators: {
          ema20: 100,
          ema50: 95,
          ema50_slope: 0.002,
          rsi14: 68
        },
        volume: { relVol: 1.5 },
        structure: { higherLow: true },
        prevStatus: null,
        daysInWatchlist: 0
      };

      const result = updateWatchlistStatus(input);

      expect(result.status).toBe('BREAKOUT_ONLY');
      expect(result.diagnostics.rsiZone).toBe('HOT');
    });

    it('should return INVALIDATED when trend is broken', () => {
      const input = {
        ticker: 'TEST.ST',
        price: { close: 90, high: 91, low: 89 },
        indicators: {
          ema20: 100,
          ema50: 95,
          ema50_slope: -0.001,
          rsi14: 35
        },
        volume: { relVol: 1.0 },
        structure: { higherLow: false },
        prevStatus: null,
        daysInWatchlist: 0
      };

      const result = updateWatchlistStatus(input);

      expect(result.status).toBe('INVALIDATED');
      expect(result.action).toBe('REMOVE_FROM_WATCHLIST');
    });

    it('should include time warning after 10 days without READY status', () => {
      const input = {
        ticker: 'TEST.ST',
        price: { close: 110, high: 111, low: 109 },
        indicators: {
          ema20: 100,
          ema50: 95,
          ema50_slope: 0.002,
          rsi14: 55
        },
        volume: { relVol: 1.0 },
        structure: { higherLow: true },
        prevStatus: 'WAIT_PULLBACK',
        daysInWatchlist: 12
      };

      const result = updateWatchlistStatus(input);

      expect(result.timeWarning).toBeTruthy();
      expect(result.timeWarning).toContain('12 dagar');
    });
  });

  describe('buildWatchlistInput', () => {
    const mockCandles = [
      { date: '2024-01-01', close: 90, high: 92, low: 88, volume: 1000000 },
      { date: '2024-01-02', close: 95, high: 96, low: 94, volume: 1200000 },
      { date: '2024-01-03', close: 100, high: 101, low: 99, volume: 1100000 }
    ];

    const mockIndicators = {
      ema20: [null, null, 95],
      ema50: [null, null, 90],
      rsi14: [null, null, 50],
      relativeVolume: 1.1
    };

    it('should build valid input object from candles and indicators', () => {
      const result = buildWatchlistInput(
        'TEST.ST',
        mockCandles,
        mockIndicators,
        null,
        '2024-01-01'
      );

      expect(result.ticker).toBe('TEST.ST');
      expect(result.price.close).toBe(100);
      expect(result.indicators.ema20).toBe(95);
      expect(result.indicators.ema50).toBe(90);
      expect(result.indicators.rsi14).toBe(50);
      expect(result.volume.relVol).toBe(1.1);
    });

    it('should calculate days in watchlist correctly', () => {
      const addedDate = new Date();
      addedDate.setDate(addedDate.getDate() - 5); // 5 days ago

      const result = buildWatchlistInput(
        'TEST.ST',
        mockCandles,
        mockIndicators,
        null,
        addedDate.toISOString()
      );

      expect(result.daysInWatchlist).toBe(5);
    });

    it('should detect higher low structure', () => {
      const result = buildWatchlistInput(
        'TEST.ST',
        mockCandles,
        mockIndicators,
        null,
        '2024-01-01'
      );

      expect(result.structure.higherLow).toBe(true);
    });
  });
});

describe('Strategy Detection Tests', () => {
  function detectStrategy(indicators) {
    const { ema20, ema50, rsi14, relativeVolume, regime, close } = indicators;

    if (!ema20 || !ema50 || !rsi14) return "Hold";

    const priceAboveEMA20 = close > ema20;
    const priceAboveEMA50 = close > ema50;
    const ema20AboveEMA50 = ema20 > ema50;

    if (regime === "Bullish Trend" && priceAboveEMA50 && !priceAboveEMA20 && rsi14 < 50) {
      return "Pullback";
    }

    if (regime === "Consolidation" && relativeVolume > 1.5 && close > ema20) {
      return "Breakout";
    }

    if (regime === "Bearish Trend" && rsi14 < 30 && relativeVolume > 1.3) {
      return "Reversal";
    }

    if (regime === "Bullish Trend" && priceAboveEMA20 && ema20AboveEMA50 && rsi14 > 50 && rsi14 < 70) {
      return "Trend Following";
    }

    return "Hold";
  }

  it('should detect Pullback strategy', () => {
    const indicators = {
      ema20: 100,
      ema50: 95,
      rsi14: 45,
      relativeVolume: 1.0,
      regime: "Bullish Trend",
      close: 98
    };

    const strategy = detectStrategy(indicators);
    expect(strategy).toBe("Pullback");
  });

  it('should detect Breakout strategy', () => {
    const indicators = {
      ema20: 100,
      ema50: 98,
      rsi14: 55,
      relativeVolume: 1.8,
      regime: "Consolidation",
      close: 105
    };

    const strategy = detectStrategy(indicators);
    expect(strategy).toBe("Breakout");
  });

  it('should detect Reversal strategy', () => {
    const indicators = {
      ema20: 100,
      ema50: 105,
      rsi14: 28,
      relativeVolume: 1.5,
      regime: "Bearish Trend",
      close: 95
    };

    const strategy = detectStrategy(indicators);
    expect(strategy).toBe("Reversal");
  });

  it('should detect Trend Following strategy', () => {
    const indicators = {
      ema20: 100,
      ema50: 95,
      rsi14: 60,
      relativeVolume: 1.2,
      regime: "Bullish Trend",
      close: 105
    };

    const strategy = detectStrategy(indicators);
    expect(strategy).toBe("Trend Following");
  });

  it('should return Hold when no strategy matches', () => {
    const indicators = {
      ema20: 100,
      ema50: 100,
      rsi14: 50,
      relativeVolume: 0.9,
      regime: "Consolidation",
      close: 100
    };

    const strategy = detectStrategy(indicators);
    expect(strategy).toBe("Hold");
  });
});

describe('Edge Score Calculation Tests', () => {
  function calculateEdgeScore(regime, rsi14, relativeVolume, setup) {
    let edgeScore = 5;

    if (regime === "Bullish Trend") edgeScore += 2;
    else if (regime === "Bearish Trend") edgeScore -= 2;

    if (rsi14 >= 40 && rsi14 <= 60) edgeScore += 1;
    if (rsi14 < 30 || rsi14 > 70) edgeScore -= 1;

    if (relativeVolume > 1.5) edgeScore += 1;
    if (relativeVolume < 0.8) edgeScore -= 0.5;

    if (setup !== "Hold") edgeScore += 0.5;

    return Math.max(0, Math.min(10, Math.round(edgeScore * 10) / 10));
  }

  it('should give high score to strong bullish setup', () => {
    const score = calculateEdgeScore("Bullish Trend", 50, 1.6, "Pullback");
    expect(score).toBeGreaterThanOrEqual(8);
  });

  it('should give low score to bearish trend', () => {
    const score = calculateEdgeScore("Bearish Trend", 35, 0.7, "Hold");
    expect(score).toBeLessThanOrEqual(3);
  });

  it('should cap score at 10', () => {
    const score = calculateEdgeScore("Bullish Trend", 50, 2.0, "Pullback");
    expect(score).toBeLessThanOrEqual(10);
  });

  it('should floor score at 0', () => {
    const score = calculateEdgeScore("Bearish Trend", 75, 0.5, "Hold");
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('should give neutral score for neutral conditions', () => {
    const score = calculateEdgeScore("Consolidation", 50, 1.0, "Hold");
    expect(score).toBeGreaterThanOrEqual(4);
    expect(score).toBeLessThanOrEqual(6);
  });
});

describe('RSI Zone Classification Tests', () => {
  function getRsiZone(rsi14) {
    if (rsi14 < 40) return "WEAK";
    if (rsi14 <= 55) return "CALM";
    if (rsi14 <= 65) return "WARM";
    return "HOT";
  }

  it('should classify low RSI as WEAK', () => {
    expect(getRsiZone(25)).toBe("WEAK");
    expect(getRsiZone(39)).toBe("WEAK");
  });

  it('should classify pullback zone as CALM', () => {
    expect(getRsiZone(40)).toBe("CALM");
    expect(getRsiZone(45)).toBe("CALM");
    expect(getRsiZone(55)).toBe("CALM");
  });

  it('should classify continuation zone as WARM', () => {
    expect(getRsiZone(56)).toBe("WARM");
    expect(getRsiZone(60)).toBe("WARM");
    expect(getRsiZone(65)).toBe("WARM");
  });

  it('should classify overbought zone as HOT', () => {
    expect(getRsiZone(66)).toBe("HOT");
    expect(getRsiZone(75)).toBe("HOT");
    expect(getRsiZone(85)).toBe("HOT");
  });
});

describe('Volume State Classification Tests', () => {
  function getVolumeState(relativeVolume) {
    if (relativeVolume < 0.5) return "LOW";
    if (relativeVolume <= 1.5) return "NORMAL";
    return "HIGH";
  }

  it('should classify low volume', () => {
    expect(getVolumeState(0.3)).toBe("LOW");
    expect(getVolumeState(0.49)).toBe("LOW");
  });

  it('should classify normal volume', () => {
    expect(getVolumeState(0.5)).toBe("NORMAL");
    expect(getVolumeState(1.0)).toBe("NORMAL");
    expect(getVolumeState(1.5)).toBe("NORMAL");
  });

  it('should classify high volume', () => {
    expect(getVolumeState(1.51)).toBe("HIGH");
    expect(getVolumeState(1.8)).toBe("HIGH");
    expect(getVolumeState(2.5)).toBe("HIGH");
  });
});
