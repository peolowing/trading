/**
 * Portfolio Events Repository
 *
 * Data access layer for portfolio_events operations.
 * All database queries for the portfolio_events table go here.
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
 * Get all events for a specific ticker
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Array>}
 */
export async function findByTicker(ticker) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('portfolio_events')
    .select('*')
    .eq('ticker', ticker)
    .order('event_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get all events across all tickers
 * @returns {Promise<Array>}
 */
export async function findAll() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('portfolio_events')
    .select('*')
    .order('event_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get recent events (limited)
 * @param {number} limit - Number of events to return
 * @returns {Promise<Array>}
 */
export async function findRecent(limit = 50) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('portfolio_events')
    .select('*')
    .order('event_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Create a new event
 * @param {Object} event - Event data
 * @returns {Promise<Object>}
 */
export async function create(event) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('portfolio_events')
    .insert(event)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create multiple events in batch
 * @param {Array<Object>} events - Array of event data
 * @returns {Promise<Array>}
 */
export async function createBatch(events) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('portfolio_events')
    .insert(events)
    .select();

  if (error) throw error;
  return data || [];
}

/**
 * Delete all events for a ticker
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<void>}
 */
export async function removeByTicker(ticker) {
  if (!supabase) throw new Error('Database not configured');

  const { error } = await supabase
    .from('portfolio_events')
    .delete()
    .eq('ticker', ticker);

  if (error) throw error;
}

/**
 * Delete a specific event by ID
 * @param {number} eventId - Event ID
 * @returns {Promise<void>}
 */
export async function remove(eventId) {
  if (!supabase) throw new Error('Database not configured');

  const { error } = await supabase
    .from('portfolio_events')
    .delete()
    .eq('id', eventId);

  if (error) throw error;
}

/**
 * Get events by type for a ticker
 * @param {string} ticker - Stock ticker symbol
 * @param {string} eventType - Event type (ENTRY, EXIT, STOP_MOVED, etc.)
 * @returns {Promise<Array>}
 */
export async function findByTickerAndType(ticker, eventType) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('portfolio_events')
    .select('*')
    .eq('ticker', ticker)
    .eq('event_type', eventType)
    .order('event_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get latest event for a ticker
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object|null>}
 */
export async function findLatestByTicker(ticker) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('portfolio_events')
    .select('*')
    .eq('ticker', ticker)
    .order('event_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data;
}
