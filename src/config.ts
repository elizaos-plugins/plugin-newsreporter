import { z } from 'zod';

export const newsReporterConfigSchema = z.object({
  // Coverage pump
  REPORTER_COVERAGE_CHECK_MS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number())
    .default('1800000'), // 30min
  REPORTER_DEFAULT_CADENCE_MS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number())
    .default('7200000'), // 2h
  REPORTER_BREAKING_OVERRIDE: z
    .string()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .default('true'),

  // Anti-spam safeguards (v1 subset)
  REPORTER_MIN_IDLE_BEFORE_NUDGE_MS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number())
    .default('1800000'), // 30min (v2: implement idle detection)
  REPORTER_DAILY_MENTION_CAP: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number())
    .default('15'),
  REPORTER_STRIKE_MUTE_HOURS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number())
    .default('24'),
  REPORTER_STRIKE_DECAY_HOURS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number())
    .default('48'),

  // Digests (v2 feature, disabled in v1)
  REPORTER_DAILY_DIGEST_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .default('false'),
  REPORTER_DAILY_DIGEST_HOUR_UTC: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number())
    .default('14'),

  // Commerce pricing
  REPORTER_BRIEFING_BASE_PRICE: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number())
    .default('50'),
  REPORTER_DEEPDIVE_BASE_PRICE: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number())
    .default('200'),
  REPORTER_SUBSCRIPTION_MONTHLY_PRICE: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number())
    .default('500'),
});

export type NewsReporterConfig = z.infer<typeof newsReporterConfigSchema>;
