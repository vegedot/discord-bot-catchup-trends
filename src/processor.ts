import Anthropic from '@anthropic-ai/sdk';
import type { Article, Summary, Config } from './models.js';
import { buildPostedSet, normalizeUrl } from './state.js';
import type { PostRecord } from './models.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function deduplicateArticles(
  articles: Article[],
  postedRecords: PostRecord[],
  windowDays: number
): Article[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  const recentRecords = postedRecords.filter((r) => new Date(r.postedAt) >= cutoff);
  const postedSet = buildPostedSet(recentRecords);

  // 同一バッチ内の重複も除去（URL ベース）
  const seenUrls = new Set<string>();
  const result: Article[] = [];

  for (const article of articles) {
    const normalizedUrl = normalizeUrl(article.url);
    if (postedSet.has(normalizedUrl) || postedSet.has(article.id)) continue;
    if (seenUrls.has(normalizedUrl)) continue;
    seenUrls.add(normalizedUrl);
    result.push(article);
  }

  return result;
}

export function rankAndFilter(articles: Article[], config: Config): Article[] {
  const lowerTopics = config.topics.map((t) => t.toLowerCase());

  const filtered = articles.filter((a) => {
    if (lowerTopics.length === 0) return true;
    const text = `${a.title} ${a.description}`.toLowerCase();
    return lowerTopics.some((topic) => text.includes(topic));
  });

  // score 降順でソートして上位 N 件
  filtered.sort((a, b) => b.score - a.score);
  return filtered.slice(0, config.maxArticlesPerRun);
}

async function summarizeOne(
  client: Anthropic,
  article: Article,
  model: string,
  language: string
): Promise<Summary> {
  const langInstruction =
    language === 'ja'
      ? '日本語で回答してください。'
      : 'Please respond in English.';

  const prompt = `以下の記事をdeveloper community向けに要約してください。${langInstruction}

タイトル: ${article.title}
URL: ${article.url}
ソース: ${article.source}（スコア: ${article.score}）
説明: ${article.description.slice(0, 1000)}

以下のJSON形式のみで回答してください（コードブロック不要）:
{
  "summary": "2〜3文の要約",
  "whyTrending": "なぜ注目されているかを1文で",
  "tags": ["タグ1", "タグ2", "タグ3"]
}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const message = await client.messages.create({
        model,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = message.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');

      // JSON のみを抽出
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      const parsed = JSON.parse(jsonMatch[0]) as {
        summary: string;
        whyTrending: string;
        tags: string[];
      };

      return {
        articleId: article.id,
        title: article.title,
        summary: parsed.summary,
        whyTrending: parsed.whyTrending,
        tags: parsed.tags ?? [],
      };
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        console.warn(`[Processor] Summarize failed, retrying in 5s: ${err}`);
        await sleep(5000);
      }
    }
  }

  // フォールバック: 要約なしで記事タイトルのみ返す
  console.warn(`[Processor] Summarize failed for "${article.title}": ${lastError}`);
  return {
    articleId: article.id,
    title: article.title,
    summary: article.description.slice(0, 200) || article.title,
    whyTrending: '',
    tags: [],
  };
}

export async function summarizeArticles(
  articles: Article[],
  config: Config
): Promise<Array<{ article: Article; summary: Summary }>> {
  const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });
  const results: Array<{ article: Article; summary: Summary }> = [];

  for (const article of articles) {
    console.log(`[Processor] Summarizing: ${article.title}`);
    const summary = await summarizeOne(client, article, config.claudeModel, config.summaryLanguage);
    results.push({ article, summary });
    // レート制限対応のため少し待つ
    await sleep(500);
  }

  return results;
}
