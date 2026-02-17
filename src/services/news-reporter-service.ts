import {
  type IAgentRuntime,
  type Memory,
  type UUID,
  Service,
  ModelType,
  MemoryType,
  createUniqueUuid,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import type { CoverageState, OutputRoomConfig, NewsReport, ReportType, StoryArchetype } from '../types';
import { getReportMetadata } from '../knowledge/report-types';
import { pickRandomArchetype } from '../knowledge/story-archetypes';

const LOG_SCOPE = 'plugin:newsreporter';

/**
 * NewsReporterService - The Editorial Output Desk
 *
 * WHY THIS EXISTS:
 * - AI agents need to share stories naturally without being annoying
 * - Different communities have different preferences and tolerance levels
 * - Stories need platform-appropriate presentation (Discord ≠ Twitter)
 * - Commissioned reporting offers value-add service
 *
 * CORE RESPONSIBILITIES:
 * 1. Coverage pump: Ensure regular story mentions without spam
 * 2. Anti-spam safeguards: Cadence, caps, strikes, auto-mute
 * 3. Coverage tracking: Record when agent mentions stories
 * 4. Feedback detection: Respond to negative community reaction
 * 5. Commerce: Generate commissioned reports
 *
 * DESIGN PRINCIPLES:
 * - Provider-driven output (agent speaks naturally, not via direct messaging)
 * - Multi-layered safeguards (trust earned and maintained)
 * - Self-regulation (strike system, no manual moderation needed)
 * - Room-aware (each community has different preferences)
 * - Platform adaptation (voice + archetypes match platform norms)
 *
 * WHY SPLIT FROM INVESTIGATOR:
 * - Intake (investigator) vs Output (reporter) are fundamentally different
 * - Reporter needs commerce, investigator doesn't
 * - Reporter can consume stories from ANY source, not just investigator
 * - Different scaling characteristics (reporting more frequent than observation)
 *
 * The v1 implementation focuses on core coverage management with basic safeguards.
 * v2 will add: room-topic inference, idle detection, experience learning, subscriptions.
 */
export class NewsReporterService extends Service {
  static serviceType = 'news-reporter';
  capabilityDescription = 'Manages news coverage across output rooms with anti-spam safeguards and commerce integration';

  private reporterConfig: {
    coverageCheckMs: number;
    defaultCadenceMs: number;
    breakingOverride: boolean;
    minIdleBeforeNudgeMs: number;
    dailyMentionCap: number;
    strikeMuteHours: number;
    strikeDecayHours: number;
    briefingBasePrice: number;
    deepdiveBasePrice: number;
    subscriptionMonthlyPrice: number;
  };

  // In-memory coverage state cache
  private coverageStateCache = new Map<string, CoverageState>();

  // Output room configurations (loaded from character settings)
  private outputRooms = new Map<string, OutputRoomConfig>();

  constructor(runtime?: IAgentRuntime, cfg?: Record<string, unknown>) {
    super(runtime);
    const c = cfg || {};
    this.reporterConfig = {
      coverageCheckMs: (c.REPORTER_COVERAGE_CHECK_MS as number) || 1800000,
      defaultCadenceMs: (c.REPORTER_DEFAULT_CADENCE_MS as number) || 7200000,
      breakingOverride: c.REPORTER_BREAKING_OVERRIDE !== false,
      minIdleBeforeNudgeMs: (c.REPORTER_MIN_IDLE_BEFORE_NUDGE_MS as number) || 1800000,
      dailyMentionCap: (c.REPORTER_DAILY_MENTION_CAP as number) || 15,
      strikeMuteHours: (c.REPORTER_STRIKE_MUTE_HOURS as number) || 24,
      strikeDecayHours: (c.REPORTER_STRIKE_DECAY_HOURS as number) || 48,
      briefingBasePrice: (c.REPORTER_BRIEFING_BASE_PRICE as number) || 50,
      deepdiveBasePrice: (c.REPORTER_DEEPDIVE_BASE_PRICE as number) || 200,
      subscriptionMonthlyPrice: (c.REPORTER_SUBSCRIPTION_MONTHLY_PRICE as number) || 500,
    };
  }

  static async start(runtime: IAgentRuntime): Promise<NewsReporterService> {
    const settings = (runtime.character.settings as Record<string, unknown>) || {};
    const config = (settings.newsreporter as Record<string, unknown>) || {};
    const service = new NewsReporterService(runtime, config as Record<string, unknown>);

    // Load output room configurations
    // WHY resolve channelId → roomId here:
    // - Users configure with platform channel IDs (easy to find: right-click → Copy ID in Discord)
    // - elizaOS room UUIDs are computed from channelId + agentId via createUniqueUuid()
    // - We resolve at startup so all runtime lookups use the correct room UUID
    const outputRooms = config.outputRooms as OutputRoomConfig[] | undefined;
    if (outputRooms && Array.isArray(outputRooms)) {
      for (const room of outputRooms) {
        // Resolve platform channel ID to elizaOS room UUID
        const resolvedRoomId = room.roomId || createUniqueUuid(runtime, room.channelId);
        const resolvedRoom: OutputRoomConfig = { ...room, roomId: resolvedRoomId };
        service.outputRooms.set(resolvedRoomId, resolvedRoom);
        runtime.logger.info(
          { scope: LOG_SCOPE, channelId: room.channelId, roomId: resolvedRoomId, name: room.name },
          'Resolved output room: channelId → roomId'
        );
      }
      runtime.logger.info(
        { scope: LOG_SCOPE, count: outputRooms.length },
        'Loaded output room configurations'
      );
    }

    // Load existing coverage state from memory
    await service.loadCoverageState();

    // Register coverage pump task worker
    runtime.registerTaskWorker({
      name: 'NEWS_COVERAGE_CHECK',
      execute: async (_rt, _options, _task) => {
        await service.coveragePumpTick();
      },
    });

    // Create the coverage check task if it doesn't exist
    const existingTasks = await runtime.getTasksByName('NEWS_COVERAGE_CHECK');
    if (!existingTasks || existingTasks.length === 0) {
      await runtime.createTask({
        name: 'NEWS_COVERAGE_CHECK',
        description: 'Check coverage gaps and update room states',
        metadata: {
          updatedAt: Date.now(),
          updateInterval: service.reporterConfig.coverageCheckMs,
        },
        tags: ['repeat'],
      });
    }

    runtime.logger.info({ scope: LOG_SCOPE }, 'NewsReporterService started');
    return service;
  }

  async stop(): Promise<void> {
    // Cleanup if needed
  }

  static async stopService(_runtime: IAgentRuntime): Promise<void> {
    // Static cleanup
  }

  // ============================================================================
  // Output Room Management
  // ============================================================================

  /**
   * Check if a room UUID is a configured output room.
   * WHY: The map is keyed by resolved room UUIDs (from createUniqueUuid at startup),
   * so message.roomId (also a resolved UUID) matches directly. O(1) lookup.
   */
  isOutputRoom(roomId: UUID): boolean {
    return this.outputRooms.has(roomId);
  }

  getOutputRoomConfig(roomId: UUID): OutputRoomConfig | null {
    return this.outputRooms.get(roomId) || null;
  }

  // ============================================================================
  // Coverage State Management
  // ============================================================================

  private async loadCoverageState(): Promise<void> {
    try {
      const memories = await this.runtime.getMemories({
        tableName: 'reporter_coverage_state',
        agentId: this.runtime.agentId,
        count: 100,
        unique: false,
      });

      for (const memory of memories) {
        const meta = memory.metadata as Record<string, unknown> | undefined;
        if (meta?.roomId) {
          this.coverageStateCache.set(meta.roomId as string, meta as unknown as CoverageState);
        }
      }

      this.runtime.logger.debug(
        { scope: LOG_SCOPE, count: memories.length },
        'Loaded coverage states'
      );
    } catch (error) {
      this.runtime.logger.error({ scope: LOG_SCOPE, error }, 'Error loading coverage state');
    }
  }

  getCoverageState(roomId: UUID): CoverageState | null {
    return this.coverageStateCache.get(roomId) || null;
  }

  private async saveCoverageState(state: CoverageState): Promise<void> {
    try {
      const existingMemories = await this.runtime.getMemories({
        tableName: 'reporter_coverage_state',
        agentId: this.runtime.agentId,
        roomId: state.roomId,
        count: 1,
        unique: false,
      });

      const stateMetadata = { type: MemoryType.CUSTOM as string, ...state } as Record<string, unknown>;

      if (existingMemories.length > 0) {
        // Update existing
        const existing = existingMemories[0];
        if (existing.id) {
          const updated = { ...existing, id: existing.id, metadata: stateMetadata } as Memory & { id: UUID };
          await this.runtime.updateMemory(updated);
        }
      } else {
        // Create new
        const memory = {
          id: uuidv4() as UUID,
          entityId: this.runtime.agentId,
          agentId: this.runtime.agentId,
          roomId: state.roomId,
          content: { text: `Coverage state for ${state.roomName}` },
          createdAt: Date.now(),
          metadata: stateMetadata,
        } as Memory;
        await this.runtime.createMemory(memory, 'reporter_coverage_state');
      }

      this.coverageStateCache.set(state.roomId, state);
    } catch (error) {
      this.runtime.logger.error({ scope: LOG_SCOPE, error }, 'Error saving coverage state');
    }
  }

  /**
   * Record Story Mention (Coverage Timer Reset)
   * 
   * WHY THIS MATTERS:
   * - Coverage pump needs to know when agent last mentioned stories
   * - Prevents mentioning again too soon (cadence enforcement)
   * - Tracks daily mention count (daily cap enforcement)
   * 
   * WHEN THIS IS CALLED:
   * - coverageTrackerEvaluator detects agent's message in output room
   * - Simple approach: ANY agent message in output room = mention
   * - Alternative (parsing message for story keywords) rejected as brittle
   * 
   * WHY SIMPLE APPROACH WORKS:
   * - STORY_PROMPT provider steers agent toward stories
   * - If agent spoke in output room, likely mentioned story
   * - False positives rare (agent rarely talks about other things)
   * - Users can give feedback via strike system if incorrect
   * 
   * WHAT THIS UPDATES:
   * - lastMentionAt: Now (resets cadence timer)
   * - mentionCount24h: Increments (toward daily cap)
   * - Rolls over after 24h automatically
   * 
   * Called by coverageTrackerEvaluator when agent speaks in output room
   */
  async recordMention(roomId: UUID): Promise<void> {
    const roomConfig = this.getOutputRoomConfig(roomId);
    if (!roomConfig) return;

    let state = this.getCoverageState(roomId);

    if (!state) {
      // Initialize coverage state for this room
      state = {
        roomId,
        roomName: roomConfig.name,
        platform: roomConfig.platform,
        lastMentionAt: Date.now(),
        mentionCount24h: 1,
        cadenceMs: roomConfig.cadenceMs || this.reporterConfig.defaultCadenceMs,
        strikes: 0,
      };
    } else {
      state.lastMentionAt = Date.now();
      state.mentionCount24h++;

      // Reset 24h count if more than 24h has passed
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      if (state.lastMentionAt < oneDayAgo) {
        state.mentionCount24h = 1;
      }
    }

    await this.saveCoverageState(state);
  }

  /**
   * Record Negative Feedback Strike (Self-Regulation)
   * 
   * WHY STRIKE SYSTEM:
   * - Agents must respond to community feedback autonomously
   * - Manual moderation doesn't scale across hundreds of rooms
   * - 2 strikes = clear pattern (not just one person having a bad day)
   * - Auto-mute shows immediate respect for community preferences
   * 
   * WHAT TRIGGERS THIS:
   * - feedbackSentinelEvaluator detects negative phrases:
   *   "stop", "spam", "too much", "annoying", "shut up", etc.
   * - Only in output rooms (ignore noise elsewhere)
   * - Only from other users (agent's own messages don't count)
   * 
   * WHY KEYWORD MATCHING (NOT LLM):
   * - Fast (<1ms) and cheap ($0)
   * - Phrases consistently correlate with annoyance
   * - False positives rare in practice (context usually clear)
   * - v2 will add LLM sentiment analysis for edge cases
   * 
   * AUTO-MUTE LOGIC:
   * - 2+ strikes → mutedUntil = now + 24h
   * - Coverage pump skips muted rooms (hard stop)
   * - After 24h: mute expires, coverage can resume
   * - After 48h: strikes decay (allow recovery)
   * 
   * WHY 2 STRIKES (NOT 1):
   * - 1 strike could be outlier (one grumpy user)
   * - 2 strikes = pattern (multiple people or repeated complaint)
   * 
   * WHY 24H MUTE (NOT PERMANENT):
   * - Long enough to matter and show respect
   * - Short enough to allow recovery from mistakes
   * - Situation often cools down overnight
   * 
   * WHY 48H DECAY:
   * - Allows fresh start after cooling period
   * - Prevents permanent ban from one bad day
   * - Encourages long-term behavior improvement
   * 
   * Called by feedbackSentinelEvaluator when user complains
   */
  async recordStrike(roomId: UUID): Promise<void> {
    let state = this.getCoverageState(roomId);

    if (!state) {
      const roomConfig = this.getOutputRoomConfig(roomId);
      if (!roomConfig) return;

      state = {
        roomId,
        roomName: roomConfig.name,
        platform: roomConfig.platform,
        lastMentionAt: Date.now(),
        mentionCount24h: 0,
        cadenceMs: roomConfig.cadenceMs || this.reporterConfig.defaultCadenceMs,
        strikes: 1,
      };
    } else {
      state.strikes++;
    }

    // Auto-mute after 2 strikes
    if (state.strikes >= 2) {
      state.mutedUntil = Date.now() + this.reporterConfig.strikeMuteHours * 60 * 60 * 1000;
      this.runtime.logger.warn(
        { scope: LOG_SCOPE, roomName: state.roomName, strikes: state.strikes },
        'Room auto-muted due to strikes'
      );
    }

    await this.saveCoverageState(state);
  }

  /**
   * Check if message content contains negative feedback
   */
  isNegativeFeedback(text: string): boolean {
    if (!text) return false;

    const negativePhrases = [
      'stop',
      'enough',
      'too much',
      'spam',
      'annoying',
      'shut up',
      'quiet',
      'mute',
      "don't care",
      'not interested',
    ];

    const textLower = text.toLowerCase();
    return negativePhrases.some((phrase) => textLower.includes(phrase));
  }

  // ============================================================================
  // Coverage Pump (Anti-Spam Safeguards)
  // ============================================================================

  /**
   * Coverage Pump Tick - The Safeguard Gauntlet
   * 
   * WHY PERIODIC CHECKING (NOT REAL-TIME):
   * - Intentional delays prevent reaction-based spam
   * - Allows multiple stories to develop before mentioning
   * - More professional than frantic real-time reactions
   * - Resource-friendly (30min checks vs. constant monitoring)
   * 
   * THE GAUNTLET (v1):
   * 1. Muted check - Hard stop (user feedback = absolute authority)
   * 2. Daily cap - Volume limit (even wanted content becomes spam)
   * 3. Cadence check - Pacing (default 2h between mentions)
   * 4. Breaking override - Urgent bypass (momentum=growing + confidence>0.8)
   * 
   * WHY THIS ORDER:
   * - Mute first: User feedback is absolute authority
   * - Cap second: Hard limit prevents runaway
   * - Cadence third: Normal pacing control
   * - Breaking last: Exception, not the rule
   * 
   * WHY THESE SPECIFIC VALUES:
   * - 30min pump interval: Balance between freshness and CPU
   * - 2h cadence: Tested with communities, feels natural not spammy
   * - 15 daily cap: ~1 per waking hour, reasonable upper bound
   * - Breaking override: Truly urgent news justifies interruption (but never bypasses mute)
   * 
   * WHAT THIS DOES NOT DO:
   * - Does NOT send messages directly (provider-driven output instead)
   * - Does NOT guarantee agent will mention (agent has autonomy)
   * - Does NOT bypass mute/strikes for any reason (user feedback wins)
   * 
   * v1 implementation: cadence + daily cap + strike system
   * v2 will add: idle detection, sentiment check, graveyard detection
   */
  async coveragePumpTick(): Promise<void> {
    try {
      const now = Date.now();

      for (const [roomIdStr, roomConfig] of this.outputRooms.entries()) {
        const roomId = roomIdStr as UUID;
        const existingState = this.getCoverageState(roomId);

        // Initialize state if needed
        const state: CoverageState = existingState || {
          roomId,
          roomName: roomConfig.name,
          platform: roomConfig.platform,
          lastMentionAt: 0,
          mentionCount24h: 0,
          cadenceMs: roomConfig.cadenceMs || this.reporterConfig.defaultCadenceMs,
          strikes: 0,
        };

        if (!existingState) {
          await this.saveCoverageState(state);
        }

        // Safeguard gauntlet (v1 subset)

        // 1. Muted?
        if (state.mutedUntil && now < state.mutedUntil) {
          continue; // Skip
        }

        // 2. Daily cap reached?
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        if (state.lastMentionAt > oneDayAgo && state.mentionCount24h >= this.reporterConfig.dailyMentionCap) {
          continue; // Skip
        }

        // 3. Recent mention? (cadence check)
        const gap = now - state.lastMentionAt;
        if (gap < state.cadenceMs) {
          continue; // Skip - too soon
        }

        // 4. Strike decay (v1: simple time-based decay)
        if (state.strikes > 0) {
          const lastStrikeAgo = now - state.lastMentionAt;
          const decayMs = this.reporterConfig.strikeDecayHours * 60 * 60 * 1000;
          if (lastStrikeAgo > decayMs) {
            state.strikes = Math.max(0, state.strikes - 1);
            await this.saveCoverageState(state);
          }
        }

        // All safeguards passed - this room needs coverage
        // The STORY_PROMPT provider will pick this up via getCoverageState()
        this.runtime.logger.debug(
          { scope: LOG_SCOPE, roomName: state.roomName, gap },
          'Coverage gap detected'
        );
      }
    } catch (error) {
      this.runtime.logger.error({ scope: LOG_SCOPE, error }, 'Error in coverage pump');
    }
  }

  // ============================================================================
  // Room Context (v2 feature stubs for v1 compatibility)
  // ============================================================================

  async getRoomTopics(roomId: UUID): Promise<string[]> {
    // v2: Infer room topics from conversation history
    // v1: Return empty array
    return [];
  }

  pickArchetype(roomId: UUID): StoryArchetype {
    // v2: Track which archetypes get engagement per room
    // v1: Random
    return pickRandomArchetype();
  }

  // ============================================================================
  // Commerce Integration
  // ============================================================================

  async generateReport(
    type: ReportType,
    storyIds: UUID[],
    options: any = {}
  ): Promise<NewsReport> {
    try {
      const metadata = getReportMetadata(type);
      if (!metadata) {
        throw new Error(`Unknown report type: ${type}`);
      }

      // Get story data (assuming investigator is loaded)
      const investigatorService = this.runtime.getService('investigator');
      let stories: any[] = [];

      if (investigatorService && typeof (investigatorService as any).getActiveStories === 'function') {
        const allStories = await (investigatorService as any).getActiveStories();
        stories = allStories.filter((s: any) => storyIds.includes(s.id));
      }

      // Build prompt for report generation
      const storiesSummary = stories
        .map((s, i) => `${i + 1}. ${s.title}: ${s.summary}`)
        .join('\n');

      const prompt = `You are a professional journalist writing a ${metadata.name}.

${metadata.guidance}

STORIES TO COVER:
${storiesSummary || 'No specific stories provided. Write based on recent developments.'}

TARGET WORD COUNT: ${metadata.estimatedWordCount}

Write the complete ${metadata.name} now.`;

      const content = await this.runtime.useModel(ModelType.TEXT_LARGE, { prompt });

      const report: NewsReport = {
        type,
        title: this.extractTitle(content, metadata.name),
        content,
        storyIds,
        wordCount: content.split(/\s+/).length,
        generatedAt: Date.now(),
        jobId: options.jobId,
      };

      // Save report
      await this.saveReport(report);

      return report;
    } catch (error) {
      this.runtime.logger.error({ scope: LOG_SCOPE, error, type }, 'Error generating report');
      throw error;
    }
  }

  private extractTitle(content: string, fallback: string): string {
    // Try to extract title from first line or heading
    const lines = content.trim().split('\n');
    const firstLine = lines[0].replace(/^#+\s*/, '').trim();
    return firstLine.length > 0 && firstLine.length < 100 ? firstLine : fallback;
  }

  private async saveReport(report: NewsReport): Promise<void> {
    try {
      const memory = {
        id: uuidv4() as UUID,
        entityId: this.runtime.agentId,
        agentId: this.runtime.agentId,
        roomId: this.runtime.agentId,
        content: {
          text: report.content,
        },
        createdAt: report.generatedAt,
        metadata: {
          type: MemoryType.CUSTOM as string,
          reportType: report.type,
          title: report.title,
          wordCount: report.wordCount,
          generatedAt: report.generatedAt,
          storyIds: report.storyIds,
          jobId: report.jobId,
        },
      } as Memory;

      await this.runtime.createMemory(memory, 'reporter_reports');
    } catch (error) {
      this.runtime.logger.error({ scope: LOG_SCOPE, error }, 'Error saving report');
    }
  }

  getPriceForReportType(type: ReportType): number {
    const metadata = getReportMetadata(type);
    return metadata?.basePrice || 100;
  }
}
