import { useState } from 'react';

export default function Simulator({ onBack }) {
  const [ticker, setTicker] = useState('VOLV-B.ST');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [loading, setLoading] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);
  const [error, setError] = useState(null);

  const runSimulation = async () => {
    setLoading(true);
    setError(null);
    setSimulationResult(null);

    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, startDate, endDate })
      });

      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 500));
        throw new Error('Server returnerade ett oväntat svar. Se konsolen för detaljer.');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Något gick fel');
      }

      const data = await response.json();
      setSimulationResult(data);
    } catch (err) {
      console.error('Simulation error:', err);
      setError(err.message || 'Något gick fel vid simulering');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('sv-SE');
  };

  const formatCurrency = (value) => {
    return value?.toFixed(2) || '0.00';
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "20px" }}>
        <button
          onClick={onBack}
          style={{
            padding: "8px 16px",
            background: "#f1f5f9",
            color: "#475569",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer"
          }}
        >
          ← Tillbaka
        </button>
        <h1 style={{ margin: 0, color: "#0f172a" }}>📊 Trading Simulator</h1>
      </div>

      {/* Input Form */}
      <div style={{
        background: "#f8fafc",
        padding: "20px",
        borderRadius: "8px",
        marginBottom: "30px",
        border: "1px solid #e2e8f0"
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "15px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "600", color: "#475569" }}>
              Aktie
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="T.ex. VOLV-B.ST"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "14px"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "600", color: "#475569" }}>
              Startdatum
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "14px"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "600", color: "#475569" }}>
              Slutdatum
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "14px"
              }}
            />
          </div>
        </div>

        <button
          onClick={runSimulation}
          disabled={loading}
          style={{
            background: loading ? "#94a3b8" : "#3b82f6",
            color: "white",
            padding: "12px 24px",
            borderRadius: "6px",
            border: "none",
            fontSize: "14px",
            fontWeight: "600",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.2s"
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.background = "#2563eb";
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.background = "#3b82f6";
          }}
        >
          {loading ? "Simulerar..." : "Kör Simulering"}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          padding: "15px",
          borderRadius: "8px",
          color: "#dc2626",
          marginBottom: "20px"
        }}>
          <strong>Fel:</strong> {error}
        </div>
      )}

      {/* Results */}
      {simulationResult && (
        <>
          {/* Summary Stats */}
          <div style={{
            background: "white",
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "30px",
            border: "1px solid #e2e8f0"
          }}>
            <h2 style={{ marginBottom: "20px", color: "#0f172a" }}>Sammanfattning</h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" }}>
              <div style={{ padding: "15px", background: "#f8fafc", borderRadius: "6px" }}>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>Antal Trades</div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#0f172a" }}>
                  {simulationResult.summary.totalTrades}
                </div>
              </div>

              <div style={{ padding: "15px", background: "#f8fafc", borderRadius: "6px" }}>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>Vinstprocent</div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: simulationResult.summary.winRate >= 50 ? "#16a34a" : "#dc2626" }}>
                  {(simulationResult.summary.winRate * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>
                  {simulationResult.summary.winners}W / {simulationResult.summary.losers}L
                </div>
              </div>

              <div style={{ padding: "15px", background: "#f8fafc", borderRadius: "6px" }}>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>Total Avkastning</div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: simulationResult.summary.totalReturn >= 0 ? "#16a34a" : "#dc2626" }}>
                  {simulationResult.summary.totalReturn >= 0 ? "+" : ""}{(simulationResult.summary.totalReturn * 100).toFixed(2)}%
                </div>
              </div>

              <div style={{ padding: "15px", background: "#f8fafc", borderRadius: "6px" }}>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>Genomsnittlig Vinst</div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#16a34a" }}>
                  {(simulationResult.summary.avgWin * 100).toFixed(2)}%
                </div>
              </div>

              <div style={{ padding: "15px", background: "#f8fafc", borderRadius: "6px" }}>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>Genomsnittlig Förlust</div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#dc2626" }}>
                  {(simulationResult.summary.avgLoss * 100).toFixed(2)}%
                </div>
              </div>

              <div style={{ padding: "15px", background: "#f8fafc", borderRadius: "6px" }}>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>Win/Loss Ratio</div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: simulationResult.summary.avgWinLoss >= 2 ? "#16a34a" : "#f59e0b" }}>
                  {simulationResult.summary.avgWinLoss.toFixed(2)}
                </div>
              </div>

              <div style={{ padding: "15px", background: "#f8fafc", borderRadius: "6px" }}>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>Edge Score</div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: simulationResult.summary.edgeScore >= 70 ? "#16a34a" : "#dc2626" }}>
                  {simulationResult.summary.edgeScore.toFixed(0)}%
                </div>
              </div>

              <div style={{ padding: "15px", background: "#f8fafc", borderRadius: "6px" }}>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>Max Drawdown</div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#dc2626" }}>
                  {(simulationResult.summary.maxDrawdown * 100).toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          {/* Trade List */}
          <div style={{
            background: "white",
            padding: "20px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0"
          }}>
            <h2 style={{ marginBottom: "20px", color: "#0f172a" }}>Alla Trades</h2>

            {simulationResult.trades.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                Inga trades hittades under denna period
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                      <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#64748b" }}>#</th>
                      <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#64748b" }}>Status</th>
                      <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#64748b" }}>Entry Datum</th>
                      <th style={{ padding: "12px", textAlign: "right", fontSize: "12px", fontWeight: "600", color: "#64748b" }}>Entry Pris</th>
                      <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#64748b" }}>Exit Datum</th>
                      <th style={{ padding: "12px", textAlign: "right", fontSize: "12px", fontWeight: "600", color: "#64748b" }}>Exit Pris</th>
                      <th style={{ padding: "12px", textAlign: "right", fontSize: "12px", fontWeight: "600", color: "#64748b" }}>Stop</th>
                      <th style={{ padding: "12px", textAlign: "right", fontSize: "12px", fontWeight: "600", color: "#64748b" }}>Target</th>
                      <th style={{ padding: "12px", textAlign: "right", fontSize: "12px", fontWeight: "600", color: "#64748b" }}>Avkastning</th>
                      <th style={{ padding: "12px", textAlign: "right", fontSize: "12px", fontWeight: "600", color: "#64748b" }}>R-Multiple</th>
                      <th style={{ padding: "12px", textAlign: "center", fontSize: "12px", fontWeight: "600", color: "#64748b" }}>Dagar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulationResult.trades.map((trade, index) => {
                      const isWin = trade.return > 0;
                      const isOpen = !trade.exitDate;

                      return (
                        <tr
                          key={index}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            background: isOpen ? "#fefce8" : "white"
                          }}
                        >
                          <td style={{ padding: "12px", fontSize: "14px" }}>{index + 1}</td>
                          <td style={{ padding: "12px", fontSize: "14px" }}>
                            {isOpen ? (
                              <span style={{ color: "#f59e0b", fontWeight: "600" }}>🔓 ÖPPEN</span>
                            ) : isWin ? (
                              <span style={{ color: "#16a34a", fontWeight: "600" }}>✓ VINST</span>
                            ) : (
                              <span style={{ color: "#dc2626", fontWeight: "600" }}>✗ FÖRLUST</span>
                            )}
                          </td>
                          <td style={{ padding: "12px", fontSize: "14px", fontFamily: "monospace" }}>
                            {formatDate(trade.entryDate)}
                          </td>
                          <td style={{ padding: "12px", textAlign: "right", fontSize: "14px", fontFamily: "monospace" }}>
                            {formatCurrency(trade.entryPrice)} SEK
                          </td>
                          <td style={{ padding: "12px", fontSize: "14px", fontFamily: "monospace" }}>
                            {trade.exitDate ? formatDate(trade.exitDate) : "—"}
                          </td>
                          <td style={{ padding: "12px", textAlign: "right", fontSize: "14px", fontFamily: "monospace" }}>
                            {trade.exitPrice ? `${formatCurrency(trade.exitPrice)} SEK` : "—"}
                          </td>
                          <td style={{ padding: "12px", textAlign: "right", fontSize: "14px", fontFamily: "monospace", color: "#dc2626" }}>
                            {formatCurrency(trade.stop)} SEK
                          </td>
                          <td style={{ padding: "12px", textAlign: "right", fontSize: "14px", fontFamily: "monospace", color: "#16a34a" }}>
                            {formatCurrency(trade.target)} SEK
                          </td>
                          <td style={{
                            padding: "12px",
                            textAlign: "right",
                            fontSize: "14px",
                            fontWeight: "600",
                            fontFamily: "monospace",
                            color: isOpen ? "#64748b" : isWin ? "#16a34a" : "#dc2626"
                          }}>
                            {isOpen ? "—" : `${trade.return >= 0 ? "+" : ""}${(trade.return * 100).toFixed(2)}%`}
                          </td>
                          <td style={{
                            padding: "12px",
                            textAlign: "right",
                            fontSize: "14px",
                            fontWeight: "600",
                            fontFamily: "monospace",
                            color: isOpen ? "#64748b" : trade.rMultiple >= 1 ? "#16a34a" : "#dc2626"
                          }}>
                            {isOpen ? "—" : `${trade.rMultiple >= 0 ? "+" : ""}${trade.rMultiple.toFixed(2)}R`}
                          </td>
                          <td style={{ padding: "12px", textAlign: "center", fontSize: "14px", color: "#64748b" }}>
                            {trade.daysInTrade}d
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
