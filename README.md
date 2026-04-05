# discord-bot-catchup-trends

AI・テック系のトレンド情報を自動収集し、Discord のフォーラムチャンネルに毎日投稿する Bot です。

## 機能

- **情報収集**: Hacker News、Reddit（r/LocalLLaMA 等）、HuggingFace Trending、各種 RSS フィード（TechCrunch、Zenn、Qiita 等）から並列取得
- **AI 要約**: Claude (claude-haiku-4-5) で日本語要約・タグ付けを自動生成
- **重複防止**: 過去7日以内に投稿済みの記事はスキップ
- **自動実行**: GitHub Actions で毎日 UTC 9:00（JST 18:00）に実行
- **設定可能**: `config.yaml` でキーワード・ソース・投稿数などを自由に変更

## セットアップ手順

### 1. Discord Bot の作成

1. [Discord Developer Portal](https://discord.com/developers/applications) を開く
2. **New Application** → アプリ名を入力して作成
3. 左メニューの **Bot** → **Add Bot**
4. **Token** をコピーして保存（後で GitHub Secrets に登録）
5. **Privileged Gateway Intents** はすべて OFF で OK

#### Bot をサーバーに招待する

1. 左メニューの **OAuth2** → **URL Generator**
2. Scopes: `bot` にチェック
3. Bot Permissions: 以下にチェック
   - `Send Messages`
   - `Create Public Threads`
   - `Manage Threads`
4. 生成された URL をブラウザで開いてサーバーに招待

### 2. Discord フォーラムチャンネルの準備

1. Discord の **ユーザー設定** → **詳細設定** → **開発者モード** をオン
2. サーバーにフォーラムチャンネルを作成（チャンネルタイプ: フォーラム）
3. 作成したチャンネルを右クリック → **ID をコピー**

### 3. config.yaml の更新

```yaml
discord_forum_channel_id: "ここにコピーした ID を貼り付け"
```

必要に応じてトピックキーワードや情報ソースも編集してください。

### 4. GitHub Secrets の登録

リポジトリの **Settings** → **Secrets and variables** → **Actions** → **New repository secret** で以下を登録:

| Secret 名 | 値 |
|---|---|
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com/) で取得した API キー |
| `DISCORD_BOT_TOKEN` | 手順1でコピーした Bot トークン |
| `DISCORD_FORUM_CHANNEL_ID` | 手順2でコピーしたフォーラムチャンネル ID |

### 5. 動作確認

GitHub Actions の **Actions** タブ → **Post Trending Articles to Discord** → **Run workflow** で手動実行できます。

**Dry run**（Discord に投稿せずに動作確認）:
- `dry_run` にチェックを入れて Run workflow

## ローカルでの実行

```bash
# 依存パッケージのインストール
npm install

# .env ファイルを作成してシークレットを設定
cp .env.example .env
# .env を編集して ANTHROPIC_API_KEY と DISCORD_BOT_TOKEN を設定

# Dry run（Discord に投稿しない）
npm run dry-run

# 実際に投稿
npm run start
```

## 設定ファイル（config.yaml）

| 設定項目 | 説明 | デフォルト |
|---|---|---|
| `max_articles_per_run` | 1回の実行で投稿する最大記事数 | `5` |
| `hn_min_score` | HN の最低スコア閾値 | `50` |
| `topics` | フィルタリングキーワード（部分一致） | AI, LLM, etc. |
| `sources.hackernews.enabled` | HN を有効にするか | `true` |
| `sources.reddit.subreddits` | 監視するサブレディット | LocalLLaMA, etc. |
| `sources.huggingface.trending_limit` | HF トレンド取得件数 | `20` |
| `sources.rss.feeds` | RSS フィード一覧 | TechCrunch, Zenn, etc. |
| `claude_model` | 使用する Claude モデル | `claude-haiku-4-5` |
| `summary_language` | 要約の言語（`ja` / `en`） | `ja` |
| `discord_forum_channel_id` | 投稿先フォーラムチャンネル ID | 要設定 |
| `dedup_window_days` | 重複スキップの期間（日） | `7` |

## ライセンス

Apache License 2.0
