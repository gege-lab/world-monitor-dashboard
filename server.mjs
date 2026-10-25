import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkLocalRequest, securityHeaders } from "./request-security.mjs";
import { safeExternalUrl } from "./public/url-security.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 4173);
const cacheTtlMs = Number(process.env.CACHE_TTL_MS || 600000);
const defaultTimeoutMs = Number(process.env.FETCH_TIMEOUT_MS || 16000);

const AI_TERMS = [
  "ai",
  "生成ai",
  "生成AI",
  "人工知能",
  "artificial intelligence",
  "generative ai",
  "llm",
  "大規模言語モデル",
  "large language model",
  "machine learning",
  "機械学習",
  "semiconductor",
  "半導体",
  "chip",
  "chips",
  "gpu",
  "nvidia",
  "data center",
  "データセンター",
  "cloud",
  "クラウド",
  "cybersecurity",
  "サイバー",
  "quantum",
  "量子",
  "robotics",
  "ロボット",
  "startup",
  "スタートアップ",
  "openai",
  "anthropic",
  "google",
  "microsoft",
  "amazon",
  "meta",
  "softbank",
  "sony",
  "tsmc",
  "samsung",
  "sk hynix",
  "rapidus"
];

// AI/テック以外の世界情勢・金融・産業・エネルギーをカバーする語彙
const WORLD_TERMS = [
  // 地政学・安全保障
  "geopolitics", "地政学", "世界情勢", "sanction", "sanctions", "制裁", "tariff", "tariffs", "関税",
  "export control", "輸出規制", "war", "戦争", "conflict", "紛争", "ceasefire", "停戦",
  "military", "軍事", "defense", "防衛", "security council", "安全保障", "侵攻", "invasion",
  "missile", "ミサイル", "drone", "ドローン", "nuclear weapon", "核", "coup", "クーデター", "terror", "テロ",
  "ukraine", "ウクライナ", "russia", "ロシア", "putin", "プーチン", "middle east", "中東", "israel", "イスラエル",
  "iran", "イラン", "gaza", "ガザ", "hamas", "ハマス", "north korea", "北朝鮮", "taiwan strait", "台湾", "nato",
  // 政治・政権・外交（トランプ政権など）
  "election", "選挙", "政権", "trump", "トランプ", "biden", "バイデン", "president", "大統領",
  "white house", "ホワイトハウス", "congress", "議会", "senate", "上院", "政府", "government",
  "政策", "policy", "首脳", "summit", "外交", "diplomacy", "diplomatic", "国連", "united nations",
  "移民", "immigration", "国境", "border", "首相", "prime minister", "高市", "石破", "xi jinping", "習近平",
  "国際情勢", "情勢", "危機", "crisis", "緊迫", "対立", "報復", "retaliation",
  // 金融・経済
  "economy", "経済", "gdp", "inflation", "インフレ", "deflation", "recession", "景気",
  "central bank", "中央銀行", "federal reserve", "fomc", "ecb", "日銀", "利上げ", "利下げ",
  "interest rate", "金利", "bond", "国債", "債券", "yield", "利回り",
  "finance", "金融", "bank", "銀行", "債務", "default", "格付け", "imf", "世界銀行", "world bank",
  // 市場
  "stock market", "株式", "株価", "nasdaq", "s&p", "topix", "日経平均", "dow", "為替",
  "currency", "通貨", "forex", "原油", "crude oil", "天然ガス", "natural gas", "lng",
  "gold", "金価格", "bitcoin", "crypto", "暗号資産",
  // 産業・貿易・サプライチェーン・資源
  "trade war", "貿易戦争", "supply chain", "サプライチェーン", "manufacturing", "製造業",
  "industry", "産業", "資源", "rare earth", "レアアース", "energy", "エネルギー", "電力", "power grid"
];

const AUTOMOTIVE_TERMS = [
  "automotive", "auto industry", "automaker", "carmaker", "vehicle", "vehicles", "electric vehicle", "electric vehicles",
  "ev", "battery electric", "autonomous driving", "self-driving", "robotaxi", "software-defined vehicle", "sdv", "adas",
  "自動車", "自動車産業", "自動車業界", "自動車メーカー", "完成車", "電気自動車", "ev", "自動運転", "車載",
  "車載半導体", "蓄電池", "バッテリー", "全固体電池", "水素車", "phev", "hev",
  "toyota", "トヨタ", "honda", "ホンダ", "nissan", "日産", "subaru", "スバル", "mazda", "マツダ",
  "tesla", "gm", "general motors", "ford", "rivian", "lucid", "volkswagen", "vw", "bmw", "mercedes",
  "stellantis", "renault", "byd", "nio", "xpeng", "geely", "saic", "catl", "hyundai", "kia"
];

// AI/テックまたは世界情勢・経済のいずれかに関連すれば採用する
const RELEVANT_TERMS = [...AI_TERMS, ...WORLD_TERMS, ...AUTOMOTIVE_TERMS];
function matchesRelevant(text = "") {
  return matchesAnyTerm(text, RELEVANT_TERMS);
}

const REGION_COORDS = {
  world: { lat: 20, lon: 10, labelJa: "世界", labelEn: "World" },
  us: { lat: 38.5, lon: -97.5, labelJa: "アメリカ", labelEn: "United States" },
  europe: { lat: 51, lon: 10, labelJa: "ヨーロッパ", labelEn: "Europe" },
  asia: { lat: 30, lon: 105, labelJa: "アジア", labelEn: "Asia" },
  japan: { lat: 36.2, lon: 138.2, labelJa: "日本", labelEn: "Japan" }
};

const COUNTRY_COORDS = {
  "United States": { lat: 38.5, lon: -97.5, region: "us", labelJa: "アメリカ" },
  US: { lat: 38.5, lon: -97.5, region: "us", labelJa: "アメリカ" },
  USA: { lat: 38.5, lon: -97.5, region: "us", labelJa: "アメリカ" },
  Japan: { lat: 36.2, lon: 138.2, region: "japan", labelJa: "日本" },
  JP: { lat: 36.2, lon: 138.2, region: "japan", labelJa: "日本" },
  China: { lat: 34, lon: 104, region: "asia", labelJa: "中国" },
  CN: { lat: 34, lon: 104, region: "asia", labelJa: "中国" },
  "South Korea": { lat: 36.5, lon: 127.8, region: "asia", labelJa: "韓国" },
  Korea: { lat: 36.5, lon: 127.8, region: "asia", labelJa: "韓国" },
  Taiwan: { lat: 23.8, lon: 121, region: "asia", labelJa: "台湾" },
  India: { lat: 22.8, lon: 78.8, region: "asia", labelJa: "インド" },
  Singapore: { lat: 1.35, lon: 103.8, region: "asia", labelJa: "シンガポール" },
  Indonesia: { lat: -2.5, lon: 118, region: "asia", labelJa: "インドネシア" },
  Malaysia: { lat: 4, lon: 102, region: "asia", labelJa: "マレーシア" },
  Thailand: { lat: 15.3, lon: 101, region: "asia", labelJa: "タイ" },
  Vietnam: { lat: 15.9, lon: 108, region: "asia", labelJa: "ベトナム" },
  Philippines: { lat: 12.8, lon: 122, region: "asia", labelJa: "フィリピン" },
  Australia: { lat: -25, lon: 134, region: "asia", labelJa: "オーストラリア" },
  Germany: { lat: 51.1, lon: 10.4, region: "europe", labelJa: "ドイツ" },
  France: { lat: 46.2, lon: 2.2, region: "europe", labelJa: "フランス" },
  "United Kingdom": { lat: 54.5, lon: -2.4, region: "europe", labelJa: "英国" },
  UK: { lat: 54.5, lon: -2.4, region: "europe", labelJa: "英国" },
  Italy: { lat: 42.8, lon: 12.5, region: "europe", labelJa: "イタリア" },
  Spain: { lat: 40.4, lon: -3.7, region: "europe", labelJa: "スペイン" },
  Netherlands: { lat: 52.1, lon: 5.3, region: "europe", labelJa: "オランダ" },
  Sweden: { lat: 60, lon: 18.6, region: "europe", labelJa: "スウェーデン" },
  Switzerland: { lat: 46.8, lon: 8.2, region: "europe", labelJa: "スイス" },
  Israel: { lat: 31.5, lon: 35, region: "asia", labelJa: "イスラエル" }
};

const REGION_KEYWORDS = [
  { region: "japan", country: "Japan", words: ["japan", "tokyo", "osaka", "softbank", "sony", "rakuten", "ntt", "nec", "fujitsu", "toyota", "honda", "nissan", "subaru", "mazda", "suzuki", "mitsubishi motors", "hitachi", "rapidus", "sakura internet"] },
  { region: "asia", country: "Taiwan", words: ["taiwan", "tsmc", "taipei"] },
  { region: "asia", country: "South Korea", words: ["south korea", "korea", "samsung", "sk hynix", "seoul", "hyundai", "kia"] },
  { region: "asia", country: "China", words: ["china", "beijing", "shanghai", "shenzhen", "huawei", "baidu", "alibaba", "tencent", "bytedance", "byd", "nio", "xpeng", "geely", "saic", "catl"] },
  { region: "asia", country: "India", words: ["india", "bengaluru", "mumbai", "delhi", "tata", "mahindra", "infosys"] },
  { region: "asia", country: "Singapore", words: ["singapore"] },
  { region: "us", country: "United States", words: ["u.s.", "us ", "united states", "america", "washington", "silicon valley", "california", "detroit", "openai", "anthropic", "nvidia", "microsoft", "google", "amazon", "meta", "tesla", "general motors", "gm", "ford", "rivian", "lucid"] },
  { region: "europe", country: "Germany", words: ["germany", "berlin", "munich", "sap", "volkswagen", "vw", "bmw", "mercedes", "porsche", "bosch"] },
  { region: "europe", country: "France", words: ["france", "paris", "mistral", "renault", "stellantis"] },
  { region: "europe", country: "United Kingdom", words: ["uk", "britain", "london", "united kingdom", "jaguar land rover", "jlr"] },
  { region: "europe", country: "Netherlands", words: ["netherlands", "asml", "amsterdam"] },
  { region: "europe", country: "Europe", words: ["europe", "eu ", "european union", "brussels", "ai act"] }
];

const TOPIC_DEFS = [
  { key: "models", labelJa: "生成AI / モデル", labelEn: "AI models", words: ["llm", "model", "openai", "anthropic", "gemini", "chatgpt", "claude", "large language", "generative ai", "生成ai", "人工知能", "大規模言語モデル"] },
  { key: "chips", labelJa: "半導体 / GPU", labelEn: "Chips", words: ["chip", "chips", "semiconductor", "gpu", "nvidia", "tsmc", "samsung", "sk hynix", "rapidus", "asml", "半導体"] },
  { key: "data-centers", labelJa: "データセンター / 電力", labelEn: "Data centers", words: ["data center", "datacenter", "power", "electricity", "grid", "energy", "nuclear", "データセンター", "電力"] },
  { key: "cloud", labelJa: "クラウド / 基盤", labelEn: "Cloud", words: ["cloud", "aws", "azure", "google cloud", "infrastructure", "server", "クラウド", "基盤"] },
  { key: "security", labelJa: "サイバーセキュリティ", labelEn: "Cybersecurity", words: ["cyber", "security", "breach", "hack", "ransomware", "vulnerability", "サイバー", "セキュリティ"] },
  { key: "policy", labelJa: "規制 / 政策", labelEn: "Policy", words: ["regulation", "policy", "law", "act", "government", "ban", "export control", "antitrust", "規制", "政策"] },
  { key: "funding", labelJa: "投資 / 資金調達", labelEn: "Funding", words: ["funding", "raises", "investment", "venture", "ipo", "acquisition", "merger", "投資", "資金調達", "買収"] },
  { key: "robotics", labelJa: "ロボティクス", labelEn: "Robotics", words: ["robot", "robotics", "automation", "autonomous", "ロボット", "ロボティクス", "自動化"] },
  { key: "quantum", labelJa: "量子", labelEn: "Quantum", words: ["quantum", "量子"] },
  { key: "automotive", labelJa: "自動車 / EV", labelEn: "Automotive", words: AUTOMOTIVE_TERMS },
  { key: "geopolitics", labelJa: "世界情勢", labelEn: "Geopolitics", words: ["geopolitics", "地政学", "世界情勢", "情勢", "sanction", "制裁", "tariff", "関税", "war", "戦争", "conflict", "紛争", "ceasefire", "停戦", "侵攻", "ミサイル", "核", "military", "軍事", "ukraine", "ウクライナ", "russia", "ロシア", "プーチン", "middle east", "中東", "israel", "イスラエル", "iran", "イラン", "ガザ", "北朝鮮", "taiwan", "台湾", "nato", "election", "選挙", "政権", "trump", "トランプ", "大統領", "ホワイトハウス", "議会", "外交", "首脳", "国連", "移民", "高市", "習近平"] },
  { key: "economy", labelJa: "経済", labelEn: "Economy", words: ["economy", "経済", "gdp", "inflation", "インフレ", "recession", "景気", "central bank", "中央銀行", "federal reserve", "fomc", "ecb", "日銀", "interest rate", "金利", "bond", "国債", "finance", "金融", "imf", "債務"] },
  { key: "markets", labelJa: "市場", labelEn: "Markets", words: ["stock", "株式", "株価", "nasdaq", "s&p", "topix", "日経", "dow", "為替", "currency", "forex", "原油", "oil", "gas", "gold", "金価格", "bitcoin", "crypto", "暗号資産"] },
  { key: "energy", labelJa: "資源 / 電力", labelEn: "Energy", words: ["energy", "エネルギー", "電力", "power grid", "送電", "原油", "天然ガス", "lng", "rare earth", "レアアース", "資源", "発電", "原子力", "nuclear"] }
];

const GLOSSARY = [
  ["artificial intelligence", "人工知能"],
  ["generative ai", "生成AI"],
  ["large language model", "大規模言語モデル"],
  ["machine learning", "機械学習"],
  ["semiconductors", "半導体"],
  ["semiconductor", "半導体"],
  ["data centers", "データセンター"],
  ["data center", "データセンター"],
  ["cybersecurity", "サイバーセキュリティ"],
  ["security", "セキュリティ"],
  ["regulation", "規制"],
  ["policy", "政策"],
  ["funding", "資金調達"],
  ["startup", "スタートアップ"],
  ["startups", "スタートアップ"],
  ["chip", "チップ"],
  ["chips", "チップ"],
  ["cloud", "クラウド"],
  ["quantum", "量子"],
  ["robotics", "ロボティクス"],
  ["automotive", "自動車"],
  ["auto industry", "自動車業界"],
  ["automaker", "自動車メーカー"],
  ["carmaker", "自動車メーカー"],
  ["electric vehicles", "電気自動車"],
  ["electric vehicle", "電気自動車"],
  ["autonomous driving", "自動運転"],
  ["self-driving", "自動運転"],
  ["software-defined vehicle", "ソフトウェア定義車両"],
  ["Toyota", "トヨタ"],
  ["Honda", "ホンダ"],
  ["Nissan", "日産"],
  ["Tesla", "テスラ"],
  ["Volkswagen", "フォルクスワーゲン"],
  ["General Motors", "GM"],
  ["Ford", "フォード"],
  ["BYD", "BYD"],
  ["Hyundai", "現代自動車"],
  ["Kia", "起亜"],
  ["launches", "発表"],
  ["launch", "発表"],
  ["announces", "発表"],
  ["announce", "発表"],
  ["raises", "調達"],
  ["partners with", "提携"],
  ["partnership", "提携"],
  ["acquires", "買収"],
  ["acquisition", "買収"],
  ["open source", "オープンソース"],
  ["export controls", "輸出規制"],
  ["United States", "アメリカ"],
  ["U.S.", "アメリカ"],
  ["Europe", "ヨーロッパ"],
  ["European", "欧州"],
  ["Japan", "日本"],
  ["China", "中国"],
  ["Taiwan", "台湾"],
  ["South Korea", "韓国"],
  ["India", "インド"]
];

const fallbackArticles = [
  {
    id: "fallback-japan-ai",
    title: "Japan AI and semiconductor monitor is waiting for live GDELT data",
    titleJa: "日本のAI・半導体モニターはライブデータ接続待ちです",
    signalJa: "日本のAI、クラウド、半導体関連のニュースを優先監視します。",
    source: "System fallback",
    url: "https://www.gdeltproject.org/",
    sourceCountry: "Japan",
    region: "japan",
    country: "Japan",
    lat: 36.2,
    lon: 138.2,
    topics: ["models", "chips"],
    tone: 0.62,
    publishedAt: new Date().toISOString(),
    live: false
  },
  {
    id: "fallback-asia-chips",
    title: "Asia technology supply-chain monitor is waiting for live GDELT data",
    titleJa: "アジアの技術サプライチェーン監視はライブデータ接続待ちです",
    signalJa: "台湾、韓国、中国、インド、シンガポールのAI/Techシグナルを集約します。",
    source: "System fallback",
    url: "https://www.gdeltproject.org/",
    sourceCountry: "Asia",
    region: "asia",
    country: "Taiwan",
    lat: 23.8,
    lon: 121,
    topics: ["chips", "data-centers"],
    tone: 0.58,
    publishedAt: new Date().toISOString(),
    live: false
  },
  {
    id: "fallback-us-models",
    title: "US AI model and cloud monitor is waiting for live data",
    titleJa: "アメリカのAIモデル・クラウド監視はライブデータ接続待ちです",
    signalJa: "主要AI企業、クラウド基盤、GPU需要を追跡します。",
    source: "System fallback",
    url: "https://news.ycombinator.com/",
    sourceCountry: "United States",
    region: "us",
    country: "United States",
    lat: 38.5,
    lon: -97.5,
    topics: ["models", "cloud"],
    tone: 0.55,
    publishedAt: new Date().toISOString(),
    live: false
  }
];

const GITHUB_AI_TOPICS = [
  "artificial-intelligence",
  "machine-learning",
  "deep-learning",
  "llm",
  "nlp",
  "computer-vision",
  "neural-network",
  "pytorch",
  "tensorflow",
  "transformers"
];

const responseCache = new Map();
const pendingCache = new Map();

function normalizeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isProbablyJapanese(text = "") {
  return /[\u3040-\u30ff]/.test(text);
}

function containsTerm(text = "", term = "") {
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  if (/^[a-z0-9 -]+$/.test(needle)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}s?([^a-z0-9]|$)`, "i").test(lower);
  }
  return lower.includes(needle);
}

function matchesAnyTerm(text = "", terms = AI_TERMS) {
  return terms.some((term) => containsTerm(text, term));
}

function generatedJapaneseTitle(context = {}) {
  const place = context.countryJa || REGION_COORDS[context.region]?.labelJa || "世界";
  const labels = topicLabels(context.topics || []).slice(0, 2).join("・");
  return `${place}の${labels}ニュース`;
}

function latinRatio(text = "") {
  const letters = text.match(/[A-Za-z]/g)?.length || 0;
  const visible = text.replace(/\s/g, "").length || 1;
  return letters / visible;
}

function localizeTitle(title = "", language = "", context = {}) {
  const raw = normalizeText(title);
  if (!raw) return "タイトル未取得";
  if (isProbablyJapanese(raw) || language.toLowerCase().startsWith("jap")) return raw;

  let localized = raw;
  for (const [from, to] of GLOSSARY) {
    localized = localized.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, "gi"), to);
  }

  const changed = localized !== raw;
  if (!changed) {
    return generatedJapaneseTitle(context);
  }
  if (latinRatio(localized) > 0.45) return generatedJapaneseTitle(context);
  return localized;
}

function inferTopics(text = "") {
  const lower = text.toLowerCase().replace(/\be[\s-]?power\b/g, "").replace(/サイバーキャブ/g, "");
  return TOPIC_DEFS.filter((topic) => topic.words.some((word) => containsTerm(lower, word))).map((topic) => topic.key);
}

function topicLabels(topicKeys = []) {
  const labels = topicKeys
    .map((key) => TOPIC_DEFS.find((topic) => topic.key === key)?.labelJa)
    .filter(Boolean);
  return labels.length ? labels : ["AI / Tech"];
}

function inferCountryAndRegion(article = {}) {
  const combined = `${article.title || ""} ${article.domain || ""} ${article.source || ""} ${article.sourceCountry || ""}`.toLowerCase();
  const explicitCountry = article.sourceCountry || article.country || "";
  const direct = COUNTRY_COORDS[explicitCountry] || COUNTRY_COORDS[explicitCountry.toUpperCase?.()];
  if (direct) {
    return { country: explicitCountry, region: direct.region, lat: direct.lat, lon: direct.lon, countryJa: direct.labelJa };
  }

  for (const item of REGION_KEYWORDS) {
    if (item.words.some((word) => combined.includes(word))) {
      const coords = COUNTRY_COORDS[item.country] || REGION_COORDS[item.region];
      return {
        country: item.country,
        region: item.region,
        lat: coords.lat,
        lon: coords.lon,
        countryJa: coords.labelJa || REGION_COORDS[item.region].labelJa
      };
    }
  }

  return {
    country: "World",
    region: "world",
    lat: REGION_COORDS.world.lat,
    lon: REGION_COORDS.world.lon,
    countryJa: "世界"
  };
}

function makeSignalJa(article, topics) {
  const labels = topicLabels(topics).slice(0, 3).join("、");
  const place = article.countryJa || REGION_COORDS[article.region]?.labelJa || "世界";
  const source = article.source || article.domain || "ニュース";
  return `${place}発: ${labels}に関する動き。出典は${source}。`;
}

function scoreArticle(article) {
  const topicWeight = article.topics?.length ? article.topics.length * 8 : 0;
  const regionWeight = article.region === "japan" ? 18 : article.region === "asia" ? 14 : 5;
  const sourceWeight = article.source === "Hacker News" ? Math.min(24, Math.log1p(article.score || 0) * 5) : 7;
  const freshnessMs = Date.now() - new Date(article.publishedAt || Date.now()).getTime();
  const freshnessWeight = Number.isFinite(freshnessMs) ? Math.max(0, 18 - freshnessMs / 3600000) : 4;
  return Math.round(topicWeight + regionWeight + sourceWeight + freshnessWeight);
}

function normalizeGdeltArticle(item) {
  const title = normalizeText(item.title || "");
  const url = safeExternalUrl(item.url) || safeExternalUrl(item.url_mobile);
  const article = {
    id: url || `gdelt-${title}`,
    title,
    language: item.language || "",
    source: item.domain || item.source || "GDELT",
    domain: item.domain || "",
    url,
    image: item.socialimage || "",
    sourceCountry: item.sourcecountry || item.sourceCountry || "",
    publishedAt: parseGdeltDate(item.seendate) || new Date().toISOString(),
    live: true
  };

  const located = inferCountryAndRegion(article);
  const topics = inferTopics(`${title} ${article.source}`);
  const context = { ...article, ...located, topics };
  return {
    ...article,
    ...located,
    topics,
    titleJa: localizeTitle(title, article.language, context),
    signalJa: makeSignalJa(context, topics),
    tone: Math.min(0.95, 0.46 + topics.length * 0.08)
  };
}

function normalizeHackerNewsItem(item) {
  const title = normalizeText(item.title || "");
  const article = {
    id: `hn-${item.id}`,
    title,
    language: "English",
    source: "Hacker News",
    domain: item.url ? safeDomain(item.url) : "news.ycombinator.com",
    url: safeExternalUrl(item.url) || `https://news.ycombinator.com/item?id=${encodeURIComponent(item.id)}`,
    sourceCountry: "",
    publishedAt: item.time ? new Date(item.time * 1000).toISOString() : new Date().toISOString(),
    score: item.score || 0,
    comments: item.descendants || 0,
    live: true
  };
  const located = inferCountryAndRegion(article);
  const topics = inferTopics(title);
  const context = { ...article, ...located, topics };
  return {
    ...article,
    ...located,
    topics,
    titleJa: localizeTitle(title, article.language, context),
    signalJa: makeSignalJa(context, topics),
    tone: Math.min(0.95, 0.45 + Math.log1p(item.score || 0) / 16)
  };
}

function normalizeRssArticle(item, tag) {
  const article = {
    id: item.link || `rss-${tag}-${item.title}`,
    title: item.title,
    language: isProbablyJapanese(item.title) ? "Japanese" : "English",
    source: item.source || "Google News",
    domain: item.link ? safeDomain(item.link) : "news.google.com",
    url: safeExternalUrl(item.link) || "https://news.google.com/",
    sourceCountry: tag === "japan" ? "Japan" : "",
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    live: true
  };
  const inferred = inferCountryAndRegion(article);
  const defaultCenter = tag === "japan" ? COUNTRY_COORDS.Japan : REGION_COORDS[tag];
  const located = defaultCenter
    ? {
        country: tag === "japan" ? "Japan" : defaultCenter.labelEn,
        region: tag,
        lat: defaultCenter.lat,
        lon: defaultCenter.lon,
        countryJa: defaultCenter.labelJa
      }
    : inferred;
  const normalizedLocation = {
    country: tag === "japan" ? "Japan" : located.country,
    region: tag === "japan" ? "japan" : located.region,
    lat: located.lat,
    lon: located.lon,
    countryJa: tag === "japan" ? "日本" : located.countryJa
  };
  const topics = inferTopics(`${article.title} ${article.source}`);
  const context = { ...article, ...normalizedLocation, topics };
  return {
    ...article,
    ...normalizedLocation,
    topics,
    titleJa: localizeTitle(article.title, article.language, context),
    signalJa: makeSignalJa(context, topics),
    tone: Math.min(0.95, 0.52 + topics.length * 0.07)
  };
}

function safeDomain(input) {
  try {
    return new URL(input).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function parseGdeltDate(value) {
  if (!value) return "";
  const text = String(value);
  if (/^\d{14}$/.test(text)) {
    const y = text.slice(0, 4);
    const m = text.slice(4, 6);
    const d = text.slice(6, 8);
    const hh = text.slice(8, 10);
    const mm = text.slice(10, 12);
    const ss = text.slice(12, 14);
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`).toISOString();
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || defaultTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "WorldMonitorAI/0.1 (local dashboard)",
        Accept: "application/json,text/plain,*/*",
        ...(options.headers || {})
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || defaultTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "WorldMonitorAI/0.1 (local dashboard)",
        Accept: "application/rss+xml,text/xml,text/plain,*/*",
        ...(options.headers || {})
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function cached(key, fn, ttlMs = cacheTtlMs) {
  const now = Date.now();
  const hit = responseCache.get(key);
  if (hit && now - hit.time < ttlMs) return hit.value;

  if (pendingCache.has(key)) return pendingCache.get(key);
  const pending = Promise.resolve().then(fn).then((value) => {
    responseCache.set(key, { time: Date.now(), value });
    return value;
  }).catch((error) => {
    if (hit) return hit.value;
    throw error;
  }).finally(() => pendingCache.delete(key));
  pendingCache.set(key, pending);
  return pending;
}

async function fetchGdelt(query, tag, maxRecords = 24, timespan = "3d") {
  const params = new URLSearchParams({
    query,
    mode: "ArtList",
    format: "json",
    maxrecords: String(maxRecords),
    sort: "DateDesc",
    timespan
  });
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;
  const json = await cached(`gdelt:${tag}:${query}`, () => fetchJson(url), 300000);
  return (json.articles || []).map(normalizeGdeltArticle);
}

function decodeXml(value = "") {
  return normalizeText(
    value
      .replaceAll("<![CDATA[", "")
      .replaceAll("]]>", "")
      .replaceAll("&amp;", "&")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'")
  );
}

function getTagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function parseRssItems(xml) {
  const items = [];
  const matches = xml.matchAll(/<item\b[\s\S]*?<\/item>/gi);
  for (const match of matches) {
    const block = match[0];
    const sourceMatch = block.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i);
    items.push({
      title: getTagValue(block, "title"),
      link: getTagValue(block, "link"),
      pubDate: getTagValue(block, "pubDate"),
      source: sourceMatch ? decodeXml(sourceMatch[1]) : "Google News"
    });
  }
  return items.filter((item) => item.title);
}

async function fetchGoogleNewsRss(query, tag) {
  const params = new URLSearchParams({
    q: `${query} when:7d`,
    hl: "ja",
    gl: "JP",
    ceid: "JP:ja"
  });
  const url = `https://news.google.com/rss/search?${params.toString()}`;
  const xml = await cached(`gnews:${tag}:${query}`, () => fetchText(url, { timeoutMs: 10000 }), 300000);
  return parseRssItems(xml)
    .map((item) => normalizeRssArticle(item, tag))
    .filter((article) => matchesRelevant(`${article.title} ${article.titleJa} ${article.source}`))
    .slice(0, 18);
}

async function fetchNewsArticles() {
  const queries = [
    {
      tag: "world",
      query: '("artificial intelligence" OR "generative AI" OR semiconductor OR cybersecurity OR "data center" OR quantum OR robotics OR automotive OR automaker OR "electric vehicle" OR "autonomous driving" OR "auto industry")'
    },
    {
      tag: "japan",
      query: '(Japan OR Tokyo OR SoftBank OR Sony OR NTT OR NEC OR Fujitsu OR Toyota OR Honda OR Nissan OR Subaru OR Mazda OR Suzuki OR Rapidus OR "Sakura Internet") ("artificial intelligence" OR AI OR semiconductor OR cloud OR "data center" OR robotics OR automotive OR automaker OR "electric vehicle" OR EV OR "autonomous driving" OR battery)'
    },
    {
      tag: "asia",
      query: '("South Korea" OR Taiwan OR China OR India OR Singapore OR TSMC OR Samsung OR "SK Hynix" OR Huawei OR Alibaba OR Tencent OR BYD OR Hyundai OR Kia OR CATL OR NIO OR XPeng OR Geely) ("artificial intelligence" OR AI OR semiconductor OR chips OR "data center" OR cloud OR automotive OR automaker OR "electric vehicle" OR EV OR "autonomous driving" OR battery)'
    },
    {
      tag: "us",
      query: '("United States" OR OpenAI OR Anthropic OR Nvidia OR Microsoft OR Google OR Amazon OR Meta OR Tesla OR "General Motors" OR Ford OR Rivian OR Lucid) ("artificial intelligence" OR AI OR semiconductor OR GPU OR "data center" OR cloud OR automotive OR automaker OR "electric vehicle" OR EV OR "autonomous driving" OR robotaxi)'
    },
    {
      tag: "europe",
      query: '(Europe OR EU OR "United Kingdom" OR Germany OR France OR Netherlands OR ASML OR Mistral OR Volkswagen OR BMW OR Mercedes OR Stellantis OR Renault OR Volvo) ("artificial intelligence" OR AI OR semiconductor OR "AI Act" OR cloud OR cybersecurity OR automotive OR automaker OR "electric vehicle" OR EV OR battery)'
    }
  ];

  const gdeltSettled = await Promise.allSettled(queries.map((item) => fetchGdelt(item.query, item.tag, item.tag === "world" ? 30 : 24, item.tag === "world" ? "1d" : "1week")));
  const rssQueries = [
    { tag: "japan", query: "日本 AI OR 生成AI OR 半導体 OR データセンター" },
    { tag: "asia", query: "アジア AI OR 生成AI OR 半導体 OR TSMC OR Samsung" },
    { tag: "us", query: "OpenAI OR Anthropic OR Nvidia OR Microsoft AI" },
    { tag: "europe", query: "Europe AI Act OR Mistral AI OR ASML semiconductor" },
    // 世界情勢・金融・産業の幅広いニュース（日本語見出しで取得）
    { tag: "world", query: "世界情勢 OR 地政学 OR 制裁 OR 関税 OR 紛争 OR 安全保障" },
    { tag: "world", query: "世界経済 OR 金融 OR 為替 OR 株価 OR 中央銀行 OR インフレ OR 金利" },
    { tag: "world", query: "貿易戦争 OR サプライチェーン OR 半導体規制 OR レアアース OR エネルギー OR 原油" },
    // 世界の自動車業界（EV、自動運転、車載半導体、電池、地域別メーカー）
    { tag: "world", query: "世界 自動車業界 OR 自動車産業 OR EV OR 電気自動車 OR 自動運転 OR 車載半導体 OR バッテリー" },
    { tag: "japan", query: "日本 自動車業界 OR トヨタ OR ホンダ OR 日産 OR スバル OR マツダ OR EV OR 自動運転" },
    { tag: "asia", query: "アジア 自動車業界 OR BYD OR 現代自動車 OR 起亜 OR CATL OR NIO OR XPeng OR EV" },
    { tag: "us", query: "米国 自動車業界 OR Tesla OR GM OR Ford OR Rivian OR Lucid OR EV OR 自動運転" },
    { tag: "europe", query: "欧州 自動車業界 OR Volkswagen OR BMW OR Mercedes OR Stellantis OR Renault OR EV OR 電池" },
    // 政治・政権（トランプ政権など）
    { tag: "us", query: "トランプ OR トランプ政権 OR ホワイトハウス OR 米大統領 OR 米政権 OR 米議会" },
    { tag: "world", query: "大統領 OR 首脳会談 OR 外交 OR 国連 OR 移民 OR 政権 OR 選挙" },
    // 戦争・安全保障リスク
    { tag: "world", query: "戦争 OR 軍事 OR 侵攻 OR ミサイル OR 核 OR 北朝鮮 OR 中東情勢" },
    { tag: "world", query: "ウクライナ OR ロシア OR イスラエル OR イラン OR ガザ OR 台湾有事" },
    // 今流れている国際ニュース全般（速報・トップ）
    { tag: "world", query: "国際 ニュース OR 速報 OR 世界 情勢" }
  ];
  const rssSettled = await Promise.allSettled(rssQueries.map((item) => fetchGoogleNewsRss(item.query, item.tag)));
  const articles = [];
  const apiStatus = {};

  for (let i = 0; i < gdeltSettled.length; i += 1) {
    const tag = queries[i].tag;
    const result = gdeltSettled[i];
    if (result.status === "fulfilled") {
      apiStatus[`gdelt_${tag}`] = { ok: true, count: result.value.length };
      articles.push(...result.value);
    } else {
      apiStatus[`gdelt_${tag}`] = { ok: false, message: result.reason?.message || "fetch failed" };
    }
  }

  for (let i = 0; i < rssSettled.length; i += 1) {
    const tag = rssQueries[i].tag;
    const result = rssSettled[i];
    if (result.status === "fulfilled") {
      apiStatus[`googleNews_${tag}`] = { ok: true, count: result.value.length };
      articles.push(...result.value);
    } else {
      apiStatus[`googleNews_${tag}`] = { ok: false, message: result.reason?.message || "fetch failed" };
    }
  }

  const deduped = dedupeArticles(articles).filter((article) => {
    const text = `${article.title} ${article.source}`.toLowerCase();
    return matchesRelevant(text);
  });

  return {
    articles: deduped.length ? deduped : fallbackArticles,
    apiStatus
  };
}

async function fetchHackerNews() {
  const list = await cached("hn:topstories", () => fetchJson("https://hacker-news.firebaseio.com/v0/topstories.json"), 120000);
  const ids = list.slice(0, 70);
  const items = await Promise.allSettled(ids.map((id) => cached(`hn:item:${id}`, () => fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`), 300000)));
  return items
    .filter((result) => result.status === "fulfilled" && result.value && !result.value.deleted && result.value.title)
    .map((result) => normalizeHackerNewsItem(result.value))
    .filter((article) => {
      const text = `${article.title} ${article.domain}`.toLowerCase();
      return matchesAnyTerm(text);
    })
    .slice(0, 18);
}

async function fetchGitHubTrending() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const primaryTopics = ["artificial-intelligence", "llm", "machine-learning"];
  const settled = await Promise.allSettled(
    primaryTopics.map((topic) => {
      const params = new URLSearchParams({
        q: `topic:${topic} created:>${weekAgo} stars:>50`,
        sort: "stars",
        order: "desc",
        per_page: "8"
      });
      return cached(`github:ai-trending:${topic}:${weekAgo}`, () =>
        fetchJson(`https://api.github.com/search/repositories?${params.toString()}`, {
          timeoutMs: 12000,
          headers: { Accept: "application/vnd.github.v3+json" }
        }),
      900000);
    })
  );
  const repos = settled.flatMap((result) => (result.status === "fulfilled" ? result.value.items || [] : []));
  const uniqueRepos = Array.from(new Map(repos.map((repo) => [repo.id, repo])).values());

  return uniqueRepos
    .map((repo) => {
      const topics = Array.isArray(repo.topics) ? repo.topics : [];
      const haystack = `${repo.full_name || ""} ${repo.description || ""} ${topics.join(" ")}`.toLowerCase();
      return {
        id: `github-${repo.id}`,
        name: repo.name || "",
        fullName: repo.full_name || repo.name || "",
        description: normalizeText(repo.description || ""),
        url: safeExternalUrl(repo.html_url),
        stars: repo.stargazers_count || 0,
        language: repo.language || "",
        topics,
        isAI: topics.some((topic) => GITHUB_AI_TOPICS.includes(topic)) || matchesAnyTerm(haystack)
      };
    })
    .filter((repo) => repo.isAI)
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 10);
}

function normalizeDevToArticle(item, tag = "ai") {
  const title = normalizeText(item.title || "");
  const published = item.published_at ? new Date(item.published_at) : new Date();
  const tagList = Array.isArray(item.tag_list) ? item.tag_list : [];
  const article = {
    id: `devto-${item.id}`,
    title,
    language: "English",
    source: "Dev.to",
    domain: "dev.to",
    url: safeExternalUrl(item.url) || "https://dev.to/",
    sourceCountry: tag === "japan" ? "Japan" : "",
    publishedAt: Number.isNaN(published.getTime()) ? new Date().toISOString() : published.toISOString(),
    score: item.positive_reactions_count || 0,
    comments: item.comments_count || 0,
    author: item.user?.name || "",
    tags: tagList,
    live: true
  };
  const located = inferCountryAndRegion(article);
  const inferredTopics = inferTopics(`${title} ${tagList.join(" ")}`);
  const topics = inferredTopics.length ? inferredTopics : ["models"];
  const context = { ...article, ...located, topics };
  return {
    ...article,
    ...located,
    topics,
    titleJa: localizeTitle(title, article.language, context),
    signalJa: makeSignalJa(context, topics),
    tone: Math.min(0.95, 0.48 + Math.log1p(article.score || 0) / 18)
  };
}

async function fetchDevToTag(tag, count = 8) {
  const params = new URLSearchParams({
    tag,
    per_page: String(count),
    top: "1"
  });
  const json = await cached(`devto:${tag}`, () => fetchJson(`https://dev.to/api/articles?${params.toString()}`, { timeoutMs: 10000 }), 600000);
  return Array.isArray(json) ? json.map((item) => normalizeDevToArticle(item, tag)) : [];
}

async function fetchDevToArticles() {
  const tags = [
    ["ai", 8],
    ["machinelearning", 5],
    ["llm", 5],
    ["japan", 5]
  ];
  const settled = await Promise.allSettled(tags.map(([tag, count]) => fetchDevToTag(tag, count)));
  const articles = [];
  for (const result of settled) {
    if (result.status === "fulfilled") articles.push(...result.value);
  }
  const unique = Array.from(new Map(articles.map((article) => [article.id, article])).values());
  return unique
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 14);
}

async function fetchEarthquakes() {
  const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson";
  const json = await cached("usgs:4.5_day", () => fetchJson(url), 180000);
  return (json.features || [])
    .slice(0, 30)
    .map((feature) => {
      const [lon, lat] = feature.geometry?.coordinates || [];
      return {
        id: feature.id,
        type: "earthquake",
        title: feature.properties?.title || "Earthquake",
        titleJa: `M${feature.properties?.mag ?? "?"} 地震: ${normalizeText(feature.properties?.place || feature.properties?.title || "地点未取得")}`,
        signalJa: `地政学・供給網リスクの補助指標: M${feature.properties?.mag ?? "?"} 地震。`,
        url: safeExternalUrl(feature.properties?.url) || "https://earthquake.usgs.gov/",
        lat,
        lon,
        magnitude: feature.properties?.mag,
        publishedAt: feature.properties?.time ? new Date(feature.properties.time).toISOString() : new Date().toISOString(),
        live: true
      };
    })
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));
}

async function fetchStatusPages() {
  const services = [
    ["OpenAI", "https://status.openai.com/api/v2/status.json"],
    ["GitHub", "https://www.githubstatus.com/api/v2/status.json"],
    ["Cloudflare", "https://www.cloudflarestatus.com/api/v2/status.json"]
  ];
  const settled = await Promise.allSettled(
    services.map(async ([name, url]) => {
      const json = await cached(`status:${name}`, () => fetchJson(url), 120000);
      return {
        name,
        indicator: json.status?.indicator || "unknown",
        description: json.status?.description || "Status unavailable",
        updatedAt: json.page?.updated_at || new Date().toISOString()
      };
    })
  );

  return settled.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    return {
      name: services[index][0],
      indicator: "unknown",
      description: "取得失敗",
      updatedAt: new Date().toISOString(),
      error: result.reason?.message || "fetch failed"
    };
  });
}

async function fetchFredSeries(seriesId, labelJa, labelEn) {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return { source: "FRED", seriesId, labelJa, labelEn, status: "needs_key", noteJa: "FRED_API_KEY 未設定" };
  }
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: "json",
    sort_order: "desc",
    limit: "2"
  });
  const json = await cached(`fred:${seriesId}`, () => fetchJson(`https://api.stlouisfed.org/fred/series/observations?${params}`), 900000);
  const latest = (json.observations || []).find((item) => item.value && item.value !== ".");
  return {
    source: "FRED",
    seriesId,
    labelJa,
    labelEn,
    status: latest ? "ok" : "empty",
    value: latest?.value || null,
    date: latest?.date || null
  };
}

async function fetchEiaSeries() {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    return null;
  }
  const json = await cached("eia:PET.RWTC.D", () => fetchJson(`https://api.eia.gov/v2/seriesid/PET.RWTC.D?api_key=${encodeURIComponent(apiKey)}`), 900000);
  const row = json.response?.data?.[0] || json.series?.[0]?.data?.[0] || null;
  const value = Array.isArray(row) ? row[1] : row?.value;
  const date = Array.isArray(row) ? row[0] : row?.period;
  return {
    source: "EIA",
    seriesId: "PET.RWTC.D",
    labelJa: "WTI原油",
    labelEn: "WTI spot price",
    status: value ? "ok" : "empty",
    value,
    date
  };
}

function parseStooqCsv(text) {
  const raw = String(text || "").trim();
  if (/__verify|requires JavaScript|<html/i.test(raw)) return { blocked: true };
  const rows = raw.split(/\r?\n/).filter(Boolean);
  if (rows.length < 2) return null;
  const headers = rows[0].split(",").map((header) => header.trim());
  const values = rows[1].split(",").map((value) => value.trim());
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  if (!row.Close || row.Close === "N/D") return null;
  return row;
}

async function fetchStooqQuote(symbol, labelJa, labelEn, seriesId) {
  const encoded = encodeURIComponent(symbol);
  const text = await cached(`stooq:${seriesId}`, () => fetchText(`https://stooq.com/q/l/?s=${encoded}&f=sd2t2ohlcv&h&e=csv`), 300000);
  const row = parseStooqCsv(text);
  if (row?.blocked) {
    return {
      source: "Stooq",
      seriesId,
      labelJa,
      labelEn,
      status: "blocked",
      value: null,
      change: null,
      date: null,
      time: null,
      noteJa: "Stooqがブラウザ確認で取得をブロック中"
    };
  }
  const value = Number(row?.Close);
  const open = Number(row?.Open);
  const change = Number.isFinite(value) && Number.isFinite(open) && open !== 0 ? ((value - open) / open) * 100 : null;
  return {
    source: "Stooq",
    seriesId,
    labelJa,
    labelEn,
    status: Number.isFinite(value) ? "ok" : "empty",
    value: Number.isFinite(value) ? value : null,
    change,
    date: row?.Date || null,
    time: row?.Time || null,
    noteJa: Number.isFinite(value) ? "" : "Stooqから数値が返りません"
  };
}

async function fetchCoinGecko() {
  const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true";
  const json = await cached("coingecko:crypto", () => fetchJson(url), 180000);
  return [
    {
      source: "CoinGecko",
      seriesId: "bitcoin",
      labelJa: "Bitcoin",
      labelEn: "Bitcoin",
      status: "ok",
      value: json.bitcoin?.usd,
      change: json.bitcoin?.usd_24h_change
    },
    {
      source: "CoinGecko",
      seriesId: "ethereum",
      labelJa: "Ethereum",
      labelEn: "Ethereum",
      status: "ok",
      value: json.ethereum?.usd,
      change: json.ethereum?.usd_24h_change
    }
  ];
}

async function fetchPublicFred(series, seriesId, labelJa, labelEn) {
  const since = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}&cosd=${since}`;
  const csv = await cached(`fred-public:${series}`, () => fetchText(url), 900000);
  const records = String(csv).trim().split(/\r?\n/).slice(1).map((line) => {
    const [date, value] = line.split(",");
    return {date, value: value?.trim() ? Number(value) : NaN};
  }).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.value) && row.value > 0);
  const latest = records.at(-1);
  if (!latest) throw new Error(`${series}: no public price`);
  const previous = records.at(-2);
  return {source:"FRED",seriesId,labelJa,labelEn,status:"ok",value:latest.value,
    change:previous ? (latest.value / previous.value - 1) * 100 : null,
    date:latest.date,noteJa:`日次公表値 / ${latest.date}`,url:`https://fred.stlouisfed.org/series/${series}`};
}

async function fetchTopix() {
  const url = "https://finance.yahoo.co.jp/quote/998405.T";
  const html = await cached("topix:public", () => fetchText(url), 900000);
  let snapshot;
  for (const script of String(html).matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
    const json = script[1].match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*\})\s*;?\s*$/)?.[1];
    if (json) { snapshot = JSON.parse(json); break; }
  }
  const quote = snapshot?.mainDomesticIndexPriceBoard?.indexPrices;
  const detail = snapshot?.mainDomesticIndexDetail?.indexPrices;
  const value = Number(String(quote?.price || "").replaceAll(",", ""));
  if (quote?.code !== "998405.T" || !Number.isFinite(value) || value <= 0) throw new Error("TOPIX: no public price");
  const date = detail?.openPriceDatetime || "";
  return {source:"Yahoo!ファイナンス",seriesId:"topix",labelJa:"TOPIX",labelEn:"TOPIX",status:"ok",value,
    change:Number(quote.changePriceRate),date,time:quote.japanUpdateTime,url,
    noteJa:`最新公表値 / ${date} ${quote.japanUpdateTime || ""}`.trim()};
}

async function fetchMacroSignals() {
  const tasks = [
    fetchPublicFred("SP500", "sp500", "S&P 500", "S&P 500"),
    fetchTopix(),
    fetchPublicFred("NASDAQCOM", "nasdaq", "NASDAQ総合", "NASDAQ Composite"),
    fetchPublicFred("DEXJPUS", "usdjpy", "ドル円", "USD/JPY"),
    process.env.EIA_API_KEY ? fetchEiaSeries() : fetchPublicFred("DCOILWTICO", "PET.RWTC.D", "WTI原油", "WTI spot price"),
    fetchCoinGecko()
  ];
  const settled = await Promise.allSettled(tasks);
  const output = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      if (Array.isArray(result.value)) output.push(...result.value);
      else if (result.value) output.push(result.value);
    } else {
      output.push({ source: "market", status: "error", noteJa: "市場データ取得失敗", error: result.reason?.message || "fetch failed" });
    }
  }
  return output.filter((item) => item?.status === "ok" && item.value !== null && item.value !== undefined && Number.isFinite(Number(item.value)));
}

async function translateArticleTitles(articles) {
  let cursor = 0;
  const worker = async () => {
    while (cursor < articles.length) {
      const article = articles[cursor++];
      if (!article.title || isProbablyJapanese(article.title) || article.live === false) continue;
      try {
        const key = `translation:ja:${article.title}`;
        const translated = await cached(key, async () => {
          const params = new URLSearchParams({client:"gtx",sl:"auto",tl:"ja",dt:"t",q:article.title});
          const result = await fetchJson(`https://translate.googleapis.com/translate_a/single?${params}`, {timeoutMs:6000});
          const title = result?.[0]?.map((part) => part[0] || "").join("").trim();
          if (!title) throw new Error("translation unavailable");
          return title;
        }, 86400000);
        article.titleJa = /\bAnthropic\b/i.test(article.title)
          ? translated.replace(/人類学(?:的)?|アントロピック/g, "Anthropic")
          : translated;
        article.translationStatus = "translated";
      } catch {
        article.translationStatus = "fallback";
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return articles;
}

function dedupeArticles(articles) {
  const seen = new Set();
  const output = [];
  for (const article of articles) {
    const key = article.url || article.title.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push({ ...article, score: scoreArticle(article) });
  }
  return output.sort((a, b) => b.score - a.score);
}

function buildTrends(articles, developerArticles) {
  const counts = new Map();
  const regionCounts = { world: articles.length, us: 0, europe: 0, asia: 0, japan: 0 };
  const all = [...articles, ...developerArticles];

  for (const article of all) {
    if (article.region && regionCounts[article.region] !== undefined) regionCounts[article.region] += 1;
    for (const topic of article.topics || []) {
      counts.set(topic, (counts.get(topic) || 0) + 1);
    }
  }

  const topics = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key, count]) => {
      const topic = TOPIC_DEFS.find((item) => item.key === key);
      return {
        key,
        labelJa: topic?.labelJa || key,
        labelEn: topic?.labelEn || key,
        count
      };
    });

  return {
    topics,
    regionCounts,
    leadSignals: [
      selectLeadSignal(articles, ["japan", "asia"], "アジア・日本AIレーダー"),
      selectLeadSignal(articles, ["world", "us", "europe"], "グローバルAIパルス"),
      selectLeadSignal(developerArticles, ["world", "us", "europe", "asia", "japan"], "開発者コミュニティ")
    ]
  };
}

function selectLeadSignal(articles, regions, labelJa) {
  const candidates = articles
    .filter((article) => regions.includes(article.region) && (article.topics || []).some((topic) => ["models", "chips", "data-centers", "cloud", "security", "robotics", "quantum"].includes(topic)))
    .sort((a, b) => b.score - a.score);
  const article = candidates[0] || articles[0] || fallbackArticles[0];
  return {
    labelJa,
    titleJa: article?.titleJa || "データ取得待ち",
    original: article?.title || "",
    source: article?.source || "",
    url: article?.url || "",
    region: article?.region || "world",
    topics: topicLabels(article?.topics || []).slice(0, 2),
    live: article?.live !== false
  };
}

function buildMapMarkers(articles, earthquakes) {
  const newsMarkers = articles.filter((article) => article.country && article.country !== "World").slice(0, 32).map((article) => ({
    id: article.id,
    type: "news",
    lat: article.lat,
    lon: article.lon,
    region: article.region,
    titleJa: article.titleJa,
    source: article.source,
    url: article.url,
    score: article.score,
    topics: topicLabels(article.topics).slice(0, 2),
    live: article.live !== false
  }));

  return [...newsMarkers, ...earthquakes.slice(0, 10)];
}

function selectDashboardArticles(articles, limit = 72) {
  const pinned = [];
  const isAiTech = (article) => (article.topics || []).some((topic) => ["models", "chips", "data-centers", "cloud", "security", "robotics", "quantum"].includes(topic));
  const pushMatches = (predicate, count) => {
    pinned.push(...articles.filter(predicate).slice(0, count));
  };

  for (const region of ["japan", "asia", "us", "europe", "world"]) {
    pushMatches((article) => article.region === region && isAiTech(article), 6);
  }

  for (const region of ["world", "us", "europe", "asia", "japan"]) {
    pushMatches((article) => article.region === region && article.topics?.includes("automotive"), 5);
  }

  for (const region of ["world", "us", "europe", "asia", "japan"]) {
    pushMatches((article) => article.region === region, 8);
  }

  const selected = [];
  const seen = new Set();
  for (const article of [...pinned, ...articles]) {
    const key = article.url || article.id || article.title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    selected.push(article);
    if (selected.length >= limit) break;
  }
  return selected.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
}

async function buildDashboard() {
  const started = Date.now();
  const [newsResult, hnResult, earthquakeResult, statusResult, macroResult, githubResult, devToResult] = await Promise.allSettled([
    fetchNewsArticles(),
    fetchHackerNews(),
    fetchEarthquakes(),
    fetchStatusPages(),
    fetchMacroSignals(),
    fetchGitHubTrending(),
    fetchDevToArticles()
  ]);

  const articles = newsResult.status === "fulfilled" ? newsResult.value.articles : fallbackArticles;
  const apiStatus = newsResult.status === "fulfilled" ? newsResult.value.apiStatus : { gdelt: { ok: false, message: newsResult.reason?.message || "fetch failed" } };
  const hnArticles = hnResult.status === "fulfilled" ? hnResult.value : [];
  const earthquakes = earthquakeResult.status === "fulfilled" ? earthquakeResult.value : [];
  const statuses = statusResult.status === "fulfilled" ? statusResult.value : [];
  const macro = macroResult.status === "fulfilled" ? macroResult.value : [];
  const githubTrending = githubResult.status === "fulfilled" ? githubResult.value : [];
  const devToArticles = devToResult.status === "fulfilled" ? devToResult.value : [];

  const developerArticles = dedupeArticles([...hnArticles, ...devToArticles]);
  const combinedArticles = dedupeArticles([...articles, ...hnArticles, ...devToArticles]);
  const selectedArticles = selectDashboardArticles(combinedArticles, 72);
  await translateArticleTitles(selectedArticles);
  const trends = buildTrends(combinedArticles, developerArticles);
  const live = combinedArticles.some((article) => article.live !== false);

  return {
    generatedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
    live,
    tabs: [
      { key: "world", labelJa: "世界", labelEn: "World" },
      { key: "us", labelJa: "アメリカ", labelEn: "United States" },
      { key: "europe", labelJa: "ヨーロッパ", labelEn: "Europe" },
      { key: "asia", labelJa: "アジア", labelEn: "Asia" },
      { key: "japan", labelJa: "日本", labelEn: "Japan" }
    ],
    articles: selectedArticles,
    githubTrending,
    devToArticles: devToArticles.slice(0, 10),
    asiaJapanFocus: combinedArticles
      .filter((article) => article.region === "japan" || article.region === "asia")
      .sort((a, b) => b.score - a.score)
      .slice(0, 16),
    trends,
    map: {
      markers: buildMapMarkers(combinedArticles, earthquakes),
      centers: REGION_COORDS
    },
    statusPages: statuses,
    macro,
    apiStatus: {
      ...apiStatus,
      hackerNews: { ok: hnResult.status === "fulfilled", count: hnArticles.length, message: hnResult.status === "rejected" ? hnResult.reason?.message : "" },
      githubTrending: { ok: githubResult.status === "fulfilled", count: githubTrending.length, message: githubResult.status === "rejected" ? githubResult.reason?.message : "" },
      devTo: { ok: devToResult.status === "fulfilled", count: devToArticles.length, message: devToResult.status === "rejected" ? devToResult.reason?.message : "" },
      usgs: { ok: earthquakeResult.status === "fulfilled", count: earthquakes.length, message: earthquakeResult.status === "rejected" ? earthquakeResult.reason?.message : "" },
      statusPages: { ok: statusResult.status === "fulfilled", count: statuses.length, message: statusResult.status === "rejected" ? statusResult.reason?.message : "" },
      macro: { ok: macroResult.status === "fulfilled", count: macro.length, message: macroResult.status === "rejected" ? macroResult.reason?.message : "" }
    }
  };
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(body);
}

async function sendStatic(response, requestPath) {
  const resolved = requestPath === "/" ? "/index.html" : requestPath;
  const safePath = path.normalize(decodeURIComponent(resolved)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);
  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
  }[ext] || "application/octet-stream";

  const body = await readFile(filePath);
  response.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=60"
  });
  response.end(body);
}

const server = createServer(async (request, response) => {
  for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value);
  try {
    const rejection = checkLocalRequest(request);
    if (rejection) {
      if (rejection.status === 405) response.setHeader("Allow", "GET, HEAD");
      sendJson(response, rejection.status, { ok: false, message: rejection.message });
      return;
    }
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    if (url.pathname === "/api/monitor") {
      const refresh = url.searchParams.get("refresh") === "1";
      const key = "dashboard";
      if (refresh) responseCache.delete(key);
      const payload = await cached(key, buildDashboard, cacheTtlMs);
      sendJson(response, 200, payload);
      return;
    }

    if (url.pathname === "/api/health") {
      sendJson(response, 200, {
        ok: true,
        app: "world-monitor-dashboard",
        generatedAt: new Date().toISOString(),
        fredConfigured: Boolean(process.env.FRED_API_KEY),
        eiaConfigured: Boolean(process.env.EIA_API_KEY)
      });
      return;
    }

    await sendStatic(response, url.pathname);
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      message: error.message,
      generatedAt: new Date().toISOString()
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`World Monitor AI/Tech running at http://localhost:${port}`);
  console.log("Optional live macro keys: FRED_API_KEY, EIA_API_KEY");
});
