/**
 * Screener Stock Item Management
 * DELETE /api/screener/stocks/:ticker - Remove stock
 * PATCH /api/screener/stocks/:ticker - Update stock (toggle active)
 */

import { supabase } from '../../../config/supabase.js';

export default async function handler(req, res) {
  const { method } = req;
  const ticker = req.query.ticker;

  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  // DELETE /api/screener/stocks/:ticker
  if (method === 'DELETE') {
    try {
      const { error } = await supabase
        .from('screener_stocks')
        .delete()
        .eq('ticker', ticker.toUpperCase());

      if (error) throw error;
      return res.json({ success: true });
    } catch (e) {
      console.error("Delete stock error:", e);
      return res.status(500).json({ error: "Failed to delete stock" });
    }
  }

  // PATCH /api/screener/stocks/:ticker - Update (toggle active)
  if (method === 'PATCH') {
    try {
      const { is_active } = req.body;

      const { data, error } = await supabase
        .from('screener_stocks')
        .update({ is_active })
        .eq('ticker', ticker.toUpperCase())
        .select()
        .single();

      if (error) throw error;
      return res.json({ stock: data });
    } catch (e) {
      console.error("Update stock error:", e);
      return res.status(500).json({ error: "Failed to update stock" });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: `Method ${method} not allowed` });
}
