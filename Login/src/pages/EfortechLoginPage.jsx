import { useState } from 'react'
import './style/efortech-login.css'
import efortechLogo from '../assets/efortech_logo.png'

const BACKEND_BASE_URL = window.location.origin

function EfortechLoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    const trimmedUsername = username.trim()
    if (!trimmedUsername) {
      setErrorMessage('Username is required.')
      return
    }
    if (!password) {
      setErrorMessage('Password is required.')
      return
    }

    const response = await fetch(`${BACKEND_BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        account: trimmedUsername,
        password,
        remember,
      }),
    })

    if (!response.ok) {
      setErrorMessage('Sign in failed. Invalid username or password.')
      return
    }

    onLoginSuccess(trimmedUsername)
  }

  return (
    <main className="efortech-page">
      <section className="efortech-login-card" aria-label="Efortech Sign In">
        <header className="efortech-brand">
          <img
            className="efortech-brand-logo"
            src={efortechLogo}
            alt="Efortech"
          />
        </header>

        <form className="efortech-form" onSubmit={handleSubmit}>
          <h2>Sign In</h2>

          <input
            type="text"
            placeholder="Username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />

          <div className="efortech-password-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="efortech-eye-btn"
              aria-label="Toggle password visibility"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className={`efortech-eye-icon ${showPassword ? 'is-open' : 'is-closed'}`}
              >
                <path
                  d="M1.5 12s3.5-6.5 10.5-6.5S22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                {!showPassword && (
                  <line
                    x1="4"
                    y1="20"
                    x2="20"
                    y2="4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>
          </div>

          <div className="efortech-form-row">
            <label>
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              Remember
            </label>
          </div>

          <button className="efortech-submit" type="submit">
            Sign In
          </button>

          {errorMessage && <p className="efortech-error">{errorMessage}</p>}
        </form>
      </section>
    </main>
  )
}

export default EfortechLoginPage
