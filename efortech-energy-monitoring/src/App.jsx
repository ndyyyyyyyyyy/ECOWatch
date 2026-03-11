import { useState } from 'react'
import './App.css'

const BACKEND_BASE_URL = window.location.origin
const GRAFANA_LOGIN_BRIDGE_URL = `${BACKEND_BASE_URL}/auth/grafana-login`

const PLATFORM_OPTIONS = [
  'Project Management',
  'Realtime Monitoring',
  'Draw',
  'Dashboard',
  'EdgeView',
]

function App() {
  const [form, setForm] = useState({
    platform: 'Project Management',
    account: 'admin',
    password: '',
    remember: true,
  })
  const [errorMessage, setErrorMessage] = useState('')

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    if (!form.account.trim()) {
      setErrorMessage('Account is required.')
      return
    }

    if (form.platform === 'Dashboard') {
      const loginUrl = new URL(GRAFANA_LOGIN_BRIDGE_URL)
      loginUrl.searchParams.set('account', form.account.trim())
      window.location.href = loginUrl.toString()
      return
    }

    const response = await fetch(`${BACKEND_BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        account: form.account.trim(),
      }),
    })

    if (!response.ok) {
      setErrorMessage('Login failed. Please check backend/proxy.')
      return
    }

    return
  }

  return (
    <main className="page-shell">
      <section className="login-layout" aria-label="SCADA login">
        <aside className="left-panel">
          <div className="brand-wrap">
            <h1 className="brand-title">Efortech</h1>
          </div>

          <div className="left-footer">Software Build: 9.2.2</div>
        </aside>

        <section className="right-panel">
          <form className="login-form" onSubmit={handleSubmit}>
            <h2>Welcome !</h2>
            <p className="welcome-subtitle">Sign in with your SCADA Account</p>

            <label htmlFor="platform">Platform</label>
            <select
              id="platform"
              name="platform"
              value={form.platform}
              onChange={handleChange}
            >
              {PLATFORM_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <label htmlFor="account">
              SCADA Account <span className="required">*</span>
            </label>
            <input
              id="account"
              name="account"
              type="text"
              value={form.account}
              onChange={handleChange}
              autoComplete="username"
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
            />

            <label className="remember-row" htmlFor="remember">
              <input
                id="remember"
                name="remember"
                type="checkbox"
                checked={form.remember}
                onChange={handleChange}
              />
              <span>Remember me</span>
            </label>

            <button type="submit">Login</button>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
          </form>
        </section>
      </section>
    </main>
  )
}

export default App
