import type { Plugin } from '@elizaos/core';
import { NewsReporterService } from './services/news-reporter-service';
import {
  // Multi-resolution providers
  coverageOverviewProvider,
  coverageProvider,
  coverageFullProvider,
  reportsOverviewProvider,
  reportsProvider,
  reportsFullProvider,
  // Plugin info providers
  newsreporterSettingsProvider,
  newsreporterUsageProvider,
  // Output mechanism
  storyPromptProvider,
  reporterBusinessProvider,
} from './providers';
import { feedbackSentinelEvaluator, coverageTrackerEvaluator } from './evaluators';
import {
  quoteReportAction,
  acceptReportJobAction,
  writeArticleAction,
  deliverReportAction,
} from './actions';
import { banner } from './banner';

/**
 * Plugin: NewsReporter
 *
 * The presenter. Reads story intelligence (from plugin-investigator or any story-shaped
 * provider) and tells stories to audiences. Manages coverage, cadence, and commerce.
 *
 * Output mechanism:
 * - STORY_PROMPT provider: Adapts per room, surfaces relevant stories
 * - Coverage pump: Ensures regular mentions without spam
 * - Anti-spam safeguards: Cadence, daily caps, strike system
 *
 * Public API (8 dynamic providers + 1 output provider):
 * - COVERAGE_STATE (3 resolutions: overview, default, full)
 * - NEWS_REPORTS (3 resolutions: overview, default, full)
 * - NEWSREPORTER_SETTINGS (plugin configuration)
 * - NEWSREPORTER_USAGE (usage instructions)
 * - STORY_PROMPT (output mechanism, not dynamic)
 *
 * Commerce integration:
 * - Commissioned reports via plugin-commerce
 * - Pricing based on report type
 * - v1: Basic quoting and generation
 * - v2: Full job lifecycle, subscriptions, experience learning
 *
 * No hard dependency on plugin-investigator. Reads from any story-shaped provider data.
 * For maximum composability.
 */
export const newsreporterPlugin: Plugin = {
  name: 'newsreporter',
  description: 'AI news reporter - storytelling, coverage management, and commerce',

  // Hard dependency on commerce for pricing/jobs
  dependencies: ['@elizaos/plugin-commerce'],

  // Service: Single stateful service managing coverage and commerce
  services: [NewsReporterService as unknown as typeof import('@elizaos/core').Service],

  // Providers: Multi-resolution dynamic providers + output mechanism
  providers: [
    // Coverage state - low, medium, high resolution
    coverageOverviewProvider,
    coverageProvider,
    coverageFullProvider,
    // Reports - low, medium, high resolution
    reportsOverviewProvider,
    reportsProvider,
    reportsFullProvider,
    // Plugin info - settings and usage
    newsreporterSettingsProvider,
    newsreporterUsageProvider,
    // Output mechanism (not dynamic - runs every time but early-exits cheaply)
    storyPromptProvider,
    // Commerce capabilities
    reporterBusinessProvider,
  ],

  // Evaluators: Coverage tracking + feedback detection
  evaluators: [
    coverageTrackerEvaluator, // Tracks agent's mentions in output rooms
    feedbackSentinelEvaluator, // Detects negative feedback, manages strikes
  ],

  // Actions: Commerce workflow
  actions: [
    quoteReportAction, // Quote price for report
    acceptReportJobAction, // Accept commissioned job
    writeArticleAction, // Generate report
    deliverReportAction, // Deliver and close job
  ],

  // Initialization
  init: async (_config, runtime) => {
    console.log(banner);
    runtime.logger.info({ scope: 'plugin:newsreporter' }, 'NewsReporter plugin initialized');

    // Check for plugin-commerce
    // Verify plugin-commerce is available (gracefully degrade if not)
    const commerceService = runtime.getService('commerce');
    if (!commerceService) {
      runtime.logger.warn(
        { scope: 'plugin:newsreporter' },
        'plugin-commerce not loaded - commerce features disabled'
      );
    }
  },
};

export default newsreporterPlugin;
