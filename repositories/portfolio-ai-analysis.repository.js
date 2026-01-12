/**
 * Portfolio AI Analysis Repository
 * Manages storage and retrieval of AI analyses for portfolio positions
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const hasSupabase = supabaseUrl && supabaseKey && supabaseUrl !== "your-supabase-url-here";

const supabase = hasSupabase
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export function hasDatabase() {
  return supabase !== null;
}

/**
 * Save AI analysis for a position
 * @param {string} ticker - Stock ticker
 * @param {object} analysisData - Analysis data (analysis text, metrics, etc.)
 * @returns {Promise<object>}
 */
export async function saveAnalysis(ticker, analysisData) {
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('portfolio_ai_analysis')
    .insert({
      ticker: ticker.toUpperCase(),
      analysis: analysisData.analysis,
      metrics: analysisData.metrics,
      timestamp: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get recent analyses for a ticker
 * @param {string} ticker - Stock ticker
 * @param {number} limit - Number of analyses to retrieve (default 3)
 * @returns {Promise<Array>}
 */
export async function getRecentAnalyses(ticker, limit = 3) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('portfolio_ai_analysis')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Get analysis count for a ticker
 * @param {string} ticker - Stock ticker
 * @returns {Promise<number>}
 */
export async function getAnalysisCount(ticker) {
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from('portfolio_ai_analysis')
    .select('*', { count: 'exact', head: true })
    .eq('ticker', ticker.toUpperCase());

  if (error) throw error;
  return count || 0;
}

/**
 * Delete old analyses, keeping only the most recent N
 * @param {string} ticker - Stock ticker
 * @param {number} keepCount - Number of analyses to keep (default 10)
 * @returns {Promise<void>}
 */
export async function pruneOldAnalyses(ticker, keepCount = 10) {
  if (!supabase) return;

  // Get IDs of analyses to keep
  const { data: toKeep } = await supabase
    .from('portfolio_ai_analysis')
    .select('id')
    .eq('ticker', ticker.toUpperCase())
    .order('timestamp', { ascending: false })
    .limit(keepCount);

  if (!toKeep || toKeep.length === 0) return;

  const keepIds = toKeep.map(a => a.id);

  // Delete analyses not in keep list
  const { error } = await supabase
    .from('portfolio_ai_analysis')
    .delete()
    .eq('ticker', ticker.toUpperCase())
    .not('id', 'in', `(${keepIds.join(',')})`);

  if (error) console.error('Failed to prune old analyses:', error);
}
