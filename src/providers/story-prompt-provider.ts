import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { NewsReporterService } from '../services/news-reporter-service';
import { getPlatformGuidanceText } from '../knowledge/platform-voice';
import { getArchetype } from '../knowledge/story-archetypes';

/**
 * STORY_PROMPT Provider
 *
 * The output mechanism. Room-aware storytelling guidance based on developing stories.
 * This is NOT dynamic - it's included in every composeState() call, but early-exits cheaply
 * for rooms that aren't configured output rooms.
 *
 * PRIMARY: Reads stories directly from investigator service (avoids provider ordering issues)
 * FALLBACK: Reads from state.data.providers for composability with non-investigator sources
 */
export const storyPromptProvider: Provider = {
  name: 'STORY_PROMPT',
  description: 'Room-aware storytelling guidance based on developing stories',

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const reporter = runtime.getService('news-reporter') as unknown as NewsReporterService | undefined;
    if (!reporter) {
      return { text: '', values: {}, data: {} };
    }

    // CHEAP EARLY EXIT: skip rooms that aren't configured for reporting
    if (!reporter.isOutputRoom(message.roomId)) {
      return { text: '', values: {}, data: {} };
    }

    try {
      const room = await runtime.getRoom(message.roomId);

      // PRIMARY: read stories directly from investigator service (avoids provider ordering issues)
      // FALLBACK: read from state.data.providers for composability with non-investigator story sources
      const investigator = runtime.getService('investigator');
      let stories: any[];

      if (investigator && typeof (investigator as any).getActiveStories === 'function') {
        stories = await (investigator as any).getActiveStories();
      } else {
        const storiesData = state?.data?.providers?.NEWS_STORIES?.data;
        stories = storiesData?.stories || [];
      }

      if (stories.length === 0) {
        return { text: '', values: {}, data: {} };
      }

      // Get output room config
      const roomConfig = reporter.getOutputRoomConfig(message.roomId);

      // Filter stories by source if room has a sourceFilter
      let relevantStories = stories;
      if (roomConfig?.sourceFilter) {
        relevantStories = stories.filter((s: any) =>
          s.sources.some((src: any) => roomConfig.sourceFilter!.includes(src.platform))
        );
      }

      // Match stories to room topics (if inferred) -- v2 feature
      const roomTopics = await reporter.getRoomTopics(message.roomId);
      if (roomTopics.length > 0) {
        relevantStories = relevantStories.filter(
          (s: any) =>
            s.topics.some((t: string) => roomTopics.includes(t)) || s.momentum === 'growing'
        );
      }

      // Check coverage state
      const coverage = reporter.getCoverageState(message.roomId);
      const gap = coverage ? Date.now() - coverage.lastMentionAt : Infinity;
      const hasGap = gap > (roomConfig?.cadenceMs || 7200000); // 2h default

      // Get platform voice and archetype
      const platformVoice = getPlatformGuidanceText(room?.source || 'discord');
      const archetype = roomConfig?.archetype || reporter.pickArchetype(message.roomId);
      const archetypeGuidance = getArchetype(archetype);

      // Build guidance
      let text = '';

      const breaking = relevantStories.filter(
        (s: any) => s.momentum === 'growing' && s.confidence > 0.8
      );

      if (breaking.length > 0) {
        text += '# Breaking Stories\n\n';
        for (const s of breaking.slice(0, 3)) {
          text += `- **${s.title}**: ${s.summary}`;
          if (s.url) text += ` [link](${s.url})`;
          text += '\n';
        }
        text += '\n';
      }

      if (hasGap && relevantStories.length > 0) {
        const best = breaking[0] || relevantStories[0];
        text += `# Storytelling Opportunity\n\n`;
        text += `You haven't shared news in ${roomConfig?.name || 'this channel'} recently.\n`;
        text += `Consider sharing: "${best.title}" -- ${best.summary}\n`;

        if (archetypeGuidance) {
          text += `\n**Suggested approach: ${archetypeGuidance.name}**\n`;
          text += `${archetypeGuidance.structure}\n`;
          text += `Example: ${archetypeGuidance.examples[0]}\n`;
        }

        text += '\n';
      }

      if (platformVoice) {
        text += `${platformVoice}\n`;
      }

      return {
        text,
        values: {
          hasBreaking: breaking.length > 0,
          coverageGap: hasGap,
          relevantStoryCount: relevantStories.length,
        },
        data: {
          relevantStories,
          coverage,
          roomConfig,
          archetype,
        },
      };
    } catch (error) {
      runtime.logger.error({ scope: 'plugin:newsreporter', error }, 'Error in storyPromptProvider');
      return { text: '', values: {}, data: {} };
    }
  },
};
