import type { Article, Config } from '../models.js';
import { fetchHackerNews } from './hackernews.js';
import { fetchReddit } from './reddit.js';
import { fetchHuggingFace } from './huggingface.js';
import { fetchRssFeeds } from './rss.js';

export async function fetchAllSources(config: Config): Promise<Article[]> {
  const tasks: Promise<Article[]>[] = [];

  if (config.sources.hackernews.enabled) {
    tasks.push(
      fetchHackerNews(config.sources.hackernews.topStoriesLimit, config.hnMinScore)
        .catch((err) => {
          console.warn(`[HackerNews] Fetch failed: ${err}`);
          return [];
        })
    );
  }

  if (config.sources.reddit.enabled && config.sources.reddit.subreddits.length > 0) {
    tasks.push(
      fetchReddit(config.sources.reddit.subreddits)
        .catch((err) => {
          console.warn(`[Reddit] Fetch failed: ${err}`);
          return [];
        })
    );
  }

  if (config.sources.huggingface.enabled) {
    tasks.push(
      fetchHuggingFace(
        config.sources.huggingface.trendingLimit,
        config.sources.huggingface.includeSpaces
      ).catch((err) => {
        console.warn(`[HuggingFace] Fetch failed: ${err}`);
        return [];
      })
    );
  }

  if (config.sources.rss.enabled && config.sources.rss.feeds.length > 0) {
    tasks.push(
      fetchRssFeeds(config.sources.rss.feeds)
        .catch((err) => {
          console.warn(`[RSS] Fetch failed: ${err}`);
          return [];
        })
    );
  }

  const results = await Promise.all(tasks);
  const all = results.flat();
  console.log(`[Fetchers] Total articles fetched: ${all.length}`);
  return all;
}
