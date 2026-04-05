import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import dotenv from 'dotenv';
import type { Config } from './models.js';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Error: ${name} is not set. Please configure it in GitHub Actions Secrets or .env file.`);
    process.exit(1);
  }
  return value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadYaml(): any {
  const configPath = path.resolve(process.cwd(), 'config.yaml');
  const raw = fs.readFileSync(configPath, 'utf-8');
  return yaml.load(raw);
}

export function loadConfig(): Config {
  const y = loadYaml();

  requireEnv('ANTHROPIC_API_KEY');
  requireEnv('DISCORD_BOT_TOKEN');
  const discordForumChannelId = requireEnv('DISCORD_FORUM_CHANNEL_ID');

  return {
    maxArticlesPerRun: y.max_articles_per_run ?? 5,
    hnMinScore: y.hn_min_score ?? 50,
    topics: y.topics ?? [],
    sources: {
      hackernews: {
        enabled: y.sources?.hackernews?.enabled ?? true,
        topStoriesLimit: y.sources?.hackernews?.top_stories_limit ?? 100,
      },
      reddit: {
        enabled: y.sources?.reddit?.enabled ?? true,
        subreddits: y.sources?.reddit?.subreddits ?? [],
      },
      huggingface: {
        enabled: y.sources?.huggingface?.enabled ?? true,
        trendingLimit: y.sources?.huggingface?.trending_limit ?? 20,
        includeSpaces: y.sources?.huggingface?.include_spaces ?? true,
      },
      rss: {
        enabled: y.sources?.rss?.enabled ?? true,
        feeds: y.sources?.rss?.feeds ?? [],
      },
    },
    claudeModel: y.claude_model ?? 'claude-haiku-4-5',
    summaryLanguage: y.summary_language ?? 'ja',
    discordForumChannelId,
    dedupWindowDays: y.dedup_window_days ?? 7,
  };
}

export function getAnthropicApiKey(): string {
  return process.env['ANTHROPIC_API_KEY']!;
}

export function getDiscordBotToken(): string {
  return process.env['DISCORD_BOT_TOKEN']!;
}

export function isDryRun(): boolean {
  return process.env['DRY_RUN'] === 'true';
}
