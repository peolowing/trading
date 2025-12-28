/**
 * Backtest Repository
 *
 * Data access layer for backtest_results operations.
 * All database queries for the backtest_results table go here.
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
 * Get backtest results for a specific ticker, date, and strategy
 * @param {string} ticker - Stock ticker symbol
 * @param {string} date - Analysis date (YYYY-MM-DD)
 * @param {string} strategy - Strategy name
 * @returns {Promise<Object|null>}
 */
export async function findByTickerDateStrategy(ticker, date, strategy) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('backtest_results')
      .select('*')
      .eq('ticker', ticker)
      .eq('analysis_date', date)
      .eq('strategy', strategy)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  } catch (e) {
    console.error("findByTickerDateStrategy error:", e);
    return null;
  }
}

/**
 * Get all backtest results for a ticker
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Array>}
 */
export async function findByTicker(ticker) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('backtest_results')
    .select('*')
    .eq('ticker', ticker)
    .order('analysis_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Save or update backtest results
 * @param {string} ticker - Stock ticker symbol
 * @param {string} date - Analysis date (YYYY-MM-DD)
 * @param {Object} results - Backtest results data
 * @returns {Promise<Object>}
 */
export async function upsert(ticker, date, results) {
  if (!supabase) throw new Error('Database not configured');

  try {
    const { data, error } = await supabase
      .from('backtest_results')
      .upsert({
        ticker,
        analysis_date: date,
        ...results
      }, {
        onConflict: 'ticker,analysis_date,strategy'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (e) {
    console.error("upsert backtest error:", e);
    throw e;
  }
}

/**
 * Delete backtest results for a ticker
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<void>}
 */
export async function removeByTicker(ticker) {
  if (!supabase) throw new Error('Database not configured');

  const { error } = await supabase
    .from('backtest_results')
    .delete()
    .eq('ticker', ticker);

  if (error) throw error;
}

/**
 * Get recent backtest results (across all tickers)
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>}
 */
export async function findRecent(limit = 50) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('backtest_results')
    .select('*')
    .order('analysis_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
