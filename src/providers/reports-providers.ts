import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';

/**
 * NEWS_REPORTS_OVERVIEW - Low Resolution
 *
 * Returns: Aggregate statistics for generated reports
 * - Total report count
 * - Count by type (briefing, deep-dive, trend-report, etc.)
 * - Date range
 * - Average word count
 * - Reports with jobs attached
 *
 * Use when: Planning needs report generation statistics
 * Token cost: ~50-100 tokens
 */
export const reportsOverviewProvider: Provider = {
  name: 'NEWS_REPORTS_OVERVIEW',
  description: 'Aggregate statistics for generated news reports (total count, breakdown by type, date range, avg word count)',
  dynamic: true,

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    try {
      // Fetch reports from memory
      const memories = await runtime.getMemories({
        tableName: 'reporter_reports',
        agentId: runtime.agentId,
        count: 100,
        unique: false,
      });

      if (memories.length === 0) {
        return {
          text: 'No reports generated yet.',
          values: { count: 0 },
          data: {},
        };
      }

      // Aggregate by type
      const byType: Record<string, number> = {};
      let totalWords = 0;
      let jobCount = 0;

      for (const m of memories) {
        const meta = (m.metadata || {}) as Record<string, unknown>;
        const reportType = meta.reportType as string;
        const wordCount = meta.wordCount as number;
        const jobId = meta.jobId;

        byType[reportType] = (byType[reportType] || 0) + 1;
        totalWords += wordCount || 0;
        if (jobId) jobCount++;
      }

      const avgWords = Math.round(totalWords / memories.length);

      // Date range
      const timestamps = memories.map((m) => m.createdAt || 0);
      const oldest = Math.min(...timestamps);
      const newest = Math.max(...timestamps);

      const text = `# Reports Overview

Total: ${memories.length}
By Type: ${Object.entries(byType).map(([t, c]) => `${t}:${c}`).join(', ')}
Commissioned: ${jobCount}
Avg Words: ${avgWords}
Date Range: ${new Date(oldest).toISOString().split('T')[0]} to ${new Date(newest).toISOString().split('T')[0]}`;

      return {
        text,
        values: {
          count: memories.length,
          avgWords,
          jobCount,
        },
        data: {
          byType,
          avgWords,
        },
      };
    } catch (error) {
      runtime.logger.error({ scope: 'plugin:newsreporter', error }, 'Error in reportsOverviewProvider');
      return { text: '', values: {}, data: {} };
    }
  },
};

/**
 * NEWS_REPORTS - Medium Resolution
 *
 * Returns: CSV of reports with metadata, no content bodies
 * Columns: reportType, title, wordCount, generatedAt, jobId, storyCount
 *
 * Use when: Planning needs to scan available reports
 * Token cost: ~20-30 tokens per report
 */
export const reportsProvider: Provider = {
  name: 'NEWS_REPORTS',
  description: 'Generated news reports with titles and metadata (type, word count, timestamp, job status) in CSV format - no content',
  dynamic: true,

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    try {
      const memories = await runtime.getMemories({
        tableName: 'reporter_reports',
        agentId: runtime.agentId,
        count: 50,
        unique: false,
      });

      if (memories.length === 0) {
        return {
          text: 'No reports available.',
          values: { count: 0 },
          data: {},
        };
      }

      // CSV format for token efficiency
      let csv = 'reportType,title,wordCount,generatedAt,jobId,storyCount\n';

      for (const m of memories) {
        const meta = (m.metadata || {}) as Record<string, unknown>;
        const reportType = meta.reportType as string;
        const title = (meta.title as string || '').replace(/"/g, '""'); // Escape quotes
        const wordCount = meta.wordCount as number;
        const generatedAt = meta.generatedAt as number;
        const jobId = meta.jobId || 'none';
        const storyIds = meta.storyIds as string[];
        const storyCount = storyIds?.length || 0;

        csv += `${reportType},"${title}",${wordCount},${generatedAt},${jobId},${storyCount}\n`;
      }

      return {
        text: csv,
        values: {
          count: memories.length,
          format: 'csv',
        },
        data: {
          reports: memories,
        },
      };
    } catch (error) {
      runtime.logger.error({ scope: 'plugin:newsreporter', error }, 'Error in reportsProvider');
      return { text: '', values: {}, data: {} };
    }
  },
};

/**
 * NEWS_REPORTS_FULL - High Resolution
 *
 * Returns: Complete report data including full content
 * - All metadata
 * - Full report text
 * - Story IDs covered
 * - Job information if commissioned
 *
 * Use when: Agent needs to read actual report content
 * Token cost: ~500-2000 tokens per report (varies by report type)
 */
export const reportsFullProvider: Provider = {
  name: 'NEWS_REPORTS_FULL',
  description: 'Complete report data with full content text, story coverage, and all metadata',
  dynamic: true,

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    try {
      const memories = await runtime.getMemories({
        tableName: 'reporter_reports',
        agentId: runtime.agentId,
        count: 10, // Limit to recent reports due to token cost
        unique: false,
      });

      if (memories.length === 0) {
        return {
          text: 'No reports available.',
          values: { count: 0 },
          data: {},
        };
      }

      let text = '# Generated Reports (Full Content)\n\n';

      for (const m of memories) {
        const meta = (m.metadata || {}) as Record<string, unknown>;
        const reportType = meta.reportType as string;
        const title = meta.title as string;
        const wordCount = meta.wordCount as number;
        const generatedAt = meta.generatedAt as number;
        const jobId = meta.jobId;
        const storyIds = meta.storyIds as string[];
        const content = m.content.text || '';

        text += `## ${title}\n\n`;
        text += `**Type:** ${reportType}\n`;
        text += `**Word Count:** ${wordCount}\n`;
        text += `**Generated:** ${new Date(generatedAt).toISOString()}\n`;
        if (jobId) text += `**Job ID:** ${jobId}\n`;
        if (storyIds && storyIds.length > 0) {
          text += `**Stories Covered:** ${storyIds.length}\n`;
        }
        text += '\n**Content:**\n\n';
        text += content;
        text += '\n\n---\n\n';
      }

      return {
        text,
        values: {
          count: memories.length,
        },
        data: {
          reports: memories,
        },
      };
    } catch (error) {
      runtime.logger.error({ scope: 'plugin:newsreporter', error }, 'Error in reportsFullProvider');
      return { text: '', values: {}, data: {} };
    }
  },
};
