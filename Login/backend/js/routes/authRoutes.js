export function registerAuthRoutes(app, config) {
  const {
    REMEMBER_ME_MAX_AGE_MS,
    GRAFANA_TARGET,
    GRAFANA_DEFAULT_PATH,
    LOGIN_APP_URL,
    isWeekend,
    getWeekKey,
  } = config

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
}
