import type { Article } from '../models.js';

const HF_API = 'https://huggingface.co/api';

interface HFModel {
  id: string;
  modelId: string;
  likes: number;
  downloads: number;
  createdAt: string;
  lastModified: string;
  cardData?: { language?: string[]; tags?: string[] };
}

interface HFSpace {
  id: string;
  likes: number;
  createdAt: string;
  lastModified: string;
  cardData?: { title?: string };
}

export async function fetchHuggingFace(trendingLimit: number, includeSpaces: boolean): Promise<Article[]> {
  const articles: Article[] = [];

  // モデルのトレンド取得
  try {
    const res = await fetch(
      `${HF_API}/models?sort=trending&limit=${trendingLimit}&full=false`
    );
    if (!res.ok) throw new Error(`HuggingFace models API error: ${res.status}`);
    const models = await res.json() as HFModel[];

    for (const model of models) {
      const modelId = model.modelId ?? model.id;
      articles.push({
        id: `hf_model_${modelId.replace(/\//g, '_')}`,
        title: modelId,
        url: `https://huggingface.co/${modelId}`,
        score: model.likes ?? 0,
        source: 'HuggingFace Models',
        category: 'Tech/AI',
        publishedAt: new Date(model.lastModified ?? model.createdAt),
        description: `Trending model on HuggingFace. Downloads: ${model.downloads ?? 0}, Likes: ${model.likes ?? 0}`,
      });
    }
  } catch (err) {
    console.warn(`[HuggingFace] Failed to fetch models: ${err}`);
  }

  // Spaces のトレンド取得
  if (includeSpaces) {
    try {
      const res = await fetch(
        `${HF_API}/spaces?sort=trending&limit=${trendingLimit}&full=false`
      );
      if (!res.ok) throw new Error(`HuggingFace spaces API error: ${res.status}`);
      const spaces = await res.json() as HFSpace[];

      for (const space of spaces) {
        const title = space.cardData?.title ?? space.id;
        articles.push({
          id: `hf_space_${space.id.replace(/\//g, '_')}`,
          title: `[Space] ${title}`,
          url: `https://huggingface.co/spaces/${space.id}`,
          score: space.likes ?? 0,
          source: 'HuggingFace Spaces',
          category: 'Tech/AI',
          publishedAt: new Date(space.lastModified ?? space.createdAt),
          description: `Trending AI demo on HuggingFace Spaces. Likes: ${space.likes ?? 0}`,
        });
      }
    } catch (err) {
      console.warn(`[HuggingFace] Failed to fetch spaces: ${err}`);
    }
  }

  return articles;
}
