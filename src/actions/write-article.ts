import type { Action, IAgentRuntime, Memory, State, ActionResult, UUID } from '@elizaos/core';
import { NewsReporterService } from '../services/news-reporter-service';
import type { ReportType } from '../types';

/**
 * WRITE_ARTICLE Action
 *
 * Generates a news report/article.
 * Can be commissioned (via commerce job) or ad-hoc.
 */
export const writeArticleAction: Action = {
  name: 'WRITE_ARTICLE',
  description: 'Write a news report or article',
  examples: [
    [
      {
        name: '{{user1}}',
        content: { text: 'Write me a briefing on the latest Babylon developments' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'I\'ll write a Story Briefing for you. Give me a few minutes...',
        },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const text = message.content.text?.toLowerCase() || '';

    return (
      (text.includes('write') ||
        text.includes('create') ||
        text.includes('generate') ||
        text.includes('produce')) &&
      (text.includes('report') ||
        text.includes('article') ||
        text.includes('briefing') ||
        text.includes('analysis'))
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

      // Detect report type
      let reportType: ReportType = 'briefing'; // Default

      if (text.includes('deep dive') || text.includes('deep-dive')) {
        reportType = 'deep-dive';
      } else if (text.includes('trend')) {
        reportType = 'trend-report';
      } else if (text.includes('breaking')) {
        reportType = 'breaking-news';
      } else if (text.includes('recap') || text.includes('digest')) {
        reportType = 'daily-recap';
      }

      // For now, generate report without specific story IDs
      // v2: extract story IDs from context or use investigator to find relevant stories
      const storyIds: UUID[] = [];

      if (callback) {
        await callback({
          text: `I'll write a ${reportType.replace(/-/g, ' ')} for you. This will take a few minutes...`,
          action: 'WRITE_ARTICLE',
        });
      }

      const report = await reporter.generateReport(reportType, storyIds, {
        requestedBy: message.entityId,
      });

      if (callback) {
        await callback({
          text: `# ${report.title}\n\n${report.content}`,
          action: 'WRITE_ARTICLE',
        });
      }

      return {
        success: true,
        text: `Generated ${reportType} report`,
        values: {
          reportType,
          wordCount: report.wordCount,
          title: report.title,
        },
        data: {
          report,
        },
      };
    } catch (error) {
      runtime.logger.error({ scope: 'plugin:newsreporter', error }, 'Error in writeArticleAction');

      if (callback) {
        await callback({
          text: 'I encountered an error writing the report.',
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
