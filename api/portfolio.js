/**
 * Portfolio API endpoint
 * Handles all portfolio-related operations including AI analysis
 */

import { supabase } from '../config/supabase.js';
import OpenAI from 'openai';
import dayjs from 'dayjs';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export default async function handler(req, res) {
  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Extract ticker from path if present
  const pathParts = pathname.split('/').filter(Boolean);
  const ticker = pathParts[pathParts.length - 1];

  // Check for analyze endpoint: POST /api/portfolio/analyze/:ticker
  if (method === 'POST' && pathname.includes('/analyze/')) {
    return handleAnalyze(req, res, ticker);
  }

  // Check for ai-history endpoint: GET /api/portfolio/ai-history/:ticker
  if (method === 'GET' && pathname.includes('/ai-history/')) {
    return handleAiHistory(req, res, ticker);
  }

  // GET /api/portfolio - Fetch all portfolio positions
  if (method === 'GET') {
    if (!supabase) {
      return res.json({ stocks: [] });
    }

    try {
      const { data, error } = await supabase
        .from('portfolio')
        .select('*')
        .order('added_at', { ascending: false});

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

// Handle AI analysis endpoint
async function handleAnalyze(req, res, ticker) {
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
  }

  if (!openai) {
    return res.status(503).json({ error: "OpenAI not configured" });
  }

  try {
    const { currentPrice } = req.body;

    if (!currentPrice) {
      return res.status(400).json({ error: "Current price required" });
    }

    // Get position from database
    const { data: position, error } = await supabase
      .from('portfolio')
      .select('*')
      .eq('ticker', ticker.toUpperCase())
      .single();

    if (error || !position) {
      return res.status(404).json({ error: "Position not found" });
    }

    // Calculate days in trade
    const entryDate = dayjs(position.entry_date);
    const daysInTrade = dayjs().diff(entryDate, 'day');

    // Calculate key metrics
    const rValue = position.initial_r || (position.entry_price - position.initial_stop);
    const currentR = (currentPrice - position.entry_price) / rValue;
    const targetPrice = position.initial_target || (position.entry_price + (2 * rValue));
    const distanceToTarget = targetPrice - currentPrice;
    const distanceToStop = currentPrice - position.current_stop;

    // Build analysis prompt
    const STOP_MANAGEMENT_RULES = `
# STOP-FLYTT-SCHEMA (regelbok)

## 🔒 Nivå 0 – INITIALT LÄGE
**Villkor:** Priset mellan initial stop och ~entry + 0.5R, ingen ny struktur
**Åtgärd:** Stop = initial stop, INGEN flytt, INGEN delvinst

## 🟡 Nivå 1 – Tidig rörelse (+0.5R till +1R)
**Villkor:** Pris når +0.5R till +1R
**Åtgärd:** Stop FLYTTAS INTE, ingen vinst tas, endast observation

## 🟢 Nivå 2 – Första BEKRÄFTADE styrkan
**Trigger:** Dagstängning ≥ Entry + 1R ELLER högre high + tydlig rekyl + ny högre botten
**Åtgärd:** Flytta stop till break-even (entry-pris) eller entry + liten buffert

## 🔵 Nivå 3 – Strukturell trend etablerad
**Trigger:** Nytt högre high + kontrollerad rekyl + nytt högre swing-low
**Åtgärd:** Flytta stop till under senaste swing-low

## 🟣 Nivå 4 – Target-zon (≥2R)
**Trigger:** Pris ≥ target
**Åtgärd:** Mekanisk exit ELLER ta 50% + trailing stop

# TIDSGRÄNSER (time stops)

## 🟡 Nivå 1 – Early warning (3-5 dagar)
**Fråga:** Har aktien gjort något som bekräftar idén?
**Åtgärd:** Markera som svag i journal om NEJ

## 🟠 Nivå 2 – Operativ time stop (8-12 dagar)
**Villkor:** Priset har INTE nått ≥ +1R eller skapat ny struktur
**Åtgärd:** Exit vid nästa rimliga tillfälle

## 🔴 Nivå 3 – Absolut maxgräns (15-20 dagar)
**Åtgärd:** Exit oavsett P/L

# KÄRNREGEL
❌ Flytta ALDRIG stop uppåt utan: ny struktur ELLER tydlig regel (1R, BE, swing-low)
`;

    const prompt = `Du är en professionell swing trading-rådgivare. Analysera följande position och ge KONKRET vägledning enligt reglerna.

# POSITION
- Ticker: ${position.ticker}
- Entry: ${position.entry_price.toFixed(2)} kr
- Entry-datum: ${position.entry_date}
- Dagar i trade: ${daysInTrade}
- Initial stop: ${position.initial_stop.toFixed(2)} kr
- Current stop: ${position.current_stop.toFixed(2)} kr
- Target: ${targetPrice.toFixed(2)} kr
- 1R (risk): ${rValue.toFixed(2)} kr
- Nuvarande pris: ${currentPrice.toFixed(2)} kr
- Nuvarande P/L: ${currentR.toFixed(2)}R (${((currentR * rValue) * position.quantity).toFixed(0)} kr)
- Entry setup: ${position.entry_setup || 'N/A'}
- Entry rationale: ${position.entry_rationale || 'N/A'}

# REGLER
${STOP_MANAGEMENT_RULES}

# UPPGIFT
Analysera positionen och ge:
1. **Aktuell nivå** (0-4) enligt stop-schemat
2. **Stop-rekommendation** (exakt pris eller "behåll")
3. **Time stop-status** (grön/gul/röd baserat på dagar + framsteg)
4. **Konkret åtgärd** (gör detta NU)
5. **Nästa trigger** (när ska du ompröva?)
6. **Riskbedömning** (vad kan gå fel?)

Var MEKANISK och SPECIFIK. Ingen fluff. Ge exakta priser och datum.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Du är en strikt, regelbaserad swing trading-rådgivare som ger konkreta, testbara rekommendationer. Använd BARA reglerna som ges. Ingen subjektiv tolkning.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1500
    });

    const analysis = completion.choices[0].message.content;

    const result = {
      analysis,
      metrics: {
        currentR: currentR.toFixed(2),
        daysInTrade,
        distanceToTarget: distanceToTarget.toFixed(2),
        distanceToStop: distanceToStop.toFixed(2),
        targetPrice: targetPrice.toFixed(2),
        rValue: rValue.toFixed(2)
      },
      timestamp: new Date().toISOString()
    };

    // Save analysis to database
    try {
      if (supabase) {
        await supabase
          .from('portfolio_ai_analysis')
          .insert({
            ticker: ticker.toUpperCase(),
            analysis: result.analysis,
            metrics: result.metrics,
            timestamp: result.timestamp
          });
      }
    } catch (saveError) {
      console.error("Failed to save AI analysis:", saveError);
      // Continue anyway - don't fail the request
    }

    return res.json(result);
  } catch (error) {
    console.error('Portfolio analysis error:', error);
    return res.status(500).json({ error: 'Analysis failed' });
  }
}

// Handle AI history endpoint
async function handleAiHistory(req, res, ticker) {
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const limit = parseInt(req.query?.limit) || 3;

    // Get recent analyses
    const { data: analyses, error } = await supabase
      .from('portfolio_ai_analysis')
      .select('*')
      .eq('ticker', ticker.toUpperCase())
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Get total count
    const { count, error: countError } = await supabase
      .from('portfolio_ai_analysis')
      .select('*', { count: 'exact', head: true })
      .eq('ticker', ticker.toUpperCase());

    if (countError) throw countError;

    let comparison = null;
    if (analyses && analyses.length >= 2) {
      comparison = {
        hasChanges: analyses[0].timestamp !== analyses[1].timestamp,
        timestamp: {
          latest: analyses[0].timestamp,
          previous: analyses[1].timestamp
        }
      };
    }

    return res.json({
      analyses: analyses || [],
      count: count || 0,
      comparison
    });
  } catch (error) {
    console.error('Failed to get AI history:', error);
    return res.status(500).json({ error: 'Failed to get AI history' });
  }
}
