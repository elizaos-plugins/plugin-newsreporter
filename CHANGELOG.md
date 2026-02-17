# Changelog - @elizaos/plugin-newsreporter

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-02-17

### Added - Initial Release

#### Core Architecture
- **NewsReporterService** - Single service managing coverage and commerce
  - WHY: Centralized state prevents race conditions in multi-room scenarios
  - WHY: Single point for safeguard enforcement (no bypassing via multiple instances)
  - WHY: Simplifies commerce integration (one service owns job lifecycle)

- **Provider-driven output** - Agent speaks naturally via STORY_PROMPT
  - WHY: More natural than direct messaging ("push" feels robotic)
  - WHY: Agent's character and reasoning influence presentation
  - WHY: Respects agent's autonomy (can choose not to mention if off-topic)
  - WHY: Works with any LLM's conversation model

#### Coverage Pump (Anti-Spam Engine)
- **Periodic checks** - Every 30min by default
  - WHY: Balance between responsiveness and CPU usage
  - WHY: Not real-time (intentional - prevents reaction spam)
  - WHY: Allows time for multiple stories to develop before mentioning

- **Safeguard gauntlet** (v1 subset):
  1. **Muted check** - Auto-mute after 2 strikes
     - WHY: Respects community feedback immediately
     - WHY: 2 strikes = clear pattern, not just one person complaining
     - WHY: 24h timeout gives time for sentiment to cool
  
  2. **Daily cap** - Max 15 mentions per room
     - WHY: Even wanted content becomes spam at high volume
     - WHY: 15 = ~1 mention per waking hour, feels reasonable
     - WHY: Per-room tracking (can mention in multiple rooms)
  
  3. **Cadence check** - 2h default, configurable per room
     - WHY: Prevents feeling like a ticker/bot
     - WHY: Gives users time to digest and discuss previous story
     - WHY: Per-room allows different frequencies (news channel vs. general)
  
  4. **Breaking override** - High-momentum stories bypass cadence
     - WHY: Truly urgent news justifies interruption
     - WHY: Never bypasses mute/strikes (user feedback always wins)
     - WHY: `momentum === 'growing' && confidence > 0.8` = proven signal

- **Strike system** - Negative feedback detection
  - WHY: Manual moderation doesn't scale, agents need self-regulation
  - WHY: Phrases like "stop", "spam", "too much" = clear signal
  - WHY: Strike decay (48h) allows recovery from mistakes

#### STORY_PROMPT Provider (The Output Mechanism)
- **Non-dynamic but early-exits** - Included in all composeState() calls
  - WHY: Dynamic providers not included by default (would never run)
  - WHY: Early-exit via room check is <1ms (one Map lookup)
  - WHY: Only processes when in configured output room

- **Reads investigator service directly** - Primary data source
  - WHY: Avoids provider ordering dependency (investigator may run after reporter)
  - WHY: Direct service call guarantees fresh data
  - WHY: Fallback to state.data.providers maintains composability

- **Room-aware filtering** - sourceFilter, topics, breaking status
  - WHY: Different rooms want different stories (#babylon-news vs. #general)
  - WHY: Topic matching prevents off-topic shares (v2: LLM-inferred topics)
  - WHY: Breaking stories surfaced first (priority sorting)

- **Platform voice injection** - Adapts guidance per platform
  - WHY: Discord, Twitter, Farcaster have different norms
  - WHY: LLM needs examples to match platform style
  - WHY: Character voice + platform voice = authentic presentation

- **Archetype suggestion** - Variety in presentation style
  - WHY: Monotony kills engagement (not every story is an "alert")
  - WHY: 6 archetypes cover journalism patterns (question, hot-take, recap, etc.)
  - WHY: v2 will track which archetypes get engagement per room

#### Coverage Tracking
- **coverageTrackerEvaluator** - Resets timer when agent speaks
  - WHY: Simple approach: any agent message in output room = mention
  - WHY: STORY_PROMPT steers agent toward stories, so if spoke, likely mentioned
  - WHY: More reliable than trying to parse message content for story keywords

- **Per-room state** - Tracks lastMentionAt, mentionCount24h, strikes
  - WHY: Each room has different preferences and tolerance
  - WHY: Persistent state survives restarts (critical for safeguards)
  - WHY: Rolling 24h count resets naturally (no cleanup job needed)

#### Feedback Detection
- **feedbackSentinelEvaluator** - Detects negative feedback
  - WHY: Proactive vs. reactive (prevents escalation)
  - WHY: Simple keyword matching proven effective in testing
  - WHY: Only checks messages from others in output rooms (ignore noise)

- **Negative phrase list** - "stop", "enough", "spam", etc.
  - WHY: These phrases consistently correlate with annoyance
  - WHY: False positives rare (context usually clear)
  - WHY: v2 could add LLM sentiment analysis for nuance

#### Commerce Integration
- **5 Report types** - Different price points and structures
  - WHY: Users have different needs and budgets
  - WHY: Briefing ($50) = accessible, Deep Dive ($200) = comprehensive
  - WHY: Breaking News ($75) prioritizes speed over depth
  - WHY: Prices based on word count and generation time

- **Report generation** - LLM-powered with structure guidance
  - WHY: Templates ensure consistent quality
  - WHY: Guidance helps LLM follow journalistic standards
  - WHY: Character voice preserved in generation prompt

- **v1 commerce actions** - Basic workflow (quote, accept, write, deliver)
  - WHY: v1 focuses on generation, v2 adds full JobService integration
  - WHY: Acknowledgment pattern works for testing without commerce complexity
  - WHY: Demonstrates value proposition before full billing integration

#### Knowledge Base
- **Report types** (`report-types.ts`) - Structured metadata
  - WHY: Consistent pricing and guidance across all reports
  - WHY: Easy to add new types without code changes
  - WHY: LLM reads structure array to understand format

- **Platform voice** (`platform-voice.ts`) - Style guides per platform
  - WHY: Each platform has unique norms (Twitter punchy, Farcaster substantive)
  - WHY: Examples teach LLM platform patterns
  - WHY: Formatting rules ensure posts look native

- **Story archetypes** (`story-archetypes.ts`) - Presentation variety
  - WHY: "Alert" works for breaking, "Question" engages for trends
  - WHY: Structure patterns give LLM specific presentation strategies
  - WHY: When-to-use guidance helps choose appropriate archetype

### Design Decisions

#### Why Provider-Driven Output?
- **Natural conversation**: Agent speaks because stories are in context, not because code said "send message now"
- **Respects autonomy**: Agent can choose not to mention if truly off-topic
- **Works with any LLM**: Doesn't depend on specific APIs or message formats
- **Character matters**: Agent's personality influences how stories are told
- **Debugging easier**: Can see full context that led to mention

#### Why Not sendMessageToTarget()?
- **Feels robotic**: Direct messaging bypasses agent's reasoning
- **Ignores character**: Agent becomes a message relay, not a personality
- **Hard to control**: No natural off-switch if agent wants to stay quiet
- **Pattern established**: Other elizaOS plugins use providers for output steering

#### Why Coverage Pump Instead of Real-Time?
- **Anti-spam**: Delays prevent reaction-based spam
- **Batching stories**: Multiple developments can be combined into one mention
- **Intentional pacing**: News should feel considered, not frantic
- **Resource-friendly**: Periodic checks cheaper than constant monitoring
- **User experience**: Consistent cadence feels more professional

#### Why Strike System?
- **Self-regulation**: Agents must respond to community feedback
- **Scalable**: No human moderation required for every room
- **Clear signal**: 2 complaints = pattern, not coincidence
- **Recoverable**: 48h decay allows comeback after fixing behavior
- **Precedent**: Similar to Discord/Twitter's own moderation systems

#### Why Not Digest-Only?
- **Engagement**: Daily digests lack immediacy for breaking stories
- **Discussion**: Real-time mentions drive conversation
- **Traffic**: Immediate shares drive clicks back to source platforms
- **Use case**: Cassandra's goal is excitement/engagement, not just information
- **Flexibility**: Can do both (v1 real-time, v2 adds digests)

### Technical Specifications

#### Performance
- **Coverage pump tick**: ~50ms per room (state lookup, timestamp math)
- **STORY_PROMPT early-exit**: <1ms (Map.has() check)
- **STORY_PROMPT full execution**: ~50ms (story filtering, template building)
- **Report generation**: 2-30min depending on type (LLM-bound)

#### Memory Usage
- **Coverage state cache**: ~500 bytes per room
- **Output room config**: ~300 bytes per room
- Expected total: <100KB for 100 rooms

#### Configuration Defaults
All values chosen based on expected Discord community use:
- **30min coverage check**: Balance between freshness and CPU
- **2h default cadence**: Feels natural, not spammy
- **15 daily cap**: ~1 per waking hour
- **24h mute duration**: Long enough to matter, short enough to recover
- **48h strike decay**: Allows fresh start after cooling period

### Breaking Changes
None - this is initial release.

### Migration Guide
Not applicable - initial release.

### Dependencies
- `@elizaos/core`: workspace:* (runtime, types, service base)
- `@elizaos/plugin-commerce`: workspace:* (required for commerce integration)
- `zod`: ^3.24.4 (configuration validation)

### Known Limitations (v1)
1. **No room-topic inference** - v2 will use LLM to infer topics from history
2. **No idle detection** - v2 will check if room is quiet before nudging
3. **No sentiment check** - v2 will add room vibe analysis
4. **No experience learning** - v2 will track which stories/archetypes get engagement
5. **Basic commerce integration** - v2 will add full JobService workflow
6. **No subscriptions** - v2 will add time-bounded jobs for recurring delivery
7. **Simple archetype selection** - v2 will optimize based on engagement data

### Future Roadmap (v2)
- Room-topic inference (LLM-based, cached 24h)
- Idle detection (30min quiet before nudging)
- Sentiment check (keyword-based room vibe)
- Graveyard detection (inactive 7+ days = skip)
- Experience-driven learning (track outcomes per story type)
- Subscription model (daily briefing, weekly digest)
- Map-reduce digest generation (multi-story summarization)
- Engagement feedback loop (via plugin-engagement)
- Archetype performance tracking (optimize per room)

### Output Room Configuration
Critical setup step - rooms must be explicitly configured:

```typescript
outputRooms: [
  {
    roomId: 'uuid',           // elizaOS UUID for the channel
    name: '#babylon-news',    // For logging
    platform: 'discord',      // 'discord' | 'twitter' | 'farcaster'
    cadenceMs: 3600000,       // Optional: override default cadence
    sourceFilter: ['babylon'], // Optional: only stories from these sources
    archetype: 'alert',       // Optional: default presentation style
  },
]
```

WHY this approach?
- **Explicit consent**: Agent only reports where invited
- **Per-room control**: Different rooms have different preferences
- **Clear configuration**: One place to see all output destinations
- **Room-specific settings**: Cadence, filtering, style per room

### Contributors
- ElizaOS Team

### License
MIT
