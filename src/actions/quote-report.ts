import type { Action, IAgentRuntime, Memory, State, ActionResult } from '@elizaos/core';
import { NewsReporterService } from '../services/news-reporter-service';
import { getAllReportTypes } from '../knowledge/report-types';

/**
 * QUOTE_REPORT Action
 *
 * Creates a job quote for a commissioned news report.
 * Integrates with plugin-commerce JobService.
 */
export const quoteReportAction: Action = {
  name: 'QUOTE_REPORT',
  description: 'Provide a quote for a commissioned news report',
  examples: [
    [
      {
        name: '{{user1}}',
        content: { text: 'Can you write a deep dive on the Babylon whale activity?' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'I can write a Deep Dive Analysis on that topic for $200. It will be a comprehensive 1500-word report with analysis, context, and implications. Delivery in about 30 minutes. Interested?',
        },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const text = message.content.text?.toLowerCase() || '';

    return (
      (text.includes('write') ||
        text.includes('report') ||
        text.includes('article') ||
        text.includes('analysis')) &&
      (text.includes('can you') || text.includes('could you') || text.includes('quote'))
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: (response: any) => void
  ): Promise<ActionResult> => {
    const reporter = runtime.getService('news-reporter') as unknown as NewsReporterService | null;
    if (!reporter) {
      if (callback) {
        await callback({
          text: 'News reporter service is not available.',
          error: true,
        });
      }
      return {
        success: false,
        error: new Error('NewsReporter service not available'),
      };
    }

    try {
      const text = message.content.text || '';

      // Detect report type from message
      const reportTypes = getAllReportTypes();
      let detectedType = reportTypes[0]; // Default to briefing

      for (const type of reportTypes) {
        if (
          text.toLowerCase().includes(type.type) ||
          text.toLowerCase().includes(type.name.toLowerCase())
        ) {
          detectedType = type;
          break;
        }
      }

      // Get price
      const price = reporter.getPriceForReportType(detectedType.type);

      // Format quote message
      const quoteText = `I can write a **${detectedType.name}** on that topic for **$${price}**.

${detectedType.description}

**Details:**
- ${detectedType.estimatedWordCount} words
- Delivery in ~${Math.round(detectedType.deliveryTimeMs / 60000)} minutes
- ${detectedType.structure.join(', ')}

Would you like me to proceed?`;

      if (callback) {
        await callback({
          text: quoteText,
          action: 'QUOTE_REPORT',
        });
      }

      return {
        success: true,
        text: `Quoted ${detectedType.name}: $${price}`,
        values: {
          reportType: detectedType.type,
          price,
          estimatedWordCount: detectedType.estimatedWordCount,
        },
        data: {
          reportType: detectedType,
        },
      };
    } catch (error) {
      runtime.logger.error({ scope: 'plugin:newsreporter', error }, 'Error in quoteReportAction');

      if (callback) {
        await callback({
          text: 'I encountered an error preparing your quote.',
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
