import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { NewsReporterService } from '../services/news-reporter-service';

/**
 * NEWSREPORTER_SETTINGS - Plugin Configuration
 *
 * Returns: Current plugin settings (non-sensitive)
 * - Coverage pump interval
 * - Default cadence between mentions
 * - Daily mention caps
 * - Strike system settings
 * - Pricing for report types
 * - Output room count
 *
 * Use when: Agent needs to inform user about current configuration
 * Token cost: ~100-150 tokens
 *
 * SECURITY: Only exposes non-sensitive configuration values
 */
export const newsreporterSettingsProvider: Provider = {
  name: 'NEWSREPORTER_SETTINGS',
  description: 'Current newsreporter plugin configuration and status (cadence, caps, pricing, output rooms)',
  dynamic: true,

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const service = runtime.getService('news-reporter') as unknown as NewsReporterService | null;
    if (!service) {
      return {
        text: 'NewsReporter plugin is not loaded.',
        values: { loaded: false },
        data: {},
      };
    }

    try {
      const settings = runtime.character.settings as Record<string, unknown>;
      const reporterConfig = (settings?.newsreporter as Record<string, unknown>) || {};

      const coverageCheckMs = (reporterConfig.REPORTER_COVERAGE_CHECK_MS as number) || 1800000;
      const defaultCadenceMs = (reporterConfig.REPORTER_DEFAULT_CADENCE_MS as number) || 7200000;
      const dailyCap = (reporterConfig.REPORTER_DAILY_MENTION_CAP as number) || 15;
      const strikeMuteHours = (reporterConfig.REPORTER_STRIKE_MUTE_HOURS as number) || 24;
      const briefingPrice = (reporterConfig.REPORTER_BRIEFING_BASE_PRICE as number) || 50;
      const deepdivePrice = (reporterConfig.REPORTER_DEEPDIVE_BASE_PRICE as number) || 200;

      const outputRooms = reporterConfig.outputRooms as any[] || [];
      const commerceAvailable = !!runtime.getService('commerce');

      const text = `# NewsReporter Plugin Settings

**Status:** Active
**Output Rooms:** ${outputRooms.length} configured
**Commerce:** ${commerceAvailable ? 'Enabled' : 'Disabled (plugin-commerce not loaded)'}

## Coverage Management
- **Check Interval:** Every ${Math.round(coverageCheckMs / 60000)} minutes
- **Default Cadence:** ${Math.round(defaultCadenceMs / 60000)} minutes between mentions
- **Daily Cap:** ${dailyCap} mentions per room per 24h
- **Breaking Override:** ${reporterConfig.REPORTER_BREAKING_OVERRIDE !== false ? 'Enabled' : 'Disabled'}

## Anti-Spam Safeguards
- **Strike Mute Duration:** ${strikeMuteHours} hours
- **Strike Decay:** ${(reporterConfig.REPORTER_STRIKE_DECAY_HOURS as number) || 48} hours
- **Auto-Mute Threshold:** 2 strikes

## Pricing (when commerce enabled)
- **Story Briefing:** $${briefingPrice}
- **Deep Dive Analysis:** $${deepdivePrice}
- **Trend Report:** Varies by scope
- **Daily Recap:** Bundled pricing

## Output Rooms
${outputRooms.map((r: any) => `- **${r.name}** (${r.platform}): ${r.sourceFilter ? `sources: ${r.sourceFilter.join(', ')}` : 'all sources'}`).join('\n') || 'No rooms configured'}`;

      return {
        text,
        values: {
          loaded: true,
          outputRoomCount: outputRooms.length,
          commerceEnabled: commerceAvailable,
          dailyCap,
          defaultCadenceMinutes: Math.round(defaultCadenceMs / 60000),
        },
        data: {
          config: {
            coverageCheckMs,
            defaultCadenceMs,
            dailyCap,
            strikeMuteHours,
            briefingPrice,
            deepdivePrice,
          },
          outputRooms: outputRooms.map((r: any) => ({
            name: r.name,
            platform: r.platform,
            sourceFilter: r.sourceFilter,
          })),
        },
      };
    } catch (error) {
      runtime.logger.error({ scope: 'plugin:newsreporter', error }, 'Error in newsreporterSettingsProvider');
      return { text: 'Error loading settings', values: {}, data: {} };
    }
  },
};

/**
 * NEWSREPORTER_USAGE - Plugin Usage Instructions
 *
 * Returns: Instructions on how to use the newsreporter plugin
 * - Available actions and how to trigger them
 * - Available providers and their purposes
 * - Report types and pricing
 * - Entity reference format
 * - Example workflows
 * - Integration with investigator
 *
 * Use when: Agent needs to explain plugin capabilities to user
 * Token cost: ~400-600 tokens
 */
export const newsreporterUsageProvider: Provider = {
  name: 'NEWSREPORTER_USAGE',
  description: 'Instructions on how to use newsreporter plugin (actions, report types, pricing, entity refs, examples)',
  dynamic: true,

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const commerceAvailable = !!runtime.getService('commerce');

    const text = `# NewsReporter Plugin - Usage Guide

## Purpose
Tells stories to audiences with natural pacing and anti-spam safeguards. Generates commissioned reports. Integrates with plugin-investigator for story intelligence.

## User-Facing Actions

### QUOTE_REPORT - Request Pricing for Report
**Trigger phrases:**
- "Can you write a [report type] on [topic]?"
- "How much for a deep dive on [topic]?"
- "Quote me for a trend report"

**Examples:**
- "Can you write a deep dive on the Babylon whale activity?"
- "How much would a briefing on AI regulation cost?"

**Report Types:**
- **Story Briefing** - $50 - Quick summary (300 words, ~10 min)
- **Deep Dive Analysis** - $200 - Comprehensive report (1500 words, ~30 min)
- **Trend Report** - $150 - Pattern analysis (1000 words, ~20 min)
- **Breaking News Alert** - $75 - Urgent update (500 words, ~15 min)
- **Daily Recap** - $100 - Day's highlights (800 words, ~20 min)

### ACCEPT_REPORT_JOB - Accept Commissioned Report
**Trigger phrases:**
- "Yes, proceed"
- "Go ahead"
- "Do it"
- "Accept"

**Context:** Must follow QUOTE_REPORT action

### WRITE_ARTICLE - Generate Report
**Trigger phrases:**
- "Write me a [report type] on [topic]"
- "Generate a briefing about [topic]"
- "Create an analysis of [topic]"

**Examples:**
- "Write me a briefing on the latest Babylon developments"
- "Generate a deep dive on the recent market trends"

### DELIVER_REPORT - Finalize Delivery
**Context:** Auto-triggered after report generation (v2 will add manual delivery)

## Automatic Storytelling

The plugin automatically shares stories in configured output rooms based on:
- **Cadence:** Minimum time between mentions (default 2 hours)
- **Daily Cap:** Maximum mentions per day (default 15)
- **Coverage Pump:** Periodic check for coverage gaps
- **Anti-Spam:** Strike system with auto-mute (2 strikes = 24h mute)

## Data Providers (for planning/analysis)

### Multi-Resolution Coverage
- **COVERAGE_STATE_OVERVIEW** - Aggregate room stats (50-100 tokens)
- **COVERAGE_STATE** - CSV per room (20-30 tokens/room)
- **COVERAGE_STATE_FULL** - Complete history (100-200 tokens/room)

### Multi-Resolution Reports
- **NEWS_REPORTS_OVERVIEW** - Aggregate stats (50-100 tokens)
- **NEWS_REPORTS** - CSV metadata (20-30 tokens/report)
- **NEWS_REPORTS_FULL** - Complete content (500-2000 tokens/report)

### Output Mechanism
- **STORY_PROMPT** - Room-aware storytelling guidance (NOT dynamic, but early-exits cheaply for non-output rooms)

## Entity References

Reports return entity references for cross-plugin workflows:

**Format:** \`entity:report:newsreporter:{uuid}\`

**Examples:**
- \`entity:report:newsreporter:550e8400-...\` - A generated report
- Use in commands: "Share entity:report:newsreporter:abc123 in #news"

## Integration with Investigator

When both plugins loaded:
1. Investigator tracks stories via NEWS_STORIES provider (dynamic)
2. NewsReporter reads stories from state.data.providers.NEWS_STORIES
3. STORY_PROMPT provider adapts stories per room
4. Agent mentions stories naturally in conversation

**No hard coupling:** NewsReporter works with ANY plugin providing NEWS_STORIES data

## Anti-Spam System

### Coverage Cadence
- Minimum time between mentions (default 2h)
- Configurable per room
- Breaking stories can override (if enabled)

### Daily Caps
- Maximum mentions per 24h (default 15)
- Prevents overwhelming communities
- Resets at midnight UTC

### Strike System
- User says "stop", "spam", "too much" → 1 strike
- 2 strikes → Auto-mute for 24 hours
- Strikes decay after 48 hours
- Shows immediate respect for community feedback

### Mute Bypasses
- **Mute NEVER bypassed** - User feedback is absolute authority
- Breaking stories don't bypass mute
- Commissioned reports don't bypass mute

## Commerce Integration

${commerceAvailable ? `**Commerce Enabled** - Full job workflow available

### Workflow:
1. User requests quote → QUOTE_REPORT action
2. User accepts → ACCEPT_REPORT_JOB action
3. Generate report → WRITE_ARTICLE action
4. Deliver → DELIVER_REPORT action

### Pricing:
- Varies by report type (see QUOTE_REPORT section)
- Based on word count and complexity
- Delivery time estimates provided` : `**Commerce Disabled** - plugin-commerce not loaded

Report generation still works, but job tracking and payment features unavailable.
To enable: Install @elizaos/plugin-commerce`}

## Room Configuration

Output rooms are configured in character settings:

\`\`\`json
{
  "settings": {
    "newsreporter": {
      "outputRooms": [
        {
          "name": "#babylon-reports",
          "channelId": "1234567890",
          "platform": "discord",
          "cadenceMs": 3600000,
          "sourceFilter": ["babylon"],
          "archetype": "alert"
        }
      ]
    }
  }
}
\`\`\`

**channelId:** Right-click channel in Discord → Copy ID

## Tips for Users

- **Let it breathe:** Coverage pump ensures natural pacing
- **Trust the safeguards:** Anti-spam system prevents overwhelming communities
- **Use entity refs:** Enable complex multi-step workflows
- **Commissioned reports:** High-quality, focused analysis on demand
- **Breaking news:** High-confidence, growing-momentum stories get priority`;

    return {
      text,
      values: {
        actionCount: 4,
        providerCount: 7,
        commerceEnabled: commerceAvailable,
      },
      data: {
        actions: ['QUOTE_REPORT', 'ACCEPT_REPORT_JOB', 'WRITE_ARTICLE', 'DELIVER_REPORT'],
        providers: [
          'COVERAGE_STATE_OVERVIEW',
          'COVERAGE_STATE',
          'COVERAGE_STATE_FULL',
          'NEWS_REPORTS_OVERVIEW',
          'NEWS_REPORTS',
          'NEWS_REPORTS_FULL',
          'STORY_PROMPT',
        ],
        reportTypes: [
          { type: 'briefing', price: 50 },
          { type: 'deep-dive', price: 200 },
          { type: 'trend-report', price: 150 },
          { type: 'breaking-news', price: 75 },
          { type: 'daily-recap', price: 100 },
        ],
      },
    };
  },
};
