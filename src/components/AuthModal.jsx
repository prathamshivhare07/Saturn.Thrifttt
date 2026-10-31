import { useState, useEffect, useRef } from 'react'

export default function AuthModal({
  isOpen,
  onClose,
  currentUser,
  onLogin,
  onLogout,
}) {
  // Navigation / Step: 'email' | 'otp'
  const [authStep, setAuthStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otpDigits, setOtpDigits] = useState(['', '', '', ''])
  const [otpToken, setOtpToken] = useState('')
  const [generatedOtp, setGeneratedOtp] = useState('')
  const [sandboxNotice, setSandboxNotice] = useState('')
  const [isSimulated, setIsSimulated] = useState(true)
  const [resendTimer, setResendTimer] = useState(30)
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const otpInputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)]

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setError('')
      setSuccessMsg('')
      setSandboxNotice('')
      setAuthStep('email')
      setOtpDigits(['', '', '', ''])
      setOtpToken('')
    }
  }, [isOpen])

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval = null
    if (authStep === 'otp' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [authStep, resendTimer])

  if (!isOpen) return null

  // Complete user login in localStorage and parent state
  const completeUserLogin = (normalizedEmail) => {
    const savedUsers = JSON.parse(localStorage.getItem('saturn_registered_users') || '[]')
    const existingUser = savedUsers.find(
      (u) => u.email.toLowerCase() === normalizedEmail.toLowerCase()
    )

    let authenticatedUser
    if (existingUser) {
      authenticatedUser = existingUser
    } else {
      // Mint new user seamlessly on first Email OTP verification
      const handle = normalizedEmail.split('@')[0].toUpperCase()
      authenticatedUser = {
        id: `user-${Date.now()}`,
        name: handle,
        email: normalizedEmail,
        phone: '',
        tier: '✦ VERIFIED VAULT ARCHIVIST',
        memberSince: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase(),
        address: null,
        measurements: null,
        orders: [],
      }
      savedUsers.push(authenticatedUser)
      localStorage.setItem('saturn_registered_users', JSON.stringify(savedUsers))
    }

    onLogin(authenticatedUser)
    setSuccessMsg('✦ Email Verified! Welcome to the Saturn Vault.')
    setTimeout(() => {
      onClose()
    }, 700)
  }

  // Generate 4-digit OTP & dispatch via /api/send-email-otp
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault()
    setError('')
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || !normalizedEmail.includes('@') || !normalizedEmail.includes('.')) {
      setError('Please enter a valid email address (e.g. name@domain.com).')
      return
    }

    setIsSending(true)

    try {
      const res = await fetch('/api/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      })

      const data = await res.json()
      if (data.success) {
        setOtpToken(data.token || '')
        setGeneratedOtp(data.code || '')
        setSandboxNotice(data.sandboxNotice || '')
        setIsSimulated(Boolean(data.simulated))
        setAuthStep('otp')
        setResendTimer(30)
        
        // In sandbox or dev mode, auto-fill the test passcode
        if (data.code && data.simulated) {
          const digits = String(data.code).split('')
          setOtpDigits(digits)
        } else {
          setOtpDigits(['', '', '', ''])
        }

        setTimeout(() => {
          otpInputRefs[0].current?.focus()
        }, 150)
      } else {
        setError(data.error || 'Failed to dispatch email verification code. Please retry.')
      }
    } catch {
      // In production, never fallback locally
      if (!import.meta.env.DEV) {
        setError('Verification service unavailable. Please retry or contact support on WhatsApp.')
        return
      }
      // Local development test fallback only
      const fallbackCode = String(Math.floor(1000 + Math.random() * 9000))
      setGeneratedOtp(fallbackCode)
      setIsSimulated(true)
      setAuthStep('otp')
      setResendTimer(30)
      setOtpDigits(['', '', '', ''])
      setTimeout(() => {
        otpInputRefs[0].current?.focus()
      }, 150)
    } finally {
      setIsSending(false)
    }
  }

  // Handle digit input in OTP box
  const handleDigitChange = (index, value) => {
    setError('')
    const cleanVal = value.replace(/\D/g, '').slice(-1)

    const newDigits = [...otpDigits]
    newDigits[index] = cleanVal
    setOtpDigits(newDigits)

    // Advance to next box if filled
    if (cleanVal && index < 3) {
      otpInputRefs[index + 1].current?.focus()
    }

    // Auto-verify if all 4 digits are present
    const fullCode = newDigits.join('')
    if (fullCode.length === 4) {
      verifyOtpCode(fullCode)
    }
  }

  // Handle backspace navigation in OTP
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs[index - 1].current?.focus()
    }
  }

  // Handle pasting full OTP
  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (pasted.length > 0) {
      const newDigits = ['', '', '', '']
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i]
      }
      setOtpDigits(newDigits)
      if (pasted.length === 4) {
        verifyOtpCode(pasted)
      } else {
        otpInputRefs[Math.min(pasted.length, 3)].current?.focus()
      }
    }
  }


  // Verify OTP with email API endpoint or local store
  const verifyOtpCode = async (enteredOtp) => {
    setError('')
    setIsVerifying(true)
    const normalizedEmail = email.trim().toLowerCase()

    try {
      const res = await fetch('/api/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          code: enteredOtp,
          token: otpToken,
        }),
      })

      const data = await res.json()
      if (data.success) {
        completeUserLogin(normalizedEmail)
      } else {
        setError(data.error || 'Invalid passcode. Please check code or tap [Auto-Fill].')
        setIsVerifying(false)
      }
    } catch {
      // Local fallback check
      if (enteredOtp === generatedOtp) {
        completeUserLogin(normalizedEmail)
      } else {
        setError(`Invalid passcode. Please enter ${generatedOtp} or tap [Auto-Fill].`)
        setIsVerifying(false)
      }
    }
  }

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="auth-modal-panel" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Bar */}
        <div className="auth-modal-header">
          <div className="auth-brand-chip">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {currentUser ? 'verified_user' : 'mark_email_read'}
            </span>
            <span>
              {currentUser ? 'COLLECTOR ARCHIVE PASSPORT' : 'EMAIL OTP VERIFICATION'}
            </span>
          </div>
          <button
            type="button"
            className="auth-close-btn"
            onClick={onClose}
            aria-label="Close authentication modal"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Dynamic Alerts */}
        {error && <div className="auth-alert-error">{error}</div>}
        {successMsg && <div className="auth-alert-success">{successMsg}</div>}

        {!currentUser ? (
          <div className="auth-otp-flow-wrap">
            {/* ============================================================
                STEP 1: ENTER EMAIL ADDRESS
                ============================================================ */}
            {authStep === 'email' && (
              <form onSubmit={handleSendOtp} className="auth-form-body">
                <div className="auth-section-heading">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 className="auth-title">Passwordless Email Login</h3>
                    <span className="twilio-badge">RESEND EMAIL RAIL</span>
                  </div>
                  <p className="auth-subtitle">
                    Enter your email to receive a 4-digit Vault Passcode via Resend. Zero passwords, universal inbox delivery.
                  </p>
                </div>

                <div className="auth-input-group">
                  <label htmlFor="auth-email-input">Collector Email Address</label>
                  <div className="email-input-wrap">
                    <span className="material-symbols-outlined email-prefix-icon">mail</span>
                    <input
                      id="auth-email-input"
                      type="email"
                      placeholder="e.g. pratham@saturn.archive or name@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>
                </div>

                {/* Quick Domain Suggestion Pills */}
                <div className="quick-domain-pills">
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--on-surface-variant)' }}>
                    QUICK FILL:
                  </span>
                  {['@gmail.com', '@saturn.archive', '@outlook.com', '@icloud.com'].map((dom) => (
                    <button
                      key={dom}
                      type="button"
                      className="domain-pill-btn"
                      onClick={() => {
                        const base = email.includes('@') ? email.split('@')[0] : email
                        setEmail(`${base || 'archivist'}${dom}`)
                      }}
                    >
                      {dom}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  className="btn-auth-submit"
                  disabled={isSending}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {isSending ? 'sync' : 'send'}
                  </span>
                  <span>
                    {isSending
                      ? 'DISPATCHING PASSCODE...'
                      : 'GET 4-DIGIT ACCESS PASSCODE'}
                  </span>
                </button>

                {/* Email Perks Strip */}
                <div className="auth-perks-strip" style={{ margin: '8px -22px -22px', borderBottom: 'none' }}>
                  <div className="perk-item">
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--primary)' }}>
                      bolt
                    </span>
                    <span>Instant Drop Entry · Zero Passwords</span>
                  </div>
                  <div className="perk-item">
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#16a34a' }}>
                      verified
                    </span>
                    <span>Powered by Resend Email Rail</span>
                  </div>
                  <div className="perk-item">
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--tertiary)' }}>
                      straighten
                    </span>
                    <span>Saved Sizing & 1-Click Vault Checkout</span>
                  </div>
                </div>
              </form>
            )}

            {/* ============================================================
                STEP 2: ENTER & VERIFY 4-DIGIT EMAIL OTP
                ============================================================ */}
            {authStep === 'otp' && (
              <div className="auth-form-body">
                <div className="auth-section-heading">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 className="auth-title">Verify Email Passcode</h3>
                    <button
                      type="button"
                      className="btn-edit-number"
                      onClick={() => {
                        setAuthStep('email')
                        setError('')
                      }}
                    >
                      [ Edit Email ]
                    </button>
                  </div>
                  <p className="auth-subtitle">
                    Enter the 4-digit code dispatched via <strong>Resend Email Rail</strong> to{' '}
                    <strong style={{ color: 'var(--on-surface)' }}>{email}</strong>
                  </p>
                </div>

                {/* Sandbox / Testing Notice Banner */}
                {sandboxNotice ? (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 12px', margin: '0 0 14px 0', fontSize: 11, color: '#92400e', fontFamily: 'var(--font-mono)' }}>
                    <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: '#b45309' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#d97706' }}>info</span>
                      <span>RESEND SANDBOX ACTIVE (TESTING MODE)</span>
                    </div>
                    <div style={{ lineHeight: 1.4 }}>
                      Passcode dispatched to Resend owner email (<strong>prathamshivhare77@gmail.com</strong>). Passcode <strong style={{ color: '#b45309', letterSpacing: '0.1em' }}>[{generatedOtp}]</strong> auto-filled below for instant testing.
                    </div>
                    <div style={{ fontSize: 9.5, color: '#78350f', marginTop: 6 }}>
                      ✦ To deliver emails directly to all public customer emails, connect your custom domain at <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" style={{ color: '#b45309', textDecoration: 'underline' }}>resend.com/domains</a>.
                    </div>
                  </div>
                ) : (
                  /* Verification Notice */
                  <div className="live-email-banner">
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#16a34a' }}>
                      mark_email_read
                    </span>
                    <div>
                      <div style={{ fontWeight: 800 }}>AUTHENTICATION CODE DISPATCHED</div>
                      <div style={{ fontSize: 10, color: 'var(--on-surface-variant)' }}>
                        Check your email inbox or spam folder for your 4-digit access code.
                      </div>
                    </div>
                  </div>
                )}

                {/* 4-Box Segmented OTP Inputs */}
                <div className="otp-boxes-container" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={otpInputRefs[idx]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className={`otp-digit-box ${digit ? 'filled' : ''}`}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e.key)}
                      aria-label={`Digit ${idx + 1}`}
                    />
                  ))}
                </div>

                <div className="otp-resend-row">
                  {resendTimer > 0 ? (
                    <span className="timer-countdown">
                      Resend passcode in <strong style={{ color: 'var(--primary)' }}>{resendTimer}s</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn-resend-active"
                      onClick={handleSendOtp}
                    >
                      [ Resend New Passcode ]
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="btn-auth-submit"
                  disabled={isVerifying || otpDigits.join('').length < 4}
                  onClick={() => verifyOtpCode(otpDigits.join(''))}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {isVerifying ? 'sync' : 'lock_open'}
                  </span>
                  <span>{isVerifying ? 'VERIFYING CODE...' : 'VERIFY & UNLOCK VAULT'}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ============================================================
              LOGGED IN: ARCHIVIST PASSPORT & ACCOUNT DASHBOARD
              ============================================================ */
          <div className="auth-profile-body">
            <div className="profile-badge-card">
              <div className="profile-avatar-circle">
                {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : 'AR'}
              </div>
              <div className="profile-identity">
                <div className="profile-name">{currentUser.name || 'ARCHIVIST'}</div>
                <div className="profile-email">
                  {currentUser.email}{currentUser.phone ? ` · ${currentUser.phone}` : ''}
                </div>
                <div className="profile-tier-tag">
                  <span className="pulse-dot" />
                  <span>{currentUser.tier || '✦ VERIFIED VAULT ARCHIVIST'}</span>
                </div>
              </div>
            </div>

            {/* Saved Measurements */}
            <div className="profile-section-card">
              <div className="card-section-title">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>straighten</span>
                <span>SAVED FIT SPECIFICATIONS</span>
              </div>
              <div className="profile-metrics-grid">
                <div className="metric-box">
                  <span className="metric-label">PREFERRED P2P</span>
                  <span className="metric-val">{currentUser.measurements?.p2p || '—'}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">WAIST FIT</span>
                  <span className="metric-val">{currentUser.measurements?.waist || '—'}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">HOODIE GSM</span>
                  <span className="metric-val">{currentUser.measurements?.gsm || '—'}</span>
                </div>
              </div>
              {!currentUser.measurements?.p2p && !currentUser.measurements?.waist && !currentUser.measurements?.gsm && (
                <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--outline)' }}>
                  No custom fit specifications recorded yet.
                </div>
              )}
            </div>

            {/* Saved Delivery Address */}
            <div className="profile-section-card">
              <div className="card-section-title">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>home_pin</span>
                <span>DEFAULT VAULT DISPATCH ADDRESS</span>
              </div>
              {currentUser.address?.street ? (
                <div className="profile-address-text">
                  {[currentUser.address?.street, currentUser.address?.city, currentUser.address?.state, currentUser.address?.pincode].filter(Boolean).join(', ')}
                </div>
              ) : (
                <div style={{ padding: '6px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--outline)' }}>
                  No default dispatch address saved yet.
                </div>
              )}
            </div>

            {/* Order History */}
            <div className="profile-section-card">
              <div className="card-section-title">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>inventory_2</span>
                <span>COLLECTOR ACQUISITIONS ({currentUser.orders?.length || 0})</span>
              </div>
              {currentUser.orders && currentUser.orders.length > 0 ? (
                <div className="profile-orders-list">
                  {currentUser.orders.map((ord, idx) => (
                    <div key={ord.id || idx} className="profile-order-row">
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--primary)', fontWeight: 700 }}>
                          {ord.id} · {ord.lot}
                        </div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600 }}>
                          {ord.item || ord.title}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#16a34a', marginTop: 2 }}>
                          ✦ {ord.status}
                        </div>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}>
                        ₹{Number(ord.price || ord.total || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '12px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--outline)' }}>
                  No previous orders yet. Claim your first relic from the vault!
                </div>
              )}
            </div>

            <div className="profile-actions-row">
              <button
                type="button"
                className="btn-auth-logout"
                onClick={() => {
                  onLogout()
                  onClose()
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
                <span>Sign Out of Archive</span>
              </button>
              <button
                type="button"
                className="btn-auth-done"
                onClick={onClose}
              >
                <span>Close Passport</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
