export { newsreporterPlugin as plugin } from './plugin';
export { newsreporterPlugin } from './plugin';
export { NewsReporterService } from './services/news-reporter-service';

// Export types for other plugins to use
export type {
  OutputRoomConfig,
  CoverageState,
  ReportType,
  NewsReport,
  StoryArchetype,
  ReportTypeMetadata,
} from './types';

// Export config
export { newsReporterConfigSchema, type NewsReporterConfig } from './config';

// Export providers
export { storyPromptProvider, reporterBusinessProvider } from './providers';

// Export evaluators
export { feedbackSentinelEvaluator, coverageTrackerEvaluator } from './evaluators';

// Export actions
export {
  quoteReportAction,
  acceptReportJobAction,
  writeArticleAction,
  deliverReportAction,
} from './actions';

// Export knowledge
export { getReportMetadata, getAllReportTypes } from './knowledge/report-types';
export { getPlatformVoice, getPlatformGuidanceText } from './knowledge/platform-voice';
export {
  getArchetype,
  getAllArchetypes,
  pickRandomArchetype,
  suggestArchetype,
} from './knowledge/story-archetypes';
