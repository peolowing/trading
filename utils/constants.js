/**
 * Trading Constants - Single Source of Truth
 * All constants used throughout the application
 */

// ============================================
// EXIT STATUS
// ============================================

export const EXIT_STATUS = {
  HOLD: 'HOLD',
  PARTIAL_EXIT: 'PARTIAL_EXIT',
  EXITED: 'EXITED'
};

export const EXIT_STATUS_LABELS = {
  [EXIT_STATUS.HOLD]: 'Aktiv',
  [EXIT_STATUS.PARTIAL_EXIT]: 'Delvis såld',
  [EXIT_STATUS.EXITED]: 'Avslutad'
};

// ============================================
// EXIT TYPES
// ============================================

export const EXIT_TYPE = {
  TARGET: 'TARGET',
  STOP: 'STOP',
  EMA20: 'EMA20',
  EMA50: 'EMA50',
  ATR: 'ATR',
  TIME: 'TIME',
  PARTIAL_SCALE: 'PARTIAL_SCALE',
  PANIC: 'PANIC',
  MANUAL: 'MANUAL'
};

export const EXIT_TYPE_LABELS = {
  [EXIT_TYPE.TARGET]: 'Target nådd',
  [EXIT_TYPE.STOP]: 'Stop loss',
  [EXIT_TYPE.EMA20]: 'EMA20 break',
  [EXIT_TYPE.EMA50]: 'EMA50 break',
  [EXIT_TYPE.ATR]: 'ATR trailing',
  [EXIT_TYPE.TIME]: 'Time-based',
  [EXIT_TYPE.PARTIAL_SCALE]: 'Skalad exit',
  [EXIT_TYPE.PANIC]: 'Panik-exit',
  [EXIT_TYPE.MANUAL]: 'Manuell'
};

// ============================================
// ENTRY SETUP TYPES
// ============================================

export const ENTRY_SETUP = {
  PULLBACK: 'Pullback',
  BREAKOUT: 'Breakout',
  RANGE: 'Range',
  TREND: 'Trend',
  REVERSAL: 'Reversal'
};

export const ENTRY_SETUP_LABELS = {
  [ENTRY_SETUP.PULLBACK]: 'Pullback till EMA',
  [ENTRY_SETUP.BREAKOUT]: 'Breakout över resistans',
  [ENTRY_SETUP.RANGE]: 'Range trading',
  [ENTRY_SETUP.TREND]: 'Trend following',
  [ENTRY_SETUP.REVERSAL]: 'Reversal setup'
};

// ============================================
// TRAILING TYPES
// ============================================

export const TRAILING_TYPE = {
  EMA20: 'EMA20',
  EMA50: 'EMA50',
  ATR: 'ATR',
  MANUAL: 'Manual',
  FIXED: 'Fixed'
};

export const TRAILING_TYPE_LABELS = {
  [TRAILING_TYPE.EMA20]: 'EMA20 trailing',
  [TRAILING_TYPE.EMA50]: 'EMA50 trailing',
  [TRAILING_TYPE.ATR]: 'ATR trailing',
  [TRAILING_TYPE.MANUAL]: 'Manuell',
  [TRAILING_TYPE.FIXED]: 'Fast stop'
};

// ============================================
// WATCHLIST STATUS
// ============================================

export const WATCHLIST_STATUS = {
  WAIT_PULLBACK: 'WAIT_PULLBACK',
  APPROACHING: 'APPROACHING',
  READY: 'READY',
  BREAKOUT_ONLY: 'BREAKOUT_ONLY',
  INVALIDATED: 'INVALIDATED'
};

export const WATCHLIST_STATUS_LABELS = {
  [WATCHLIST_STATUS.WAIT_PULLBACK]: 'Vänta på pullback',
  [WATCHLIST_STATUS.APPROACHING]: 'Närmar sig entry',
  [WATCHLIST_STATUS.READY]: 'Klar för entry',
  [WATCHLIST_STATUS.BREAKOUT_ONLY]: 'Endast breakout',
  [WATCHLIST_STATUS.INVALIDATED]: 'Invaliderad'
};

export const WATCHLIST_STATUS_ICONS = {
  [WATCHLIST_STATUS.WAIT_PULLBACK]: '🔵',
  [WATCHLIST_STATUS.APPROACHING]: '🟡',
  [WATCHLIST_STATUS.READY]: '🟢',
  [WATCHLIST_STATUS.BREAKOUT_ONLY]: '🟠',
  [WATCHLIST_STATUS.INVALIDATED]: '🔴'
};

// ============================================
// POSITION SOURCE
// ============================================

export const POSITION_SOURCE = {
  WATCHLIST: 'WATCHLIST',
  MANUAL: 'MANUAL',
  SCREENER: 'SCREENER'
};

export const POSITION_SOURCE_LABELS = {
  [POSITION_SOURCE.WATCHLIST]: 'Bevakningslista',
  [POSITION_SOURCE.MANUAL]: 'Manuell entry',
  [POSITION_SOURCE.SCREENER]: 'Screener'
};

// ============================================
// EDGE TAGS
// ============================================

export const EDGE_TAG = {
  A: 'A',
  B: 'B',
  C: 'C'
};

export const EDGE_TAG_LABELS = {
  [EDGE_TAG.A]: 'A - Perfekt execution',
  [EDGE_TAG.B]: 'B - Bra men inte perfekt',
  [EDGE_TAG.C]: 'C - Regelbrott'
};

export const EDGE_TAG_COLORS = {
  [EDGE_TAG.A]: '#16a34a', // green
  [EDGE_TAG.B]: '#f59e0b', // amber
  [EDGE_TAG.C]: '#dc2626'  // red
};

// ============================================
// EVENT TYPES
// ============================================

export const EVENT_TYPE = {
  ENTRY: 'ENTRY',
  EXIT: 'EXIT',
  PARTIAL_EXIT: 'PARTIAL_EXIT',
  STOP_MOVED: 'STOP_MOVED',
  TARGET_MOVED: 'TARGET_MOVED',
  NOTE: 'NOTE'
};

export const EVENT_TYPE_LABELS = {
  [EVENT_TYPE.ENTRY]: 'Entry',
  [EVENT_TYPE.EXIT]: 'Exit',
  [EVENT_TYPE.PARTIAL_EXIT]: 'Partial Exit',
  [EVENT_TYPE.STOP_MOVED]: 'Stop flyttad',
  [EVENT_TYPE.TARGET_MOVED]: 'Target flyttad',
  [EVENT_TYPE.NOTE]: 'Anteckning'
};

export const EVENT_TYPE_ICONS = {
  [EVENT_TYPE.ENTRY]: '🚀',
  [EVENT_TYPE.EXIT]: '🎯',
  [EVENT_TYPE.PARTIAL_EXIT]: '📊',
  [EVENT_TYPE.STOP_MOVED]: '🛡️',
  [EVENT_TYPE.TARGET_MOVED]: '🎯',
  [EVENT_TYPE.NOTE]: '📝'
};

// ============================================
// RISK LIMITS
// ============================================

export const RISK_LIMITS = {
  MAX_RISK_PER_TRADE: 3.0,     // Max 3% per trade
  RECOMMENDED_RISK: 1.5,        // Rekommenderad risk
  MIN_RR_RATIO: 1.5,            // Minimum R/R ratio
  RECOMMENDED_RR_RATIO: 2.0     // Rekommenderad R/R ratio
};

// ============================================
// REGIME TYPES
// ============================================

export const REGIME = {
  BULLISH: 'Bullish',
  BEARISH: 'Bearish',
  SIDEWAYS: 'Sideways',
  VOLATILE: 'Volatile'
};

export const REGIME_LABELS = {
  [REGIME.BULLISH]: 'Bullish (Uppåtgående)',
  [REGIME.BEARISH]: 'Bearish (Nedåtgående)',
  [REGIME.SIDEWAYS]: 'Sideways (Sidledes)',
  [REGIME.VOLATILE]: 'Volatile (Volatil)'
};

export const REGIME_COLORS = {
  [REGIME.BULLISH]: '#16a34a',   // green
  [REGIME.BEARISH]: '#dc2626',   // red
  [REGIME.SIDEWAYS]: '#64748b',  // gray
  [REGIME.VOLATILE]: '#f59e0b'   // amber
};

// ============================================
// RSI LEVELS
// ============================================

export const RSI_LEVELS = {
  OVERSOLD: 30,
  NEUTRAL_LOW: 45,
  NEUTRAL_HIGH: 55,
  OVERBOUGHT: 70
};

export const RSI_LABELS = {
  OVERSOLD: 'Översåld',
  CALM: 'Lugn',
  NEUTRAL: 'Neutral',
  WARM: 'Varm',
  OVERBOUGHT: 'Överköpt'
};

/**
 * Get RSI label based on value
 * @param {number} rsi - RSI value
 * @returns {string} RSI label
 */
export function getRSILabel(rsi) {
  if (rsi <= RSI_LEVELS.OVERSOLD) return RSI_LABELS.OVERSOLD;
  if (rsi <= RSI_LEVELS.NEUTRAL_LOW) return RSI_LABELS.CALM;
  if (rsi <= RSI_LEVELS.NEUTRAL_HIGH) return RSI_LABELS.NEUTRAL;
  if (rsi <= RSI_LEVELS.OVERBOUGHT) return RSI_LABELS.WARM;
  return RSI_LABELS.OVERBOUGHT;
}

// ============================================
// DATE FORMATS
// ============================================

export const DATE_FORMAT = {
  ISO: 'YYYY-MM-DD',
  DISPLAY: 'D MMM YYYY',
  DISPLAY_WITH_TIME: 'D MMM YYYY HH:mm',
  SHORT: 'DD/MM'
};

// ============================================
// COLORS
// ============================================

export const COLORS = {
  // Success/Error
  SUCCESS: '#16a34a',
  ERROR: '#dc2626',
  WARNING: '#f59e0b',
  INFO: '#3b82f6',
  NEUTRAL: '#64748b',

  // Chart colors
  CHART_LINE: '#4f46e5',
  CHART_EMA20: '#3b82f6',
  CHART_EMA50: '#f59e0b',
  CHART_VOLUME: '#94a3b8',

  // Background
  BG_WHITE: '#ffffff',
  BG_GRAY_LIGHT: '#f8fafc',
  BG_GRAY: '#f1f5f9',

  // Text
  TEXT_PRIMARY: '#0f172a',
  TEXT_SECONDARY: '#64748b',
  TEXT_MUTED: '#94a3b8'
};

// ============================================
// EXPORT ALL
// ============================================

export default {
  EXIT_STATUS,
  EXIT_STATUS_LABELS,
  EXIT_TYPE,
  EXIT_TYPE_LABELS,
  ENTRY_SETUP,
  ENTRY_SETUP_LABELS,
  TRAILING_TYPE,
  TRAILING_TYPE_LABELS,
  WATCHLIST_STATUS,
  WATCHLIST_STATUS_LABELS,
  WATCHLIST_STATUS_ICONS,
  POSITION_SOURCE,
  POSITION_SOURCE_LABELS,
  EDGE_TAG,
  EDGE_TAG_LABELS,
  EDGE_TAG_COLORS,
  EVENT_TYPE,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_ICONS,
  RISK_LIMITS,
  REGIME,
  REGIME_LABELS,
  REGIME_COLORS,
  RSI_LEVELS,
  RSI_LABELS,
  getRSILabel,
  DATE_FORMAT,
  COLORS
};
