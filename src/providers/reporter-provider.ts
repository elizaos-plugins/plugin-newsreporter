import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { NewsReporterService } from '../services/news-reporter-service';
import { getAllReportTypes } from '../knowledge/report-types';

/**
 * REPORTER_BUSINESS Provider
 *
 * Provides context about the reporter's commerce capabilities.
 * Helps the agent understand what types of reports it can offer and at what price.
 */
export const reporterBusinessProvider: Provider = {
  name: 'REPORTER_BUSINESS',
  description: 'News reporting services and capabilities',

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const reporter = runtime.getService('news-reporter') as unknown as NewsReporterService | undefined;
    if (!reporter) {
      return { text: '', values: {}, data: {} };
    }

    try {
      const reportTypes = getAllReportTypes();

      let text = '# News Reporting Services\n\n';
      text += 'I can provide professional news coverage and analysis:\n\n';

      for (const type of reportTypes) {
        text += `**${type.name}** - ${type.description}\n`;
        text += `  Price: $${type.basePrice} • ${type.estimatedWordCount} words • ~${Math.round(type.deliveryTimeMs / 60000)} min delivery\n\n`;
      }

      text += '\nI track developing stories across platforms and can deliver timely, accurate reporting tailored to your needs.\n';

      return {
        text,
        values: {
          reportTypeCount: reportTypes.length,
          priceRange: {
            min: Math.min(...reportTypes.map((t) => t.basePrice)),
            max: Math.max(...reportTypes.map((t) => t.basePrice)),
          },
        },
        data: {
          reportTypes,
        },
      };
    } catch (error) {
      runtime.logger.error(
        { scope: 'plugin:newsreporter', error },
        'Error in reporterBusinessProvider'
      );
      return { text: '', values: {}, data: {} };
    }
  },
};
