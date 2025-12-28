/**
 * Watchlist Repository
 *
 * Data access layer for watchlist operations.
 * All database queries for the watchlist table go here.
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
 * Get all watchlist stocks
 * @param {Object} filters - Optional filters
 * @param {string} filters.status - Filter by status
 * @returns {Promise<Array>}
 */
export async function findAll(filters = {}) {
  if (!supabase) return [];

  let query = supabase
    .from('watchlist')
    .select('*')
    .order('ticker', { ascending: true });

  // Apply status filter if provided
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Find a watchlist stock by ticker
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object|null>}
 */
export async function findByTicker(ticker) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('watchlist')
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
 * Check if a stock exists in watchlist
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<boolean>}
 */
export async function exists(ticker) {
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('watchlist')
    .select('ticker')
    .eq('ticker', ticker)
    .maybeSingle();

  return !error && data !== null;
}

/**
 * Add a stock to watchlist
 * @param {Object} stock - Stock data
 * @returns {Promise<Object>}
 */
export async function create(stock) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('watchlist')
    .insert(stock)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a watchlist stock
 * @param {string} ticker - Stock ticker symbol
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>}
 */
export async function update(ticker, updates) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('watchlist')
    .update(updates)
    .eq('ticker', ticker)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update multiple watchlist stocks in batch
 * @param {Array<{ticker: string, updates: Object}>} updates - Array of ticker and updates
 * @returns {Promise<Array>}
 */
export async function updateBatch(updates) {
  if (!supabase) throw new Error('Database not configured');

  // Supabase doesn't support batch updates easily, so we'll do them sequentially
  const results = [];

  for (const { ticker, updates: updateData } of updates) {
    const result = await update(ticker, updateData);
    results.push(result);
  }

  return results;
}

/**
 * Delete a stock from watchlist
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<void>}
 */
export async function remove(ticker) {
  if (!supabase) throw new Error('Database not configured');

  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('ticker', ticker);

  if (error) throw error;
}

/**
 * Get watchlist stocks by status
 * @param {string} status - Watchlist status
 * @returns {Promise<Array>}
 */
export async function findByStatus(status) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .eq('status', status)
    .order('ticker', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get ready-to-enter watchlist stocks
 * @returns {Promise<Array>}
 */
export async function findReady() {
  return findByStatus('READY');
}

/**
 * Get all active watchlist stocks (not archived)
 * @returns {Promise<Array>}
 */
export async function findActive() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .neq('status', 'ARCHIVED')
    .order('ticker', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Clear entire watchlist
 * @returns {Promise<void>}
 */
export async function clear() {
  if (!supabase) throw new Error('Database not configured');

  const { error } = await supabase
    .from('watchlist')
    .delete()
    .neq('ticker', ''); // Delete all rows

  if (error) throw error;
}
