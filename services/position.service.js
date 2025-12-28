/**
 * Position Service
 *
 * Business logic for portfolio position management.
 * Handles entry, exit, stop management, and position calculations.
 */

import dayjs from 'dayjs';
import { portfolioRepo, eventsRepo } from '../repositories/index.js';
import {
  calculateRMultiple,
  calculatePnlPercent,
  calculatePnlKr,
  calculateInitialR,
  calculateRiskKr,
  calculateRRRatio
} from '../utils/calculations.js';

/**
 * Enter a new position
 * @param {Object} data - Entry data
 * @returns {Promise<Object>}
 */
export async function enterPosition(data) {
  const {
    ticker,
    entry_price,
    quantity,
    initial_stop,
    initial_target,
    entry_setup,
    trailing_type,
    entry_rationale,
    initial_ema20,
    initial_ema50,
    initial_rsi14,
    risk_pct,
    source = 'MANUAL'
  } = data;

  // Calculate position metrics
  const initial_r = calculateInitialR(entry_price, initial_stop);
  const risk_kr = calculateRiskKr(quantity, initial_r);
  const rr_ratio = calculateRRRatio(entry_price, initial_target, initial_stop);

  const entry_date = dayjs().format('YYYY-MM-DD');

  // Create position
  const position = await portfolioRepo.create({
    ticker,
    entry_date,
    entry_price,
    quantity,
    initial_stop,
    current_stop: initial_stop,
    initial_target,
    current_target: initial_target,
    initial_r,
    entry_setup,
    trailing_type: trailing_type || 'Manual',
    entry_rationale,
    initial_ema20,
    initial_ema50,
    current_ema20: initial_ema20,
    current_ema50: initial_ema50,
    initial_rsi14,
    risk_kr,
    risk_pct: risk_pct || 1.5,
    rr_ratio,
    exit_status: 'HOLD',
    source,
    last_updated: entry_date
  });

  // Log entry event
  try {
    await eventsRepo.create({
      ticker,
      event_date: entry_date,
      event_type: 'ENTRY',
      description: `Köpt ${quantity} st @ ${entry_price} (Stop: ${initial_stop}, Target: ${initial_target})`
    });
  } catch (e) {
    console.log('Event logging skipped:', e.message);
  }

  return position;
}

/**
 * Exit a position (full or partial)
 * @param {string} ticker - Stock ticker
 * @param {Object} exitData - Exit data
 * @returns {Promise<Object>}
 */
export async function exitPosition(ticker, exitData) {
  const {
    exit_type,
    exit_price,
    exit_quantity,
    exit_reason,
    plan_followed,
    exited_early,
    stopped_out,
    broke_rule,
    could_scale_better,
    edge_tag,
    lesson_learned
  } = exitData;

  // Fetch current position
  const position = await portfolioRepo.findByTicker(ticker);
  if (!position) {
    throw new Error('Position not found');
  }

  const exitPriceNum = parseFloat(exit_price);
  const exitDate = dayjs().format('YYYY-MM-DD');

  // Calculate exit metrics
  const r_multiple = calculateRMultiple(position.entry_price, exitPriceNum, position.initial_r);
  const pnl_pct = calculatePnlPercent(position.entry_price, exitPriceNum);
  const pnl_kr = calculatePnlKr(position.quantity, position.entry_price, exitPriceNum);

  if (exit_type === 'FULL' || !exit_quantity || exit_quantity >= position.quantity) {
    // Full exit
    const updatedPosition = await portfolioRepo.update(ticker, {
      exit_date: exitDate,
      exit_price: exitPriceNum,
      exit_status: 'EXITED',
      exit_type: exit_reason || 'MANUAL',
      r_multiple: parseFloat(r_multiple.toFixed(2)),
      pnl_pct: parseFloat(pnl_pct.toFixed(2)),
      plan_followed: plan_followed || false,
      exited_early: exited_early || false,
      stopped_out: stopped_out || false,
      broke_rule: broke_rule || false,
      could_scale_better: could_scale_better || false,
      edge_tag: edge_tag || null,
      lesson_learned: lesson_learned || null,
      last_updated: exitDate
    });

    // Log exit event
    try {
      await eventsRepo.create({
        ticker,
        event_date: exitDate,
        event_type: 'EXIT',
        description: `Sålt hela positionen @ ${exitPriceNum.toFixed(2)} (${r_multiple.toFixed(1)}R, ${pnl_kr.toFixed(0)} kr)`
      });
    } catch (e) {
      console.log('Event logging skipped:', e.message);
    }

    return {
      ...updatedPosition,
      exit_metrics: {
        r_multiple,
        pnl_pct,
        pnl_kr
      }
    };
  } else {
    // Partial exit
    const exitQty = parseInt(exit_quantity);
    const remainingQty = position.quantity - exitQty;
    const partialPnlKr = calculatePnlKr(exitQty, position.entry_price, exitPriceNum);

    const updatedPosition = await portfolioRepo.update(ticker, {
      quantity: remainingQty,
      exit_status: 'PARTIAL_EXIT',
      last_updated: exitDate
    });

    // Log partial exit event
    try {
      await eventsRepo.create({
        ticker,
        event_date: exitDate,
        event_type: 'PARTIAL_EXIT',
        description: `Sålt ${exitQty} st @ ${exitPriceNum.toFixed(2)} (${r_multiple.toFixed(1)}R, ${partialPnlKr.toFixed(0)} kr). ${remainingQty} st kvar.`
      });
    } catch (e) {
      console.log('Event logging skipped:', e.message);
    }

    return {
      ...updatedPosition,
      exit_metrics: {
        r_multiple,
        pnl_pct,
        pnl_kr: partialPnlKr,
        remaining_quantity: remainingQty
      }
    };
  }
}

/**
 * Move stop for a position
 * @param {string} ticker - Stock ticker
 * @param {number} newStop - New stop price
 * @param {string} reason - Reason for moving stop
 * @returns {Promise<Object>}
 */
export async function moveStop(ticker, newStop, reason = null) {
  const position = await portfolioRepo.findByTicker(ticker);
  if (!position) {
    throw new Error('Position not found');
  }

  const updatedPosition = await portfolioRepo.update(ticker, {
    current_stop: newStop,
    last_updated: dayjs().format('YYYY-MM-DD')
  });

  // Log stop move event
  try {
    const description = reason
      ? `Stop flyttad till ${newStop.toFixed(2)} - ${reason}`
      : `Stop flyttad till ${newStop.toFixed(2)}`;

    await eventsRepo.create({
      ticker,
      event_date: dayjs().format('YYYY-MM-DD'),
      event_type: 'STOP_MOVED',
      description
    });
  } catch (e) {
    console.log('Event logging skipped:', e.message);
  }

  return updatedPosition;
}

/**
 * Update target for a position
 * @param {string} ticker - Stock ticker
 * @param {number} newTarget - New target price
 * @returns {Promise<Object>}
 */
export async function updateTarget(ticker, newTarget) {
  const updatedPosition = await portfolioRepo.update(ticker, {
    current_target: newTarget,
    last_updated: dayjs().format('YYYY-MM-DD')
  });

  return updatedPosition;
}

/**
 * Update trailing stop type
 * @param {string} ticker - Stock ticker
 * @param {string} trailingType - Trailing type (EMA20, EMA50, ATR, Manual)
 * @returns {Promise<Object>}
 */
export async function updateTrailingType(ticker, trailingType) {
  const updatedPosition = await portfolioRepo.update(ticker, {
    trailing_type: trailingType,
    last_updated: dayjs().format('YYYY-MM-DD')
  });

  return updatedPosition;
}

/**
 * Update MFE (Max Favorable Excursion) if new high
 * @param {string} ticker - Stock ticker
 * @param {number} currentPrice - Current price
 * @returns {Promise<Object|null>}
 */
export async function updateMFE(ticker, currentPrice) {
  const position = await portfolioRepo.findByTicker(ticker);
  if (!position || position.exit_status === 'EXITED') {
    return null;
  }

  const currentR = calculateRMultiple(position.entry_price, currentPrice, position.initial_r);
  const currentMFE = position.max_mfe || 0;

  if (currentR > currentMFE) {
    const updatedPosition = await portfolioRepo.update(ticker, {
      max_mfe: parseFloat(currentR.toFixed(2)),
      last_updated: dayjs().format('YYYY-MM-DD')
    });
    return updatedPosition;
  }

  return null;
}

/**
 * Update MAE (Max Adverse Excursion) if new low
 * @param {string} ticker - Stock ticker
 * @param {number} currentPrice - Current price
 * @returns {Promise<Object|null>}
 */
export async function updateMAE(ticker, currentPrice) {
  const position = await portfolioRepo.findByTicker(ticker);
  if (!position || position.exit_status === 'EXITED') {
    return null;
  }

  const currentR = calculateRMultiple(position.entry_price, currentPrice, position.initial_r);
  const currentMAE = position.max_mae || 0;

  if (currentR < currentMAE) {
    const updatedPosition = await portfolioRepo.update(ticker, {
      max_mae: parseFloat(currentR.toFixed(2)),
      last_updated: dayjs().format('YYYY-MM-DD')
    });
    return updatedPosition;
  }

  return null;
}

/**
 * Add notes to a position
 * @param {string} ticker - Stock ticker
 * @param {string} notes - Notes text
 * @returns {Promise<Object>}
 */
export async function addNotes(ticker, notes) {
  const updatedPosition = await portfolioRepo.updateNotes(ticker, notes);

  // Log note event
  try {
    await eventsRepo.create({
      ticker,
      event_date: dayjs().format('YYYY-MM-DD'),
      event_type: 'NOTE',
      description: notes
    });
  } catch (e) {
    console.log('Event logging skipped:', e.message);
  }

  return updatedPosition;
}

/**
 * Get position with events
 * @param {string} ticker - Stock ticker
 * @returns {Promise<Object>}
 */
export async function getPositionWithEvents(ticker) {
  const position = await portfolioRepo.findByTicker(ticker);
  if (!position) {
    throw new Error('Position not found');
  }

  const events = await eventsRepo.findByTicker(ticker);

  return {
    ...position,
    events
  };
}

/**
 * Calculate current position metrics
 * @param {string} ticker - Stock ticker
 * @param {number} currentPrice - Current price
 * @returns {Promise<Object>}
 */
export async function calculateCurrentMetrics(ticker, currentPrice) {
  const position = await portfolioRepo.findByTicker(ticker);
  if (!position) {
    throw new Error('Position not found');
  }

  const unrealizedR = calculateRMultiple(position.entry_price, currentPrice, position.initial_r);
  const unrealizedPnlPct = calculatePnlPercent(position.entry_price, currentPrice);
  const unrealizedPnlKr = calculatePnlKr(position.quantity, position.entry_price, currentPrice);

  // Distance to stop and target
  const distToStop = position.current_stop
    ? ((currentPrice - position.current_stop) / position.current_stop * 100)
    : null;

  const distToTarget = position.current_target
    ? ((position.current_target - currentPrice) / currentPrice * 100)
    : null;

  return {
    ticker,
    current_price: currentPrice,
    entry_price: position.entry_price,
    unrealized_r: parseFloat(unrealizedR.toFixed(2)),
    unrealized_pnl_pct: parseFloat(unrealizedPnlPct.toFixed(2)),
    unrealized_pnl_kr: parseFloat(unrealizedPnlKr.toFixed(0)),
    current_stop: position.current_stop,
    current_target: position.current_target,
    dist_to_stop_pct: distToStop ? parseFloat(distToStop.toFixed(2)) : null,
    dist_to_target_pct: distToTarget ? parseFloat(distToTarget.toFixed(2)) : null,
    quantity: position.quantity,
    initial_r: position.initial_r
  };
}
