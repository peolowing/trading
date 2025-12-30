/**
 * AI Analysis Repository
 * Handles storage and retrieval of AI analysis history
 */

import { supabase } from '../config/supabase.js';

/**
 * Save a new AI analysis (keeps up to 3 most recent per ticker+date)
 */
export async function saveAnalysis(ticker, analysisData) {
  if (!supabase) {
    console.warn('Supabase not configured, skipping AI analysis save');
    return null;
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    // Insert new analysis
    const { data, error } = await supabase
      .from('ai_analysis')
      .insert({
        ticker,
        analysis_date: today,
        analysis_text: analysisData.analysis_text,
        edge_score: analysisData.edge_score,
        edge_label: analysisData.edge_label,
        win_rate: analysisData.win_rate,
        total_return: analysisData.total_return,
        trades_count: analysisData.trades_count
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving AI analysis:', error);
      return null;
    }

    // Clean up old analyses (keep only 3 most recent per ticker+date)
    await cleanupOldAnalyses(ticker, today);

    return data;
  } catch (e) {
    console.error('saveAnalysis error:', e);
    return null;
  }
}

/**
 * Get the N most recent analyses for a ticker on a specific date
 */
export async function getRecentAnalyses(ticker, date, limit = 3) {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('ai_analysis')
      .select('*')
      .eq('ticker', ticker)
      .eq('analysis_date', date)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching AI analyses:', error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error('getRecentAnalyses error:', e);
    return [];
  }
}

/**
 * Get the most recent analysis for a ticker on a specific date
 */
export async function getLatestAnalysis(ticker, date) {
  const analyses = await getRecentAnalyses(ticker, date, 1);
  return analyses[0] || null;
}

/**
 * Clean up old analyses, keeping only the 3 most recent
 */
async function cleanupOldAnalyses(ticker, date) {
  if (!supabase) return;

  try {
    // Get all analyses for this ticker+date
    const { data: allAnalyses, error: fetchError } = await supabase
      .from('ai_analysis')
      .select('id, created_at')
      .eq('ticker', ticker)
      .eq('analysis_date', date)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching analyses for cleanup:', fetchError);
      return;
    }

    // If more than 3, delete the oldest ones
    if (allAnalyses && allAnalyses.length > 3) {
      const toDelete = allAnalyses.slice(3).map(a => a.id);

      const { error: deleteError } = await supabase
        .from('ai_analysis')
        .delete()
        .in('id', toDelete);

      if (deleteError) {
        console.error('Error deleting old analyses:', deleteError);
      } else {
        console.log(`Cleaned up ${toDelete.length} old AI analyses for ${ticker}`);
      }
    }
  } catch (e) {
    console.error('cleanupOldAnalyses error:', e);
  }
}

/**
 * Compare two analyses and return differences
 */
export function compareAnalyses(latest, previous) {
  if (!latest || !previous) return null;

  const diff = {
    hasChanges: false,
    edgeScore: null,
    recommendation: null,
    sections: []
  };

  // Compare edge score
  if (latest.edge_score !== previous.edge_score) {
    diff.hasChanges = true;
    diff.edgeScore = {
      old: previous.edge_score,
      new: latest.edge_score,
      change: latest.edge_score - previous.edge_score
    };
  }

  // Extract and compare sections from analysis text
  const sections = [
    'MARKNADSLÄGE',
    'TEKNISKA SIGNALER',
    'STRATEGI & RESONEMANG',
    'HANDELSBESLUT',
    'RISK & POSITIONSSTORLEK',
    'BACKTEST-INSIKTER',
    'SAMMANFATTNING'
  ];

  sections.forEach(sectionName => {
    const latestSection = extractSection(latest.analysis_text, sectionName);
    const previousSection = extractSection(previous.analysis_text, sectionName);

    if (latestSection !== previousSection) {
      diff.hasChanges = true;
      diff.sections.push({
        name: sectionName,
        old: previousSection,
        new: latestSection,
        hasChanged: true
      });
    }
  });

  // Extract recommendation from HANDELSBESLUT
  const latestDecision = extractSection(latest.analysis_text, 'HANDELSBESLUT');
  const previousDecision = extractSection(previous.analysis_text, 'HANDELSBESLUT');

  const latestRec = extractRecommendation(latestDecision);
  const previousRec = extractRecommendation(previousDecision);

  if (latestRec !== previousRec) {
    diff.hasChanges = true;
    diff.recommendation = {
      old: previousRec,
      new: latestRec
    };
  }

  return diff;
}

/**
 * Extract a section from analysis text
 */
function extractSection(text, sectionName) {
  if (!text) return '';

  const regex = new RegExp(`##\\s*${sectionName}([\\s\\S]*?)(?=##|$)`, 'i');
  const match = text.match(regex);

  return match ? match[1].trim() : '';
}

/**
 * Extract recommendation (KÖP/INVÄNTA/UNDVIK) from HANDELSBESLUT section
 */
function extractRecommendation(decisionText) {
  if (!decisionText) return 'OKÄND';

  if (decisionText.includes('**Rekommendation:**')) {
    const match = decisionText.match(/\*\*Rekommendation:\*\*\s*(KÖP|INVÄNTA|UNDVIK)/i);
    return match ? match[1].toUpperCase() : 'OKÄND';
  }

  // Fallback: look for keywords
  if (decisionText.includes('KÖP')) return 'KÖP';
  if (decisionText.includes('INVÄNTA')) return 'INVÄNTA';
  if (decisionText.includes('UNDVIK')) return 'UNDVIK';

  return 'OKÄND';
}

export function hasDatabase() {
  return !!supabase;
}
