import './style/efortech-portal.css'
import efortechLogo from '../assets/efortech_logo.png'
import { Activity, CalendarClock } from 'lucide-react'

const DASHBOARD_URL = '/grafana/?orgId=1&from=now-6h&to=now&timezone=browser'
const DEFAULT_ECOWATCH_URL = '/ecowatch/area-usage'
const ECOWATCH_URL = import.meta.env.VITE_ECOWATCH_URL || DEFAULT_ECOWATCH_URL

function EfortechPortalPage({ user, onSignOut }) {
  function handleEcowatchOpen() {
    localStorage.setItem('loggedInUser', user)
    window.location.href = ECOWATCH_URL
  }

  return (
    <main className="portal-page">
      <header className="portal-topbar">
        <div className="portal-left">
          <img className="portal-logo" src={efortechLogo} alt="Efortech" />
        </div>
        <div className="portal-right">
          <span className="portal-user">{user}</span>
          <button type="button" className="portal-signout-btn" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="portal-content">
        <h1>Welcome, {user}</h1>
        <p>Choose a service to get started.</p>

        <div className="portal-group">
          <h2>Services</h2>
          <div className="portal-grid">
            <button type="button" className="portal-card" onClick={handleEcowatchOpen}>
              <div className="portal-card-icon">
                <Activity size={22} strokeWidth={2.5} aria-hidden="true" />
              </div>
              <span>ECOWatch</span>
            </button>
            <button
              type="button"
              className="portal-card portal-card-primary"
              onClick={() => {
                window.location.href = DASHBOARD_URL
              }}
            >
              <div className="portal-card-icon">
                <CalendarClock size={22} strokeWidth={2.5} aria-hidden="true" />
              </div>
              <span>Dashboard Grafana</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

export default EfortechPortalPage
