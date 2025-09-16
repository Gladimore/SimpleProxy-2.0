const express = require('express')
const rateLimit = require('express-rate-limit')
const http = require('http')
const https = require('https')
const { URL } = require('url')
const cors = require('cors')

const app = express()
app.use(cors())

const PASSWORD = process.env.PROXY_PASSWORD

const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS = 100

const limiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.headers['x-site-password'] === PASSWORD
})

app.all('/proxy', (req, res) => {
  const target = req.headers['x-target-url']
  if (!target) return res.status(400).json({ error: 'Missing x-target-url' })

  if (req.headers['x-site-password'] !== PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' })
  }

  limiter(req, res, () => {
    let url
    try { url = new URL(target) } catch { return res.status(400).json({ error: 'Invalid x-target-url' }) }

    const outgoingHeaders = { ...req.headers }
    delete outgoingHeaders['x-target-url']
    delete outgoingHeaders['x-site-password']

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
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => 
  console.log(`Listening on http://localhost:${PORT}`))
