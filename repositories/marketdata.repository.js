/**
 * Market Data Repository
 *
 * Data access layer for market_data operations.
 * All database queries for the market_data table go here.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const hasSupabase = supabaseUrl && supabaseKey && supabaseUrl !== "your-supabase-url-here";

const supabase = hasSupabase
  ? createClient(supabaseUrl, supabaseKey)
  : null;

/**
 * Check if Supabase is configured
 * @returns {boolean}
 */
export function hasDatabase() {
  return supabase !== null;
}

/**
 * Get market data for a ticker from a specific start date
 * @param {string} ticker - Stock ticker symbol
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @returns {Promise<Array>}
 */
export async function findByTickerFromDate(ticker, startDate) {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('market_data')
      .select('*')
      .eq('ticker', ticker)
      .gte('date', startDate)
      .order('date', { ascending: true });

    if (error) {
      console.error("market_data query error:", error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error("findByTickerFromDate error:", e);
    return [];
  }
}

/**
 * Get all market data for a ticker
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Array>}
 */
export async function findByTicker(ticker) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('market_data')
    .select('*')
    .eq('ticker', ticker)
    .order('date', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Save market data candles for a ticker
 * @param {string} ticker - Stock ticker symbol
 * @param {Array<Object>} candles - Array of candle data
 * @returns {Promise<void>}
 */
export async function saveCandles(ticker, candles) {
  if (!supabase) return;

  try {
    const records = candles.map(c => ({
      ticker,
      date: c.date,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    }));

    const { error } = await supabase
      .from('market_data')
      .upsert(records, {
        onConflict: 'ticker,date'
      });

    if (error) {
      console.error("saveCandles error:", error);
      throw error;
    }
  } catch (e) {
    console.error("saveCandles exception:", e);
    throw e;
  }
}

/**
 * Delete market data for a ticker
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<void>}
 */
export async function removeByTicker(ticker) {
  if (!supabase) throw new Error('Database not configured');

  const { error } = await supabase
    .from('market_data')
    .delete()
    .eq('ticker', ticker);

  if (error) throw error;
}

/**
 * Get latest date for a ticker
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<string|null>}
 */
export async function findLatestDate(ticker) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('market_data')
    .select('date')
    .eq('ticker', ticker)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.date;
}

/**
 * Check if market data exists for a ticker on a specific date
 * @param {string} ticker - Stock ticker symbol
 * @param {string} date - Date to check (YYYY-MM-DD)
 * @returns {Promise<boolean>}
 */
export async function existsForDate(ticker, date) {
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('market_data')
    .select('ticker')
    .eq('ticker', ticker)
    .eq('date', date)
    .maybeSingle();

  return !error && data !== null;
}
