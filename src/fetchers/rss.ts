import Parser from 'rss-parser';
import type { Article } from '../models.js';

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'discord-trend-bot/1.0' },
});

async function fetchFeed(url: string, name: string): Promise<Article[]> {
  const feed = await parser.parseURL(url);
  return feed.items.map((item, index) => ({
    id: `rss_${name}_${item.guid ?? item.link ?? String(index)}`,
    title: item.title ?? '(no title)',
    url: item.link ?? url,
    // RSS には score がないので掲載順位の逆数を擬似スコアとして使う
    score: Math.max(0, 100 - index * 5),
    source: name,
    publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
    description: item.contentSnippet ?? item.content ?? '',
  }));
}

export async function fetchRssFeeds(
  feeds: Array<{ url: string; name: string }>
): Promise<Article[]> {
  const results = await Promise.allSettled(
    feeds.map((f) => fetchFeed(f.url, f.name))
  );

  const articles: Article[] = [];
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value);
    } else {
      console.warn(`[RSS] Failed to fetch ${feeds[i]?.name} (${feeds[i]?.url}): ${result.reason}`);
    }
  }
  return articles;
}
