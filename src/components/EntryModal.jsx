import { useState, useEffect } from 'react';

/**
 * EntryModal - Komplett entry-formulär för övergång från watchlist till portfolio
 *
 * 3 sektioner:
 * 1. Snapshot (automatisk data från watchlist - read-only)
 * 2. Entry Form (manuell data - obligatorisk)
 * 3. Risk Preview (live uträkningar)
 */
export default function EntryModal({ stock, onClose, onConfirm }) {
  // Manual entry data
  const [formData, setFormData] = useState({
    entry_price: stock?.current_price || '',
    position_size: '',
    position_value: '',
    initial_stop: '',
    initial_target: '',
    risk_per_trade_kr: '',
    risk_per_trade_pct: '',
    entry_rationale: '',
    // Checkboxes
    trend_is_up: false,
    follows_setup: false,
    stop_defined: false,
    rr_adequate: false,
    no_rules_broken: false
  });

  // Live calculations
  const [riskCalc, setRiskCalc] = useState({
    risk_kr: 0,
    risk_pct: 0,
    rr_ratio: 0,
    distance_to_stop_pct: 0,
    distance_to_target_pct: 0,
    r_value: 0
  });

  // Update calculations whenever form data changes
  useEffect(() => {
    calculateRisk();
  }, [formData.entry_price, formData.initial_stop, formData.initial_target, formData.position_size, formData.position_value]);

  function calculateRisk() {
    const entry = parseFloat(formData.entry_price);
    const stop = parseFloat(formData.initial_stop);
    const target = parseFloat(formData.initial_target);
    const size = parseFloat(formData.position_size);
    const value = parseFloat(formData.position_value);

    if (!entry || !stop || !size) {
      setRiskCalc({ risk_kr: 0, risk_pct: 0, rr_ratio: 0, distance_to_stop_pct: 0, distance_to_target_pct: 0, r_value: 0 });
      return;
    }

    const rValue = entry - stop;
    const riskKr = rValue * size;
    const riskPct = (riskKr / (value || (entry * size))) * 100;
    const distanceToStopPct = ((entry - stop) / entry) * 100;
    const distanceToTargetPct = target ? ((target - entry) / entry) * 100 : 0;
    const rrRatio = target ? (target - entry) / (entry - stop) : 0;

    setRiskCalc({
      r_value: rValue,
      risk_kr: riskKr,
      risk_pct: riskPct,
      distance_to_stop_pct: distanceToStopPct,
      distance_to_target_pct: distanceToTargetPct,
      rr_ratio: rrRatio
    });
  }

  function handleSubmit(e) {
    e.preventDefault();

    // Validation
    const allCheckboxesChecked =
      formData.trend_is_up &&
      formData.follows_setup &&
      formData.stop_defined &&
      formData.rr_adequate &&
      formData.no_rules_broken;

    if (!allCheckboxesChecked) {
      alert('⚠️ Du måste bekräfta alla regelcheckboxar innan du kan lägga till i portfolio.');
      return;
    }

    if (!formData.entry_rationale || formData.entry_rationale.length < 20) {
      alert('⚠️ Entry rationale måste vara minst 20 tecken (1-2 meningar).');
      return;
    }

    if (riskCalc.rr_ratio < 2.0) {
      const confirm = window.confirm(`⚠️ R/R-ratio är ${riskCalc.rr_ratio.toFixed(2)} (under 2.0). Är du säker?`);
      if (!confirm) return;
    }

    // Combine snapshot + manual data
    const entryData = {
      // From watchlist (automatic snapshot)
      ticker: stock.ticker,
      entry_date: new Date().toISOString().split('T')[0],
      source: 'WATCHLIST',
      watchlist_status: stock.status,
      days_in_watchlist: stock.days_in_watchlist || 0,

      // Technical snapshot (locked)
      snapshot_ema20: stock.ema20,
      snapshot_ema50: stock.ema50,
      snapshot_rsi14: stock.rsi,
      snapshot_rsi_zone: stock.rsi_zone,
      snapshot_volume_rel: stock.volume_rel,
      snapshot_trend_health: stock.trend_pass,

      // System assessment
      edge_score: stock.edge_score,
      watchlist_reason: stock.reason,

      // Manual entry data
      entry_price: parseFloat(formData.entry_price),
      quantity: parseFloat(formData.position_size),
      initial_stop: parseFloat(formData.initial_stop),
      initial_target: parseFloat(formData.initial_target),
      initial_r: riskCalc.r_value,
      entry_rationale: formData.entry_rationale,
      entry_setup: stock.setup || 'Pullback',

      // Risk calculations
      risk_kr: riskCalc.risk_kr,
      risk_pct: riskCalc.risk_pct,
      rr_ratio: riskCalc.rr_ratio,

      // Initial management
      current_price: parseFloat(formData.entry_price),
      current_stop: parseFloat(formData.initial_stop),
      current_target: parseFloat(formData.initial_target),
      current_status: 'HOLD',
      trailing_type: 'EMA20',

      // EMAs for initial tracking
      initial_ema20: stock.ema20,
      initial_ema50: stock.ema50,
      current_ema20: stock.ema20,
      current_ema50: stock.ema50,
      initial_rsi14: stock.rsi
    };

    onConfirm(entryData);
  }

  const daysInWatchlist = stock?.days_in_watchlist || 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        maxWidth: '900px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        padding: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0 }}>Lägg till i Förvaltningslista</h2>
          <button onClick={onClose} className="ghost" style={{ fontSize: '24px', padding: '4px 12px' }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* ========================================== */}
          {/* 1️⃣ SNAPSHOT (READ-ONLY) */}
          {/* ========================================== */}
          <div className="card" style={{ background: '#f0f9ff', border: '2px solid #38bdf8', marginBottom: '24px' }}>
            <h3 style={{ marginTop: 0, color: '#0369a1' }}>📸 Market Snapshot (vid entry-beslut)</h3>
            <div style={{ fontSize: '14px', color: '#0c4a6e' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <strong>{stock.ticker}</strong> - {stock.name}
                </div>
                <div style={{ textAlign: 'right' }}>
                  Status: <strong>{stock.status}</strong> ({daysInWatchlist} dagar)
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>Pris</div>
                  <div style={{ fontWeight: '600' }}>{stock.current_price?.toFixed(2)} kr</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>RSI(14)</div>
                  <div style={{ fontWeight: '600' }}>{stock.rsi?.toFixed(1)} ({stock.rsi_zone})</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>Volym</div>
                  <div style={{ fontWeight: '600' }}>{stock.volume_rel?.toFixed(1)}x</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>EMA20</div>
                  <div style={{ fontWeight: '600' }}>{stock.ema20?.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>EMA50</div>
                  <div style={{ fontWeight: '600' }}>{stock.ema50?.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>Edge Score</div>
                  <div style={{ fontWeight: '600' }}>{stock.edge_score?.toFixed(1)}</div>
                </div>
              </div>

              {stock.reason && (
                <div style={{ marginTop: '12px', padding: '8px', background: 'white', borderRadius: '4px', fontSize: '12px' }}>
                  <strong>Watchlist-reason:</strong> {stock.reason}
                </div>
              )}
            </div>
          </div>

          {/* ========================================== */}
          {/* 2️⃣ ENTRY FORM (MANUELL DATA) */}
          {/* ========================================== */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ marginTop: 0 }}>🧠 Entry-parametrar (obligatoriskt)</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="form-label">Entry-pris (kr)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.entry_price}
                  onChange={(e) => setFormData({...formData, entry_price: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="form-label">Position size (antal aktier)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.position_size}
                  onChange={(e) => setFormData({...formData, position_size: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="form-label">Initial stop (kr)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.initial_stop}
                  onChange={(e) => setFormData({...formData, initial_stop: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="form-label">Initial target (kr)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.initial_target}
                  onChange={(e) => setFormData({...formData, initial_target: e.target.value})}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">Entry Rationale (minst 1-2 meningar)</label>
              <textarea
                className="form-textarea"
                rows="3"
                placeholder="T.ex. 'Pullback mot EMA20 i upptrend. RSI 47 (CALM). Låg volym i rekyl, ingen rapportrisk.'"
                value={formData.entry_rationale}
                onChange={(e) => setFormData({...formData, entry_rationale: e.target.value})}
                required
              />
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                {formData.entry_rationale.length} tecken (minst 20 krävs)
              </div>
            </div>

            <div style={{ marginTop: '20px', padding: '16px', background: '#fef3c7', borderRadius: '6px' }}>
              <div style={{ fontWeight: '600', marginBottom: '8px', color: '#92400e' }}>Regelbekräftelse</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.trend_is_up}
                    onChange={(e) => setFormData({...formData, trend_is_up: e.target.checked})}
                  />
                  Trenden är upp
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.follows_setup}
                    onChange={(e) => setFormData({...formData, follows_setup: e.target.checked})}
                  />
                  Entry följer min setup
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.stop_defined}
                    onChange={(e) => setFormData({...formData, stop_defined: e.target.checked})}
                  />
                  Stop är definierad
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.rr_adequate}
                    onChange={(e) => setFormData({...formData, rr_adequate: e.target.checked})}
                  />
                  R/R ≥ 2.0
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.no_rules_broken}
                    onChange={(e) => setFormData({...formData, no_rules_broken: e.target.checked})}
                  />
                  Ingen regel bryts
                </label>
              </div>
            </div>
          </div>

          {/* ========================================== */}
          {/* 3️⃣ RISK PREVIEW (LIVE CALCULATIONS) */}
          {/* ========================================== */}
          <div className="card" style={{ background: '#f0fdf4', border: '2px solid #86efac', marginBottom: '24px' }}>
            <h3 style={{ marginTop: 0, color: '#166534' }}>📐 Risk Preview (live)</h3>
            <div style={{ fontSize: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>1R (kr/aktie)</div>
                  <div style={{ fontSize: '20px', fontWeight: '600', color: '#166534' }}>
                    {riskCalc.r_value.toFixed(2)} kr
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Risk (total)</div>
                  <div style={{ fontSize: '20px', fontWeight: '600', color: riskCalc.risk_kr > 0 ? '#dc2626' : '#64748b' }}>
                    {riskCalc.risk_kr.toFixed(0)} kr
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>R/R-ratio</div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: riskCalc.rr_ratio >= 2.0 ? '#16a34a' : riskCalc.rr_ratio >= 1.5 ? '#f59e0b' : '#dc2626'
                  }}>
                    {riskCalc.rr_ratio > 0 ? riskCalc.rr_ratio.toFixed(2) : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Avstånd till stop</div>
                  <div style={{ fontSize: '16px', fontWeight: '600' }}>
                    {riskCalc.distance_to_stop_pct.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Avstånd till target</div>
                  <div style={{ fontSize: '16px', fontWeight: '600' }}>
                    {riskCalc.distance_to_target_pct.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Initial status</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#16a34a' }}>
                    HOLD
                  </div>
                </div>
              </div>

              {riskCalc.risk_kr > 0 && (
                <div style={{ marginTop: '16px', padding: '12px', background: 'white', borderRadius: '6px', fontSize: '13px' }}>
                  <strong>Om du klickar BEKRÄFTA:</strong>
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                    <li>Position flyttas till Förvaltningslistan</li>
                    <li>Entry-händelse loggas med timestamp</li>
                    <li>Trailing stop aktiveras (EMA20)</li>
                    <li>Position Detail-vy öppnas</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* ========================================== */}
          {/* ACTIONS */}
          {/* ========================================== */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" className="ghost" onClick={onClose}>
              Avbryt
            </button>
            <button
              type="submit"
              className="ghost"
              style={{
                background: '#16a34a',
                color: 'white',
                borderColor: '#16a34a',
                fontWeight: '600'
              }}
            >
              ✅ Bekräfta & Lägg till i Portfolio
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
