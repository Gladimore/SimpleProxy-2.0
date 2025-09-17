addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(req) {
  const url = new URL(req.url)
  const target = url.searchParams.get('url')

  if (!target) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  let targetUrl
  try {
    targetUrl = new URL(target)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid url' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const outgoingHeaders = new Headers(req.headers)
  outgoingHeaders.delete('host')

  const fetchOptions = {
    method: req.method,
    headers: outgoingHeaders,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : null
  }

  try {
    const res = await fetch(targetUrl.toString(), fetchOptions)
    const responseHeaders = new Headers(res.headers)

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Bad gateway', detail: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
