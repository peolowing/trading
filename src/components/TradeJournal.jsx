import { useState, useEffect } from "react";

export default function TradeJournal({ onNavigate }) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    ticker: "",
    type: "Köp",
    quantity: "",
    price: "",
    strategy: "",
    stop_loss: "",
    target: "",
    result_kr: "",
    result_pct: "",
    setup_notes: "",
    lessons_learned: ""
  });

  useEffect(() => {
    loadTrades();
  }, []);

  async function loadTrades() {
    try {
      const res = await fetch("/api/trades");
      const data = await res.json();
      setTrades(data);
    } catch (e) {
      console.error("Failed to load trades:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      const method = editingTrade ? "PUT" : "POST";
      const url = editingTrade ? `/api/trades/${editingTrade.id}` : "/api/trades";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        await loadTrades();
        resetForm();
      }
    } catch (e) {
      console.error("Failed to save trade:", e);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Är du säker på att du vill ta bort denna affär?")) return;

    try {
      const res = await fetch(`/api/trades/${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadTrades();
      }
    } catch (e) {
      console.error("Failed to delete trade:", e);
    }
  }

  function handleEdit(trade) {
    setEditingTrade(trade);
    setFormData({
      date: trade.date,
      ticker: trade.ticker,
      type: trade.type,
      quantity: trade.quantity,
      price: trade.price,
      strategy: trade.strategy || "",
      stop_loss: trade.stop_loss || "",
      target: trade.target || "",
      result_kr: trade.result_kr || "",
      result_pct: trade.result_pct || "",
      setup_notes: trade.setup_notes || "",
      lessons_learned: trade.lessons_learned || ""
    });
    setShowForm(true);
  }

  function resetForm() {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      ticker: "",
      type: "Köp",
      quantity: "",
      price: "",
      strategy: "",
      stop_loss: "",
      target: "",
      result_kr: "",
      result_pct: "",
      setup_notes: "",
      lessons_learned: ""
    });
    setEditingTrade(null);
    setShowForm(false);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Laddar handelsjournal...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <div>
          <p className="eyebrow">Handelsjournal</p>
          <h1>📔 Mina Affärer</h1>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {onNavigate && (
            <button className="ghost" onClick={onNavigate}>
              ← AI-Analys
            </button>
          )}
          <button className="ghost" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Stäng formulär" : "+ Ny Affär"}
          </button>
        </div>
      </header>

      {showForm && (
        <div className="card" style={{ marginBottom: "24px" }}>
          <h3 style={{ marginTop: 0, marginBottom: "16px" }}>
            {editingTrade ? "Redigera Affär" : "Lägg till Affär"}
          </h3>

          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div>
                <label className="form-label">Datum</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Aktie</label>
                <input
                  type="text"
                  name="ticker"
                  value={formData.ticker}
                  onChange={handleChange}
                  placeholder="t.ex. Volvo"
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Typ</label>
                <select name="type" value={formData.type} onChange={handleChange} className="form-input" required>
                  <option value="Köp">Köp</option>
                  <option value="Sälj">Sälj</option>
                </select>
              </div>

              <div>
                <label className="form-label">Antal</label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Pris (kr)</label>
                <input
                  type="number"
                  step="0.01"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Strategi</label>
                <select name="strategy" value={formData.strategy} onChange={handleChange} className="form-input">
                  <option value="">Välj strategi</option>
                  <option value="Pullback">Pullback</option>
                  <option value="Breakout">Breakout</option>
                  <option value="Reversal">Reversal</option>
                  <option value="Trend Following">Trend Following</option>
                  <option value="Trendbrytning">Trendbrytning</option>
                  <option value="Mean Reversion">Mean Reversion</option>
                  <option value="Momentum">Momentum</option>
                  <option value="GAP Trading">GAP Trading</option>
                  <option value="Support/Resistance">Support/Resistance</option>
                  <option value="Moving Average">Moving Average</option>
                </select>
              </div>

              <div>
                <label className="form-label">Stop Loss (kr)</label>
                <input
                  type="number"
                  step="0.01"
                  name="stop_loss"
                  value={formData.stop_loss}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Vinstmål (kr)</label>
                <input
                  type="number"
                  step="0.01"
                  name="target"
                  value={formData.target}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Resultat (kr)</label>
                <input
                  type="number"
                  step="0.01"
                  name="result_kr"
                  value={formData.result_kr}
                  onChange={handleChange}
                  placeholder="Fyll i när affären är stängd"
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Resultat (%)</label>
                <input
                  type="number"
                  step="0.01"
                  name="result_pct"
                  value={formData.result_pct}
                  onChange={handleChange}
                  placeholder="Fyll i när affären är stängd"
                  className="form-input"
                />
              </div>
            </div>

            <div style={{ marginTop: "16px" }}>
              <label className="form-label">Setup / Varför köpte du?</label>
              <textarea
                name="setup_notes"
                value={formData.setup_notes}
                onChange={handleChange}
                placeholder="Beskriv den tekniska uppställningen..."
                className="form-textarea"
                rows="4"
              />
            </div>

            <div style={{ marginTop: "16px" }}>
              <label className="form-label">Anteckningar / Lärdomar</label>
              <textarea
                name="lessons_learned"
                value={formData.lessons_learned}
                onChange={handleChange}
                placeholder="Vad lärde du dig av denna affär?"
                className="form-textarea"
                rows="4"
              />
            </div>

            <div style={{ marginTop: "20px", display: "flex", gap: "12px" }}>
              <button type="submit" className="ghost" style={{ background: "#4f46e5", color: "white", borderColor: "#4f46e5" }}>
                {editingTrade ? "Uppdatera Affär" : "Spara Affär"}
              </button>
              {editingTrade && (
                <button type="button" className="ghost" onClick={resetForm}>
                  Avbryt
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <p className="eyebrow">Alla Affärer</p>
          <span className="tag">{trades.length} affärer</span>
        </div>

        {trades.length === 0 ? (
          <p style={{ color: "#64748b", textAlign: "center", padding: "40px 20px" }}>
            Inga affärer ännu. Klicka på "+ Ny Affär" för att lägga till din första affär!
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="trades-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Aktie</th>
                  <th>Typ</th>
                  <th>Antal</th>
                  <th>Pris</th>
                  <th>Strategi</th>
                  <th>Stop Loss</th>
                  <th>Mål</th>
                  <th>Resultat (kr)</th>
                  <th>Resultat (%)</th>
                  <th>Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(trade => (
                  <tr key={trade.id}>
                    <td>{trade.date}</td>
                    <td><strong>{trade.ticker}</strong></td>
                    <td>
                      <span className={`trade-type ${trade.type === 'Köp' ? 'buy' : 'sell'}`}>
                        {trade.type}
                      </span>
                    </td>
                    <td>{trade.quantity}</td>
                    <td>{trade.price} kr</td>
                    <td>{trade.strategy || "-"}</td>
                    <td>{trade.stop_loss ? `${trade.stop_loss} kr` : "-"}</td>
                    <td>{trade.target ? `${trade.target} kr` : "-"}</td>
                    <td>
                      {trade.result_kr ? (
                        <span className={trade.result_kr > 0 ? "profit" : "loss"}>
                          {trade.result_kr > 0 ? "+" : ""}{trade.result_kr} kr
                        </span>
                      ) : "-"}
                    </td>
                    <td>
                      {trade.result_pct ? (
                        <span className={trade.result_pct > 0 ? "profit" : "loss"}>
                          {trade.result_pct > 0 ? "+" : ""}{trade.result_pct}%
                        </span>
                      ) : "-"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button className="action-btn edit" onClick={() => handleEdit(trade)} title="Redigera">
                          ✏️
                        </button>
                        <button className="action-btn delete" onClick={() => handleDelete(trade.id)} title="Ta bort">
                          🗑️
                        </button>
                      </div>
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
