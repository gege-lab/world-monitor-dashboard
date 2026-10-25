export function safeExternalUrl(value) {
  if (typeof value !== "string") return "";
  const input = value.trim();
  if (!/^https?:\/\//i.test(input) || /[\u0000-\u001f\u007f\\]/.test(input)) return "";
  try {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

export function safeMarkdownUrl(value) {
  return safeExternalUrl(value).replace(/[()]/g, character => character === "(" ? "%28" : "%29");
}
