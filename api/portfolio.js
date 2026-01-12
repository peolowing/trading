/**
 * Portfolio API endpoint
 * Handles GET, POST, DELETE for portfolio positions
 */

import { supabase } from '../config/supabase.js';

export default async function handler(req, res) {
  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // GET /api/portfolio - Fetch all portfolio positions
  if (method === 'GET') {
    if (!supabase) {
      return res.json({ stocks: [] });
    }

    try {
      const { data, error } = await supabase
        .from('portfolio')
        .select('*')
        .order('added_at', { ascending: false });

      if (error) throw error;
      return res.json({ stocks: data || [] });
    } catch (e) {
      console.error("Get portfolio error:", e);
      return res.status(500).json({ error: "Failed to fetch portfolio" });
    }
  }

  // POST /api/portfolio - Add new portfolio position
  if (method === 'POST') {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured" });
    }

    try {
      // Accept data from EntryModal (new format with snake_case)
      const insertData = {
        ticker: req.body.ticker?.toUpperCase(),
        entry_date: req.body.entry_date,
        entry_price: req.body.entry_price,
        quantity: req.body.quantity,
        initial_stop: req.body.initial_stop,
        initial_target: req.body.initial_target,
        initial_r: req.body.initial_r,
        initial_ema20: req.body.initial_ema20,
        initial_ema50: req.body.initial_ema50,
        initial_rsi14: req.body.initial_rsi14,
        entry_setup: req.body.entry_setup,
        entry_rationale: req.body.entry_rationale,
        current_price: req.body.current_price,
        current_stop: req.body.current_stop,
        current_target: req.body.current_target,
        current_ema20: req.body.current_ema20,
        current_ema50: req.body.current_ema50,
        current_status: req.body.current_status || 'HOLD',
        trailing_type: req.body.trailing_type || 'EMA20',
        source: req.body.source,
        risk_kr: req.body.risk_kr,
        risk_pct: req.body.risk_pct,
        rr_ratio: req.body.rr_ratio,
        edge_score: req.body.edge_score,
        snapshot_ema20: req.body.snapshot_ema20,
        snapshot_ema50: req.body.snapshot_ema50,
        snapshot_rsi14: req.body.snapshot_rsi14,
        snapshot_rsi_zone: req.body.snapshot_rsi_zone,
        snapshot_volume_rel: req.body.snapshot_volume_rel,
        snapshot_trend_health: req.body.snapshot_trend_health,
        watchlist_status: req.body.watchlist_status,
        watchlist_reason: req.body.watchlist_reason,
        days_in_watchlist: req.body.days_in_watchlist
      };

      const { data, error } = await supabase
        .from('portfolio')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: "Already in portfolio" });
        }
        throw error;
      }

      return res.status(201).json({ stock: data });
    } catch (e) {
      console.error("Add to portfolio error:", e);
      return res.status(500).json({ error: "Failed to add to portfolio" });
    }
  }

  // DELETE /api/portfolio/:ticker - Remove portfolio position
  if (method === 'DELETE') {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured" });
    }

    try {
      // Extract ticker from pathname
      const ticker = pathname.split('/').pop();

      if (!ticker || ticker === 'portfolio') {
        return res.status(400).json({ error: "Ticker is required" });
      }

      const { error } = await supabase
        .from('portfolio')
        .delete()
        .eq('ticker', ticker.toUpperCase());

      if (error) throw error;
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error("Delete from portfolio error:", e);
      return res.status(500).json({ error: "Failed to remove from portfolio" });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: `Method ${method} not allowed` });
}
