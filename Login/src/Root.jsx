import { useEffect, useMemo, useState } from 'react'
import EfortechLoginPage from './pages/EfortechLoginPage.jsx'
import EfortechPortalPage from './pages/EfortechPortalPage.jsx'

const BACKEND_BASE_URL = window.location.origin

function getHashRoute() {
  const value = window.location.hash.replace(/^#/, '')
  if (value === '/portal') {
    return 'portal'
  }
  return 'login'
}

function Root() {
  const [route, setRoute] = useState(getHashRoute)
  const [sessionUser, setSessionUser] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function hydrateSession() {
      try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/session`, {
          method: 'GET',
          credentials: 'include',
        })
        if (!response.ok) {
          setSessionUser('')
          if (getHashRoute() === 'portal') {
            window.location.hash = '/login'
            setRoute('login')
          }
          return
        }

        const data = await response.json()
        const user = String(data?.user || '')
        setSessionUser(user)

        if (user && getHashRoute() === 'login') {
          window.location.hash = '/portal'
          setRoute('portal')
        }
      } finally {
        setLoading(false)
      }
    }

    hydrateSession()
  }, [])

  useEffect(() => {
    function onHashChange() {
      const nextRoute = getHashRoute()
      setRoute(nextRoute)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const content = useMemo(() => {
    if (loading) {
      return null
    }

    if (route === 'portal' && sessionUser) {
      return (
        <EfortechPortalPage
          user={sessionUser}
          onSignOut={async () => {
            await fetch(`${BACKEND_BASE_URL}/api/sign-out`, {
              method: 'POST',
              credentials: 'include',
            })
            setSessionUser('')
            window.location.hash = '/login'
          }}
        />
      )
    }

    return (
      <EfortechLoginPage
        onLoginSuccess={(user) => {
          setSessionUser(user)
          setRoute('portal')
          window.location.hash = '/portal'
        }}
      />
    )
  }, [loading, route, sessionUser])

  return content
}

export default Root
