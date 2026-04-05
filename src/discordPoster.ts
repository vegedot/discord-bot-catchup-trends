import type { Article, Summary, PostRecord } from './models.js';

const DISCORD_API = 'https://discord.com/api/v10';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ForumTag {
  id: string;
  name: string;
}

interface ChannelData {
  available_tags?: ForumTag[];
}

// チャンネルの既存タグを取得する
async function getAvailableTags(channelId: string, token: string): Promise<ForumTag[]> {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) throw new Error(`Discord GET channel error ${res.status}`);
  const data = await res.json() as ChannelData;
  return data.available_tags ?? [];
}

// 不足しているカテゴリのタグをチャンネルに追加し、最終的な name→id マップを返す
async function ensureTags(
  channelId: string,
  token: string,
  categories: string[]
): Promise<Map<string, string>> {
  const existing = await getAvailableTags(channelId, token);
  const tagMap = new Map<string, string>(existing.map((t) => [t.name, t.id]));

  const missing = categories.filter((c) => !tagMap.has(c));
  if (missing.length === 0) return tagMap;

  // PATCH でタグを追加（既存タグ + 新規タグの完全リストを送る必要がある）
  const newTags = [
    ...existing.map((t) => ({ name: t.name, moderated: false })),
    ...missing.map((name) => ({ name, moderated: false })),
  ];

  const res = await fetch(`${DISCORD_API}/channels/${channelId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ available_tags: newTags }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(`[Discord] Failed to create tags: ${text}. Proceeding without tags.`);
    return tagMap;
  }

  const updated = await res.json() as ChannelData;
  for (const tag of updated.available_tags ?? []) {
    tagMap.set(tag.name, tag.id);
  }
  return tagMap;
}

function formatThreadContent(article: Article, summary: Summary): string {
  const date = article.publishedAt.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Tokyo',
  });
  const tags = summary.tags.length > 0 ? summary.tags.map((t) => `\`${t}\``).join(' ') : '';

  const lines: string[] = [
    `**ソース:** ${article.source} | **スコア:** ${article.score} | **日付:** ${date}`,
    '',
    summary.summary,
  ];

  if (summary.whyTrending) {
    lines.push('', `**なぜ注目されているか:** ${summary.whyTrending}`);
  }

  if (tags) {
    lines.push('', `**タグ:** ${tags}`);
  }

  lines.push('', `**リンク:** ${article.url}`);

  return lines.join('\n');
}

async function createForumThread(
  channelId: string,
  token: string,
  name: string,
  content: string,
  tagId: string | undefined
): Promise<string> {
  const body: Record<string, unknown> = {
    name: name.slice(0, 100),
    message: { content: content.slice(0, 2000) },
  };
  if (tagId) {
    body['applied_tags'] = [tagId];
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/threads`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after') ?? '2');
      console.warn(`[Discord] Rate limited. Retrying after ${retryAfter}s...`);
      await sleep(retryAfter * 1000);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Discord API error ${res.status}: ${text}`);
    }

    const data = await res.json() as { id: string };
    return data.id;
  }

  throw new Error(`Discord: Failed after retries: ${lastError}`);
}

export async function postToDiscord(
  items: Array<{ article: Article; summary: Summary }>,
  channelId: string,
  token: string,
  dryRun: boolean
): Promise<PostRecord[]> {
  const records: PostRecord[] = [];

  // 必要なカテゴリを収集してタグを一括作成
  const categories = [...new Set(items.map((i) => i.article.category).filter(Boolean))];
  let tagMap = new Map<string, string>();

  if (!dryRun && categories.length > 0) {
    try {
      tagMap = await ensureTags(channelId, token, categories);
      console.log(`[Discord] Tags ready: ${[...tagMap.entries()].map(([n, id]) => `${n}(${id})`).join(', ')}`);
    } catch (err) {
      console.warn(`[Discord] Could not set up tags: ${err}. Proceeding without tags.`);
    }
  }

  for (const { article, summary } of items) {
    const content = formatThreadContent(article, summary);
    const tagId = tagMap.get(article.category);

    if (dryRun) {
      console.log('\n' + '='.repeat(60));
      console.log(`[DRY RUN] Would post: ${article.title}`);
      console.log(`[DRY RUN] Category: ${article.category}`);
      console.log('-'.repeat(60));
      console.log(content);
      records.push({
        articleId: article.id,
        url: article.url,
        title: article.title,
        postedAt: new Date().toISOString(),
        discordThreadId: 'dry-run',
      });
      continue;
    }

    try {
      console.log(`[Discord] Posting: ${article.title} [${article.category}]`);
      const threadId = await createForumThread(channelId, token, article.title, content, tagId);
      records.push({
        articleId: article.id,
        url: article.url,
        title: article.title,
        postedAt: new Date().toISOString(),
        discordThreadId: threadId,
      });
      await sleep(1000);
    } catch (err) {
      console.error(`[Discord] Failed to post "${article.title}": ${err}`);
      throw err;
    }
  }

  return records;
}
