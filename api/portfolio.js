/**
 * Portfolio API endpoint
 * Handles GET, POST, DELETE for portfolio positions
 */

import { supabase } from '../config/supabase.js';

export default async function handler(req, res) {
  const { method } = req;

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
      const {
        ticker,
        entryPrice,
        quantity,
        stopLoss,
        target,
        positionSize,
        riskAmount,
        notes,
        setup,
        checkboxes
      } = req.body;

      // Build the insert object with all fields
      const insertData = {
        ticker: ticker.toUpperCase(),
        entry_price: entryPrice,
        quantity: quantity || 0,
        stop_loss: stopLoss,
        target: target,
        position_size: positionSize,
        risk_amount: riskAmount,
        notes: notes,
        setup: setup,
        trend_is_up: checkboxes?.trend_is_up || false,
        follows_setup: checkboxes?.follows_setup || false,
        stop_defined: checkboxes?.stop_defined || false,
        rr_adequate: checkboxes?.rr_adequate || false,
        no_rules_broken: checkboxes?.no_rules_broken || false
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
      // Extract ticker from query params (Vercel uses query for path params)
      const ticker = req.query.ticker || req.url.split('/').pop();

      const { error } = await supabase
        .from('portfolio')
        .delete()
        .eq('ticker', ticker.toUpperCase());

      if (error) throw error;
      return res.json({ success: true });
    } catch (e) {
      console.error("Delete from portfolio error:", e);
      return res.status(500).json({ error: "Failed to remove from portfolio" });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: `Method ${method} not allowed` });
}
