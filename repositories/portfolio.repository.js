/**
 * Portfolio Repository
 *
 * Data access layer for portfolio operations.
 * All database queries for the portfolio table go here.
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
 * Get all active positions (not exited)
 * @returns {Promise<Array>}
 */
export async function findAllActive() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('portfolio')
    .select('*')
    .or('exit_status.is.null,exit_status.neq.EXITED')
    .order('entry_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get all closed positions (exited)
 * @returns {Promise<Array>}
 */
export async function findAllClosed() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('portfolio')
    .select('*')
    .eq('exit_status', 'EXITED')
    .order('exit_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Find a position by ticker
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object|null>}
 */
export async function findByTicker(ticker) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('portfolio')
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
 * Check if a position exists
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<boolean>}
 */
export async function exists(ticker) {
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('portfolio')
    .select('ticker')
    .eq('ticker', ticker)
    .or('exit_status.is.null,exit_status.neq.EXITED')
    .maybeSingle();

  return !error && data !== null;
}

/**
 * Create a new position
 * @param {Object} position - Position data
 * @returns {Promise<Object>}
 */
export async function create(position) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('portfolio')
    .insert(position)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a position
 * @param {string} ticker - Stock ticker symbol
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>}
 */
export async function update(ticker, updates) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('portfolio')
    .update(updates)
    .eq('ticker', ticker)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a specific field for a position
 * @param {string} ticker - Stock ticker symbol
 * @param {string} field - Field name to update
 * @param {any} value - New value
 * @returns {Promise<Object>}
 */
export async function updateField(ticker, field, value) {
  if (!supabase) throw new Error('Database not configured');

  const updates = { [field]: value };

  const { data, error } = await supabase
    .from('portfolio')
    .update(updates)
    .eq('ticker', ticker)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update evaluation fields for a closed position
 * @param {string} ticker - Stock ticker symbol
 * @param {Object} evaluation - Evaluation data
 * @returns {Promise<Object>}
 */
export async function updateEvaluation(ticker, evaluation) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('portfolio')
    .update(evaluation)
    .eq('ticker', ticker)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Exit a position (full or partial)
 * @param {string} ticker - Stock ticker symbol
 * @param {Object} exitData - Exit data (exit_price, exit_date, exit_type, etc.)
 * @returns {Promise<Object>}
 */
export async function exitPosition(ticker, exitData) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('portfolio')
    .update(exitData)
    .eq('ticker', ticker)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a position
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<void>}
 */
export async function remove(ticker) {
  if (!supabase) throw new Error('Database not configured');

  const { error } = await supabase
    .from('portfolio')
    .delete()
    .eq('ticker', ticker);

  if (error) throw error;
}

/**
 * Update notes for a position
 * @param {string} ticker - Stock ticker symbol
 * @param {string} notes - Notes text
 * @returns {Promise<Object>}
 */
export async function updateNotes(ticker, notes) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('portfolio')
    .update({ notes })
    .eq('ticker', ticker)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Move stop for a position
 * @param {string} ticker - Stock ticker symbol
 * @param {number} newStop - New stop price
 * @returns {Promise<Object>}
 */
export async function moveStop(ticker, newStop) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('portfolio')
    .update({ current_stop: newStop })
    .eq('ticker', ticker)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get portfolio statistics
 * @returns {Promise<Object>}
 */
export async function getStatistics() {
  if (!supabase) return null;

  // Get all closed positions for statistics
  const { data, error } = await supabase
    .from('portfolio')
    .select('r_multiple, pnl_pct, entry_date, exit_date')
    .eq('exit_status', 'EXITED');

  if (error) throw error;

  return {
    totalTrades: data.length,
    winningTrades: data.filter(t => t.r_multiple > 0).length,
    losingTrades: data.filter(t => t.r_multiple <= 0).length,
    totalRMultiple: data.reduce((sum, t) => sum + (t.r_multiple || 0), 0),
    averageRMultiple: data.length > 0
      ? data.reduce((sum, t) => sum + (t.r_multiple || 0), 0) / data.length
      : 0
  };
}
