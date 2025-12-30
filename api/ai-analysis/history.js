/**
 * AI Analysis History endpoint
 * GET /api/ai-analysis/history/:ticker
 */

import { aiAnalysisRepo } from '../../repositories/index.js';

export default async function handler(req, res) {
  try {
    // Extract ticker from URL path
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ticker = url.pathname.split('/').pop();

    const analyses = await aiAnalysisRepo.getRecentAnalyses(ticker, 3);

    let comparison = null;
    if (analyses.length >= 2) {
      comparison = aiAnalysisRepo.compareAnalyses(analyses[0], analyses[1]);
    }

    return res.json({
      analyses,
      comparison,
      count: analyses.length
    });
  } catch (error) {
    console.error("Error in /api/ai-analysis/history:", error);
    return res.status(500).json({ error: error.message });
  }
}
