import type { UUID } from '@elizaos/core';

/**
 * Output room configuration
 * Defines where and how the reporter should share stories
 *
 * WHY channelId instead of roomId:
 * - Users know their Discord channel ID (right-click → Copy ID)
 * - elizaOS room UUIDs are computed at runtime from channelId + agentId
 * - Having users discover room UUIDs is terrible UX
 * - Service resolves channelId → roomId at startup via createUniqueUuid()
 */
export interface OutputRoomConfig {
  /** Platform-specific channel ID (e.g., Discord channel ID "1470581332903067874") */
  channelId: string;
  /** Resolved elizaOS room UUID (set at runtime by the service, not by the user) */
  roomId?: UUID;
  name: string; // Display name (e.g., "#babylon-news")
  platform: string; // 'discord' | 'farcaster' | 'twitter'
  cadenceMs?: number; // Override default cadence for this room
  sourceFilter?: string[]; // Only stories from these sources (e.g., ['babylon'])
  archetype?: StoryArchetype; // Default presentation style
}

/**
 * Coverage state tracking per room
 * Manages cadence, anti-spam, and room characteristics
 */
export interface CoverageState {
  roomId: UUID;
  roomName: string;
  platform: string;
  lastMentionAt: number; // Last time agent mentioned a story in this room
  mentionCount24h: number; // How many times mentioned in last 24h
  cadenceMs: number; // How often to nudge about stories
  strikes: number; // Negative feedback count
  mutedUntil?: number; // Auto-mute timestamp
  roomTopics?: string[]; // Inferred room topics (cached 24h) -- v2 feature
  roomTopicsInferredAt?: number;
  lastIdleAt?: number; // Last time room was idle -- v2 feature
}

/**
 * Report types for commerce integration
 */
export type ReportType = 'briefing' | 'deep-dive' | 'trend-report' | 'breaking-news' | 'daily-recap';

/**
 * Generated news report
 */
export interface NewsReport {
  type: ReportType;
  title: string;
  content: string;
  storyIds: UUID[];
  wordCount: number;
  generatedAt: number;
  jobId?: UUID; // Commerce job if commissioned
}

/**
 * Story presentation archetypes for variety
 */
export type StoryArchetype = 'alert' | 'question' | 'hot-take' | 'comparison' | 'recap' | 'tease';

/**
 * Report type metadata for commerce and generation
 */
export interface ReportTypeMetadata {
  type: ReportType;
  name: string;
  description: string;
  basePrice: number;
  estimatedWordCount: number;
  deliveryTimeMs: number;
  structure: string[];
  guidance: string;
}
