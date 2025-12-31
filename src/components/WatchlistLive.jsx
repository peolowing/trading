import { useState, useEffect } from "react";

function WatchlistLive({ onBack }) {
  const [watchlist, setWatchlist] = useState([]);
  const [liveData, setLiveData] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchWatchlist();
    const interval = setInterval(fetchLiveData, 60000); // Refresh every 60 seconds
    return () => clearInterval(interval);
  }, []);

  async function fetchWatchlist() {
    try {
      const res = await fetch("/api/watchlist");
      const data = await res.json();
      const stocks = data.stocks || [];

      // Debug: Log the received data
      console.log('Watchlist API response:', data);
      console.log('Stocks array:', stocks);
      stocks.forEach(stock => {
        console.log(`${stock.ticker}: edge_score=${stock.edge_score}, regime=${stock.regime}`);
      });

      setWatchlist(stocks);
      await fetchLiveData(stocks);
    } catch (err) {
      console.error("Error fetching watchlist:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLiveData(stocks = watchlist) {
    if (!stocks || stocks.length === 0) return;

    setRefreshing(true);
    try {
      const tickers = stocks.map(s => s.ticker).join(",");
      const res = await fetch(`/api/watchlist/live?tickers=${tickers}`);
      const data = await res.json();
      setLiveData(data.quotes || {});
    } catch (err) {
      console.error("Error fetching live data:", err);
    } finally {
      setRefreshing(false);
    }
  }

  async function removeFromWatchlist(ticker) {
    if (!confirm(`Ta bort ${ticker} från bevakningslistan?`)) return;

    try {
      await fetch(`/api/watchlist/${ticker}`, {
        method: "DELETE",
      });
      setWatchlist(prev => prev.filter(s => s.ticker !== ticker));
    } catch (err) {
      console.error("Error removing from watchlist:", err);
      alert("Kunde inte ta bort från bevakningslistan");
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p>Laddar bevakningslista...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "10px" }}>
            📊 Live Watchlist
          </h1>
          <p style={{ color: "#6b7280", fontSize: "14px" }}>
            Realtidsdata från Yahoo Finance · Uppdateras var 60:e sekund
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => fetchLiveData()}
            disabled={refreshing}
            style={{
              padding: "10px 20px",
              background: refreshing ? "#9ca3af" : "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: refreshing ? "not-allowed" : "pointer",
            }}
          >
            {refreshing ? "Uppdaterar..." : "🔄 Uppdatera"}
          </button>
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
              ← Tillbaka
            </button>
          )}
        </div>
      </div>

      {watchlist.length === 0 ? (
        <div
          style={{
            padding: "60px",
            textAlign: "center",
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
          }}
        >
          <p style={{ fontSize: "16px", color: "#6b7280", marginBottom: "10px" }}>
            Din bevakningslista är tom
          </p>
          <p style={{ fontSize: "14px", color: "#9ca3af" }}>
            Lägg till aktier från Dashboard eller Agents för att se live-data här
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {watchlist.map((stock) => {
            const quote = liveData[stock.ticker] || {};
            const change = quote.regularMarketChange || 0;
            const changePercent = quote.regularMarketChangePercent || 0;
            const isPositive = change >= 0;

            return (
              <div
                key={stock.ticker}
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
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                    <strong style={{ fontSize: "18px", color: "#0f172a" }}>
                      {stock.ticker}
                    </strong>
                    <span style={{ fontSize: "13px", color: "#6b7280" }}>
                      {quote.longName || quote.shortName || ""}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", fontSize: "13px" }}>
                    <div>
                      <span style={{ color: "#6b7280" }}>Pris:</span>{" "}
                      <strong style={{ fontSize: "16px", color: "#0f172a" }}>
                        {quote.regularMarketPrice?.toFixed(2) || "—"} {quote.currency || "SEK"}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "#6b7280" }}>Förändring:</span>{" "}
                      <strong
                        style={{
                          fontSize: "15px",
                          color: isPositive ? "#16a34a" : "#dc2626",
                        }}
                      >
                        {isPositive ? "+" : ""}{change.toFixed(2)} ({isPositive ? "+" : ""}{changePercent.toFixed(2)}%)
                      </strong>
                    </div>
                    {stock.edge_score !== undefined && stock.edge_score !== null && (
                      <div>
                        <span style={{ color: "#6b7280" }}>Edge Score:</span>{" "}
                        <strong style={{
                          fontSize: "15px",
                          color: stock.edge_score >= 70 ? "#16a34a" : stock.edge_score >= 50 ? "#f59e0b" : "#6b7280"
                        }}>
                          {stock.edge_score}
                        </strong>
                      </div>
                    )}
                    <div>
                      <span style={{ color: "#6b7280" }}>Volym:</span>{" "}
                      <strong>{quote.regularMarketVolume?.toLocaleString() || "—"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#6b7280" }}>Marknad:</span>{" "}
                      <strong>{quote.marketState || "—"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#6b7280" }}>Dag High:</span>{" "}
                      <strong>{quote.regularMarketDayHigh?.toFixed(2) || "—"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#6b7280" }}>Dag Low:</span>{" "}
                      <strong>{quote.regularMarketDayLow?.toFixed(2) || "—"}</strong>
                    </div>
                  </div>

                  {stock.notes && (
                    <div style={{ marginTop: "8px", padding: "8px", background: "#f8fafc", borderRadius: "4px" }}>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>Anteckning:</span>{" "}
                      <span style={{ fontSize: "13px", color: "#475569" }}>{stock.notes}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => removeFromWatchlist(stock.ticker)}
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
                  Ta bort
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: "20px", padding: "12px", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "13px", color: "#6b7280" }}>
        <strong>Tips:</strong> Data uppdateras automatiskt var 60:e sekund. Klicka på "Uppdatera" för att hämta ny data direkt.
        Marknadsstatus visar om börsen är öppen (REGULAR) eller stängd (CLOSED/PRE/POST).
      </div>
    </div>
  );
}

export default WatchlistLive;
