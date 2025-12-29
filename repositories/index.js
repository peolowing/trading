/**
 * Repository Layer - Index
 *
 * Central export point for all repositories.
 * Import repositories from here instead of individual files.
 *
 * @example
 * import { portfolioRepo, eventsRepo, watchlistRepo } from './repositories/index.js';
 */

import * as portfolioRepo from './portfolio.repository.js';
import * as eventsRepo from './events.repository.js';
import * as watchlistRepo from './watchlist.repository.js';
import * as backtestRepo from './backtest.repository.js';
import * as marketdataRepo from './marketdata.repository.js';
import * as screenerRepo from './screener.repository.js';
import * as agentsRepo from './agents.repository.js';

export {
  portfolioRepo,
  eventsRepo,
  watchlistRepo,
  backtestRepo,
  marketdataRepo,
  screenerRepo,
  agentsRepo
};
