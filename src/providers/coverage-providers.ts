import type { IAgentRuntime, Memory, Provider, State, UUID } from '@elizaos/core';
import { NewsReporterService } from '../services/news-reporter-service';

/**
 * COVERAGE_STATE_OVERVIEW - Low Resolution
 *
 * Returns: Aggregate statistics across all output rooms
 * - Total rooms configured
 * - Rooms with active coverage
 * - Rooms muted (strike system)
 * - Total mentions today
 * - Average cadence
 *
 * Use when: Planning needs high-level coverage health check
 * Token cost: ~50-100 tokens
 */
export const coverageOverviewProvider: Provider = {
  name: 'COVERAGE_STATE_OVERVIEW',
  description: 'Aggregate coverage statistics across all output rooms (total rooms, active count, muted count, mentions today)',
  dynamic: true,

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const reporter = runtime.getService('news-reporter') as unknown as NewsReporterService | null;
    if (!reporter) {
      return { text: '', values: {}, data: {} };
    }

    try {
      // Get all output rooms
      const rooms: string[] = [];
      // Note: We'd need to iterate the private outputRooms map - for now we'll use a workaround
      // In practice, the service would need a public method to get all room IDs

      const text = `# Coverage Overview

Total Rooms: [count needed]
Active: [count needed]
Muted: [count needed]
Mentions Today: [count needed]

Note: Full implementation requires service method to list all room IDs`;

      return {
        text,
        values: {
          roomCount: 0,
        },
        data: {},
      };
    } catch (error) {
      runtime.logger.error({ scope: 'plugin:newsreporter', error }, 'Error in coverageOverviewProvider');
      return { text: '', values: {}, data: {} };
    }
  },
};

/**
 * COVERAGE_STATE - Medium Resolution
 *
 * Returns: CSV of coverage state per room, no detailed history
 * Columns: roomId, roomName, platform, lastMentionAt, mentionCount24h, cadenceMs, strikes, mutedUntil
 *
 * Use when: Planning needs to scan room coverage status
 * Token cost: ~20-30 tokens per room
 */
export const coverageProvider: Provider = {
  name: 'COVERAGE_STATE',
  description: 'Coverage state per output room (last mention time, daily count, cadence, strikes, mute status) in CSV format',
  dynamic: true,

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const reporter = runtime.getService('news-reporter') as unknown as NewsReporterService | null;
    if (!reporter) {
      return { text: '', values: {}, data: {} };
    }

    try {
      // Note: This would need a service method to get all coverage states
      // For now, return placeholder structure

      const csv = `roomId,roomName,platform,lastMentionAt,mentionCount24h,cadenceMs,strikes,mutedUntil
[Room data would be populated here via service.getAllCoverageStates()]`;

      return {
        text: csv,
        values: {
          format: 'csv',
          roomCount: 0,
        },
        data: {},
      };
    } catch (error) {
      runtime.logger.error({ scope: 'plugin:newsreporter', error }, 'Error in coverageProvider');
      return { text: '', values: {}, data: {} };
    }
  },
};

/**
 * COVERAGE_STATE_FULL - High Resolution
 *
 * Returns: Complete coverage state with detailed history and configuration
 * - All room metadata
 * - Full coverage history
 * - Strike history
 * - Configured filters and archetypes
 * - Next scheduled coverage time
 *
 * Use when: Agent needs complete context for coverage management
 * Token cost: ~100-200 tokens per room
 */
export const coverageFullProvider: Provider = {
  name: 'COVERAGE_STATE_FULL',
  description: 'Complete coverage state with full history, strike records, room configurations, and scheduling details',
  dynamic: true,

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const reporter = runtime.getService('news-reporter') as unknown as NewsReporterService | null;
    if (!reporter) {
      return { text: '', values: {}, data: {} };
    }

    try {
      let text = '# Coverage State (Full Detail)\n\n';
      text += 'Note: Full implementation requires service methods to:\n';
      text += '- List all output room IDs\n';
      text += '- Get detailed coverage history\n';
      text += '- Get room configurations\n\n';
      text += 'Current structure supports room-specific queries via getCoverageState(roomId)\n';

      return {
        text,
        values: {
          roomCount: 0,
        },
        data: {},
      };
    } catch (error) {
      runtime.logger.error({ scope: 'plugin:newsreporter', error }, 'Error in coverageFullProvider');
      return { text: '', values: {}, data: {} };
    }
  },
};
