/**
 * Live Screener API - Uses Yahoo Finance v3 for real-time data
 * This is the new version that fetches live data instead of reading from cache
 */

import YahooFinanceClass from 'yahoo-finance2';
import dayjs from 'dayjs';
import { supabase } from '../config/supabase.js';

// Initialize Yahoo Finance v3
const yahooFinance = new YahooFinanceClass({
  queue: { timeout: 60000 },
  suppressNotices: ['yahooSurvey', 'ripHistorical']
});

// Technical indicators - simplified versions
function calculateEMA(data, period) {
  if (!data || data.length < period) return null;
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;

  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateATR(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null;

  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trs.push(tr);
  }

  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

// Determine market regime
function determineRegime(ema20, ema50, rsi) {
  if (ema20 > ema50 && rsi > 50) return "Bullish Trend";
  if (ema20 < ema50 && rsi < 50) return "Bearish Trend";
  if (Math.abs(ema20 - ema50) / ema50 < 0.02) return "Consolidation";
  return "Transition";
}

// Determine setup
function determineSetup(regime, rsi, relativeVolume) {
  if (regime === "Bullish Trend" && rsi < 70) return "Trend Following";
  if (regime === "Consolidation" && relativeVolume > 1.2) return "Near Breakout";
  if (rsi > 70) return "Overbought";
  if (rsi < 30) return "Oversold";
  return "No Setup";
}

// Calculate edge score
function calculateEdgeScore(regime, setup, rsi, relativeVolume, atr, price) {
  let score = 50;

  // Regime contribution
  if (regime === "Bullish Trend") score += 15;
  else if (regime === "Consolidation") score += 10;
  else if (regime === "Bearish Trend") score -= 10;

  // Setup contribution
  if (setup === "Trend Following") score += 20;
  else if (setup === "Near Breakout") score += 15;
  else if (setup === "Oversold") score += 10;

  // RSI contribution
  if (rsi > 40 && rsi < 70) score += 10;
  else if (rsi > 70 || rsi < 30) score -= 15;

  // Volume contribution
  if (relativeVolume > 1.5) score += 10;
  else if (relativeVolume < 0.5) score -= 10;

  // Volatility contribution
  const atrPercent = (atr / price) * 100;
  if (atrPercent > 1 && atrPercent < 4) score += 5;
  else if (atrPercent > 6) score -= 10;

  return Math.min(100, Math.max(0, Math.round(score)));
}

export default async function handler(req, res) {
  const { method } = req;

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get stock list from Supabase
    if (!supabase) {
      return res.json({ stocks: [] });
    }

    const { data: dbStocks, error: dbError } = await supabase
      .from('screener_stocks')
      .select('ticker, bucket')
      .eq('is_active', true);

    if (dbError) throw dbError;
    if (!dbStocks || dbStocks.length === 0) {
      return res.json({ stocks: [] });
    }

    console.log(`Processing ${dbStocks.length} stocks...`);

    // Process stocks sequentially to avoid rate limiting
    const results = [];
    const startDate = dayjs().subtract(1, 'year').toDate();

    for (let i = 0; i < dbStocks.length; i++) {
      const { ticker, bucket } = dbStocks[i];

      // Add delay between requests (except first one)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      try {
        console.log(`[${i + 1}/${dbStocks.length}] Fetching ${ticker}...`);

        // Fetch historical data
        const result = await yahooFinance.chart(ticker, {
          period1: startDate,
          period2: new Date(),
          interval: '1d'
        });

        const candles = result?.quotes || [];
        if (candles.length < 50) {
          console.log(`Skipping ${ticker}: insufficient data (${candles.length} candles)`);
          continue;
        }

        // Get last 250 candles for calculations
        const recentCandles = candles.slice(-250);
        const closes = recentCandles.map(c => c.close);
        const volumes = recentCandles.map(c => c.volume);

        // Calculate indicators
        const lastClose = closes[closes.length - 1];
        const lastVolume = volumes[volumes.length - 1];
        const ema20 = calculateEMA(closes, 20);
        const ema50 = calculateEMA(closes, 50);
        const rsi = calculateRSI(closes);
        const atr = calculateATR(recentCandles);

        // Calculate average volume (last 20 days)
        const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const relativeVolume = lastVolume / avgVolume;

        // Calculate turnover in MSEK
        const turnoverMSEK = (lastClose * lastVolume) / 1000000;

        // Determine regime and setup
        const regime = determineRegime(ema20, ema50, rsi);
        const setup = determineSetup(regime, rsi, relativeVolume);
        const edgeScore = calculateEdgeScore(regime, setup, rsi, relativeVolume, atr, lastClose);

        results.push({
          ticker,
          price: lastClose,
          volume: lastVolume,
          turnoverMSEK: parseFloat(turnoverMSEK.toFixed(1)),
          ema20,
          ema50,
          rsi: parseFloat(rsi.toFixed(2)),
          atr: parseFloat(atr.toFixed(2)),
          relativeVolume: parseFloat(relativeVolume.toFixed(2)),
          regime,
          setup,
          edgeScore,
          bucket: bucket || 'UNKNOWN',
          lastCalculated: new Date().toISOString()
        });

      } catch (error) {
        console.error(`Error processing ${ticker}:`, error.message);
      }
    }

    // Sort by edge score (desc)
    results.sort((a, b) => b.edgeScore - a.edgeScore);

    console.log(`Screener complete: ${results.length}/${dbStocks.length} stocks processed`);

    return res.json({
      stocks: results,
      lastUpdate: new Date().toISOString(),
      totalProcessed: results.length,
      totalRequested: dbStocks.length
    });

  } catch (error) {
    console.error('Screener error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
