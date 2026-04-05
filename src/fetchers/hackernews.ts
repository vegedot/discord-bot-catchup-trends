import type { Article } from '../models.js';

const HN_API = 'https://hacker-news.firebaseio.com/v1';
const CONCURRENCY = 20;

interface HNItem {
  id: number;
  title?: string;
  url?: string;
  score?: number;
  time?: number;
  text?: string;
  type?: string;
}

async function fetchItem(id: number): Promise<HNItem | null> {
  try {
    const res = await fetch(`${HN_API}/item/${id}.json`);
    if (!res.ok) return null;
    return await res.json() as HNItem;
  } catch {
    return null;
  }
}

async function fetchWithConcurrency<T>(
  ids: number[],
  fn: (id: number) => Promise<T | null>,
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += limit) {
    const batch = ids.slice(i, i + limit);
    const settled = await Promise.allSettled(batch.map(fn));
    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value !== null) {
        results.push(result.value);
      }
    }
  }
  return results;
}

export async function fetchHackerNews(topStoriesLimit: number, minScore: number): Promise<Article[]> {
  const res = await fetch(`${HN_API}/topstories.json`);
  if (!res.ok) throw new Error(`HN API error: ${res.status}`);

  const ids = (await res.json() as number[]).slice(0, topStoriesLimit);
  const items = await fetchWithConcurrency(ids, fetchItem, CONCURRENCY);

  return items
    .filter((item): item is HNItem =>
      item !== null &&
      item.type === 'story' &&
      !!item.url &&
      !!item.title &&
      (item.score ?? 0) >= minScore
    )
    .map((item) => ({
      id: `hn_${item.id}`,
      title: item.title!,
      url: item.url!,
      score: item.score ?? 0,
      source: 'Hacker News',
      category: 'Tech/AI',
      publishedAt: new Date((item.time ?? 0) * 1000),
      description: item.text ?? '',
    }));
}
