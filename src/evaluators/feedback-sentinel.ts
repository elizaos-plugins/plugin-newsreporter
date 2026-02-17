import type { Evaluator, IAgentRuntime, Memory, State } from '@elizaos/core';
import { NewsReporterService } from '../services/news-reporter-service';

/**
 * Feedback Sentinel Evaluator
 *
 * Detects negative feedback about news sharing and auto-mutes rooms that don't want it.
 * Uses alwaysRun with cheap validate() pre-filter.
 */
export const feedbackSentinelEvaluator: Evaluator = {
  name: 'NEWS_FEEDBACK_SENTINEL',
  description: 'Detects negative feedback and manages strike system',
  alwaysRun: true,
  examples: [],

  /**
   * Only check messages from others in output rooms
   */
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    // Skip agent's own messages
    if (message.entityId === runtime.agentId) {
      return false;
    }

    const reporter = runtime.getService('news-reporter') as unknown as NewsReporterService | null;
    if (!reporter) {
      return false;
    }

    // Only check messages in configured output rooms
    return reporter.isOutputRoom(message.roomId);
  },

  /**
   * Check for negative feedback and record strike
   */
  handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const reporter = runtime.getService('news-reporter') as unknown as NewsReporterService | null;
    if (!reporter) {
      return;
    }

    try {
      const text = message.content.text || '';

      if (reporter.isNegativeFeedback(text)) {
        await reporter.recordStrike(message.roomId);

        runtime.logger.warn(
          { scope: 'plugin:newsreporter', roomId: message.roomId },
          'Negative feedback detected, strike recorded'
        );
      }
    } catch (error) {
      runtime.logger.error(
        { scope: 'plugin:newsreporter', error },
        'Error in feedbackSentinelEvaluator'
      );
    }
  },
};
