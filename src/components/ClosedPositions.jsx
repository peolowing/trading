import { useState, useEffect } from 'react';
import { calculatePnlKr, calculateDaysInTrade } from '../../utils/calculations.js';

export default function ClosedPositions({ onSelectPosition, onBack }) {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('r_multiple'); // 'r_multiple' or 'exit_date'

  useEffect(() => {
    loadClosedPositions();
  }, []);

  async function loadClosedPositions() {
    try {
      setLoading(true);
      const res = await fetch('/api/portfolio/closed');
      if (res.ok) {
        const data = await res.json();
        setPositions(data);
      } else {
        console.error('Failed to load closed positions');
      }
    } catch (e) {
      console.error('Load closed positions error:', e);
    } finally {
      setLoading(false);
    }
  }

  function exportToExcel() {
    if (positions.length === 0) {
      alert('Inga positioner att exportera');
      return;
    }

    // CSV header
    const headers = [
      'Ticker',
      'Entry Datum',
      'Exit Datum',
      'Dagar',
      'Entry Pris',
      'Exit Pris',
      'Antal',
      'Setup',
      'Exit Typ',
      'R-Multiple',
      'PnL %',
      'Resultat (kr)',
      'Initial Stop',
      'Initial Target',
      'Initial R',
      'Risk (kr)',
      'Risk %',
      'R/R Ratio',
      'MFE',
      'MAE',
      'Plan Följd',
      'Exitade Tidigt',
      'Stoppades Ut',
      'Bröt Regel',
      'Kunde Skala Bättre',
      'Edge Tag',
      'Lärdom'
    ];

    // CSV rows
    const rows = positions.map(p => {
      const entryDate = p.entry_date || '';
      const exitDate = p.exit_date || '';
      const daysInTrade = calculateDaysInTrade(entryDate, exitDate) || '';
      const pnlKr = calculatePnlKr(p.quantity, p.entry_price, p.exit_price) || '';

      return [
        p.ticker || '',
        entryDate,
        exitDate,
        daysInTrade,
        p.entry_price || '',
        p.exit_price || '',
        p.quantity || '',
        p.entry_setup || '',
        p.exit_type || '',
        p.r_multiple || '',
        p.pnl_pct || '',
        pnlKr,
        p.initial_stop || '',
        p.initial_target || '',
        p.initial_r || '',
        p.risk_kr || '',
        p.risk_pct || '',
        p.rr_ratio || '',
        p.max_mfe || '',
        p.max_mae || '',
        p.plan_followed ? 'Ja' : 'Nej',
        p.exited_early ? 'Ja' : 'Nej',
        p.stopped_out ? 'Ja' : 'Nej',
        p.broke_rule ? 'Ja' : 'Nej',
        p.could_scale_better ? 'Ja' : 'Nej',
        p.edge_tag || '',
        p.lesson_learned ? `"${p.lesson_learned.replace(/"/g, '""')}"` : ''
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `avslutade-affarer-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Sort positions
  const sortedPositions = [...positions].sort((a, b) => {
    if (sortBy === 'r_multiple') {
      return (b.r_multiple || 0) - (a.r_multiple || 0); // Highest R first
    } else {
      return new Date(b.exit_date) - new Date(a.exit_date); // Most recent first
    }
  });

  if (loading) {
    return (
      <div className="loading">
        <p>Laddar avslutade affärer...</p>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <header className="header" style={{
        marginBottom: "20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "28px" }}>Avslutade Affärer</h1>
          <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "14px" }}>
            {positions.length} st
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={exportToExcel}
            style={{
              padding: "6px 12px",
              background: "#16a34a",
              border: "1px solid #16a34a",
              borderRadius: "6px",
              fontSize: "13px",
              color: "white",
              cursor: "pointer",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            📊 Exportera till Excel
          </button>
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
            ← Dashboard
          </button>
        </div>
      </header>

      {/* Sort Toggle */}
      <div style={{ marginBottom: "20px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#64748b" }}>Sortera:</span>
          <button
            onClick={() => setSortBy('r_multiple')}
            style={{
              padding: "6px 12px",
              background: sortBy === 'r_multiple' ? "#4f46e5" : "white",
              color: sortBy === 'r_multiple' ? "white" : "#64748b",
              border: "1px solid " + (sortBy === 'r_multiple' ? "#4f46e5" : "#e2e8f0"),
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.15s"
            }}
          >
            Bästa R
          </button>
          <button
            onClick={() => setSortBy('exit_date')}
            style={{
              padding: "6px 12px",
              background: sortBy === 'exit_date' ? "#4f46e5" : "white",
              color: sortBy === 'exit_date' ? "white" : "#64748b",
              border: "1px solid " + (sortBy === 'exit_date' ? "#4f46e5" : "#e2e8f0"),
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.15s"
            }}
          >
            Senaste
          </button>
        </div>
      </div>

      {/* Empty State */}
      {positions.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "40px" }}>
          <p style={{ color: "#64748b", margin: 0 }}>Inga avslutade affärer ännu</p>
        </div>
      )}

      {/* Table */}
      {positions.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%",
            background: "white",
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            borderCollapse: "collapse"
          }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={thStyle}>Resultat</th>
                <th style={thStyle}>Aktie</th>
                <th style={thStyle}>Setup</th>
                <th style={thStyle}>R</th>
                <th style={thStyle}>PnL %</th>
                <th style={thStyle}>Dagar</th>
                <th style={thStyle}>Exit-typ</th>
                <th style={thStyle}>Plan-följd</th>
                <th style={thStyle}>Edge</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {sortedPositions.map(pos => {
                const rMultiple = pos.r_multiple || 0;
                const pnlPct = pos.pnl_pct || 0;
                const isWin = rMultiple > 0;
                const resultIcon = isWin ? '🟢' : '🔴';
                const rColor = rMultiple > 0 ? '#16a34a' : rMultiple < 0 ? '#dc2626' : '#64748b';
                const pnlColor = pnlPct > 0 ? '#16a34a' : pnlPct < 0 ? '#dc2626' : '#64748b';

                // Days in trade
                const entryDate = pos.entry_date ? new Date(pos.entry_date) : null;
                const exitDate = pos.exit_date ? new Date(pos.exit_date) : null;
                const daysInTrade = entryDate && exitDate
                  ? Math.ceil((exitDate - entryDate) / (1000 * 60 * 60 * 24))
                  : '—';

                return (
                  <tr
                    key={pos.ticker}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer",
                      transition: "background 0.15s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#fafbfc"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "white"}
                    onClick={() => onSelectPosition(pos.ticker)}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontSize: "18px" }}>{resultIcon}</span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: "600" }}>{pos.ticker}</td>
                    <td style={tdStyle}>{pos.entry_setup || '—'}</td>
                    <td style={{ ...tdStyle, color: rColor, fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                      {rMultiple > 0 ? '+' : ''}{rMultiple.toFixed(1)}R
                    </td>
                    <td style={{ ...tdStyle, color: pnlColor, fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                      {pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                    </td>
                    <td style={tdStyle}>{daysInTrade}d</td>
                    <td style={tdStyle}>{pos.exit_type || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{ fontSize: "16px" }}>
                        {pos.plan_followed ? '✓' : '✗'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: "600" }}>
                      <span style={{
                        display: "inline-block",
                        width: "24px",
                        height: "24px",
                        lineHeight: "24px",
                        borderRadius: "4px",
                        background: pos.edge_tag === 'A' ? '#dcfce7' : pos.edge_tag === 'B' ? '#fef9c3' : '#fee2e2',
                        color: pos.edge_tag === 'A' ? '#16a34a' : pos.edge_tag === 'B' ? '#ca8a04' : '#dc2626'
                      }}>
                        {pos.edge_tag || '—'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{ fontSize: "16px" }}>🔍</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: "12px",
  fontWeight: "600",
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

const tdStyle = {
  padding: "12px 16px",
  fontSize: "14px",
  color: "#0f172a"
};
