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
      if (positions.length > 0) {
        setPosition(positions[0]);
      }

      // Fetch event log for this position
      const eventsRes = await fetch(`/api/portfolio/events?ticker=${ticker}`);
      const eventsData = await eventsRes.json();
      setEvents(eventsData.events || []);

      // Fetch journal entries for this position
      const journalRes = await fetch(`/api/trades?ticker=${ticker}`);
      const journalData = await journalRes.json();
      setJournalEntries(journalData.trades || []);

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
          <button className="ghost" onClick={onBack}>← Tillbaka till Dashboard</button>
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
      <header className="header" style={{ marginBottom: "24px" }}>
        <div>
          <p className="eyebrow">Position Detail</p>
          <h1 style={{ fontSize: "32px", margin: "8px 0", display: "flex", alignItems: "center", gap: "12px" }}>
            {ticker}
            <span style={{ fontSize: "28px" }}>{statusIcon}</span>
            <span style={{ fontSize: "18px", fontWeight: "600", color: "#64748b" }}>{statusLabel}</span>
          </h1>

          {/* Compact metrics */}
          <div style={{ display: "flex", gap: "24px", marginTop: "12px", fontSize: "16px", fontWeight: "600" }}>
            <div>
              <span style={{ color: "#64748b", fontSize: "12px", marginRight: "6px" }}>R:</span>
              <span style={{ color: rColor, fontVariantNumeric: "tabular-nums" }}>
                {rMultiple > 0 ? '+' : ''}{rMultiple.toFixed(1)}R
              </span>
            </div>
            <div>
              <span style={{ color: "#64748b", fontSize: "12px", marginRight: "6px" }}>PnL:</span>
              <span style={{ color: pnlColor, fontVariantNumeric: "tabular-nums" }}>
                {pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(1)}%
              </span>
            </div>
            <div>
              <span style={{ color: "#64748b", fontSize: "12px", marginRight: "6px" }}>Dagar:</span>
              <span style={{ color: "#0f172a" }}>{daysInTrade}d</span>
            </div>
            {position.entry_date && (
              <div>
                <span style={{ color: "#64748b", fontSize: "12px", marginRight: "6px" }}>Entry:</span>
                <span style={{ color: "#0f172a" }}>{position.entry_date}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button className="ghost" onClick={onBack}>← Dashboard</button>
          {!isExited && (
            <button
              className="ghost"
              style={{ background: "#dc2626", color: "white", borderColor: "#dc2626" }}
              onClick={() => setShowExitForm(!showExitForm)}
            >
              {showExitForm ? "Stäng Exit" : "Exit Position"}
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
                <td style={{ padding: "8px 0", fontWeight: "700", fontSize: "16px", fontVariantNumeric: "tabular-nums" }}>
                  {currentPrice.toFixed(2)}
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
                          padding: "4px 8px",
                          border: "2px solid #3b82f6",
                          borderRadius: "4px",
                          fontSize: "14px",
                          fontWeight: "600"
                        }}
                      />
                      <button
                        onClick={handleUpdateStop}
                        style={{
                          padding: "4px 8px",
                          background: "#16a34a",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px"
                        }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingStop(false)}
                        style={{
                          padding: "4px 8px",
                          background: "#64748b",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px"
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
                          padding: "4px 8px",
                          border: "2px solid #3b82f6",
                          borderRadius: "4px",
                          fontSize: "14px",
                          fontWeight: "600",
                          background: "white"
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
                          padding: "4px 8px",
                          background: "#16a34a",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px"
                        }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingTrailing(false)}
                        style={{
                          padding: "4px 8px",
                          background: "#64748b",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px"
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
                          padding: "4px 8px",
                          border: "2px solid #3b82f6",
                          borderRadius: "4px",
                          fontSize: "14px",
                          fontWeight: "600"
                        }}
                      />
                      <button
                        onClick={handleUpdateTarget}
                        style={{
                          padding: "4px 8px",
                          background: "#16a34a",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px"
                        }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingTarget(false)}
                        style={{
                          padding: "4px 8px",
                          background: "#64748b",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px"
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
                    gridTemplateColumns: "140px 120px 1fr",
                    gap: "16px",
                    padding: "12px",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    fontSize: "14px"
                  }}
                >
                  <div style={{ color: "#64748b", fontWeight: "500", fontSize: "13px" }}>{timestamp}</div>
                  <div style={{
                    fontWeight: "600",
                    fontSize: "12px",
                    color: event.event_type === 'ENTRY' ? "#16a34a" :
                           event.event_type === 'EXIT' ? "#dc2626" :
                           event.event_type === 'PARTIAL_EXIT' ? "#f59e0b" :
                           event.event_type === 'STOP_MOVED' ? "#3b82f6" :
                           event.event_type === 'NOTE' ? "#8b5cf6" : "#64748b"
                  }}>
                    {event.event_type}
                  </div>
                  <div style={{ color: "#0f172a" }}>{event.description}</div>
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
    </div>
  );
}
