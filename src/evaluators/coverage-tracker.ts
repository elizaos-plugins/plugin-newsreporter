import type { Evaluator, IAgentRuntime, Memory, State } from '@elizaos/core';
import { NewsReporterService } from '../services/news-reporter-service';

/**
 * Coverage Tracker Evaluator
 *
 * Resets the coverage timer when the agent speaks in an output room.
 * This is how the coverage pump knows the agent recently mentioned stories.
 *
 * Simple approach: any agent message in an output room resets the timer.
 * The STORY_PROMPT provider steers the agent toward stories, so if the agent spoke,
 * it likely mentioned one.
 */
export const coverageTrackerEvaluator: Evaluator = {
  name: 'NEWS_COVERAGE_TRACKER',
  description: 'Tracks when agent mentions stories in output rooms',
  alwaysRun: true,
  examples: [],

  /**
   * Only track the agent's own messages in output rooms
   */
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    // Only track agent's messages
    if (message.entityId !== runtime.agentId) {
      return false;
    }

    const reporter = runtime.getService('news-reporter') as unknown as NewsReporterService | null;
    if (!reporter) {
      return false;
    }

    // Only track in configured output rooms
    return reporter.isOutputRoom(message.roomId);
  },

  /**
   * Record mention to update coverage state
   */
  handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const reporter = runtime.getService('news-reporter') as unknown as NewsReporterService | null;
    if (!reporter) {
      return;
    }

    try {
      await reporter.recordMention(message.roomId);

      runtime.logger.debug(
        { scope: 'plugin:newsreporter', roomId: message.roomId },
        'Recorded coverage mention'
      );
    } catch (error) {
      runtime.logger.error(
        { scope: 'plugin:newsreporter', error },
        'Error in coverageTrackerEvaluator'
      );
    }
  },
};
