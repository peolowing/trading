import { useState, useEffect } from "react";

/**
 * POSITION DETAIL VIEW - Trade Cockpit
 *
 * Syfte: Visa ALLT om en specifik trade från entry → exit → lärdom
 * Används: Öppnas från förvaltningslistan
 *
 * 5 SEKTIONER:
 * 1. Header - Position Snapshot (status nu)
 * 2. Entry Journal - Varför tog jag traden? (låst efter entry)
 * 3. Aktuell Förvaltning - Vad säger marknaden nu?
 * 4. Tidsaxel / Händelselogg - Vad har hänt?
 * 5. Post-Exit Journal - Vad lärde jag mig? (visas efter exit)
 */

export default function PositionDetail({ ticker, onBack }) {
  const [position, setPosition] = useState(null);
  const [events, setEvents] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExitForm, setShowExitForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showJournalForm, setShowJournalForm] = useState(false);

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState("Klicka på 'Kör AI-analys' för att få regelbaserad vägledning");
  const [aiHistory, setAiHistory] = useState(null);
  const [refreshingAi, setRefreshingAi] = useState(false);
  const [selectedAnalysisTab, setSelectedAnalysisTab] = useState(0);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const [exitFormData, setExitFormData] = useState({
    exit_type: 'FULL',
    exit_price: '',
    exit_quantity: '',
    lessons_learned: '',
    followed_plan: true,
    exit_too_early: false,
    let_market_decide: true,
    good_entry_bad_exit: false,
    broke_rules: false
  });

  const [noteFormData, setNoteFormData] = useState({
    note_text: ''
  });

  const [journalFormData, setJournalFormData] = useState({
    entry_type: 'observation',
    note_text: '',
    trade_quality: 5,
    emotional_state: 'neutral'
  });

  // Inline editing state
  const [editingStop, setEditingStop] = useState(false);
  const [editingTarget, setEditingTarget] = useState(false);
  const [editingTrailing, setEditingTrailing] = useState(false);
  const [tempStop, setTempStop] = useState('');
  const [tempTarget, setTempTarget] = useState('');
  const [tempTrailing, setTempTrailing] = useState('');

  useEffect(() => {
    loadPositionDetails();
  }, [ticker]);

  async function loadPositionDetails() {
    try {
      // Fetch position from portfolio
      const posRes = await fetch(`/api/portfolio?ticker=${ticker}`);
      const posData = await posRes.json();

      // API returns either {portfolio: [...]} or {stocks: [...]}
      const positions = posData.portfolio || posData.stocks || [];
      let basePosition = positions.length > 0 ? positions[0] : null;

      // Fetch FRESH price from Yahoo Finance
      if (basePosition) {
        try {
          const quoteRes = await fetch(`/api/quote/${ticker}`);
          if (quoteRes.ok) {
            const quoteData = await quoteRes.json();
            // Override current_price with fresh data
            basePosition = {
              ...basePosition,
              current_price: quoteData.price,
              price_change: quoteData.change,
              price_change_pct: quoteData.changePercent,
              price_timestamp: quoteData.timestamp
            };
          }
        } catch (quoteError) {
          console.warn("Failed to fetch fresh quote, using cached price:", quoteError);
          // Continue with cached price from database
        }

        setPosition(basePosition);
      }

      // Fetch event log for this position
      const eventsRes = await fetch(`/api/portfolio/events?ticker=${ticker}`);
      const eventsData = await eventsRes.json();
      setEvents(eventsData.events || []);

      // Fetch journal entries for this position
      const journalRes = await fetch(`/api/trades?ticker=${ticker}`);
      const journalData = await journalRes.json();
      setJournalEntries(journalData.trades || []);

      // Load AI analysis history on page load
      await loadAiHistory();

    } catch (e) {
      console.error("Failed to load position details:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleExitSubmit(e) {
    e.preventDefault();

    try {
      const res = await fetch(`/api/portfolio/exit/${ticker}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exitFormData)
      });

      if (res.ok) {
        await loadPositionDetails();
        setShowExitForm(false);
        setExitFormData({
          exit_type: 'FULL',
          exit_price: '',
          exit_quantity: '',
          lessons_learned: '',
          followed_plan: true,
          exit_too_early: false,
          let_market_decide: true,
          good_entry_bad_exit: false,
          broke_rules: false
        });
      }
    } catch (e) {
      console.error("Failed to exit position:", e);
    }
  }

  async function refreshAiAnalysis() {
    if (!position || !position.current_price) {
      alert("Vänligen vänta tills positionsdata laddats");
      return;
    }

    setRefreshingAi(true);
    try {
      const res = await fetch(`/api/portfolio/analyze/${ticker}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPrice: position.current_price
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data.analysis);

        // Load AI history to show in tabs
        await loadAiHistory();
      } else {
        const error = await res.json();
        setAiAnalysis(`❌ AI-analys misslyckades: ${error.error || 'Okänt fel'}`);
      }
    } catch (e) {
      console.error("Failed to refresh AI analysis:", e);
      setAiAnalysis("❌ AI-analys inte tillgänglig");
    } finally {
      setRefreshingAi(false);
    }
  }

  async function loadAiHistory() {
    try {
      // Fetch AI analysis history for this position
      const historyRes = await fetch(`/api/portfolio/ai-history/${ticker}`);
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setAiHistory(historyData);

        // Show the most recent analysis if available
        if (historyData.analyses && historyData.analyses.length > 0) {
          setSelectedAnalysisTab(0);
          setAiAnalysis(historyData.analyses[0].analysis);
        }
      }
    } catch (e) {
      console.warn("Could not load AI history:", e);
    }
  }

  async function handleAddNote(e) {
    e.preventDefault();

    try {
      const res = await fetch(`/api/portfolio/notes/${ticker}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteFormData.note_text })
      });

      if (res.ok) {
        await loadPositionDetails();
        setShowNoteForm(false);
        setNoteFormData({ note_text: '' });
      }
    } catch (e) {
      console.error("Failed to add note:", e);
    }
  }

  async function handleMoveStop(newStop) {
    try {
      const res = await fetch(`/api/portfolio/move-stop/${ticker}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_stop: newStop })
      });

      if (res.ok) {
        await loadPositionDetails();
        alert(`✅ Stop flyttad till ${newStop}`);
      } else {
        const error = await res.json();
        alert(`❌ Kunde inte flytta stop: ${error.error || 'Okänt fel'}`);
      }
    } catch (e) {
      console.error("Failed to move stop:", e);
      alert(`❌ Kunde inte flytta stop: ${e.message}`);
    }
  }

  async function handleJournalSubmit(e) {
    e.preventDefault();

    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker,
          date: new Date().toISOString().split('T')[0],
          type: journalFormData.entry_type,
          setup_notes: journalFormData.note_text,
          // Optional fields for tracking
          price: position?.current_price,
          quantity: position?.quantity
        })
      });

      if (res.ok) {
        await loadPositionDetails();
        setShowJournalForm(false);
        setJournalFormData({
          entry_type: 'observation',
          note_text: '',
          trade_quality: 5,
          emotional_state: 'neutral'
        });
      }
    } catch (e) {
      console.error("Failed to add journal entry:", e);
    }
  }

  // Inline editing handlers
  async function handleUpdateStop() {
    const newStop = parseFloat(tempStop);
    if (isNaN(newStop)) {
      alert('❌ Ogiltigt värde för stop');
      setEditingStop(false);
      return;
    }

    // Validation: stop must be below entry price for longs
    if (newStop >= position.entry_price) {
      alert('❌ Stop måste vara under entry-priset för longs');
      setEditingStop(false);
      return;
    }

    try {
      const oldStop = position.current_stop;
      const res = await fetch(`/api/portfolio/update-field/${ticker}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field: 'current_stop',
          value: newStop,
          event_description: `Stop flyttad från ${oldStop.toFixed(2)} → ${newStop.toFixed(2)}`
        })
      });

      if (res.ok) {
        await loadPositionDetails();
        setEditingStop(false);
        alert(`✅ Stop uppdaterad till ${newStop.toFixed(2)}`);
      } else {
        const error = await res.json();
        alert(`❌ Kunde inte uppdatera stop: ${error.error || 'Okänt fel'}`);
        setEditingStop(false);
      }
    } catch (e) {
      console.error("Failed to update stop:", e);
      alert(`❌ Fel: ${e.message}`);
      setEditingStop(false);
    }
  }

  async function handleUpdateTarget() {
    const newTarget = parseFloat(tempTarget);
    if (isNaN(newTarget)) {
      alert('❌ Ogiltigt värde för target');
      setEditingTarget(false);
      return;
    }

    // Validation: target must be above current price for longs
    if (newTarget <= position.current_price) {
      alert('❌ Target måste vara över aktuellt pris för longs');
      setEditingTarget(false);
      return;
    }

    try {
      const oldTarget = position.current_target;
      const res = await fetch(`/api/portfolio/update-field/${ticker}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field: 'current_target',
          value: newTarget,
          event_description: `Target ändrad från ${oldTarget?.toFixed(2) || '—'} → ${newTarget.toFixed(2)}`
        })
      });

      if (res.ok) {
        await loadPositionDetails();
        setEditingTarget(false);
        alert(`✅ Target uppdaterad till ${newTarget.toFixed(2)}`);
      } else {
        const error = await res.json();
        alert(`❌ Kunde inte uppdatera target: ${error.error || 'Okänt fel'}`);
        setEditingTarget(false);
      }
    } catch (e) {
      console.error("Failed to update target:", e);
      alert(`❌ Fel: ${e.message}`);
      setEditingTarget(false);
    }
  }

  async function handleUpdateTrailing() {
    if (!tempTrailing) {
      setEditingTrailing(false);
      return;
    }

    try {
      const oldTrailing = position.trailing_type || 'EMA20';
      const res = await fetch(`/api/portfolio/update-field/${ticker}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field: 'trailing_type',
          value: tempTrailing,
          event_description: `Trailing-metod ändrad från ${oldTrailing} → ${tempTrailing}`
        })
      });

      if (res.ok) {
        await loadPositionDetails();
        setEditingTrailing(false);
        alert(`✅ Trailing-metod uppdaterad till ${tempTrailing}`);
      } else {
        const error = await res.json();
        alert(`❌ Kunde inte uppdatera trailing-metod: ${error.error || 'Okänt fel'}`);
        setEditingTrailing(false);
      }
    } catch (e) {
      console.error("Failed to update trailing method:", e);
      alert(`❌ Fel: ${e.message}`);
      setEditingTrailing(false);
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Laddar position...</div>
      </div>
    );
  }

  if (!position) {
    return (
      <div className="container">
        <div className="card">
          <p style={{ color: "#64748b", textAlign: "center", padding: "40px" }}>
            Position {ticker} hittades inte.
          </p>
          <button className="ghost" onClick={onBack}>← Tillbaka till Trading Cockpit</button>
        </div>
      </div>
    );
  }

  // Calculate derived values
  const isExited = Boolean(position.exit_date);
  const currentPrice = position.current_price || position.entry_price;
  const currentStop = position.current_stop || position.initial_stop;
  const pnlPct = position.pnl_pct ?? 0;
  const rMultiple = position.r_multiple ?? 0;
  const daysInTrade = position.days_in_trade || 0;
  const status = position.current_status || 'HOLD';

  // Colors
  const pnlColor = pnlPct >= 0 ? "#16a34a" : "#dc2626";
  let rColor = "#64748b";
  if (rMultiple >= 2) rColor = "#16a34a";
  else if (rMultiple >= 1) rColor = "#3b82f6";
  else if (rMultiple < 0) rColor = "#dc2626";

  // Status icon and label
  const statusIcon = status === 'HOLD' ? '🟢' :
                    status === 'TIGHTEN_STOP' ? '🟡' :
                    status === 'PARTIAL_EXIT' ? '🟠' :
                    status === 'EXIT' ? '🔴' :
                    status === 'STOP_HIT' ? '⚫' : '⚪';

  const statusLabel = status === 'HOLD' ? 'HOLD' :
                     status === 'TIGHTEN_STOP' ? 'TIGHTEN STOP' :
                     status === 'PARTIAL_EXIT' ? 'PARTIAL EXIT' :
                     status === 'EXIT' ? 'EXIT' :
                     status === 'STOP_HIT' ? 'STOP HIT' : 'UNKNOWN';

  // Risk calculations
  const distToStop = currentPrice > 0 && currentStop > 0
    ? ((currentPrice - currentStop) / currentPrice * 100).toFixed(1)
    : "—";

  const currentTarget = position.current_target || position.initial_target;
  const distToTarget = currentPrice > 0 && currentTarget > 0
    ? ((currentTarget - currentPrice) / currentPrice * 100).toFixed(1)
    : "—";

  return (
    <div className="container">
      {/* ============================================ */}
      {/* 1️⃣ HEADER - POSITION SNAPSHOT */}
      {/* ============================================ */}
      <header className="header">
        <div>
          <p className="eyebrow">Position Detail</p>
          <h1 style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap"
          }}>
            {ticker}
            <span style={{ fontSize: "24px" }}>{statusIcon}</span>
            <span style={{
              fontSize: "16px",
              fontWeight: "600",
              color: "#64748b"
            }}>
              {statusLabel}
            </span>
          </h1>

          {/* Compact metrics */}
          <div style={{
            display: "flex",
            gap: "16px",
            marginTop: "8px",
            fontSize: "13px",
            fontWeight: "600",
            flexWrap: "wrap"
          }}>
            <div>
              <span style={{ color: "#64748b", fontSize: "11px", marginRight: "4px" }}>R:</span>
              <span style={{ color: rColor, fontVariantNumeric: "tabular-nums" }}>
                {rMultiple > 0 ? '+' : ''}{rMultiple.toFixed(1)}R
              </span>
            </div>
            <div>
              <span style={{ color: "#64748b", fontSize: "11px", marginRight: "4px" }}>PnL:</span>
              <span style={{ color: pnlColor, fontVariantNumeric: "tabular-nums" }}>
                {pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(1)}%
              </span>
            </div>
            <div>
              <span style={{ color: "#64748b", fontSize: "11px", marginRight: "4px" }}>Dagar:</span>
              <span style={{ color: "#0f172a" }}>{daysInTrade}d</span>
            </div>
            {position.entry_date && (
              <div>
                <span style={{ color: "#64748b", fontSize: "11px", marginRight: "4px" }}>Entry:</span>
                <span style={{ color: "#0f172a" }}>{position.entry_date}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button className="ghost" onClick={onBack}>
            ← Trading Cockpit
          </button>
          {!isExited && (
            <button
              className="ghost"
              style={{
                background: showExitForm ? "transparent" : "#fef2f2",
                borderColor: showExitForm ? "#e2e8f0" : "#fca5a5",
                color: showExitForm ? "#64748b" : "#dc2626"
              }}
              onClick={() => setShowExitForm(!showExitForm)}
            >
              {showExitForm ? "✕ Stäng" : "⬆ Exit"}
            </button>
          )}
        </div>
      </header>

      {/* Exit Form (if shown) */}
      {showExitForm && !isExited && (
        <div className="card" style={{ marginBottom: "24px", background: "#fef2f2", border: "2px solid #fca5a5" }}>
          <h3 style={{ marginTop: 0, marginBottom: "16px", color: "#dc2626" }}>Exit Position: {ticker}</h3>

          <form onSubmit={handleExitSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" }}>
              <div>
                <label className="form-label">Exit Type</label>
                <select
                  className="form-input"
                  value={exitFormData.exit_type}
                  onChange={(e) => setExitFormData({...exitFormData, exit_type: e.target.value})}
                >
                  <option value="FULL">Full Exit</option>
                  <option value="PARTIAL">Partial Exit (50%)</option>
                  <option value="STOP_HIT">Stop Hit</option>
                </select>
              </div>

              <div>
                <label className="form-label">Exit Price</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder={currentPrice.toFixed(2)}
                  value={exitFormData.exit_price}
                  onChange={(e) => setExitFormData({...exitFormData, exit_price: e.target.value})}
                  required
                />
              </div>

              {exitFormData.exit_type === 'PARTIAL' && (
                <div>
                  <label className="form-label">Antal att sälja</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder={Math.floor(position.quantity / 2).toString()}
                    value={exitFormData.exit_quantity}
                    onChange={(e) => setExitFormData({...exitFormData, exit_quantity: e.target.value})}
                    required
                  />
                </div>
              )}
            </div>

            <div style={{ marginTop: "16px" }}>
              <label className="form-label">Självutvärdering (checklist)</label>
              <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
                  <input
                    type="checkbox"
                    checked={exitFormData.followed_plan}
                    onChange={(e) => setExitFormData({...exitFormData, followed_plan: e.target.checked})}
                  />
                  Följde planen
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
                  <input
                    type="checkbox"
                    checked={exitFormData.exit_too_early}
                    onChange={(e) => setExitFormData({...exitFormData, exit_too_early: e.target.checked})}
                  />
                  Tog exit för tidigt
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
                  <input
                    type="checkbox"
                    checked={exitFormData.let_market_decide}
                    onChange={(e) => setExitFormData({...exitFormData, let_market_decide: e.target.checked})}
                  />
                  Lät marknaden slå ut mig
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
                  <input
                    type="checkbox"
                    checked={exitFormData.good_entry_bad_exit}
                    onChange={(e) => setExitFormData({...exitFormData, good_entry_bad_exit: e.target.checked})}
                  />
                  Bra entry men dålig exit
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
                  <input
                    type="checkbox"
                    checked={exitFormData.broke_rules}
                    onChange={(e) => setExitFormData({...exitFormData, broke_rules: e.target.checked})}
                  />
                  Bröt mot regler
                </label>
              </div>
            </div>

            <div style={{ marginTop: "16px" }}>
              <label className="form-label">Lärdom (fri text)</label>
              <textarea
                className="form-textarea"
                rows="4"
                placeholder="Vad lärde du dig av denna trade?"
                value={exitFormData.lessons_learned}
                onChange={(e) => setExitFormData({...exitFormData, lessons_learned: e.target.value})}
              />
            </div>

            <div style={{ marginTop: "20px", display: "flex", gap: "12px" }}>
              <button type="submit" className="ghost" style={{ background: "#dc2626", color: "white", borderColor: "#dc2626" }}>
                Bekräfta Exit
              </button>
              <button type="button" className="ghost" onClick={() => setShowExitForm(false)}>
                Avbryt
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* ============================================ */}
        {/* 2️⃣ ENTRY JOURNAL (LÅST) */}
        {/* ============================================ */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <h3 style={{ margin: 0 }}>Entry Journal</h3>
            <span style={{ fontSize: "12px", color: "#64748b", background: "#f1f5f9", padding: "2px 8px", borderRadius: "4px" }}>
              🔒 Låst
            </span>
          </div>

          <table style={{ width: "100%", fontSize: "14px" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b", width: "40%" }}>Entry-datum</td>
                <td style={{ padding: "8px 0", fontWeight: "600" }}>{position.entry_date || "—"}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Entry-pris</td>
                <td style={{ padding: "8px 0", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                  {position.entry_price?.toFixed(2) || "—"}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Position size</td>
                <td style={{ padding: "8px 0", fontWeight: "600" }}>
                  {position.quantity || "—"} aktier
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Initial risk (R)</td>
                <td style={{ padding: "8px 0", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                  {position.initial_r ? `${position.initial_r.toFixed(2)} kr/aktie` : "—"}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Initial stop</td>
                <td style={{ padding: "8px 0", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                  {position.initial_stop?.toFixed(2) || "—"}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Target</td>
                <td style={{ padding: "8px 0", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                  {position.initial_target?.toFixed(2) || "—"}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Setup</td>
                <td style={{ padding: "8px 0", fontWeight: "600" }}>{position.entry_setup || "—"}</td>
              </tr>
            </tbody>
          </table>

          {/* Entry Rationale */}
          <div style={{ marginTop: "20px", padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#64748b", marginBottom: "8px" }}>
              ENTRY RATIONALE
            </div>
            <div style={{ fontSize: "14px", color: "#0f172a", lineHeight: "1.6" }}>
              {position.entry_rationale || "Ingen entry-motivering registrerad."}
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* 3️⃣ AKTUELL FÖRVALTNING */}
        {/* ============================================ */}
        <div className="card">
          <h3 style={{ margin: "0 0 16px 0" }}>Aktuell Förvaltning</h3>

          <table style={{ width: "100%", fontSize: "14px", marginBottom: "20px" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b", width: "50%" }}>Aktuellt pris</td>
                <td style={{ padding: "8px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: "700", fontSize: "16px", fontVariantNumeric: "tabular-nums" }}>
                      {currentPrice.toFixed(2)}
                    </span>
                    {position.price_change_pct !== undefined && (
                      <span style={{
                        fontSize: "13px",
                        fontWeight: "600",
                        color: position.price_change_pct >= 0 ? "#16a34a" : "#dc2626",
                        background: position.price_change_pct >= 0 ? "#dcfce7" : "#fee2e2",
                        padding: "2px 8px",
                        borderRadius: "4px"
                      }}>
                        {position.price_change_pct >= 0 ? '+' : ''}{position.price_change_pct?.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Stop (nu)</td>
                <td style={{ padding: "8px 0", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                  {editingStop ? (
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <input
                        type="number"
                        step="0.01"
                        value={tempStop}
                        onChange={(e) => setTempStop(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateStop();
                          if (e.key === 'Escape') setEditingStop(false);
                        }}
                        autoFocus
                        style={{
                          width: "100px",
                          padding: "8px 12px",
                          border: "2px solid #3b82f6",
                          borderRadius: "4px",
                          fontSize: "16px",
                          fontWeight: "600",
                          minHeight: "44px"
                        }}
                      />
                      <button
                        onClick={handleUpdateStop}
                        style={{
                          padding: "6px 12px",
                          background: "#16a34a",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "14px",
                          minWidth: "44px",
                          minHeight: "44px"
                        }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingStop(false)}
                        style={{
                          padding: "6px 12px",
                          background: "#64748b",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "14px",
                          minWidth: "44px",
                          minHeight: "44px"
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span
                      onClick={() => {
                        if (!isExited) {
                          setTempStop(currentStop.toFixed(2));
                          setEditingStop(true);
                        }
                      }}
                      style={{
                        cursor: isExited ? "default" : "pointer",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        background: isExited ? "transparent" : "#f1f5f9",
                        display: "inline-block",
                        transition: "background 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        if (!isExited) e.target.style.background = "#e2e8f0";
                      }}
                      onMouseLeave={(e) => {
                        if (!isExited) e.target.style.background = "#f1f5f9";
                      }}
                      title={isExited ? "" : "Klicka för att redigera"}
                    >
                      {currentStop.toFixed(2)}
                    </span>
                  )}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Avstånd till stop</td>
                <td style={{ padding: "8px 0", fontWeight: "600", color: distToStop !== "—" && parseFloat(distToStop) < 2 ? "#dc2626" : "#0f172a" }}>
                  {distToStop !== "—" ? `${distToStop}%` : "—"}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Trailing-metod</td>
                <td style={{ padding: "8px 0", fontWeight: "600" }}>
                  {editingTrailing ? (
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <select
                        value={tempTrailing}
                        onChange={(e) => setTempTrailing(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateTrailing();
                          if (e.key === 'Escape') setEditingTrailing(false);
                        }}
                        autoFocus
                        style={{
                          padding: "8px 12px",
                          border: "2px solid #3b82f6",
                          borderRadius: "4px",
                          fontSize: "16px",
                          fontWeight: "600",
                          background: "white",
                          minHeight: "44px"
                        }}
                      >
                        <option value="EMA20">EMA20</option>
                        <option value="EMA50">EMA50</option>
                        <option value="ATR">ATR</option>
                        <option value="Manual">Manual</option>
                      </select>
                      <button
                        onClick={handleUpdateTrailing}
                        style={{
                          padding: "6px 12px",
                          background: "#16a34a",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "14px",
                          minWidth: "44px",
                          minHeight: "44px"
                        }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingTrailing(false)}
                        style={{
                          padding: "6px 12px",
                          background: "#64748b",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "14px",
                          minWidth: "44px",
                          minHeight: "44px"
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span
                      onClick={() => {
                        if (!isExited) {
                          setTempTrailing(position.trailing_type || 'EMA20');
                          setEditingTrailing(true);
                        }
                      }}
                      style={{
                        cursor: isExited ? "default" : "pointer",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        background: isExited ? "transparent" : "#f1f5f9",
                        display: "inline-block",
                        transition: "background 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        if (!isExited) e.target.style.background = "#e2e8f0";
                      }}
                      onMouseLeave={(e) => {
                        if (!isExited) e.target.style.background = "#f1f5f9";
                      }}
                      title={isExited ? "" : "Klicka för att redigera"}
                    >
                      {position.trailing_type || "EMA20"}
                    </span>
                  )}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Target (pris)</td>
                <td style={{ padding: "8px 0", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                  {editingTarget ? (
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <input
                        type="number"
                        step="0.01"
                        value={tempTarget}
                        onChange={(e) => setTempTarget(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateTarget();
                          if (e.key === 'Escape') setEditingTarget(false);
                        }}
                        autoFocus
                        style={{
                          width: "100px",
                          padding: "8px 12px",
                          border: "2px solid #3b82f6",
                          borderRadius: "4px",
                          fontSize: "16px",
                          fontWeight: "600",
                          minHeight: "44px"
                        }}
                      />
                      <button
                        onClick={handleUpdateTarget}
                        style={{
                          padding: "6px 12px",
                          background: "#16a34a",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "14px",
                          minWidth: "44px",
                          minHeight: "44px"
                        }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingTarget(false)}
                        style={{
                          padding: "6px 12px",
                          background: "#64748b",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "14px",
                          minWidth: "44px",
                          minHeight: "44px"
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span
                      onClick={() => {
                        if (!isExited) {
                          setTempTarget(currentTarget?.toFixed(2) || '');
                          setEditingTarget(true);
                        }
                      }}
                      style={{
                        cursor: isExited ? "default" : "pointer",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        background: isExited ? "transparent" : "#f1f5f9",
                        display: "inline-block",
                        transition: "background 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        if (!isExited) e.target.style.background = "#e2e8f0";
                      }}
                      onMouseLeave={(e) => {
                        if (!isExited) e.target.style.background = "#f1f5f9";
                      }}
                      title={isExited ? "" : "Klicka för att redigera"}
                    >
                      {currentTarget ? currentTarget.toFixed(2) : "—"}
                    </span>
                  )}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Target kvar</td>
                <td style={{ padding: "8px 0", fontWeight: "600" }}>
                  {distToTarget !== "—" ? `${distToTarget}%` : "—"}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "8px 0", color: "#64748b" }}>R nu</td>
                <td style={{ padding: "8px 0", fontWeight: "700", fontSize: "16px", color: rColor, fontVariantNumeric: "tabular-nums" }}>
                  {rMultiple > 0 ? '+' : ''}{rMultiple.toFixed(1)}R
                </td>
              </tr>
            </tbody>
          </table>

          {/* Exit Status */}
          <div style={{
            padding: "16px",
            background: status === 'EXIT' || status === 'STOP_HIT' ? "#fef2f2" : status === 'PARTIAL_EXIT' ? "#fff7ed" : status === 'TIGHTEN_STOP' ? "#fefce8" : "#f0fdf4",
            border: `2px solid ${status === 'EXIT' || status === 'STOP_HIT' ? "#fca5a5" : status === 'PARTIAL_EXIT' ? "#fdba74" : status === 'TIGHTEN_STOP' ? "#fde047" : "#86efac"}`,
            borderRadius: "8px"
          }}>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#64748b", marginBottom: "8px" }}>
              EXIT-STATUS
            </div>
            <div style={{ fontSize: "20px", marginBottom: "8px" }}>
              {statusIcon} {statusLabel}
            </div>
            {position.exit_signal && (
              <div style={{ fontSize: "14px", color: "#0f172a", lineHeight: "1.6" }}>
                <strong>Orsak:</strong> {position.exit_signal}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          {!isExited && (
            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                className="ghost"
                style={{ fontSize: "14px", padding: "8px 12px" }}
                onClick={() => {
                  console.log('Moving stop to break-even:', position.entry_price);
                  handleMoveStop(position.entry_price);
                }}
              >
                Flytta stop till break-even
              </button>
              <button
                className="ghost"
                style={{ fontSize: "14px", padding: "8px 12px" }}
                onClick={() => {
                  console.log('Toggle note form, current:', showNoteForm);
                  setShowNoteForm(!showNoteForm);
                }}
              >
                {showNoteForm ? "Stäng notering" : "+ Lägg till notering"}
              </button>
              <button
                className="ghost"
                style={{ fontSize: "14px", padding: "8px 12px", background: "#fef3c7", borderColor: "#fbbf24" }}
                onClick={() => {
                  console.log('Toggle journal form, current:', showJournalForm);
                  setShowJournalForm(!showJournalForm);
                }}
              >
                {showJournalForm ? "Stäng journal" : "📔 Lägg till journal-anteckning"}
              </button>
            </div>
          )}

          {/* Debug info */}
          {!isExited && (
            <div style={{ marginTop: "12px", fontSize: "11px", color: "#64748b", padding: "8px", background: "#f8fafc", borderRadius: "4px" }}>
              Debug: isExited={String(isExited)}, showJournalForm={String(showJournalForm)}, exit_date={position.exit_date || 'null'}
            </div>
          )}
        </div>
      </div>

      {/* Note Form */}
      {showNoteForm && !isExited && (
        <div className="card" style={{ marginTop: "24px" }}>
          <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Lägg till notering</h3>
          <form onSubmit={handleAddNote}>
            <textarea
              className="form-textarea"
              rows="3"
              placeholder="T.ex. 'Volym ovanligt hög idag' eller 'Rapport om 5 dagar'"
              value={noteFormData.note_text}
              onChange={(e) => setNoteFormData({ note_text: e.target.value })}
              required
            />
            <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
              <button type="submit" className="ghost" style={{ background: "#4f46e5", color: "white", borderColor: "#4f46e5" }}>
                Spara notering
              </button>
              <button type="button" className="ghost" onClick={() => setShowNoteForm(false)}>
                Avbryt
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Journal Form */}
      {showJournalForm && !isExited && (
        <div className="card" style={{ marginTop: "24px", background: "#fffbeb", border: "2px solid #fbbf24" }}>
          <h3 style={{ marginTop: 0, marginBottom: "16px", color: "#92400e" }}>📔 Lägg till journal-anteckning</h3>
          <form onSubmit={handleJournalSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label className="form-label">Typ av anteckning</label>
              <select
                className="form-input"
                value={journalFormData.entry_type}
                onChange={(e) => setJournalFormData({...journalFormData, entry_type: e.target.value})}
              >
                <option value="observation">Observation (vad händer?)</option>
                <option value="decision">Beslut (vad gör jag?)</option>
                <option value="emotion">Känslor (hur mår jag?)</option>
                <option value="lesson">Lärdom (vad lärde jag mig?)</option>
                <option value="mistake">Misstag (vad gjorde jag fel?)</option>
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label className="form-label">Anteckning</label>
              <textarea
                className="form-textarea"
                rows="4"
                placeholder="Beskriv vad du observerar, tänker eller känner..."
                value={journalFormData.note_text}
                onChange={(e) => setJournalFormData({...journalFormData, note_text: e.target.value})}
                required
              />
            </div>

            <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
              <button type="submit" className="ghost" style={{ background: "#fbbf24", color: "#78350f", borderColor: "#fbbf24" }}>
                Spara journal-anteckning
              </button>
              <button type="button" className="ghost" onClick={() => setShowJournalForm(false)}>
                Avbryt
              </button>
            </div>
          </form>
        </div>
      )}
      {/* ============================================ */}
      {/* 🤖 AI-ANALYS (REGELBASERAD VÄGLEDNING) */}
      {/* ============================================ */}
      <div className="card" style={{ marginTop: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0 }}>🤖 AI-Analys (Regelbaserad Vägledning)</h3>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setShowRulesModal(true)}
              style={{
                padding: "8px 12px",
                background: "transparent",
                color: "#64748b",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer"
              }}
              title="Visa regelbok"
            >
              ❓ Regler
            </button>
            <button
              onClick={refreshAiAnalysis}
              disabled={refreshingAi || !position}
              style={{
                padding: "8px 16px",
                background: refreshingAi ? "#cbd5e1" : "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: refreshingAi ? "not-allowed" : "pointer"
              }}
            >
              {refreshingAi ? "🔄 Analyserar..." : "Kör AI-analys"}
            </button>
          </div>
        </div>

        {/* Analysis History Tabs */}
        {aiHistory?.analyses && aiHistory.analyses.length > 1 && (
          <div style={{ marginBottom: "15px" }}>
            <div style={{
              display: "flex",
              gap: "8px",
              borderBottom: "2px solid #e5e7eb",
              marginBottom: "12px",
              overflowX: "auto"
            }}>
              {aiHistory.analyses.map((analysis, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedAnalysisTab(idx);
                    setAiAnalysis(analysis.analysis);
                  }}
                  style={{
                    padding: "8px 16px",
                    fontSize: "12px",
                    fontWeight: "600",
                    background: selectedAnalysisTab === idx ? "#3b82f6" : "transparent",
                    color: selectedAnalysisTab === idx ? "white" : "#6b7280",
                    border: "none",
                    borderBottom: selectedAnalysisTab === idx ? "2px solid #3b82f6" : "2px solid transparent",
                    cursor: "pointer",
                    borderRadius: "4px 4px 0 0",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap"
                  }}
                >
                  {idx === 0 ? "Senaste" : `Analys ${idx + 1}`}
                  <div style={{ fontSize: "10px", opacity: 0.8, marginTop: "2px" }}>
                    {new Date(analysis.timestamp).toLocaleString('sv-SE', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Show single analysis count badge */}
        {aiHistory?.count === 1 && (
          <div style={{
            marginBottom: "16px",
            padding: "8px 12px",
            background: "#eff6ff",
            borderRadius: "6px",
            border: "1px solid #93c5fd",
            fontSize: "12px",
            color: "#1e40af",
            display: "inline-block"
          }}>
            📊 1 analys sparad
          </div>
        )}

        {/* AI Analysis content */}
        <div style={{
          padding: "20px",
          background: "#f8fafc",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
          fontSize: "14px",
          lineHeight: "1.6",
          whiteSpace: "pre-wrap"
        }}>
          {aiAnalysis}
        </div>

        {/* Show metrics if available */}
        {aiHistory?.analyses && aiHistory.analyses.length > 0 && aiHistory.analyses[selectedAnalysisTab]?.metrics && (
          <div style={{
            marginTop: "16px",
            padding: "16px",
            background: "#f0f9ff",
            borderRadius: "8px",
            border: "1px solid #bae6fd"
          }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "700", color: "#0c4a6e" }}>
              📊 Nyckeltal
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", fontSize: "13px" }}>
              {aiHistory.analyses[selectedAnalysisTab].metrics.currentR && (
                <div>
                  <strong>Nuvarande R:</strong> {aiHistory.analyses[selectedAnalysisTab].metrics.currentR}R
                </div>
              )}
              {aiHistory.analyses[selectedAnalysisTab].metrics.daysInTrade !== undefined && (
                <div>
                  <strong>Dagar i trade:</strong> {aiHistory.analyses[selectedAnalysisTab].metrics.daysInTrade}
                </div>
              )}
              {aiHistory.analyses[selectedAnalysisTab].metrics.distanceToTarget && (
                <div>
                  <strong>Till target:</strong> {aiHistory.analyses[selectedAnalysisTab].metrics.distanceToTarget} kr
                </div>
              )}
              {aiHistory.analyses[selectedAnalysisTab].metrics.distanceToStop && (
                <div>
                  <strong>Till stop:</strong> {aiHistory.analyses[selectedAnalysisTab].metrics.distanceToStop} kr
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{
          marginTop: "16px",
          fontSize: "12px",
          color: "#64748b",
          borderTop: "1px solid #e2e8f0",
          paddingTop: "12px"
        }}>
          <strong>Obs:</strong> AI-analysen följer strikta stop-management och time stop-regler.
          Den ersätter INTE ditt eget omdöme men ger objektiv vägledning baserad på professionella swing trading-principer.
        </div>
      </div>
      {/* ============================================ */}
      {/* 4️⃣ TIDSAXEL / HÄNDELSELOGG */}
      {/* ============================================ */}
      <div className="card" style={{ marginTop: "24px" }}>
        <h3 style={{ margin: "0 0 16px 0" }}>Händelselogg</h3>

        {events.length === 0 ? (
          <p style={{ color: "#64748b", textAlign: "center", padding: "20px" }}>
            Inga händelser registrerade ännu.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {events.map((event, idx) => {
              // Format timestamp: "2025-12-28 14:23"
              const timestamp = event.created_at
                ? new Date(event.created_at).toLocaleString('sv-SE', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  }).replace(',', '')
                : event.event_date || event.date || '';

              return (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: "8px",
                    padding: "12px",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    fontSize: "14px"
                  }}
                >
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px"
                  }}>
                    <div style={{ color: "#64748b", fontWeight: "500", fontSize: "12px" }}>
                      {timestamp}
                    </div>
                    <div style={{
                      fontWeight: "600",
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: event.event_type === 'ENTRY' ? "#dcfce7" :
                                 event.event_type === 'EXIT' ? "#fee2e2" :
                                 event.event_type === 'PARTIAL_EXIT' ? "#ffedd5" :
                                 event.event_type === 'STOP_MOVED' ? "#dbeafe" :
                                 event.event_type === 'NOTE' ? "#f3e8ff" : "#f1f5f9",
                      color: event.event_type === 'ENTRY' ? "#16a34a" :
                             event.event_type === 'EXIT' ? "#dc2626" :
                             event.event_type === 'PARTIAL_EXIT' ? "#f59e0b" :
                             event.event_type === 'STOP_MOVED' ? "#3b82f6" :
                             event.event_type === 'NOTE' ? "#8b5cf6" : "#64748b"
                    }}>
                      {event.event_type}
                    </div>
                  </div>
                  <div style={{ color: "#0f172a", fontSize: "13px", lineHeight: "1.5" }}>
                    {event.description}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* 📔 HANDELSJOURNAL */}
      {/* ============================================ */}
      {journalEntries.length > 0 && (
        <div className="card" style={{ marginTop: "24px", background: "#fffbeb", border: "2px solid #fbbf24" }}>
          <h3 style={{ margin: "0 0 16px 0", color: "#92400e" }}>📔 Handelsjournal</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {journalEntries.map((entry, idx) => {
              const typeLabel = entry.type === 'observation' ? '👁️ Observation' :
                               entry.type === 'decision' ? '✓ Beslut' :
                               entry.type === 'emotion' ? '💭 Känslor' :
                               entry.type === 'lesson' ? '💡 Lärdom' :
                               entry.type === 'mistake' ? '⚠️ Misstag' : entry.type;

              return (
                <div
                  key={idx}
                  style={{
                    padding: "12px",
                    background: "white",
                    borderRadius: "6px",
                    border: "1px solid #fde68a",
                    fontSize: "14px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div style={{ color: "#92400e", fontWeight: "600", fontSize: "12px" }}>
                      {typeLabel}
                    </div>
                    <div style={{ color: "#a16207", fontSize: "12px" }}>{entry.date}</div>
                  </div>
                  <div style={{ color: "#0f172a", lineHeight: "1.6" }}>
                    {entry.setup_notes || entry.lessons_learned || "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* 5️⃣ POST-EXIT JOURNAL (only if exited) */}
      {/* ============================================ */}
      {isExited && (
        <div className="card" style={{ marginTop: "24px", background: "#f0fdf4", border: "2px solid #86efac" }}>
          <h3 style={{ margin: "0 0 16px 0", color: "#166534" }}>Post-Exit Journal</h3>

          <table style={{ width: "100%", fontSize: "14px", marginBottom: "20px" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #dcfce7" }}>
                <td style={{ padding: "8px 0", color: "#64748b", width: "40%" }}>Exit-datum</td>
                <td style={{ padding: "8px 0", fontWeight: "600" }}>{position.exit_date || "—"}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #dcfce7" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Exit-pris</td>
                <td style={{ padding: "8px 0", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                  {position.exit_price?.toFixed(2) || "—"}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #dcfce7" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Resultat</td>
                <td style={{ padding: "8px 0", fontWeight: "700", fontSize: "16px", color: rColor, fontVariantNumeric: "tabular-nums" }}>
                  {rMultiple > 0 ? '+' : ''}{rMultiple.toFixed(1)}R
                </td>
              </tr>
              <tr>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Exit-typ</td>
                <td style={{ padding: "8px 0", fontWeight: "600" }}>{position.exit_type || "—"}</td>
              </tr>
            </tbody>
          </table>

          {/* Self-evaluation checklist */}
          {position.exit_checklist && (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#64748b", marginBottom: "8px" }}>
                SJÄLVUTVÄRDERING
              </div>
              <div style={{ display: "grid", gap: "6px" }}>
                {position.exit_checklist.followed_plan && (
                  <div style={{ fontSize: "14px" }}>✅ Följde planen</div>
                )}
                {position.exit_checklist.exit_too_early && (
                  <div style={{ fontSize: "14px" }}>⚠️ Tog exit för tidigt</div>
                )}
                {position.exit_checklist.let_market_decide && (
                  <div style={{ fontSize: "14px" }}>✅ Lät marknaden slå ut mig</div>
                )}
                {position.exit_checklist.good_entry_bad_exit && (
                  <div style={{ fontSize: "14px" }}>⚠️ Bra entry men dålig exit</div>
                )}
                {position.exit_checklist.broke_rules && (
                  <div style={{ fontSize: "14px" }}>❌ Bröt mot regler</div>
                )}
              </div>
            </div>
          )}

          {/* Lessons learned */}
          <div style={{ padding: "16px", background: "white", borderRadius: "8px", border: "1px solid #dcfce7" }}>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#64748b", marginBottom: "8px" }}>
              LÄRDOM
            </div>
            <div style={{ fontSize: "14px", color: "#0f172a", lineHeight: "1.6" }}>
              {position.lessons_learned || "Ingen lärdom registrerad."}
            </div>
          </div>
        </div>
      )}

      {/* AI Rules Modal */}
      {showRulesModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px"
          }}
          onClick={() => setShowRulesModal(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              maxWidth: "900px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              position: "sticky",
              top: 0,
              background: "white",
              borderBottom: "2px solid #e5e7eb",
              padding: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0f172a" }}>
                📋 AI-Analys Regelbok
              </h2>
              <button
                onClick={() => setShowRulesModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: "4px 8px"
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: "24px", lineHeight: "1.6" }}>
              {/* STOP-FLYTT-SCHEMA */}
              <section style={{ marginBottom: "32px" }}>
                <h3 style={{ color: "#0f172a", marginBottom: "16px" }}>A) STOP-FLYTT-SCHEMA (5 nivåer)</h3>

                <div style={{ marginBottom: "20px", padding: "16px", background: "#fafafa", borderLeft: "4px solid #94a3b8", borderRadius: "4px" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#475569" }}>🔒 Nivå 0 – INITIALT LÄGE</h4>
                  <p style={{ margin: "4px 0" }}><strong>Villkor:</strong> Priset mellan initial stop och ~entry + 0.5R, ingen ny struktur</p>
                  <p style={{ margin: "4px 0" }}><strong>Åtgärd:</strong> Stop = initial stop, INGEN flytt, INGEN delvinst</p>
                  <p style={{ margin: "4px 0", fontStyle: "italic", color: "#64748b" }}><strong>Filosofi:</strong> De flesta förstör trades genom att göra något i onödan</p>
                </div>

                <div style={{ marginBottom: "20px", padding: "16px", background: "#fefce8", borderLeft: "4px solid #fbbf24", borderRadius: "4px" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#92400e" }}>🟡 Nivå 1 – Tidig rörelse (+0.5R till +1R)</h4>
                  <p style={{ margin: "4px 0" }}><strong>Villkor:</strong> Pris når +0.5R till +1R</p>
                  <p style={{ margin: "4px 0" }}><strong>Åtgärd:</strong> Stop FLYTTAS INTE, ingen vinst tas, endast observation</p>
                  <p style={{ margin: "4px 0", fontStyle: "italic", color: "#92400e" }}><strong>Filosofi:</strong> Vinst är inte intjänad förrän marknaden skapar struktur</p>
                </div>

                <div style={{ marginBottom: "20px", padding: "16px", background: "#f0fdf4", borderLeft: "4px solid #22c55e", borderRadius: "4px" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#15803d" }}>🟢 Nivå 2 – Första BEKRÄFTADE styrkan</h4>
                  <p style={{ margin: "4px 0" }}><strong>Trigger:</strong></p>
                  <ul style={{ margin: "4px 0", paddingLeft: "20px" }}>
                    <li>Dagstängning ≥ Entry + 1R, ELLER</li>
                    <li>Högre high + tydlig rekyl + ny högre botten</li>
                  </ul>
                  <p style={{ margin: "4px 0" }}><strong>Åtgärd:</strong> Flytta stop till break-even (entry-pris) eller entry + liten buffert</p>
                  <p style={{ margin: "4px 0", fontStyle: "italic", color: "#15803d" }}><strong>Filosofi:</strong> Nu är traden riskfri – men fortfarande levande</p>
                </div>

                <div style={{ marginBottom: "20px", padding: "16px", background: "#eff6ff", borderLeft: "4px solid #3b82f6", borderRadius: "4px" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#1e40af" }}>🔵 Nivå 3 – Strukturell trend etablerad</h4>
                  <p style={{ margin: "4px 0" }}><strong>Trigger:</strong> Nytt högre high + kontrollerad rekyl + nytt högre swing-low</p>
                  <p style={{ margin: "4px 0" }}><strong>Åtgärd:</strong> Flytta stop till under senaste swing-low</p>
                  <p style={{ margin: "4px 0", fontStyle: "italic", color: "#1e40af" }}><strong>Filosofi:</strong> Här börjar du låsa marknadsstruktur, inte kronor</p>
                </div>

                <div style={{ marginBottom: "20px", padding: "16px", background: "#faf5ff", borderLeft: "4px solid #a855f7", borderRadius: "4px" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#7e22ce" }}>🟣 Nivå 4 – Target-zon (≥2R)</h4>
                  <p style={{ margin: "4px 0" }}><strong>Trigger:</strong> Pris ≥ target</p>
                  <p style={{ margin: "4px 0" }}><strong>Åtgärd:</strong></p>
                  <ul style={{ margin: "4px 0", paddingLeft: "20px" }}>
                    <li>Mekanisk exit (hela positionen vid target), ELLER</li>
                    <li>Ta 50% vid target + trailing stop på resterande</li>
                  </ul>
                  <p style={{ margin: "4px 0", fontStyle: "italic", color: "#7e22ce" }}><strong>Filosofi:</strong> Här slutar analys – nu är det förvaltning</p>
                </div>
              </section>

              {/* TIDSGRÄNSER */}
              <section style={{ marginBottom: "32px" }}>
                <h3 style={{ color: "#0f172a", marginBottom: "16px" }}>B) TIDSGRÄNSER (Time Stops)</h3>

                <div style={{ marginBottom: "20px", padding: "16px", background: "#fefce8", borderLeft: "4px solid #fbbf24", borderRadius: "4px" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#92400e" }}>🟡 Nivå 1 – Early warning (3-5 dagar)</h4>
                  <p style={{ margin: "4px 0" }}><strong>Fråga:</strong> Har aktien gjort något som bekräftar idén?</p>
                  <p style={{ margin: "4px 0" }}><strong>Bekräftelse:</strong> Högre high, stängning över entry, volymexpansion</p>
                  <p style={{ margin: "4px 0" }}><strong>Åtgärd:</strong> Markera som svag i journal om NEJ (men ingen exit än)</p>
                </div>

                <div style={{ marginBottom: "20px", padding: "16px", background: "#fff7ed", borderLeft: "4px solid #f97316", borderRadius: "4px" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#c2410c" }}>🟠 Nivå 2 – Operativ time stop (8-12 dagar)</h4>
                  <p style={{ margin: "4px 0" }}><strong>Villkor:</strong> Priset har INTE nått ≥ +1R eller skapat ny struktur</p>
                  <p style={{ margin: "4px 0" }}><strong>Åtgärd:</strong> Exit vid nästa rimliga tillfälle</p>
                  <p style={{ margin: "4px 0", fontStyle: "italic", color: "#c2410c" }}><strong>Filosofi:</strong> Momentumhypotesen är förbrukad, kapitalet kan arbeta bättre någon annanstans</p>
                </div>

                <div style={{ marginBottom: "20px", padding: "16px", background: "#fef2f2", borderLeft: "4px solid #ef4444", borderRadius: "4px" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#991b1b" }}>🔴 Nivå 3 – Absolut maxgräns (15-20 dagar)</h4>
                  <p style={{ margin: "4px 0" }}><strong>Åtgärd:</strong> Exit oavsett P/L</p>
                  <p style={{ margin: "4px 0", fontStyle: "italic", color: "#991b1b" }}><strong>Filosofi:</strong> Disciplinregel – inte marknadsanalys</p>
                </div>
              </section>

              {/* KÄRNREGEL */}
              <section style={{ marginBottom: "32px", padding: "20px", background: "#fef2f2", border: "2px solid #ef4444", borderRadius: "8px" }}>
                <h3 style={{ color: "#991b1b", marginBottom: "12px" }}>⚠️ KÄRNREGEL (aldrig bryt denna)</h3>
                <p style={{ fontSize: "16px", fontWeight: "600", color: "#dc2626", marginBottom: "12px" }}>
                  ❌ Flytta ALDRIG stop uppåt utan:
                </p>
                <ul style={{ marginLeft: "20px", color: "#991b1b" }}>
                  <li>Ny struktur (högre swing-low bekräftad), ELLER</li>
                  <li>Tydlig regel aktiverad (1R nådd → BE, target nådd → trailing)</li>
                </ul>
                <p style={{ marginTop: "12px", fontWeight: "600", color: "#991b1b" }}>
                  <strong>Varför?</strong> Om du bryter denna regel kollapsar din expectancy, även bra analyser slutar fungera.
                </p>
              </section>

              {/* Vad AI:n gör */}
              <section style={{ marginBottom: "32px" }}>
                <h3 style={{ color: "#0f172a", marginBottom: "16px" }}>Vad AI:n GÖR och INTE GÖR</h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div style={{ padding: "16px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #22c55e" }}>
                    <h4 style={{ color: "#15803d", marginBottom: "12px" }}>✅ Vad AI:n GÖR:</h4>
                    <ul style={{ paddingLeft: "20px", color: "#166534" }}>
                      <li>Tillämpar regler mekaniskt</li>
                      <li>Beräknar exakta nivåer</li>
                      <li>Identifierar regelbrott</li>
                      <li>Ger konkreta åtgärder</li>
                    </ul>
                  </div>

                  <div style={{ padding: "16px", background: "#fef2f2", borderRadius: "8px", border: "1px solid #ef4444" }}>
                    <h4 style={{ color: "#991b1b", marginBottom: "12px" }}>❌ Vad AI:n INTE GÖR:</h4>
                    <ul style={{ paddingLeft: "20px", color: "#991b1b" }}>
                      <li>Förutsäga framtida prisrörelser</li>
                      <li>Ge "känslobaserade" råd</li>
                      <li>Avvika från regelverket</li>
                      <li>Tolka makroekonomisk data</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* AI Configuration */}
              <section style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                <h4 style={{ color: "#475569", marginBottom: "12px" }}>🤖 AI-Konfiguration</h4>
                <ul style={{ paddingLeft: "20px", color: "#64748b" }}>
                  <li><strong>Model:</strong> GPT-4o</li>
                  <li><strong>Temperature:</strong> 0.3 (låg kreativitet, hög precision)</li>
                  <li><strong>Max tokens:</strong> 1500</li>
                  <li><strong>System role:</strong> Strikt regelbaserad rådgivare</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
