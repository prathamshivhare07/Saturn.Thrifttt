// Twilio Email OTP Verification Vite Middleware
// Supports Twilio Verify (Channel: email) & Twilio SendGrid Email API
import https from 'node:https'

// In-memory token store for local dev fallback & token tracking
const emailOtpStore = new Map()

// Helper: HTTP request for Twilio endpoints
function sendTwilioRequest(url, authHeader, bodyParams, isJson = false) {
  return new Promise((resolve, reject) => {
    const postData = isJson ? JSON.stringify(bodyParams) : new URLSearchParams(bodyParams).toString()
    const contentType = isJson ? 'application/json' : 'application/x-www-form-urlencoded'

    const options = {
      method: 'POST',
      headers: {
        'Authorization': authHeader.startsWith('Basic ') || authHeader.startsWith('Bearer ') ? authHeader : `Basic ${authHeader}`,
        'Content-Type': contentType,
        'Content-Length': Buffer.byteLength(postData),
      },
    }

    const req = https.request(url, options, (res) => {
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, data: parsed, statusCode: res.statusCode })
          } else {
            resolve({ ok: false, data: parsed, statusCode: res.statusCode })
          }
        } catch {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, raw: rawData, statusCode: res.statusCode })
        }
      })
    })

    req.on('error', (err) => reject(err))
    req.write(postData)
    req.end()
  })
}

function parseEmailFrom(raw) {
  if (!raw) return { email: 'vault@saturn.thrifttt', name: 'Saturn Archive' }
  const clean = String(raw).replace(/^["']|["']$/g, '').trim()
  const match = clean.match(/^(?:(.*)<)?([^<>]+)>?$/)
  if (match && match[2] && match[2].includes('@')) {
    const name = match[1] ? match[1].replace(/^["']|["']$/g, '').trim() : 'Saturn Archive'
    return {
      email: match[2].trim(),
      name: name || 'Saturn Archive',
    }
  }
  return { email: clean, name: 'Saturn Archive' }
}

export function emailOtpPlugin() {
  return {
    name: 'twilio-email-otp-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Handle /api/send-email-otp or /api/send-otp
        if ((req.url === '/api/send-email-otp' || req.url === '/api/send-otp') && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json')
            try {
              const { email } = JSON.parse(body || '{}')
              if (!email || !email.includes('@')) {
                res.statusCode = 400
                res.end(JSON.stringify({ success: false, error: 'A valid email address is required.' }))
                return
              }

              const normalizedEmail = email.toLowerCase().trim()
              const code = String(Math.floor(1000 + Math.random() * 9000))
              emailOtpStore.set(normalizedEmail, {
                code,
                expiresAt: Date.now() + 10 * 60 * 1000,
              })

              const accountSid = process.env.TWILIO_ACCOUNT_SID
              const authToken = process.env.TWILIO_AUTH_TOKEN
              const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID
              const sendgridApiKey = process.env.TWILIO_SENDGRID_API_KEY || process.env.SENDGRID_API_KEY
              const fromConfig = parseEmailFrom(process.env.EMAIL_FROM)
              const fromEmail = fromConfig.email
              const fromName = fromConfig.name

              // ============================================================
              // Path 1: Twilio Verify API (Channel: 'email')
              // ============================================================
              if (accountSid && authToken && verifySid && !accountSid.includes('your_account_sid')) {
                const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
                const twilioUrl = `https://verify.twilio.com/v2/Services/${verifySid}/Verifications`

                const response = await sendTwilioRequest(twilioUrl, `Basic ${authHeader}`, {
                  To: normalizedEmail,
                  Channel: 'email',
                })

                if (response.ok) {
                  console.log(`[TWILIO VERIFY EMAIL] Passcode dispatched to ${normalizedEmail}`)
                  res.statusCode = 200
                  res.end(JSON.stringify({
                    success: true,
                    simulated: false,
                    provider: 'twilio_verify',
                    email: normalizedEmail,
                    sid: response.data.sid,
                    message: `Passcode sent to ${normalizedEmail} via Twilio Verify Email.`,
                  }))
                  return
                } else {
                  console.error('[TWILIO VERIFY EMAIL ERROR]', response.data)
                }
              }

              // ============================================================
              // Path 2: Twilio SendGrid API
              // ============================================================
              if (sendgridApiKey && !sendgridApiKey.includes('your_sendgrid_key')) {
                const sendgridUrl = 'https://api.sendgrid.com/v3/mail/send'
                const payload = {
                  personalizations: [{ to: [{ email: normalizedEmail }] }],
                  from: { email: fromEmail, name: fromName },
                  subject: `✦ Your Saturn.thrifttt Vault Passcode: [ ${code} ]`,
                  content: [{
                    type: 'text/html',
                    value: `
                      <div style="font-family: monospace; background-color: #fff8f3; padding: 32px; border: 2px solid #1a1715; max-width: 500px; color: #1a1715;">
                        <h2 style="text-transform: uppercase;">Saturn.thrifttt</h2>
                        <p>Your one-time vault passcode is:</p>
                        <h1 style="font-size: 36px; letter-spacing: 0.25em; color: #5e4000;">${code}</h1>
                        <p style="font-size: 12px; color: #7d7569;">Valid for 10 minutes. Delivered via Twilio SendGrid.</p>
                      </div>
                    `,
                  }],
                }

                const response = await sendTwilioRequest(sendgridUrl, `Bearer ${sendgridApiKey}`, payload, true)
                if (response.ok) {
                  console.log(`[TWILIO SENDGRID SENT] Passcode dispatched to ${normalizedEmail}`)
                  res.statusCode = 200
                  res.end(JSON.stringify({
                    success: true,
                    simulated: false,
                    provider: 'twilio_sendgrid',
                    email: normalizedEmail,
                    message: `Passcode dispatched to ${normalizedEmail} via Twilio SendGrid.`,
                  }))
                  return
                } else {
                  console.error('[TWILIO SENDGRID ERROR]', response.data || response.raw)
                }
              }

              // ============================================================
              // Path 3: Fallback & Security Layer
              // ============================================================
              const isDev = process.env.NODE_ENV !== 'production'

              // In Production: NEVER leak or auto-fill OTPs if Twilio fails
              if (!isDev) {
                console.error(`[PRODUCTION SECURITY NOTICE] Twilio email dispatch failed for ${normalizedEmail}. Passcode will NOT be exposed to client.`)
                res.statusCode = 503
                res.end(JSON.stringify({
                  success: false,
                  error: 'Email verification service is temporarily unavailable. Please try again in a few moments or contact support on WhatsApp.',
                }))
                return
              }

              // In Local Development ONLY (localhost): Log & allow fast test auto-fill
              console.log(`\n=================================================`)
              console.log(`[TWILIO EMAIL DISPATCH · LOCAL DEV ONLY]`)
              console.log(`To: ${normalizedEmail}`)
              console.log(`Provider: Twilio Verify / SendGrid Email Rail`)
              console.log(`Dev Passcode: [ ${code} ]`)
              console.log(`Note: This dev auto-fill code is strictly hidden in production mode.`)
              console.log(`=================================================\n`)

              res.statusCode = 200
              res.end(JSON.stringify({
                success: true,
                simulated: true,
                provider: 'twilio_simulated',
                code: code,
                email: normalizedEmail,
                message: `Passcode dispatched to ${normalizedEmail} via Twilio Email Rail.`,
              }))
            } catch (err) {
              console.error('API send-email-otp error:', err)
              res.statusCode = 500
              res.end(JSON.stringify({ success: false, error: err?.message || 'Internal server error dispatching Twilio email OTP' }))
            }
          })
          return
        }

        // Handle /api/verify-email-otp or /api/verify-otp
        if ((req.url === '/api/verify-email-otp' || req.url === '/api/verify-otp') && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json')
            try {
              const { email, code } = JSON.parse(body || '{}')
              if (!email || !code) {
                res.statusCode = 400
                res.end(JSON.stringify({ success: false, error: 'Email and verification code are required.' }))
                return
              }

              const normalizedEmail = email.toLowerCase().trim()
              const accountSid = process.env.TWILIO_ACCOUNT_SID
              const authToken = process.env.TWILIO_AUTH_TOKEN
              const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID

              // If Twilio Verify service is active, verify via Twilio API
              if (accountSid && authToken && verifySid && !accountSid.includes('your_account_sid')) {
                const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
                const twilioUrl = `https://verify.twilio.com/v2/Services/${verifySid}/VerificationCheck`

                const response = await sendTwilioRequest(twilioUrl, `Basic ${authHeader}`, {
                  To: normalizedEmail,
                  Code: String(code).trim(),
                })

                if (response.ok && response.data.status === 'approved') {
                  res.statusCode = 200
                  res.end(JSON.stringify({ success: true, verified: true }))
                  return
                }
              }

              // Check in-memory store
              const stored = emailOtpStore.get(normalizedEmail)
              if (stored && stored.code === String(code).trim() && stored.expiresAt > Date.now()) {
                emailOtpStore.delete(normalizedEmail)
                res.statusCode = 200
                res.end(JSON.stringify({ success: true, verified: true }))
                return
              }

              res.statusCode = 400
              res.end(JSON.stringify({ success: false, error: 'Invalid or expired passcode. Please request a new code.' }))
            } catch (err) {
              console.error('API verify-email-otp error:', err)
              res.statusCode = 500
              res.end(JSON.stringify({ success: false, error: err?.message || 'Internal server error verifying OTP' }))
            }
          })
          return
        }

        // Handle /api/create-youpi-payment (YouPI-PG 0% Fee UPI Gateway)
        if (req.url === '/api/create-youpi-payment' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json')
            try {
              const { orderId, amount, customerName, email } = JSON.parse(body || '{}')
              const youpiUrl = process.env.YOUPI_GATEWAY_URL
              const merchantId = process.env.YOUPI_MERCHANT_ID
              const upiVpa = process.env.YOUPI_UPI_VPA || 'saturn.thrift@okhdfcbank'
              const safeOrderId = orderId || `SATURN-${Date.now().toString().slice(-6)}`
              const inrAmount = Number(amount || 0).toFixed(2)

              // Build direct UPI Intent URI (compatible with GPay, PhonePe, Paytm, CRED)
              const upiUri = `upi://pay?pa=${encodeURIComponent(upiVpa)}&pn=${encodeURIComponent('SATURN THRIFTTT')}&am=${inrAmount}&cu=INR&tn=${encodeURIComponent(`VAULT-ORDER-${safeOrderId}`)}`

              // If live YouPI-PG instance is configured:
              if (youpiUrl && merchantId && !youpiUrl.includes('yourdomain.com')) {
                const youpiEndpoint = `${youpiUrl.replace(/\/$/, '')}/api/v1/payments`
                const response = await sendTwilioRequest(youpiEndpoint, '', {
                  orderId: safeOrderId,
                  amount: inrAmount,
                  currency: 'INR',
                  returnUrl: `${req.headers.origin || 'http://localhost:5173'}/checkout/complete`,
                  metadata: JSON.stringify({ customerName, email, store: 'saturn.thrifttt' }),
                }, true)

                if (response.ok && response.data?.checkoutUrl) {
                  res.statusCode = 200
                  res.end(JSON.stringify({
                    success: true,
                    liveGateway: true,
                    checkoutUrl: response.data.checkoutUrl,
                    paymentId: response.data.paymentId,
                    upiUri,
                    upiVpa,
                  }))
                  return
                }
              }

              // Standalone YouPI-PG Sovereign Direct Rail:
              res.statusCode = 200
              res.end(JSON.stringify({
                success: true,
                liveGateway: false,
                upiUri,
                upiVpa,
                amount: inrAmount,
                orderId: safeOrderId,
                message: 'YouPI-PG sovereign direct payment session initialized (0% fees).',
              }))
            } catch (err) {
              console.error('API create-youpi-payment error:', err)
              res.statusCode = 500
              res.end(JSON.stringify({ success: false, error: err?.message || 'Error initializing YouPI payment' }))
            }
          })
          return
        }

        next()
      })
    },
  }
}
