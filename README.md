# @elizaos/plugin-newsreporter

> elizaOS news reporter - storytelling, coverage management, and commerce integration for elizaOS journalists.

## Overview

The NewsReporter plugin is the "presenter" for elizaOS journalism. It reads story intelligence (from plugin-investigator or any story-shaped provider) and tells stories to audiences naturally. It manages coverage cadence, anti-spam safeguards, and commerce integration for commissioned reports.

**Key Features:**

- 📰 **Room-aware storytelling**: STORY_PROMPT provider adapts per platform/channel
- ⏰ **Coverage pump**: Ensures regular mentions without spam
- 🛡️ **Anti-spam safeguards**: Cadence, daily caps, strike system, auto-mute
- 💼 **Commerce integration**: Commissioned reports with plugin-commerce
- 🎭 **Presentation variety**: 6 story archetypes, platform-specific voice
- 🎯 **Source filtering**: Only share stories from specified platforms per room

## Installation

```bash
bun add @elizaos/plugin-newsreporter @elizaos/plugin-commerce
```

## Usage

### Basic Setup

```typescript
import { newsreporterPlugin } from '@elizaos/plugin-newsreporter';
import { investigatorPlugin } from '@elizaos/plugin-investigator';
import { commercePlugin } from '@elizaos/plugin-commerce';

const agent = new AgentRuntime({
  plugins: [
    investigatorPlugin, // Intake layer
    newsreporterPlugin, // Output layer
    commercePlugin, // Required dependency
  ],
  character: {
    settings: {
      newsreporter: {
        outputRooms: [
          {
            channelId: '1470581332903067874', // Discord channel ID (right-click → Copy ID)
            name: '#babylon-news',
            platform: 'discord',
            cadenceMs: 3600000, // 1 hour
            sourceFilter: ['babylon'],
            archetype: 'alert',
          },
        ],
        REPORTER_DEFAULT_CADENCE_MS: '7200000', // 2 hours
        REPORTER_DAILY_MENTION_CAP: '15',
      },
    },
  },
});
```

### Output Room Configuration

Define where and how the reporter should share stories. Use the **platform channel ID** directly -- the service resolves it to an elizaOS room UUID at startup.

**Getting your Discord channel ID:**
1. Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)
2. Right-click the channel → Copy Channel ID
3. Paste the numeric ID as `channelId`

```json
{
  "settings": {
    "newsreporter": {
      "outputRooms": [
        {
          "channelId": "1470581332903067874",
          "name": "#babylon-news",
          "platform": "discord",
          "cadenceMs": 3600000,
          "sourceFilter": ["babylon"],
          "archetype": "alert"
        },
        {
          "channelId": "1234567890123456789",
          "name": "#general",
          "platform": "discord",
          "cadenceMs": 14400000
        }
      ]
    }
  }
}
```

**Field Reference:**

- `channelId`: **Platform channel ID** (Discord: right-click → Copy ID). Resolved to elizaOS room UUID at startup.
- `name`: Display name (for logs)
- `platform`: 'discord' | 'farcaster' | 'twitter'
- `cadenceMs`: How often to nudge about stories (overrides default)
- `sourceFilter`: Only stories from these sources (e.g., `['babylon']`), or `null` for all
- `archetype`: Default presentation style, or `null` for variety

> **Note:** You do NOT need to find the elizaOS room UUID. The service uses `createUniqueUuid(runtime, channelId)` at startup to resolve the platform channel ID to the internal UUID that matches `message.roomId` at runtime.

## How It Works

### Story Presentation Flow

1. **Coverage Pump** checks each output room periodically (every 30min by default)
2. **Safeguard Gauntlet** filters:
   - Is room muted? (strike system)
   - Daily cap reached?
   - Recent mention? (cadence check)
   - v2: Room idle? Room sentiment? Graveyard?
3. **STORY_PROMPT Provider** activates for rooms needing coverage:
   - Reads stories from plugin-investigator (or any story-shaped provider)
   - Filters by `sourceFilter` if configured
   - Matches stories to room topics (v2)
   - Surfaces breaking stories + storytelling opportunity
   - Provides platform-specific voice guidance
4. **Agent speaks naturally** with story context in prompt
5. **Coverage Tracker** records the mention, resetting the timer

### Anti-Spam Safeguards

**v1 (Current):**

- ✅ Cadence per room (default 2h, configurable)
- ✅ Daily mention cap (default 15)
- ✅ Strike system (negative feedback → auto-mute after 2)
- ✅ Breaking news override (bypasses cadence for high-momentum stories)

**v2 (Planned):**

- Room idle detection (30min idle before nudge)
- Sentiment check (keyword-based negativity detection)
- Graveyard detection (inactive 7+ days)
- Room-topic inference (LLM-based, cached 24h)

### Commerce Integration

Users can commission reports:

```
User: "Can you write a deep dive on the Babylon whale activity?"
Agent: I can write a Deep Dive Analysis on that topic for $200...

User: "Yes, proceed"
Agent: Great! I've accepted the job. I'll get started...

[Agent generates report]

Agent: Your report is ready! Here it is...
```

**Report Types:**

- **Briefing** ($50, 300 words, 5min)
- **Deep Dive** ($200, 1500 words, 30min)
- **Trend Report** ($150, 800 words, 15min)
- **Breaking News** ($75, 200 words, 2min)
- **Daily Recap** ($100, 600 words, 10min)

## Configuration

| Setting                           | Default | Description                     |
| --------------------------------- | ------- | ------------------------------- |
| `REPORTER_COVERAGE_CHECK_MS`      | 1800000 | Coverage pump interval (30min)  |
| `REPORTER_DEFAULT_CADENCE_MS`     | 7200000 | Default cadence per room (2h)   |
| `REPORTER_BREAKING_OVERRIDE`      | true    | Breaking stories bypass cadence |
| `REPORTER_DAILY_MENTION_CAP`      | 15      | Max mentions per room per day   |
| `REPORTER_STRIKE_MUTE_HOURS`      | 24      | Auto-mute duration after 2      |
| `REPORTER_BRIEFING_BASE_PRICE`    | 50      | Briefing price ($)              |
| `REPORTER_DEEPDIVE_BASE_PRICE`    | 200     | Deep dive price ($)             |
| `REPORTER_SUBSCRIPTION_MONTHLY_PRICE` | 500 | Monthly subscription ($) v2     |

## Providers

### STORY_PROMPT

Room-aware storytelling guidance. Not dynamic - included in every `composeState()` call but early-exits cheaply for non-output rooms.

**Output:**

- Breaking stories (if any)
- Storytelling opportunity (if coverage gap exists)
- Platform voice guidance
- Archetype suggestion

### REPORTER_BUSINESS

Commerce capabilities context. Lists available report types and pricing.

## Actions

### QUOTE_REPORT

Provides a quote for a commissioned report.

```
User: "Can you write a trend report?"
Agent: [Quotes price and details]
```

### ACCEPT_REPORT_JOB

Accepts a commissioned job (v1: acknowledgment, v2: JobService integration).

### WRITE_ARTICLE

Generates a news report/article.

```
User: "Write me a briefing on Babylon"
Agent: [Generates report]
```

### DELIVER_REPORT

Delivers completed report (v1: manual, v2: auto-triggered with JobService).

## Evaluators

### feedbackSentinelEvaluator

Detects negative feedback and records strikes. Auto-mutes rooms after 2 strikes.

**Negative phrases:** "stop", "enough", "too much", "spam", "annoying", etc.

### coverageTrackerEvaluator

Tracks when the agent speaks in output rooms. Resets coverage timer.

## Platform Voice

Adapts tone and structure per platform:

- **Discord**: Conversational, community-oriented, visual breaks
- **Twitter**: Punchy, hooks, every word counts
- **Farcaster**: Crypto-native, substantive, analytical

## Story Archetypes

6 presentation styles for variety:

- **Alert**: Direct announcement (🚨 Breaking: ...)
- **Question**: Curiosity-driven (What just caused...?)
- **Hot Take**: Bold opinion (This is the most underrated...)
- **Comparison**: Historical context (Remember last month...?)
- **Recap**: Ongoing narrative (Week 3 and things are accelerating...)
- **Tease**: Build anticipation (Something big is brewing...)

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Test
bun test

# Dev mode
elizaos dev
```

## Integration with plugin-investigator

The reporter is designed to work seamlessly with `@elizaos/plugin-investigator`:

- **Investigator**: Silent intelligence gathering, story tracking
- **Reporter**: Storytelling and presentation to audiences

The reporter reads `NEWS_STORIES` from the investigator's provider and presents them naturally in conversations.

## Phasing

### v1 (Current)

- ✅ Coverage pump with cadence + daily cap + strike system
- ✅ STORY_PROMPT provider (non-dynamic, room-aware)
- ✅ Platform voice guidance
- ✅ Basic report generation
- ✅ Commerce actions (quote, accept, write, deliver)

### v2 (Planned)

- Room-topic inference (LLM-based, cached 24h)
- Experience-driven learning (track engagement outcomes)
- Subscription model (time-bounded jobs + entitlements)
- Idle detection + sentiment check in coverage pump
- Story presentation archetypes with engagement tracking
- Map-reduce digest generation

## License

MIT
