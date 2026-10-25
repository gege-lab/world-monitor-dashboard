export const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "base-uri 'none'; object-src 'none'; frame-ancestors 'none'"
};

export function checkLocalRequest(request) {
  const host = request.headers.host;
  if (typeof host !== "string" || !/^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/i.test(host)) {
    return { status: 403, message: "Local requests only" };
  }
  let origin;
  try {
    origin = new URL(`http://${host}`).origin;
  } catch {
    return { status: 403, message: "Invalid local host" };
  }
  const hostPort = Number(new URL(origin).port || 80);
  if (hostPort !== request.socket.localPort) return { status: 403, message: "Invalid local port" };

  if (request.headers.origin !== undefined && request.headers.origin !== origin) {
    return { status: 403, message: "Cross-origin requests are not allowed" };
  }
  const target = request.url || "/";
  if (!target.startsWith("/") || target.startsWith("//")) return { status: 400, message: "Invalid request target" };
  const url = new URL(target, origin);
  if (url.origin !== origin) return { status: 400, message: "Invalid request target" };

  const topLevelNavigation = request.headers["sec-fetch-mode"] === "navigate"
    && request.headers["sec-fetch-dest"] === "document"
    && !url.pathname.startsWith("/api/");
  if (request.headers["sec-fetch-site"] === "cross-site" && !topLevelNavigation) {
    return { status: 403, message: "Cross-site requests are not allowed" };
  }
  if (!["GET", "HEAD"].includes(request.method)) return { status: 405, message: "Method not allowed" };

  // Non-safelisted headers prevent a third-party image or form from forcing refreshes.
  if (url.pathname === "/api/monitor" && url.searchParams.get("refresh") === "1"
    && request.headers["x-world-monitor-request"] !== "1") {
    return { status: 403, message: "Dashboard refresh header required" };
  }
  return null;
}
