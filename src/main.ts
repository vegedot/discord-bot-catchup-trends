import { loadConfig, getDiscordBotToken, isDryRun } from './config.js';
import { fetchAllSources } from './fetchers/index.js';
import { deduplicateArticles, rankAndFilter, summarizeArticles } from './processor.js';
import { postToDiscord } from './discordPoster.js';
import { loadPostedItems, savePostedItems, pruneOldRecords } from './state.js';

async function main(): Promise<void> {
  console.log('[Main] Starting discord-bot-catchup-trends...');

  const config = loadConfig();
  const dryRun = isDryRun();

  if (dryRun) {
    console.log('[Main] DRY RUN mode enabled. No Discord posts will be made.');
  }

  // 1. 情報収集
  console.log('[Main] Fetching articles from all sources...');
  const allArticles = await fetchAllSources(config);

  if (allArticles.length === 0) {
    console.log('[Main] No articles fetched. Exiting.');
    return;
  }

  // 2. 重複除去
  const postedRecords = loadPostedItems();
  const deduplicated = deduplicateArticles(allArticles, postedRecords, config.dedupWindowDays);
  console.log(`[Main] After dedup: ${deduplicated.length} articles remaining`);

  if (deduplicated.length === 0) {
    console.log('[Main] All articles were already posted. Exiting.');
    return;
  }

  // 3. ランキング・フィルタリング
  const ranked = rankAndFilter(deduplicated, config);
  console.log(`[Main] After ranking/filtering: ${ranked.length} articles to post`);

  if (ranked.length === 0) {
    console.log('[Main] No articles matched topic filters. Exiting.');
    return;
  }

  // 4. Claude で要約
  console.log('[Main] Summarizing articles with Claude...');
  const summarized = await summarizeArticles(ranked, config);

  // 5. Discord に投稿
  console.log('[Main] Posting to Discord...');
  const newRecords = await postToDiscord(
    summarized,
    config.discordForumChannelId,
    getDiscordBotToken(),
    dryRun
  );

  // 6. 状態を保存（dry run 時は保存しない）
  if (!dryRun && newRecords.length > 0) {
    const updated = pruneOldRecords(
      [...postedRecords, ...newRecords],
      config.dedupWindowDays
    );
    savePostedItems(updated);
    console.log(`[Main] State saved. Total records: ${updated.length}`);
  }

  console.log(`[Main] Done. Posted ${newRecords.length} article(s).`);
}

main().catch((err) => {
  console.error('[Main] Fatal error:', err);
  process.exit(1);
});
