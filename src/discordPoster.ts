import type { Article, Summary, PostRecord } from './models.js';

const DISCORD_API = 'https://discord.com/api/v10';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  content: string
): Promise<string> {
  const body = {
    name: name.slice(0, 100), // Discord スレッド名の最大長
    message: { content: content.slice(0, 2000) }, // Discord メッセージの最大長
  };

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
      // Rate limit
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

  for (const { article, summary } of items) {
    const content = formatThreadContent(article, summary);

    if (dryRun) {
      console.log('\n' + '='.repeat(60));
      console.log(`[DRY RUN] Would post: ${article.title}`);
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
      console.log(`[Discord] Posting: ${article.title}`);
      const threadId = await createForumThread(channelId, token, article.title, content);
      records.push({
        articleId: article.id,
        url: article.url,
        title: article.title,
        postedAt: new Date().toISOString(),
        discordThreadId: threadId,
      });
      // Discord rate limit 対応: スレッド作成間に 1 秒待つ
      await sleep(1000);
    } catch (err) {
      console.error(`[Discord] Failed to post "${article.title}": ${err}`);
      throw err;
    }
  }

  return records;
}
