/**
 * Platform-specific voice and formatting guidance
 * Helps the reporter adapt tone and structure per platform
 */

export interface PlatformVoice {
  platform: string;
  maxLength?: number;
  formatting: string;
  tone: string;
  structure: string;
  examples: string[];
}

export const platformVoices: Record<string, PlatformVoice> = {
  discord: {
    platform: 'discord',
    formatting: `- Use **bold** for emphasis
- Use \`code\` for technical terms
- Break into short paragraphs (2-3 lines)
- Use emoji sparingly for visual breaks
- Links embed automatically`,
    tone: `Conversational but authoritative. You're part of the community, sharing exciting developments. Friendly and approachable while still being informative.`,
    structure: `Start with a hook (question, bold statement, emoji). Then deliver the news in 2-3 digestible paragraphs. End with a call to discussion or link for more info.`,
    examples: [
      '🚨 Big moves on Babylon today...',
      'You know that thing we were talking about yesterday? It just happened.',
      '**Breaking**: Three whales just...',
    ],
  },

  twitter: {
    platform: 'twitter',
    maxLength: 280,
    formatting: `- Lead with the hook
- Use line breaks strategically
- Hashtags only if natural
- Emojis for visual punch
- Thread if needed`,
    tone: `Punchy and engaging. Every word counts. Hook the reader immediately. Show personality but stay credible.`,
    structure: `Hook → Core fact → Implication or question. If threading: numbered tweets, each self-contained but building momentum.`,
    examples: [
      'The quiet whale from last week just made a $2M move. 👀',
      '3 things happened on Babylon today that nobody is talking about:',
      'When they said it was just a correction...',
    ],
  },

  farcaster: {
    platform: 'farcaster',
    maxLength: 320,
    formatting: `- Rich embeds supported
- Links preview well
- Can use frames for interactivity
- Clean formatting, minimal markdown`,
    tone: `Crypto-native and substantive. The audience is sophisticated—no need to explain basics. Analytical but engaging. Show you understand the space deeply.`,
    structure: `Context-aware opener → Insight → Data/evidence → Implication. Assume audience knows the basics, focus on what's new/interesting.`,
    examples: [
      'Babylon TVL crossed $500M overnight. Here is what is driving it:',
      'The market thinks this is just another staking protocol. Missing the bigger picture.',
      'Three on-chain signals that suggest...',
    ],
  },
};

/**
 * Get platform voice guidance
 */
export function getPlatformVoice(platform: string): PlatformVoice | null {
  return platformVoices[platform.toLowerCase()] || platformVoices.discord; // Default to Discord
}

/**
 * Get platform-specific formatting instructions as string
 */
export function getPlatformGuidanceText(platform: string): string {
  const voice = getPlatformVoice(platform);
  if (!voice) return '';

  return `# Voice for ${platform}

**Formatting:**
${voice.formatting}

**Tone:**
${voice.tone}

**Structure:**
${voice.structure}

**Example openers:**
${voice.examples.map((ex) => `- ${ex}`).join('\n')}
`;
}
