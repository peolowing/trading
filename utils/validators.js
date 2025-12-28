/**
 * Validation Functions - Single Source of Truth
 * Pure validation functions for trading data
 * Used by both backend and frontend
 */

// ============================================
// CUSTOM ERROR CLASS
// ============================================

export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

// ============================================
// POSITION ENTRY VALIDATION
// ============================================

/**
 * Validera position entry data
 * @param {Object} data - Position entry data
 * @throws {ValidationError} If validation fails
 */
export function validatePositionEntry(data) {
  // Ticker
  if (!data.ticker || typeof data.ticker !== 'string') {
    throw new ValidationError('Ticker krävs', 'ticker');
  }

  if (data.ticker.length < 1 || data.ticker.length > 20) {
    throw new ValidationError('Ticker måste vara 1-20 tecken', 'ticker');
  }

  // Entry price
  if (!data.entry_price || typeof data.entry_price !== 'number') {
    throw new ValidationError('Entry price krävs', 'entry_price');
  }

  if (data.entry_price <= 0) {
    throw new ValidationError('Entry price måste vara > 0', 'entry_price');
  }

  // Quantity
  if (!data.quantity || typeof data.quantity !== 'number') {
    throw new ValidationError('Quantity krävs', 'quantity');
  }

  if (data.quantity <= 0) {
    throw new ValidationError('Quantity måste vara > 0', 'quantity');
  }

  if (!Number.isInteger(data.quantity)) {
    throw new ValidationError('Quantity måste vara ett heltal', 'quantity');
  }

  // Initial stop
  if (!data.initial_stop || typeof data.initial_stop !== 'number') {
    throw new ValidationError('Initial stop krävs', 'initial_stop');
  }

  if (data.initial_stop >= data.entry_price) {
    throw new ValidationError('Stop måste vara lägre än entry price', 'initial_stop');
  }

  // Initial target
  if (!data.initial_target || typeof data.initial_target !== 'number') {
    throw new ValidationError('Initial target krävs', 'initial_target');
  }

  if (data.initial_target <= data.entry_price) {
    throw new ValidationError('Target måste vara högre än entry price', 'initial_target');
  }

  // Risk percent (if provided)
  if (data.risk_pct !== undefined && data.risk_pct !== null) {
    if (typeof data.risk_pct !== 'number') {
      throw new ValidationError('Risk % måste vara ett nummer', 'risk_pct');
    }

    if (data.risk_pct < 0) {
      throw new ValidationError('Risk % kan inte vara negativ', 'risk_pct');
    }

    if (data.risk_pct > 3) {
      throw new ValidationError('Risk får inte överstiga 3%', 'risk_pct');
    }
  }

  // Entry setup (if provided)
  if (data.entry_setup) {
    const validSetups = ['Pullback', 'Breakout', 'Range', 'Trend', 'Reversal'];
    if (!validSetups.includes(data.entry_setup)) {
      throw new ValidationError(
        `Entry setup måste vara en av: ${validSetups.join(', ')}`,
        'entry_setup'
      );
    }
  }

  // Trailing type (if provided)
  if (data.trailing_type) {
    const validTypes = ['EMA20', 'EMA50', 'ATR', 'Manual', 'Fixed'];
    if (!validTypes.includes(data.trailing_type)) {
      throw new ValidationError(
        `Trailing type måste vara en av: ${validTypes.join(', ')}`,
        'trailing_type'
      );
    }
  }
}

// ============================================
// POSITION EXIT VALIDATION
// ============================================

/**
 * Validera position exit data
 * @param {Object} data - Position exit data
 * @throws {ValidationError} If validation fails
 */
export function validatePositionExit(data) {
  // Exit price
  if (!data.exit_price || typeof data.exit_price !== 'number') {
    throw new ValidationError('Exit price krävs', 'exit_price');
  }

  if (data.exit_price <= 0) {
    throw new ValidationError('Exit price måste vara > 0', 'exit_price');
  }

  // Exit type
  if (!data.exit_type || typeof data.exit_type !== 'string') {
    throw new ValidationError('Exit type krävs', 'exit_type');
  }

  const validExitTypes = [
    'TARGET',
    'STOP',
    'EMA20',
    'EMA50',
    'ATR',
    'TIME',
    'PARTIAL_SCALE',
    'PANIC',
    'MANUAL'
  ];

  if (!validExitTypes.includes(data.exit_type)) {
    throw new ValidationError(
      `Exit type måste vara en av: ${validExitTypes.join(', ')}`,
      'exit_type'
    );
  }

  // Exit date (if provided)
  if (data.exit_date) {
    const date = new Date(data.exit_date);
    if (isNaN(date.getTime())) {
      throw new ValidationError('Exit date måste vara ett giltigt datum', 'exit_date');
    }
  }
}

// ============================================
// EVALUATION VALIDATION
// ============================================

/**
 * Validera självutvärdering
 * @param {Object} data - Evaluation data
 * @throws {ValidationError} If validation fails
 */
export function validateEvaluation(data) {
  // Edge tag
  if (data.edge_tag !== undefined && data.edge_tag !== null) {
    if (typeof data.edge_tag !== 'string') {
      throw new ValidationError('Edge tag måste vara en sträng', 'edge_tag');
    }

    const validTags = ['A', 'B', 'C'];
    if (!validTags.includes(data.edge_tag)) {
      throw new ValidationError(
        `Edge tag måste vara en av: ${validTags.join(', ')}`,
        'edge_tag'
      );
    }
  }

  // Lesson learned
  if (data.lesson_learned !== undefined && data.lesson_learned !== null) {
    if (typeof data.lesson_learned !== 'string') {
      throw new ValidationError('Lärdom måste vara en sträng', 'lesson_learned');
    }

    if (data.lesson_learned.length > 500) {
      throw new ValidationError('Lärdom får max vara 500 tecken', 'lesson_learned');
    }
  }

  // Boolean fields
  const booleanFields = [
    'plan_followed',
    'exited_early',
    'stopped_out',
    'broke_rule',
    'could_scale_better'
  ];

  for (const field of booleanFields) {
    if (data[field] !== undefined && data[field] !== null) {
      if (typeof data[field] !== 'boolean') {
        throw new ValidationError(`${field} måste vara true/false`, field);
      }
    }
  }
}

// ============================================
// UPDATE VALIDATION
// ============================================

/**
 * Validera uppdatering av stop/target
 * @param {string} field - Field name ('current_stop' or 'current_target')
 * @param {number} value - New value
 * @param {Object} position - Current position data
 * @throws {ValidationError} If validation fails
 */
export function validateStopTargetUpdate(field, value, position) {
  if (!value || typeof value !== 'number') {
    throw new ValidationError(`${field} måste vara ett nummer`, field);
  }

  if (value <= 0) {
    throw new ValidationError(`${field} måste vara > 0`, field);
  }

  // Validate current_stop
  if (field === 'current_stop') {
    if (value >= position.entry_price) {
      throw new ValidationError('Stop måste vara lägre än entry price', field);
    }

    // Stop ska inte vara högre än initial stop (moving against you)
    if (value > position.initial_stop) {
      console.warn('Warning: Moving stop against position (higher than initial)');
    }
  }

  // Validate current_target
  if (field === 'current_target') {
    if (value <= position.entry_price) {
      throw new ValidationError('Target måste vara högre än entry price', field);
    }

    // Target ska normalt vara högre än initial target (letting it run)
    if (value < position.initial_target) {
      console.warn('Warning: Lowering target below initial target');
    }
  }
}

// ============================================
// UTILITY VALIDATORS
// ============================================

/**
 * Validera ticker format
 * @param {string} ticker - Ticker symbol
 * @returns {boolean} True if valid
 */
export function isValidTicker(ticker) {
  if (!ticker || typeof ticker !== 'string') return false;
  if (ticker.length < 1 || ticker.length > 20) return false;

  // Tillåt A-Z, 0-9, punkt, bindestreck
  const tickerRegex = /^[A-Z0-9.-]+$/i;
  return tickerRegex.test(ticker);
}

/**
 * Validera datum format
 * @param {string} dateString - Date string (YYYY-MM-DD)
 * @returns {boolean} True if valid
 */
export function isValidDate(dateString) {
  if (!dateString) return false;

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return false;

  // Check format YYYY-MM-DD
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  return regex.test(dateString);
}

/**
 * Validera email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize string input (remove XSS attempts)
 * @param {string} input - Raw input string
 * @returns {string} Sanitized string
 */
export function sanitizeString(input) {
  if (!input || typeof input !== 'string') return '';

  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}
