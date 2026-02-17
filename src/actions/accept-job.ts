import type { Action, IAgentRuntime, Memory, State, ActionResult } from '@elizaos/core';

/**
 * ACCEPT_REPORT_JOB Action
 *
 * Accepts a commissioned report job.
 * Integrates with plugin-commerce JobService.
 *
 * v1: Placeholder for commerce integration
 * v2: Full implementation with JobService
 */
export const acceptReportJobAction: Action = {
  name: 'ACCEPT_REPORT_JOB',
  description: 'Accept a commissioned news report job',
  examples: [
    [
      {
        name: '{{user1}}',
        content: { text: 'Yes, please proceed with that report' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Great! I\'ve accepted the job. I\'ll get started on your report right away.',
        },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const text = message.content.text?.toLowerCase() || '';

    return (
      (text.includes('yes') ||
        text.includes('proceed') ||
        text.includes('go ahead') ||
        text.includes('accept') ||
        text.includes('do it')) &&
      (state?.values?.lastAction === 'QUOTE_REPORT' || text.includes('report') || text.includes('job'))
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: (response: any) => void
  ): Promise<ActionResult> => {
    // v1: Simple acknowledgment
    // v2: Create job via JobService, track in commerce system

    try {
      if (callback) {
        await callback({
          text: 'Perfect! I\'ve accepted the job. I\'ll start working on your report and deliver it shortly.',
          action: 'ACCEPT_REPORT_JOB',
        });
      }

      return {
        success: true,
        text: 'Job accepted',
        values: {
          jobAccepted: true,
        },
      };
    } catch (error) {
      runtime.logger.error(
        { scope: 'plugin:newsreporter', error },
        'Error in acceptReportJobAction'
      );

      if (callback) {
        await callback({
          text: 'I encountered an error accepting the job.',
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
