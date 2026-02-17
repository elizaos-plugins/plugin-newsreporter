import type { StoryArchetype } from '../types';

/**
 * Story presentation archetypes
 * Provides variety in how stories are shared to avoid monotony
 */

export interface ArchetypeGuidance {
  archetype: StoryArchetype;
  name: string;
  description: string;
  structure: string;
  examples: string[];
  when: string;
}

export const archetypes: Record<StoryArchetype, ArchetypeGuidance> = {
  alert: {
    archetype: 'alert',
    name: 'Alert',
    description: 'Direct announcement of breaking or urgent news',
    structure: 'Urgent signal → Core fact → Why it matters',
    examples: [
      '🚨 Breaking: Major whale activity detected on Babylon',
      '⚠️ Heads up: Protocol governance vote live now',
      '🔥 Hot: Trading volume spike across all pairs',
    ],
    when: 'Breaking stories, high-momentum developments, urgent announcements',
  },

  question: {
    archetype: 'question',
    name: 'Question',
    description: 'Pose a question that the story answers, creating curiosity',
    structure: 'Provocative question → Answer with story details → Implication',
    examples: [
      'What just caused a 40% spike in Babylon activity? 🤔',
      'Why are three top protocols all launching today?',
      'Ever wonder what whales do during corrections?',
    ],
    when: 'Stories with surprising elements, counterintuitive data, community curiosity',
  },

  'hot-take': {
    archetype: 'hot-take',
    name: 'Hot Take',
    description: 'Lead with a bold opinion or interpretation of the story',
    structure: 'Bold statement → Evidence from story → Implication or debate prompt',
    examples: [
      'This is the most underrated development on Babylon this month.',
      'Everyone is missing the real story here.',
      'Hot take: This changes everything for BTC staking.',
    ],
    when: 'Stories with strong implications, trends others are missing, opinion-worthy developments',
  },

  comparison: {
    archetype: 'comparison',
    name: 'Comparison',
    description: 'Frame the story in relation to past events or patterns',
    structure: 'Reference point → Current story → Comparison insight',
    examples: [
      'Remember last month\'s whale accumulation? This is bigger.',
      'If you liked [previous event], you will want to see this.',
      'Same pattern as May 2023, but 3x faster.',
    ],
    when: 'Stories that echo past events, cyclical patterns, historical context adds value',
  },

  recap: {
    archetype: 'recap',
    name: 'Recap',
    description: 'Situate the story in ongoing narrative or progression',
    structure: 'Where we are → Latest development → Where this leads',
    examples: [
      'Babylon growth update: Week 3 and things are accelerating',
      'Governance saga continues: Here is what happened today',
      'The integration everyone was waiting for just launched',
    ],
    when: 'Ongoing stories, serial developments, community follows a saga',
  },

  tease: {
    archetype: 'tease',
    name: 'Tease',
    description: 'Build anticipation, hint at significance without full reveal',
    structure: 'Cryptic opener → Partial reveal → Promise of more',
    examples: [
      'Something big is brewing on Babylon. More soon. 👀',
      'If you know, you know. If you do not, here is why you should care:',
      'Three letters: NDA. That is all I can say. For now.',
    ],
    when: 'Developing stories, rumor verification, building suspense for announcement',
  },
};

/**
 * Get archetype guidance
 */
export function getArchetype(type: StoryArchetype): ArchetypeGuidance | null {
  return archetypes[type] || null;
}

/**
 * Get all archetypes
 */
export function getAllArchetypes(): ArchetypeGuidance[] {
  return Object.values(archetypes);
}

/**
 * Pick a random archetype (for variety)
 */
export function pickRandomArchetype(): StoryArchetype {
  const types: StoryArchetype[] = ['alert', 'question', 'hot-take', 'comparison', 'recap', 'tease'];
  return types[Math.floor(Math.random() * types.length)];
}

/**
 * Suggest archetype based on story momentum and context
 */
export function suggestArchetype(
  momentum: 'growing' | 'stable' | 'fading',
  isBreaking: boolean,
  hasHistory: boolean
): StoryArchetype {
  if (isBreaking) return 'alert';
  if (momentum === 'growing' && !hasHistory) return 'question';
  if (hasHistory) return momentum === 'growing' ? 'recap' : 'comparison';
  return pickRandomArchetype();
}
