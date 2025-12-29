/**
 * Screener Repository
 *
 * Data access layer for screener_stocks operations.
 * All database queries for the screener_stocks table go here.
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
 * Get all active screener stocks
 * @returns {Promise<Array>}
 */
export async function findAllActive() {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('screener_stocks')
      .select('ticker, bucket')
      .eq('is_active', true);

    if (error) {
      console.error("screener_stocks query error:", error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error("findAllActive error:", e);
    return [];
  }
}

/**
 * Get all screener stocks (active and inactive)
 * @returns {Promise<Array>}
 */
export async function findAll() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('screener_stocks')
    .select('*')
    .order('ticker', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Find a screener stock by ticker
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object|null>}
 */
export async function findByTicker(ticker) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('screener_stocks')
    .select('*')
    .eq('ticker', ticker)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data;
}

/**
 * Add a stock to screener
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object>}
 */
export async function create(ticker) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('screener_stocks')
    .insert({ ticker, is_active: true })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Toggle stock active status
 * @param {string} ticker - Stock ticker symbol
 * @param {boolean} isActive - New active status
 * @returns {Promise<Object>}
 */
export async function setActive(ticker, isActive) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('screener_stocks')
    .update({ is_active: isActive })
    .eq('ticker', ticker)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove a stock from screener
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<void>}
 */
export async function remove(ticker) {
  if (!supabase) throw new Error('Database not configured');

  const { error } = await supabase
    .from('screener_stocks')
    .delete()
    .eq('ticker', ticker);

  if (error) throw error;
}

/**
 * Bulk insert screener stocks
 * @param {Array<string>} tickers - Array of ticker symbols
 * @returns {Promise<Array>}
 */
export async function createBatch(tickers) {
  if (!supabase) throw new Error('Database not configured');

  const records = tickers.map(ticker => ({ ticker, is_active: true }));

  const { data, error } = await supabase
    .from('screener_stocks')
    .insert(records)
    .select();

  if (error) throw error;
  return data || [];
}

/**
 * Get count of active stocks
 * @returns {Promise<number>}
 */
export async function countActive() {
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from('screener_stocks')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  if (error) throw error;
  return count || 0;
}
