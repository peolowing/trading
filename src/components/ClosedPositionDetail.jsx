import { useState, useEffect } from 'react';

export default function ClosedPositionDetail({ ticker, onBack }) {
  const [position, setPosition] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Editable self-evaluation fields
  const [planFollowed, setPlanFollowed] = useState(false);
  const [exitedEarly, setExitedEarly] = useState(false);
  const [stoppedOut, setStoppedOut] = useState(false);
  const [brokeRule, setBrokeRule] = useState(false);
  const [couldScaleBetter, setCouldScaleBetter] = useState(false);
  const [edgeTag, setEdgeTag] = useState('B');
  const [lessonLearned, setLessonLearned] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (ticker) {
      loadPositionDetail();
    }
  }, [ticker]);

  async function loadPositionDetail() {
    try {
      setLoading(true);

      // Load position data
      const posRes = await fetch(`/api/portfolio/${ticker}`);
      if (posRes.ok) {
        const posData = await posRes.json();
        setPosition(posData);

        // Load self-evaluation if exists
        setPlanFollowed(posData.plan_followed || false);
        setExitedEarly(posData.exited_early || false);
        setStoppedOut(posData.stopped_out || false);
        setBrokeRule(posData.broke_rule || false);
        setCouldScaleBetter(posData.could_scale_better || false);
        setEdgeTag(posData.edge_tag || 'B');
        setLessonLearned(posData.lesson_learned || '');
      }

      // Load events
      const eventsRes = await fetch(`/api/portfolio/${ticker}/events`);
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData);
      }
    } catch (e) {
      console.error('Load closed position detail error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEvaluation() {
    try {
      setIsSaving(true);

      const res = await fetch(`/api/portfolio/${ticker}/evaluation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_followed: planFollowed,
          exited_early: exitedEarly,
          stopped_out: stoppedOut,
          broke_rule: brokeRule,
          could_scale_better: couldScaleBetter,
          edge_tag: edgeTag,
          lesson_learned: lessonLearned
        })
      });

      if (res.ok) {
        alert('✅ Utvärdering sparad!');
        await loadPositionDetail();
      } else {
        alert('❌ Kunde inte spara utvärdering');
      }
    } catch (e) {
      console.error('Save evaluation error:', e);
      alert('❌ Fel vid sparning');
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <p>Laddar position...</p>
      </div>
    );
  }

  if (!position) {
    return (
      <div className="container">
        <p>Position hittades inte</p>
      </div>
    );
  }

  // Calculations
  const rMultiple = position.r_multiple || 0;
  const pnlPct = position.pnl_pct || 0;
  const rColor = rMultiple > 0 ? '#16a34a' : rMultiple < 0 ? '#dc2626' : '#64748b';
  const pnlColor = pnlPct > 0 ? '#16a34a' : pnlPct < 0 ? '#dc2626' : '#64748b';
  const resultIcon = rMultiple > 0 ? '🟢' : '🔴';

  // PnL i kronor
  const pnlKr = position.quantity && position.exit_price && position.entry_price
    ? position.quantity * (position.exit_price - position.entry_price)
    : 0;

  // Days in trade
  const entryDate = position.entry_date ? new Date(position.entry_date) : null;
  const exitDate = position.exit_date ? new Date(position.exit_date) : null;
  const daysInTrade = entryDate && exitDate
    ? Math.ceil((exitDate - entryDate) / (1000 * 60 * 60 * 24))
    : '—';

  return (
    <div className="container">
      {/* ============================================ */}
      {/* 1️⃣ HEADER – RESULTATSNAPSHOT */}
      {/* ============================================ */}
      <header style={{
        background: "white",
        padding: "16px 20px",
        borderRadius: "8px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        marginBottom: "20px"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", display: "flex", alignItems: "center", gap: "8px" }}>
            {ticker}
            <span style={{ fontSize: "24px" }}>{resultIcon}</span>
          </h1>
          <button
            onClick={onBack}
            style={{
              padding: "6px 12px",
              background: "transparent",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "13px",
              color: "#64748b",
              cursor: "pointer"
            }}
          >
            ← Tillbaka
          </button>
        </div>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "14px", fontWeight: "600" }}>
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
            <span style={{ color: "#64748b", fontSize: "11px", marginRight: "4px" }}>Resultat:</span>
            <span style={{ color: pnlColor, fontVariantNumeric: "tabular-nums" }}>
              {pnlKr > 0 ? '+' : ''}{pnlKr.toFixed(0)} kr
            </span>
          </div>
          <div>
            <span style={{ color: "#64748b", fontSize: "11px", marginRight: "4px" }}>Dagar:</span>
            <span>{daysInTrade}d</span>
          </div>
          <div>
            <span style={{ color: "#64748b", fontSize: "11px", marginRight: "4px" }}>Exit:</span>
            <span>{position.exit_type || '—'}</span>
          </div>
          <div>
            <span style={{ color: "#64748b", fontSize: "11px", marginRight: "4px" }}>Setup:</span>
            <span>{position.entry_setup || '—'}</span>
          </div>
        </div>
      </header>

      {/* ============================================ */}
      {/* 2️⃣ ENTRY – LÅST SNAPSHOT */}
      {/* ============================================ */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: "6px" }}>
          <span>🔒</span> Entry Snapshot
        </h3>
        <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "16px" }}>
          Vad visste jag när jag tog risken?
        </p>

        <table style={{ width: "100%", fontSize: "14px" }}>
          <tbody>
            <tr>
              <td style={labelStyle}>Entry-datum</td>
              <td style={valueStyle}>{position.entry_date || '—'}</td>
              <td style={labelStyle}>Entry-pris</td>
              <td style={valueStyle}>{position.entry_price?.toFixed(2) || '—'} kr</td>
            </tr>
            <tr>
              <td style={labelStyle}>Initial stop</td>
              <td style={valueStyle}>{position.initial_stop?.toFixed(2) || '—'} kr</td>
              <td style={labelStyle}>Initial target</td>
              <td style={valueStyle}>{position.initial_target?.toFixed(2) || '—'} kr</td>
            </tr>
            <tr>
              <td style={labelStyle}>Position size</td>
              <td style={valueStyle}>{position.quantity || '—'} st</td>
              <td style={labelStyle}>Initial R</td>
              <td style={valueStyle}>{position.initial_r?.toFixed(2) || '—'} kr/aktie</td>
            </tr>
            <tr>
              <td style={labelStyle}>Risk (kr)</td>
              <td style={valueStyle}>{position.risk_kr?.toFixed(0) || '—'} kr</td>
              <td style={labelStyle}>Risk (%)</td>
              <td style={valueStyle}>{position.risk_pct?.toFixed(1) || '—'}%</td>
            </tr>
            <tr>
              <td style={labelStyle}>Setup</td>
              <td style={valueStyle}>{position.entry_setup || '—'}</td>
              <td style={labelStyle}>Watchlist status</td>
              <td style={valueStyle}>{position.watchlist_status || '—'}</td>
            </tr>
            <tr>
              <td style={labelStyle}>RSI vid entry</td>
              <td style={valueStyle}>{position.initial_rsi14?.toFixed(1) || '—'}</td>
              <td style={labelStyle}>EMA20 vid entry</td>
              <td style={valueStyle}>{position.initial_ema20?.toFixed(2) || '—'}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: "16px", padding: "12px", background: "#f8fafc", borderRadius: "6px", borderLeft: "3px solid #4f46e5" }}>
          <p style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#64748b", marginBottom: "4px" }}>
            Entry Rationale
          </p>
          <p style={{ margin: 0, fontSize: "14px", color: "#0f172a" }}>
            {position.entry_rationale || 'Ingen entry-motivering registrerad.'}
          </p>
        </div>
      </div>

      {/* ============================================ */}
      {/* 3️⃣ FÖRVALTNING – HÄNDELSELOGG */}
      {/* ============================================ */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <h3 style={{ marginTop: 0 }}>📋 Händelselogg</h3>
        <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "16px" }}>
          Hur lät jag marknaden jobba?
        </p>

        {events.length === 0 && (
          <p style={{ color: "#94a3b8", fontSize: "14px" }}>Inga händelser registrerade</p>
        )}

        {events.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {events.map((event, idx) => (
              <div
                key={idx}
                style={{
                  padding: "10px 12px",
                  background: "#fafbfc",
                  borderRadius: "6px",
                  borderLeft: "3px solid " + getEventColor(event.event_type),
                  fontSize: "13px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontWeight: "600", color: "#0f172a" }}>{event.event_type}</span>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>{event.event_date}</span>
                </div>
                <p style={{ margin: 0, color: "#475569" }}>{event.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* 4️⃣ EXIT – FAKTA & ORSAK */}
      {/* ============================================ */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <h3 style={{ marginTop: 0 }}>🚪 Exit – Fakta & Orsak</h3>
        <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "16px" }}>
          Varför slutade traden?
        </p>

        <table style={{ width: "100%", fontSize: "14px" }}>
          <tbody>
            <tr>
              <td style={labelStyle}>Exit-datum</td>
              <td style={valueStyle}>{position.exit_date || '—'}</td>
              <td style={labelStyle}>Exit-pris (snitt)</td>
              <td style={valueStyle}>{position.exit_price?.toFixed(2) || '—'} kr</td>
            </tr>
            <tr>
              <td style={labelStyle}>Exit-typ</td>
              <td style={valueStyle}>{position.exit_type || '—'}</td>
              <td style={labelStyle}>R vid exit</td>
              <td style={{ ...valueStyle, color: rColor, fontWeight: "600" }}>
                {rMultiple > 0 ? '+' : ''}{rMultiple.toFixed(1)}R
              </td>
            </tr>
            <tr>
              <td style={labelStyle}>Max MFE (gynnsammast)</td>
              <td style={valueStyle}>{position.max_mfe?.toFixed(1) || '—'}R</td>
              <td style={labelStyle}>Max MAE (värst)</td>
              <td style={valueStyle}>{position.max_mae?.toFixed(1) || '—'}R</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ============================================ */}
      {/* 5️⃣ SJÄLVUTVÄRDERING (STRUKTURERAD) */}
      {/* ============================================ */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <h3 style={{ marginTop: 0 }}>✏️ Självutvärdering</h3>
        <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "16px" }}>
          Detta bygger edge.
        </p>

        {/* Checkboxes */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={planFollowed}
              onChange={(e) => setPlanFollowed(e.target.checked)}
              style={{ width: "18px", height: "18px", cursor: "pointer" }}
            />
            <span style={{ fontSize: "14px" }}>Följde planen</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={exitedEarly}
              onChange={(e) => setExitedEarly(e.target.checked)}
              style={{ width: "18px", height: "18px", cursor: "pointer" }}
            />
            <span style={{ fontSize: "14px" }}>Tog exit för tidigt</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={stoppedOut}
              onChange={(e) => setStoppedOut(e.target.checked)}
              style={{ width: "18px", height: "18px", cursor: "pointer" }}
            />
            <span style={{ fontSize: "14px" }}>Lät marknaden slå ut mig</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={brokeRule}
              onChange={(e) => setBrokeRule(e.target.checked)}
              style={{ width: "18px", height: "18px", cursor: "pointer" }}
            />
            <span style={{ fontSize: "14px" }}>Bröt regel</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={couldScaleBetter}
              onChange={(e) => setCouldScaleBetter(e.target.checked)}
              style={{ width: "18px", height: "18px", cursor: "pointer" }}
            />
            <span style={{ fontSize: "14px" }}>Kunde skala bättre</span>
          </label>
        </div>

        {/* Edge Tag */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px", color: "#64748b" }}>
            Kvalitet (Edge Tag)
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            {['A', 'B', 'C'].map(tag => (
              <button
                key={tag}
                onClick={() => setEdgeTag(tag)}
                style={{
                  padding: "8px 16px",
                  background: edgeTag === tag
                    ? (tag === 'A' ? '#dcfce7' : tag === 'B' ? '#fef9c3' : '#fee2e2')
                    : 'white',
                  color: edgeTag === tag
                    ? (tag === 'A' ? '#16a34a' : tag === 'B' ? '#ca8a04' : '#dc2626')
                    : '#64748b',
                  border: "1px solid " + (edgeTag === tag
                    ? (tag === 'A' ? '#16a34a' : tag === 'B' ? '#ca8a04' : '#dc2626')
                    : '#e2e8f0'),
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSaveEvaluation}
          disabled={isSaving}
          style={{
            padding: "10px 20px",
            background: "#4f46e5",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: isSaving ? "not-allowed" : "pointer",
            opacity: isSaving ? 0.6 : 1
          }}
        >
          {isSaving ? 'Sparar...' : '💾 Spara utvärdering'}
        </button>
      </div>

      {/* ============================================ */}
      {/* 6️⃣ LÄRDOM (FRI TEXT) */}
      {/* ============================================ */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>💡 Lärdom</h3>
        <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "16px" }}>
          1–3 meningar max. Vad tar jag med mig till nästa gång?
        </p>

        <textarea
          value={lessonLearned}
          onChange={(e) => setLessonLearned(e.target.value)}
          placeholder="Exempel: Del-exit vid +2R fungerade. Kunde låtit sista delen löpa längre; EMA20 höll två dagar till."
          rows={4}
          style={{
            width: "100%",
            padding: "12px",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            fontSize: "14px",
            fontFamily: "inherit",
            resize: "vertical"
          }}
        />
      </div>
    </div>
  );
}

function getEventColor(eventType) {
  const colors = {
    'ENTRY': '#4f46e5',
    'STOP_MOVED': '#f59e0b',
    'PARTIAL_EXIT': '#3b82f6',
    'EXIT': '#dc2626',
    'NOTE': '#64748b'
  };
  return colors[eventType] || '#94a3b8';
}

const labelStyle = {
  padding: "8px 0",
  fontSize: "13px",
  color: "#64748b",
  fontWeight: "500",
  width: "30%"
};

const valueStyle = {
  padding: "8px 0",
  fontSize: "14px",
  color: "#0f172a",
  fontWeight: "500",
  width: "20%"
};
