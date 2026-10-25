# World Monitor AI / Tech

世界情勢の中でもAIとテックのニュース、シグナル、基盤ステータス、市場・エネルギー指標を優先して見るためのローカルダッシュボードです。

## GitHubから利用する場合

ソースコード版にはNode.js実行バイナリを含めていません。Node.js 20以降を用意し、このフォルダーで次を実行してください。現在の構成に追加のnpmパッケージは不要です。

```bash
npm start
```

デスクトップアイコンを使用する場合は `Mac移行セットアップ.command` を実行します。Node.jsの追加インストールなしで別のMacへ移す場合は、実行環境を同梱した `World Monitor Mac移行版.zip` を使用してください。

APIキー、実行ログ、PID、ブラウザーの設定書き出し、検証用ファイル、このMac専用の古いアイコンはGitの管理対象から除外しています。タブの並び順やアラートなどのブラウザー設定の移行方法は [Mac移行手順.md](Mac移行手順.md) を参照してください。

## 起動

別のMacへ移す場合は [Mac移行手順.md](Mac移行手順.md) を参照してください。フォルダー内の `Mac移行セットアップ.command` でデスクトップに起動・終了アイコンを作成できます。保存場所とユーザー名に依存せず、同梱のNode.jsを優先して使用します。

```bash
/Volumes/SSD/VAULT/world-monitor-dashboard/scripts/start-world-monitor.command
```

デフォルトURLは `http://localhost:4173` です。

## デスクトップアイコン

デスクトップに配置した `World Monitor 起動.command` と `World Monitor 停止.command` をダブルクリックすると、ローカルサーバーの起動と停止を操作できます。

内部では `launchctl` を優先してサーバーを常駐起動し、`.runtime/world-monitor-4173.pid` と `.runtime/world-monitor-4173.log` でプロセスとログを管理します。別のポートを指定した場合はその番号を使用します。

## データソース

- GDELT DOC 2.1: AI、半導体、クラウド、サイバー、政策ニュース
- Google News RSS: 地域別のAI・テック、自動車、世界情勢・経済ニュース
- Hacker News Firebase API: 開発者コミュニティのAI/Tech話題
- USGS GeoJSON: 供給網・地政学リスク補助シグナル
- OpenAI/GitHub/Cloudflare StatusPage: AI/Tech基盤ステータス
- キー不要のFRED日次CSV: S&P 500、NASDAQ、ドル円、WTI
- Yahoo!ファイナンス: TOPIX公表値
- CoinGecko: Bitcoin、Ethereum
- FRED / EIA: APIキーがある場合に補助指標として利用可能

## 任意のAPIキー

```bash
FRED_API_KEY=your_fred_key EIA_API_KEY=your_eia_key /Volumes/SSD/VAULT/world-monitor-dashboard/scripts/start-world-monitor.command
```

キーがない項目はダッシュボードに出さず、キーなしで取得できる無料APIを優先して表示します。

## 日本語化

日本語記事の見出しはそのまま表示し、外国語の見出しは外部の無料翻訳サービスで日本語化します。取得できない場合はローカル辞書などで補完します。原文は見出しのツールチップに残し、本文カードには重ねて表示しません。機械翻訳には誤訳の可能性があります。

## 出典・ライセンス

同梱ライブラリと地図データの出典・ライセンス本文は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) と `licenses/` にまとめています。本プロジェクトはWorld Monitorの公式版ではありません。独自コード部分の包括的な再利用ライセンスは未指定です。

外部ニュースや市場データの利用条件は各提供元に従ってください。市場値は公表日・観測日に基づく日次・遅延データを含みます。コンテンツ生成は公開見出しから作る下書きで、記事本文を検証する外部AIライターAPIには接続していません。
