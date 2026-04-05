export interface Article {
  id: string;
  title: string;
  url: string;
  score: number;
  source: string;
  category: string;
  publishedAt: Date;
  description: string;
}

export interface Summary {
  articleId: string;
  title: string;
  summary: string;
  whyTrending: string;
  tags: string[];
}

export interface PostRecord {
  articleId: string;
  url: string;
  title: string;
  postedAt: string;
  discordThreadId: string;
}

export interface Config {
  maxArticlesPerRun: number;
  hnMinScore: number;
  topics: string[];
  sources: {
    hackernews: {
      enabled: boolean;
      topStoriesLimit: number;
    };
    reddit: {
      enabled: boolean;
      subreddits: string[];
    };
    huggingface: {
      enabled: boolean;
      trendingLimit: number;
      includeSpaces: boolean;
    };
    rss: {
      enabled: boolean;
      feeds: Array<{ url: string; name: string; category: string }>;
    };
  };
  claudeModel: string;
  summaryLanguage: string;
  discordForumChannelId: string;
  dedupWindowDays: number;
}
