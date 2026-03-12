import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/login/LoginPage.jsx'
import PortalPage from './pages/portal/PortalPage.jsx'

const EcowatchMainLayout = lazy(() => import('./pages/ecowatch/Layout.jsx'))
const ProjectPage = lazy(() => import('./pages/project/ProjectPage.jsx'))
const TagConfigPage = lazy(() => import('./pages/project/TagConfigPage.jsx'))
const AreaUsagePage = lazy(() => import('./pages/ecowatch/AreaUsagePage.jsx'))
const DemandPage = lazy(() => import('./pages/ecowatch/DemandPage.jsx'))
const EnergyFlowPage = lazy(() => import('./pages/ecowatch/EnergyFlowPage.jsx'))
const ItemSummaryPage = lazy(() => import('./pages/ecowatch/ItemSummaryPage.jsx'))
const EnergyRankingPage = lazy(() => import('./pages/ecowatch/EnergyRankingPage.jsx'))
const LossAnalysisPage = lazy(() => import('./pages/ecowatch/LossAnalysisPage.jsx'))
const TOUPeriodPage = lazy(() => import('./pages/ecowatch/TOUPeriodPage.jsx'))
const AnnualReportPage = lazy(() => import('./pages/ecowatch/AnnualReportPage.jsx'))

const BACKEND_BASE_URL = window.location.origin

function RequireSession({ sessionUser, children }) {
  if (!sessionUser) {
    return <Navigate to="/login?reason=auth" replace />
  }
  return children
}

function Root() {
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
          return
        }

        const data = await response.json()
        const user = String(data?.user || '')
        setSessionUser(user)
      } finally {
        setLoading(false)
      }
    }

    hydrateSession()
  }, [])

  async function handleSignOut() {
    await fetch(`${BACKEND_BASE_URL}/api/sign-out`, {
      method: 'POST',
      credentials: 'include',
    })
    localStorage.removeItem('loggedInUser')
    setSessionUser('')
  }

  if (loading) {
    return null
  }

  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route
            path="/login"
            element={sessionUser
              ? <Navigate to="/portal" replace />
              : (
                  <LoginPage
                    onLoginSuccess={(user) => {
                      setSessionUser(user)
                    }}
                  />
                )}
          />

          <Route
            path="/portal"
            element={(
              <RequireSession sessionUser={sessionUser}>
                <PortalPage user={sessionUser} onSignOut={handleSignOut} />
              </RequireSession>
            )}
          />

          <Route
            path="/project"
            element={(
              <RequireSession sessionUser={sessionUser}>
                <ProjectPage user={sessionUser} onSignOut={handleSignOut} />
              </RequireSession>
            )}
          />

          <Route
            path="/project/tag/:deviceId/:tagId"
            element={(
              <RequireSession sessionUser={sessionUser}>
                <TagConfigPage user={sessionUser} onSignOut={handleSignOut} />
              </RequireSession>
            )}
          />

          <Route
            path="/ecowatch"
            element={(
              <RequireSession sessionUser={sessionUser}>
                <EcowatchMainLayout />
              </RequireSession>
            )}
          >
            <Route index element={<Navigate to="/ecowatch/area-usage" replace />} />
            <Route path="area-usage" element={<AreaUsagePage />} />
            <Route path="demand" element={<DemandPage />} />
            <Route path="energy-flow" element={<EnergyFlowPage />} />
            <Route path="item-summary" element={<ItemSummaryPage />} />
            <Route path="energy-ranking" element={<EnergyRankingPage />} />
            <Route path="loss-analysis" element={<LossAnalysisPage />} />
            <Route path="tou-period" element={<TOUPeriodPage />} />
            <Route path="annual-report" element={<AnnualReportPage />} />
          </Route>

          <Route path="/" element={<Navigate to={sessionUser ? '/portal' : '/login'} replace />} />
          <Route path="*" element={<Navigate to={sessionUser ? '/portal' : '/login'} replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default Root
