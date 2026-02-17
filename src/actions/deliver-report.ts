import type { Action, IAgentRuntime, Memory, State, ActionResult } from '@elizaos/core';

/**
 * DELIVER_REPORT Action
 *
 * Delivers a completed report and closes the job.
 * Integrates with plugin-commerce JobService.
 *
 * v1: Placeholder for commerce integration
 * v2: Full implementation with JobService delivery and job closure
 */
export const deliverReportAction: Action = {
  name: 'DELIVER_REPORT',
  description: 'Deliver a completed news report',
  examples: [
    [
      {
        name: '{{agent}}',
        content: {
          text: 'Your report is ready! Here it is...',
        },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    // Auto-trigger after report generation
    // v2: Check if there's a pending job delivery
    return false; // v1: Manual trigger only via writeArticleAction
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: (response: any) => void
  ): Promise<ActionResult> => {
    // v1: Simple delivery
    // v2: Update job status, record delivery, trigger payment

    try {
      if (callback) {
        await callback({
          text: 'Report delivered! Let me know if you need any revisions or have questions.',
          action: 'DELIVER_REPORT',
        });
      }

      return {
        success: true,
        text: 'Report delivered',
        values: {
          delivered: true,
        },
      };
    } catch (error) {
      runtime.logger.error(
        { scope: 'plugin:newsreporter', error },
        'Error in deliverReportAction'
      );

      if (callback) {
        await callback({
          text: 'I encountered an error delivering the report.',
          error: true,
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },
};
