import { useState, useEffect } from "react";

function AgentsDashboard({ onBack }) {
  const [agents, setAgents] = useState([]);
  const [activeSignals, setActiveSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  useEffect(() => {
    fetchAgents();
    fetchActiveSignals();
  }, []);

  async function fetchAgents() {
    try {
      const res = await fetch("http://localhost:3002/api/agents");
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (err) {
      console.error("Error fetching agents:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchActiveSignals() {
    try {
      const res = await fetch("http://localhost:3002/api/agents/signals/active");
      const data = await res.json();
      setActiveSignals(data.signals || []);
    } catch (err) {
      console.error("Error fetching signals:", err);
    }
  }

  async function runScan() {
    setScanning(true);
    setScanResult(null);

    try {
      const res = await fetch("http://localhost:3002/api/agents/scan", {
        method: "POST",
      });
      const data = await res.json();
      setScanResult(data);

      // Refresh agents and signals
      await fetchAgents();
      await fetchActiveSignals();
    } catch (err) {
      console.error("Error running scan:", err);
      setScanResult({ error: err.message });
    } finally {
      setScanning(false);
    }
  }

  async function toggleAgent(agentId, currentEnabled) {
    try {
      await fetch(`http://localhost:3002/api/agents/${agentId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      await fetchAgents();
    } catch (err) {
      console.error("Error toggling agent:", err);
    }
  }

  async function deactivateSignal(signalId) {
    try {
      await fetch(`http://localhost:3002/api/agents/signals/${signalId}/deactivate`, {
        method: "POST",
      });
      await fetchActiveSignals();
      await fetchAgents();
    } catch (err) {
      console.error("Error deactivating signal:", err);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p>Laddar agents...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "10px" }}>
            Trading Agents
          </h1>
          <p style={{ color: "#6b7280", fontSize: "14px" }}>
            Automatiska agenter som söker efter specifika trading-setups
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding: "10px 20px",
              background: "white",
              color: "#3b82f6",
              border: "1px solid #3b82f6",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            ← Tillbaka till Dashboard
          </button>
        )}
      </div>

      {/* Scan Button */}
      <div style={{ marginBottom: "30px" }}>
        <button
          onClick={runScan}
          disabled={scanning}
          style={{
            padding: "12px 24px",
            background: scanning ? "#9ca3af" : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: scanning ? "not-allowed" : "pointer",
          }}
        >
          {scanning ? "Scannar..." : "🔍 Kör Agent Scan"}
        </button>

        {scanResult && (
          <div
            style={{
              marginTop: "15px",
              padding: "15px",
              background: scanResult.error ? "#fee2e2" : "#dcfce7",
              border: `1px solid ${scanResult.error ? "#fca5a5" : "#86efac"}`,
              borderRadius: "6px",
            }}
          >
            {scanResult.error ? (
              <p style={{ color: "#dc2626", fontSize: "14px" }}>❌ {scanResult.error}</p>
            ) : (
              <>
                <p style={{ color: "#16a34a", fontSize: "14px", fontWeight: "600" }}>
                  ✅ {scanResult.message}
                </p>
                <p style={{ color: "#16a34a", fontSize: "13px", marginTop: "5px" }}>
                  Hittade {scanResult.count} nya signaler
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Agents List */}
      <div style={{ marginBottom: "40px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "15px" }}>
          Aktiva Agenter ({agents.length})
        </h2>

        <div style={{ display: "grid", gap: "15px" }}>
          {agents.map((agent) => (
            <div
              key={agent.id}
              style={{
                padding: "20px",
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: "600" }}>{agent.name}</h3>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        background: getAgentTypeColor(agent.type).bg,
                        color: getAgentTypeColor(agent.type).text,
                      }}
                    >
                      {agent.type}
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        padding: "3px 10px",
                        borderRadius: "12px",
                        background: agent.enabled ? "#dcfce7" : "#fee2e2",
                        color: agent.enabled ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {agent.enabled ? "Aktiverad" : "Inaktiverad"}
                    </span>
                  </div>

                  <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "10px" }}>
                    <strong>Kriterier:</strong> {getCriteriaText(agent.criteria)}
                  </div>

                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#3b82f6" }}>
                    {agent.activeSignals} aktiva signaler
                  </div>
                </div>

                <button
                  onClick={() => toggleAgent(agent.id, agent.enabled)}
                  style={{
                    padding: "8px 16px",
                    background: agent.enabled ? "#fee2e2" : "#dcfce7",
                    color: agent.enabled ? "#dc2626" : "#16a34a",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  {agent.enabled ? "Inaktivera" : "Aktivera"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Signals */}
      <div>
        <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "15px" }}>
          Aktiva Signaler ({activeSignals.length})
        </h2>

        {activeSignals.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          >
            <p style={{ color: "#6b7280", fontSize: "14px" }}>
              Inga aktiva signaler. Kör en agent scan för att hitta nya setups.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {activeSignals
              .sort((a, b) => (b.setup_data?.edgeScore || 0) - (a.setup_data?.edgeScore || 0))
              .map((signal) => (
              <div
                key={signal.id}
                style={{
                  padding: "16px",
                  background: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        background: "#dbeafe",
                        color: "#3b82f6",
                      }}
                    >
                      {signal.trading_agents?.name || "Unknown Agent"}
                    </span>
                    <strong style={{ fontSize: "15px" }}>{signal.ticker}</strong>
                    {signal.setup_data?.edgeScore && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "700",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          background: getPriorityBadge(signal.setup_data.edgeScore).bg,
                          color: getPriorityBadge(signal.setup_data.edgeScore).text,
                        }}
                      >
                        {getPriorityBadge(signal.setup_data.edgeScore).label}
                      </span>
                    )}
                    <span style={{ fontSize: "13px", color: "#6b7280" }}>
                      {signal.signal_date}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", fontSize: "13px" }}>
                    <div>
                      <span style={{ color: "#6b7280" }}>Type:</span>{" "}
                      <strong>{signal.setup_data?.type}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#6b7280" }}>Strength:</span>{" "}
                      <strong style={{ color: getStrengthColor(signal.setup_data?.strength) }}>
                        {signal.setup_data?.strength}/100
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "#6b7280" }}>Edge Score:</span>{" "}
                      <strong style={{ color: getEdgeScoreColor(signal.setup_data?.edgeScore) }}>
                        {signal.setup_data?.edgeScore || "N/A"}/100
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "#6b7280" }}>Entry:</span>{" "}
                      <strong>{signal.setup_data?.entry}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#6b7280" }}>Stop:</span>{" "}
                      <strong>{signal.setup_data?.stop}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#6b7280" }}>Target:</span>{" "}
                      <strong style={{ color: "#16a34a" }}>{signal.setup_data?.target}</strong>
                    </div>
                    {signal.setup_data?.pullbackDays && (
                      <div>
                        <span style={{ color: "#6b7280" }}>Pullback:</span>{" "}
                        <strong>{signal.setup_data.pullbackDays} dagar</strong>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => deactivateSignal(signal.id)}
                  style={{
                    padding: "8px 16px",
                    background: "#fee2e2",
                    color: "#dc2626",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    marginLeft: "15px",
                  }}
                >
                  Stäng
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions
function getAgentTypeColor(type) {
  const colors = {
    PULLBACK: { bg: "#dbeafe", text: "#3b82f6" },
    BREAKOUT: { bg: "#fef3c7", text: "#f59e0b" },
    MOMENTUM: { bg: "#dcfce7", text: "#16a34a" },
    REVERSAL: { bg: "#ede9fe", text: "#8b5cf6" },
  };
  return colors[type] || { bg: "#f3f4f6", text: "#6b7280" };
}

function getCriteriaText(criteria) {
  if (!criteria) return "N/A";

  const parts = [];
  if (criteria.closeAboveSMA200) parts.push("Close > SMA200");
  if (criteria.sma50AboveSMA200) parts.push("SMA50 > SMA200");
  if (criteria.pullbackDays) parts.push(`Pullback ${criteria.pullbackDays.min}-${criteria.pullbackDays.max} dagar`);
  if (criteria.rsi) parts.push(`RSI ${criteria.rsi.min}-${criteria.rsi.max}`);

  return parts.length > 0 ? parts.join(", ") : JSON.stringify(criteria);
}

function getStrengthColor(strength) {
  if (strength >= 80) return "#16a34a";
  if (strength >= 60) return "#f59e0b";
  return "#dc2626";
}

function getEdgeScoreColor(edgeScore) {
  if (!edgeScore) return "#6b7280";
  if (edgeScore >= 70) return "#16a34a";  // Green - High priority
  if (edgeScore >= 50) return "#f59e0b";  // Orange - Medium priority
  return "#dc2626";  // Red - Low priority
}

function getPriorityBadge(edgeScore) {
  if (edgeScore >= 70) {
    return { label: "🔥 HÖG PRIO", bg: "#dcfce7", text: "#16a34a" };
  }
  if (edgeScore >= 50) {
    return { label: "⚡ MEDEL", bg: "#fef3c7", text: "#f59e0b" };
  }
  return { label: "⚠️ LÅG PRIO", bg: "#fee2e2", text: "#dc2626" };
}

export default AgentsDashboard;
