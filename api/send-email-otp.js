import { emailOtpStore, setCorsHeaders, getRequestBody, sendTwilioRequest, parseEmailFrom } from './_utils.js'

export default async function handler(req, res) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.statusCode = 200
    res.end()
    return
  }

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ success: false, error: 'Method not allowed' }))
    return
  }

  res.setHeader('Content-Type', 'application/json')

  try {
    const { email } = await getRequestBody(req)
    if (!email || typeof email !== 'string' || !email.includes('@')) {
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
}

