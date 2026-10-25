import { LEGACY_AI_LABS, LEGACY_DATA_CENTERS, LEGACY_DC_COLORS, LEGACY_LAB_COLORS } from "./legacy-world-monitor-data.js";
import { safeExternalUrl, safeMarkdownUrl } from "./url-security.js";

const state = {
  data: null,
  activeRegion: "world",
  activeSpotlightTab: "hot",
  activeFeedTab: "ai",
  activeFocusRegion: "world",
  layers: {},
  alertConfig: null,
  mapReady: false,
  mapMode: "2d",
  resizeObserver: null,
  mapTransform: null,
  zoomBehavior: null,
  projection: null,
  mapSize: null,
  readableFrame: null,
  pendingReadableScale: 1,
  lastReadableScale: 0,
  tileFrame: null,
  pendingTileTransform: null,
  globe: null,
  contentPack: null,
  activeContentTab: "summary",
  isLoadingDashboard: false,
  lastDashboardLoadAt: 0
};

const dashboardRefreshIntervalMs = 15 * 60 * 1000;
const visibleRefreshStaleMs = 20 * 60 * 1000;

const regionMeta = {
  world: { labelJa: "世界", labelEn: "World" },
  us: { labelJa: "アメリカ", labelEn: "United States" },
  europe: { labelJa: "ヨーロッパ", labelEn: "Europe" },
  asia: { labelJa: "アジア", labelEn: "Asia" },
  japan: { labelJa: "日本", labelEn: "Japan" }
};

const spotlightTabs = [
  { key: "hot", label: "HOT", labelJa: "ホット", color: "#ff6b35" },
  { key: "research", label: "研究", labelJa: "研究", color: "#00d4ff" },
  { key: "funding", label: "投資", labelJa: "投資", color: "#00ff88" },
  { key: "policy", label: "政策", labelJa: "政策", color: "#fbbf24" },
  { key: "models", label: "モデル", labelJa: "モデル", color: "#a855f7" },
  { key: "automotive", label: "自動車", labelJa: "自動車", color: "#38bdf8" },
  { key: "japan", label: "日本", labelJa: "日本", color: "#ff4444" },
  { key: "github", label: "GitHub", labelJa: "GitHub", color: "#fbbf24" }
];

const feedTabs = [
  { key: "ai", label: "AI" },
  { key: "auto", label: "自動車" },
  { key: "all", label: "全て" },
  { key: "rss", label: "地域RSS" },
  { key: "hn", label: "HN" },
  { key: "devto", label: "Dev.to" }
];

const contentTabs = [
  { key: "summary", label: "要約", icon: "list-checks" },
  { key: "x", label: "X", icon: "send" },
  { key: "note", label: "note", icon: "file-text" },
  { key: "podcast", label: "Podcast", icon: "mic-2" },
  { key: "sources", label: "出典", icon: "link" }
];

const storageKeys = {
  regionTabs: "worldMonitor.regionTabs.v1",
  spotlightTabs: "worldMonitor.spotlightTabs.v1",
  feedTabs: "worldMonitor.feedTabs.v1",
  contentTabs: "worldMonitor.contentTabs.v1",
  dockPanels: "worldMonitor.dockPanels.v1",
  trendItems: "worldMonitor.trendItems.v1",
  macroItems: "worldMonitor.macroItems.v1",
  statusItems: "worldMonitor.statusItems.v1",
  focusItems: "worldMonitor.focusItems.v1",
  worldTopicsItems: "worldMonitor.worldTopicsItems.v1",
  infraItems: "worldMonitor.infraItems.v1",
  mapLayers: "worldMonitor.mapLayers.v1",
  mapMode: "worldMonitor.mapMode.v1",
  alerts: "worldMonitor.alerts.v1"
};

const defaultLayerState = {
  alerts: true,
  risk: false,
  labels: true,
  tiles: false,
  heat: false,
  news: false,
  arcs: false,
  hq: false,
  autoHq: false,
  lab: false,
  corp: false,
  chip: false,
  research: false,
  japan: false,
  datacenter: false
};

const alertTopics = [
  { key: "models", label: "生成AI" },
  { key: "chips", label: "半導体" },
  { key: "data-centers", label: "電力/DC" },
  { key: "cloud", label: "クラウド" },
  { key: "security", label: "サイバー" },
  { key: "policy", label: "規制" },
  { key: "funding", label: "投資" },
  { key: "geopolitics", label: "地政学" },
  { key: "economy", label: "経済" },
  { key: "markets", label: "市場" },
  { key: "energy", label: "資源" },
  { key: "automotive", label: "自動車" },
  { key: "robotics", label: "ロボ" },
  { key: "quantum", label: "量子" }
];

const defaultAlertConfig = {
  enabled: true,
  threshold: 72,
  topics: ["models", "chips", "data-centers", "security", "policy", "funding", "geopolitics", "economy", "markets", "energy", "automotive"]
};

const layerConfig = [
  { key: "alerts", label: "緊急", color: "#ff4444" },
  { key: "risk", label: "リスク", color: "#f43f5e" },
  { key: "labels", label: "地名", color: "#7a9cc0" },
  { key: "tiles", label: "詳細地図", color: "#6aa8ff" },
  { key: "heat", label: "ヒート", color: "#fbbf24" },
  { key: "news", label: "ニュース", color: "#38bdf8" },
  { key: "arcs", label: "接続ライン", color: "#00d4ff" },
  { key: "hq", label: "AI本社", color: "#c084fc" },
  { key: "autoHq", label: "自動車本社", color: "#22d3ee" },
  { key: "lab", label: "AIラボ", color: "#00d4ff" },
  { key: "corp", label: "AI企業", color: "#a855f7" },
  { key: "chip", label: "半導体", color: "#f97316" },
  { key: "research", label: "研究機関", color: "#22c55e" },
  { key: "japan", label: "日本AI", color: "#ff4444" },
  { key: "datacenter", label: "データセンター", color: "#94a3b8" }
];

const lowPowerStartupOffLayers = ["risk", "tiles", "heat", "news", "arcs", "hq", "autoHq", "lab", "corp", "chip", "research", "japan", "datacenter"];

state.layers = loadLayerState();
state.alertConfig = loadAlertConfig();
state.mapMode = loadMapMode();

const regionViews = {
  world: { lon: 15, lat: 20, scale: 1 },
  us: { lon: -118.4, lat: 38.1, scale: 8.8 },
  europe: { lon: 5.4, lat: 50.5, scale: 10.8 },
  asia: { lon: 121.2, lat: 31.2, scale: 8.9 },
  japan: { lon: 139.2, lat: 35.9, scale: 23 }
};

const zoomFocusViews = {
  us: { lon: -122.1, lat: 37.42 },
  europe: { lon: 2.35, lat: 48.86 },
  asia: { lon: 121.1, lat: 31.2 },
  japan: { lon: 139.76, lat: 35.68 }
};

const countryLabels = [
  { name: "カナダ", lon: -105, lat: 56, region: "us" },
  { name: "アメリカ", lon: -98, lat: 39, region: "us" },
  { name: "メキシコ", lon: -102, lat: 23, region: "us" },
  { name: "ブラジル", lon: -53, lat: -10, region: "world" },
  { name: "アルゼンチン", lon: -64, lat: -35, region: "world" },
  { name: "チリ", lon: -71, lat: -30, region: "world" },
  { name: "アイルランド", lon: -8, lat: 53, region: "europe", detailOnly: true },
  { name: "オランダ", lon: 5.3, lat: 52.2, region: "europe", detailOnly: true },
  { name: "ベルギー", lon: 4.6, lat: 50.7, region: "europe", detailOnly: true },
  { name: "スイス", lon: 8.2, lat: 46.8, region: "europe", detailOnly: true },
  { name: "オーストリア", lon: 14.4, lat: 47.6, region: "europe", detailOnly: true },
  { name: "デンマーク", lon: 10, lat: 56, region: "europe", detailOnly: true },
  { name: "ノルウェー", lon: 8.5, lat: 61.5, region: "europe", detailOnly: true },
  { name: "スウェーデン", lon: 15, lat: 62, region: "europe", detailOnly: true },
  { name: "フィンランド", lon: 26, lat: 64, region: "europe", detailOnly: true },
  { name: "ポーランド", lon: 19, lat: 52, region: "europe", detailOnly: true },
  { name: "チェコ", lon: 15.5, lat: 49.8, region: "europe", detailOnly: true },
  { name: "ルーマニア", lon: 25, lat: 45.8, region: "europe", detailOnly: true },
  { name: "ギリシャ", lon: 22, lat: 39, region: "europe", detailOnly: true },
  { name: "英国", lon: -2, lat: 54, region: "europe" },
  { name: "フランス", lon: 2, lat: 46, region: "europe" },
  { name: "ドイツ", lon: 10, lat: 51, region: "europe" },
  { name: "スペイン", lon: -4, lat: 40, region: "europe" },
  { name: "イタリア", lon: 12, lat: 43, region: "europe" },
  { name: "ウクライナ", lon: 31, lat: 49, region: "europe" },
  { name: "ロシア", lon: 80, lat: 61, region: "europe" },
  { name: "トルコ", lon: 35, lat: 39, region: "europe" },
  { name: "イラン", lon: 54, lat: 32, region: "asia" },
  { name: "サウジアラビア", lon: 45, lat: 24, region: "asia" },
  { name: "イスラエル", lon: 35, lat: 31.5, region: "asia", detailOnly: true },
  { name: "UAE", lon: 54, lat: 24, region: "asia", detailOnly: true },
  { name: "パキスタン", lon: 69, lat: 30, region: "asia", detailOnly: true },
  { name: "バングラデシュ", lon: 90.3, lat: 24, region: "asia", detailOnly: true },
  { name: "エジプト", lon: 30, lat: 27, region: "world" },
  { name: "ナイジェリア", lon: 8, lat: 9, region: "world" },
  { name: "南アフリカ", lon: 24, lat: -29, region: "world" },
  { name: "インド", lon: 78, lat: 22, region: "asia" },
  { name: "中国", lon: 104, lat: 35, region: "asia" },
  { name: "モンゴル", lon: 104, lat: 46, region: "asia" },
  { name: "北朝鮮", lon: 127, lat: 40, region: "asia", detailOnly: true, context: ["japan"] },
  { name: "韓国", lon: 128, lat: 36, region: "asia" },
  { name: "日本", lon: 138, lat: 37, region: "japan" },
  { name: "台湾", lon: 121, lat: 24, region: "asia" },
  { name: "ベトナム", lon: 108, lat: 15, region: "asia" },
  { name: "タイ", lon: 101, lat: 15, region: "asia" },
  { name: "マレーシア", lon: 102, lat: 4, region: "asia", detailOnly: true },
  { name: "シンガポール", lon: 103.8, lat: 1.3, region: "asia", detailOnly: true },
  { name: "フィリピン", lon: 122, lat: 13, region: "asia", detailOnly: true },
  { name: "インドネシア", lon: 118, lat: -2, region: "asia" },
  { name: "オーストラリア", lon: 134, lat: -25, region: "asia" }
];

const regionLabels = [
  { name: "北米", lon: -102, lat: 50, region: "us" },
  { name: "西海岸", lon: -122, lat: 40, region: "us", detailOnly: true },
  { name: "シリコンバレー", lon: -122.1, lat: 37.4, region: "us", detailOnly: true },
  { name: "太平洋北西部", lon: -122.6, lat: 46.5, region: "us", detailOnly: true },
  { name: "テキサス", lon: -99, lat: 31.2, region: "us", detailOnly: true },
  { name: "五大湖", lon: -86, lat: 43.5, region: "us", detailOnly: true },
  { name: "東海岸", lon: -75.5, lat: 40.5, region: "us", detailOnly: true },
  { name: "首都圏", lon: -77.2, lat: 38.8, region: "us", detailOnly: true },
  { name: "カナダAI回廊", lon: -79, lat: 44, region: "us", detailOnly: true },
  { name: "中南米", lon: -68, lat: -13, region: "world" },
  { name: "ヨーロッパ", lon: 15, lat: 55, region: "europe" },
  { name: "英国・アイルランド", lon: -4, lat: 54, region: "europe", detailOnly: true },
  { name: "ベネルクス", lon: 5, lat: 51.5, region: "europe", detailOnly: true },
  { name: "DACH", lon: 10, lat: 48.5, region: "europe", detailOnly: true },
  { name: "北欧", lon: 15, lat: 61, region: "europe", detailOnly: true },
  { name: "南欧", lon: 10, lat: 42, region: "europe", detailOnly: true },
  { name: "東欧", lon: 24, lat: 50, region: "europe", detailOnly: true },
  { name: "バルト", lon: 24, lat: 57, region: "europe", detailOnly: true },
  { name: "バルカン", lon: 22, lat: 44, region: "europe", detailOnly: true },
  { name: "中東", lon: 46, lat: 28, region: "asia" },
  { name: "アフリカ", lon: 20, lat: 2, region: "world" },
  { name: "南アジア", lon: 78, lat: 18, region: "asia" },
  { name: "東アジア", lon: 116, lat: 35, region: "asia" },
  { name: "東南アジア", lon: 106, lat: 7, region: "asia" },
  { name: "オセアニア", lon: 135, lat: -25, region: "asia" },
  { name: "中国沿海部", lon: 119, lat: 32, region: "asia", detailOnly: true },
  { name: "華北", lon: 116, lat: 39, region: "asia", detailOnly: true },
  { name: "華南", lon: 113, lat: 23, region: "asia", detailOnly: true },
  { name: "台湾海峡", lon: 120, lat: 24, region: "asia", detailOnly: true },
  { name: "インドAI回廊", lon: 77.5, lat: 16.5, region: "asia", detailOnly: true },
  { name: "ASEAN", lon: 105, lat: 4, region: "asia", detailOnly: true },
  { name: "湾岸AI投資圏", lon: 53, lat: 25, region: "asia", detailOnly: true },
  { name: "豪州東岸", lon: 151, lat: -29, region: "asia", detailOnly: true },
  { name: "北海道", lon: 142, lat: 43.5, region: "japan", detailOnly: true },
  { name: "東北", lon: 140.5, lat: 39.2, region: "japan", detailOnly: true },
  { name: "関東", lon: 139.3, lat: 36.1, region: "japan", detailOnly: true },
  { name: "中部", lon: 137.2, lat: 36.1, region: "japan", detailOnly: true },
  { name: "関西", lon: 135.4, lat: 34.8, region: "japan", detailOnly: true },
  { name: "中国地方", lon: 133.2, lat: 34.7, region: "japan", detailOnly: true },
  { name: "九州", lon: 130.7, lat: 32.3, region: "japan", detailOnly: true },
  { name: "朝鮮半島", lon: 127.6, lat: 38, region: "asia", context: ["japan"], detailOnly: true },
  { name: "中国東北部", lon: 124.5, lat: 42, region: "asia", context: ["japan"], detailOnly: true },
  { name: "華東", lon: 121, lat: 31.2, region: "asia", context: ["japan"], detailOnly: true }
];

const cityLabels = [
  { name: "東京", lon: 139.76, lat: 35.68, region: "japan" },
  { name: "大阪", lon: 135.5, lat: 34.69, region: "japan" },
  { name: "ソウル", lon: 126.98, lat: 37.57, region: "asia", context: ["japan"] },
  { name: "北京", lon: 116.41, lat: 39.9, region: "asia" },
  { name: "上海", lon: 121.47, lat: 31.23, region: "asia" },
  { name: "台北", lon: 121.56, lat: 25.04, region: "asia" },
  { name: "シンガポール", lon: 103.85, lat: 1.29, region: "asia" },
  { name: "バンガロール", lon: 77.59, lat: 12.97, region: "asia" },
  { name: "ニューデリー", lon: 77.21, lat: 28.61, region: "asia" },
  { name: "サンフランシスコ", lon: -122.42, lat: 37.77, region: "us" },
  { name: "シアトル", lon: -122.33, lat: 47.61, region: "us" },
  { name: "ニューヨーク", lon: -74, lat: 40.71, region: "us" },
  { name: "ワシントン", lon: -77.04, lat: 38.9, region: "us" },
  { name: "ロサンゼルス", lon: -118.24, lat: 34.05, region: "us", detailOnly: true },
  { name: "サンディエゴ", lon: -117.16, lat: 32.72, region: "us", detailOnly: true },
  { name: "サンノゼ", lon: -121.89, lat: 37.34, region: "us", detailOnly: true },
  { name: "パロアルト", lon: -122.14, lat: 37.44, region: "us", detailOnly: true },
  { name: "マウンテンビュー", lon: -122.08, lat: 37.42, region: "us", detailOnly: true },
  { name: "サンタクララ", lon: -121.96, lat: 37.35, region: "us", detailOnly: true },
  { name: "クパチーノ", lon: -122.03, lat: 37.32, region: "us", detailOnly: true },
  { name: "レドモンド", lon: -122.12, lat: 47.67, region: "us", detailOnly: true },
  { name: "ポートランド", lon: -122.68, lat: 45.52, region: "us", detailOnly: true },
  { name: "ラスベガス", lon: -115.14, lat: 36.17, region: "us", detailOnly: true },
  { name: "フェニックス", lon: -112.07, lat: 33.45, region: "us", detailOnly: true },
  { name: "デンバー", lon: -104.99, lat: 39.74, region: "us", detailOnly: true },
  { name: "オースティン", lon: -97.74, lat: 30.27, region: "us", detailOnly: true },
  { name: "ダラス", lon: -96.8, lat: 32.78, region: "us", detailOnly: true },
  { name: "ヒューストン", lon: -95.37, lat: 29.76, region: "us", detailOnly: true },
  { name: "シカゴ", lon: -87.63, lat: 41.88, region: "us", detailOnly: true },
  { name: "デトロイト", lon: -83.05, lat: 42.33, region: "us", detailOnly: true },
  { name: "アトランタ", lon: -84.39, lat: 33.75, region: "us", detailOnly: true },
  { name: "マイアミ", lon: -80.19, lat: 25.76, region: "us", detailOnly: true },
  { name: "ボストン", lon: -71.06, lat: 42.36, region: "us", detailOnly: true },
  { name: "フィラデルフィア", lon: -75.17, lat: 39.95, region: "us", detailOnly: true },
  { name: "トロント", lon: -79.38, lat: 43.65, region: "us", detailOnly: true },
  { name: "モントリオール", lon: -73.57, lat: 45.5, region: "us", detailOnly: true },
  { name: "オタワ", lon: -75.7, lat: 45.42, region: "us", detailOnly: true },
  { name: "ロンドン", lon: -0.13, lat: 51.51, region: "europe" },
  { name: "パリ", lon: 2.35, lat: 48.86, region: "europe" },
  { name: "ベルリン", lon: 13.4, lat: 52.52, region: "europe" },
  { name: "アムステルダム", lon: 4.9, lat: 52.37, region: "europe" },
  { name: "ブリュッセル", lon: 4.35, lat: 50.85, region: "europe" },
  { name: "ケンブリッジ", lon: 0.12, lat: 52.2, region: "europe", detailOnly: true },
  { name: "オックスフォード", lon: -1.26, lat: 51.75, region: "europe", detailOnly: true },
  { name: "ダブリン", lon: -6.26, lat: 53.35, region: "europe", detailOnly: true },
  { name: "リヨン", lon: 4.84, lat: 45.76, region: "europe", detailOnly: true },
  { name: "ロッテルダム", lon: 4.48, lat: 51.92, region: "europe", detailOnly: true },
  { name: "ルクセンブルク", lon: 6.13, lat: 49.61, region: "europe", detailOnly: true },
  { name: "ミュンヘン", lon: 11.58, lat: 48.14, region: "europe", detailOnly: true },
  { name: "ハンブルク", lon: 9.99, lat: 53.55, region: "europe", detailOnly: true },
  { name: "フランクフルト", lon: 8.68, lat: 50.11, region: "europe", detailOnly: true },
  { name: "チューリッヒ", lon: 8.54, lat: 47.38, region: "europe", detailOnly: true },
  { name: "ジュネーブ", lon: 6.14, lat: 46.2, region: "europe", detailOnly: true },
  { name: "ウィーン", lon: 16.37, lat: 48.21, region: "europe", detailOnly: true },
  { name: "ストックホルム", lon: 18.07, lat: 59.33, region: "europe", detailOnly: true },
  { name: "ヘルシンキ", lon: 24.94, lat: 60.17, region: "europe", detailOnly: true },
  { name: "コペンハーゲン", lon: 12.57, lat: 55.68, region: "europe", detailOnly: true },
  { name: "オスロ", lon: 10.75, lat: 59.91, region: "europe", detailOnly: true },
  { name: "ワルシャワ", lon: 21.01, lat: 52.23, region: "europe", detailOnly: true },
  { name: "プラハ", lon: 14.42, lat: 50.08, region: "europe", detailOnly: true },
  { name: "マドリード", lon: -3.7, lat: 40.42, region: "europe", detailOnly: true },
  { name: "バルセロナ", lon: 2.17, lat: 41.38, region: "europe", detailOnly: true },
  { name: "ミラノ", lon: 9.19, lat: 45.46, region: "europe", detailOnly: true },
  { name: "ローマ", lon: 12.5, lat: 41.9, region: "europe", detailOnly: true },
  { name: "タリン", lon: 24.75, lat: 59.44, region: "europe", detailOnly: true },
  { name: "ヴィリニュス", lon: 25.28, lat: 54.69, region: "europe", detailOnly: true },
  { name: "キーウ", lon: 30.52, lat: 50.45, region: "europe", detailOnly: true },
  { name: "ブカレスト", lon: 26.1, lat: 44.43, region: "europe", detailOnly: true },
  { name: "アテネ", lon: 23.73, lat: 37.98, region: "europe", detailOnly: true },
  { name: "テルアビブ", lon: 34.78, lat: 32.08, region: "asia" },
  { name: "ドバイ", lon: 55.27, lat: 25.2, region: "asia" },
  { name: "シドニー", lon: 151.21, lat: -33.87, region: "asia" },
  { name: "深圳", lon: 114.06, lat: 22.54, region: "asia", detailOnly: true },
  { name: "広州", lon: 113.26, lat: 23.13, region: "asia", detailOnly: true },
  { name: "武漢", lon: 114.31, lat: 30.59, region: "asia", detailOnly: true },
  { name: "成都", lon: 104.07, lat: 30.57, region: "asia", detailOnly: true },
  { name: "重慶", lon: 106.55, lat: 29.56, region: "asia", detailOnly: true },
  { name: "西安", lon: 108.94, lat: 34.34, region: "asia", detailOnly: true },
  { name: "香港", lon: 114.17, lat: 22.32, region: "asia", detailOnly: true },
  { name: "新竹", lon: 120.99, lat: 24.78, region: "asia", detailOnly: true },
  { name: "高雄", lon: 120.3, lat: 22.63, region: "asia", detailOnly: true },
  { name: "クアラルンプール", lon: 101.69, lat: 3.14, region: "asia", detailOnly: true },
  { name: "バンコク", lon: 100.5, lat: 13.75, region: "asia", detailOnly: true },
  { name: "ホーチミン", lon: 106.63, lat: 10.82, region: "asia", detailOnly: true },
  { name: "ハノイ", lon: 105.83, lat: 21.03, region: "asia", detailOnly: true },
  { name: "ジャカルタ", lon: 106.85, lat: -6.21, region: "asia", detailOnly: true },
  { name: "マニラ", lon: 120.98, lat: 14.6, region: "asia", detailOnly: true },
  { name: "ハイデラバード", lon: 78.49, lat: 17.39, region: "asia", detailOnly: true },
  { name: "ムンバイ", lon: 72.88, lat: 19.08, region: "asia", detailOnly: true },
  { name: "チェンナイ", lon: 80.27, lat: 13.08, region: "asia", detailOnly: true },
  { name: "プネー", lon: 73.86, lat: 18.52, region: "asia", detailOnly: true },
  { name: "リヤド", lon: 46.68, lat: 24.71, region: "asia", detailOnly: true },
  { name: "アブダビ", lon: 54.37, lat: 24.45, region: "asia", detailOnly: true },
  { name: "メルボルン", lon: 144.96, lat: -37.81, region: "asia", detailOnly: true },
  { name: "札幌", lon: 141.35, lat: 43.06, region: "japan", detailOnly: true },
  { name: "旭川", lon: 142.36, lat: 43.77, region: "japan", detailOnly: true },
  { name: "函館", lon: 140.73, lat: 41.77, region: "japan", detailOnly: true },
  { name: "青森", lon: 140.74, lat: 40.82, region: "japan", detailOnly: true },
  { name: "盛岡", lon: 141.15, lat: 39.7, region: "japan", detailOnly: true },
  { name: "仙台", lon: 140.87, lat: 38.27, region: "japan", detailOnly: true },
  { name: "新潟", lon: 139.02, lat: 37.92, region: "japan", detailOnly: true },
  { name: "金沢", lon: 136.66, lat: 36.56, region: "japan", detailOnly: true },
  { name: "長野", lon: 138.18, lat: 36.65, region: "japan", detailOnly: true },
  { name: "横浜", lon: 139.64, lat: 35.44, region: "japan", detailOnly: true },
  { name: "静岡", lon: 138.38, lat: 34.98, region: "japan", detailOnly: true },
  { name: "名古屋", lon: 136.91, lat: 35.18, region: "japan", detailOnly: true },
  { name: "京都", lon: 135.77, lat: 35.01, region: "japan", detailOnly: true },
  { name: "神戸", lon: 135.19, lat: 34.69, region: "japan", detailOnly: true },
  { name: "広島", lon: 132.46, lat: 34.39, region: "japan", detailOnly: true },
  { name: "松山", lon: 132.77, lat: 33.84, region: "japan", detailOnly: true },
  { name: "福岡", lon: 130.4, lat: 33.59, region: "japan", detailOnly: true },
  { name: "長崎", lon: 129.87, lat: 32.75, region: "japan", detailOnly: true },
  { name: "鹿児島", lon: 130.56, lat: 31.6, region: "japan", detailOnly: true },
  { name: "那覇", lon: 127.68, lat: 26.21, region: "japan", detailOnly: true },
  { name: "平壌", lon: 125.76, lat: 39.04, region: "asia", context: ["japan"], detailOnly: true },
  { name: "仁川", lon: 126.71, lat: 37.46, region: "asia", context: ["japan"], detailOnly: true },
  { name: "水原", lon: 127.03, lat: 37.26, region: "asia", context: ["japan"], detailOnly: true },
  { name: "大田", lon: 127.38, lat: 36.35, region: "asia", context: ["japan"], detailOnly: true },
  { name: "大邱", lon: 128.6, lat: 35.87, region: "asia", context: ["japan"], detailOnly: true },
  { name: "釜山", lon: 129.08, lat: 35.18, region: "asia", context: ["japan"], detailOnly: true },
  { name: "光州", lon: 126.85, lat: 35.16, region: "asia", context: ["japan"], detailOnly: true },
  { name: "大連", lon: 121.62, lat: 38.91, region: "asia", context: ["japan"], detailOnly: true },
  { name: "瀋陽", lon: 123.43, lat: 41.8, region: "asia", context: ["japan"], detailOnly: true },
  { name: "長春", lon: 125.32, lat: 43.82, region: "asia", context: ["japan"], detailOnly: true },
  { name: "ハルビン", lon: 126.64, lat: 45.76, region: "asia", context: ["japan"], detailOnly: true },
  { name: "青島", lon: 120.38, lat: 36.07, region: "asia", context: ["japan"], detailOnly: true },
  { name: "南京", lon: 118.8, lat: 32.06, region: "asia", context: ["japan"], detailOnly: true },
  { name: "杭州", lon: 120.16, lat: 30.25, region: "asia", context: ["japan"], detailOnly: true }
];

const aiCompanyHqLabels = [
  { name: "OpenAI", placeJa: "サンフランシスコ", lon: -122.39, lat: 37.77, region: "us", categoryJa: "生成AI", url: "https://openai.com/" },
  { name: "Anthropic", placeJa: "サンフランシスコ", lon: -122.4, lat: 37.79, region: "us", categoryJa: "生成AI", url: "https://www.anthropic.com/" },
  { name: "NVIDIA", placeJa: "サンタクララ", lon: -121.96, lat: 37.37, region: "us", categoryJa: "AI半導体", url: "https://www.nvidia.com/" },
  { name: "Google DeepMind", placeJa: "ロンドン", lon: -0.13, lat: 51.52, region: "europe", categoryJa: "AI研究", url: "https://deepmind.google/" },
  { name: "Google", placeJa: "マウンテンビュー", lon: -122.08, lat: 37.42, region: "us", categoryJa: "AI基盤", url: "https://ai.google/" },
  { name: "Microsoft AI", placeJa: "レドモンド", lon: -122.12, lat: 47.67, region: "us", categoryJa: "AI基盤", url: "https://www.microsoft.com/ai" },
  { name: "Meta AI", placeJa: "メンローパーク", lon: -122.15, lat: 37.48, region: "us", categoryJa: "AI研究", url: "https://ai.meta.com/" },
  { name: "Amazon / AWS", placeJa: "シアトル", lon: -122.34, lat: 47.61, region: "us", categoryJa: "クラウドAI", url: "https://aws.amazon.com/ai/" },
  { name: "Apple ML", placeJa: "クパチーノ", lon: -122.03, lat: 37.33, region: "us", categoryJa: "オンデバイスAI", url: "https://machinelearning.apple.com/" },
  { name: "Perplexity", placeJa: "サンフランシスコ", lon: -122.42, lat: 37.78, region: "us", categoryJa: "AI検索", url: "https://www.perplexity.ai/" },
  { name: "Scale AI", placeJa: "サンフランシスコ", lon: -122.41, lat: 37.78, region: "us", categoryJa: "AIデータ", url: "https://scale.com/" },
  { name: "Hugging Face", placeJa: "ニューヨーク", lon: -74.01, lat: 40.71, region: "us", categoryJa: "AI OSS", url: "https://huggingface.co/" },
  { name: "Cohere", placeJa: "トロント", lon: -79.38, lat: 43.65, region: "us", categoryJa: "生成AI", url: "https://cohere.com/" },
  { name: "Mistral AI", placeJa: "パリ", lon: 2.35, lat: 48.86, region: "europe", categoryJa: "生成AI", url: "https://mistral.ai/" },
  { name: "Stability AI", placeJa: "ロンドン", lon: -0.1, lat: 51.5, region: "europe", categoryJa: "画像生成AI", url: "https://stability.ai/" },
  { name: "Aleph Alpha", placeJa: "ハイデルベルク", lon: 8.68, lat: 49.4, region: "europe", categoryJa: "生成AI", url: "https://aleph-alpha.com/" },
  { name: "ASML", placeJa: "フェルトホーフェン", lon: 5.4, lat: 51.42, region: "europe", categoryJa: "半導体装置", url: "https://www.asml.com/" },
  { name: "Baidu AI", placeJa: "北京", lon: 116.32, lat: 40.05, region: "asia", categoryJa: "生成AI", url: "https://www.baidu.com/" },
  { name: "Alibaba Cloud AI", placeJa: "杭州", lon: 120.16, lat: 30.25, region: "asia", categoryJa: "クラウドAI", url: "https://www.alibabacloud.com/" },
  { name: "Tencent AI", placeJa: "深圳", lon: 114.06, lat: 22.54, region: "asia", categoryJa: "AI基盤", url: "https://www.tencent.com/" },
  { name: "Huawei", placeJa: "深圳", lon: 114.07, lat: 22.66, region: "asia", categoryJa: "AI半導体/クラウド", url: "https://www.huawei.com/" },
  { name: "ByteDance", placeJa: "北京", lon: 116.41, lat: 39.91, region: "asia", categoryJa: "AIアプリ", url: "https://www.bytedance.com/" },
  { name: "TSMC", placeJa: "新竹", lon: 120.99, lat: 24.78, region: "asia", categoryJa: "AI半導体", url: "https://www.tsmc.com/" },
  { name: "Samsung AI", placeJa: "水原", lon: 127.03, lat: 37.26, region: "asia", categoryJa: "AI半導体", url: "https://www.samsung.com/" },
  { name: "SK hynix", placeJa: "利川", lon: 127.44, lat: 37.28, region: "asia", categoryJa: "AIメモリ", url: "https://www.skhynix.com/" },
  { name: "Sakana AI", placeJa: "東京", lon: 139.76, lat: 35.68, region: "japan", categoryJa: "生成AI研究", url: "https://sakana.ai/" },
  { name: "Preferred Networks", placeJa: "東京", lon: 139.76, lat: 35.68, region: "japan", categoryJa: "AI研究開発", url: "https://www.preferred.jp/" },
  { name: "SoftBank", placeJa: "東京", lon: 139.77, lat: 35.68, region: "japan", categoryJa: "AI投資/基盤", url: "https://www.softbank.jp/" },
  { name: "Sony AI", placeJa: "東京", lon: 139.75, lat: 35.63, region: "japan", categoryJa: "AI研究", url: "https://ai.sony/" },
  { name: "Rapidus", placeJa: "東京", lon: 139.76, lat: 35.67, region: "japan", categoryJa: "AI半導体", url: "https://www.rapidus.inc/" }
];

const autoCompanyHqLabels = [
  { name: "Toyota", placeJa: "豊田", lon: 137.16, lat: 35.08, region: "japan", categoryJa: "完成車 / HEV・EV", url: "https://global.toyota/" },
  { name: "Honda", placeJa: "東京", lon: 139.74, lat: 35.67, region: "japan", categoryJa: "完成車 / 二輪・EV", url: "https://global.honda/" },
  { name: "Nissan", placeJa: "横浜", lon: 139.65, lat: 35.46, region: "japan", categoryJa: "完成車 / EV", url: "https://www.nissan-global.com/" },
  { name: "Subaru", placeJa: "東京", lon: 139.74, lat: 35.66, region: "japan", categoryJa: "完成車", url: "https://www.subaru.co.jp/" },
  { name: "Mazda", placeJa: "広島", lon: 132.5, lat: 34.38, region: "japan", categoryJa: "完成車", url: "https://www.mazda.com/" },
  { name: "Suzuki", placeJa: "浜松", lon: 137.73, lat: 34.71, region: "japan", categoryJa: "小型車 / 二輪", url: "https://www.globalsuzuki.com/" },
  { name: "Mitsubishi Motors", placeJa: "東京", lon: 139.77, lat: 35.68, region: "japan", categoryJa: "完成車 / PHEV", url: "https://www.mitsubishi-motors.com/" },
  { name: "Tesla", placeJa: "オースティン", lon: -97.62, lat: 30.22, region: "us", categoryJa: "EV / 自動運転", url: "https://www.tesla.com/" },
  { name: "General Motors", placeJa: "デトロイト", lon: -83.04, lat: 42.33, region: "us", categoryJa: "完成車 / EV", url: "https://www.gm.com/" },
  { name: "Ford", placeJa: "ディアボーン", lon: -83.18, lat: 42.32, region: "us", categoryJa: "完成車 / 商用車", url: "https://www.ford.com/" },
  { name: "Rivian", placeJa: "アーバイン", lon: -117.84, lat: 33.68, region: "us", categoryJa: "EV / 商用EV", url: "https://rivian.com/" },
  { name: "Lucid", placeJa: "ニューアーク", lon: -122.04, lat: 37.53, region: "us", categoryJa: "高級EV", url: "https://lucidmotors.com/" },
  { name: "Volkswagen", placeJa: "ウォルフスブルク", lon: 10.79, lat: 52.42, region: "europe", categoryJa: "完成車 / EV", url: "https://www.volkswagen-group.com/" },
  { name: "BMW", placeJa: "ミュンヘン", lon: 11.56, lat: 48.18, region: "europe", categoryJa: "高級車 / EV", url: "https://www.bmwgroup.com/" },
  { name: "Mercedes-Benz", placeJa: "シュトゥットガルト", lon: 9.18, lat: 48.78, region: "europe", categoryJa: "高級車 / 商用車", url: "https://group.mercedes-benz.com/" },
  { name: "Stellantis", placeJa: "アムステルダム", lon: 4.89, lat: 52.37, region: "europe", categoryJa: "完成車グループ", url: "https://www.stellantis.com/" },
  { name: "Renault", placeJa: "ブローニュ＝ビヤンクール", lon: 2.24, lat: 48.83, region: "europe", categoryJa: "完成車 / EV", url: "https://www.renaultgroup.com/" },
  { name: "Volvo Cars", placeJa: "ヨーテボリ", lon: 11.97, lat: 57.71, region: "europe", categoryJa: "EV / 安全技術", url: "https://www.volvocars.com/" },
  { name: "BYD", placeJa: "深圳", lon: 114.06, lat: 22.55, region: "asia", categoryJa: "EV / 電池", url: "https://www.bydglobal.com/" },
  { name: "Hyundai", placeJa: "ソウル", lon: 127.04, lat: 37.49, region: "asia", categoryJa: "完成車 / EV", url: "https://www.hyundai.com/worldwide/" },
  { name: "Kia", placeJa: "ソウル", lon: 126.98, lat: 37.56, region: "asia", categoryJa: "完成車 / EV", url: "https://worldwide.kia.com/" },
  { name: "NIO", placeJa: "上海", lon: 121.47, lat: 31.23, region: "asia", categoryJa: "EV / バッテリースワップ", url: "https://www.nio.com/" },
  { name: "XPeng", placeJa: "広州", lon: 113.27, lat: 23.13, region: "asia", categoryJa: "EV / 自動運転", url: "https://www.xpeng.com/" },
  { name: "Geely", placeJa: "杭州", lon: 120.16, lat: 30.25, region: "asia", categoryJa: "完成車グループ", url: "https://global.geely.com/" },
  { name: "SAIC Motor", placeJa: "上海", lon: 121.47, lat: 31.22, region: "asia", categoryJa: "完成車 / EV", url: "https://www.saicmotor.com/" },
  { name: "Tata Motors", placeJa: "ムンバイ", lon: 72.88, lat: 19.08, region: "asia", categoryJa: "完成車 / 商用車", url: "https://www.tatamotors.com/" },
  { name: "Mahindra", placeJa: "ムンバイ", lon: 72.86, lat: 19.07, region: "asia", categoryJa: "SUV / 商用車", url: "https://www.mahindra.com/" }
];

const connectionGroups = {
  cyan: { labelJa: "シリコンバレー hub", color: "#66f0ff" },
  orange: { labelJa: "半導体サプライチェーン", color: "#ffad3d" },
  pink: { labelJa: "中国", color: "#ff62d4" },
  red: { labelJa: "日本", color: "#ff4f5f" },
  purple: { labelJa: "ヨーロッパ", color: "#a98cff" },
  yellow: { labelJa: "韓国", color: "#ffe56a" }
};

const connectionNodes = {
  OpenAI: { label: "OpenAI", lon: -122.39, lat: 37.77, region: "us" },
  Anthropic: { label: "Anthropic", lon: -122.4, lat: 37.79, region: "us" },
  NVIDIA: { label: "NVIDIA", lon: -121.96, lat: 37.37, region: "us" },
  Microsoft: { label: "Microsoft", lon: -122.12, lat: 47.67, region: "us" },
  "Meta AI": { label: "Meta AI", lon: -122.15, lat: 37.48, region: "us" },
  "Google DeepMind": { label: "Google DeepMind", lon: -122.08, lat: 37.42, region: "us" },
  "DeepMind London": { label: "DeepMind London", lon: -0.13, lat: 51.52, region: "europe" },
  "Mistral AI": { label: "Mistral AI", lon: 2.35, lat: 48.86, region: "europe" },
  ARM: { label: "ARM", lon: 0.12, lat: 52.2, region: "europe" },
  "SoftBank AI": { label: "SoftBank AI", lon: 139.77, lat: 35.68, region: "japan" },
  TSMC: { label: "TSMC", lon: 120.99, lat: 24.78, region: "asia" },
  "SK Hynix": { label: "SK Hynix", lon: 127.44, lat: 37.28, region: "asia" },
  Samsung: { label: "Samsung", lon: 127.03, lat: 37.26, region: "asia" },
  Alibaba: { label: "Alibaba", lon: 120.16, lat: 30.25, region: "asia" },
  Huawei: { label: "Huawei", lon: 114.07, lat: 22.66, region: "asia" },
  Baidu: { label: "Baidu", lon: 116.32, lat: 40.05, region: "asia" },
  DeepSeek: { label: "DeepSeek", lon: 120.16, lat: 30.25, region: "asia" }
};

const connectionLines = [
  { from: "OpenAI", to: "DeepMind London", meaning: "AI Research Corridor", group: "cyan", color: "#00d4ff", speed: 1.0 },
  { from: "OpenAI", to: "Microsoft", meaning: "Partnership (Azure提携)", group: "cyan", color: "#00d4ff", speed: 1.5 },
  { from: "OpenAI", to: "SoftBank AI", meaning: "Investment (出資)", group: "cyan", color: "#00d4ff", speed: 0.8 },
  { from: "Anthropic", to: "Google DeepMind", meaning: "競合・研究交流", group: "cyan", color: "#60a5fa", speed: 1.2 },
  { from: "Google DeepMind", to: "DeepMind London", meaning: "HQ ↔ Research (同一組織)", group: "cyan", color: "#34d399", speed: 1.8 },
  { from: "Meta AI", to: "DeepMind London", meaning: "AI研究競合", group: "cyan", color: "#818cf8", speed: 0.9 },
  { from: "NVIDIA", to: "TSMC", meaning: "Chip Supply Chain", group: "orange", color: "#f97316", speed: 0.7 },
  { from: "NVIDIA", to: "SK Hynix", meaning: "HBM Supply", group: "orange", color: "#f97316", speed: 0.7 },
  { from: "NVIDIA", to: "Samsung", meaning: "メモリ供給", group: "orange", color: "#fbbf24", speed: 0.6 },
  { from: "Alibaba", to: "TSMC", meaning: "チップ製造委託", group: "orange", color: "#f97316", speed: 0.6 },
  { from: "Huawei", to: "TSMC", meaning: "チップ製造委託", group: "orange", color: "#fb923c", speed: 0.5 },
  { from: "TSMC", to: "ARM", meaning: "製造ライセンス", group: "orange", color: "#f97316", speed: 0.8 },
  { from: "ARM", to: "NVIDIA", meaning: "Architecture License", group: "orange", color: "#f97316", speed: 0.9 },
  { from: "Baidu", to: "Google DeepMind", meaning: "Competition (競合)", group: "pink", color: "#f472b6", speed: 0.5 },
  { from: "DeepSeek", to: "OpenAI", meaning: "Rivalry / Distillation", group: "pink", color: "#f472b6", speed: 0.8 },
  { from: "SoftBank AI", to: "NVIDIA", meaning: "ARM × NVIDIA", group: "red", color: "#ff4444", speed: 1.0 },
  { from: "SoftBank AI", to: "OpenAI", meaning: "Stargate $500B", group: "red", color: "#ff4444", speed: 1.2 },
  { from: "Mistral AI", to: "DeepMind London", meaning: "EU AI エコシステム", group: "purple", color: "#a78bfa", speed: 1.1 },
  { from: "Samsung", to: "NVIDIA", meaning: "HBM メモリ供給", group: "yellow", color: "#fbbf24", speed: 0.7 },
  { from: "SK Hynix", to: "NVIDIA", meaning: "HBM3E 供給", group: "yellow", color: "#fde68a", speed: 0.7 }
];

const dom = {
  leadSignals: document.querySelector("#leadSignals"),
  tabs: document.querySelector("#tabs"),
  tickerContent: document.querySelector("#tickerContent"),
  spotlightTabs: document.querySelector("#spotlightTabs"),
  spotlightRegion: document.querySelector("#spotlightRegion"),
  timestamp: document.querySelector("#timestamp"),
  liveStatus: document.querySelector("#liveStatus"),
  alertStrip: document.querySelector("#alertStrip"),
  refreshButton: document.querySelector("#refreshButton"),
  contentButton: document.querySelector("#contentButton"),
  contentModal: document.querySelector("#contentModal"),
  contentCloseButton: document.querySelector("#contentCloseButton"),
  contentCopyButton: document.querySelector("#contentCopyButton"),
  contentDownloadButton: document.querySelector("#contentDownloadButton"),
  contentDownloadAllButton: document.querySelector("#contentDownloadAllButton"),
  contentTabs: document.querySelector("#contentTabs"),
  contentOutput: document.querySelector("#contentOutput"),
  contentStatus: document.querySelector("#contentStatus"),
  contentMeta: document.querySelector("#contentMeta"),
  contentTarget: document.querySelector("#contentTarget"),
  contentGeneratedAt: document.querySelector("#contentGeneratedAt"),
  contentSummaryStrip: document.querySelector("#contentSummaryStrip"),
  trendList: document.querySelector("#trendList"),
  macroGrid: document.querySelector("#macroGrid"),
  statusList: document.querySelector("#statusList"),
  articleList: document.querySelector("#articleList"),
  focusList: document.querySelector("#focusList"),
  spotlightList: document.querySelector("#spotlightList"),
  infraList: document.querySelector("#infraList"),
  feedTitle: document.querySelector("#feedTitle"),
  feedSubtitle: document.querySelector("#feedSubtitle"),
  feedCount: document.querySelector("#feedCount"),
  feedSubtabs: document.querySelector("#feedSubtabs"),
  mapSubtitle: document.querySelector("#mapSubtitle"),
  mapCanvas: document.querySelector("#mapCanvas"),
  mapModeSwitch: document.querySelector("#mapModeSwitch"),
  mapTileLayer: document.querySelector("#mapTileLayer"),
  globeLayer: document.querySelector("#globeLayer"),
  globeCanvas: document.querySelector("#globeCanvas"),
  globeOverlay: document.querySelector("#globeOverlay"),
  worldMap: document.querySelector("#worldMap"),
  mapTooltip: document.querySelector("#mapTooltip"),
  layerPanel: document.querySelector("#layerPanel"),
  regionBadge: document.querySelector("#regionBadge"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  zoomResetButton: document.querySelector("#zoomResetButton")
};

document.addEventListener("DOMContentLoaded", () => {
  initDockDragSort();
  initTabs();
  initMapControls();
  initMapModeSwitch();
  dom.refreshButton.addEventListener("click", () => loadDashboard(true));
  dom.contentButton?.addEventListener("click", handleContentGenerate);
  dom.contentCloseButton?.addEventListener("click", closeContentModal);
  dom.contentCopyButton?.addEventListener("click", copyContentOutput);
  dom.contentDownloadButton?.addEventListener("click", () => downloadContentPack(false));
  dom.contentDownloadAllButton?.addEventListener("click", () => downloadContentPack(true));
  dom.contentModal?.querySelector("[data-content-close]")?.addEventListener("click", closeContentModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dom.contentModal?.classList.contains("hidden")) closeContentModal();
  });
  loadDashboard(false);
  setInterval(() => {
    if (document.hidden) return;
    loadDashboard(false);
  }, dashboardRefreshIntervalMs);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (Date.now() - state.lastDashboardLoadAt > visibleRefreshStaleMs) loadDashboard(false);
  });
});

function initTabs() {
  dom.tabs.innerHTML = orderedRegionEntries()
    .map(([key, item]) => {
      return `<button class="tab-button ${key === state.activeRegion ? "active" : ""}" type="button" data-region="${key}">
        <strong>${item.labelJa}</strong>
        <span>${item.labelEn}</span>
      </button>`;
    })
    .join("");

  dom.tabs.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", async () => {
      state.activeRegion = button.dataset.region;
      state.activeFeedTab = "ai";
      dom.tabs.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      renderFeed();
      renderSpotlight();
      renderInfrastructure();
      renderLayerPanel();
      state.mapTransform = d3.zoomIdentity;
      const requestedRegion = state.activeRegion;
      await renderMap();
      if (state.activeRegion === requestedRegion) {
        window.setTimeout(() => zoomToActiveRegion(), 40);
      }
    });
  });
  enableDragSort(dom.tabs, ".tab-button", storageKeys.regionTabs, (button) => button.dataset.region);
}

function initMapControls() {
  dom.zoomInButton?.addEventListener("click", () => zoomMapBy(2.2));
  dom.zoomOutButton?.addEventListener("click", () => zoomMapBy(1 / 2.2));
  dom.zoomResetButton?.addEventListener("click", resetMapZoom);
}

function initMapModeSwitch() {
  updateMapModeButtons();
  dom.mapModeSwitch?.querySelectorAll("[data-map-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mapMode === "3d" ? "3d" : "2d";
      if (state.mapMode === mode) return;
      state.mapMode = mode;
      saveMapMode();
      state.mapTransform = window.d3 ? d3.zoomIdentity : null;
      updateMapModeButtons();
      renderMap();
    });
  });
}

function updateMapModeButtons() {
  dom.mapModeSwitch?.querySelectorAll("[data-map-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mapMode === state.mapMode);
  });
}

async function loadDashboard(refresh) {
  if (state.isLoadingDashboard) return;
  state.isLoadingDashboard = true;
  dom.refreshButton.disabled = true;
  dom.refreshButton.classList.add("loading");
  setLiveStatus("loading", "更新中");

  try {
    const response = await fetch(`/api/monitor${refresh ? "?refresh=1" : ""}`, {
      cache: "no-store",
      headers: { "X-World-Monitor-Request": "1" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    state.lastDashboardLoadAt = Date.now();
    renderAll();
  } catch (error) {
    setLiveStatus("fallback", "取得失敗");
    dom.articleList.innerHTML = `<div class="empty-state">データ取得に失敗しました: ${escapeHtml(error.message)}</div>`;
  } finally {
    dom.refreshButton.disabled = false;
    dom.refreshButton.classList.remove("loading");
    state.isLoadingDashboard = false;
    if (window.lucide) window.lucide.createIcons();
  }
}

function renderAll() {
  const data = state.data;
  const generated = new Date(data.generatedAt);
  dom.timestamp.textContent = `最終更新 ${formatDateTime(generated)}`;
  setLiveStatus(data.live ? "live" : "fallback", data.live ? "Live" : "Fallback");
  renderTicker();
  renderAlerts();
  renderLayerPanel();
  renderLeadSignals();
  renderSpotlight();
  renderInfrastructure();
  renderTrends();
  renderMacro();
  renderStatuses();
  renderFeed();
  renderFocus();
  renderMap();
  if (window.lucide) window.lucide.createIcons();
}

function setLiveStatus(mode, label) {
  dom.liveStatus.className = `status-pill ${mode}`;
  dom.liveStatus.innerHTML = `<span class="dot"></span><span>${label}</span>`;
}

function renderTicker() {
  if (!dom.tickerContent) return;
  const items = (state.data?.articles || [])
    .filter(isAiTechArticle)
    .slice(0, 22)
    .map((article) => `${article.titleJa || article.title}${article.score ? ` (${article.score})` : ""}`);

  if (!items.length) {
    dom.tickerContent.textContent = "AIシグナル取得中...";
    return;
  }

  const text = items.map(escapeHtml).join("   ///   ");
  dom.tickerContent.innerHTML = `${text}&nbsp;&nbsp;&nbsp;${text}`;
}

function renderAlerts() {
  if (!dom.alertStrip) return;
  const alerts = getActiveAlerts();
  const topics = (state.alertConfig?.topics || []).map(topicLabel).slice(0, 4).join(" / ");

  if (!state.alertConfig?.enabled) {
    dom.alertStrip.innerHTML = `<div class="alert-strip-inner muted">
      <span><i data-lucide="bell-off"></i> 緊急アラート停止中</span>
      <button class="alert-mini-button" type="button" data-alert-enable>ON</button>
    </div>`;
    dom.alertStrip.querySelector("[data-alert-enable]")?.addEventListener("click", () => {
      state.alertConfig.enabled = true;
      saveAlertConfig();
      renderAlerts();
      renderLayerPanel();
      renderMap();
      if (window.lucide) window.lucide.createIcons();
    });
    return;
  }

  if (!alerts.length) {
    dom.alertStrip.innerHTML = `<div class="alert-strip-inner watch">
      <span><i data-lucide="bell"></i> 緊急監視中</span>
      <b>${escapeHtml(topics || "全トピック")}</b>
      <em>しきい値 ${state.alertConfig.threshold}</em>
    </div>`;
    return;
  }

  const top = alerts[0];
  dom.alertStrip.innerHTML = `<a class="alert-strip-inner active" href="${safeExternalHref(top.url)}" target="_blank" rel="noreferrer">
    <span><i data-lucide="siren"></i> 緊急 ${alerts.length}件</span>
    <b>${escapeHtml(top.titleJa || top.title)}</b>
    <em>${escapeHtml(regionMeta[top.region]?.labelJa || "世界")} / ${escapeHtml(top.source || "News")} / ${Math.round(top.urgency || 0)}</em>
  </a>`;
}

function getActiveAlerts() {
  const config = state.alertConfig || defaultAlertConfig;
  if (!config.enabled || !state.data?.articles?.length) return [];
  const selected = new Set(config.topics || []);
  const threshold = Number(config.threshold || defaultAlertConfig.threshold);

  return uniqueContentArticles(state.data.articles)
    .map((article) => ({ ...article, urgency: alertUrgency(article, selected) }))
    .filter((article) => {
      if (isLowEditorialValueArticle(article)) return false;
      const topics = articleAlertTopicKeys(article);
      const topicMatch = !selected.size || topics.some((topic) => selected.has(topic));
      return topicMatch && article.urgency >= threshold;
    })
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 8);
}

function alertUrgency(article, selectedTopics = new Set()) {
  const published = new Date(article.publishedAt).getTime();
  if (!Number.isFinite(published)) return 0;
  const ageHours = Math.max(0, (Date.now() - published) / 3600000);
  if (ageHours > 48) return 0;
  const title = `${article.title || ""} ${article.titleJa || ""}`;
  const event = /\b(outage|breach|cyberattack|ransomware|invasion|missile|earthquake|emergency|sanctions|banned|suspends|crash|plunges)\b|export (ban|restrictions)|緊急|重大障害|サービス停止|大規模障害|情報漏[え洩]い|サイバー攻撃|侵攻|ミサイル|制裁|輸出規制|暴落|急落|急騰|利上げ|利下げ|戦闘|停電/i.test(title);
  if (!event) return 0;
  const freshness = Math.max(0, 24 - ageHours * 0.7);
  const topics = articleAlertTopicKeys(article);
  const topicHits = topics.filter((topic) => selectedTopics.has(topic)).length;
  const prominence = Math.min(22, Math.log1p(Math.max(0, Number(article.score || 0))) * 4);
  const speculation = /\b(could|might|rumou?r|opinion)\b|可能性|懸念|予測|見通し|解説/i.test(title) ? 25 : 0;
  return Math.round(clamp(40 + freshness + prominence + Math.min(8, topicHits * 4) - speculation, 0, 99));
}

function renderLeadSignals() {
  const signals = leadSignalsForDisplay();
  dom.leadSignals.innerHTML = signals
    .map((signal) => {
      const tags = (signal.topics || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
      return `<article class="signal-card">
        <div>
          <div class="signal-meta">
            <span>${escapeHtml(signal.labelJa)}</span>
            <span>${signal.live ? "Live" : "Fallback"}</span>
          </div>
          <a href="${safeExternalHref(signal.url)}" target="_blank" rel="noreferrer">
            <h2>${escapeHtml(signal.titleJa)}</h2>
          </a>
        </div>
        <div>
          <div class="tag-row">${tags}</div>
          <div class="signal-meta">${escapeHtml(signal.source || "Source unavailable")}</div>
        </div>
      </article>`;
    })
    .join("");
}

function leadSignalsForDisplay() {
  const existing = state.data?.trends?.leadSignals || [];
  const worldSignals = worldEconomyArticles()
    .slice(0, 3)
    .map((article) => ({
      labelJa: "世界情勢・経済",
      live: true,
      url: article.url,
      titleJa: article.titleJa || article.title,
      source: `${regionMeta[article.region]?.labelJa || "世界"} / ${article.source || article.domain || "News"} / 重要度 ${article.worldEconomyScore || ""}`,
      topics: worldEconomyTopicLabels(article).slice(0, 3)
    }));
  const seen = new Set();
  return [...worldSignals, ...existing]
    .filter((signal) => {
      const key = normalizeOneLine(signal.url || signal.titleJa || "").toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function renderSpotlight() {
  if (!dom.spotlightList) return;
  const repos = state.data?.githubTrending || [];
  const articles = spotlightTabArticles();
  const active = spotlightTabs.find((tab) => tab.key === state.activeSpotlightTab) || spotlightTabs[0];
  if (dom.spotlightRegion) dom.spotlightRegion.textContent = regionMeta[state.activeRegion]?.labelJa || "世界";
  renderSpotlightTabs();

  if (state.activeSpotlightTab === "github") {
    dom.spotlightList.innerHTML = repos.length
      ? repos
          .slice(0, 14)
          .map((repo) => repoTemplate(repo))
          .join("")
      : `<div class="empty-state">GitHubトレンド取得中</div>`;
    dom.spotlightList.scrollTop = 0;
    return;
  }

  const repoItems = state.activeSpotlightTab === "hot" ? repos.slice(0, 2).map(repoTemplate) : [];
  const articleItems = articles.slice(0, Math.max(4, 12 - repoItems.length)).map((article, index) => {
    const tags = (article.topics || []).slice(0, 2).map((topic) => `<span class="tag">${escapeHtml(topicLabel(topic))}</span>`).join("");
    const source = article.source || "News";
    return `<a class="spotlight-card ${index === 0 ? "top" : "ai"}" style="--accent:${escapeAttr(active.color)}" href="${safeExternalHref(article.url)}" target="_blank" rel="noreferrer">
      <div class="spotlight-card-meta">
        <span>${escapeHtml(source)}</span>
        <span>${escapeHtml(formatRelative(article.publishedAt))}</span>
      </div>
      <strong>${escapeHtml(article.titleJa || article.title)}</strong>
      <div class="tag-row">${tags}</div>
    </a>`;
  });

  const items = [...repoItems, ...articleItems];
  dom.spotlightList.innerHTML = items.length ? items.join("") : `<div class="empty-state">該当シグナルなし</div>`;
  dom.spotlightList.scrollTop = 0;
}

function repoTemplate(repo) {
    const stars = repo.stars >= 1000 ? `${(repo.stars / 1000).toFixed(1)}k` : String(repo.stars || 0);
    return `<a class="spotlight-item repo" href="${safeExternalHref(repo.url)}" target="_blank" rel="noreferrer">
      <div>
        <strong>${escapeHtml(repo.fullName || repo.name)}</strong>
        <span>${escapeHtml(repo.language || "GitHub")} / ${stars} stars</span>
      </div>
      <span class="spotlight-badge">OSS</span>
    </a>`;
}

function renderSpotlightTabs() {
  if (!dom.spotlightTabs) return;
  const tabCounts = spotlightTabs.reduce((acc, tab) => {
    if (tab.key === "github") acc[tab.key] = state.data?.githubTrending?.length || 0;
    else acc[tab.key] = spotlightTabArticles(tab.key).length;
    return acc;
  }, {});

  dom.spotlightTabs.innerHTML = orderedByStorage(spotlightTabs, storageKeys.spotlightTabs)
    .map((tab) => {
      const active = state.activeSpotlightTab === tab.key;
      return `<button class="spotlight-tab ${active ? "active" : ""}" style="--tab-color:${escapeAttr(tab.color)}" type="button" data-spotlight="${escapeAttr(tab.key)}">
        ${escapeHtml(tab.label)}<span>${tabCounts[tab.key] || 0}</span>
      </button>`;
    })
    .join("");

  dom.spotlightTabs.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeSpotlightTab = button.dataset.spotlight || "hot";
      renderSpotlight();
    });
  });
  enableDragSort(dom.spotlightTabs, ".spotlight-tab", storageKeys.spotlightTabs, (button) => button.dataset.spotlight);
}

function spotlightTabArticles(tabKey = state.activeSpotlightTab) {
  const regionArticles = state.activeRegion === "world" ? state.data?.articles || [] : (state.data?.articles || []).filter((article) => article.region === state.activeRegion || (state.activeRegion === "asia" && article.region === "japan"));
  const sorted = [...regionArticles].sort((a, b) => (b.score || 0) - (a.score || 0));
  switch (tabKey) {
    case "research":
      return sorted.filter((article) => textMatches(article, ["research", "paper", "benchmark", "model", "研究", "論文", "ベンチマーク"]));
    case "funding":
      return sorted.filter((article) => article.topics?.includes("funding") || textMatches(article, ["funding", "investment", "ipo", "acquisition", "投資", "資金調達", "買収", "出資"]));
    case "policy":
      return sorted.filter((article) => article.topics?.includes("policy") || article.topics?.includes("security") || textMatches(article, ["policy", "regulation", "law", "security", "規制", "政策", "安全", "セキュリティ"]));
    case "models":
      return sorted.filter((article) => article.topics?.includes("models") || article.topics?.includes("chips") || article.topics?.includes("cloud") || textMatches(article, ["llm", "gpu", "model", "生成ai", "半導体", "クラウド"]));
    case "automotive":
      return sorted.filter((article) => article.topics?.includes("automotive") || textMatches(article, ["automotive", "automaker", "vehicle", "electric vehicle", "ev", "autonomous driving", "self-driving", "自動車", "自動車産業", "自動車業界", "電気自動車", "自動運転", "車載", "トヨタ", "ホンダ", "日産", "テスラ", "byd", "volkswagen"]));
    case "japan":
      return sorted.filter((article) => article.region === "japan" || textMatches(article, ["japan", "tokyo", "softbank", "sony", "日本", "東京"]));
    case "hot":
    default:
      return sorted.filter(isAiTechArticle);
  }
}

function textMatches(article, words) {
  const text = `${article.title || ""} ${article.titleJa || ""} ${article.signalJa || ""} ${article.source || ""}`.toLowerCase();
  return words.some((word) => /^[a-z0-9 -]+$/i.test(word)
    ? new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}([^a-z0-9]|$)`, "i").test(text)
    : text.includes(String(word).toLowerCase()));
}

function renderInfrastructure() {
  if (!dom.infraList) return;
  const labs = LEGACY_AI_LABS.filter(visibleForActiveRegion);
  const dataCenters = LEGACY_DATA_CENTERS.filter(visibleForActiveRegion);
  const training = dataCenters.filter((item) => item.aiTraining);
  const construction = dataCenters.filter((item) => item.status !== "operational");
  const featured = [...training, ...construction]
    .filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, 4);

  const stats = `<div class="infra-stats">
    <div><strong>${labs.length}</strong><span>AI拠点</span></div>
    <div><strong>${dataCenters.length}</strong><span>DC</span></div>
    <div><strong>${training.length}</strong><span>学習</span></div>
  </div>`;

  const rows = featured.map((item) => ({ ...item, sortKey: `dc:${item.id || item.name}` })).map((item) => {
    return `<article class="infra-item sortable-item" data-item-key="${escapeAttr(item.sortKey)}">
      <div class="infra-dot" style="background:${escapeAttr(LEGACY_DC_COLORS[item.company] || LEGACY_DC_COLORS.other)}"></div>
      <div>
        <strong>${escapeHtml(item.nameJa || item.name)}</strong>
        <span>${escapeHtml(dcCompanyLabel(item.company))} / ${escapeHtml(statusJa(item.status))}${item.capacity ? ` / ${escapeHtml(item.capacity)}` : ""}</span>
      </div>
    </article>`;
  });

  const labRows = labs
    .filter((item) => item.tier === 1)
    .slice(0, Math.max(0, 5 - rows.length))
    .map((item) => ({ ...item, sortKey: `lab:${item.id || item.name}` }))
    .map((item) => {
      return `<article class="infra-item sortable-item" data-item-key="${escapeAttr(item.sortKey)}">
        <div class="infra-dot lab" style="background:${escapeAttr(LEGACY_LAB_COLORS[item.type] || "#66f0ff")}"></div>
        <div>
          <strong>${escapeHtml(item.nameJa || item.name)}</strong>
          <span>${escapeHtml(labTypeLabel(item.type))} / ${escapeHtml(item.cityJa || item.country)}</span>
        </div>
      </article>`;
    });

  dom.infraList.innerHTML = `${stats}${orderHtmlByStorage([...rows, ...labRows], storageKeys.infraItems).join("")}`;
  enableListItemSort(dom.infraList, ".infra-item", storageKeys.infraItems);
}

function renderTrends() {
  const trends = orderedByStorage(state.data?.trends?.topics || [], storageKeys.trendItems);
  if (!trends.length) {
    dom.trendList.innerHTML = `<div class="empty-state">トレンド集計待ち</div>`;
    return;
  }
  dom.trendList.innerHTML = trends
    .map((trend) => {
      return `<div class="trend-item sortable-item" data-item-key="${escapeAttr(trend.key || trend.labelJa)}">
        <div>
          <strong>${escapeHtml(trend.labelJa)}</strong>
          <span>${escapeHtml(trend.labelEn)}</span>
        </div>
        <div class="trend-count">${trend.count}</div>
      </div>`;
    })
    .join("");
  enableListItemSort(dom.trendList, ".trend-item", storageKeys.trendItems);
}

function renderMacro() {
  const available = (state.data?.macro || []).filter((item) => item.status === "ok" && Number.isFinite(Number(item.value)));
  const macro = orderedByStorage(available, storageKeys.macroItems, macroItemKey);
  if (!macro.length) {
    dom.macroGrid.innerHTML = `<div class="empty-state">市場データ待ち</div>`;
    return;
  }

  dom.macroGrid.innerHTML = macro
    .slice(0, 6)
    .map((item) => {
      const value = formatMacroValue(item);
      const change = typeof item.change === "number" ? item.change : null;
      const cls = change === null ? "" : change >= 0 ? "up" : "down";
      return `<div class="macro-item sortable-item" data-item-key="${escapeAttr(macroItemKey(item))}">
        <div class="macro-source">${escapeHtml(item.source || "API")} / ${escapeHtml(item.labelEn || item.seriesId || "")}</div>
        <strong>${escapeHtml(item.labelJa || item.seriesId || "Market")}</strong>
        <div class="macro-value">${escapeHtml(value)}</div>
        <div class="macro-source">
          ${change === null ? escapeHtml(item.noteJa || item.date || "") : `<span class="macro-change ${cls}">${change >= 0 ? "+" : ""}${change.toFixed(2)}%</span>`}
          ${item.date ? `<span class="macro-date"> ${escapeHtml(item.date)}</span>` : ""}
        </div>
      </div>`;
    })
    .join("");
  enableListItemSort(dom.macroGrid, ".macro-item", storageKeys.macroItems);
}

function renderStatuses() {
  const statuses = orderedByStorage(state.data?.statusPages || [], storageKeys.statusItems, (service) => service.name);
  if (!statuses.length) {
    dom.statusList.innerHTML = `<div class="empty-state">ステータス取得待ち</div>`;
    return;
  }
  dom.statusList.innerHTML = statuses
    .map((service) => {
      const indicator = service.indicator || "unknown";
      return `<div class="status-item sortable-item" data-item-key="${escapeAttr(service.name)}">
        <div>
          <div class="status-name">${escapeHtml(service.name)}</div>
          <div class="status-desc">${escapeHtml(localizeStatus(service.description))}</div>
        </div>
        <div class="status-badge ${escapeAttr(indicator)}">${escapeHtml(indicator)}</div>
      </div>`;
    })
    .join("");
  enableListItemSort(dom.statusList, ".status-item", storageKeys.statusItems);
}

function renderFeed() {
  if (!state.data) return;
  const meta = regionMeta[state.activeRegion];
  const articles = filteredArticles();
  const regionArticles = articlesForActiveRegion();
  renderFeedSubtabs(regionArticles);
  dom.feedTitle.textContent = meta.labelJa;
  dom.feedSubtitle.textContent = meta.labelEn;
  dom.feedCount.textContent = `${articles.length}件`;
  dom.mapSubtitle.textContent = `${meta.labelJa}のAI・テック・自動車・リスクヒートマップ`;
  if (dom.regionBadge) dom.regionBadge.textContent = `${meta.labelJa} / ${meta.labelEn}`;

  if (!articles.length) {
    dom.articleList.innerHTML = `<div class="empty-state">この地域のシグナルはまだありません</div>`;
    dom.articleList.scrollTop = 0;
    return;
  }

  dom.articleList.innerHTML = articles
    .slice(0, 22)
    .map((article) => articleTemplate(article))
    .join("");
  dom.articleList.scrollTop = 0;
}

function renderFeedSubtabs(regionArticles) {
  if (!dom.feedSubtabs) return;
  const counts = {
    ai: regionArticles.filter(isAiTechArticle).length,
    auto: regionArticles.filter((article) => article.topics?.includes("automotive")).length,
    all: regionArticles.length,
    rss: regionArticles.filter((article) => article.source !== "Hacker News" && article.source !== "Dev.to").length,
    hn: regionArticles.filter((article) => article.source === "Hacker News").length,
    devto: regionArticles.filter((article) => article.source === "Dev.to").length
  };

  dom.feedSubtabs.innerHTML = orderedByStorage(feedTabs, storageKeys.feedTabs)
    .map((tab) => `<button class="feed-subtab ${state.activeFeedTab === tab.key ? "active" : ""}" type="button" data-feed-tab="${escapeAttr(tab.key)}">
      ${escapeHtml(tab.label)}<span>${counts[tab.key] || 0}</span>
    </button>`)
    .join("");

  dom.feedSubtabs.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeFeedTab = button.dataset.feedTab || "ai";
      renderFeed();
    });
  });
  enableDragSort(dom.feedSubtabs, ".feed-subtab", storageKeys.feedTabs, (button) => button.dataset.feedTab);
}

function orderedRegionEntries() {
  return orderedByStorage(
    Object.entries(regionMeta).map(([key, value]) => ({ key, value })),
    storageKeys.regionTabs
  ).map((item) => [item.key, item.value]);
}

function orderedByStorage(items, storageKey, getKey = (item) => item.key) {
  const saved = readSavedOrder(storageKey);
  if (!saved.length) return [...items];
  const byKey = new Map(items.map((item) => [getKey(item), item]));
  const ordered = saved.map((key) => byKey.get(key)).filter(Boolean);
  const missing = items.filter((item) => !saved.includes(getKey(item)));
  return [...ordered, ...missing];
}

function orderHtmlByStorage(htmlItems, storageKey) {
  const saved = readSavedOrder(storageKey);
  if (!saved.length) return [...htmlItems];
  const keyOf = (html) => {
    const match = String(html).match(/\sdata-item-key="([^"]+)"/);
    return match ? decodeHtmlAttr(match[1]) : "";
  };
  const byKey = new Map(htmlItems.map((html) => [keyOf(html), html]));
  const ordered = saved.map((key) => byKey.get(key)).filter(Boolean);
  const missing = htmlItems.filter((html) => !saved.includes(keyOf(html)));
  return [...ordered, ...missing];
}

function loadLayerState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKeys.mapLayers) || "{}");
    const merged = { ...defaultLayerState, ...(saved && typeof saved === "object" ? saved : {}) };
    lowPowerStartupOffLayers.forEach((key) => {
      merged[key] = false;
    });
    return merged;
  } catch {
    return { ...defaultLayerState };
  }
}

function saveLayerState() {
  try {
    localStorage.setItem(storageKeys.mapLayers, JSON.stringify(state.layers));
  } catch {
    // Layer choice is still applied in-memory when storage is unavailable.
  }
}

function loadMapMode() {
  try {
    localStorage.setItem(storageKeys.mapMode, "2d");
  } catch {
    // Default to 2D even when storage is unavailable.
  }
  return "2d";
}

function saveMapMode() {
  try {
    localStorage.setItem(storageKeys.mapMode, state.mapMode);
  } catch {
    // Map mode remains active for the current session.
  }
}

function loadAlertConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKeys.alerts) || "{}");
    const savedTopics = Array.isArray(saved?.topics) ? saved.topics.filter((topic) => alertTopics.some((item) => item.key === topic)) : defaultAlertConfig.topics;
    const topics = saved?.automotiveAlertMigrated || savedTopics.includes("automotive") ? savedTopics : [...savedTopics, "automotive"];
    return {
      ...defaultAlertConfig,
      ...(saved && typeof saved === "object" ? saved : {}),
      topics: topics.length ? topics : defaultAlertConfig.topics,
      automotiveAlertMigrated: true,
      threshold: Number(saved?.threshold) || defaultAlertConfig.threshold,
      enabled: saved?.enabled !== false
    };
  } catch {
    return { ...defaultAlertConfig };
  }
}

function saveAlertConfig() {
  try {
    localStorage.setItem(storageKeys.alerts, JSON.stringify(state.alertConfig));
  } catch {
    // Alert settings remain active for the current session.
  }
}

function macroItemKey(item) {
  return String(item?.seriesId || item?.labelEn || item?.labelJa || item?.source || "macro");
}

function articleItemKey(article) {
  return String(article?.id || article?.url || article?.titleJa || article?.title || "article");
}

function decodeHtmlAttr(value = "") {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function readSavedOrder(storageKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

function saveOrder(storageKey, keys) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(keys.filter(Boolean)));
  } catch {
    // Ignore storage failures; drag sorting still works for the current view.
  }
}

function enableDragSort(container, selector, storageKey, getKey) {
  if (!container) return;
  let dragged = null;
  container.querySelectorAll(selector).forEach((button) => {
    button.draggable = false;
    button.classList.add("draggable-tab");
    button.addEventListener("dragstart", (event) => {
      dragged = button;
      button.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", getKey(button) || "");
    });
    button.addEventListener("dragover", (event) => {
      if (!dragged || dragged === button) return;
      event.preventDefault();
      const rect = button.getBoundingClientRect();
      const before = event.clientX < rect.left + rect.width / 2;
      container.insertBefore(dragged, before ? button : button.nextSibling);
    });
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      persistDragOrder(container, selector, storageKey, getKey);
    });
    button.addEventListener("dragend", () => {
      button.classList.remove("dragging");
      dragged = null;
      persistDragOrder(container, selector, storageKey, getKey);
    });
  });
  enablePointerDragSort(container, selector, storageKey, getKey);
}

function persistDragOrder(container, selector, storageKey, getKey) {
  const order = [...container.querySelectorAll(selector)].map((item) => getKey(item)).filter(Boolean);
  saveOrder(storageKey, order);
}

function enableListItemSort(container, selector, storageKey) {
  if (!container) return;
  container.classList.add("sortable-list");
  enablePointerDragSort(container, selector, storageKey, (item) => item.dataset.itemKey);
}

function enablePointerDragSort(container, selector, storageKey, getKey) {
  container.querySelectorAll(selector).forEach((item) => {
    if (item.dataset.pointerSortEnabled === "1") return;
    item.dataset.pointerSortEnabled = "1";
    let pointer = null;

    item.addEventListener("click", (event) => {
      if (item.dataset.justDragged === "1") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    item.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      item.dataset.pointerSorting = "1";
      pointer = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false
      };
      item.setPointerCapture?.(event.pointerId);
    });

    item.addEventListener("pointermove", (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
      if (!pointer.dragging && distance < 7) return;
      pointer.dragging = true;
      event.preventDefault();
      item.classList.add("dragging");
      moveDragItem(container, selector, item, event.clientX, event.clientY);
    });

    const finish = (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      item.releasePointerCapture?.(event.pointerId);
      if (pointer.dragging) {
        item.dataset.justDragged = "1";
        window.setTimeout(() => {
          delete item.dataset.justDragged;
        }, 120);
        persistDragOrder(container, selector, storageKey, getKey);
      }
      item.classList.remove("dragging");
      delete item.dataset.pointerSorting;
      pointer = null;
    };

    item.addEventListener("pointerup", finish);
    item.addEventListener("pointercancel", finish);
  });
  enableMouseDragSort(container, selector, storageKey, getKey);
}

function moveDragItem(container, selector, dragged, clientX, clientY) {
  const siblings = [...container.querySelectorAll(selector)].filter((item) => item !== dragged);
  const target = siblings.find((item) => {
    const rect = item.getBoundingClientRect();
    const inRow = clientY >= rect.top - 8 && clientY <= rect.bottom + 8;
    if (inRow) return clientX < rect.left + rect.width / 2;
    return clientY < rect.top + rect.height / 2;
  });
  if (target) container.insertBefore(dragged, target);
  else container.appendChild(dragged);
}

function enableMouseDragSort(container, selector, storageKey, getKey) {
  container.querySelectorAll(selector).forEach((item) => {
    if (item.dataset.mouseSortEnabled === "1") return;
    item.dataset.mouseSortEnabled = "1";

    item.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      const start = {
        x: event.clientX,
        y: event.clientY,
        dragging: false
      };

      const onMove = (moveEvent) => {
        const distance = Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y);
        if (!start.dragging && distance < 7) return;
        start.dragging = true;
        moveEvent.preventDefault();
        item.classList.add("dragging");
        moveDragItem(container, selector, item, moveEvent.clientX, moveEvent.clientY);
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        if (start.dragging) {
          item.dataset.justDragged = "1";
          window.setTimeout(() => {
            delete item.dataset.justDragged;
          }, 120);
          persistDragOrder(container, selector, storageKey, getKey);
        }
        item.classList.remove("dragging");
      };

      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
    });
  });
}

function initDockDragSort() {
  const dock = document.querySelector(".trend-dock");
  if (!dock) return;
  const saved = readSavedOrder(storageKeys.dockPanels);
  if (saved.length) {
    const panels = new Map([...dock.querySelectorAll(".trend-card-block[data-dock]")].map((panel) => [panel.dataset.dock, panel]));
    saved.forEach((key) => {
      const panel = panels.get(key);
      if (panel) dock.appendChild(panel);
    });
  }

  let draggedPanel = null;
  dock.querySelectorAll(".trend-card-block[data-dock]").forEach((panel) => {
    const handle = panel.querySelector(".panel-header");
    if (!handle) return;
    handle.draggable = false;
    handle.title = "ドラッグして並び替え";
    handle.addEventListener("dragstart", (event) => {
      draggedPanel = panel;
      panel.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", panel.dataset.dock || "");
    });
    panel.addEventListener("dragover", (event) => {
      if (!draggedPanel || draggedPanel === panel) return;
      event.preventDefault();
      const rect = panel.getBoundingClientRect();
      const before = event.clientX < rect.left + rect.width / 2;
      dock.insertBefore(draggedPanel, before ? panel : panel.nextSibling);
    });
    handle.addEventListener("dragend", () => {
      panel.classList.remove("dragging");
      draggedPanel = null;
      saveDockPanelOrder();
    });
    panel.addEventListener("drop", (event) => {
      event.preventDefault();
      saveDockPanelOrder();
    });
    enablePanelPointerDragSort(dock, panel, handle);
  });
}

function saveDockPanelOrder() {
  const dock = document.querySelector(".trend-dock");
  if (!dock) return;
  saveOrder(storageKeys.dockPanels, [...dock.querySelectorAll(".trend-card-block[data-dock]")].map((panel) => panel.dataset.dock));
}

function enablePanelPointerDragSort(dock, panel, handle) {
  if (handle.dataset.pointerSortEnabled === "1") return;
  handle.dataset.pointerSortEnabled = "1";
  let pointer = null;

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    handle.dataset.pointerSorting = "1";
    pointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false
    };
    handle.setPointerCapture?.(event.pointerId);
  });

  handle.addEventListener("pointermove", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
    if (!pointer.dragging && distance < 7) return;
    pointer.dragging = true;
    event.preventDefault();
    panel.classList.add("dragging");
    moveDragItem(dock, ".trend-card-block[data-dock]", panel, event.clientX, event.clientY);
  });

  const finish = (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    handle.releasePointerCapture?.(event.pointerId);
    if (pointer.dragging) saveDockPanelOrder();
    panel.classList.remove("dragging");
    delete handle.dataset.pointerSorting;
    pointer = null;
  };

  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
  enablePanelMouseDragSort(dock, panel, handle);
}

function enablePanelMouseDragSort(dock, panel, handle) {
  if (handle.dataset.mouseSortEnabled === "1") return;
  handle.dataset.mouseSortEnabled = "1";

  handle.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    const start = {
      x: event.clientX,
      y: event.clientY,
      dragging: false
    };

    const onMove = (moveEvent) => {
      const distance = Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y);
      if (!start.dragging && distance < 7) return;
      start.dragging = true;
      moveEvent.preventDefault();
      panel.classList.add("dragging");
      moveDragItem(dock, ".trend-card-block[data-dock]", panel, moveEvent.clientX, moveEvent.clientY);
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseup", onUp, true);
      if (start.dragging) saveDockPanelOrder();
      panel.classList.remove("dragging");
    };

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseup", onUp, true);
  });
}

async function handleContentGenerate() {
  if (!dom.contentButton) return;
  dom.contentButton.disabled = true;
  dom.contentButton.innerHTML = `<i data-lucide="loader-circle"></i><span>生成中</span>`;
  setContentStatus("最新シグナルを収集中...");
  if (window.lucide) window.lucide.createIcons();

  try {
    await loadDashboard(true);
    state.contentPack = buildContentPack();
    state.activeContentTab = "summary";
    renderContentPackModal();
    openContentModal();
    setContentStatus("生成完了。コピーまたはMarkdown保存可。");
  } catch (error) {
    setContentStatus(`生成失敗: ${error.message}`);
  } finally {
    dom.contentButton.disabled = false;
    dom.contentButton.innerHTML = `<i data-lucide="wand-sparkles"></i><span>コンテンツ生成</span>`;
    if (window.lucide) window.lucide.createIcons();
  }
}

function buildContentPack() {
  const now = new Date();
  const meta = regionMeta[state.activeRegion] || regionMeta.world;
  const regionalArticles = articlesForActiveRegion();
  const sourceArticles = state.activeFeedTab === "ai" ? regionalArticles.filter(isAiTechArticle)
    : state.activeFeedTab === "auto" ? regionalArticles.filter((article) => article.topics?.includes("automotive")) : regionalArticles;
  const scoredArticles = uniqueContentArticles(sourceArticles)
    .map((article) => ({ ...article, contentScore: contentImportanceScore(article) }))
    .sort((a, b) => b.contentScore - a.contentScore);
  const editorialArticles = scoredArticles.filter((article) => !isLowEditorialValueArticle(article));
  const topArticles = (editorialArticles.length >= 4 ? editorialArticles : scoredArticles).slice(0, 8);
  const trends = (state.data?.trends?.topics || []).slice(0, 7);
  const macro = (state.data?.macro || [])
    .filter((item) => item.status !== "needs_key" && item.status !== "error")
    .slice(0, 6);
  const lead = topArticles[0] || null;
  const topicLabels = topContentTopics(topArticles);
  const pack = {
    generatedAt: now,
    regionKey: state.activeRegion,
    regionJa: meta.labelJa,
    regionEn: meta.labelEn,
    lead,
    topArticles,
    trends,
    macro,
    topicLabels,
    alerts: getActiveAlerts()
  };

  const outputs = {
    summary: composeSummary(pack),
    x: composeXPost(pack),
    note: composeNotePost(pack),
    podcast: composePodcastScript(pack),
    sources: composeSources(pack)
  };

  return {
    ...pack,
    outputs,
    allMarkdown: composeAllContent({ ...pack, outputs })
  };
}

function uniqueContentArticles(articles = []) {
  const seen = new Set();
  return articles.filter((article) => {
    const key = normalizeOneLine(article.url || article.titleJa || article.title || article.id).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isLowEditorialValueArticle(article) {
  const title = normalizeOneLine(`${article.titleJa || ""} ${article.title || ""}`);
  const source = normalizeOneLine(article.source || article.domain || "");
  const quotePattern = /(基準価格|投資信託情報|株価・チャート|株価情報|銘柄情報|掲示板|Yahoo!ファイナンス|stock quote|fund price|quote page|market summary)/i;
  const fundPattern = /(eMAXIS|投資信託|ETF|インデックス【|index fund)/i;
  const passiveFundNewsPattern = /(純資産総額|グローバルアセットマネジメント|ファンド.*純資産|ファンド.*突破)/i;
  const liveMarketPattern = /(stock market today|dow jones|nasdaq live|market live|live\s*:|futures (rise|fall|edge)|株式市場ライブ|マーケットライブ)/i;
  const consumerHardwarePattern = /(macbook|surface laptop|laptop ultra|iphone|android phone|gaming laptop|gaming pc|windowslatest|windows pc|windows pcs|pc rival|consumer pc)/i;
  return quotePattern.test(title)
    || passiveFundNewsPattern.test(title)
    || liveMarketPattern.test(title)
    || consumerHardwarePattern.test(`${source} ${title}`)
    || (fundPattern.test(title) && /finance|ファイナンス|quote|market/i.test(`${source} ${title}`));
}

function contentImportanceScore(article) {
  const base = Number(article.score || 0);
  const published = new Date(article.publishedAt || Date.now()).getTime();
  const ageHours = Number.isFinite(published) ? Math.max(0, (Date.now() - published) / 3600000) : 36;
  const freshness = Math.max(0, 54 - ageHours * 1.55);
  const topicPriority = {
    models: 28,
    chips: 28,
    "data-centers": 26,
    security: 22,
    policy: 20,
    funding: 20,
    automotive: 18,
    cloud: 16,
    robotics: 12,
    quantum: 12
  };
  const topics = article.topics || [];
  const topicWeight = topics.reduce((sum, topic) => sum + (topicPriority[topic] || 8), 0);
  const activeRegionWeight = article.region === state.activeRegion ? 28 : state.activeRegion === "world" ? 4 : 8;
  const asiaJapanWeight = article.region === "japan" ? 32 : article.region === "asia" ? 24 : 0;
  const sourceWeight = article.source === "Hacker News" ? Math.min(30, Math.log1p(base) * 5.8) : article.source === "Dev.to" ? 0 : 18;
  const commentsWeight = Math.min(18, Math.log1p(Number(article.comments || 0)) * 4.4);
  const title = normalizeOneLine(`${article.titleJa || ""} ${article.title || ""} ${article.signalJa || ""}`).toLowerCase();
  const urgentKeywords = ["urgent", "alert", "outage", "ban", "export", "security", "funding", "investment", "nvidia", "tsmc", "openai", "tesla", "toyota", "byd", "生成ai", "半導体", "gpu", "電力", "データセンター", "規制", "投資", "資金調達", "障害", "サイバー", "自動車", "ev", "電気自動車", "自動運転", "車載半導体", "バッテリー"];
  const urgencyWeight = urgentKeywords.some((keyword) => title.includes(keyword)) ? 24 : 0;
  const genericPenalty = normalizeOneLine(article.titleJa || article.title).length < 16 ? 18 : 0;
  const consumerPenalty = /(macbook|surface laptop|laptop ultra|iphone|android phone|gaming laptop|gaming pc|windowslatest|windows pc|windows pcs|consumer pc|pc rival)/i.test(title) ? 70 : 0;
  const liveMarketPenalty = /(stock market today|dow jones|nasdaq live|market live|futures (rise|fall|edge))/i.test(title) ? 70 : 0;
  const lowEditorialPenalty = isLowEditorialValueArticle(article) ? 90 : 0;
  const tutorialPenalty = /\b(tutorial|how to|guide|rag vs|fine-tuning.*which)\b|入門|チュートリアル|心得/i.test(title) ? 28 : 0;
  return Math.round(base * 0.38 + freshness + topicWeight + activeRegionWeight + asiaJapanWeight + sourceWeight + commentsWeight + urgencyWeight - genericPenalty - consumerPenalty - liveMarketPenalty - lowEditorialPenalty - tutorialPenalty);
}

function topContentTopics(articles = []) {
  const counts = new Map();
  articles.forEach((article) => {
    (article.topics || []).forEach((topic) => {
      const label = topicLabel(topic);
      counts.set(label, (counts.get(label) || 0) + 1);
    });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label)
    .slice(0, 5);
}

function composeSummary(pack) {
  if (!pack.topArticles.length) {
    return `# World Monitor 要約\n\n対象: ${pack.regionJa} / ${pack.regionEn}\n生成: ${formatDateTime(pack.generatedAt)}\n\n現在、要約に使える記事がない。更新後にもう一度生成。`;
  }

  const leadTitle = normalizeOneLine(pack.lead.titleJa || pack.lead.title);
  const trendLine = pack.topicLabels.length ? pack.topicLabels.join("、") : "AI / Tech";
  const macroLines = pack.macro.map(macroSummaryLine).filter(Boolean);
  const articleLines = pack.topArticles.slice(0, 6).map((article, index) => articleInsightLine(article, index));
  const alertLine = pack.alerts?.length ? `緊急アラートは${pack.alerts.length}件。最上位は「${normalizeOneLine(pack.alerts[0].titleJa || pack.alerts[0].title)}」。` : "緊急アラート水準の記事は現時点で少ない。";

  return `# World Monitor 重要シグナル要約

対象: ${pack.regionJa} / ${pack.regionEn}
生成: ${formatDateTime(pack.generatedAt)}

## 結論
- 最重要トピックは「${leadTitle}」だ。
- 関連テーマは ${trendLine}。AI基盤、半導体、クラウド、電力・データセンターの接続を優先して見る局面だ。
- ${alertLine}
- 日本・アジア関連は、供給網・投資・AI実装の観点で継続監視が必要だ。

## 重要項目
${articleLines.join("\n")}

## 市場・電力の補助シグナル
${macroLines.length ? macroLines.map((line) => `- ${line}`).join("\n") : "- 市場・電力データは取得待ち。"}

## 今日の使い方
- Xでは「速報性」と「なぜ重要か」を短く出す。
- noteでは背景、影響、日本・アジアへの含意を整理する。
- Podcastでは、最重要ニュースから始めて市場・電力データで文脈を補強する。`;
}

function composeXPost(pack) {
  if (!pack.topArticles.length) return "投稿材料がまだない。更新後にもう一度生成。";
  const lead = pack.lead;
  const leadTitle = normalizeOneLine(lead.titleJa || lead.title);
  const themes = pack.topicLabels.slice(0, 3).join(" / ") || "AI / Tech";
  const second = pack.topArticles[1];
  const third = pack.topArticles[2];

  return `【今日のAI/Tech重要シグナル】

${pack.regionJa}: ${leadTitle}

重要なのは、単発ニュースではなく「${themes}」が同時に動いている点。AIモデル、半導体、クラウド、電力の制約がつながって見える。

注目:
1. ${leadTitle}
${second ? `2. ${normalizeOneLine(second.titleJa || second.title)}` : ""}
${third ? `3. ${normalizeOneLine(third.titleJa || third.title)}` : ""}

出典: ${lead.source || lead.domain || "World Monitor"}
${safeExternalUrl(lead.url)}

#生成AI #半導体 #AIニュース

---

スレッド案:

1/5
今日のAI/Techで最も重要なのは「${leadTitle}」。${pack.regionJa}のシグナルとして、AIインフラと事業戦略の両方に影響する。

2/5
背景テーマは ${themes}。ニュースを個別に見るより、モデル開発、GPU/半導体、クラウド、電力需要の連鎖として見ると意味が出る。

3/5
${second ? normalizeOneLine(second.signalJa || second.titleJa || second.title) : "関連ニュースはまだ追加取得中。"}

4/5
市場補助シグナル: ${pack.macro.slice(0, 3).map(macroSummaryLine).filter(Boolean).join(" / ") || "取得待ち"}。

5/5
日本・アジアでは、供給網、AI投資、データセンター、電力制約をセットで監視。World Monitorではこの接続を継続的に追う。`;
}

// トピック別の分析文（テンプレでもニュースの中身に応じた解説になるよう、キーごとに用意）
const CONTENT_TOPIC_INSIGHTS = {
  models: "生成AIモデルの進化は、推論需要とアプリ実装の裾野を一気に広げる。性能の高さそのものより、どのコストで、どの業務に入り込むかが競争の焦点になりつつある。",
  chips: "半導体・GPUは依然としてAI競争の最大のボトルネックだ。先端プロセス、HBM、パッケージングの供給力が、そのまま各社の成長の上限を決めている。",
  "data-centers": "データセンターと電力は、AIスケールの物理的な制約だ。用地、送電網、冷却、電力契約のどれかが詰まれば、計算資源の実効的な天井になる。",
  cloud: "クラウド基盤は、AI需要を収益へ変える土台だ。誰のインフラの上で推論が走るかが、長期の顧客の囲い込みを左右する。",
  security: "サイバーセキュリティは、AI普及の裏で攻撃面を広げる。新しい脆弱性と、攻める側・守る側の非対称性が、企業にも国家にも重くのしかかる。",
  policy: "規制と政策は、技術より遅れて、しかし決定的に効いてくる。輸出規制や法整備の一手が、市場の地図そのものを書き換える。",
  funding: "投資・資金調達の動きは、次の主役がどこに張られているかを映す。資金が集まる領域は、半年後のニュースの中心になりやすい。",
  geopolitics: "地政学リスクは、供給網・エネルギー・市場のすべてに波及する。紛争や制裁、政権の判断ひとつが、半導体やエネルギーの価格と調達を揺らす。",
  economy: "マクロ経済の方向性は、金利・為替・景気を通じて投資マネーの流れを決める。中央銀行の判断が、テック株とリスク資産の温度を変える。",
  markets: "市場の値動きは、ニュースに対する投資家の解釈を映す温度計だ。株価・為替・原油の反応をセットで見ると、シグナルの強さが読み取れる。",
  energy: "エネルギーと資源は、AIインフラと地政学が交差する場所にある。原油・天然ガス・電力・レアアースの確保が、そのまま産業競争力を左右する。",
  automotive: "自動車産業は、EV、電池、車載半導体、自動運転、ソフトウェア定義車両が重なる巨大な再編領域だ。完成車メーカーだけでなく、電池・半導体・クラウドまで含めて見る必要がある。",
  robotics: "ロボティクスと自動化は、AIを物理世界に接続する次の一段だ。労働力と製造の構造を、中期的に塗り替えていく。",
  quantum: "量子技術は時間軸の長いテーマだが、暗号と計算の前提を変えうる。研究投資の進み方を、静かに追っておきたい領域だ。"
};

const CONTENT_TOPIC_WATCHPOINTS = {
  models: "モデル発表は性能指標だけでなく、推論単価、企業導入、API利用量の変化まで見る。",
  chips: "GPU、HBM、先端パッケージング、TSMC/Samsung/Intelの供給計画を追う。",
  "data-centers": "データセンターの新設計画、電力契約、送電網、冷却技術の制約を確認する。",
  cloud: "クラウド各社のAI売上、GPU在庫、主要顧客の囲い込みを比べる。",
  security: "AIを使った攻撃、クラウド障害、重要インフラへの侵害を優先監視する。",
  policy: "輸出規制、AI規制、政府調達、制裁の更新を時系列で追う。",
  funding: "大型出資と提携の相手先を見て、次に資本が集中する領域を読む。",
  geopolitics: "紛争、制裁、関税、選挙が供給網とエネルギー価格へ与える影響を見る。",
  economy: "金利、為替、景気指標の変化がテック投資へ与える圧力を確認する。",
  markets: "S&P 500、NASDAQ、TOPIX、ドル円、原油の反応でニュースの重さを測る。",
  energy: "電力価格、天然ガス、原油、原子力、再エネ接続の制約を追う。",
  automotive: "EV販売、電池調達、車載半導体、自動運転、関税・補助金、主要メーカーの投資計画を地域別に追う。",
  robotics: "現場導入、労働代替、製造ラインへの実装速度を見る。",
  quantum: "研究発表より、暗号・材料・計算基盤への実装距離を確認する。"
};

function contentTopicKeys(article) {
  return [...new Set([...(article.topics || []), ...worldEconomyTopicKeys(article)])];
}

function dominantContentTopics(articles, limit = 3) {
  const counts = new Map();
  articles.forEach((article) => contentTopicKeys(article).forEach((topic) => counts.set(topic, (counts.get(topic) || 0) + 1)));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key).slice(0, limit);
}

function articleWhyItMatters(article) {
  const insight = contentTopicKeys(article).map((key) => CONTENT_TOPIC_INSIGHTS[key]).find(Boolean);
  return insight || "AIとテックの競争構造に影響しうるシグナルとして、継続的に監視する価値がある。";
}

function articleTagLabels(article) {
  return contentTopicKeys(article).slice(0, 3).map(topicLabel).join(" / ");
}

const CONTENT_TITLE_REPLACEMENTS = [
  ["artificial intelligence", "人工知能"],
  ["generative ai", "生成AI"],
  ["large language model", "大規模言語モデル"],
  ["machine learning", "機械学習"],
  ["semiconductor", "半導体"],
  ["semiconductors", "半導体"],
  ["data center", "データセンター"],
  ["data centers", "データセンター"],
  ["cybersecurity", "サイバーセキュリティ"],
  ["security", "セキュリティ"],
  ["background ai agent", "バックグラウンドAIエージェント"],
  ["c2 server", "C2サーバー"],
  ["agent", "エージェント"],
  ["server", "サーバー"],
  ["healthcare", "ヘルスケア"],
  ["kiosks", "キオスク"],
  ["kiosk", "キオスク"],
  ["to bring", "展開へ"],
  ["cloud", "クラウド"],
  ["chip", "チップ"],
  ["chips", "チップ"],
  ["gpu", "GPU"],
  ["model", "モデル"],
  ["models", "モデル"],
  ["launches", "発表"],
  ["launch", "発表"],
  ["announces", "発表"],
  ["announce", "発表"],
  ["builds", "構築"],
  ["expands", "拡大"],
  ["raises", "資金調達"],
  ["investment", "投資"],
  ["funding", "資金調達"],
  ["partnership", "提携"],
  ["partners with", "提携"],
  ["acquisition", "買収"],
  ["acquires", "買収"],
  ["export controls", "輸出規制"],
  ["supply chain", "供給網"],
  ["power", "電力"],
  ["electricity", "電力"],
  ["energy", "エネルギー"],
  ["market", "市場"],
  ["markets", "市場"],
  ["stocks", "株式"],
  ["stock", "株式"],
  ["economy", "経済"],
  ["policy", "政策"],
  ["regulation", "規制"],
  ["rival", "対抗軸"],
  ["powered", "搭載"],
  ["with", "による"],
  ["for", "向け"],
  ["at", "で"]
];

function isGenericContentTitle(title = "") {
  const text = normalizeOneLine(title);
  return /^(世界|アメリカ|ヨーロッパ|アジア|日本|中国|韓国|台湾|インド|英国|ドイツ|フランス|シンガポール|マレーシア|オーストラリア)の.+ニュース$/.test(text)
    || /ライブデータ接続待ち/.test(text);
}

function isEnglishHeavyContentTitle(title = "") {
  const text = normalizeOneLine(title);
  const letters = text.match(/[A-Za-z]/g)?.length || 0;
  const visible = text.replace(/\s/g, "").length || 1;
  return letters / visible > 0.38;
}

function humanizeMixedTitle(title = "") {
  let text = normalizeOneLine(title);
  if (!text) return "";
  if (/^when your background ai agent becomes a c2 server$/i.test(text)) {
    return "バックグラウンドAIエージェントがC2サーバー化するリスク";
  }
  const mixedHealthcareRaise = text.match(/^(.+?)\s+資金調達\s+(.+?)\s+to bring\s+AI\s*-\s*搭載\s+(.+)$/i);
  if (mixedHealthcareRaise) {
    return `${mixedHealthcareRaise[1].trim()}、${mixedHealthcareRaise[2].trim()}を調達しAI搭載${humanizeMixedTitle(mixedHealthcareRaise[3])}を展開`;
  }
  const aiHealthcareRaise = text.match(/^(.+?)\s+raises\s+(.+?)\s+to bring\s+AI-powered\s+(.+)$/i);
  if (aiHealthcareRaise) {
    return `${aiHealthcareRaise[1].trim()}、${aiHealthcareRaise[2].trim()}を調達しAI搭載${humanizeMixedTitle(aiHealthcareRaise[3])}を展開`;
  }
  const laptopMatch = text.match(/^(.*?)\s+builds\s+(?:its\s+)?(?:ultimate\s+)?(.+?)\s+rival\s+with\s+(?:the\s+)?(.+?)-powered\s+(.+)$/i);
  if (laptopMatch) {
    const maker = laptopMatch[1].trim();
    const target = laptopMatch[2].trim();
    const chip = laptopMatch[3].trim().replace(/nvidia/i, "NVIDIA");
    const product = laptopMatch[4].trim();
    return `${maker}、${chip}搭載${product}で${target}対抗機を構築`;
  }
  CONTENT_TITLE_REPLACEMENTS.forEach(([from, to]) => {
    text = text.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, "gi"), to);
  });
  return text
    .replace(/\bthe\s+/gi, "")
    .replace(/\bits\s+ultimate\s+/gi, "")
    .replace(/Nvidia/gi, "NVIDIA")
    .replace(/AI\s*-\s*搭載/gi, "AI搭載")
    .replace(/NVIDIA[-\s]+搭載/gi, "NVIDIA搭載")
    .replace(/\s+による\s+/g, "で")
    .replace(/\s+対抗軸/g, "対抗機")
    .replace(/\s+-\s+[^-]{2,28}$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function contentArticleTitle(article, max = 72) {
  const titleJa = normalizeOneLine(article.titleJa || "");
  const original = normalizeOneLine(article.title || "");
  const readable = titleJa && !isGenericContentTitle(titleJa) && !isEnglishHeavyContentTitle(titleJa)
    ? titleJa
    : humanizeMixedTitle(original || titleJa) || titleJa;
  return clipText(readable, max);
}

function contentArticleSignal(article) {
  return normalizeOneLine(article.signalJa || "");
}

function contentArticleMeta(article) {
  const region = regionMeta[article.region]?.labelJa || "世界";
  const source = article.source || article.domain || "Source";
  const tags = articleTagLabels(article);
  return `${region} / ${source} / ${formatRelative(article.publishedAt)}${tags ? ` / ${tags}` : ""}`;
}

function contentTrendLine(pack) {
  return (pack.trends || [])
    .slice(0, 4)
    .map((trend) => {
      const label = trend.labelJa || trend.label || trend.key || "";
      const count = Number.isFinite(Number(trend.count)) ? ` ${trend.count}` : "";
      return `${label}${count}`;
    })
    .filter(Boolean)
    .join(" / ");
}

function contentWatchPoints(topicKeys) {
  const lines = topicKeys
    .map((key) => CONTENT_TOPIC_WATCHPOINTS[key])
    .filter(Boolean)
    .slice(0, 3);
  const fallback = [
    "大型提携や出資の相手先を確認し、資本の流れを読む。",
    "半導体、電力、データセンターの制約がニュースの裏側にないかを見る。",
    "日本・アジア企業への波及を、供給網と市場反応の両面から追う。"
  ];
  return (lines.length ? lines : fallback).map((line) => `- ${line}`).join("\n");
}

function composeNotePost(pack) {
  if (!pack.topArticles.length) return "# 今日のAI/Techメモ\n\n投稿材料がまだない。更新後にもう一度生成。";
  const leadTitle = contentArticleTitle(pack.lead, 72);
  const topics = dominantContentTopics(pack.topArticles, 2);
  const themes = topics.map(topicLabel).join("と") || "AIとテック";
  const picks = pack.topArticles.slice(0, 2);
  const facts = picks.map((article, index) => `### ${index + 1}. ${contentArticleTitle(article, 80)}\n\n${article.source || article.domain || "出典"}が${formatDateTime(article.publishedAt)}に掲載した見出しだ。対象は${regionMeta[article.region]?.labelJa || "世界"}、論点は${articleTagLabels(article) || themes}となる。見出しだけでは契約条件や実施時期までは確定できないため、発表と実行を分けて読む必要がある。`).join("\n\n");
  const asia = pack.topArticles.find((article) => ["japan", "asia"].includes(article.region) && isAiTechArticle(article));
  const asiaLine = asia
    ? `日本・アジアでは「${contentArticleTitle(asia, 64)}」にも注目したい。国内企業への影響を読む際は、海外の発表をそのまま成長予測に置き換えず、調達先、投資額、稼働時期を確かめることが重要だ。`
    : "日本・アジアへの影響は、半導体の調達、電力契約、設備投資という具体的な経路から検討したい。今回の取得範囲には直接の裏付けが少なく、国内への波及を断定することはできない。";
  const insight = topics.map((key) => CONTENT_TOPIC_INSIGHTS[key]).find(Boolean) || articleWhyItMatters(pack.lead);
  const macro = pack.macro.slice(0, 2).map(macroSummaryLine).filter(Boolean).join("、");
  const sources = picks
    .map((article, index) => `${index + 1}. [${article.source || article.domain || "記事"}：${contentArticleTitle(article, 32)}](${safeMarkdownUrl(article.url) || "#"})`)
    .join("\n");

  return `# ${pack.regionJa}のAI・テックを読む：${clipText(leadTitle, 42)}

${formatDateTime(pack.generatedAt)}

今回の取得記事から、${themes}に関わる二つの動きを取り上げる。中心となるのは「${leadTitle}」だ。話題の大きさと事業への影響は同じではない。何が報じられたのか、何がまだ分からないのかを分けると、ニュースの見方は変わる。

## 報じられた動き

${facts}

## ここからどう読むか

以下は見出しに基づく分析だ。${insight}ただし、今回の記事だけで需要の拡大や企業の優位を証明できるわけではない。発表の規模より、実際の供給能力、顧客への導入、継続的な収益につながる条件を見たい。

${asiaLine}

## 次に確かめること

${contentWatchPoints(topics)}

${macro ? `市場の補助情報は${macro}となる。` : "市場の補助情報は取得待ちだ。"}指標の観測日と記事の掲載日は一致するとは限らず、値動きだけでニュースとの因果関係を結びつけるべきではない。

ニュースを追う価値は、勝者を急いで決めることにはない。次の発表でどの仮説を確かめるかを持ち、事実の更新に合わせて見方を変えることにある。

## 出典

${sources}

*公開見出しから作成した下書きだ。本文全体の検証は含まない。*`;
}

function composePodcastScript(pack) {
  if (!pack.topArticles.length) return "Podcast台本の材料がまだない。更新後にもう一度生成。";
  const lead = pack.lead;
  const leadTitle = contentArticleTitle(lead, 90);
  const leadSignal = normalizeOneLine(lead.signalJa || "");
  const picks = pack.topArticles.slice(0, 3);
  const domTopics = dominantContentTopics(pack.topArticles, 4);
  const themes = domTopics.map(topicLabel).join("、") || "AIとテック";
  const trendLine = contentTrendLine(pack);
  const macroLine = pack.macro.slice(0, 4).map(macroSummaryLine).filter(Boolean).join("。");
  const alertLine = pack.alerts?.length ? `加えて、緊急度の高いシグナルとして「${normalizeOneLine(pack.alerts[0].titleJa || pack.alerts[0].title)}」が浮上している。短期の注意点はここだ。` : "現時点で最上位の緊急アラートは限定的だ。";
  const ordinals = ["一本目", "二本目", "三本目", "四本目"];

  const segments = picks
    .map((article, index) => {
      const title = contentArticleTitle(article, 62);
      const signal = contentArticleSignal(article);
      const region = regionMeta[article.region]?.labelJa || "世界";
      const ordinal = ordinals[index] || `${index + 1}本目`;
      return `【${ordinal}】
${region}から「${title}」。出典は${article.source || article.domain || "公開ニュース"}、掲載は${formatDateTime(article.publishedAt)}だ。${signal ? signal + " " : ""}ここからは分析になる。${articleWhyItMatters(article)}ただし、発表がそのまま事業の成果になるとは限らない。投資の決定、設備の稼働、サービスの利用を区別して、次に確認すべき数字を探したい。`;
    })
    .join("\n\n");

  return `# Podcast台本 - World Monitor Daily

想定尺：約5分／ナレーション：一人語り（常体）／［ ］内はディレクション指示

──────────────────────────────

［BGM：イントロ、5秒。低めの電子音。フェードアウト］

【0:00 オープニング】
World Monitor Daily。世界のAI、テック、経済、地政学を、地図とニュースの接続から読み解く。きょうの対象は${pack.regionJa}だ。結論から言うと、最も重要なシグナルは「${leadTitle}」。${leadSignal ? leadSignal + " " : ""}この一本だけを見るのではなく、その背後にある${themes}の動きまで広げて見る。

【0:35 今日の見取り図】
きょうのニュースは、点ではなく線で見る必要がある。モデル、半導体、クラウド、データセンター、電力、そして資本提携。このどこか一つが詰まると、AIの成長速度そのものが落ちる。${alertLine}${trendLine ? `ダッシュボード上のトレンドでは ${trendLine} が上位に来ている。` : ""}ここから、重要ニュースを順に見ていく。

──────────────────────────────

【1:10 本編：重要ニュース】

${segments}

──────────────────────────────

【3:35 市場と緊急度】
ここで、市場と電力の補助線を見る。${macroLine || "主要指標はまだ取得待ちだ"}。注意したいのは観測日の違いだ。ニュースの掲載日と市場データの日付が一致するとは限らない。株価や為替の動きだけで、今回の記事が原因だと結論づけることはできない。ニュースは仮説を立てる材料、市場データはその後の変化を追う材料として分けて扱う。

【4:20 日本・アジアの視点】
最後に、日本とアジアの視点を置く。海外のAIニュースは遠い話に見えるが、実際には半導体、HBM、製造委託、データセンター、電力調達を通じて日本企業にも直結する。だから見るべきは、派手なAIサービスの発表だけではない。計算資源をどこから確保するか。電力をどう手当てするか。誰と資本提携するか。この三つが、次の競争力を決める。

【4:55 クロージング】
きょうのまとめだ。一つ目、最重要シグナルは「${clipText(leadTitle, 34)}」。二つ目、背景には${themes}の同時進行がある。三つ目、日本・アジアでは、AIインフラの制約を追い続けることが欠かせない。World Monitor Dailyでは、地図、ニュース、接続ラインから、世界の動きを読み解いていく。それでは、また次回。

［BGM：アウトロ、8秒。フェードアウト］`;
}

function composeSources(pack) {
  const articles = pack.topArticles.slice(0, 8);
  const lines = articles.map((article, index) => `${index + 1}. ${normalizeOneLine(article.titleJa || article.title)}
   Source: ${article.source || article.domain || "Source"} / ${formatRelative(article.publishedAt)} / Score ${article.contentScore || article.score || 0}
   URL: ${safeExternalUrl(article.url) || "N/A"}`);

  return `# 出典リスト

対象: ${pack.regionJa} / ${pack.regionEn}
生成: ${formatDateTime(pack.generatedAt)}

${lines.join("\n\n")}

## 市場・電力
${pack.macro.map((item) => `- ${macroSummaryLine(item)} / ${item.source || "API"}`).join("\n") || "- 取得待ち"}`;
}

function composeAllContent(pack) {
  return contentTabs
    .map((tab) => `# ${tab.label}\n\n${pack.outputs[tab.key] || ""}`)
    .join("\n\n---\n\n");
}

function renderContentPackModal() {
  const pack = state.contentPack;
  if (!pack) return;
  dom.contentMeta.textContent = `${pack.topArticles.length}件の記事と${pack.macro.length}件の市場・電力シグナルから生成`;
  dom.contentTarget.textContent = `対象: ${pack.regionJa} / ${pack.regionEn}`;
  dom.contentGeneratedAt.textContent = `生成 ${formatDateTime(pack.generatedAt)}`;
  dom.contentSummaryStrip.innerHTML = pack.topArticles.length
    ? pack.topArticles
        .slice(0, 3)
        .map((article, index) => `<article class="content-pick">
          <span>${index + 1}</span>
          <strong>${escapeHtml(article.titleJa || article.title)}</strong>
          <em>${escapeHtml(article.source || article.domain || "Source")} / ${article.contentScore || article.score || 0}</em>
        </article>`)
        .join("")
    : `<div class="empty-state">生成材料がありません</div>`;

  dom.contentTabs.innerHTML = orderedByStorage(contentTabs, storageKeys.contentTabs)
    .map((tab) => `<button class="content-tab ${state.activeContentTab === tab.key ? "active" : ""}" type="button" data-content-tab="${escapeAttr(tab.key)}">
      <i data-lucide="${escapeAttr(tab.icon)}"></i>
      <span>${escapeHtml(tab.label)}</span>
    </button>`)
    .join("");

  dom.contentTabs.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeContentTab = button.dataset.contentTab || "summary";
      renderContentPackModal();
    });
  });
  enableDragSort(dom.contentTabs, ".content-tab", storageKeys.contentTabs, (button) => button.dataset.contentTab);

  renderContentOutput();
  if (window.lucide) window.lucide.createIcons();
}

function renderContentOutput() {
  if (!state.contentPack || !dom.contentOutput) return;
  dom.contentOutput.value = state.contentPack.outputs[state.activeContentTab] || "";
}

function openContentModal() {
  dom.contentModal?.classList.remove("hidden");
  dom.contentModal?.setAttribute("aria-hidden", "false");
  window.setTimeout(() => dom.contentOutput?.focus(), 40);
}

function closeContentModal() {
  dom.contentModal?.classList.add("hidden");
  dom.contentModal?.setAttribute("aria-hidden", "true");
}

async function copyContentOutput() {
  const text = state.contentPack?.outputs?.[state.activeContentTab] || dom.contentOutput?.value || "";
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      dom.contentOutput.focus();
      dom.contentOutput.select();
      document.execCommand("copy");
    }
    setContentStatus("コピー完了。");
  } catch (error) {
    setContentStatus(`コピー失敗: ${error.message}`);
  }
}

function downloadContentPack(all = false) {
  const pack = state.contentPack;
  if (!pack) return;
  const body = all ? pack.allMarkdown || composeAllContent(pack) : pack.outputs[state.activeContentTab] || "";
  const stamp = pack.generatedAt.toISOString().slice(0, 16).replaceAll(":", "").replace("T", "-");
  const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `world-monitor-${all ? "content" : state.activeContentTab}-${pack.regionKey}-${stamp}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setContentStatus("Markdown保存完了。");
}

function setContentStatus(message) {
  if (dom.contentStatus) dom.contentStatus.textContent = message;
}

function articleInsightLine(article, index) {
  const title = normalizeOneLine(article.titleJa || article.title);
  const signal = normalizeOneLine(article.signalJa || "");
  const topics = (article.topics || []).slice(0, 3).map(topicLabel).join(" / ");
  return `${index + 1}. ${title}
   - ${signal || "重要シグナルとして監視対象だ。"}
   - ${article.source || article.domain || "Source"} / ${formatRelative(article.publishedAt)}${topics ? ` / ${topics}` : ""}`;
}

function macroSummaryLine(item) {
  if (!item) return "";
  const value = formatMacroValue(item);
  const change = typeof item.change === "number" ? ` (${item.change >= 0 ? "+" : ""}${item.change.toFixed(2)}%)` : "";
  return `${item.labelJa || item.seriesId || "Market"}: ${value}${change}`;
}

function normalizeOneLine(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clipText(value = "", max = 100) {
  const text = normalizeOneLine(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function articleSearchText(article) {
  return normalizeOneLine(`${article.titleJa || ""} ${article.title || ""}`).toLowerCase();
}

function worldEconomyTopicKeys(article) {
  const text = articleSearchText(article);
  const topics = new Set();
  const match = (patterns) => patterns.some((pattern) => pattern.test(text));

  if (match([/世界情勢|国際情勢|地政学|紛争|戦争|停戦|侵攻|ミサイル|核兵器|テロ|クーデター|制裁|関税|輸出規制|貿易戦争|サプライチェーン|レアアース|選挙|政権|トランプ|大統領|首相|ホワイトハウス|外交|首脳|国連|軍事|防衛|安全保障|ウクライナ|ロシア|中東|イスラエル|イラン|ガザ|北朝鮮|紅海|\b(nato|trump|president|white house|sanctions?|tariffs?|trade war|export control|supply chain|election|geopolitics|war|conflict|invasion|missile|ukraine|russia|taiwan strait|middle east)\b/])) topics.add("geopolitics");
  if (match([/経済|景気|インフレ|デフレ|雇用|失業|中央銀行|日銀|利下げ|利上げ|金利|債券|国債|金融|銀行|債務|格付け|世界銀行|\b(gdp|cpi|frb|fomc|ecb|imf|recession|inflation|central bank|fed|boj|yield|rates|finance|bank|debt)\b/])) topics.add("economy");
  if (match([/市場|株式|株価|指数|日経平均|ダウ|為替|ドル|ユーロ|人民元|原油|金価格|ビットコイン|暗号資産|\b(s&p|sp500|nasdaq|topix|bitcoin|crypto|market|stocks|equity|forex|currency|yen|dollar|oil|gold)\b/])) topics.add("markets");
  if (match([/電力|エネルギー|原油|天然ガス|発電|送電|原子力|データセンター|資源|産業|製造業|\b(lng|energy|power|electricity|oil|gas|grid|nuclear|data center|datacenter|industry|manufacturing)\b/])) topics.add("energy");
  if (match([/自動車|完成車|自動運転|車載|蓄電池|バッテリー|全固体電池|水素車|トヨタ|ホンダ|日産|スバル|マツダ|テスラ|\b(automotive|auto industry|automaker|carmaker|vehicles?|electric vehicles?|ev|autonomous driving|self-driving|robotaxi|software-defined vehicle|sdv|adas|toyota|honda|nissan|tesla|volkswagen|bmw|mercedes|stellantis|renault|byd|hyundai|kia|catl)\b/])) topics.add("automotive");

  return [...topics];
}

function articleAlertTopicKeys(article) {
  return [...new Set([...(article.topics || []), ...worldEconomyTopicKeys(article)])];
}

function worldEconomyTopicLabels(article) {
  const keys = worldEconomyTopicKeys(article);
  return (keys.length ? keys : articleAlertTopicKeys(article).slice(0, 2)).map(topicLabel);
}

function isWorldEconomyArticle(article) {
  if (!article || isLowEditorialValueArticle(article)) return false;
  const keys = worldEconomyTopicKeys(article);
  if (keys.length) return true;
  return (article.topics || []).some((topic) => ["policy", "funding", "security", "data-centers", "automotive"].includes(topic));
}

function worldEconomyScore(article) {
  const base = Number(article.score || 0);
  const published = new Date(article.publishedAt || Date.now()).getTime();
  const ageHours = Number.isFinite(published) ? Math.max(0, (Date.now() - published) / 3600000) : 36;
  const freshness = Math.max(0, 48 - ageHours * 1.8);
  const keys = worldEconomyTopicKeys(article);
  const topicWeight = keys.length * 24;
  const regionWeight = article.region === "world" ? 18 : article.region === "us" || article.region === "europe" ? 14 : article.region === "asia" || article.region === "japan" ? 12 : 8;
  const sourceWeight = article.source === "Hacker News" ? Math.min(18, Math.log1p(Number(article.comments || base || 0)) * 4) : 16;
  return Math.round(base * 0.32 + freshness + topicWeight + regionWeight + sourceWeight);
}

function worldEconomyArticles() {
  return uniqueContentArticles(state.data?.articles || [])
    .filter(isWorldEconomyArticle)
    .map((article) => ({ ...article, worldEconomyScore: worldEconomyScore(article), urgency: alertUrgency(article, new Set(defaultAlertConfig.topics)) }))
    .sort((a, b) => b.worldEconomyScore - a.worldEconomyScore)
    .slice(0, 18);
}

function renderFocus() {
  const focus = orderedByStorage(worldEconomyArticles(), storageKeys.worldTopicsItems, articleItemKey);
  if (!focus.length) {
    dom.focusList.innerHTML = `<div class="empty-state">世界情勢・経済ニュースの取得待ち</div>`;
    return;
  }

  dom.focusList.innerHTML = focus
    .slice(0, 12)
    .map((article) => {
      const tags = worldEconomyTopicLabels(article).slice(0, 2).map((label) => `<span class="tag">${escapeHtml(label)}</span>`).join("");
      return `<article class="focus-item sortable-item" data-item-key="${escapeAttr(articleItemKey(article))}">
        <div class="focus-meta">
          <span>${escapeHtml(regionMeta[article.region]?.labelJa || "世界")}</span>
          <span>${escapeHtml(article.source || "")}</span>
          <span>${Math.round(article.worldEconomyScore || article.urgency || 0)}</span>
        </div>
        <a href="${safeExternalHref(article.url)}" target="_blank" rel="noreferrer">${escapeHtml(article.titleJa || article.title)}</a>
        <div class="tag-row">${tags}</div>
      </article>`;
    })
    .join("");
  enableListItemSort(dom.focusList, ".focus-item", storageKeys.worldTopicsItems);
}

function renderLayerPanel() {
  if (!dom.layerPanel) return;
  const labCounts = LEGACY_AI_LABS.reduce((acc, lab) => {
    if (visibleForActiveRegion(lab)) acc[lab.type] = (acc[lab.type] || 0) + 1;
    return acc;
  }, {});
  const counts = {
    ...labCounts,
    alerts: getActiveAlerts().length,
    risk: riskMarkers().length,
    tiles: 1,
    hq: aiCompanyHqLabels.filter(visibleForActiveRegion).length,
    autoHq: autoCompanyHqLabels.filter(visibleForActiveRegion).length,
    datacenter: LEGACY_DATA_CENTERS.filter(visibleForActiveRegion).length,
    arcs: connectionLines.filter(visibleForActiveConnection).length,
    news: (state.data?.map?.markers || []).filter((marker) => marker.type !== "earthquake" && (state.activeRegion === "world" || marker.region === state.activeRegion || (state.activeRegion === "asia" && marker.region === "japan"))).length,
    labels: [...countryLabels, ...regionLabels, ...cityLabels].filter(visibleForActiveRegion).length,
    heat: (state.data?.map?.markers || []).filter((marker) => marker.type !== "earthquake").length
  };
  const enabledCount = layerConfig.filter((layer) => state.layers[layer.key] === true).length;
  const alertConfig = state.alertConfig || defaultAlertConfig;

  dom.layerPanel.innerHTML = `<div class="layer-title">LAYERS / 表示 ${enabledCount}</div>
    ${layerConfig
      .map((layer) => {
        const enabled = state.layers[layer.key] === true;
        return `<button class="layer-toggle ${enabled ? "active" : ""}" type="button" data-layer="${escapeAttr(layer.key)}" style="--layer-color:${escapeAttr(layer.color)}">
          <span class="layer-check"><b></b></span>
          <span class="layer-label">${escapeHtml(layer.label)}</span>
          <em>${counts[layer.key] || 0}</em>
        </button>`;
      })
      .join("")}
    <div class="alert-config">
      <div class="layer-title alert-config-title">ALERT / 緊急</div>
      <button class="alert-master ${alertConfig.enabled ? "active" : ""}" type="button" data-alert-master>
        ${alertConfig.enabled ? "監視ON" : "監視OFF"}
      </button>
      <div class="alert-topic-grid">
        ${alertTopics
          .map((topic) => `<button class="alert-topic ${alertConfig.topics.includes(topic.key) ? "active" : ""}" type="button" data-alert-topic="${escapeAttr(topic.key)}">${escapeHtml(topic.label)}</button>`)
          .join("")}
      </div>
      <div class="alert-thresholds">
        ${[55, 72, 90]
          .map((value) => `<button class="${Number(alertConfig.threshold) === value ? "active" : ""}" type="button" data-alert-threshold="${value}">${value}</button>`)
          .join("")}
      </div>
    </div>`;

  dom.layerPanel.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.layer;
      if (!key) return;
      state.layers[key] = !state.layers[key];
      saveLayerState();
      renderLayerPanel();
      renderMap();
    });
  });

  dom.layerPanel.querySelector("[data-alert-master]")?.addEventListener("click", () => {
    state.alertConfig.enabled = !state.alertConfig.enabled;
    state.layers.alerts = state.alertConfig.enabled;
    saveAlertConfig();
    saveLayerState();
    renderAlerts();
    renderLayerPanel();
    renderMap();
    if (window.lucide) window.lucide.createIcons();
  });

  dom.layerPanel.querySelectorAll("[data-alert-topic]").forEach((button) => {
    button.addEventListener("click", () => {
      const topic = button.dataset.alertTopic;
      if (!topic) return;
      const next = new Set(state.alertConfig.topics || []);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      state.alertConfig.topics = [...next];
      saveAlertConfig();
      renderAlerts();
      renderLayerPanel();
      renderMap();
      if (window.lucide) window.lucide.createIcons();
    });
  });

  dom.layerPanel.querySelectorAll("[data-alert-threshold]").forEach((button) => {
    button.addEventListener("click", () => {
      state.alertConfig.threshold = Number(button.dataset.alertThreshold) || defaultAlertConfig.threshold;
      saveAlertConfig();
      renderAlerts();
      renderLayerPanel();
      renderMap();
      if (window.lucide) window.lucide.createIcons();
    });
  });
}

function articleTemplate(article) {
  const tags = (article.topics || []).slice(0, 3).map((topic) => `<span class="tag">${escapeHtml(topicLabel(topic))}</span>`).join("");
  const originalTitle = article.title && article.title !== article.titleJa ? article.title : "";
  const titleAttr = originalTitle ? ` title="${escapeAttr(originalTitle)}"` : "";
  return `<article class="article-item" data-region="${escapeAttr(article.region || "world")}">
    <div class="article-stripe"></div>
    <div class="article-body">
      <div class="article-meta">
        <span>${escapeHtml(regionMeta[article.region]?.labelJa || "世界")}</span>
        <span>${escapeHtml(article.source || "Source")}</span>
        <span>${formatRelative(article.publishedAt)}</span>
      </div>
      <a class="article-title" href="${safeExternalHref(article.url)}" target="_blank" rel="noreferrer"${titleAttr}>${escapeHtml(article.titleJa || article.title)}</a>
      <p class="article-signal">${escapeHtml(article.signalJa || "")}</p>
      <div class="tag-row">${tags}</div>
    </div>
  </article>`;
}

function filteredArticles() {
  const articles = articlesForActiveRegion();
  switch (state.activeFeedTab) {
    case "all":
      return articles;
    case "auto":
      return articles.filter((article) => article.topics?.includes("automotive"));
    case "rss":
      return articles.filter((article) => article.source !== "Hacker News" && article.source !== "Dev.to");
    case "hn":
      return articles.filter((article) => article.source === "Hacker News");
    case "devto":
      return articles.filter((article) => article.source === "Dev.to");
    case "ai":
    default:
      return articles.filter(isAiTechArticle);
  }
}

function isAiTechArticle(article) {
  return (article.topics || []).some((topic) => ["models", "chips", "data-centers", "cloud", "security", "robotics", "quantum"].includes(topic))
    || article.source === "Hacker News" || article.source === "Dev.to"
    || /\b(AI|GPU|LLM|OpenAI|Anthropic|DeepMind|NVIDIA)\b|生成AI|人工知能|半導体|データセンター|量子|自動運転/i.test(`${article.title || ""} ${article.titleJa || ""}`);
}

function articlesForActiveRegion() {
  const articles = state.data?.articles || [];
  if (state.activeRegion === "world") return articles;
  return articles.filter((article) => article.region === state.activeRegion || (state.activeRegion === "asia" && article.region === "japan"));
}

async function renderMap() {
  dom.mapCanvas?.classList.toggle("mode-3d", state.mapMode === "3d");
  dom.mapCanvas?.classList.toggle("mode-2d", state.mapMode !== "3d");
  updateMapModeButtons();
  if (state.mapMode === "3d") {
    return renderGlobeMap();
  }
  destroyGlobeScene();
  return renderMap2D();
}

async function renderMap2D() {
  if (!state.data || !window.d3 || !window.topojson) return;

  const svg = d3.select(dom.worldMap);
  const rect = dom.mapCanvas.getBoundingClientRect();
  const width = Math.max(320, rect.width);
  const height = Math.max(180, rect.height);
  svg.attr("viewBox", `0 0 ${width} ${height}`);
  svg.selectAll("*").remove();

  const projection = createMapProjection(width, height);
  const path = d3.geoPath(projection);
  state.projection = projection;
  state.mapSize = { width, height };
  state.lastReadableScale = 0;
  const markers = (state.data.map?.markers || []).filter((marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lon));
  const alertMarkers = getActiveAlerts().filter((article) => Number.isFinite(article.lat) && Number.isFinite(article.lon));
  const countryHeatCache = new WeakMap();
  const getCountryHeat = (feature) => {
    if (!state.layers.heat) return 0;
    if (!countryHeatCache.has(feature)) countryHeatCache.set(feature, countryHeat(feature, markers));
    return countryHeatCache.get(feature);
  };

  const defs = svg.append("defs");
  const heatFilter = defs.append("filter").attr("id", "heatBlur").attr("x", "-45%").attr("y", "-45%").attr("width", "190%").attr("height", "190%");
  heatFilter.append("feGaussianBlur").attr("stdDeviation", 16);
  const glowFilter = defs.append("filter").attr("id", "signalGlow").attr("x", "-80%").attr("y", "-80%").attr("width", "260%").attr("height", "260%");
  glowFilter.append("feGaussianBlur").attr("stdDeviation", 4).attr("result", "blur");
  const glowMerge = glowFilter.append("feMerge");
  glowMerge.append("feMergeNode").attr("in", "blur");
  glowMerge.append("feMergeNode").attr("in", "SourceGraphic");

  const mapLayer = svg.append("g").attr("class", "map-viewport");

  mapLayer.append("path").datum(d3.geoGraticule10()).attr("class", "graticule").attr("d", path);

  try {
    const world = await getWorldMapData();
    const countries = topojson.feature(world, world.objects.countries);
    mapLayer
      .append("g")
      .selectAll("path")
      .data(countries.features)
      .join("path")
      .attr("class", "country")
      .attr("data-heat", (feature) => heatLevel(getCountryHeat(feature)))
      .attr("fill", (feature) => countryFill(getCountryHeat(feature)))
      .attr("d", path);
  } catch {
    mapLayer
      .append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#526062")
      .attr("font-size", 14)
      .text("Map tiles loading");
  }

  if (state.layers.heat) {
    mapLayer
      .append("g")
      .attr("class", "heat-layer")
      .selectAll("circle")
      .data(markers.filter((marker) => marker.type !== "earthquake").sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 24))
      .join("circle")
      .attr("class", (d) => heatClass(d))
      .attr("data-base-r", (d) => Math.max(20, Math.min(58, 22 + Number(d.score || 10) * 0.7)))
      .attr("cx", (d) => projection([d.lon, d.lat])?.[0] || 0)
      .attr("cy", (d) => projection([d.lon, d.lat])?.[1] || 0)
      .attr("r", (d) => Math.max(20, Math.min(58, 22 + Number(d.score || 10) * 0.7)))
      .attr("filter", "url(#heatBlur)");
  }

  if (state.layers.arcs) renderConnectionLines(mapLayer, path);
  if (state.layers.alerts) renderAlertMarkers(mapLayer, projection, alertMarkers);
  if (state.layers.risk) renderRiskMarkers(mapLayer, projection);

  if (state.layers.news) {
    mapLayer
      .append("g")
      .attr("class", "signal-layer")
      .selectAll("circle")
      .data(markers.slice(0, 32))
      .join("circle")
      .attr("class", (d) => markerClass(d))
      .attr("data-base-r", (d) => (d.type === "earthquake" ? Math.max(4, Math.min(11, Number(d.magnitude || 4))) : Math.max(4.5, Math.min(10, 4 + Number(d.score || 10) / 14))))
      .attr("r", (d) => (d.type === "earthquake" ? Math.max(4, Math.min(11, Number(d.magnitude || 4))) : Math.max(4.5, Math.min(10, 4 + Number(d.score || 10) / 14))))
      .attr("cx", (d) => projection([d.lon, d.lat])?.[0] || 0)
      .attr("cy", (d) => projection([d.lon, d.lat])?.[1] || 0)
      .on("mouseenter", showTooltip)
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip)
      .on("click", (_event, d) => {
        openExternalUrl(d.url);
      });
    addHitTargets(mapLayer, markers.slice(0, 32), projection, 12, showTooltip);
  }

  renderLegacyInfrastructureLayers(mapLayer, projection, width);
  if (state.layers.labels) {
    renderCountryLabels(mapLayer, projection, width);
    renderRegionLabels(mapLayer, projection, width);
    renderCityLabels(mapLayer, projection);
  }
  if (state.layers.hq) {
    renderCompanyHqLabels(mapLayer, projection, width);
  }
  if (state.layers.autoHq) {
    renderAutoCompanyHqLabels(mapLayer, projection, width);
  }
  setupMapZoom(svg, mapLayer, width, height);

  if (!state.resizeObserver) {
    state.resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(state.resizeTimer);
      state.resizeTimer = window.setTimeout(() => renderMap(), 320);
    });
    state.resizeObserver.observe(dom.mapCanvas);
  }
}

function riskMarkers() {
  return (state.data?.map?.markers || []).filter((marker) => marker.type === "earthquake"
    && Number.isFinite(marker.lat) && Number.isFinite(marker.lon));
}

function renderRiskMarkers(mapLayer, projection) {
  const markers = riskMarkers();
  mapLayer.append("g").attr("class", "risk-layer").selectAll("circle")
    .data(markers).join("circle")
    .attr("class", "risk-marker").attr("data-base-r", 6).attr("r", 6)
    .attr("cx", (item) => projection([item.lon, item.lat])[0])
    .attr("cy", (item) => projection([item.lon, item.lat])[1])
    .attr("fill", "#ef4444").attr("stroke", "#fecaca").attr("stroke-width", 1);
  addHitTargets(mapLayer, markers, projection, 12, showTooltip);
}

function addHitTargets(mapLayer, markers, projection, radius, tooltip) {
  mapLayer.append("g").attr("class", "marker-hit-targets").selectAll("circle")
    .data(markers.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon)))
    .join("circle").attr("data-base-r", radius).attr("r", radius)
    .attr("cx", (item) => projection([item.lon, item.lat])[0])
    .attr("cy", (item) => projection([item.lon, item.lat])[1])
    .attr("fill", "transparent").attr("pointer-events", "all")
    .on("mouseenter", tooltip).on("mousemove", moveTooltip).on("mouseleave", hideTooltip)
    .on("click", (_event, item) => { openExternalUrl(item.url); });
}

function createMapProjection(width, height) {
  const scale = width / (2 * Math.PI);
  return d3
    .geoMercator()
    .scale(scale)
    .translate([width / 2, height / 2])
    .clipExtent([
      [0, 0],
      [width, height]
    ]);
}

async function renderGlobeMap() {
  if (!state.data || !dom.mapCanvas || !dom.globeCanvas || !dom.globeOverlay) return;
  if (!window.THREE) {
    try {
      window.THREE = await import("./vendor/three.module.js");
    } catch {
      // The canvas globe remains available when WebGL dependencies cannot load.
    }
  }
  destroyGlobeScene();
  if (dom.mapTileLayer) {
    dom.mapTileLayer.innerHTML = "";
    dom.mapTileLayer.style.opacity = "0";
  }
  if (window.d3 && dom.worldMap) d3.select(dom.worldMap).selectAll("*").remove();

  const rect = dom.mapCanvas.getBoundingClientRect();
  const width = Math.max(320, rect.width);
  const height = Math.max(320, rect.height);
  state.mapSize = { width, height };
  state.projection = null;
  state.zoomBehavior = null;
  state.mapTransform = null;

  if (!window.THREE) {
    return renderCanvasGlobeMap(width, height);
  }

  const THREE = window.THREE;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({
    canvas: dom.globeCanvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x020814, 0);

  const globeGroup = new THREE.Group();
  scene.add(globeGroup);
  camera.position.set(0, 0, globeCameraDistance());

  const ambient = new THREE.AmbientLight(0x7aa8c7, 1.15);
  const sun = new THREE.DirectionalLight(0x9ee9ff, 1.8);
  sun.position.set(-2.6, 2.2, 3.4);
  scene.add(ambient, sun);

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 72, 48),
    new THREE.MeshPhongMaterial({
      color: 0x071726,
      emissive: 0x03101b,
      shininess: 18,
      specular: 0x17495f
    })
  );
  globeGroup.add(sphere);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.018, 72, 48),
    new THREE.MeshBasicMaterial({
      color: 0x2bd7ff,
      transparent: true,
      opacity: 0.055,
      side: THREE.BackSide
    })
  );
  globeGroup.add(atmosphere);

  addGlobeGraticule(globeGroup, THREE);

  try {
    const world = await getWorldMapData();
    const countries = topojson.feature(world, world.objects.countries);
    addGlobeCountries(globeGroup, THREE, countries.features);
  } catch {
    dom.globeOverlay.innerHTML = `<div class="globe-empty">3D地図データを取得中</div>`;
  }

  const connectionFlows = addGlobeConnectionLines(globeGroup, THREE);
  const overlayItems = buildGlobeOverlayItems(THREE);
  const view = regionViews[state.activeRegion] || regionViews.world;
  setGlobeRotationForView(globeGroup, view.lon, view.lat);

  const globeState = {
    renderer,
    scene,
    camera,
    group: globeGroup,
    overlayItems,
    connectionFlows,
    width,
    height,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    disposed: false,
    disposeHandlers: []
  };
  state.globe = globeState;
  bindGlobeInteraction(globeState);
  animateGlobe();

  if (!state.resizeObserver) {
    state.resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(state.resizeTimer);
      state.resizeTimer = window.setTimeout(() => renderMap(), 320);
    });
    state.resizeObserver.observe(dom.mapCanvas);
  }
}

async function renderCanvasGlobeMap(width, height) {
  if (!window.d3 || !window.topojson || !dom.globeCanvas || !dom.globeOverlay) {
    dom.globeOverlay.innerHTML = `<div class="globe-empty">3D地球儀を読み込み中</div>`;
    return;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const canvas = dom.globeCanvas;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let countries = [];
  try {
    const world = await getWorldMapData();
    countries = topojson.feature(world, world.objects.countries).features;
  } catch {
    dom.globeOverlay.innerHTML = `<div class="globe-empty">3D地図データを取得中</div>`;
  }

  const view = regionViews[state.activeRegion] || regionViews.world;
  const rotation = [-view.lon, -view.lat, 0];
  const radius = Math.min(width, height) * (state.activeRegion === "world" ? 0.38 : 0.46);
  const projection = d3.geoOrthographic()
    .translate([width / 2, height / 2])
    .scale(radius)
    .rotate(rotation)
    .clipAngle(90);
  const path = d3.geoPath(projection, ctx);

  const globeState = {
    mode: "canvas",
    canvas,
    ctx,
    projection,
    path,
    countries,
    rotation,
    width,
    height,
    scale: radius,
    baseScale: radius,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    disposed: false,
    overlayItems: buildCanvasGlobeOverlayItems(),
    disposeHandlers: []
  };
  state.globe = globeState;
  bindCanvasGlobeInteraction(globeState);
  drawCanvasGlobe(globeState);
  updateCanvasGlobeOverlayPositions(globeState);
  animateCanvasGlobe();

  if (!state.resizeObserver) {
    state.resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(state.resizeTimer);
      state.resizeTimer = window.setTimeout(() => renderMap(), 320);
    });
    state.resizeObserver.observe(dom.mapCanvas);
  }
}

function destroyGlobeScene() {
  const globe = state.globe;
  if (!globe) {
    if (dom.globeOverlay) dom.globeOverlay.innerHTML = "";
    return;
  }
  globe.disposed = true;
  if (globe.animationId) window.cancelAnimationFrame(globe.animationId);
  (globe.disposeHandlers || []).forEach((dispose) => dispose());
  if (globe.scene) {
    globe.scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose?.();
      if (object.material) {
        object.material.map?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
        else object.material.dispose?.();
      }
    });
  }
  globe.renderer?.dispose?.();
  if (dom.globeOverlay) dom.globeOverlay.innerHTML = "";
  state.globe = null;
}

function addGlobeCountries(group, THREE, features) {
  const material = new THREE.LineBasicMaterial({
    color: 0x6d8796,
    transparent: true,
    opacity: 0.46
  });
  const vertices = [];
  features.forEach((feature) => {
    polygonRings(feature.geometry).forEach((ring) => {
      const reduced = ring.filter((_point, index) => index % 2 === 0 || index === ring.length - 1);
      const points = reduced.map(([lon, lat]) => globeVector(lat, lon, 1.006, THREE));
      if (points.length < 2) return;
      for (let i = 1; i < points.length; i++) vertices.push(...points[i - 1].toArray(), ...points[i].toArray());
    });
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  group.add(new THREE.LineSegments(geometry, material));

  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#07121e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const projection = d3.geoEquirectangular().scale(canvas.width / (2 * Math.PI)).translate([1024, 512]);
  const drawPath = d3.geoPath(projection, ctx);
  features.forEach((feature) => {
    ctx.beginPath();
    drawPath(feature);
    ctx.fillStyle = "#18303b";
    ctx.fill();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sphere = group.children.find((item) => item.isMesh);
  sphere.material.map = texture;
  sphere.material.color.set(0xffffff);
  sphere.material.needsUpdate = true;
}

function addGlobeGraticule(group, THREE) {
  const material = new THREE.LineBasicMaterial({ color: 0x12344a, transparent: true, opacity: 0.36 });
  for (let lat = -60; lat <= 60; lat += 30) {
    const coords = [];
    for (let lon = -180; lon <= 180; lon += 5) coords.push([lon, lat]);
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(coords.map(([lon, itemLat]) => globeVector(itemLat, lon, 1.002, THREE))), material));
  }
  for (let lon = -180; lon < 180; lon += 30) {
    const coords = [];
    for (let lat = -80; lat <= 80; lat += 5) coords.push([lon, lat]);
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(coords.map(([itemLon, lat]) => globeVector(lat, itemLon, 1.002, THREE))), material));
  }
}

function addGlobeConnectionLines(group, THREE) {
  const flows = [];
  if (!state.layers.arcs || !window.d3) return flows;
  connectionLines.filter(visibleForActiveConnection).forEach((connection, index) => {
    const fromNode = connectionNodes[connection.from];
    const toNode = connectionNodes[connection.to];
    if (!fromNode || !toNode) return;
    const interpolate = d3.geoInterpolate([fromNode.lon, fromNode.lat], [toNode.lon, toNode.lat]);
    const points = Array.from({ length: 46 }, (_item, index) => {
      const [lon, lat] = interpolate(index / 45);
      const lift = Math.sin((index / 45) * Math.PI) * 0.06;
      return globeVector(lat, lon, 1.028 + lift, THREE);
    });
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineDashedMaterial({ color: new THREE.Color(connectionColor(connection)), dashSize: 0.023, gapSize: 0.018, transparent: true, opacity: 0.75 })
    );
    line.computeLineDistances();
    group.add(line);
    const glow = new THREE.Line(line.geometry, new THREE.LineBasicMaterial({ color: new THREE.Color(connectionColor(connection)), transparent: true, opacity: 0.16 }));
    group.add(glow);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(connectionColor(connection)) }));
    group.add(dot);
    const speed = connectionEffectiveSpeed({ ...connection, activity: connectionActivity(connection) });
    flows.push({ dot, points, duration: 10000 / speed, offset: index * 0.13 });
  });
  return flows;
}

function buildGlobeOverlayItems(THREE) {
  dom.globeOverlay.innerHTML = "";
  const items = [];
  const add = (item, className, label) => {
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lon)) return;
    const isMarker = className.includes("globe-marker");
    const element = document.createElement("div");
    element.className = className;
    element.textContent = isMarker ? "" : label || "";
    element.title = label || "";
    dom.globeOverlay.appendChild(element);
    items.push({
      element,
      type: className.includes("globe-marker hq") ? "hq" : isMarker ? "marker" : "label",
      width: isMarker ? 0 : element.offsetWidth,
      height: isMarker ? 0 : element.offsetHeight,
      offsetY: !isMarker && /hq/.test(className) ? -16 : 0,
      vector: globeVector(item.lat, item.lon, 1.009, THREE)
    });
  };

  if (state.layers.labels) {
    regionLabels.filter(visibleForActiveRegion).slice(0, 20).forEach((label) => add(label, "globe-label region", label.name));
    countryLabels.filter((label) => visibleForActiveRegion(label) && !label.detailOnly).slice(0, state.activeRegion === "world" ? 52 : 80).forEach((label) => add(label, "globe-label country", label.name));
    cityLabels.filter((label) => visibleForActiveRegion(label) && !label.detailOnly).slice(0, state.activeRegion === "world" ? 36 : 70).forEach((label) => add(label, "globe-label city", label.name));
  }

  if (state.layers.news) {
    (state.data?.map?.markers || [])
      .filter((marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lon) && marker.type !== "earthquake")
      .slice(0, 28)
      .forEach((marker) => add({ ...marker, radius: 1.085 }, "globe-marker news", marker.titleJa || marker.title || "News"));
  }

  if (state.layers.heat) {
    (state.data?.map?.markers || [])
      .filter((marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lon) && marker.type !== "earthquake")
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, 24)
      .forEach((marker) => add({ ...marker, radius: 1.082 }, "globe-marker heat", marker.titleJa || marker.title || "Heat"));
  }

  if (state.layers.alerts) {
    getActiveAlerts()
      .filter((article) => Number.isFinite(article.lat) && Number.isFinite(article.lon))
      .slice(0, 8)
      .forEach((article) => add({ ...article, radius: 1.095 }, "globe-marker alert", article.titleJa || article.title || "緊急"));
  }

  if (state.layers.hq) {
    aiCompanyHqLabels.filter(visibleForActiveRegion).slice(0, 42).forEach((company) => {
      add({ ...company, radius: 1.09 }, "globe-marker hq", `${company.name} / ${company.placeJa}`);
      add({ ...company, radius: 1.12 }, "globe-label hq", company.name);
    });
  }

  if (state.layers.autoHq) {
    autoCompanyHqLabels.filter(visibleForActiveRegion).slice(0, 42).forEach((company) => {
      add({ ...company, radius: 1.092 }, "globe-marker auto-hq", `${company.name} / ${company.placeJa}`);
      add({ ...company, radius: 1.122 }, "globe-label auto-hq", company.name);
    });
  }

  LEGACY_AI_LABS.filter((lab) => visibleForActiveRegion(lab) && state.layers[lab.type] === true)
    .slice(0, 60)
    .forEach((lab) => add({ ...lab, radius: 1.09 }, `globe-marker lab lab-${lab.type}`, lab.nameJa || lab.name));

  if (state.layers.datacenter) {
    LEGACY_DATA_CENTERS.filter(visibleForActiveRegion)
      .slice(0, 70)
      .forEach((dataCenter) => add({ ...dataCenter, radius: 1.088 }, "globe-marker datacenter", dataCenter.nameJa || dataCenter.name));
  }

  return items;
}

function buildCanvasGlobeOverlayItems() {
  dom.globeOverlay.innerHTML = "";
  const items = [];
  const add = (item, className, label, radius = 1.075) => {
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lon)) return;
    const element = document.createElement("div");
    const isMarker = className.includes("globe-marker");
    element.className = className;
    element.textContent = isMarker ? "" : label || "";
    element.title = label || "";
    dom.globeOverlay.appendChild(element);
    items.push({
      element,
      type: className.includes("globe-marker hq") ? "hq" : className.includes("alert") ? "alert" : "label",
      lat: item.lat,
      lon: item.lon,
      radius
    });
  };

  if (state.layers.labels) {
    regionLabels.filter(visibleForActiveRegion).slice(0, 20).forEach((label) => add(label, "globe-label region", label.name, 1.06));
    countryLabels.filter((label) => visibleForActiveRegion(label) && !label.detailOnly).slice(0, state.activeRegion === "world" ? 52 : 80).forEach((label) => add(label, "globe-label country", label.name, 1.055));
    cityLabels.filter((label) => visibleForActiveRegion(label) && !label.detailOnly).slice(0, state.activeRegion === "world" ? 36 : 70).forEach((label) => add(label, "globe-label city", label.name, 1.058));
  }

  if (state.layers.news) {
    (state.data?.map?.markers || [])
      .filter((marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lon) && marker.type !== "earthquake")
      .slice(0, 28)
      .forEach((marker) => add(marker, "globe-marker news", marker.titleJa || marker.title || "News", 1.07));
  }

  if (state.layers.heat) {
    (state.data?.map?.markers || [])
      .filter((marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lon) && marker.type !== "earthquake")
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, 24)
      .forEach((marker) => add(marker, "globe-marker heat", marker.titleJa || marker.title || "Heat", 1.065));
  }

  if (state.layers.alerts) {
    getActiveAlerts()
      .filter((article) => Number.isFinite(article.lat) && Number.isFinite(article.lon))
      .slice(0, 8)
      .forEach((article) => add(article, "globe-marker alert", article.titleJa || article.title || "緊急", 1.075));
  }

  if (state.layers.hq) {
    aiCompanyHqLabels.filter(visibleForActiveRegion).slice(0, 42).forEach((company) => {
      add(company, "globe-marker hq", `${company.name} / ${company.placeJa}`, 1.075);
      add(company, "globe-label hq", company.name, 1.095);
    });
  }

  if (state.layers.autoHq) {
    autoCompanyHqLabels.filter(visibleForActiveRegion).slice(0, 42).forEach((company) => {
      add(company, "globe-marker auto-hq", `${company.name} / ${company.placeJa}`, 1.076);
      add(company, "globe-label auto-hq", company.name, 1.096);
    });
  }

  LEGACY_AI_LABS.filter((lab) => visibleForActiveRegion(lab) && state.layers[lab.type] === true)
    .slice(0, 60)
    .forEach((lab) => add(lab, `globe-marker lab lab-${lab.type}`, lab.nameJa || lab.name, 1.07));

  if (state.layers.datacenter) {
    LEGACY_DATA_CENTERS.filter(visibleForActiveRegion)
      .slice(0, 70)
      .forEach((dataCenter) => add(dataCenter, "globe-marker datacenter", dataCenter.nameJa || dataCenter.name, 1.068));
  }

  return items;
}

function bindCanvasGlobeInteraction(globe) {
  const canvas = dom.globeCanvas;
  const onPointerDown = (event) => {
    globe.dragging = true;
    globe.pointerId = event.pointerId;
    globe.lastX = event.clientX;
    globe.lastY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
    dom.mapCanvas.classList.add("is-panning");
    hideTooltip();
  };
  const onPointerMove = (event) => {
    if (!globe.dragging || event.pointerId !== globe.pointerId) return;
    const dx = event.clientX - globe.lastX;
    const dy = event.clientY - globe.lastY;
    globe.lastX = event.clientX;
    globe.lastY = event.clientY;
    globe.rotation[0] += dx * 0.22;
    globe.rotation[1] = clamp(globe.rotation[1] - dy * 0.16, -74, 74);
    globe.projection.rotate(globe.rotation);
  };
  const onPointerUp = (event) => {
    if (event.pointerId !== globe.pointerId) return;
    globe.dragging = false;
    globe.pointerId = null;
    canvas.releasePointerCapture?.(event.pointerId);
    dom.mapCanvas.classList.remove("is-panning");
  };
  const onWheel = (event) => {
    event.preventDefault();
    zoomGlobeBy(event.deltaY < 0 ? 1.12 : 1 / 1.12);
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  globe.disposeHandlers.push(() => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
  });
}

function animateCanvasGlobe() {
  const globe = state.globe;
  if (!globe || globe.disposed || globe.mode !== "canvas") return;
  if (document.hidden) {
    globe.animationId = window.requestAnimationFrame(animateCanvasGlobe);
    return;
  }
  const now = performance.now();
  if (globe.lastFrameAt && now - globe.lastFrameAt < 80) {
    globe.animationId = window.requestAnimationFrame(animateCanvasGlobe);
    return;
  }
  globe.lastFrameAt = now;
  // ズームインしたら自動回転を弱め、拡大時は停止して詳細を見やすくする
  const zoomRatio = globe.scale / globe.baseScale;
  const autoSpin = zoomRatio > 1.5 ? 0 : 0.018 * (1 - (zoomRatio - 1) / 0.5);
  if (!globe.dragging && autoSpin > 0) {
    globe.rotation[0] -= autoSpin;
    globe.projection.rotate(globe.rotation);
  }
  drawCanvasGlobe(globe);
  updateCanvasGlobeOverlayPositions(globe);
  globe.animationId = window.requestAnimationFrame(animateCanvasGlobe);
}

function drawCanvasGlobe(globe) {
  const { ctx, width, height, path, countries } = globe;
  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createRadialGradient(width * 0.42, height * 0.34, 4, width / 2, height / 2, globe.projection.scale() * 1.08);
  gradient.addColorStop(0, "#163a4b");
  gradient.addColorStop(0.54, "#071827");
  gradient.addColorStop(1, "#020814");

  ctx.beginPath();
  path({ type: "Sphere" });
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(102, 240, 255, 0.42)";
  ctx.stroke();

  ctx.beginPath();
  path(d3.geoGraticule10());
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = "rgba(43, 215, 255, 0.14)";
  ctx.stroke();

  countries.forEach((feature) => {
    ctx.beginPath();
    path(feature);
    ctx.fillStyle = "rgba(20, 52, 58, 0.74)";
    ctx.fill();
    ctx.lineWidth = 0.45;
    ctx.strokeStyle = "rgba(132, 164, 178, 0.34)";
    ctx.stroke();
  });

  if (state.layers.heat) drawCanvasGlobeHeat(globe);
  drawCanvasGlobeSymbols(globe);
  if (state.layers.arcs) {
    try {
      drawCanvasGlobeConnections(globe);
    } catch {
      // Keep the globe responsive even if a long arc cannot be projected.
    }
  }
}

function drawCanvasGlobeHeat(globe) {
  const markers = (state.data?.map?.markers || [])
    .filter((marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lon) && marker.type !== "earthquake")
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 24);
  const center = [-globe.rotation[0], -globe.rotation[1]];

  markers.forEach((marker) => {
    const point = globe.projection([marker.lon, marker.lat]);
    if (!point || d3.geoDistance([marker.lon, marker.lat], center) >= Math.PI / 2) return;
    const score = Number(marker.score || 10);
    const radius = Math.max(12, Math.min(42, 10 + score * 0.52)) * (globe.projection.scale() / globe.baseScale);
    const color = marker.region === "asia" || marker.region === "japan" ? [255, 194, 71] : marker.region === "us" ? [43, 215, 255] : marker.region === "europe" ? [168, 85, 247] : [255, 91, 91];
    const gradient = globe.ctx.createRadialGradient(point[0], point[1], 2, point[0], point[1], radius);
    gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.52)`);
    gradient.addColorStop(0.4, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.18)`);
    gradient.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
    globe.ctx.beginPath();
    globe.ctx.arc(point[0], point[1], radius, 0, Math.PI * 2);
    globe.ctx.fillStyle = gradient;
    globe.ctx.fill();
  });
}

function drawCanvasGlobeConnections(globe) {
  if (!window.d3) return;
  const { ctx, projection } = globe;
  connectionLines.filter(visibleForActiveConnection).forEach((connection) => {
    const interpolate = d3.geoInterpolate([connection.fromNode.lon, connection.fromNode.lat], [connection.toNode.lon, connection.toNode.lat]);
    ctx.beginPath();
    let drawn = false;
    for (let index = 0; index <= 48; index += 1) {
      const [lon, lat] = interpolate(index / 48);
      const point = projection([lon, lat]);
      if (!point) {
        drawn = false;
        continue;
      }
      if (!drawn) {
        ctx.moveTo(point[0], point[1]);
        drawn = true;
      } else {
        ctx.lineTo(point[0], point[1]);
      }
    }
    ctx.lineWidth = 1.7;
    ctx.strokeStyle = connectionColor(connection);
    ctx.globalAlpha = 0.78;
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
}

function drawCanvasGlobeSymbols(globe) {
  if (!window.d3) return;
  const project = (item) => (Number.isFinite(item.lat) && Number.isFinite(item.lon) ? globe.projection([item.lon, item.lat]) : null);

  const drawLabel = (item, size, color, weight = 800) => {
    const point = project(item);
    if (!point) return;
    const text = item.name || item.nameJa || item.cityJa || item.label || "";
    if (!text) return;
    globe.ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
    globe.ctx.lineWidth = Math.max(2.4, size * 0.32);
    globe.ctx.strokeStyle = "rgba(0, 0, 0, 0.82)";
    globe.ctx.fillStyle = color;
    globe.ctx.shadowColor = "rgba(102, 240, 255, 0.45)";
    globe.ctx.shadowBlur = Math.max(2, size * 0.28);
    globe.ctx.textAlign = "center";
    globe.ctx.textBaseline = "middle";
    globe.ctx.strokeText(text, point[0], point[1]);
    globe.ctx.fillText(text, point[0], point[1]);
    globe.ctx.shadowBlur = 0;
  };

  const drawCircle = (item, color, radius = 4.2, glow = true) => {
    const point = project(item);
    if (!point) return;
    if (glow) {
      globe.ctx.beginPath();
      globe.ctx.arc(point[0], point[1], radius * 3.4, 0, Math.PI * 2);
      globe.ctx.fillStyle = color.replace("1)", "0.14)").replace("rgb(", "rgba(");
      globe.ctx.fill();
    }
    globe.ctx.beginPath();
    globe.ctx.arc(point[0], point[1], radius, 0, Math.PI * 2);
    globe.ctx.fillStyle = color;
    globe.ctx.fill();
    globe.ctx.lineWidth = 1.4;
    globe.ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
    globe.ctx.stroke();
  };

  const drawDiamond = (item, color, radius = 5.6) => {
    const point = project(item);
    if (!point) return;
    globe.ctx.save();
    globe.ctx.translate(point[0], point[1]);
    globe.ctx.rotate(Math.PI / 4);
    globe.ctx.fillStyle = color;
    globe.ctx.strokeStyle = "rgba(255, 255, 255, 0.84)";
    globe.ctx.lineWidth = 1.3;
    globe.ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    globe.ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);
    globe.ctx.restore();
  };

  const drawSquare = (item, color, radius = 4.8) => {
    const point = project(item);
    if (!point) return;
    globe.ctx.fillStyle = color;
    globe.ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
    globe.ctx.lineWidth = 1.1;
    globe.ctx.fillRect(point[0] - radius, point[1] - radius, radius * 2, radius * 2);
    globe.ctx.strokeRect(point[0] - radius, point[1] - radius, radius * 2, radius * 2);
  };

  if (state.layers.labels) {
    // ズームインしたら詳細地名（都市・小地域）も表示して情報量を増やす
    const zoomedIn = globe.scale / globe.baseScale > 1.8;
    const countryOk = (label) => visibleForActiveRegion(label) && (zoomedIn || !label.detailOnly);
    regionLabels.filter(visibleForActiveRegion).slice(0, 20).forEach((label) => drawLabel(label, 24, "rgba(102, 240, 255, 0.92)", 950));
    countryLabels.filter(countryOk).slice(0, zoomedIn ? 160 : state.activeRegion === "world" ? 44 : 80).forEach((label) => drawLabel(label, 15, "rgba(238, 247, 255, 0.92)", 850));
    cityLabels.filter(countryOk).slice(0, zoomedIn ? 140 : state.activeRegion === "world" ? 30 : 70).forEach((label) => drawLabel(label, 13, "rgba(220, 239, 255, 0.9)", 780));
  }

  if (state.layers.alerts) {
    getActiveAlerts()
      .filter((article) => Number.isFinite(article.lat) && Number.isFinite(article.lon))
      .slice(0, 8)
      .forEach((article) => drawCircle(article, "rgba(255, 68, 68, 1)", 8.5));
  }

  if (state.layers.risk) {
    const center = [-globe.rotation[0], -globe.rotation[1]];
    riskMarkers().forEach((item) => {
      if (d3.geoDistance([item.lon, item.lat], center) >= Math.PI / 2) return;
      const radius = item.riskKind === "quake" ? 5 + Math.min(7, (Number(item.magnitude || 4.5) - 4) * 2.2) : 5.4;
      drawCircle(item, "rgba(244, 63, 94, 1)", radius);
    });
  }

  if (state.layers.news) {
    (state.data?.map?.markers || [])
      .filter((marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lon) && marker.type !== "earthquake")
      .slice(0, 28)
      .forEach((marker) => drawCircle(marker, "rgba(56, 189, 248, 1)", 4));
  }

  if (state.layers.hq) {
    aiCompanyHqLabels.filter(visibleForActiveRegion).slice(0, 42).forEach((company) => {
      drawDiamond(company, "rgba(192, 132, 252, 0.95)", 6.2);
      if (state.activeRegion !== "world") drawLabel({ ...company, name: company.name }, 9, "rgba(244, 231, 255, 0.88)", 800);
    });
  }

  if (state.layers.autoHq) {
    autoCompanyHqLabels.filter(visibleForActiveRegion).slice(0, 42).forEach((company) => {
      drawCircle(company, "rgba(34, 211, 238, 0.98)", 5.8);
      if (state.activeRegion !== "world") drawLabel({ ...company, name: company.name }, 9, "rgba(210, 250, 255, 0.9)", 800);
    });
  }

  LEGACY_AI_LABS.filter((lab) => visibleForActiveRegion(lab) && state.layers[lab.type] === true)
    .slice(0, 60)
    .forEach((lab) => drawCircle(lab, hexToRgba(LEGACY_LAB_COLORS[lab.type] || "#66f0ff", 0.95), lab.tier === 1 ? 7 : 5.2));

  if (state.layers.datacenter) {
    LEGACY_DATA_CENTERS.filter(visibleForActiveRegion)
      .slice(0, 70)
      .forEach((dataCenter) => drawSquare(dataCenter, hexToRgba(LEGACY_DC_COLORS[dataCenter.company] || LEGACY_DC_COLORS.other, 0.9), dataCenter.aiTraining ? 7 : 5.2));
  }
}

function hexToRgba(hex, alpha = 1) {
  const value = String(hex || "#ffffff").replace("#", "");
  const parsed = Number.parseInt(value.length === 3 ? value.split("").map((char) => char + char).join("") : value, 16);
  if (!Number.isFinite(parsed)) return `rgba(255,255,255,${alpha})`;
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function updateCanvasGlobeOverlayPositions(globe) {
  globe.overlayItems.forEach((item) => {
    const point = globe.projection([item.lon, item.lat]);
    const visible = !!point;
    if (!visible) {
      item.element.style.opacity = "0";
      return;
    }
    const fade = 0.92;
    item.element.style.transform = item.type === "hq"
      ? `translate(${point[0]}px, ${point[1]}px) translate(-50%, -50%) rotate(45deg)`
      : `translate(${point[0]}px, ${point[1]}px) translate(-50%, -50%)`;
    item.element.style.opacity = String(fade);
  });
}

function bindGlobeInteraction(globe) {
  const canvas = dom.globeCanvas;
  const onPointerDown = (event) => {
    globe.dragging = true;
    globe.pointerId = event.pointerId;
    globe.lastX = event.clientX;
    globe.lastY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
    dom.mapCanvas.classList.add("is-panning");
    hideTooltip();
  };
  const onPointerMove = (event) => {
    if (!globe.dragging || event.pointerId !== globe.pointerId) return;
    const dx = event.clientX - globe.lastX;
    const dy = event.clientY - globe.lastY;
    globe.lastX = event.clientX;
    globe.lastY = event.clientY;
    globe.group.rotation.y += dx * 0.006;
    globe.group.rotation.x = clamp(globe.group.rotation.x + dy * 0.004, -1.18, 1.18);
  };
  const onPointerUp = (event) => {
    if (event.pointerId !== globe.pointerId) return;
    globe.dragging = false;
    globe.pointerId = null;
    canvas.releasePointerCapture?.(event.pointerId);
    dom.mapCanvas.classList.remove("is-panning");
  };
  const onWheel = (event) => {
    event.preventDefault();
    zoomGlobeBy(event.deltaY < 0 ? 1.12 : 1 / 1.12);
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  globe.disposeHandlers.push(() => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
  });
}

function animateGlobe() {
  const globe = state.globe;
  if (!globe || globe.disposed) return;
  if (document.hidden) {
    globe.animationId = window.requestAnimationFrame(animateGlobe);
    return;
  }
  const now = performance.now();
  if (globe.lastFrameAt && now - globe.lastFrameAt < 80) {
    globe.animationId = window.requestAnimationFrame(animateGlobe);
    return;
  }
  globe.lastFrameAt = now;
  if (!globe.dragging) globe.group.rotation.y += 0.00045;
  (globe.connectionFlows || []).forEach((flow) => {
    const progress = ((now / flow.duration + flow.offset) % 1) * (flow.points.length - 1);
    const index = Math.floor(progress);
    flow.dot.position.copy(flow.points[index]).lerp(flow.points[Math.min(index + 1, flow.points.length - 1)], progress - index);
  });
  globe.renderer.render(globe.scene, globe.camera);
  updateGlobeOverlayPositions(globe);
  globe.animationId = window.requestAnimationFrame(animateGlobe);
}

function updateGlobeOverlayPositions(globe) {
  const { camera, group, width, height, overlayItems } = globe;
  const THREE = window.THREE;
  const euler = group.rotation;
  const labelBounds = [];
  overlayItems.forEach((item) => {
    const vector = item.vector.clone().applyEuler(euler);
    const horizon = 1 / camera.position.z;
    const visible = vector.z > horizon;
    if (!visible) {
      item.element.style.opacity = "0";
      return;
    }
    const projected = vector.clone().project(camera);
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height + (item.offsetY || 0);
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(projected.x) > 1.4 || Math.abs(projected.y) > 1.4) {
      item.element.style.opacity = "0";
      return;
    }
    if (item.type === "label") {
      const bounds = { left: x - item.width / 2 - 3, right: x + item.width / 2 + 3, top: y - item.height / 2 - 2, bottom: y + item.height / 2 + 2 };
      if (labelBounds.some((other) => bounds.left < other.right && bounds.right > other.left && bounds.top < other.bottom && bounds.bottom > other.top)) {
        item.element.style.opacity = "0";
        return;
      }
      labelBounds.push(bounds);
    }
    const depthFade = clamp((vector.z - horizon) / 0.25, 0, 1);
    const transform = item.type === "hq" ? `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(45deg)` : `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    item.element.style.transform = transform;
    item.element.style.opacity = String(depthFade);
  });
}

function zoomGlobeBy(factor) {
  const globe = state.globe;
  if (!globe) return;
  if (globe.mode === "canvas") {
    globe.scale = clamp(globe.scale * factor, globe.baseScale * 0.7, globe.baseScale * 16);
    globe.projection.scale(globe.scale);
    return;
  }
  const distance = clamp(globe.camera.position.z / factor, 1.85, 5.2);
  globe.camera.position.z = distance;
}

function resetGlobeView() {
  const globe = state.globe;
  if (!globe) return;
  if (globe.mode === "canvas") {
    globe.scale = globe.baseScale;
    globe.projection.scale(globe.scale);
    const view = regionViews[state.activeRegion] || regionViews.world;
    globe.rotation = [-view.lon, -view.lat, 0];
    globe.projection.rotate(globe.rotation);
    return;
  }
  globe.camera.position.z = globeCameraDistance();
  const view = regionViews[state.activeRegion] || regionViews.world;
  setGlobeRotationForView(globe.group, view.lon, view.lat);
}

function rotateGlobeToActiveRegion() {
  const globe = state.globe;
  if (!globe) return;
  const view = regionViews[state.activeRegion] || regionViews.world;
  if (globe.mode === "canvas") {
    globe.rotation = [-view.lon, -view.lat, 0];
    globe.projection.rotate(globe.rotation);
    return;
  }
  setGlobeRotationForView(globe.group, view.lon, view.lat);
}

function setGlobeRotationForView(group, lon = 15, lat = 18) {
  const toRad = Math.PI / 180;
  group.rotation.x = clamp(lat * toRad, -1.05, 1.05);
  group.rotation.y = -(lon + 90) * toRad;
  group.rotation.z = 0;
}

function globeCameraDistance() {
  if (state.activeRegion === "world") return 3.15;
  if (state.activeRegion === "japan") return 2.15;
  return 2.45;
}

function globeVector(lat, lon, radius, THREE) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function polygonRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates || [];
  if (geometry.type === "MultiPolygon") return (geometry.coordinates || []).flat();
  return [];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setupMapZoom(svg, mapLayer, width, height) {
  const currentTransform = state.mapTransform || d3.zoomIdentity;
  state.zoomBehavior = d3
    .zoom()
    .scaleExtent([0.75, 4200])
    .extent([
      [0, 0],
      [width, height]
    ])
    .translateExtent([
      [-width * 3, -height * 3],
      [width * 4, height * 4]
    ])
    .on("start", () => {
      dom.mapCanvas.classList.add("is-panning");
      hideTooltip();
    })
    .on("zoom", (event) => {
      state.mapTransform = event.transform;
      mapLayer.attr("transform", event.transform);
    })
    .on("end", () => {
      dom.mapCanvas.classList.remove("is-panning");
      scheduleMapTiles(state.mapTransform || d3.zoomIdentity);
      scheduleZoomReadableLayer((state.mapTransform || d3.zoomIdentity).k || 1, true);
    });

  svg.call(state.zoomBehavior);
  svg.call(state.zoomBehavior.transform, currentTransform);
  renderMapTiles(currentTransform);
  scheduleZoomReadableLayer(currentTransform.k || 1, true);
}

function zoomMapBy(factor) {
  if (state.mapMode === "3d") {
    zoomGlobeBy(factor);
    return;
  }
  if (!state.zoomBehavior || !window.d3) return;
  if (factor > 1 && state.activeRegion !== "world" && state.projection && state.mapSize) {
    const focus = zoomFocusViews[state.activeRegion] || regionViews[state.activeRegion];
    const point = focus ? state.projection([focus.lon, focus.lat]) : null;
    if (point) {
      const [minScale, maxScale] = state.zoomBehavior.scaleExtent();
      const current = state.mapTransform || d3.zoomIdentity;
      const nextScale = Math.max(minScale, Math.min(maxScale, current.k * factor));
      const transform = d3.zoomIdentity
        .translate(state.mapSize.width / 2, state.mapSize.height / 2)
        .scale(nextScale)
        .translate(-point[0], -point[1]);
      state.mapTransform = transform;
      d3.select(dom.worldMap).call(state.zoomBehavior.transform, transform);
      return;
    }
  }
  d3.select(dom.worldMap).call(state.zoomBehavior.scaleBy, factor);
}

function resetMapZoom() {
  if (state.mapMode === "3d") {
    resetGlobeView();
    return;
  }
  if (!state.zoomBehavior || !window.d3) return;
  state.mapTransform = d3.zoomIdentity;
  d3.select(dom.worldMap).call(state.zoomBehavior.transform, d3.zoomIdentity);
}

function zoomToActiveRegion() {
  if (state.mapMode === "3d") {
    rotateGlobeToActiveRegion();
    return;
  }
  if (!state.zoomBehavior || !state.projection || !state.mapSize || !window.d3) return;
  const view = regionViews[state.activeRegion] || regionViews.world;
  if (state.activeRegion === "world") {
    resetMapZoom();
    return;
  }

  const [x, y] = state.projection([view.lon, view.lat]) || [state.mapSize.width / 2, state.mapSize.height / 2];
  const transform = d3.zoomIdentity
    .translate(state.mapSize.width / 2, state.mapSize.height / 2)
    .scale(view.scale)
    .translate(-x, -y);

  state.mapTransform = transform;
  d3.select(dom.worldMap).call(state.zoomBehavior.transform, transform);
}

function scheduleZoomReadableLayer(scale, force = false) {
  const k = Math.max(1, Number(scale) || 1);
  if (!force && state.lastReadableScale > 0) {
    const delta = Math.abs(Math.log(k / state.lastReadableScale));
    if (delta < 0.14) return;
  }

  state.pendingReadableScale = k;
  if (state.readableFrame) return;
  state.readableFrame = window.requestAnimationFrame(() => {
    state.readableFrame = null;
    updateZoomReadableLayer(state.pendingReadableScale);
    state.lastReadableScale = state.pendingReadableScale;
  });
}

function scheduleMapTiles(transform) {
  state.pendingTileTransform = transform;
  if (state.tileFrame) return;
  state.tileFrame = window.requestAnimationFrame(() => {
    state.tileFrame = null;
    renderMapTiles(state.pendingTileTransform || state.mapTransform || d3.zoomIdentity);
  });
}

function renderMapTiles(transform = state.mapTransform || d3.zoomIdentity) {
  if (!dom.mapTileLayer || !state.projection || !state.mapSize) return;
  const k = Math.max(1, Number(transform.k) || 1);
  // 詳細地図は負荷が高いため、レイヤーONかつズーム時だけ読み込む。
  const showTiles = state.layers.tiles && k >= 3.2;
  dom.mapCanvas?.classList.toggle("tiles-active", showTiles);
  if (!showTiles) {
    dom.mapTileLayer.innerHTML = "";
    dom.mapTileLayer.style.opacity = "0";
    return;
  }

  const { width, height } = state.mapSize;
  const projection = state.projection;
  const scale = projection.scale();
  const [translateX, translateY] = projection.translate();
  const worldPixels = scale * k * 2 * Math.PI;
  let z = Math.round(Math.log2(worldPixels / 256));
  z = Math.max(2, Math.min(15, z));
  const n = 2 ** z;
  const tileSpan = (scale * k * 2 * Math.PI) / n;

  const localX0 = (0 - transform.x) / k;
  const localX1 = (width - transform.x) / k;
  const localY0 = (0 - transform.y) / k;
  const localY1 = (height - transform.y) / k;

  const projectedXToTile = (x) => ((x - translateX) / scale + Math.PI) / (2 * Math.PI) * n;
  const projectedYToTile = (y) => (Math.PI - (translateY - y) / scale) / (2 * Math.PI) * n;
  const minX = Math.floor(Math.min(projectedXToTile(localX0), projectedXToTile(localX1))) - 1;
  const maxX = Math.ceil(Math.max(projectedXToTile(localX0), projectedXToTile(localX1))) + 1;
  const minY = Math.max(0, Math.floor(Math.min(projectedYToTile(localY0), projectedYToTile(localY1))) - 1);
  const maxY = Math.min(n - 1, Math.ceil(Math.max(projectedYToTile(localY0), projectedYToTile(localY1))) + 1);
  const xCount = Math.max(0, maxX - minX + 1);
  const yCount = Math.max(0, maxY - minY + 1);

  if (!xCount || !yCount || xCount * yCount > 72) {
    dom.mapTileLayer.innerHTML = "";
    dom.mapTileLayer.style.opacity = "0";
    return;
  }

  const servers = ["a", "b", "c", "d"];
  const tiles = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const wrappedX = ((x % n) + n) % n;
      const localLeft = translateX + scale * ((x / n) * 2 * Math.PI - Math.PI);
      const mercatorY = Math.PI - (y / n) * 2 * Math.PI;
      const localTop = translateY - scale * mercatorY;
      const left = transform.x + k * localLeft;
      const top = transform.y + k * localTop;
      const server = servers[Math.abs(x + y) % servers.length];
      tiles.push(`<img alt="" draggable="false" src="https://${server}.basemaps.cartocdn.com/dark_all/${z}/${wrappedX}/${y}.png" style="left:${left.toFixed(1)}px;top:${top.toFixed(1)}px;width:${tileSpan.toFixed(1)}px;height:${tileSpan.toFixed(1)}px" />`);
    }
  }

  dom.mapTileLayer.innerHTML = tiles.join("");
  dom.mapTileLayer.style.opacity = k > 24 ? "0.94" : k > 10 ? "0.82" : k > 4 ? "0.62" : "0.34";
}

function visibleForActiveRegion(item) {
  if (state.activeRegion === "world") return true;
  return item.region === state.activeRegion || (state.activeRegion === "asia" && item.region === "japan") || item.context?.includes(state.activeRegion);
}

function visibleForActiveConnection(connection) {
  if (state.activeRegion === "world") return true;
  const from = connectionNodes[connection.from];
  const to = connectionNodes[connection.to];
  const regions = [from?.region, to?.region].filter(Boolean);
  return regions.includes(state.activeRegion) || (state.activeRegion === "asia" && regions.includes("japan"));
}

function renderConnectionArrowDefs(defs) {
  Object.entries(connectionGroups).forEach(([key, group]) => {
    defs
      .append("marker")
      .attr("id", `connection-arrow-${key}`)
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 7)
      .attr("refY", 0)
      .attr("markerWidth", 7)
      .attr("markerHeight", 7)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L8,0L0,4")
      .attr("fill", group.color)
      .attr("opacity", 0.9);
  });
}

function connectionFeature(connection) {
  const from = connectionNodes[connection.from];
  const to = connectionNodes[connection.to];
  if (!from || !to) return null;

  const interpolate = d3.geoInterpolate([from.lon, from.lat], [to.lon, to.lat]);
  const coordinates = Array.from({ length: 32 }, (_, index) => interpolate(index / 31));
  return { type: "LineString", coordinates };
}

function connectionActivity(connection) {
  const articles = state.data?.articles || [];
  const aliases = {
    "SoftBank AI": ["softbank", "ソフトバンク"],
    "SK Hynix": ["sk hynix", "skハイニックス"],
    "Google DeepMind": ["deepmind", "ディープマインド"],
    "DeepMind London": ["deepmind", "ディープマインド"],
    "Meta AI": ["meta ai", "メタ"],
    Samsung: ["samsung", "サムスン"],
    Alibaba: ["alibaba", "アリババ"],
    Huawei: ["huawei", "ファーウェイ"],
    Baidu: ["baidu", "百度"],
    Microsoft: ["microsoft", "マイクロソフト"]
  };
  const names = [...(aliases[connection.from] || [connection.from.toLowerCase()]), ...(aliases[connection.to] || [connection.to.toLowerCase()])];
  const related = articles.filter((article) => {
    const age = (Date.now() - new Date(article.publishedAt).getTime()) / 3600000;
    const title = `${article.title || ""} ${article.titleJa || ""}`.toLowerCase();
    return age >= 0 && age <= 72 && names.some((name) => title.includes(name));
  });
  return Math.min(18, 1 + related.length * 1.5);
}

function connectionPathId(connection, index) {
  return `dynamic-connection-${index}-${connection.group}-${connection.from}-${connection.to}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function connectionScreenPath(connection, projection) {
  const p1 = projection([connection.fromNode.lon, connection.fromNode.lat]);
  const p2 = projection([connection.toNode.lon, connection.toNode.lat]);
  if (!p1 || !p2) return "";
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  const perpX = -dy / dist;
  const perpY = dx / dist;
  const curvature = Math.min(0.38, 80 / (dist + 1));
  const cx = (x1 + x2) / 2 + perpX * dist * curvature * -1;
  const cy = (y1 + y2) / 2 + perpY * dist * curvature * -1;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

function connectionColor(connection) {
  return connection.color || connectionGroups[connection.group]?.color || "#00d4ff";
}

function connectionEffectiveSpeed(connection) {
  const base = Number(connection.speed || 1);
  const liveBoost = Math.min(0.55, Math.max(0, (connection.activity || 1) - 1) / 30);
  return Math.max(0.35, base * (1 + liveBoost));
}

function renderConnectionLines(svg, path) {
  const projection = path.projection();
  const visible = connectionLines
    .filter(visibleForActiveConnection)
    .map((connection) => ({ ...connection, fromNode: connectionNodes[connection.from], toNode: connectionNodes[connection.to] }))
    .filter((connection) => connection.fromNode && connection.toNode)
    .map((connection, index) => {
      const activity = connectionActivity(connection);
      return {
        ...connection,
        index,
        activity,
        speed: connectionEffectiveSpeed({ ...connection, activity }),
        duration: 10 / connectionEffectiveSpeed({ ...connection, activity }),
        pathId: connectionPathId(connection, index)
      };
    });

  const connectionGroup = svg.append("g").attr("class", "connection-layer");

  connectionGroup
    .selectAll(".connection-glow-path")
    .data(visible)
    .join("path")
    .attr("class", (d) => `connection-glow-path connection-${d.group}`)
    .attr("d", (d) => connectionScreenPath(d, projection))
    .attr("stroke", connectionColor)
    .attr("data-base-stroke", (d) => 4 + Math.min(2.2, d.activity * 0.08))
    .attr("stroke-opacity", (d) => Math.min(0.24, 0.1 + d.activity * 0.006));

  connectionGroup
    .selectAll(".connection-line")
    .data(visible)
    .join("path")
    .attr("class", (d) => `connection-line connection-${d.group}`)
    .attr("id", (d) => d.pathId)
    .attr("data-base-stroke", (d) => 1 + Math.min(0.55, d.activity * 0.018))
    .attr("data-activity", (d) => d.activity)
    .attr("d", (d) => connectionScreenPath(d, projection))
    .attr("stroke", connectionColor)
    .attr("stroke-opacity", (d) => Math.min(0.68, 0.42 + d.activity * 0.012))
    .on("mouseenter", showConnectionTooltip)
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);

  const pulses = connectionGroup
    .selectAll(".connection-pulse")
    .data(visible)
    .join("circle")
    .attr("class", (d) => `connection-pulse connection-${d.group}`)
    .attr("data-base-r", (d) => 2.6 + Math.min(1, d.activity * 0.04))
    .attr("r", (d) => 2.6 + Math.min(1, d.activity * 0.04))
    .attr("fill", connectionColor)
    .attr("fill-opacity", 0.9);

  pulses.each(function (d) {
    const circle = d3.select(this);
    circle.selectAll("*").remove();
    const motion = circle
      .append("animateMotion")
      .attr("dur", `${d.duration.toFixed(2)}s`)
      .attr("repeatCount", "indefinite")
      .attr("calcMode", "linear");
    motion.append("mpath").attr("href", `#${d.pathId}`).attr("xlink:href", `#${d.pathId}`);
  });

  const ringData = [
    ...new Map(
      visible
        .flatMap((connection) => [
          { ...connection.fromNode, key: connection.from, color: connectionColor(connection), activity: connection.activity },
          { ...connection.toNode, key: connection.to, color: connectionColor(connection), activity: connection.activity }
        ])
        .map((node) => [node.key, node])
    ).values()
  ];

  const rings = connectionGroup
    .selectAll(".connection-node-ring")
    .data(ringData.flatMap((node) => [
      { ...node, ring: "outer", delay: "0s" },
      { ...node, ring: "inner", delay: "0.65s" }
    ]))
    .join("circle")
    .attr("class", (d) => `connection-node-ring ${d.ring}`)
    .attr("data-start-r", (d) => (d.ring === "outer" ? 7 : 4))
    .attr("data-end-r", (d) => (d.ring === "outer" ? 20 : 13))
    .attr("cx", (d) => projection([d.lon, d.lat])?.[0] || 0)
    .attr("cy", (d) => projection([d.lon, d.lat])?.[1] || 0)
    .attr("r", (d) => (d.ring === "outer" ? 7 : 4))
    .attr("stroke", (d) => d.color)
    .attr("stroke-width", (d) => (d.ring === "outer" ? 1.5 : 1.1))
    .attr("opacity", 0.56);

  rings.each(function (d) {
    const ring = d3.select(this);
    ring.selectAll("*").remove();
    ring
      .append("animate")
      .attr("attributeName", "r")
      .attr("values", d.ring === "outer" ? "7;20" : "4;13")
      .attr("dur", d.ring === "outer" ? "2.8s" : "2.1s")
      .attr("begin", d.delay)
      .attr("repeatCount", "indefinite");
    ring
      .append("animate")
      .attr("attributeName", "opacity")
      .attr("values", d.ring === "outer" ? "0.5;0" : "0.46;0")
      .attr("dur", d.ring === "outer" ? "2.8s" : "2.1s")
      .attr("begin", d.delay)
      .attr("repeatCount", "indefinite");
  });

  connectionGroup
    .selectAll(".connection-node")
    .data(visible.flatMap((connection) => [
      { ...connection.fromNode, key: `${connection.from}-${connection.group}-from`, group: connection.group, color: connectionColor(connection) },
      { ...connection.toNode, key: `${connection.to}-${connection.group}-to`, group: connection.group, color: connectionColor(connection) }
    ]))
    .join("circle")
    .attr("class", (d) => `connection-node connection-${d.group}`)
    .attr("data-base-r", 3.8)
    .attr("cx", (d) => projection([d.lon, d.lat])?.[0] || 0)
    .attr("cy", (d) => projection([d.lon, d.lat])?.[1] || 0)
    .attr("r", 3.8)
    .attr("fill", (d) => d.color);
}

function renderAlertMarkers(svg, projection, alerts) {
  const alertGroup = svg.append("g").attr("class", "alert-marker-layer");
  const visible = alerts.slice(0, 8);

  alertGroup
    .selectAll(".alert-ring")
    .data(visible)
    .join("circle")
    .attr("class", "alert-ring")
    .attr("cx", (d) => projection([d.lon, d.lat])?.[0] || 0)
    .attr("cy", (d) => projection([d.lon, d.lat])?.[1] || 0)
    .attr("data-base-r", (d) => 12 + Math.min(10, Number(d.urgency || 0) / 10))
    .attr("r", (d) => 12 + Math.min(10, Number(d.urgency || 0) / 10));

  alertGroup
    .selectAll(".alert-marker")
    .data(visible)
    .join("path")
    .attr("class", "alert-marker")
    .attr("data-base-size", 96)
    .attr("d", d3.symbol().type(d3.symbolTriangle).size(96))
    .attr("transform", (d) => {
      const point = projection([d.lon, d.lat]) || [0, 0];
      return `translate(${point[0]},${point[1]}) rotate(180)`;
    })
    .on("mouseenter", showAlertTooltip)
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip)
    .on("click", (_event, d) => {
      openExternalUrl(d.url);
    });
}

function renderLegacyInfrastructureLayers(svg, projection, width) {
  const visibleLabs = LEGACY_AI_LABS.filter((lab) => visibleForActiveRegion(lab) && state.layers[lab.type] !== false);
  const visibleDataCenters = state.layers.datacenter ? LEGACY_DATA_CENTERS.filter(visibleForActiveRegion) : [];
  const labGroup = svg.append("g").attr("class", "legacy-lab-layer");
  const dcGroup = svg.append("g").attr("class", "data-center-layer");

  const dcSymbol = d3.symbol().type(d3.symbolSquare).size(width < 720 ? 44 : 62);
  dcGroup
    .selectAll("path")
    .data(visibleDataCenters)
    .join("path")
    .attr("class", (d) => `data-center-marker ${d.status} ${d.aiTraining ? "training" : ""}`)
    .attr("data-base-size", (d) => (d.aiTraining ? 82 : 58))
    .attr("d", (d) => d3.symbol().type(d3.symbolSquare).size(d.aiTraining ? 82 : 58)())
    .attr("fill", (d) => LEGACY_DC_COLORS[d.company] || LEGACY_DC_COLORS.other)
    .attr("transform", (d) => {
      const point = projection([d.lon, d.lat]) || [0, 0];
      return `translate(${point[0]},${point[1]})`;
    })
    .on("mouseenter", showDataCenterTooltip)
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);

  const labSymbol = d3.symbol().type(d3.symbolCircle).size(width < 720 ? 38 : 52);
  labGroup
    .selectAll("path")
    .data(visibleLabs)
    .join("path")
    .attr("class", (d) => `legacy-lab-marker lab-${d.type} tier-${d.tier}`)
    .attr("data-base-size", (d) => (d.tier === 1 ? 78 : d.tier === 2 ? 56 : 40))
    .attr("d", (d) => d3.symbol().type(d3.symbolCircle).size(d.tier === 1 ? 78 : d.tier === 2 ? 56 : 40)())
    .attr("fill", (d) => LEGACY_LAB_COLORS[d.type] || "#66f0ff")
    .attr("transform", (d) => {
      const point = projection([d.lon, d.lat]) || [0, 0];
      return `translate(${point[0]},${point[1]})`;
    })
    .on("mouseenter", showLegacyLabTooltip)
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip)
    .on("click", (_event, d) => {
      openExternalUrl(d.url);
    });
}

function renderCountryLabels(svg, projection, width) {
  const visible = countryLabels.filter(visibleForActiveRegion);
  const baseSize = width < 720 ? 11 : 14;
  svg
    .append("g")
    .attr("class", "country-label-layer")
    .selectAll("text")
    .data(visible)
    .join("text")
    .attr("class", (d) => `map-label country-label${d.detailOnly ? " detail-label" : ""}`)
    .attr("data-base-size", baseSize)
    .attr("x", (d) => projection([d.lon, d.lat])?.[0] || 0)
    .attr("y", (d) => projection([d.lon, d.lat])?.[1] || 0)
    .attr("text-anchor", "middle")
    .style("font-size", `${baseSize}px`)
    .text((d) => d.name);
}

function renderRegionLabels(svg, projection, width) {
  const visible = regionLabels.filter(visibleForActiveRegion);
  const baseSize = width < 720 ? 16 : 22;
  svg
    .append("g")
    .attr("class", "region-label-layer")
    .selectAll("text")
    .data(visible)
    .join("text")
    .attr("class", (d) => `map-label region-label${d.detailOnly ? " detail-label" : ""}`)
    .attr("data-base-size", baseSize)
    .attr("x", (d) => projection([d.lon, d.lat])?.[0] || 0)
    .attr("y", (d) => projection([d.lon, d.lat])?.[1] || 0)
    .attr("text-anchor", "middle")
    .style("font-size", `${baseSize}px`)
    .text((d) => d.name);
}

function renderCityLabels(svg, projection) {
  const visible = cityLabels.filter(visibleForActiveRegion);
  const cityGroup = svg.append("g").attr("class", "city-label-layer");

  cityGroup
    .selectAll("circle")
    .data(visible)
    .join("circle")
    .attr("class", (d) => `city-dot${d.detailOnly ? " detail-label" : ""}`)
    .attr("data-base-r", (d) => (d.detailOnly ? 2.2 : 2.8))
    .attr("cx", (d) => projection([d.lon, d.lat])?.[0] || 0)
    .attr("cy", (d) => projection([d.lon, d.lat])?.[1] || 0)
    .attr("r", (d) => (d.detailOnly ? 2.2 : 2.8));

  cityGroup
    .selectAll("text")
    .data(visible)
    .join("text")
    .attr("class", (d) => `map-label city-label offset-label${d.detailOnly ? " detail-label" : ""}`)
    .attr("data-base-size", (d) => (d.detailOnly ? 11 : 12))
    .attr("data-anchor-x", (d) => projection([d.lon, d.lat])?.[0] || 0)
    .attr("data-anchor-y", (d) => projection([d.lon, d.lat])?.[1] || 0)
    .attr("data-label-dx", (d) => cityLabelOffset(d).dx)
    .attr("data-label-dy", (d) => cityLabelOffset(d).dy)
    .attr("x", function () {
      return Number(this.getAttribute("data-anchor-x")) + Number(this.getAttribute("data-label-dx"));
    })
    .attr("y", function () {
      return Number(this.getAttribute("data-anchor-y")) + Number(this.getAttribute("data-label-dy"));
    })
    .attr("text-anchor", (d) => cityLabelOffset(d).anchor)
    .text((d) => d.name);
}

function renderCompanyHqLabels(svg, projection, width) {
  const visible = aiCompanyHqLabels.filter(visibleForActiveRegion);
  const labeled = visible.map((company, index) => ({ ...company, labelOffset: companyLabelOffset(company, index, visible) }));
  const companyGroup = svg.append("g").attr("class", "company-hq-layer");
  const baseSymbolSize = width < 720 ? 56 : 76;
  const symbol = d3.symbol().type(d3.symbolDiamond).size(baseSymbolSize);

  companyGroup
    .selectAll("path")
    .data(labeled)
    .join("path")
    .attr("class", "company-hq-marker")
    .attr("data-base-size", baseSymbolSize)
    .attr("d", symbol)
    .attr("transform", (d) => {
      const point = projection([d.lon, d.lat]) || [0, 0];
      return `translate(${point[0]},${point[1]})`;
    })
    .on("mouseenter", showCompanyTooltip)
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip)
    .on("click", (_event, d) => {
      openExternalUrl(d.url);
    });

  companyGroup
    .selectAll("text")
    .data(labeled)
    .join("text")
    .attr("class", "map-label company-hq-label offset-label")
    .attr("data-base-size", 10)
    .attr("data-anchor-x", (d) => projection([d.lon, d.lat])?.[0] || 0)
    .attr("data-anchor-y", (d) => projection([d.lon, d.lat])?.[1] || 0)
    .attr("data-label-dx", (d) => d.labelOffset.dx)
    .attr("data-label-dy", (d) => d.labelOffset.dy)
    .attr("x", function () {
      return Number(this.getAttribute("data-anchor-x")) + Number(this.getAttribute("data-label-dx"));
    })
    .attr("y", function () {
      return Number(this.getAttribute("data-anchor-y")) + Number(this.getAttribute("data-label-dy"));
    })
    .attr("text-anchor", (d) => d.labelOffset.anchor)
    .text((d) => d.name);
}

function renderAutoCompanyHqLabels(svg, projection, width) {
  const visible = autoCompanyHqLabels.filter(visibleForActiveRegion);
  const labeled = visible.map((company, index) => ({ ...company, labelOffset: companyLabelOffset(company, index, visible) }));
  const companyGroup = svg.append("g").attr("class", "auto-hq-layer");
  const baseSymbolSize = width < 720 ? 68 : 88;
  const symbol = d3.symbol().type(d3.symbolTriangle).size(baseSymbolSize);

  companyGroup
    .selectAll("path")
    .data(labeled)
    .join("path")
    .attr("class", "auto-hq-marker")
    .attr("data-base-size", baseSymbolSize)
    .attr("d", symbol)
    .attr("transform", (d) => {
      const point = projection([d.lon, d.lat]) || [0, 0];
      return `translate(${point[0]},${point[1]})`;
    })
    .on("mouseenter", showCompanyTooltip)
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip)
    .on("click", (_event, d) => {
      openExternalUrl(d.url);
    });

  companyGroup
    .selectAll("text")
    .data(labeled)
    .join("text")
    .attr("class", "map-label auto-hq-label offset-label")
    .attr("data-base-size", 10)
    .attr("data-anchor-x", (d) => projection([d.lon, d.lat])?.[0] || 0)
    .attr("data-anchor-y", (d) => projection([d.lon, d.lat])?.[1] || 0)
    .attr("data-label-dx", (d) => d.labelOffset.dx)
    .attr("data-label-dy", (d) => d.labelOffset.dy)
    .attr("x", function () {
      return Number(this.getAttribute("data-anchor-x")) + Number(this.getAttribute("data-label-dx"));
    })
    .attr("y", function () {
      return Number(this.getAttribute("data-anchor-y")) + Number(this.getAttribute("data-label-dy"));
    })
    .attr("text-anchor", (d) => d.labelOffset.anchor)
    .text((d) => d.name);
}

function cityLabelOffset(city) {
  const denseOffsets = {
    東京: { dx: -28, dy: -16, anchor: "end" },
    横浜: { dx: 14, dy: 18, anchor: "start" },
    ソウル: { dx: -24, dy: -15, anchor: "end" },
    台北: { dx: 14, dy: 16, anchor: "start" },
    香港: { dx: -18, dy: 16, anchor: "end" },
    シンガポール: { dx: -18, dy: 15, anchor: "end" }
  };
  if (denseOffsets[city.name]) return denseOffsets[city.name];
  return { dx: 7, dy: -6, anchor: "start" };
}

function companyLabelOffset(company, index, companies) {
  const samePlace = companies.filter((item) => Math.abs(item.lon - company.lon) < 0.04 && Math.abs(item.lat - company.lat) < 0.04);
  const sameIndex = Math.max(0, samePlace.findIndex((item) => item.name === company.name));
  if (samePlace.length <= 1) return { dx: 9, dy: 4, anchor: "start" };
  const center = (samePlace.length - 1) / 2;
  const side = index % 2 === 0 ? 1 : -1;
  return {
    dx: side > 0 ? 11 : -11,
    dy: (sameIndex - center) * 11 + 4,
    anchor: side > 0 ? "start" : "end"
  };
}

function updateZoomReadableLayer(scale) {
  const k = Math.max(1, Number(scale) || 1);
  const detailStart = state.activeRegion === "world" ? 1.45 : 2.7;
  const detailFull = state.activeRegion === "world" ? 2.05 : 4.2;
  const detailOpacity = k >= detailFull ? 1 : k > detailStart ? (k - detailStart) / (detailFull - detailStart) : 0;
  const readableText = d3.select(dom.worldMap).selectAll(".map-label");
  readableText
    .style("font-size", function () {
      const base = Number(this.getAttribute("data-base-size") || 11);
      return `${Math.max(0.002, base / k)}px`;
    })
    .style("stroke-width", `${Math.max(0.001, 4 / k)}px`);

  d3.select(dom.worldMap)
    .selectAll(".offset-label")
    .attr("x", function () {
      const base = Number(this.getAttribute("data-anchor-x") || 0);
      const dx = Number(this.getAttribute("data-label-dx") || 0);
      return base + dx / k;
    })
    .attr("y", function () {
      const base = Number(this.getAttribute("data-anchor-y") || 0);
      const dy = Number(this.getAttribute("data-label-dy") || 0);
      return base + dy / k;
    });

  d3.select(dom.worldMap)
    .selectAll(".country")
    .style("fill-opacity", k > 36 ? 0.16 : k > 18 ? 0.24 : k > 8 ? 0.42 : 0.82)
    .style("stroke-width", `${Math.max(0.0008, 0.52 / k)}px`);

  d3.select(dom.worldMap)
    .selectAll(".graticule")
    .style("opacity", k > 18 ? 0.08 : k > 8 ? 0.18 : 1)
    .style("stroke-width", `${Math.max(0.0008, 0.58 / k)}px`);

  d3.select(dom.worldMap).selectAll(".detail-label").style("opacity", detailOpacity);

  // Label collision checks run only after zooming ends, not during panning.
  const occupied = [];
  const canvasRect = dom.mapCanvas.getBoundingClientRect();
  readableText.style("visibility", "visible").each(function () {
    if (this.classList.contains("detail-label") && detailOpacity === 0) return;
    const bounds = this.getBoundingClientRect();
    const outside = bounds.right < canvasRect.left || bounds.left > canvasRect.right || bounds.bottom < canvasRect.top || bounds.top > canvasRect.bottom;
    const collision = occupied.some((other) => bounds.left < other.right + 2 && bounds.right + 2 > other.left && bounds.top < other.bottom + 2 && bounds.bottom + 2 > other.top);
    if (outside || collision) this.style.visibility = "hidden";
    else occupied.push(bounds);
  });

  d3.select(dom.worldMap)
    .selectAll(".city-dot,.marker,.heat-spot,.alert-ring")
    .attr("r", function () {
      const base = Number(this.getAttribute("data-base-r") || this.getAttribute("r") || 3);
      return Math.max(0.002, base / k);
    })
    .style("stroke-width", `${Math.max(0.001, 1.1 / k)}px`);

  d3.select(dom.worldMap)
    .selectAll(".connection-line")
    .style("stroke-width", function () {
      const base = Number(this.getAttribute("data-base-stroke") || 1.8);
      return `${Math.max(0.001, base / k)}px`;
    })
    .style("stroke-dasharray", function () {
      return `${Math.max(0.002, 4 / k)} ${Math.max(0.002, 6 / k)}`;
    });

  d3.select(dom.worldMap)
    .selectAll(".connection-glow-path")
    .style("stroke-width", function () {
      const base = Number(this.getAttribute("data-base-stroke") || 5);
      return `${Math.max(0.001, base / k)}px`;
    });

  d3.select(dom.worldMap)
    .selectAll(".connection-node")
    .attr("r", function () {
      const base = Number(this.getAttribute("data-base-r") || 3.8);
      return Math.max(0.002, base / k);
    })
    .style("stroke-width", `${Math.max(0.001, 1 / k)}px`);

  d3.select(dom.worldMap)
    .selectAll(".connection-pulse")
    .attr("r", function () {
      const base = Number(this.getAttribute("data-base-r") || 2.4);
      return Math.max(0.002, base / k);
    });

  d3.select(dom.worldMap)
    .selectAll(".connection-node-ring")
    .attr("r", function () {
      return Math.max(0.002, Number(this.getAttribute("data-start-r") || 7) / k);
    })
    .style("stroke-width", `${Math.max(0.001, 1.25 / k)}px`)
    .each(function () {
      const start = Math.max(0.002, Number(this.getAttribute("data-start-r") || 7) / k);
      const end = Math.max(start + 0.002, Number(this.getAttribute("data-end-r") || 20) / k);
      d3.select(this)
        .select('animate[attributeName="r"]')
        .attr("values", `${start};${end}`);
    });

  d3.select(dom.worldMap)
    .selectAll(".heat-spot")
    .style("opacity", k > 10 ? 0.1 : k > 5 ? 0.24 : 1);

  const symbol = d3.symbol().type(d3.symbolDiamond);
  d3.select(dom.worldMap)
    .selectAll(".company-hq-marker")
    .attr("d", function () {
      const base = Number(this.getAttribute("data-base-size") || 64);
      return symbol.size(Math.max(0.000001, base / (k * k)))();
    })
    .style("stroke-width", `${Math.max(0.001, 1.1 / k)}px`);

  d3.select(dom.worldMap)
    .selectAll(".auto-hq-marker")
    .attr("d", function () {
      const base = Number(this.getAttribute("data-base-size") || 76);
      return d3.symbol().type(d3.symbolTriangle).size(Math.max(0.000001, base / (k * k)))();
    })
    .style("stroke-width", `${Math.max(0.001, 1.1 / k)}px`);

  d3.select(dom.worldMap)
    .selectAll(".legacy-lab-marker")
    .attr("d", function () {
      const base = Number(this.getAttribute("data-base-size") || 52);
      return d3.symbol().type(d3.symbolCircle).size(Math.max(0.000001, base / (k * k)))();
    })
    .style("stroke-width", `${Math.max(0.001, 1.1 / k)}px`);

  d3.select(dom.worldMap)
    .selectAll(".data-center-marker")
    .attr("d", function () {
      const base = Number(this.getAttribute("data-base-size") || 58);
      return d3.symbol().type(d3.symbolSquare).size(Math.max(0.000001, base / (k * k)))();
    })
    .style("stroke-width", `${Math.max(0.001, 1.1 / k)}px`);

  d3.select(dom.worldMap)
    .selectAll(".alert-marker")
    .attr("d", function () {
      const base = Number(this.getAttribute("data-base-size") || 96);
      return d3.symbol().type(d3.symbolTriangle).size(Math.max(0.000001, base / (k * k)))();
    })
    .style("stroke-width", `${Math.max(0.001, 1.2 / k)}px`);
}

function countryHeat(feature, markers) {
  const centroid = d3.geoCentroid(feature);
  if (!Number.isFinite(centroid[0]) || !Number.isFinite(centroid[1])) return 0;
  return markers.reduce((sum, marker) => {
    if (state.activeRegion !== "world" && marker.region && marker.region !== state.activeRegion) return sum;
    const distance = geoDistanceKm(centroid[1], centroid[0], marker.lat, marker.lon);
    const radius = marker.region === "japan" || marker.region === "asia" ? 1700 : 2200;
    const base = marker.type === "earthquake" ? 0.9 : 1.25;
    const weight = base * Math.max(1, Number(marker.score || marker.magnitude || 10) / 14);
    return sum + weight * Math.exp(-Math.pow(distance / radius, 2));
  }, 0);
}

function countryFill(score) {
  if (score > 6) return "#d51f1f";
  if (score > 3.8) return "#b94a10";
  if (score > 2.1) return "#8f6412";
  if (score > 0.85) return "#2f6370";
  return "#111a20";
}

function heatLevel(score) {
  if (score > 6) return "critical";
  if (score > 3.8) return "high";
  if (score > 2.1) return "watch";
  if (score > 0.85) return "low";
  return "base";
}

function heatClass(marker) {
  const classes = ["heat-spot"];
  if (marker.region === "japan" || marker.region === "asia") classes.push("asia");
  if (marker.region === "us") classes.push("us");
  if (marker.region === "europe") classes.push("europe");
  if (state.activeRegion !== "world" && marker.region !== state.activeRegion) classes.push("dimmed");
  return classes.join(" ");
}

function geoDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let worldMapPromise = null;

function getWorldMapData() {
  if (!worldMapPromise) {
    worldMapPromise = fetch("./data/countries-50m.json").then((response) => {
      if (!response.ok) throw new Error("world map fetch failed");
      return response.json();
    });
  }
  return worldMapPromise;
}

function markerClass(marker) {
  const classes = ["marker", marker.type === "earthquake" ? "earthquake" : "news"];
  if (state.activeRegion !== "world" && marker.region && marker.region !== state.activeRegion) classes.push("dimmed");
  if (state.activeRegion !== "world" && marker.region === state.activeRegion) classes.push("active");
  return classes.join(" ");
}

function showTooltip(event, marker) {
  dom.mapTooltip.innerHTML = `<strong>${escapeHtml(marker.titleJa || marker.title || "Signal")}</strong><br />
    <span>${escapeHtml(marker.source || marker.type || "")}</span>`;
  dom.mapTooltip.classList.add("visible");
  moveTooltip(event);
}

function showCompanyTooltip(event, company) {
  dom.mapTooltip.innerHTML = `<strong>${escapeHtml(company.name)} 本社</strong><br />
    <span>${escapeHtml(company.placeJa)} / ${escapeHtml(company.categoryJa)}</span>`;
  dom.mapTooltip.classList.add("visible");
  moveTooltip(event);
}

function showConnectionTooltip(event, connection) {
  const group = connectionGroups[connection.group];
  dom.mapTooltip.innerHTML = `<strong>${escapeHtml(connection.from)} → ${escapeHtml(connection.to)}</strong><br />
    <span>${escapeHtml(group?.labelJa || "接続ライン")} / ${escapeHtml(connection.meaning)}</span><br />
    <span>関連報道指標: ${Math.round(connection.activity || 1)} / 設定済み関係図</span><br />
    <span>光点は可視化演出。実際の物流・通信量ではない。</span>`;
  dom.mapTooltip.classList.add("visible");
  moveTooltip(event);
}

function showAlertTooltip(event, article) {
  dom.mapTooltip.innerHTML = `<strong>緊急: ${escapeHtml(article.titleJa || article.title || "Alert")}</strong><br />
    <span>${escapeHtml(regionMeta[article.region]?.labelJa || "世界")} / ${escapeHtml(article.source || "News")} / 緊急度 ${Math.round(article.urgency || 0)}</span><br />
    <span>${escapeHtml((article.topics || []).slice(0, 3).map(topicLabel).join(" / "))}</span>`;
  dom.mapTooltip.classList.add("visible");
  moveTooltip(event);
}

function showLegacyLabTooltip(event, lab) {
  dom.mapTooltip.innerHTML = `<strong>${escapeHtml(lab.nameJa || lab.name)}</strong><br />
    <span>${escapeHtml(labTypeLabel(lab.type))} / ${escapeHtml(lab.cityJa || lab.country)} / Tier ${escapeHtml(String(lab.tier || ""))}</span><br />
    <span>${escapeHtml(lab.description || "")}</span>`;
  dom.mapTooltip.classList.add("visible");
  moveTooltip(event);
}

function showDataCenterTooltip(event, dataCenter) {
  dom.mapTooltip.innerHTML = `<strong>${escapeHtml(dataCenter.nameJa || dataCenter.name)}</strong><br />
    <span>${escapeHtml(dcCompanyLabel(dataCenter.company))} / ${escapeHtml(statusJa(dataCenter.status))}${dataCenter.capacity ? ` / ${escapeHtml(dataCenter.capacity)}` : ""}</span><br />
    <span>${escapeHtml(dataCenter.note || "")}</span>`;
  dom.mapTooltip.classList.add("visible");
  moveTooltip(event);
}

function moveTooltip(event) {
  const rect = dom.mapCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  dom.mapTooltip.style.left = `${Math.min(Math.max(x, 120), rect.width - 120)}px`;
  dom.mapTooltip.style.top = `${Math.max(y - 12, 32)}px`;
}

function hideTooltip() {
  dom.mapTooltip.classList.remove("visible");
}

function labTypeLabel(type) {
  return {
    lab: "AIラボ",
    corp: "AI企業",
    chip: "半導体",
    research: "研究機関",
    japan: "日本拠点"
  }[type] || "AI拠点";
}

function dcCompanyLabel(company) {
  return {
    google: "Google",
    amazon: "AWS",
    meta: "Meta",
    microsoft: "Azure",
    openai: "OpenAI",
    nvidia: "NVIDIA",
    other: "Other"
  }[company] || "Cloud";
}

function statusJa(status) {
  return {
    operational: "稼働中",
    construction: "建設中",
    planned: "計画"
  }[status] || status || "不明";
}

function topicLabel(topic) {
  const labels = {
    models: "生成AI / モデル",
    chips: "半導体 / GPU",
    "data-centers": "データセンター / 電力",
    cloud: "クラウド",
    security: "サイバー",
    policy: "規制 / 政策",
    funding: "投資",
    geopolitics: "世界情勢",
    economy: "経済",
    markets: "市場",
    energy: "資源 / 電力",
    automotive: "自動車 / EV",
    robotics: "ロボティクス",
    quantum: "量子"
  };
  return labels[topic] || topic;
}

function localizeStatus(description = "") {
  const text = String(description);
  if (text.toLowerCase().includes("all systems operational")) return "全システム正常";
  if (text.toLowerCase().includes("partial system outage")) return "一部障害";
  if (text.toLowerCase().includes("major service outage")) return "大規模障害";
  if (text.toLowerCase().includes("degraded performance")) return "性能低下";
  return text;
}

function formatMacroValue(item) {
  if (item.status === "needs_key") return "キー未設定";
  if (item.status === "error") return "取得失敗";
  if (item.status === "blocked") return "取得ブロック";
  if (item.value === null || item.value === undefined || item.value === "") return item.status || "--";
  const numeric = Number(item.value);
  if (!Number.isFinite(numeric)) return String(item.value);
  if (item.source === "CoinGecko") return `$${numeric.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (item.seriesId === "DEXJPUS") return numeric.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
  if (item.seriesId === "PET.RWTC.D") return `$${numeric.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return numeric.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (value == null || Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatRelative(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 60) return `${Math.max(0, minutes)}分前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return formatDateTime(date);
}

function safeExternalHref(value) {
  return escapeAttr(safeExternalUrl(value) || "#");
}

function openExternalUrl(value) {
  const url = safeExternalUrl(value);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value = "") {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
