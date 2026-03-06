import { createProxyMiddleware } from 'http-proxy-middleware'

export function registerGrafanaProxyRoutes(app, config) {
  const {
    GRAFANA_TARGET,
    requireUser,
    getRequestOrigin,
  } = config

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
  app.use('/favicon.ico', requireUser, grafanaProxy)

  return grafanaProxy
}
