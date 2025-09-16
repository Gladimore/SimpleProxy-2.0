const express = require('express')
const http = require('http')
const https = require('https')
const { URL } = require('url')
const cors = require('cors')

const app = express()
app.use(cors())

app.all('/proxy', (req, res) => {
  const target = req.headers['x-target-url']
  if (!target) return res.status(400).json({ error: 'Missing x-target-url' })

  let url
  try { url = new URL(target) } catch { return res.status(400).json({ error: 'Invalid x-target-url' }) }

  const outgoingHeaders = { ...req.headers }
  delete outgoingHeaders['x-target-url']

  const transport = url.protocol === 'https:' ? https : http
  const opts = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: req.method,
    headers: outgoingHeaders,
    rejectUnauthorized: false
  }

  const proxyReq = transport.request(opts, (proxyRes) => {
    res.statusCode = proxyRes.statusCode || 502
    for (const [k, v] of Object.entries(proxyRes.headers || {})) {
      res.setHeader(k, v)
    }
    proxyRes.pipe(res, { end: true })
  })

  proxyReq.on('error', (err) => {
    if (!res.headersSent) res.status(502).json({ error: 'Bad gateway', detail: err.message })
    else res.end()
  })

  req.pipe(proxyReq)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => 
  console.log(`Listening on http://localhost:${PORT}`))
