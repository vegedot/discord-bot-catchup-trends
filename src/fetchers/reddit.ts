import type { Article } from '../models.js';

interface RedditPost {
  data: {
    id: string;
    title: string;
    url: string;
    score: number;
    selftext: string;
    created_utc: number;
    permalink: string;
    is_self: boolean;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[];
  };
}

async function fetchSubreddit(subreddit: string): Promise<Article[]> {
  const url = `https://www.reddit.com/r/${subreddit}/top.json?t=day&limit=25`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'discord-trend-bot/1.0' },
  });
  if (!res.ok) throw new Error(`Reddit API error for r/${subreddit}: ${res.status}`);

  const json = await res.json() as RedditResponse;
  return json.data.children.map((post) => {
    const d = post.data;
    // self post の場合は reddit リンクを URL として使う
    const articleUrl = d.is_self
      ? `https://www.reddit.com${d.permalink}`
      : d.url;

    return {
      id: `reddit_${d.id}`,
      title: d.title,
      url: articleUrl,
      score: d.score,
      source: `Reddit r/${subreddit}`,
      category: 'Tech/AI',
      publishedAt: new Date(d.created_utc * 1000),
      description: d.selftext.slice(0, 500),
    };
  });
}

export async function fetchReddit(subreddits: string[]): Promise<Article[]> {
  const results = await Promise.allSettled(subreddits.map(fetchSubreddit));
  const articles: Article[] = [];
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value);
    } else {
      console.warn(`[Reddit] Failed to fetch r/${subreddits[i]}: ${result.reason}`);
    }
  }
  return articles;
}
