import type { ReportTypeMetadata } from '../types';

/**
 * Report type specifications
 * Used for commerce pricing and generation guidance
 */
export const reportTypes: Record<string, ReportTypeMetadata> = {
  briefing: {
    type: 'briefing',
    name: 'Story Briefing',
    description: 'Quick overview of a developing story with key facts and context',
    basePrice: 50,
    estimatedWordCount: 300,
    deliveryTimeMs: 300000, // 5min
    structure: ['headline', 'summary', 'key-points', 'sources'],
    guidance: `Write a concise briefing that captures the essential facts of the story. Focus on:
- Clear, attention-grabbing headline
- 2-3 sentence summary
- Bullet points for key facts
- Attribution to sources

Tone: Professional, factual, neutral.`,
  },

  'deep-dive': {
    type: 'deep-dive',
    name: 'Deep Dive Analysis',
    description: 'In-depth exploration of a story with analysis, context, and implications',
    basePrice: 200,
    estimatedWordCount: 1500,
    deliveryTimeMs: 1800000, // 30min
    structure: [
      'headline',
      'introduction',
      'background',
      'analysis',
      'stakeholder-perspectives',
      'implications',
      'conclusion',
      'sources',
    ],
    guidance: `Write a comprehensive analysis that goes beyond surface-level facts. Include:
- Compelling headline and introduction
- Historical/contextual background
- Multi-angle analysis of what's happening and why
- Different stakeholder perspectives
- Future implications and trends
- Strong conclusion tying it together
- Full attribution and sourcing

Tone: Insightful, nuanced, thought-provoking. Show deep understanding.`,
  },

  'trend-report': {
    type: 'trend-report',
    name: 'Trend Report',
    description: 'Analysis of emerging patterns across multiple stories and timeframes',
    basePrice: 150,
    estimatedWordCount: 800,
    deliveryTimeMs: 900000, // 15min
    structure: ['headline', 'overview', 'data-points', 'pattern-analysis', 'outlook', 'sources'],
    guidance: `Identify and explain an emerging trend. Focus on:
- Pattern recognition across multiple data points
- Quantitative evidence where possible
- Root causes and drivers
- Potential trajectory and implications
- Clear visualization of the trend

Tone: Analytical, data-informed, forward-looking.`,
  },

  'breaking-news': {
    type: 'breaking-news',
    name: 'Breaking News Alert',
    description: 'Immediate coverage of developing, high-impact events',
    basePrice: 75,
    estimatedWordCount: 200,
    deliveryTimeMs: 120000, // 2min
    structure: ['urgent-headline', 'what-happened', 'what-we-know', 'what-we-dont-know', 'updates'],
    guidance: `Deliver urgent, accurate information quickly. Include:
- Urgent, specific headline
- Core facts: who, what, when, where
- Clear separation of confirmed vs. unconfirmed details
- Indication that story is developing
- Promise of updates

Tone: Urgent but responsible. Speed with accuracy.`,
  },

  'daily-recap': {
    type: 'daily-recap',
    name: 'Daily Recap',
    description: 'Curated digest of the day\'s most important stories',
    basePrice: 100,
    estimatedWordCount: 600,
    deliveryTimeMs: 600000, // 10min
    structure: ['intro', 'top-stories', 'developing-stories', 'worth-watching', 'outro'],
    guidance: `Create a cohesive daily narrative from multiple stories. Focus on:
- Thematic organization (not chronological)
- Prioritization (most important first)
- Connections between stories
- Brief, punchy summaries
- Forward-looking "to watch" items

Tone: Engaging, curator's voice, informative but entertaining.`,
  },
};

/**
 * Get report metadata by type
 */
export function getReportMetadata(type: string): ReportTypeMetadata | null {
  return reportTypes[type] || null;
}

/**
 * Get all report types
 */
export function getAllReportTypes(): ReportTypeMetadata[] {
  return Object.values(reportTypes);
}
