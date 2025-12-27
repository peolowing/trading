import { useState, useEffect } from "react";

export default function ScreenerAdmin({ onNavigate }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    ticker: "",
    name: ""
  });
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadStocks();
  }, []);

  async function loadStocks() {
    try {
      const res = await fetch("/api/screener/stocks");
      const data = await res.json();
      setStocks(data);
    } catch (e) {
      console.error("Failed to load screener stocks:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setValidating(true);

    try {
      const res = await fetch("/api/screener/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Kunde inte lägga till aktie");
        return;
      }

      await loadStocks();
      resetForm();
    } catch (e) {
      console.error("Failed to add stock:", e);
      setError("Ett fel uppstod när aktien skulle läggas till");
    } finally {
      setValidating(false);
    }
  }

  async function handleDelete(ticker) {
    if (!confirm(`Är du säker på att du vill ta bort ${ticker} från screener?`)) return;

    try {
      const res = await fetch(`/api/screener/stocks/${ticker}`, { method: "DELETE" });
      if (res.ok) {
        await loadStocks();
      }
    } catch (e) {
      console.error("Failed to delete stock:", e);
    }
  }

  async function handleToggleActive(ticker, isActive) {
    try {
      const res = await fetch(`/api/screener/stocks/${ticker}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive })
      });

      if (res.ok) {
        await loadStocks();
      }
    } catch (e) {
      console.error("Failed to toggle stock:", e);
    }
  }

  function resetForm() {
    setFormData({ ticker: "", name: "" });
    setShowForm(false);
    setError("");
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Laddar screener-inställningar...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <div>
          <p className="eyebrow">Screener-inställningar</p>
          <h1>📋 Hantera Aktielista</h1>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {onNavigate && (
            <button className="ghost" onClick={onNavigate}>
              ← Tillbaka
            </button>
          )}
          <button className="ghost" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Stäng formulär" : "+ Lägg till aktie"}
          </button>
        </div>
      </header>

      {showForm && (
        <div className="card" style={{ marginBottom: "24px" }}>
          <h3 style={{ marginTop: 0, marginBottom: "16px" }}>
            Lägg till ny aktie i screener
          </h3>

          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label className="form-label">Ticker Symbol *</label>
                <input
                  type="text"
                  name="ticker"
                  value={formData.ticker}
                  onChange={handleChange}
                  placeholder="t.ex. VOLV-B.ST, AAPL"
                  className="form-input"
                  required
                />
                <p style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                  För svenska aktier, använd formatet TICKER.ST
                </p>
              </div>

              <div>
                <label className="form-label">Namn (valfritt)</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="t.ex. Volvo B"
                  className="form-input"
                />
              </div>
            </div>

            {error && (
              <div style={{ marginTop: "12px", padding: "12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#dc2626", fontSize: "14px" }}>
                {error}
              </div>
            )}

            <div style={{ marginTop: "20px", display: "flex", gap: "12px" }}>
              <button
                type="submit"
                className="ghost"
                style={{ background: "#4f46e5", color: "white", borderColor: "#4f46e5" }}
                disabled={validating}
              >
                {validating ? "Validerar..." : "Lägg till aktie"}
              </button>
              <button type="button" className="ghost" onClick={resetForm}>
                Avbryt
              </button>
            </div>
          </form>

          <div style={{ marginTop: "16px", padding: "12px", background: "#f0f9ff", border: "1px solid #bfdbfe", borderRadius: "8px", fontSize: "13px", color: "#0369a1" }}>
            <strong>OBS:</strong> Aktien valideras automatiskt mot Yahoo Finance och måste ha en volym över 50M SEK/USD för att läggas till.
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <p className="eyebrow">Aktier i screener</p>
          <span className="tag">{stocks.filter(s => s.is_active).length} aktiva</span>
        </div>

        {stocks.length === 0 ? (
          <p style={{ color: "#64748b", textAlign: "center", padding: "40px 20px" }}>
            Inga aktier ännu. Klicka på "+ Lägg till aktie" för att lägga till din första aktie!
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="trades-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Ticker</th>
                  <th>Namn</th>
                  <th>Tillagd</th>
                  <th>Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map(stock => (
                  <tr key={stock.ticker} style={{ opacity: stock.is_active ? 1 : 0.5 }}>
                    <td>
                      <button
                        className="action-btn"
                        onClick={() => handleToggleActive(stock.ticker, stock.is_active)}
                        title={stock.is_active ? "Inaktivera" : "Aktivera"}
                        style={{
                          background: stock.is_active ? "#dcfce7" : "#f1f5f9",
                          border: `1px solid ${stock.is_active ? "#86efac" : "#cbd5e1"}`,
                          fontSize: "18px"
                        }}
                      >
                        {stock.is_active ? "✓" : "○"}
                      </button>
                    </td>
                    <td><strong>{stock.ticker}</strong></td>
                    <td>{stock.name || "-"}</td>
                    <td>{new Date(stock.added_at).toLocaleDateString("sv-SE")}</td>
                    <td>
                      <button
                        className="action-btn delete"
                        onClick={() => handleDelete(stock.ticker)}
                        title="Ta bort"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
