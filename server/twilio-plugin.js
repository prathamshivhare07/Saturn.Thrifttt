// Twilio SMS & WhatsApp Verification Vite Dev Middleware
import https from 'node:https'

// In-memory token store for local dev fallback & non-Verify messaging
const otpStore = new Map()

function sendTwilioRequest(url, authHeader, bodyParams) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams(bodyParams).toString()
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
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
            resolve({ ok: true, data: parsed })
          } else {
            resolve({ ok: false, data: parsed, statusCode: res.statusCode })
          }
        } catch {
          resolve({ ok: false, error: 'JSON parse error', raw: rawData })
        }
      })
    })

    req.on('error', (err) => reject(err))
    req.write(postData)
    req.end()
  })
}

export function twilioDevPlugin() {
  return {
    name: 'twilio-otp-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Handle /api/send-otp
        if (req.url === '/api/send-otp' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json')
            try {
              const { phone, channel = 'sms' } = JSON.parse(body || '{}')
              if (!phone) {
                res.statusCode = 400
                res.end(JSON.stringify({ success: false, error: 'Phone number is required.' }))
                return
              }

              const accountSid = process.env.TWILIO_ACCOUNT_SID
              const authToken = process.env.TWILIO_AUTH_TOKEN
              const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID
              const fromPhone = process.env.TWILIO_PHONE_NUMBER
              const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER || fromPhone

              const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`
              const code = String(Math.floor(1000 + Math.random() * 9000))
              otpStore.set(normalizedPhone, { code, expiresAt: Date.now() + 10 * 60 * 1000 })

              // Check if live Twilio keys are configured in environment
              if (accountSid && authToken && !accountSid.includes('your_account_sid')) {
                const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

                // Path 1: Twilio Verify API (Recommended for SMS & WhatsApp OTP)
                if (verifySid && !verifySid.includes('your_verify_service_sid')) {
                  const twilioUrl = `https://verify.twilio.com/v2/Services/${verifySid}/Verifications`
                  const response = await sendTwilioRequest(twilioUrl, authHeader, {
                    To: normalizedPhone,
                    Channel: channel === 'whatsapp' ? 'whatsapp' : 'sms',
                  })

                  if (response.ok) {
                    console.log(`[TWILIO VERIFY API] Passcode dispatched to ${normalizedPhone} via ${channel}`)
                    res.statusCode = 200
                    res.end(JSON.stringify({
                      success: true,
                      simulated: false,
                      channel,
                      sid: response.data.sid,
                      message: `Passcode sent to ${normalizedPhone} via Twilio ${channel.toUpperCase()}`,
                    }))
                    return
                  } else {
                    console.error('[TWILIO VERIFY ERROR]', response.data)
                    // If Verify fails (e.g. unverified test number on trial), fallback to simulated so user is not blocked
                  }
                } else if (fromPhone) {
                  // Path 2: Twilio Programmable Messaging API
                  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
                  const isWhatsApp = channel === 'whatsapp'
                  const toRecipient = isWhatsApp ? `whatsapp:${normalizedPhone}` : normalizedPhone
                  const fromSender = isWhatsApp ? `whatsapp:${fromWhatsApp}` : fromPhone

                  const response = await sendTwilioRequest(twilioUrl, authHeader, {
                    To: toRecipient,
                    From: fromSender,
                    Body: `✦ SATURN VAULT PASSCODE: Your one-time verification code is ${code}. Valid for 10 minutes. Do not share.`,
                  })

                  if (response.ok) {
                    console.log(`[TWILIO MESSAGING API] SMS dispatched to ${normalizedPhone}`)
                    res.statusCode = 200
                    res.end(JSON.stringify({
                      success: true,
                      simulated: false,
                      code,
                      channel,
                      sid: response.data.sid,
                      message: `Passcode sent to ${normalizedPhone} via Twilio SMS`,
                    }))
                    return
                  } else {
                    console.error('[TWILIO MESSAGE ERROR]', response.data)
                  }
                }
              }

              // Path 3: Local Simulated Dev Mode (No active keys required yet)
              console.log(`\n=================================================`)
              console.log(`[TWILIO SIMULATED DISPATCH]`)
              console.log(`Target: ${normalizedPhone} (${channel.toUpperCase()})`)
              console.log(`Vault Code: [ ${code} ]`)
              console.log(`Note: Add TWILIO_ACCOUNT_SID & AUTH_TOKEN to .env for real SMS`)
              console.log(`=================================================\n`)

              res.statusCode = 200
              res.end(JSON.stringify({
                success: true,
                simulated: true,
                code: code,
                channel,
                message: `Twilio dev simulation: code is ${code}. Configure .env for live SMS.`,
              }))
            } catch (err) {
              console.error('API send-otp error:', err)
              res.statusCode = 500
              res.end(JSON.stringify({ success: false, error: err?.message || 'Internal server error dispatching OTP' }))
            }
          })
          return
        }

        // Handle /api/verify-otp
        if (req.url === '/api/verify-otp' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json')
            try {
              const { phone, code } = JSON.parse(body || '{}')
              if (!phone || !code) {
                res.statusCode = 400
                res.end(JSON.stringify({ success: false, error: 'Phone and code are required.' }))
                return
              }

              const accountSid = process.env.TWILIO_ACCOUNT_SID
              const authToken = process.env.TWILIO_AUTH_TOKEN
              const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID
              const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`

              // If Twilio Verify service is configured, check with Twilio
              if (accountSid && authToken && verifySid && !verifySid.includes('your_verify_service_sid')) {
                const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
                const twilioUrl = `https://verify.twilio.com/v2/Services/${verifySid}/VerificationCheck`
                const response = await sendTwilioRequest(twilioUrl, authHeader, {
                  To: normalizedPhone,
                  Code: String(code).trim(),
                })

                if (response.ok && response.data.status === 'approved') {
                  res.statusCode = 200
                  res.end(JSON.stringify({ success: true, verified: true }))
                  return
                }
              }

              // Check in-memory store
              const stored = otpStore.get(normalizedPhone)
              if (stored && stored.code === String(code).trim() && stored.expiresAt > Date.now()) {
                otpStore.delete(normalizedPhone)
                res.statusCode = 200
                res.end(JSON.stringify({ success: true, verified: true }))
                return
              }

              res.statusCode = 400
              res.end(JSON.stringify({ success: false, error: 'Invalid or expired passcode.' }))
            } catch (err) {
              console.error('API verify-otp error:', err)
              res.statusCode = 500
              res.end(JSON.stringify({ success: false, error: 'Internal server error verifying OTP' }))
            }
          })
          return
        }

        next()
      })
    },
  }
}
