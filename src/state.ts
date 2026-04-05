import fs from 'fs';
import path from 'path';
import type { PostRecord } from './models.js';

const STATE_PATH = path.resolve(process.cwd(), 'posted_items.json');

export function loadPostedItems(): PostRecord[] {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf-8');
    return JSON.parse(raw) as PostRecord[];
  } catch {
    return [];
  }
}

export function savePostedItems(records: PostRecord[]): void {
  fs.writeFileSync(STATE_PATH, JSON.stringify(records, null, 2) + '\n', 'utf-8');
}

export function pruneOldRecords(records: PostRecord[], windowDays: number): PostRecord[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  return records.filter((r) => new Date(r.postedAt) >= cutoff);
}

export function buildPostedSet(records: PostRecord[]): Set<string> {
  const set = new Set<string>();
  for (const r of records) {
    set.add(normalizeUrl(r.url));
    set.add(r.articleId);
  }
  return set;
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.toLowerCase());
    // 末尾スラッシュ除去
    u.pathname = u.pathname.replace(/\/$/, '') || '/';
    return u.toString();
  } catch {
    return url.toLowerCase().replace(/\/$/, '');
  }
}
