/**
 * Trades API endpoint
 * Handles GET, POST, PUT, DELETE for trade journal
 */

import { supabase } from '../config/supabase.js';

export default async function handler(req, res) {
  const { method } = req;

  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  // GET /api/trades - Fetch all trades
  if (method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      return res.json({ trades: data || [] });
    } catch (e) {
      console.error("Get trades error:", e);
      return res.status(500).json({ error: "Failed to fetch trades" });
    }
  }

  // POST /api/trades - Create new trade
  if (method === 'POST') {
    try {
      const trade = req.body;
      const { data, error } = await supabase
        .from('trades')
        .insert([trade])
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ trade: data });
    } catch (e) {
      console.error("Create trade error:", e);
      return res.status(500).json({ error: "Failed to create trade" });
    }
  }

  // PUT /api/trades/:id - Update existing trade
  if (method === 'PUT') {
    try {
      // Extract id from query params or URL
      const id = req.query.id || req.url.split('/').pop();
      const trade = req.body;

      const { data, error } = await supabase
        .from('trades')
        .update(trade)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.json({ trade: data });
    } catch (e) {
      console.error("Update trade error:", e);
      return res.status(500).json({ error: "Failed to update trade" });
    }
  }

  // DELETE /api/trades/:id - Delete trade
  if (method === 'DELETE') {
    try {
      // Extract id from query params or URL
      const id = req.query.id || req.url.split('/').pop();

      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(204).send();
    } catch (e) {
      console.error("Delete trade error:", e);
      return res.status(500).json({ error: "Failed to delete trade" });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: `Method ${method} not allowed` });
}
