const WORKER_DOMAIN = "manmygfisperfect.jokighohkh.workers.dev";

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(req) {
  const incomingUrl = new URL(req.url);
  let targetUrl;

  if (incomingUrl.searchParams.get("url")) {
    targetUrl = decodeURIComponent(incomingUrl.searchParams.get("url"));
  } else {
    const path = incomingUrl.pathname.slice(1);
    if (!path) {
      return new Response("Proxy running", { status: 200 });
    }
    targetUrl = path;
  }

  if (!/^https?:\/\//i.test(targetUrl)) {
    return new Response("Invalid target URL", { status: 400 });
  }

  const headers = new Headers(req.headers);
  headers.delete("host");

  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? req.body : null,
    redirect: "follow"
  });

  const contentType = response.headers.get("content-type") || "";
  let body;

  // Only rewrite URLs in HTML and CSS
  if (contentType.includes("text/html") || contentType.includes("text/css")) {
    let text = await response.text();
    const base = new URL(targetUrl);
    text = rewriteHtmlCssUrls(text, base);
    body = text;
  } else {
    // Serve JS, WASM, images, Unity data, etc. as-is
    body = response.body;
  }

  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", "*");
  newHeaders.set("Access-Control-Allow-Headers", "*");
  newHeaders.set("Access-Control-Allow-Methods", "*");

  return new Response(body, {
    status: response.status,
    headers: newHeaders
  });
}

// Wrap URL for the worker
function proxyUrl(url) {
  if (!/^https?:\/\//i.test(url)) return url;
  if (url.includes(WORKER_DOMAIN)) return url;
  return `https://${WORKER_DOMAIN}/?url=${encodeURIComponent(url)}`;
}

// Rewrite src/href/img/script/link and CSS url() references safely
function rewriteHtmlCssUrls(text, base) {
  // Rewrite src/href in HTML
  text = text.replace(/<(img|script|iframe|link)[^>]*(src|href)=["']([^"']+)["']/gi, (match, tag, attr, url) => {
    try {
      const absolute = new URL(url, base).href;
      if (absolute.includes(WORKER_DOMAIN)) return match;
      return match.replace(url, proxyUrl(absolute));
    } catch {
      return match;
    }
  });

  // Rewrite CSS url() references
  text = text.replace(/url\(["']?([^"')]+)["']?\)/gi, (match, url) => {
    try {
      const absolute = new URL(url, base).href;
      if (absolute.includes(WORKER_DOMAIN)) return match;
      return `url(${proxyUrl(absolute)})`;
    } catch {
      return match;
    }
  });

  return text;
}
