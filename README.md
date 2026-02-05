# satisfactory-oci-server

Tailscale統合機能付きSatisfactory専用サーバー。

[wolveix/satisfactory-server](https://github.com/wolveix/satisfactory-server)をベースに、TailscaleでのVPN接続とDiscord Bot機能を追加しています。

## 特徴

- ✅ Satisfactory専用サーバー（ワールドウェア対応）
- ✅ Tailscale統合による安全なVPN接続
- ✅ Discord Botによるサーバー管理
- ✅ 自動バックアップ機能
- ✅ 配信用Dockerイメージ（GHCR）

## クイックスタート

### 1. 環境変数の設定

```bash
# サンプルをコピー
cp .env.example .env

# .envを編集
nano .env
```

**必須設定項目:**

| 変数 | 説明 |
|------|------|
| `TS_AUTH_KEY` | Tailscaleの認証キー（[Tailscale Admin Console](https://login.tailscale.com/admin/settings/keys)で「Reusable key」を作成） |
| `SATISFACTORY_BOT_DISCORD_TOKEN` | Discord Botのトークン |

### 2. サーバーの起動

```bash
# イメージをプル
docker compose pull

# サーバー起動
docker compose up -d

# ログ確認
docker compose logs -f
```

### 3. ゲームへの接続

1. [Tailscaleの管理コンソール](https://login.tailscale.com/admin/machines)にアクセス
2. `satisfactory`（または設定したホスト名）のマシンを探す
3. 表示されているTailscale IPアドレスでSatisfactoryに接続

## 環境変数

### Tailscale設定

| 変数 | 必須 | デフォルト | 説明 |
|------|:----:|----------|------|
| `TS_AUTH_KEY` | ✅ | - | Tailscale認証キー（Reusable key推奨） |
| `TS_HOSTNAME` | - | `satisfactory` | Tailscale上のホスト名 |
| `TS_EXTRA_ARGS` | - | - | 追加のTailscale引数（例: `--accept-routes`） |

### Discord Bot設定

| 変数 | 必須 | デフォルト | 説明 |
|------|:----:|----------|------|
| `SATISFACTORY_BOT_DISCORD_TOKEN` | ✅ | - | Discord Botのトークン |

### サーバー設定

| 変数 | 必須 | デフォルト | 説明 |
|------|:----:|----------|------|
| `MAXPLAYERS` | - | `4` | 最大プレイヤー数 |
| `PGID` | - | `1000` | グループID（Linuxの`id`コマンドで確認） |
| `PUID` | - | `1000` | ユーザーID（Linuxの`id`コマンドで確認） |
| `STEAMBETA` | - | `false` | 実験版ベータを使用するか |
| `DISABLESEASONALEVENTS` | - | `false` | シーズナルイベント（FICSMAS等）を無効化 |

## ディレクトリ構造

```
.
├── config/           # サーバー設定とセーブデータ
│   ├── backups/      # 自動バックアップ
│   ├── gamefiles/    # ゲームファイル（8GB+）
│   ├── logs/         # サーバーログ
│   └── saved/        # セーブデータ・ブループリント
├── compose.yaml      # Docker Compose設定
├── .env.example      # 環境変数サンプル
└── README.md         # このファイル
```

## Dockerコマンド

```bash
# サーバー起動
docker compose up -d

# ログ確認
docker compose logs -f

# サーバー停止
docker compose down

# サーバー再起動
docker compose restart

# 状態確認
docker compose ps

# イメージ更新
docker compose pull
docker compose up -d
```

## データのバックアップ

セーブデータは `./config/saved/` に保存されます。定期的なバックアップを推奨します：

```bash
# バックアップ作成
tar -czf satisfactory-backup-$(date +%Y%m%d).tar.gz config/

# バックアップからリストア
tar -xzf satisfactory-backup-YYYYMMDD.tar.gz
```

## システム要件

- **メモリ**: 8GB - 16GB推奨（後半や4人以上プレイで必要）
- **ストレージ**: 10GB+（ゲームファイル8GB + セーブデータ）
- **OS**: Linux（推奨）または Dockerが動作するOS

## トラブルシューティング

### 接続できない

1. Tailscale管理コンソールでマシンがオンラインか確認
2. ファイアウォールでTailscaleが許可されているか確認
3. `.env` の `TS_AUTH_KEY` が正しいか確認

### パーミッションエラー

```bash
# ユーザーIDを確認
id

# .envのPGID/PUIDを確認の値に設定
```

### ログの確認

```bash
# Dockerログ
docker compose logs -f

# Satisfactoryサーバーログ
cat config/logs/FactoryGame.log
```

## 開発

```bash
# 依存関係インストール
bun install

# ローカルで開発
bun run dev

# ビルド
bun run build

# テスト
bun test
```

## Dockerイメージ

**イメージURL:**
```
ghcr.io/miyaji255/satisfactory-oucc-server:latest
```

GitHub Actionsで自動ビルド：
- `main` ブランチへのプッシュ時
- タグ付け時（`v*`）
- 手動実行

## ライセンス

このプロジェクトは、元の [wolveix/satisfactory-server](https://github.com/wolveix/satisfactory-server) をベースにしています。

## 関連リンク

- [Satisfactory Wiki - 専用サーバー](https://satisfactory.wiki.gg/wiki/Dedicated_servers)
- [wolveix/satisfactory-server](https://github.com/wolveix/satisfactory-server)
- [Tailscale ドキュメント](https://tailscale.com/kb/)
