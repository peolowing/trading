import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import TradeChart from "./components/TradeChart";
import TradeJournal from "./components/TradeJournal";
import ScreenerAdmin from "./components/ScreenerAdmin";

const STOCKS = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "GOOGL", name: "Google" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "VOLV-B.ST", name: "Volvo B" },
  { symbol: "ERIC-B.ST", name: "Ericsson B" },
  { symbol: "ABB.ST", name: "ABB" },
  { symbol: "SAND.ST", name: "Sandvik" },
  { symbol: "HM-B.ST", name: "H&M" }
];

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [learnMode, setLearnMode] = useState(false);
  const [selectedStock, setSelectedStock] = useState("AAPL");
  const [customInput, setCustomInput] = useState("");
  const [screenerData, setScreenerData] = useState(null);
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [currentView, setCurrentView] = useState("analysis"); // "analysis", "journal", or "screener-admin"

  useEffect(() => {
    loadData();
  }, [selectedStock]);

  useEffect(() => {
    loadScreener();
  }, []);

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

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      console.log(`Loading data for ${selectedStock}...`);

      // Get analysis with candles and indicators in one call
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: selectedStock })
      }).then(r => r.json());

      const { candles, ...analysis } = response;
      console.log(`Received ${candles.length} candles for ${selectedStock}`);

      // Set data immediately - show charts and indicators
      setData({ candles, analysis, ai: "Laddar AI-analys..." });
      setLoading(false); // Show UI immediately!

      // Load AI analysis in background (async, non-blocking)
      try {
        const aiResponse = await fetch("/api/ai-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker: selectedStock, candles, indicators: analysis.indicators })
        });
        if (aiResponse.ok) {
          const ai = await aiResponse.json();
          setData(prev => ({ ...prev, ai: ai.analysis }));
        } else {
          setData(prev => ({ ...prev, ai: "AI-analys inte tillgänglig" }));
        }
      } catch (e) {
        console.warn("AI analysis unavailable:", e);
        setData(prev => ({ ...prev, ai: "AI-analys inte tillgänglig (rate limit eller annat fel)" }));
      }
    } catch (e) {
      console.error(e);
      setError("Kunde inte ladda marknadsdata");
      setLoading(false);
    }
  }

  const chartData = useMemo(() => {
    if (!data?.candles) return [];
    return data.candles.slice(-90).map(c => ({ date: c.date, close: c.close }));
  }, [data]);

  // Render Trade Journal if that view is selected
  if (currentView === "journal") {
    return <TradeJournal onNavigate={() => setCurrentView("analysis")} />;
  }

  // Render Screener Admin if that view is selected
  if (currentView === "screener-admin") {
    return <ScreenerAdmin onNavigate={() => setCurrentView("analysis")} />;
  }

  if (loading || !data) return (
    <div className="container">
      <div className="loading">
        <div style={{ marginBottom: "8px" }}>⏳ Laddar {selectedStock}...</div>
        <div style={{ fontSize: "13px", color: "#64748b" }}>
          Hämtar marknadsdata från Yahoo Finance (kan ta 10-30 sekunder för svenska aktier)
        </div>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="container">
        <p>{error}</p>
        <button onClick={loadData}>Försök igen</button>
      </div>
    );
  }

  const { analysis, ai } = data;
  const { scoring, indicators, backtest, regime, setup } = analysis || {};
  const stats = backtest?.stats || {
    trades: 0,
    winRate: 0,
    totalReturn: 0,
    avgWin: 0,
    avgLoss: 0,
    expectancy: 0
  };
  const currentPosition = backtest?.currentPosition;

  // Debug: Visa om currentPosition finns
  if (currentPosition) {
    console.log("Current Position:", currentPosition);
  }

  // Calculate entry/stop/target for TradeChart
  const last = data.candles.at(-1);
  const prevLow = Math.min(...data.candles.slice(-10).map(c => c.low));

  const entry = last.high;
  const stop = prevLow;
  const risk = entry - stop;
  const target = entry + risk * 2.2; // 1:2.2 R/R
  const rr = (target - entry) / risk;

  return (
    <div className="container">
      <header className="header">
        <div>
          <p className="eyebrow">Veckotrading AI</p>
          <h1>📊 Edge-koll för {STOCKS.find(s => s.symbol === selectedStock)?.name || selectedStock}</h1>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="ghost" onClick={() => setCurrentView("screener-admin")}>
            ⚙️ Screener
          </button>
          <button className="ghost" onClick={() => setCurrentView("journal")}>
            📔 Handelsjournal
          </button>
          <button className="ghost" onClick={() => setLearnMode(v => !v)}>
            {learnMode ? "Stäng lär-läge" : "Lär-läge"}
          </button>
        </div>
      </header>

      <div className="card" style={{ marginBottom: "16px" }}>
        <div className="card-header">
          <p className="eyebrow">Top 10 Svenska Aktier – Ranking</p>
          <span className="tag">Uppdateras dagligen</span>
        </div>
        {screenerLoading && <p style={{ color: "#64748b", fontSize: "14px" }}>Laddar screener...</p>}
        {screenerData && screenerData.length > 0 && (
          <>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", fontSize: "12px" }}>
              <span className="pill green">● Bullish + Setup</span>
              <span className="pill yellow">● Bullish eller Setup</span>
              <span className="pill red">● Ingen signal</span>
            </div>
            <ul className="screener-list">
              {screenerData.slice(0, 10).map((item, idx) => {
                // Calculate simple ranking based on regime and RSI
                const isBullish = item.regime === "Bullish Trend";
                const hasSetup = item.setup && item.setup !== "Hold";
                let colorClass = "red";
                if (isBullish && hasSetup) colorClass = "green";
                else if (isBullish || hasSetup) colorClass = "yellow";

                // Calculate a score value (0-100 based on RSI)
                const scoreValue = item.rsi?.toFixed(0) || "N/A";

                return (
                  <li key={item.ticker} className="screener-row">
                    <span className="rank">#{idx + 1}</span>
                    <button
                      className="ticker-link"
                      onClick={() => setSelectedStock(item.ticker)}
                    >
                      {item.ticker}
                    </button>
                    <span className={`score ${colorClass}`}>{scoreValue}</span>
                    <span className="meta">
                      {item.regime === "Bullish Trend" ? "↑" : item.regime === "Bearish Trend" ? "↓" : "→"} {item.setup || "Hold"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <div className="card" style={{ marginBottom: "16px" }}>
        <p className="eyebrow" style={{ marginBottom: "12px" }}>Välj eller sök aktie</p>

        <div style={{ marginBottom: "12px" }}>
          <form onSubmit={(e) => { e.preventDefault(); if (customInput.trim()) setSelectedStock(customInput.trim().toUpperCase()); }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="Skriv aktiesymbol (t.ex. AAPL, TSLA, VOLV-B.ST)"
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

        <p className="eyebrow" style={{ marginBottom: "8px", marginTop: "16px" }}>Populära aktier</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "8px" }}>
          {STOCKS.map(stock => (
            <button
              key={stock.symbol}
              className={selectedStock === stock.symbol ? "stock-btn active" : "stock-btn"}
              onClick={() => setSelectedStock(stock.symbol)}
            >
              <strong>{stock.symbol}</strong>
              <small>{stock.name}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="card score-card">
        <div className="score-main">
          <div>
            <p className="eyebrow">Edge-score</p>
            <div className="score-number">
              <span>{scoring?.score?.toFixed(1) || "N/A"}</span>
              <small>/10</small>
            </div>
            <span className="tag">{scoring?.label || "Okänd"}</span>
          </div>
          <div className="score-bar">
            <div
              className="score-fill"
              style={{ width: `${((scoring?.score || 0) / 10) * 100}%` }}
            />
          </div>
        </div>
        <div className="score-meta">
          <div>
            <p className="eyebrow">Trend</p>
            <strong>{regime === "UPTREND" ? "Upptrend" : "Nedtrend"}</strong>
          </div>
          <div>
            <p className="eyebrow">Setup</p>
            <strong>{setup === "LONG_PULLBACK" ? "Lång pullback" : "Ingen setup"}</strong>
          </div>
          <div>
            <p className="eyebrow">Relativ volym</p>
            <strong>{indicators?.relativeVolume?.toFixed(2) || "N/A"}x</strong>
          </div>
        </div>
      </div>

      <div className={`decision ${rr >= 2 ? "yes" : "no"}`}>
        {rr >= 2 ? "✅ MÖJLIG VECKOTRADE" : "❌ INGEN TRADE JUST NU"}
      </div>

      <div className="card">
        <div className="card-header">
          <p className="eyebrow">Trade-plan med Risk/Reward</p>
          <span className="tag">Entry/Stop/Target</span>
        </div>
        <TradeChart
          candles={data.candles}
          entry={entry}
          stop={stop}
          target={target}
        />
        <div style={{ marginTop: "12px", padding: "10px", background: "#f8fafc", borderRadius: "8px", fontSize: "13px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
            <div>
              <p className="eyebrow">Entry</p>
              <strong style={{ color: "#16a34a" }}>${entry.toFixed(2)}</strong>
            </div>
            <div>
              <p className="eyebrow">Stop</p>
              <strong style={{ color: "#dc2626" }}>${stop.toFixed(2)}</strong>
            </div>
            <div>
              <p className="eyebrow">Target</p>
              <strong style={{ color: "#2563eb" }}>${target.toFixed(2)}</strong>
            </div>
            <div>
              <p className="eyebrow">Risk/Reward</p>
              <strong className={rr >= 2 ? "good" : "bad"}>1:{rr.toFixed(2)}</strong>
            </div>
          </div>
        </div>
        {learnMode && (
          <p className="note">
            Entry = senaste högsta, Stop = lägsta av senaste 10 dagarna, Target = 2.2x risk. Blå zon = belöning, röd zon = risk.
          </p>
        )}
      </div>

      <div className="grid">
        <div className="card">
          <div className="stat-row">
            <div>
              <p className="eyebrow">RSI 14</p>
              <strong>{indicators?.rsi14?.toFixed(1) || "N/A"}</strong>
            </div>
            <div>
              <p className="eyebrow">ATR 14</p>
              <strong>{indicators?.atr14?.toFixed(2) || "N/A"}</strong>
            </div>
          </div>
          <div className="stat-row">
            <div>
              <p className="eyebrow">EMA20</p>
              <strong>{indicators?.ema20?.toFixed(2) || "N/A"}</strong>
            </div>
            <div>
              <p className="eyebrow">EMA50</p>
              <strong>{indicators?.ema50?.toFixed(2) || "N/A"}</strong>
            </div>
          </div>
          {learnMode && (
            <p className="note">
              Edge-score mäter trend (EMA20/EMA50), RSI sweet spot, volym och backtest-resultat.
            </p>
          )}
        </div>

        <div className="card chart-card">
          <div className="card-header">
            <p className="eyebrow">Pris senaste 90 dagar</p>
            <span className="tag">Recharts</span>
          </div>
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="closeArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
                <Tooltip />
                <Area type="monotone" dataKey="close" stroke="#4f46e5" fill="url(#closeArea)" />
                {currentPosition && (
                  <>
                    <ReferenceLine y={currentPosition.entry} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: "Entry", position: "right", fill: "#3b82f6", fontSize: 11 }} />
                    <ReferenceLine y={currentPosition.stop} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Stop", position: "right", fill: "#ef4444", fontSize: 11 }} />
                    <ReferenceLine y={currentPosition.target} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "Target", position: "right", fill: "#22c55e", fontSize: 11 }} />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {currentPosition && (
            <div style={{ marginTop: "12px", padding: "10px", background: "#f8fafc", borderRadius: "8px", fontSize: "13px" }}>
              <strong style={{ color: "#0f172a" }}>Aktiv position:</strong>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginTop: "6px" }}>
                <div>
                  <span style={{ color: "#3b82f6" }}>● Entry:</span> ${currentPosition.entry.toFixed(2)}
                </div>
                <div>
                  <span style={{ color: "#ef4444" }}>● Stop:</span> ${currentPosition.stop.toFixed(2)}
                </div>
                <div>
                  <span style={{ color: "#22c55e" }}>● Target:</span> ${currentPosition.target.toFixed(2)}
                </div>
              </div>
            </div>
          )}
          {learnMode && <p className="note">Diagrammet visar stängningspriset; håll musen över för exakta värden.</p>}
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <div className="card-header">
            <p className="eyebrow">Backtest</p>
            <span className="tag">Pullback-strategi</span>
          </div>
          <div className="stat-row">
            <div>
              <p className="eyebrow">Total avkastning</p>
              <strong>{(stats.totalReturn * 100).toFixed(1)}%</strong>
            </div>
            <div>
              <p className="eyebrow">Win rate</p>
              <strong>{(stats.winRate * 100).toFixed(1)}%</strong>
            </div>
            <div>
              <p className="eyebrow">Trades</p>
              <strong>{stats.trades}</strong>
            </div>
          </div>
          <div className="stat-row">
            <div>
              <p className="eyebrow">Expectancy</p>
              <strong>{(stats.expectancy * 100).toFixed(2)}%</strong>
            </div>
            <div>
              <p className="eyebrow">Snittvinst</p>
              <strong>{(stats.avgWin * 100).toFixed(2)}%</strong>
            </div>
            <div>
              <p className="eyebrow">Snittförlust</p>
              <strong>{(stats.avgLoss * 100).toFixed(2)}%</strong>
            </div>
          </div>
          {learnMode && (
            <p className="note">
              Backtestet köper i upptrend när RSI 40–55 och priset ligger över EMA20/50 med ATR-baserad stop loss.
              Exit sker vid stop, trendbrott, RSI &gt; 70 eller efter 10 dagar.
            </p>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <p className="eyebrow">AI-bedömning</p>
            <span className="tag">GPT-4o-mini</span>
          </div>
          <div className="ai-analysis">
            {ai?.split('\n').map((line, i) => {
              // Handle ## markdown headings
              if (line.startsWith('## ')) {
                return <h3 key={i} className="ai-heading">{line.substring(3).trim()}</h3>;
              }
              // Handle **bold** headings (old format)
              else if (line.startsWith('**') && line.endsWith('**')) {
                return <h3 key={i} className="ai-heading">{line.replace(/\*\*/g, '')}</h3>;
              }
              // Handle bullet points
              else if (line.startsWith('•') || line.trim().startsWith('•')) {
                return <li key={i} className="ai-bullet">{line.replace('•', '').trim()}</li>;
              }
              // Handle other text
              else if (line.trim()) {
                return <p key={i} className="ai-text">{line}</p>;
              }
              return null;
            })}
          </div>
          {learnMode && (
            <p className="note">
              AI sammanfattar analysen och ska tolkas som stöd – inte signal – och fungerar bäst ihop med backtestet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
