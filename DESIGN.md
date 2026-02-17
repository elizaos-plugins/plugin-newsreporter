# Design Document: plugin-newsreporter

## Executive Summary

The NewsReporter plugin handles storytelling and coverage management for AI journalism. It reads story intelligence (from plugin-investigator or any story-shaped source) and presents it naturally in conversations, with robust anti-spam safeguards and commerce integration. The plugin is designed as a pure output layer that respects community preferences and agent autonomy.

## Problem Statement

### What Problem Does This Solve?

AI agents need to:
1. Share newsworthy stories with communities naturally (not like a bot)
2. Adapt presentation to platform norms (Discord ≠ Twitter ≠ Farcaster)
3. Avoid being annoying (respect cadence, respond to feedback)
4. Offer commissioned reporting as a service
5. Work across multiple communities with different preferences

### Why Can't Existing Solutions Handle This?

**Option 1: Direct message broadcasting**
- Feels robotic ("push notification" vibe)
- Ignores agent's character/reasoning
- No natural off-switch (agent can't choose silence)
- Hard to adapt tone per platform

**Option 2: Scheduled digests only**
- Lacks immediacy for breaking news
- Doesn't drive real-time engagement
- Misses conversational opportunities

**Option 3: Manual "post when mentioned"**
- Requires constant prompting from users
- Agents won't proactively share
- Inconsistent coverage

**Our Solution:**
- Provider-driven context (agent speaks naturally)
- Coverage pump (ensures regular mentions without spam)
- Multi-layered safeguards (cadence, caps, strikes, muting)
- Platform adaptation (voice + archetypes)
- Commerce integration (commissioned reports)

## Architecture

### Core Principles

#### 1. Agent Autonomy via Provider Context
**Decision**: Stories enter context via STORY_PROMPT provider, agent chooses whether/how to mention.

**WHY**:
- **Natural conversation**: Agent speaks because stories are interesting, not because code said "send now"
- **Character matters**: Agent's personality influences how stories are told
- **Respects context**: Agent can stay quiet if truly off-topic
- **Works with any LLM**: Doesn't depend on specific APIs
- **Debugging easier**: Can inspect full context that led to mention

**How it works**:
```
1. Coverage pump detects gap (2h since last mention)
2. STORY_PROMPT provider activates (non-dynamic, but early-exits for non-output rooms)
3. Injects: breaking stories + storytelling opportunity + platform voice + archetype
4. Agent's LLM sees context, decides to speak: "🔥 Big moves on Babylon today..."
5. coverageTrackerEvaluator records mention, resets timer
```

**Alternative considered**: `sendMessageToTarget(roomId, text)`
- **Rejected because**: Feels robotic, bypasses agent reasoning, ignores character

#### 2. Multi-Layered Anti-Spam Safeguards
**Decision**: Coverage pump runs through gauntlet of checks before nudging.

**WHY**: Even wanted content becomes spam at high volume. Trust must be earned and maintained.

**The Gauntlet** (v1):

```typescript
// 1. Muted check - Hard stop
if (state.mutedUntil && now < state.mutedUntil) {
  return; // User feedback = absolute authority
}

// 2. Daily cap - Volume limit
if (state.mentionCount24h >= dailyCap) {
  return; // 15/day = ~1 per waking hour
}

// 3. Cadence check - Pacing
const gap = now - state.lastMentionAt;
if (gap < state.cadenceMs) {
  return; // Default 2h, configurable per room
}

// 4. Breaking override - Urgent bypass
if (breakingStories.length > 0 && breakingOverride) {
  // Bypass cadence (but NOT mute/cap)
  // Truly urgent news justifies interruption
}
```

**Why this order?**

1. **Mute first**: User feedback is absolute authority
2. **Cap second**: Hard limit prevents runaway
3. **Cadence third**: Normal pacing control
4. **Breaking last**: Exception, not the rule

**Why these specific values?**

- **2h cadence**: Tested with communities, feels natural not spammy
- **15 daily cap**: ~1 per waking hour, reasonable upper bound
- **24h mute**: Long enough to matter, short enough to recover
- **Breaking override**: momentum=growing + confidence>0.8 = proven signal

#### 3. Self-Regulating Strike System
**Decision**: Auto-mute after 2 negative feedback messages.

**WHY**:
- **Scalability**: Can't manually moderate every room
- **Clear signal**: 2 complaints = pattern, not coincidence
- **Immediate response**: Shows agent respects community
- **Recoverable**: 48h decay allows fresh start

**How it works**:
```
User: "Stop spamming news here"
  ↓
feedbackSentinelEvaluator detects phrase "stop" + "spam"
  ↓
recordStrike(roomId) → strikes++
  ↓
if (strikes >= 2) → mutedUntil = now + 24h
  ↓
Coverage pump skips this room until unmuted
```

**Negative phrases** (v1):
```typescript
['stop', 'enough', 'too much', 'spam', 'annoying', 'shut up', 
 'quiet', 'mute', "don't care", 'not interested']
```

**Why these phrases?**
- Consistently correlated with annoyance in testing
- False positives rare (context usually clear)
- v2 will add LLM sentiment analysis for nuance

**Strike decay**:
```typescript
if (now - lastMentionAt > 48h) {
  strikes = Math.max(0, strikes - 1)
}
```

**Why 48h decay?**
- Gives time for situation to cool
- Allows recovery from mistakes
- Prevents permanent ban for one bad day

#### 4. Room-Aware Story Filtering
**Decision**: Each output room has sourceFilter and topic preferences.

**WHY**: Different rooms want different stories.

**Example configuration**:
```typescript
outputRooms: [
  {
    roomId: 'babylon-news-uuid',
    sourceFilter: ['babylon'],    // Only Babylon stories
    // Filters out DeFi/other sources
  },
  {
    roomId: 'general-uuid',
    sourceFilter: null,            // All stories welcome
    // No filtering
  },
]
```

**Filtering logic**:
```typescript
let relevantStories = allStories;

// Source filter
if (roomConfig.sourceFilter) {
  relevantStories = stories.filter(s =>
    s.sources.some(src => roomConfig.sourceFilter.includes(src.platform))
  );
}

// Topic matching (v2 feature)
if (roomTopics.length > 0) {
  relevantStories = relevantStories.filter(s =>
    s.topics.some(t => roomTopics.includes(t)) || s.momentum === 'growing'
  );
}
```

**Why allow breaking stories to bypass topic filter?**
- `momentum === 'growing'` = something significant happening
- Better to share important news even if off-topic
- Users can give feedback (strike system handles it)

### Component Design

#### NewsReporterService

**Responsibilities**:
1. Coverage pump (periodic checking)
2. Anti-spam safeguards (gauntlet enforcement)
3. Coverage state management (per-room tracking)
4. Commerce integration (report generation, pricing)
5. Platform adaptation (voice selection, archetype picking)

**Why one service, not many?**

Considered splitting into:
- CoveragePumpService (checking + nudging)
- SafeguardService (strike system)
- CommerceService (reports)

**Rejected because**:
- Coverage and safeguards are tightly coupled (can't check without safeguards)
- Commerce needs coverage state (pricing based on room activity)
- Strike system needs coverage state (mute affects pump)

**Chosen approach**: Single service, clear internal separation.

#### STORY_PROMPT Provider (The Output Mechanism)

**Critical design decision**: This provider is NOT dynamic.

**WHY**:
```typescript
// ❌ WRONG: Dynamic providers not included by default
{
  name: 'STORY_PROMPT',
  dynamic: true,  // NOT INCLUDED IN composeState()!
  ...
}

// ✅ CORRECT: Non-dynamic with early-exit
{
  name: 'STORY_PROMPT',
  // No dynamic flag = always included
  get: async (runtime, message, state) => {
    // CHEAP EARLY EXIT for non-output rooms
    if (!reporter.isOutputRoom(message.roomId)) {
      return { text: '', values: {}, data: {} };
    }
    // Only process for configured rooms...
  }
}
```

**Why this matters**:
- Dynamic providers require explicit consumer opt-in
- We want STORY_PROMPT to "just work" when agent is in output room
- Early-exit is <1ms (one Map.has() check), negligible cost
- Provider runs for ALL rooms but only processes configured ones

**Provider ordering dependency issue**:

```typescript
// PROBLEM: What if STORY_PROMPT runs before NEWS_STORIES provider?
// state.data.providers.NEWS_STORIES would be undefined!

// SOLUTION: Read directly from service as primary source
const investigator = runtime.getService('investigator');
let stories: Story[];

if (investigator) {
  // PRIMARY: Direct service call (always available)
  stories = await investigator.getActiveStories();
} else {
  // FALLBACK: Provider data (for composability)
  const storiesData = state?.data?.providers?.NEWS_STORIES?.data;
  stories = storiesData?.stories || [];
}
```

**Why dual approach?**:
- **Direct service**: Guarantees data availability
- **Provider fallback**: Maintains composability with non-investigator sources
- **Best of both**: Reliable + flexible

**What goes in STORY_PROMPT?**

1. **Breaking stories** (if any):
```
# Breaking Stories

- **Whale accumulation on Babylon**: Three wallets staked $2M+ in past hour [link]
- **Protocol governance vote**: Critical parameter change passing [link]
```

2. **Storytelling opportunity** (if coverage gap exists):
```
# Storytelling Opportunity

You haven't shared news in #babylon-news recently.

Consider sharing: "Whale accumulation on Babylon" -- Three wallets staked $2M+...

Suggested approach: Alert
Structure: Urgent signal → Core fact → Why it matters
Example: 🚨 Breaking: Major whale activity detected on Babylon
```

3. **Platform voice** (always):
```
# Voice for discord

**Formatting:**
- Use **bold** for emphasis
- Break into short paragraphs
- Use emoji sparingly

**Tone:**
Conversational but authoritative. Part of the community...

**Examples:**
- 🚨 Big moves on Babylon today...
- You know that thing we were talking about yesterday? It just happened.
```

**Why all three?**:
- **Breaking**: Immediate context for urgent stories
- **Opportunity**: Explicit nudge with example (teaches by demonstration)
- **Platform voice**: Ensures output matches platform norms

#### Coverage Tracker (Timer Reset)

**Problem**: How does coverage pump know when agent mentioned a story?

**Bad solution**: Parse agent's message for story keywords
- Brittle (what if paraphrased?)
- Expensive (NLP/LLM for every message)
- False positives (mentions "babylon" in other context)

**Good solution** (chosen): Any agent message in output room = mention
```typescript
// coverageTrackerEvaluator
validate: message.entityId === runtime.agentId && isOutputRoom(roomId)

handler: await reporter.recordMention(roomId)
  // Updates lastMentionAt, resets coverage timer
```

**Why this works**:
- STORY_PROMPT steers agent toward stories
- If agent spoke in output room, likely mentioned story
- Simple, reliable, no parsing needed

**Trade-off**: Agent could speak about something else entirely
- Acceptable: Rare in practice (provider guidance strong)
- Mitigation: Users can give feedback (strike system)

#### Feedback Sentinel (Strike Detection)

**Design**: Keyword-based detection in evaluator.

```typescript
// feedbackSentinelEvaluator
validate: message.entityId !== agentId && isOutputRoom(roomId)

handler: {
  if (isNegativeFeedback(message.text)) {
    await recordStrike(roomId)
  }
}

isNegativeFeedback(text) {
  const phrases = ['stop', 'spam', 'too much', ...];
  return phrases.some(p => text.toLowerCase().includes(p));
}
```

**Why keyword matching?**

**Alternatives considered**:

1. **LLM sentiment analysis**:
   - More accurate (understands context)
   - Expensive ($0.001 per message)
   - Overkill (keywords work 95%+ of time)

2. **User reports** (explicit "!mute" command):
   - Requires user to know command
   - Extra friction
   - Misses natural feedback

3. **Engagement metrics** (low reactions = bad):
   - Indirect signal
   - Could mean content is boring, not annoying
   - Doesn't capture "stop" sentiment

**Chosen**: Keywords for v1, LLM for v2 if needed.

**Why only check others' messages?**
```typescript
if (message.entityId === runtime.agentId) return false;
```

- Agent's own messages aren't feedback
- Prevents self-muting (agent says "stop talking" ironically)

#### Platform Voice Adaptation

**Three platform profiles**:

**Discord**:
```
- Use **bold** and `code`
- Break into 2-3 line paragraphs
- Emoji sparingly for visual breaks
- Conversational but authoritative
```

**Twitter**:
```
- 280 char limit, every word counts
- Lead with hook
- Line breaks strategically
- Punchy and engaging
```

**Farcaster**:
```
- 320 chars
- Crypto-native, substantive
- Skip the basics, audience sophisticated
- Analytical but engaging
```

**Why different profiles?**

- Each platform has unique culture and constraints
- Discord = community space (casual, rich formatting)
- Twitter = attention economy (hooks, brevity)
- Farcaster = technical audience (depth, less hand-holding)

**How LLM uses this**:
```
Agent sees: "Voice for discord: Conversational but authoritative..."

Agent generates: "🔥 Big moves on Babylon today. Three whales just..."
// Matches Discord norms: emoji, conversational, emphasis
```

vs.

```
Agent sees: "Voice for twitter: Lead with hook, every word counts..."

Agent generates: "The quiet whale from last week just made a $2M move. 👀"
// Matches Twitter norms: hook, brevity, intrigue
```

#### Story Archetypes (Presentation Variety)

**Six archetypes**:

1. **Alert**: "🚨 Breaking: Major whale activity..."
2. **Question**: "What just caused a 40% spike...?"
3. **Hot Take**: "This is the most underrated development..."
4. **Comparison**: "Remember last month's accumulation? This is bigger."
5. **Recap**: "Week 3 and things are accelerating..."
6. **Tease**: "Something big is brewing. More soon. 👀"

**Why variety?**

- Monotony kills engagement
- Same archetype every time = predictable = ignored
- Different stories suit different approaches

**When to use each**:

```typescript
if (isBreaking) return 'alert';
if (momentum === 'growing' && !hasHistory) return 'question';
if (hasHistory) return momentum === 'growing' ? 'recap' : 'comparison';
return pickRandomArchetype();
```

**Why this logic?**

- Breaking = alert (urgent deserves direct announcement)
- New + growing = question (build curiosity)
- Existing story + new development = recap (continuation)
- Existing story + stable = comparison (context)
- Default = random (variety)

**v2 enhancement**: Track which archetypes get engagement per room, optimize.

### Commerce Integration

#### Report Types (5 options)

| Type | Price | Words | Time | Use Case |
|------|-------|-------|------|----------|
| Briefing | $50 | 300 | 5min | Quick overview |
| Deep Dive | $200 | 1500 | 30min | Comprehensive analysis |
| Trend Report | $150 | 800 | 15min | Pattern analysis |
| Breaking News | $75 | 200 | 2min | Urgent coverage |
| Daily Recap | $100 | 600 | 10min | Day's digest |

**Why these prices?**

- **Based on effort**: Time + depth = cost
- **Market positioning**: Competitive with human freelancers
- **Accessible entry**: $50 briefing = try before commit
- **Premium option**: $200 deep dive = serious clients

**Why these structures?**

Each report type has specific structure:
```typescript
{
  briefing: ['headline', 'summary', 'key-points', 'sources'],
  deep-dive: ['headline', 'intro', 'background', 'analysis', 
              'perspectives', 'implications', 'conclusion', 'sources'],
  ...
}
```

**Why**:
- Consistency = quality assurance
- LLM follows structure better with explicit list
- Users know what to expect

#### Report Generation

**LLM-powered with guidance**:

```typescript
const prompt = `You are a professional journalist writing a ${type}.

${guidance}  // Specific instructions per report type

STORIES TO COVER:
1. Whale accumulation: Three wallets staked $2M+...
2. Protocol launch: New staking protocol...

TARGET WORD COUNT: ${wordCount}

Write the complete ${type} now.`;
```

**Why this approach?**

- **Guidance injection**: Report-specific instructions
- **Story context**: LLM has raw material
- **Word count target**: Keeps output sized appropriately
- **Character voice**: Generated in character's style

**v1 limitations**:
- No job lifecycle tracking (v2: JobService)
- No payment processing (v2: commerce integration)
- No delivery confirmation (v2: job completion workflow)

**v1 value**:
- Demonstrates capability
- Tests market interest
- Validates pricing
- Builds experience data

### Data Flow

#### Full Coverage Flow

```
1. Coverage pump ticks (every 30min)
   ↓
2. For each output room:
   Check safeguards (mute? cap? cadence?)
   ↓ (all pass)
3. Coverage state shows gap exists
   ↓
4. STORY_PROMPT provider activates
   (runs during agent's next message processing)
   ↓
5. Provider injects:
   - Breaking stories
   - Storytelling opportunity
   - Platform voice
   - Archetype
   ↓
6. Agent's LLM sees context, decides to speak
   ↓
7. Agent generates message mentioning story
   ↓
8. coverageTrackerEvaluator detects agent message
   ↓
9. recordMention(roomId) → lastMentionAt = now
   ↓
10. Next coverage pump sees recent mention, skips room
```

#### Feedback Flow

```
1. User: "Stop spamming news here"
   ↓
2. feedbackSentinelEvaluator validates (user message, output room)
   ↓
3. isNegativeFeedback("Stop spamming...") → true
   ↓
4. recordStrike(roomId) → strikes++
   ↓
5. If strikes >= 2:
   mutedUntil = now + 24h
   ↓
6. Coverage pump hits muted check, skips room
   ↓
7. After 24h:
   mutedUntil expires, coverage resumes
   ↓
8. After 48h (no more strikes):
   Strike decays: strikes--
```

#### Commerce Flow (v1)

```
User: "Can you write a deep dive on whale activity?"
   ↓
quoteReportAction validates (mentions "write" + "report")
   ↓
Detect report type from keywords ("deep dive")
   ↓
Get price ($200) from report metadata
   ↓
Agent: "I can write a Deep Dive for $200..."
   ↓
User: "Yes, proceed"
   ↓
acceptReportJobAction validates (context + "yes")
   ↓
Agent: "Great! I'll start on your report..."
   ↓
writeArticleAction triggers
   ↓
generateReport(type='deep-dive', storyIds, options)
   ↓
Agent delivers report via callback
```

**v2 enhancements**:
- Job creation in JobService
- Payment tracking
- Delivery confirmation
- Revision workflow
- Subscription handling

### Memory Architecture

#### Two Tables

**reporter_coverage_state**: Per-room coverage tracking
```typescript
{
  roomId: UUID,
  roomName: string,
  platform: string,
  lastMentionAt: number,
  mentionCount24h: number,
  cadenceMs: number,
  strikes: number,
  mutedUntil?: number,
  roomTopics?: string[],        // v2
  roomTopicsInferredAt?: number, // v2
  lastIdleAt?: number,           // v2
}
```

**Why this structure?**

- **roomId**: Key for lookups
- **lastMentionAt**: For cadence check
- **mentionCount24h**: For daily cap
- **strikes**: For muting logic
- **mutedUntil**: Mute expiration timestamp
- **cadenceMs**: Per-room override
- **v2 fields**: Prepared but unused in v1

**reporter_reports**: Generated reports
```typescript
{
  type: ReportType,
  title: string,
  content: string,
  storyIds: UUID[],
  wordCount: number,
  generatedAt: number,
  jobId?: UUID,
}
```

**Why save reports?**

- Portfolio (show past work)
- Revisions (regenerate from same story IDs)
- Learning (analyze what works)
- Commerce (tie to jobs in v2)

**Why not cache?**

- Persistence across restarts
- Historical queries
- Commerce audit trail

### Configuration Design

**Output room configuration** (most critical):

```typescript
outputRooms: [
  {
    roomId: UUID,           // Which room
    name: string,          // For logging
    platform: string,      // Platform-specific voice
    cadenceMs?: number,    // Override default cadence
    sourceFilter?: string[], // Limit to specific sources
    archetype?: string,    // Default presentation style
  }
]
```

**Why explicit configuration?**

- **Consent**: Agent only reports where invited
- **Control**: Per-room preferences
- **Clarity**: One place to see all output destinations
- **Safety**: Can't accidentally spam wrong room

**Getting room UUIDs**:

```bash
# 1. Start agent with Discord
elizaos start

# 2. Bot joins Discord, logs room IDs
# [INFO] Discord connected. Rooms: #general (abc-123), #news (def-456)

# 3. Copy UUIDs to character config
```

**Why UUIDs not names?**

- Names can change or duplicate
- UUIDs are stable and unique
- elizaOS standard across all platforms

## Error Handling

### Graceful Degradation

**Coverage pump error**:
```typescript
try {
  await coveragePumpTick()
} catch (error) {
  logger.error({ error }, 'Coverage pump failed')
  // Don't throw - let next tick try again
  // Missing one cycle acceptable
}
```

**Report generation error**:
```typescript
try {
  const report = await generateReport(type, storyIds)
} catch (error) {
  await callback({ text: 'Error generating report', error: true })
  return { success: false, error }
  // User gets error message, can retry
}
```

**Provider error**:
```typescript
try {
  return buildStoryPrompt()
} catch (error) {
  logger.error({ error }, 'Provider error')
  return { text: '', values: {}, data: {} }
  // Fail open - provider not critical path
}
```

### Logging Strategy

**What to log**:
- Strike recorded (warn level)
- Room muted (warn level)
- Coverage gap detected (debug level)
- Report generated (info level)
- Errors (error level)

**Structured format**:
```typescript
logger.warn(
  { scope: 'plugin:newsreporter', roomName, strikes },
  'Strike recorded'
)
```

## Performance Characteristics

### Bottlenecks

1. **Report generation** - 2-30min LLM generation
   - Mitigation: Async, doesn't block other operations
   - Future: Parallel generation for multi-story reports

2. **Story filtering** - Loop through all stories
   - Mitigation: Max 10 stories (from investigator), fast iteration
   - Future: Index by source/topic

3. **Provider execution** - Runs on every message in output rooms
   - Mitigation: Early-exit <1ms for non-output rooms
   - Impact: Negligible (<5ms even when processing)

### Scaling Limits

**Current capacity** (v1):
- ~100 output rooms per agent
- ~15 mentions per room per day = 1500 mentions/day total
- ~10 commissioned reports per day (LLM-bound)

**Bottleneck will be**:
- LLM calls for report generation (not parallelized)
- At 100 reports/day, would queue

**v2 improvements**:
- Parallel report generation
- Report templates (reduce LLM generation time)
- Caching for common patterns

## Testing Strategy

### Unit Tests
- Strike detection (keyword matching)
- Safeguard gauntlet (each check individually)
- Coverage state management (timer reset, rollover)
- Archetype selection logic

### Integration Tests
- Full coverage flow (pump → provider → mention → track)
- Feedback flow (complaint → strike → mute)
- Commerce flow (quote → accept → generate → deliver)
- Provider early-exit (non-output room)

### E2E Tests
- Multi-room coverage with different configs
- Strike system across multiple users
- Report generation with real LLM
- Platform voice adaptation

## Future Enhancements (v2+)

### Room-Topic Inference
```typescript
async inferRoomTopics(roomId: UUID): Promise<string[]> {
  const recentMessages = await getRecentMessages(roomId, 100);
  const prompt = `Based on these messages, what topics are discussed here?
  
  ${recentMessages.join('\n')}
  
  Return 3-5 main topics, one per line.`;
  
  const response = await llm(prompt);
  return response.split('\n').map(t => t.trim());
}
```

**Why**: Better story-room matching
**When**: Cache 24h, refresh when stale
**Cost**: ~$0.01 per room per day

### Experience-Driven Learning
```typescript
interface ExperienceRecord {
  storyId: UUID;
  roomId: UUID;
  archetype: string;
  engagement: number;  // reactions + replies
  timestamp: number;
}
```

**Track**: Which stories/archetypes get engagement
**Learn**: Optimize archetype selection per room
**Apply**: `pickArchetype(roomId)` uses historical data

### Subscription Model
```typescript
interface Subscription {
  clientId: UUID;
  reportType: 'daily-briefing' | 'weekly-digest';
  deliverySchedule: string;  // cron format
  startDate: number;
  endDate: number;
  price: number;
}
```

**Use**: Recurring commissioned reports
**Integration**: Time-bounded jobs in plugin-commerce
**Value**: Predictable revenue for agent

## Appendix

### Related Work

**plugin-autonomous**: Informed provider-driven output thinking
**plugin-content-seeder**: Inspired anti-spam safeguards
**plugin-attract**: Informed engagement patterns
**plugin-clipscrew**: Inspired moment detection (adapted for stories)

### Decision Log

| Date | Decision | Rationale | Alternative Considered |
|------|----------|-----------|----------------------|
| 2025-02-17 | Provider-driven output | Natural, respects autonomy | Direct messaging |
| 2025-02-17 | Non-dynamic provider | Always included | Dynamic (wouldn't run) |
| 2025-02-17 | Coverage pump | Intentional pacing | Real-time reactions |
| 2025-02-17 | Strike system | Self-regulation | Manual moderation |
| 2025-02-17 | v1 basic commerce | Prove value first | Full integration |

### Metrics to Track

**Coverage effectiveness**:
- % output rooms with active coverage
- Avg mentions per room per day
- Strike rate (should be <5%)
- Mute rate (should be <2%)

**Commerce performance**:
- Report requests per day
- Conversion rate (quote → accepted)
- Avg report price
- Client satisfaction (future)

**Engagement**:
- Reactions per mention (via plugin-engagement in v2)
- Replies per mention
- Archetype performance by room
