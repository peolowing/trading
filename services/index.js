/**
 * Service Layer - Index
 *
 * Central export point for all services.
 * Import services from here instead of individual files.
 *
 * @example
 * import { positionService, analysisService, watchlistService } from './services/index.js';
 */

import * as positionService from './position.service.js';
import * as analysisService from './analysis.service.js';
import * as watchlistService from './watchlist.service.js';

export {
  positionService,
  analysisService,
  watchlistService
};
