import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import TradeChart from "./components/TradeChart";
import Cockpit from "./components/Dashboard";
import PositionDetail from "./components/PositionDetail";
import ClosedPositions from "./components/ClosedPositions";
import ClosedPositionDetail from "./components/ClosedPositionDetail";
import AgentsDashboard from "./components/AgentsDashboard";
import WatchlistLive from "./components/WatchlistLive";
import Simulator from "./components/Simulator";
import EntryModal from "./components/EntryModal";
import AuthModal from "./components/Auth/AuthModal";
import { useAuth } from "./contexts/AuthContext";

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [learnMode, setLearnMode] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [currentView, setCurrentView] = useState("dashboard"); // "dashboard", "analysis", "position-detail", "closed-positions", "closed-position-detail", "simulator"
  const [aiHistory, setAiHistory] = useState(null);
  const [refreshingAi, setRefreshingAi] = useState(false);
  const [selectedAnalysisTab, setSelectedAnalysisTab] = useState(0); // 0 = latest, 1 = previous, etc.
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryModalStock, setEntryModalStock] = useState(null);

  useEffect(() => {
    if (selectedStock) {
      loadData();
      loadAiHistory();
    }
  }, [selectedStock]);

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
          body: JSON.stringify({
            ticker: selectedStock,
            candles,
            indicators: analysis.indicators,
            trade: analysis.trade // Include calculated trade values
          })
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

  async function loadAiHistory() {
    try {
      const response = await fetch(`/api/ai-analysis/history/${selectedStock}`);
      if (response.ok) {
        const history = await response.json();
        setAiHistory(history);
      }
    } catch (e) {
      console.warn("Could not load AI history:", e);
    }
  }

  async function refreshAiAnalysis() {
    if (refreshingAi) return;

    setRefreshingAi(true);
    try {
      const response = await fetch("/api/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: selectedStock,
          candles: data.candles,
          indicators: data.analysis.indicators,
          trade: data.analysis.trade, // Include calculated trade values
          force: true // Force new analysis
        })
      });

      if (response.ok) {
        const ai = await response.json();
        setData(prev => ({ ...prev, ai: ai.analysis }));
        // Reload history to get comparison
        await loadAiHistory();
      }
    } catch (e) {
      console.error("Failed to refresh AI analysis:", e);
    } finally {
      setRefreshingAi(false);
    }
  }

  function extractTradeInfo(aiText, currentPrice) {
    if (!aiText) {
      // No AI analysis - use current price
      return {
        entry: currentPrice || 0,
        stopLoss: 0,
        target: 0,
        setupNotes: "",
        recommendation: "MANUELL"
      };
    }

    // Extract recommendation
    const recMatch = aiText.match(/\*\*Rekommendation:\*\*\s*(KÖP|INVÄNTA|UNDVIK)/i);
    const recommendation = recMatch ? recMatch[1].toUpperCase() : "OKÄND";

    // Extract entry level - look for both formats
    let entry = currentPrice || 0;
    const entryMatch1 = aiText.match(/\*\*Entry-nivå:\*\*\s*([\d,]+(?:[.,]\d+)?)/i);
    const entryMatch2 = aiText.match(/Entry[-:]?\s*([\d,]+(?:[.,]\d+)?)/i);

    if (entryMatch1) {
      entry = parseFloat(entryMatch1[1].replace(',', '.'));
    } else if (entryMatch2) {
      entry = parseFloat(entryMatch2[1].replace(',', '.'));
    }

    // Extract stop loss - look for both formats
    let stopLoss = 0;
    const stopMatch1 = aiText.match(/\*\*Stop Loss:\*\*\s*([\d,]+(?:[.,]\d+)?)/i);
    const stopMatch2 = aiText.match(/Stop[-\s]?Loss[-:]?\s*([\d,]+(?:[.,]\d+)?)/i);

    if (stopMatch1) {
      stopLoss = parseFloat(stopMatch1[1].replace(',', '.'));
    } else if (stopMatch2) {
      stopLoss = parseFloat(stopMatch2[1].replace(',', '.'));
    }

    // Extract target - look for both formats
    let target = 0;
    const targetMatch1 = aiText.match(/\*\*Target:\*\*\s*([\d,]+(?:[.,]\d+)?)/i);
    const targetMatch2 = aiText.match(/Target[-:]?\s*([\d,]+(?:[.,]\d+)?)/i);

    if (targetMatch1) {
      target = parseFloat(targetMatch1[1].replace(',', '.'));
    } else if (targetMatch2) {
      target = parseFloat(targetMatch2[1].replace(',', '.'));
    }

    // Extract setup notes (HANDELSBESLUT section)
    const setupMatch = aiText.match(/##\s*HANDELSBESLUT([\s\S]*?)(?=##|$)/i);
    const setupNotes = setupMatch ? setupMatch[1].trim() : "";

    return { entry, stopLoss, target, setupNotes, recommendation };
  }

  function handleOpenBuyDialog() {
    const currentPrice = data?.candles?.[data.candles.length - 1]?.close || 0;

    // Prefer data.analysis.trade values (from /api/analyze), fallback to AI text extraction
    let entry, stop, target;

    if (data?.analysis?.trade) {
      // Use calculated trade values from backend
      entry = data.analysis.trade.entry;
      stop = data.analysis.trade.stop;
      target = data.analysis.trade.target;
    } else {
      // Fallback to AI text extraction
      const tradeInfo = extractTradeInfo(data?.ai, currentPrice);
      entry = tradeInfo.entry;
      stop = tradeInfo.stopLoss;
      target = tradeInfo.target;
    }

    // Create enriched stock object for EntryModal
    const enrichedStock = {
      ticker: selectedStock,
      current_price: currentPrice,
      recommended_entry: entry,
      recommended_stop: stop,
      recommended_target: target,
      recommended_rr: data?.analysis?.trade?.rr || 2.0,
      ema20: data?.analysis?.indicators?.ema20,
      ema50: data?.analysis?.indicators?.ema50,
      rsi14: data?.analysis?.indicators?.rsi14,
      atr14: data?.analysis?.indicators?.atr14,
      regime: data?.analysis?.indicators?.regime,
      setup: data?.analysis?.indicators?.setup,
      notes: data?.ai ? extractTradeInfo(data.ai, currentPrice).setupNotes : ""
    };

    setEntryModalStock(enrichedStock);
    setShowEntryModal(true);
  }

  async function handleEntryConfirm(portfolioEntry) {
    try {
      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(portfolioEntry)
      });

      if (response.ok) {
        setShowEntryModal(false);
        setCurrentView("dashboard");
      } else {
        alert("Kunde inte lägga till i portfolio");
      }
    } catch (e) {
      console.error("Failed to add to portfolio:", e);
      alert("Fel vid tillägg till portfolio");
    }
  }

  const chartData = useMemo(() => {
    if (!data?.candles) return [];

    // Calculate EMA
    const calculateEMA = (values, period) => {
      const k = 2 / (period + 1);
      const emaData = [];
      let ema = values.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
      emaData.push(ema);
      for (let i = period; i < values.length; i++) {
        ema = values[i] * k + ema * (1 - k);
        emaData.push(ema);
      }
      return emaData;
    };

    // Calculate EMAs from all available data
    const allCloses = data.candles.map(c => c.close);
    const ema20Full = calculateEMA(allCloses, 20);
    const ema50Full = calculateEMA(allCloses, 50);

    // Take last 90 values
    const recent90 = data.candles.slice(-90);
    const ema20Recent = ema20Full.slice(-90);
    const ema50Recent = ema50Full.slice(-90);

    return recent90.map((c, i) => ({
      date: c.date,
      close: c.close,
      ema20: ema20Recent[i],
      ema50: ema50Recent[i]
    }));
  }, [data]);

  // Show loading screen while checking auth
  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: '#666'
      }}>
        Laddar...
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return <AuthModal onClose={() => {}} />;
  }

  // Render Cockpit as default view
  if (currentView === "dashboard") {
    return (
      <Cockpit
        onSelectStock={(ticker) => {
          setSelectedStock(ticker);
          setCurrentView("analysis");
        }}
        onNavigate={(view) => setCurrentView(view)}
        onOpenPosition={(ticker) => {
          setSelectedStock(ticker);
          setCurrentView("position-detail");
        }}
      />
    );
  }

  // Render Position Detail if that view is selected
  if (currentView === "position-detail") {
    return (
      <PositionDetail
        ticker={selectedStock}
        onBack={() => setCurrentView("dashboard")}
      />
    );
  }

  // Render Closed Positions list if that view is selected
  if (currentView === "closed-positions") {
    return (
      <ClosedPositions
        onSelectPosition={(ticker) => {
          setSelectedStock(ticker);
          setCurrentView("closed-position-detail");
        }}
        onBack={() => setCurrentView("dashboard")}
      />
    );
  }

  // Render Closed Position Detail if that view is selected
  if (currentView === "closed-position-detail") {
    return (
      <ClosedPositionDetail
        ticker={selectedStock}
        onBack={() => setCurrentView("closed-positions")}
      />
    );
  }

  // Render Agents Dashboard if that view is selected
  if (currentView === "agents") {
    return <AgentsDashboard onBack={() => setCurrentView("dashboard")} />;
  }

  // Render Watchlist Live if that view is selected
  if (currentView === "watchlist-live") {
    return <WatchlistLive onBack={() => setCurrentView("dashboard")} />;
  }

  // Render Simulator if that view is selected
  if (currentView === "simulator") {
    return <Simulator onBack={() => setCurrentView("dashboard")} />;
  }

  // Analysis view - shown when a stock is selected
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
        <button onClick={() => setCurrentView("dashboard")}>← Tillbaka till Trading Cockpit</button>
      </div>
    );
  }

  const { analysis, ai } = data;
  const { scoring, indicators, backtest } = analysis || {};

  // Översätt regime till svenska
  const regimeTranslations = {
    "Bullish Trend": "Upptrend",
    "Bearish Trend": "Nedtrend",
    "Consolidation": "Sidledes"
  };
  const regime = regimeTranslations[indicators?.regime] || indicators?.regime || "N/A";

  // Översätt setup till svenska
  const setupTranslations = {
    "Pullback": "Pullback",
    "Breakout": "Breakout",
    "Reversal": "Reversal",
    "Trend Following": "Trendföljning",
    "Near Breakout": "Nära Breakout",
    "Hold": "Ingen setup"
  };
  const setup = setupTranslations[indicators?.setup] || indicators?.setup || "N/A";
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

  // Use trade values from backend analysis (same as buy dialog)
  const entry = data?.analysis?.trade?.entry || data.candles.at(-1).close;
  const stop = data?.analysis?.trade?.stop || entry - 5;
  const target = data?.analysis?.trade?.target || entry + 10;
  const rr = data?.analysis?.trade?.rr || 2.0;

  return (
    <div className="container">
      <header className="header">
        <div>
          <p className="eyebrow">Analys</p>
          <h1>📊 {selectedStock}</h1>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="ghost" onClick={() => setCurrentView("dashboard")}>
            ← Trading Cockpit
          </button>
          <button className="ghost" onClick={() => setLearnMode(v => !v)}>
            {learnMode ? "Stäng lär-läge" : "Lär-läge"}
          </button>
          <button
            className="ghost"
            style={{ background: "#dbeafe", borderColor: "#93c5fd" }}
            onClick={async () => {
              try {
                await fetch("/api/watchlist", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ticker: selectedStock })
                });
                alert(`${selectedStock} tillagd i bevakningslistan!`);
              } catch (e) {
                alert("Kunde inte lägga till i bevakningslistan");
              }
            }}
          >
            ⭐ Bevaka
          </button>
        </div>
      </header>

      <div className="card score-card">
        <div className="score-main">
          <div>
            <p className="eyebrow">Edge-score</p>
            <div className="score-number">
              <span>{scoring?.score?.toFixed(0) || "N/A"}</span>
              <small>/100</small>
            </div>
            <span className="tag">{scoring?.label || "Okänd"}</span>
          </div>
          <div className="score-bar">
            <div
              className="score-fill"
              style={{ width: `${((scoring?.score || 0) / 100) * 100}%` }}
            />
          </div>
        </div>
        <div className="score-meta">
          <div>
            <p className="eyebrow">Trend</p>
            <strong>{regime}</strong>
          </div>
          <div>
            <p className="eyebrow">Setup</p>
            <strong style={{
              color: indicators?.setup === "Near Breakout" ? "#16a34a" : "inherit",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}>
              {setup}
              {indicators?.setup === "Near Breakout" && (
                <span style={{
                  fontSize: "10px",
                  fontWeight: "700",
                  color: "#16a34a",
                  background: "#dcfce7",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  animation: "pulse 2s infinite"
                }}>
                  🎯
                </span>
              )}
            </strong>
          </div>
          <div>
            <p className="eyebrow">Relativ volym</p>
            <strong>{indicators?.relativeVolume?.toFixed(2) || "N/A"}x</strong>
          </div>
        </div>
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
              <Line type="monotone" dataKey="ema20" stroke="#f97316" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="ema50" stroke="#8b5cf6" strokeWidth={2} dot={false} />
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
        <div style={{ marginTop: "12px", padding: "10px", background: "#f8fafc", borderRadius: "8px", fontSize: "13px" }}>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <span style={{ color: "#f97316", fontWeight: "600" }}>━━</span> EMA20
            </div>
            <div>
              <span style={{ color: "#8b5cf6", fontWeight: "600" }}>━━</span> EMA50
            </div>
            {currentPosition && (
              <>
                <div style={{ marginLeft: "auto" }}>
                  <strong style={{ color: "#0f172a" }}>Aktiv position:</strong>
                </div>
                <div>
                  <span style={{ color: "#3b82f6" }}>● Entry:</span> ${currentPosition.entry.toFixed(2)}
                </div>
                <div>
                  <span style={{ color: "#ef4444" }}>● Stop:</span> ${currentPosition.stop.toFixed(2)}
                </div>
                <div>
                  <span style={{ color: "#22c55e" }}>● Target:</span> ${currentPosition.target.toFixed(2)}
                </div>
              </>
            )}
          </div>
        </div>
        {learnMode && <p className="note">Diagrammet visar stängningspriset med EMA20 (orange) och EMA50 (lila). Håll musen över för exakta värden.</p>}
      </div>

      <div className="grid">
        <div>
          <div className="card" style={{ marginBottom: "16px" }}>
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

          <div className="card">
            <div className="card-header">
              <p className="eyebrow">Backtest</p>
              <span className="tag">Pullback-strategi</span>
            </div>
            <div className="stat-row">
              <div>
                <p className="eyebrow">Total avkastning</p>
                <strong>{stats.totalReturn.toFixed(1)}%</strong>
              </div>
              <div>
                <p className="eyebrow">Win rate</p>
                <strong>{stats.winRate.toFixed(1)}%</strong>
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
                <strong>{stats.avgWin.toFixed(2)}%</strong>
              </div>
              <div>
                <p className="eyebrow">Snittförlust</p>
                <strong>{stats.avgLoss.toFixed(2)}%</strong>
              </div>
            </div>
            {learnMode && (
              <p className="note">
                Backtestet köper i upptrend när RSI 40–55 och priset ligger över EMA20/50 med ATR-baserad stop loss.
                Exit sker vid stop, trendbrott, RSI &gt; 70 eller efter 10 dagar.
              </p>
            )}
          </div>
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
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <p className="eyebrow">AI-bedömning</p>
            <span className="tag">GPT-4o-mini</span>
            {aiHistory?.count > 1 && (
              <span style={{
                fontSize: "11px",
                color: "#6b7280",
                background: "#f3f4f6",
                padding: "2px 8px",
                borderRadius: "4px"
              }}>
                {aiHistory.count} analyser sparade
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleOpenBuyDialog}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: "600",
                background: "#22c55e",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              💰 Köp
            </button>
            <button
              onClick={refreshAiAnalysis}
              disabled={refreshingAi}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: "600",
                background: refreshingAi ? "#9ca3af" : "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: refreshingAi ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              {refreshingAi ? "⏳ Uppdaterar..." : "🔄 Ny analys"}
            </button>
          </div>
        </div>

        {/* Show comparison if exists */}
        {aiHistory?.comparison?.hasChanges && (
          <div style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: "6px",
            padding: "12px",
            marginBottom: "15px",
            fontSize: "13px"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px"
            }}>
              <div style={{ fontWeight: "700", color: "#ea580c" }}>
                📊 Ändringar sedan förra analysen
              </div>
              {aiHistory.comparison.timestamp?.latest && (
                <div style={{ fontSize: "11px", color: "#6b7280" }}>
                  Senast: {new Date(aiHistory.comparison.timestamp.latest).toLocaleString('sv-SE', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              )}
            </div>

            {aiHistory.comparison.edgeScore && (
              <div style={{ marginBottom: "6px" }}>
                <strong>Edge Score:</strong> {aiHistory.comparison.edgeScore.old} → {aiHistory.comparison.edgeScore.new}
                <span style={{
                  color: aiHistory.comparison.edgeScore.change > 0 ? "#16a34a" : "#dc2626",
                  marginLeft: "6px"
                }}>
                  ({aiHistory.comparison.edgeScore.change > 0 ? "+" : ""}{aiHistory.comparison.edgeScore.change.toFixed(1)})
                </span>
              </div>
            )}

            {aiHistory.comparison.recommendation && (
              <div style={{ marginBottom: "6px" }}>
                <strong>Rekommendation:</strong> {aiHistory.comparison.recommendation.old} → {aiHistory.comparison.recommendation.new}
              </div>
            )}

            {aiHistory.comparison.sections?.filter(s => s.changes && s.changes.length >= 3).length > 0 && (
              <div style={{ marginTop: "12px" }}>
                <div style={{ fontWeight: "600", marginBottom: "8px", color: "#0f172a" }}>
                  Detaljerade ändringar:
                </div>
                {aiHistory.comparison.sections
                  .filter(section => section.changes && section.changes.length >= 3)
                  .map((section, idx) => (
                    <details key={idx} style={{ marginBottom: "8px" }}>
                      <summary style={{
                        cursor: "pointer",
                        fontWeight: "600",
                        color: "#ea580c",
                        padding: "4px 0"
                      }}>
                        {section.name}
                      </summary>
                      <div style={{
                        marginTop: "6px",
                        paddingLeft: "12px",
                        borderLeft: "2px solid #fed7aa"
                      }}>
                        {section.changes.map((change, changeIdx) => (
                          <div
                            key={changeIdx}
                            style={{
                              padding: "4px 8px",
                              marginBottom: "4px",
                              borderRadius: "4px",
                              background: change.type === 'added' ? '#dcfce7' : '#fee2e2',
                              borderLeft: `3px solid ${change.type === 'added' ? '#16a34a' : '#dc2626'}`,
                              fontSize: "12px"
                            }}
                          >
                            <strong style={{
                              color: change.type === 'added' ? '#16a34a' : '#dc2626',
                              fontSize: "10px",
                              marginRight: "6px"
                            }}>
                              {change.type === 'added' ? '+ TILLAGT' : '- BORTTAGET'}
                            </strong>
                            {change.text}
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Analysis History Tabs */}
        {aiHistory?.analyses && aiHistory.analyses.length > 1 && (
          <div style={{ marginBottom: "15px" }}>
            <div style={{
              display: "flex",
              gap: "8px",
              borderBottom: "2px solid #e5e7eb",
              marginBottom: "12px"
            }}>
              {aiHistory.analyses.map((analysis, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedAnalysisTab(idx);
                    setData(prev => ({ ...prev, ai: analysis.analysis_text }));
                  }}
                  style={{
                    padding: "8px 16px",
                    fontSize: "12px",
                    fontWeight: "600",
                    background: selectedAnalysisTab === idx ? "#3b82f6" : "transparent",
                    color: selectedAnalysisTab === idx ? "white" : "#6b7280",
                    border: "none",
                    borderBottom: selectedAnalysisTab === idx ? "2px solid #3b82f6" : "2px solid transparent",
                    cursor: "pointer",
                    borderRadius: "4px 4px 0 0",
                    transition: "all 0.2s"
                  }}
                >
                  {idx === 0 ? "Senaste" : `Analys ${idx + 1}`}
                  <div style={{ fontSize: "10px", opacity: 0.8, marginTop: "2px" }}>
                    {new Date(analysis.created_at).toLocaleString('sv-SE', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="ai-analysis">
          {ai?.split('\n').map((line, i) => {
            const trimmedLine = line.trim();

            // Handle ### markdown headings (h4)
            if (trimmedLine.startsWith('### ')) {
              return <h4 key={i} className="ai-subheading">{trimmedLine.substring(4).trim()}</h4>;
            }
            // Handle ## markdown headings (h3)
            else if (trimmedLine.startsWith('## ')) {
              return <h3 key={i} className="ai-heading">{trimmedLine.substring(3).trim()}</h3>;
            }
            // Handle **bold** headings (old format)
            else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
              return <h3 key={i} className="ai-heading">{trimmedLine.replace(/\*\*/g, '')}</h3>;
            }
            // Handle bullet points (- or •)
            else if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•')) {
              return <li key={i} className="ai-bullet">{trimmedLine.replace(/^[-•]\s*/, '').trim()}</li>;
            }
            // Handle other text
            else if (trimmedLine) {
              return <p key={i} className="ai-text">{trimmedLine}</p>;
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

      {/* Entry Modal */}
      {showEntryModal && entryModalStock && (
        <EntryModal
          stock={entryModalStock}
          onClose={() => setShowEntryModal(false)}
          onConfirm={handleEntryConfirm}
        />
      )}
    </div>
  );
}
