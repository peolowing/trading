import { useState, useEffect } from "react";

export default function Dashboard({ onSelectStock, onNavigate }) {
  const [watchlist, setWatchlist] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [screenerData, setScreenerData] = useState([]);
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [customInput, setCustomInput] = useState("");

  useEffect(() => {
    loadWatchlist();
    loadPortfolio();
    loadScreener();
  }, []);

  // Status icon mapping
  function getStatusIcon(status) {
    switch(status) {
      case 'WAIT_PULLBACK': return '🔵';
      case 'APPROACHING': return '🟡';
      case 'READY': return '🟢';
      case 'BREAKOUT_ONLY': return '🟠';
      case 'INVALIDATED': return '🔴';
      default: return '⚪';
    }
  }

  function getStatusLabel(status) {
    switch(status) {
      case 'WAIT_PULLBACK': return 'Vänta';
      case 'APPROACHING': return 'Närmar sig';
      case 'READY': return 'Klar';
      case 'BREAKOUT_ONLY': return 'Endast breakout';
      case 'INVALIDATED': return 'Ta bort';
      default: return 'Okänd';
    }
  }

  async function loadWatchlist() {
    try {
      const res = await fetch("/api/watchlist");
      const data = await res.json();
      setWatchlist(data.stocks || []);
    } catch (e) {
      console.error("Watchlist error:", e);
    }
  }

  async function loadPortfolio() {
    try {
      const res = await fetch("/api/portfolio");
      const data = await res.json();
      setPortfolio(data.stocks || []);
    } catch (e) {
      console.error("Portfolio error:", e);
    }
  }

  async function loadScreener() {
    setScreenerLoading(true);
    try {
      const res = await fetch("/api/screener");
      const data = await res.json();
      setScreenerData(data.stocks || []);
    } catch (e) {
      console.error("Screener error:", e);
    } finally {
      setScreenerLoading(false);
    }
  }

  async function addToWatchlist(ticker, indicators = null) {
    try {
      const payload = { ticker };

      // If we have indicators from screener, include them for initial snapshot
      if (indicators) {
        payload.indicators = indicators;
      }

      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      await loadWatchlist();
    } catch (e) {
      console.error("Add to watchlist error:", e);
    }
  }

  async function removeFromWatchlist(ticker) {
    try {
      await fetch(`/api/watchlist/${ticker}`, { method: "DELETE" });
      await loadWatchlist();
    } catch (e) {
      console.error("Remove from watchlist error:", e);
    }
  }

  async function removeFromPortfolio(ticker) {
    try {
      await fetch(`/api/portfolio/${ticker}`, { method: "DELETE" });
      await loadPortfolio();
    } catch (e) {
      console.error("Remove from portfolio error:", e);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    if (customInput.trim()) {
      onSelectStock(customInput.trim().toUpperCase());
    }
  }

  return (
    <div className="container">
      <header className="header">
        <div>
          <p className="eyebrow">Veckotrading AI</p>
          <h1>📊 Dashboard</h1>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="ghost" onClick={() => onNavigate("screener-admin")}>
            ⚙️ Screener
          </button>
          <button className="ghost" onClick={() => onNavigate("journal")}>
            📔 Handelsjournal
          </button>
        </div>
      </header>

      {/* Watchlist - Bevakningslista */}
      <div className="card" style={{ marginBottom: "16px" }}>
        <div className="card-header">
          <p className="eyebrow">Bevakningslista – Radar</p>
          <span className="tag">{watchlist.length} aktier</span>
        </div>

        {watchlist.length > 0 && (
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", fontSize: "11px", flexWrap: "wrap" }}>
            <span style={{ color: "#64748b" }}>🔵 Vänta</span>
            <span style={{ color: "#64748b" }}>🟡 Närmar sig</span>
            <span style={{ color: "#64748b" }}>🟢 Klar</span>
            <span style={{ color: "#64748b" }}>🟠 Breakout</span>
            <span style={{ color: "#64748b" }}>🔴 Ta bort</span>
          </div>
        )}

        {watchlist.length === 0 ? (
          <p style={{ color: "#64748b", textAlign: "center", padding: "20px" }}>
            Ingen bevakning ännu. Lägg till aktier från screener nedan.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0", color: "#64748b", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Status</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Aktie</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Läge</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Pris</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>EMA20 Δ%</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>RSI-zon</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Vol×</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Setup</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Trend</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Dagar</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}></th>
                </tr>
              </thead>
              <tbody>
                {watchlist
                  .sort((a, b) => {
                    // Sort READY first, then APPROACHING, then others
                    const statusPriority = {
                      'READY': 1,
                      'APPROACHING': 2,
                      'BREAKOUT_ONLY': 3,
                      'WAIT_PULLBACK': 4,
                      'INVALIDATED': 5
                    };
                    const aPriority = statusPriority[a.current_status] || 99;
                    const bPriority = statusPriority[b.current_status] || 99;
                    return aPriority - bPriority;
                  })
                  .map((item) => {
                    const status = item.current_status || 'WAIT_PULLBACK';
                    const statusIcon = getStatusIcon(status);
                    const statusLabel = getStatusLabel(status);

                    // Row highlighting for READY status
                    const isReady = status === 'READY';
                    const rowBg = isReady ? "#f0fdf4" : "transparent";
                    const rowBorder = isReady ? "2px solid #86efac" : "1px solid #f1f5f9";

                    // EMA20 distance color coding
                    let ema20Color = "#64748b";
                    const emaDist = item.dist_ema20_pct;
                    if (emaDist !== null && emaDist !== undefined) {
                      if (Math.abs(emaDist) <= 1.5) ema20Color = "#16a34a"; // Perfect pullback
                      else if (Math.abs(emaDist) <= 3) ema20Color = "#3b82f6"; // Approaching
                      else if (Math.abs(emaDist) > 5) ema20Color = "#f59e0b"; // Too far
                    }

                    // RSI zone color coding
                    let rsiZoneColor = "#64748b";
                    const rsiZone = item.rsi_zone;
                    if (rsiZone === "CALM") rsiZoneColor = "#16a34a"; // Perfect
                    else if (rsiZone === "WARM") rsiZoneColor = "#3b82f6"; // OK
                    else if (rsiZone === "HOT") rsiZoneColor = "#dc2626"; // Too hot
                    else if (rsiZone === "WEAK") rsiZoneColor = "#f59e0b"; // Weak

                    // Volume state color coding
                    let volColor = "#64748b";
                    const volState = item.volume_state;
                    if (volState === "HIGH") volColor = "#16a34a";
                    else if (volState === "NORMAL") volColor = "#3b82f6";
                    else if (volState === "LOW") volColor = "#94a3b8";

                    // Trend health icon
                    const trendHealthIcon = item.initial_regime === "Bullish Trend" ? "✓" : "—";
                    const trendHealthColor = item.initial_regime === "Bullish Trend" ? "#16a34a" : "#94a3b8";

                    // Setup label
                    const setupLabel = item.initial_setup === "Pullback" ? "PB" :
                                      item.initial_setup === "Breakout" ? "BO" :
                                      item.initial_setup === "Trend Following" ? "TF" :
                                      item.initial_setup === "Reversal" ? "REV" : "—";

                    // Warning icon for long waiting
                    const showWarning = item.days_in_watchlist > 10 && status !== 'READY';

                    // Current price (use initial if no current)
                    const displayPrice = item.current_price || item.initial_price;

                    return (
                      <tr
                        key={item.ticker}
                        style={{
                          borderBottom: rowBorder,
                          background: rowBg,
                          cursor: "pointer",
                          transition: "all 0.15s"
                        }}
                        onMouseEnter={(e) => {
                          if (!isReady) e.currentTarget.style.background = "#f8fafc";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = rowBg;
                        }}
                      >
                        {/* Status Icon */}
                        <td style={{ padding: "10px 12px", textAlign: "center" }} onClick={() => onSelectStock(item.ticker)}>
                          <span style={{ fontSize: "20px" }}>{statusIcon}</span>
                        </td>

                        {/* Aktie */}
                        <td style={{ padding: "10px 12px" }} onClick={() => onSelectStock(item.ticker)}>
                          <strong style={{ color: "#0f172a" }}>{item.ticker}</strong>
                        </td>

                        {/* Status Label */}
                        <td style={{ padding: "10px 12px", fontSize: "12px", color: "#64748b" }} onClick={() => onSelectStock(item.ticker)}>
                          {statusLabel}
                        </td>

                        {/* Pris */}
                        <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }} onClick={() => onSelectStock(item.ticker)}>
                          {displayPrice ? displayPrice.toFixed(2) : "—"}
                        </td>

                        {/* EMA20 Δ% */}
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "600", color: ema20Color, fontVariantNumeric: "tabular-nums" }} onClick={() => onSelectStock(item.ticker)}>
                          {emaDist !== null && emaDist !== undefined ? `${emaDist > 0 ? '+' : ''}${emaDist.toFixed(1)}%` : "—"}
                        </td>

                        {/* RSI-zon */}
                        <td style={{ padding: "10px 12px", textAlign: "center" }} onClick={() => onSelectStock(item.ticker)}>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            color: rsiZoneColor,
                            background: rsiZoneColor === "#16a34a" ? "#f0fdf4" : rsiZoneColor === "#dc2626" ? "#fef2f2" : "#f8fafc",
                            padding: "2px 6px",
                            borderRadius: "4px"
                          }}>
                            {rsiZone || "—"}
                          </span>
                        </td>

                        {/* Vol× */}
                        <td style={{ padding: "10px 12px", textAlign: "center" }} onClick={() => onSelectStock(item.ticker)}>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            color: volColor,
                            background: volColor === "#16a34a" ? "#f0fdf4" : volColor === "#3b82f6" ? "#eff6ff" : "#f8fafc",
                            padding: "2px 6px",
                            borderRadius: "4px"
                          }}>
                            {volState || "—"}
                          </span>
                        </td>

                        {/* Setup */}
                        <td style={{ padding: "10px 12px", textAlign: "center" }} onClick={() => onSelectStock(item.ticker)}>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            color: "#64748b",
                            background: "#f1f5f9",
                            padding: "2px 6px",
                            borderRadius: "4px"
                          }}>
                            {setupLabel}
                          </span>
                        </td>

                        {/* Trend Health */}
                        <td style={{ padding: "10px 12px", textAlign: "center", fontSize: "16px", fontWeight: "700", color: trendHealthColor }} onClick={() => onSelectStock(item.ticker)}>
                          {trendHealthIcon}
                        </td>

                        {/* Dagar + Warning */}
                        <td style={{ padding: "10px 12px", textAlign: "center" }} onClick={() => onSelectStock(item.ticker)}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                            <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
                              {item.days_in_watchlist}d
                            </span>
                            {showWarning && (
                              <span style={{ fontSize: "14px", color: "#f59e0b" }} title={item.time_warning || "Lång väntan"}>⚠︎</span>
                            )}
                          </div>
                        </td>

                        {/* Action Buttons */}
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                            {isReady && (
                              <button
                                className="action-btn"
                                onClick={() => onSelectStock(item.ticker)}
                                title="Öppna chart"
                                style={{
                                  background: "#dcfce7",
                                  border: "1px solid #86efac",
                                  fontSize: "14px",
                                  padding: "4px 8px"
                                }}
                              >
                                📈
                              </button>
                            )}
                            <button
                              className="action-btn delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromWatchlist(item.ticker);
                              }}
                              title="Ta bort från bevakning"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>

            {/* Status reason as second row below table - optional compact info */}
            <div style={{ marginTop: "16px", fontSize: "12px", color: "#64748b" }}>
              <strong>Senaste uppdatering:</strong> Kör <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>POST /api/watchlist/update</code> för daglig statusuppdatering
            </div>
          </div>
        )}
      </div>

      {/* Portfolio - Förvaltningslista */}
      <div className="card" style={{ marginBottom: "16px" }}>
        <div className="card-header">
          <p className="eyebrow">Förvaltningslista – Exit Cockpit</p>
          <span className="tag">{portfolio.length} positioner</span>
        </div>

        {portfolio.length > 0 && (
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", fontSize: "11px", flexWrap: "wrap" }}>
            <span style={{ color: "#64748b" }}>🟢 HOLD</span>
            <span style={{ color: "#64748b" }}>🟡 TIGHTEN STOP</span>
            <span style={{ color: "#64748b" }}>🟠 PARTIAL EXIT</span>
            <span style={{ color: "#64748b" }}>🔴 EXIT</span>
            <span style={{ color: "#64748b" }}>⚫ STOP HIT</span>
          </div>
        )}

        {portfolio.length === 0 ? (
          <p style={{ color: "#64748b", textAlign: "center", padding: "20px" }}>
            Inga aktiepositioner ännu. Lägg till från analysvyn.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0", color: "#64748b", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Status</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Aktie</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Pris</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Entry</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>PnL %</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>R</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Stop</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Target</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Trailing</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Dagar</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}></th>
                </tr>
              </thead>
              <tbody>
                {portfolio
                  .sort((a, b) => {
                    // Sort EXIT first, then STOP_HIT, then others
                    const statusPriority = {
                      'EXIT': 1,
                      'STOP_HIT': 2,
                      'PARTIAL_EXIT': 3,
                      'TIGHTEN_STOP': 4,
                      'HOLD': 5
                    };
                    const aPriority = statusPriority[a.current_status] || 99;
                    const bPriority = statusPriority[b.current_status] || 99;
                    return aPriority - bPriority;
                  })
                  .map((item) => {
                    const status = item.current_status || 'HOLD';

                    // Status icon
                    const statusIcon = status === 'HOLD' ? '🟢' :
                                      status === 'TIGHTEN_STOP' ? '🟡' :
                                      status === 'PARTIAL_EXIT' ? '🟠' :
                                      status === 'EXIT' ? '🔴' :
                                      status === 'STOP_HIT' ? '⚫' : '⚪';

                    // Row highlighting for EXIT/STOP_HIT
                    const isExit = status === 'EXIT' || status === 'STOP_HIT';
                    const rowBg = isExit ? "#fef2f2" : "transparent";
                    const rowBorder = isExit ? "2px solid #fca5a5" : "1px solid #f1f5f9";

                    // PnL color coding
                    const pnlPct = item.pnl_pct ?? 0;
                    const pnlColor = pnlPct >= 0 ? "#16a34a" : "#dc2626";

                    // R-multiple color coding
                    const rMultiple = item.r_multiple ?? 0;
                    let rColor = "#64748b";
                    if (rMultiple >= 2) rColor = "#16a34a"; // +2R = green
                    else if (rMultiple >= 1) rColor = "#3b82f6"; // +1R = blue
                    else if (rMultiple < 0) rColor = "#dc2626"; // negative = red

                    // Current price (fallback to entry if no current)
                    const currentPrice = item.current_price || item.entry_price;

                    return (
                      <tr
                        key={item.ticker}
                        style={{
                          borderBottom: rowBorder,
                          background: rowBg,
                          cursor: "pointer",
                          transition: "all 0.15s"
                        }}
                        onMouseEnter={(e) => {
                          if (!isExit) e.currentTarget.style.background = "#f8fafc";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = rowBg;
                        }}
                      >
                        {/* Status Icon */}
                        <td style={{ padding: "10px 12px", textAlign: "center" }} onClick={() => onSelectStock(item.ticker)}>
                          <span style={{ fontSize: "20px" }}>{statusIcon}</span>
                        </td>

                        {/* Aktie */}
                        <td style={{ padding: "10px 12px" }} onClick={() => onSelectStock(item.ticker)}>
                          <strong style={{ color: "#0f172a" }}>{item.ticker}</strong>
                        </td>

                        {/* Pris */}
                        <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }} onClick={() => onSelectStock(item.ticker)}>
                          {currentPrice ? currentPrice.toFixed(2) : "—"}
                        </td>

                        {/* Entry */}
                        <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#64748b" }} onClick={() => onSelectStock(item.ticker)}>
                          {item.entry_price ? item.entry_price.toFixed(2) : "—"}
                        </td>

                        {/* PnL % */}
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700", color: pnlColor, fontVariantNumeric: "tabular-nums" }} onClick={() => onSelectStock(item.ticker)}>
                          {pnlPct !== null && pnlPct !== undefined ? `${pnlPct > 0 ? '+' : ''}${pnlPct.toFixed(1)}%` : "—"}
                        </td>

                        {/* R-multiple */}
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700", color: rColor, fontVariantNumeric: "tabular-nums" }} onClick={() => onSelectStock(item.ticker)}>
                          {rMultiple !== null && rMultiple !== undefined ? `${rMultiple > 0 ? '+' : ''}${rMultiple.toFixed(1)}R` : "—"}
                        </td>

                        {/* Stop */}
                        <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#64748b" }} onClick={() => onSelectStock(item.ticker)}>
                          {item.current_stop ? item.current_stop.toFixed(2) : item.initial_stop?.toFixed(2) || "—"}
                        </td>

                        {/* Target */}
                        <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#64748b" }} onClick={() => onSelectStock(item.ticker)}>
                          {item.initial_target ? item.initial_target.toFixed(2) : "—"}
                        </td>

                        {/* Trailing Type */}
                        <td style={{ padding: "10px 12px", textAlign: "center" }} onClick={() => onSelectStock(item.ticker)}>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            color: "#64748b",
                            background: "#f1f5f9",
                            padding: "2px 6px",
                            borderRadius: "4px"
                          }}>
                            {item.trailing_type || "EMA20"}
                          </span>
                        </td>

                        {/* Dagar */}
                        <td style={{ padding: "10px 12px", textAlign: "center" }} onClick={() => onSelectStock(item.ticker)}>
                          <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
                            {item.days_in_trade || 0}d
                          </span>
                        </td>

                        {/* Action Button */}
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          <button
                            className="action-btn delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromPortfolio(item.ticker);
                            }}
                            title="Ta bort från portfölj"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>

            {/* Exit signal explanation row below table */}
            {portfolio.some(p => p.exit_signal) && (
              <div style={{ marginTop: "16px", fontSize: "12px", color: "#64748b" }}>
                <strong>Exit-signaler:</strong>
                <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
                  {portfolio.filter(p => p.exit_signal).map(p => (
                    <li key={p.ticker} style={{ marginBottom: "4px" }}>
                      <strong>{p.ticker}:</strong> {p.exit_signal}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Update info */}
            <div style={{ marginTop: "16px", fontSize: "12px", color: "#64748b" }}>
              <strong>Senaste uppdatering:</strong> Kör <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>POST /api/portfolio/update</code> för daglig uppdatering
            </div>
          </div>
        )}
      </div>

      {/* Screener */}
      <div className="card" style={{ marginBottom: "16px" }}>
        <div className="card-header">
          <p className="eyebrow">Screener – Ranking</p>
          <span className="tag">Uppdateras dagligen</span>
        </div>

        {/* Search Box */}
        <div style={{ marginBottom: "16px" }}>
          <form onSubmit={handleSearch}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="Sök aktie (t.ex. AAPL, TSLA, VOLV-B.ST)"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="stock-input"
              />
              <button type="submit" className="ghost" disabled={!customInput.trim()}>
                Sök
              </button>
            </div>
          </form>
        </div>

        {screenerLoading && <p style={{ color: "#64748b", fontSize: "14px" }}>Laddar screener...</p>}

        {screenerData && screenerData.length > 0 && (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="screener-table" style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0", color: "#64748b", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>#</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Aktie</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Pris</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>Trend</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>RSI</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Vol×</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>ATR%</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Setup</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Score</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {screenerData.slice(0, 15).map((item, idx) => {
                    const edgeScore = item.edgeScore || 5;
                    let scoreColor = "#dc2626";
                    if (edgeScore >= 7) scoreColor = "#16a34a";
                    else if (edgeScore >= 5) scoreColor = "#f59e0b";

                    const trendIcon = item.regime === "Bullish Trend" ? "▲" : item.regime === "Bearish Trend" ? "▼" : "→";
                    const trendColor = item.regime === "Bullish Trend" ? "#16a34a" : item.regime === "Bearish Trend" ? "#dc2626" : "#64748b";

                    const rsiValue = item.rsi?.toFixed(0) || "N/A";
                    let rsiColor = "#64748b";
                    if (item.rsi >= 35 && item.rsi <= 45) rsiColor = "#16a34a";
                    else if (item.rsi >= 45 && item.rsi <= 60) rsiColor = "#3b82f6";
                    else if (item.rsi > 70) rsiColor = "#dc2626";
                    else if (item.rsi < 30) rsiColor = "#f59e0b";

                    const volRatio = item.relativeVolume?.toFixed(1) || "N/A";
                    let volColor = "#64748b";
                    if (item.relativeVolume >= 1.5) volColor = "#16a34a";
                    else if (item.relativeVolume >= 1.2) volColor = "#3b82f6";
                    else if (item.relativeVolume < 1.0) volColor = "#94a3b8";

                    const atrPct = item.atr && item.price ? ((item.atr / item.price) * 100).toFixed(1) : "N/A";
                    let atrColor = "#64748b";
                    if (parseFloat(atrPct) >= 2 && parseFloat(atrPct) <= 4) atrColor = "#16a34a";
                    else if (parseFloat(atrPct) > 6) atrColor = "#f59e0b";
                    else if (parseFloat(atrPct) < 2) atrColor = "#94a3b8";

                    const setupLabel = item.setup === "Pullback" ? "PB" :
                                      item.setup === "Breakout" ? "BO" :
                                      item.setup === "Trend Following" ? "TF" :
                                      item.setup === "Reversal" ? "REV" : "RNG";

                    return (
                      <tr
                        key={item.ticker}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          cursor: "pointer",
                          transition: "background 0.15s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        onClick={() => onSelectStock(item.ticker)}
                      >
                        <td style={{ padding: "10px 12px", color: "#94a3b8", fontWeight: "500" }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <strong style={{ color: "#0f172a" }}>{item.ticker}</strong>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {item.price?.toFixed(2) || "N/A"}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          <span style={{ fontSize: "16px", color: trendColor }}>{trendIcon}</span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "600", color: rsiColor }}>
                          {rsiValue}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "600", color: volColor }}>
                          {volRatio}×
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "600", color: atrColor }}>
                          {atrPct}%
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            color: "#64748b",
                            background: "#f1f5f9",
                            padding: "2px 6px",
                            borderRadius: "4px"
                          }}>
                            {setupLabel}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          <span style={{
                            fontWeight: "700",
                            color: scoreColor,
                            fontSize: "14px"
                          }}>
                            {(edgeScore * 10).toFixed(0)}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          <button
                            className="action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToWatchlist(item.ticker, {
                                price: item.price,
                                ema20: item.ema20,
                                ema50: item.ema50,
                                rsi14: item.rsi,
                                regime: item.regime,
                                setup: item.setup,
                                relativeVolume: item.relativeVolume
                              });
                            }}
                            title="Lägg till i bevakning"
                            style={{
                              background: "#dbeafe",
                              border: "1px solid #93c5fd",
                              fontSize: "14px",
                              padding: "4px 8px"
                            }}
                          >
                            ★
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: "12px", fontSize: "11px", color: "#64748b", display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <span>Trend: <strong style={{ color: "#16a34a" }}>▲</strong> Upptrend <strong style={{ color: "#64748b" }}>→</strong> Range <strong style={{ color: "#dc2626" }}>▼</strong> Nedtrend</span>
              <span>Setup: <strong>PB</strong>=Pullback <strong>BO</strong>=Breakout <strong>TF</strong>=Trend Following</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
