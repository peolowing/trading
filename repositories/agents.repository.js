/**
 * Trading Agents Repository
 *
 * Data access layer for trading_agents and agent_signals operations.
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

// ===== AGENTS =====

/**
 * Get all trading agents
 * @param {boolean} enabledOnly - Only return enabled agents
 * @returns {Promise<Array>}
 */
export async function findAllAgents(enabledOnly = false) {
  if (!supabase) return [];

  try {
    let query = supabase
      .from('trading_agents')
      .select('*')
      .order('created_at', { ascending: true });

    if (enabledOnly) {
      query = query.eq('enabled', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("trading_agents query error:", error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error("findAllAgents error:", e);
    return [];
  }
}

/**
 * Get agent by ID
 * @param {number} id - Agent ID
 * @returns {Promise<Object|null>}
 */
export async function findAgentById(id) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('trading_agents')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data;
}

/**
 * Create a new trading agent
 * @param {Object} agent - Agent data
 * @returns {Promise<Object>}
 */
export async function createAgent(agent) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('trading_agents')
    .insert({
      name: agent.name,
      type: agent.type,
      enabled: agent.enabled ?? true,
      criteria: agent.criteria
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update agent enabled status
 * @param {number} id - Agent ID
 * @param {boolean} enabled - New enabled status
 * @returns {Promise<Object>}
 */
export async function setAgentEnabled(id, enabled) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('trading_agents')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ===== SIGNALS =====

/**
 * Get signals for an agent
 * @param {number} agentId - Agent ID
 * @param {boolean} activeOnly - Only return active signals
 * @returns {Promise<Array>}
 */
export async function findSignalsByAgent(agentId, activeOnly = false) {
  if (!supabase) return [];

  try {
    let query = supabase
      .from('agent_signals')
      .select('*')
      .eq('agent_id', agentId)
      .order('signal_date', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("agent_signals query error:", error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error("findSignalsByAgent error:", e);
    return [];
  }
}

/**
 * Get all active signals across all agents
 * @returns {Promise<Array>}
 */
export async function findAllActiveSignals() {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('agent_signals')
      .select(`
        *,
        trading_agents (
          name,
          type
        )
      `)
      .eq('is_active', true)
      .order('signal_date', { ascending: false });

    if (error) {
      console.error("findAllActiveSignals error:", error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error("findAllActiveSignals error:", e);
    return [];
  }
}

/**
 * Create a new signal
 * @param {Object} signal - Signal data
 * @returns {Promise<Object>}
 */
export async function createSignal(signal) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('agent_signals')
    .insert({
      agent_id: signal.agent_id,
      ticker: signal.ticker,
      signal_date: signal.signal_date,
      setup_data: signal.setup_data,
      is_active: signal.is_active ?? true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Deactivate a signal
 * @param {number} id - Signal ID
 * @returns {Promise<Object>}
 */
export async function deactivateSignal(id) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('agent_signals')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Deactivate all signals for a ticker
 * @param {string} ticker - Stock ticker
 * @returns {Promise<void>}
 */
export async function deactivateSignalsByTicker(ticker) {
  if (!supabase) throw new Error('Database not configured');

  const { error } = await supabase
    .from('agent_signals')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('ticker', ticker);

  if (error) throw error;
}

/**
 * Check if a signal already exists for today
 * @param {number} agentId - Agent ID
 * @param {string} ticker - Stock ticker
 * @param {string} date - Signal date (YYYY-MM-DD)
 * @returns {Promise<boolean>}
 */
export async function signalExists(agentId, ticker, date) {
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('agent_signals')
    .select('id')
    .eq('agent_id', agentId)
    .eq('ticker', ticker)
    .eq('signal_date', date)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error("signalExists error:", error);
    return false;
  }

  return data !== null;
}
