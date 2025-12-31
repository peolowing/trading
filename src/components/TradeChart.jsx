import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  Area,
  Bar
} from "recharts";

// Custom Candlestick shape
const Candlestick = (props) => {
  const { x, y, width, height, payload } = props;
  const { open, close, high, low } = payload;

  const isGreen = close > open;
  const color = isGreen ? "#16a34a" : "#dc2626";
  const fillColor = isGreen ? "#22c55e" : "#ef4444";

  // Calculate positions
  const bodyTop = Math.min(open, close);
  const bodyBottom = Math.max(open, close);
  const bodyHeight = Math.abs(close - open);

  // Scale factor for converting price to pixels
  const priceRange = high - low;
  const pixelsPerPrice = height / priceRange;

  // Calculate pixel positions
  const highY = y;
  const lowY = y + height;
  const bodyTopY = y + (high - bodyTop) * pixelsPerPrice;
  const bodyBottomY = y + (high - bodyBottom) * pixelsPerPrice;

  const wickX = x + width / 2;
  const bodyX = x + width * 0.2;
  const bodyWidth = width * 0.6;

  return (
    <g>
      {/* Wick (high-low line) */}
      <line
        x1={wickX}
        y1={highY}
        x2={wickX}
        y2={lowY}
        stroke={color}
        strokeWidth={1}
      />
      {/* Body (open-close rectangle) */}
      <rect
        x={bodyX}
        y={bodyTopY}
        width={bodyWidth}
        height={Math.max(bodyBottomY - bodyTopY, 1)}
        fill={fillColor}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  );
};

// Calculate EMA
function calculateEMA(data, period) {
  const k = 2 / (period + 1);
  const emaData = [];

  // Start with SMA for first value
  let ema = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  emaData.push(ema);

  // Calculate EMA for remaining values
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    emaData.push(ema);
  }

  return emaData;
}

export default function TradeChart({ candles, entry, stop, target }) {
  const recentCandles = candles.slice(-40);

  // Calculate EMAs from all available data, then slice
  const allCloses = candles.map(c => c.close);
  const ema20Full = calculateEMA(allCloses, 20);
  const ema50Full = calculateEMA(allCloses, 50);

  // Take last 40 values to match chart data
  const ema20Recent = ema20Full.slice(-40);
  const ema50Recent = ema50Full.slice(-40);

  const data = recentCandles.map((c, i) => ({
    date: c.date,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    ema20: ema20Recent[i],
    ema50: ema50Recent[i]
  }));

  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" hide />
          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 12 }} />

          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div style={{
                    background: "white",
                    padding: "8px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    fontSize: "12px"
                  }}>
                    <div><strong>{data.date}</strong></div>
                    <div style={{ color: "#16a34a" }}>O: {data.open.toFixed(2)}</div>
                    <div style={{ color: "#2563eb" }}>H: {data.high.toFixed(2)}</div>
                    <div style={{ color: "#dc2626" }}>L: {data.low.toFixed(2)}</div>
                    <div style={{ color: "#111827" }}>C: {data.close.toFixed(2)}</div>
                  </div>
                );
              }
              return null;
            }}
          />

          {/* Reward zone */}
          <Area
            dataKey={() => target}
            baseLine={entry}
            fill="#93c5fd"
            fillOpacity={0.25}
          />

          {/* Risk zone */}
          <Area
            dataKey={() => entry}
            baseLine={stop}
            fill="#fecaca"
            fillOpacity={0.35}
          />

          {/* Candlesticks using Bar with custom shape */}
          <Bar
            dataKey="high"
            shape={<Candlestick />}
          />

          {/* Target */}
          <Line
            type="monotone"
            dataKey={() => target}
            stroke="#2563eb"
            strokeDasharray="5 5"
            strokeWidth={2}
            dot={false}
          />

          {/* Entry */}
          <Line
            type="monotone"
            dataKey={() => entry}
            stroke="#16a34a"
            strokeDasharray="5 5"
            strokeWidth={2}
            dot={false}
          />

          {/* Stop */}
          <Line
            type="monotone"
            dataKey={() => stop}
            stroke="#dc2626"
            strokeDasharray="5 5"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
