const WORKER_DOMAIN = "manmygfisperfect.jokighohkh.workers.dev"

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(req) {

  const incomingUrl = new URL(req.url)

  let targetUrl

  if (incomingUrl.searchParams.get("url")) {
    targetUrl = decodeURIComponent(incomingUrl.searchParams.get("url"))
  } else {
    const path = incomingUrl.pathname.slice(1)
    if (!path) {
      return new Response("Proxy running", { status: 200 })
    }
    targetUrl = path
  }

  if (!/^https?:\/\//i.test(targetUrl)) {
    return new Response("Invalid target URL", { status: 400 })
  }

  const headers = new Headers(req.headers)
  headers.delete("host")

  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? req.body : null,
    redirect: "follow"
  })

  const contentType = response.headers.get("content-type") || ""

  let body

  if (
    contentType.includes("text/html") ||
    contentType.includes("javascript") ||
    contentType.includes("text/css")
  ) {

    let text = await response.text()

    const base = new URL(targetUrl)

    text = rewriteUrls(text, base)

    body = text

  } else {

    body = response.body

  }

  const newHeaders = new Headers(response.headers)

  newHeaders.set("Access-Control-Allow-Origin", "*")
  newHeaders.set("Access-Control-Allow-Headers", "*")
  newHeaders.set("Access-Control-Allow-Methods", "*")

  return new Response(body, {
    status: response.status,
    headers: newHeaders
  })
}

function proxyUrl(url) {

  return "https://" + WORKER_DOMAIN + "/?url=" + encodeURIComponent(url)

}

function rewriteUrls(text, base) {

  text = text.replace(
    /(src|href)=["']([^"']+)["']/gi,
    (match, attr, url) => {

      try {

        const absolute = new URL(url, base).href

        if (absolute.includes(WORKER_DOMAIN)) return match

        return `${attr}="${proxyUrl(absolute)}"`

      } catch {
        return match
      }

    }
  )

  text = text.replace(
    /url\(["']?([^"')]+)["']?\)/gi,
    (match, url) => {

      try {

        const absolute = new URL(url, base).href

        if (absolute.includes(WORKER_DOMAIN)) return match

        return `url(${proxyUrl(absolute)})`

      } catch {
        return match
      }

    }
  )

  text = text.replace(
    /(https?:\/\/[^\s"'<>]+)/gi,
    url => {

      if (url.includes(WORKER_DOMAIN)) return url

      return proxyUrl(url)

    }
  )

  return text

}
