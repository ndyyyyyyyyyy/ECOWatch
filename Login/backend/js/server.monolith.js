import cors from 'cors'
import express from 'express'
import session from 'express-session'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createProxyMiddleware } from 'http-proxy-middleware'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

const PORT = Number(process.env.PORT || 4000)
const SESSION_SECRET = process.env.SESSION_SECRET || 'efortech-dev-secret'
const REMEMBER_ME_MAX_AGE_MS = Number(process.env.REMEMBER_ME_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000)
const GRAFANA_TARGET = (process.env.GRAFANA_TARGET || 'http://127.0.0.1:3000').replace(/\/$/, '')
const GRAFANA_DEFAULT_PATH = process.env.GRAFANA_DEFAULT_PATH || '/?orgId=1&from=now-6h&to=now&timezone=browser'
const LOGIN_APP_URL = (process.env.LOGIN_APP_URL || '/').replace(/\/$/, '') || '/'

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || `http://localhost:${PORT},http://127.0.0.1:${PORT},http://localhost:5173,http://127.0.0.1:5173`)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
)

function ipToInt(ip) {
  const parts = ip.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null
  }
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0
}

function maskToPrefix(mask) {
  const maskInt = ipToInt(mask)
  if (maskInt == null) {
    return null
  }
  let prefix = 0
  for (let i = 31; i >= 0; i -= 1) {
    if (((maskInt >>> i) & 1) === 1) {
      prefix += 1
    } else {
      break
    }
  }
  return prefix
}

function parseCidr(cidr) {
  const [ip, rawPrefix] = String(cidr || '').split('/')
  const prefix = Number(rawPrefix)
  if (!ip || Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
    return null
  }
  const ipInt = ipToInt(ip)
  if (ipInt == null) {
    return null
  }
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return {
    ipInt,
    mask,
  }
}

function normalizeIp(rawIp) {
  const value = String(rawIp || '').trim()
  if (!value) {
    return ''
  }
  if (value.startsWith('::ffff:')) {
    return value.slice(7)
  }
  if (value === '::1') {
    return '127.0.0.1'
  }
  return value
}

function getAllLocalSubnetCidrs() {
  const allIfaces = os.networkInterfaces()
  const cidrs = []
  for (const ifaceList of Object.values(allIfaces)) {
    for (const iface of ifaceList || []) {
      if (iface.internal || iface.family !== 'IPv4') {
        continue
      }
      const prefix = maskToPrefix(iface.netmask)
      if (prefix == null) {
        continue
      }
      cidrs.push(`${iface.address}/${prefix}`)
    }
  }
  return cidrs
}

const envSubnet = String(process.env.ALLOWED_SUBNET_CIDR || '').trim()
const allowedSubnetCidrs = envSubnet ? [envSubnet] : getAllLocalSubnetCidrs()
const parsedAllowedSubnets = allowedSubnetCidrs
  .map((cidr) => parseCidr(cidr))
  .filter(Boolean)

function isIpInAllowedSubnet(ip) {
  if (!parsedAllowedSubnets.length) {
    return true
  }
  const ipInt = ipToInt(ip)
  if (ipInt == null) {
    return false
  }
  return parsedAllowedSubnets.some((subnet) => (ipInt & subnet.mask) === (subnet.ipInt & subnet.mask))
}

function getRequestOrigin(req) {
  const host = req.headers['x-forwarded-host'] || req.get('host')
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http'
  return `${proto}://${host}`
}

function isWeekend(date = new Date()) {
  const day = date.getDay()
  return day === 0 || day === 6
}

function getWeekKey(date = new Date()) {
  const year = date.getFullYear()
  const firstDay = new Date(year, 0, 1)
  const dayOffset = Math.floor((date - firstDay) / 86400000)
  const firstDayWeekday = firstDay.getDay()
  const week = Math.ceil((dayOffset + firstDayWeekday + 1) / 7)
  return `${year}-W${week}`
}

function isRememberSessionExpired(sessionData) {
  if (!sessionData?.user || !sessionData?.rememberApplied) {
    return false
  }
  const now = new Date()
  if (isWeekend(now)) {
    return true
  }
  const loginWeekKey = String(sessionData.rememberWeekKey || '')
  if (!loginWeekKey) {
    return true
  }
  return loginWeekKey !== getWeekKey(now)
}

function isAllowedOrigin(origin) {
  if (!origin) {
    return true
  }

  if (allowedOrigins.has(origin)) {
    return true
  }

  let parsed
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return false
  }

  const hostname = normalizeIp(parsed.hostname)
  const explicitPort = parsed.port
    ? Number(parsed.port)
    : parsed.protocol === 'https:'
      ? 443
      : 80

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return [PORT, 5173, 4173].includes(explicitPort)
  }

  if (net.isIP(hostname) === 4 && isIpInAllowedSubnet(hostname)) {
    return [PORT, 5173, 4173].includes(explicitPort)
  }

  return false
}

app.set('trust proxy', 1)
app.use((req, res, next) => {
  const ip = normalizeIp(req.ip)
  if (!ip || ip === '127.0.0.1') {
    next()
    return
  }
  if (isIpInAllowedSubnet(ip)) {
    next()
    return
  }
  res.status(403).json({ message: 'Forbidden: only local subnet access is allowed.' })
})
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    },
  }),
)
app.use((req, _res, next) => {
  if (!req.session?.user) {
    next()
    return
  }
  if (!isRememberSessionExpired(req.session)) {
    next()
    return
  }
  req.session.destroy(() => {
    next()
  })
})

app.use('/api', cors({
  credentials: true,
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('Origin not allowed by CORS'))
  },
}))
app.use('/api', express.json())

function requireUser(req, res, next) {
  if (!req.session?.user) {
    res.status(401).json({ message: 'Unauthorized. Please sign in first.' })
    return
  }
  next()
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/session', (req, res) => {
  if (!req.session?.user) {
    res.status(401).json({ authenticated: false })
    return
  }
  res.json({
    authenticated: true,
    user: req.session.user,
  })
})

app.post('/api/login', async (req, res) => {
  const account = String(req.body?.account || '').trim()
  const password = String(req.body?.password || '')
  const rememberRequested = Boolean(req.body?.remember)
  const rememberApplied = rememberRequested && !isWeekend()
  if (!account) {
    res.status(400).json({ message: 'Account is required.' })
    return
  }
  if (!password) {
    res.status(400).json({ message: 'Password is required.' })
    return
  }

  const basicToken = Buffer.from(`${account}:${password}`, 'utf8').toString('base64')
  let loginCheck
  try {
    loginCheck = await fetch(`${GRAFANA_TARGET}/api/user`, {
      method: 'GET',
      headers: { Authorization: `Basic ${basicToken}` },
      redirect: 'manual',
    })
  } catch {
    res.status(502).json({ message: 'Failed to connect to Grafana.' })
    return
  }

  if (loginCheck.status !== 200) {
    res.status(401).json({ message: 'Invalid account or password.' })
    return
  }

  req.session.user = account
  req.session.rememberApplied = rememberApplied
  req.session.rememberWeekKey = rememberApplied ? getWeekKey() : null
  if (rememberApplied) {
    req.session.cookie.maxAge = REMEMBER_ME_MAX_AGE_MS
  } else {
    req.session.cookie.expires = false
    req.session.cookie.maxAge = null
  }
  res.json({ ok: true, user: account, remember: rememberApplied })
})

function handleSignOut(req, res) {
  req.session.destroy(() => {
    res.json({ ok: true })
  })
}

app.post('/api/sign-out', handleSignOut)
app.post('/api/logout', handleSignOut)

app.get('/auth/grafana-login', (req, res) => {
  const account = String(req.query.account || '').trim()
  if (!account) {
    res.status(400).send('Account is required.')
    return
  }

  req.session.user = account
  res.redirect(`/grafana${GRAFANA_DEFAULT_PATH}`)
})

app.all(['/sign-out', '/grafana/sign-out', '/logout', '/grafana/logout'], (req, res) => {
  req.session.destroy(() => {
    if (LOGIN_APP_URL === '/') {
      res.redirect('/')
      return
    }
    res.redirect(LOGIN_APP_URL)
  })
})

function rewriteGrafanaLocation(locationValue, req) {
  if (!locationValue) {
    return locationValue
  }
  const requestOrigin = getRequestOrigin(req)

  if (locationValue === '/grafana' || locationValue.startsWith('/grafana/')) {
    return locationValue
  }

  if (locationValue.startsWith('/')) {
    return `/grafana${locationValue}`
  }

  if (locationValue.startsWith(`${requestOrigin}/grafana`)) {
    return locationValue
  }

  if (locationValue.startsWith(GRAFANA_TARGET)) {
    return locationValue.replace(GRAFANA_TARGET, `${requestOrigin}/grafana`)
  }

  if (locationValue.startsWith('http://') || locationValue.startsWith('https://')) {
    try {
      const parsed = new URL(locationValue)
      if (parsed.pathname === '/grafana' || parsed.pathname.startsWith('/grafana/')) {
        return `${requestOrigin}${parsed.pathname}${parsed.search}`
      }
      if (parsed.pathname.startsWith('/')) {
        return `${requestOrigin}/grafana${parsed.pathname}${parsed.search}`
      }
    } catch {
      return locationValue
    }
  }

  return locationValue
}

const grafanaProxy = createProxyMiddleware({
  target: GRAFANA_TARGET,
  changeOrigin: false,
  ws: true,
  xfwd: true,
  logLevel: 'warn',
  pathRewrite(pathname) {
    if (pathname === '/grafana' || pathname.startsWith('/grafana/')) {
      return pathname
    }
    return `/grafana${pathname}`
  },
  on: {
    proxyReq(proxyReq, req) {
      const user = req.session?.user
      if (user) {
        proxyReq.setHeader('X-WEBAUTH-USER', user)
      }

      const requestOrigin = getRequestOrigin(req)
      proxyReq.setHeader('Host', req.get('host'))
      proxyReq.setHeader('Origin', requestOrigin)
      proxyReq.setHeader('X-Forwarded-Prefix', '/grafana')
      proxyReq.setHeader('X-Forwarded-Host', req.get('host'))
      proxyReq.setHeader('X-Forwarded-Proto', req.protocol)
    },
    proxyRes(proxyRes, req) {
      const location = proxyRes.headers.location
      if (location) {
        proxyRes.headers.location = rewriteGrafanaLocation(location, req)
      }
      if ((proxyRes.statusCode || 0) >= 400) {
        console.warn(`[grafana-proxy] ${req.method} ${req.originalUrl} -> ${proxyRes.statusCode}`)
      }
    },
    error(err, _req, res) {
      if (!res.headersSent) {
        res.status(502).json({ message: 'Grafana proxy error', detail: err.message })
      }
    },
  },
})

app.use('/grafana', requireUser, grafanaProxy)
app.use('/api/live', requireUser, grafanaProxy)
app.use('/public', requireUser, grafanaProxy)
app.use('/avatar', requireUser, grafanaProxy)
app.use('/login', requireUser, grafanaProxy)
app.use('/favicon.ico', requireUser, grafanaProxy)

const distDir = path.resolve(__dirname, '..', 'dist')
const distIndex = path.join(distDir, 'index.html')

if (fs.existsSync(distIndex)) {
  app.use(express.static(distDir))

  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/grafana') || req.path.startsWith('/auth')) {
      next()
      return
    }
    res.sendFile(distIndex)
  })
} else {
  app.get('/', (_req, res) => {
    res.redirect(LOGIN_APP_URL)
  })
}

const server = app.listen(PORT, () => {
  console.log(`Auth proxy aktif di http://0.0.0.0:${PORT}`)
  console.log(`Grafana upstream: ${GRAFANA_TARGET}`)
  if (allowedSubnetCidrs.length) {
    console.log(`Akses dibatasi subnet: ${allowedSubnetCidrs.join(', ')}`)
  }
})

server.on('upgrade', grafanaProxy.upgrade)
