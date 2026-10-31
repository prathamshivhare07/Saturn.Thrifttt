import { Resend } from 'resend'
import { setCorsHeaders, getRequestBody, sendTwilioRequest, parseEmailFrom, saveOtp, generateOtpToken } from './_utils.js'

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
    const expiresAt = Date.now() + 10 * 60 * 1000
    const token = generateOtpToken(normalizedEmail, code, expiresAt)

    // Persist code in memory and Supabase store_config
    await saveOtp(normalizedEmail, code, expiresAt)

    const resendApiKey = process.env.RESEND_API_KEY
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID
    const sendgridApiKey = process.env.TWILIO_SENDGRID_API_KEY || process.env.SENDGRID_API_KEY
    const fromConfig = parseEmailFrom(process.env.EMAIL_FROM)
    const fromEmail = fromConfig.email
    const fromName = fromConfig.name
    let lastError = ''

    // ============================================================
    // Priority 1: Resend API (Recommended - 3,000 free emails/mo)
    // ============================================================
    if (resendApiKey && !resendApiKey.includes('your_resend') && !resendApiKey.includes('your_api_key')) {
      try {
        const resend = new Resend(resendApiKey)
        const sender = process.env.EMAIL_FROM || 'Saturn Archive <onboarding@resend.dev>'

        const { data, error } = await resend.emails.send({
          from: sender,
          to: [normalizedEmail],
          subject: `✦ Your Saturn.thrifttt Vault Passcode: [ ${code} ]`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fff8f3; padding: 40px 24px; border: 2px solid #1a1715; max-width: 480px; margin: 0 auto; color: #1a1715;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h2 style="font-size: 20px; letter-spacing: 0.15em; text-transform: uppercase; margin: 0; color: #1a1715;">SATURN.THRIFTTT</h2>
                <p style="font-size: 11px; letter-spacing: 0.1em; color: #7d7569; text-transform: uppercase; margin: 4px 0 0 0;">1-of-1 Cosmic Vintage Archive</p>
              </div>
              <div style="background-color: #ffffff; border: 1px solid #e0d8ce; padding: 24px; text-align: center; margin-bottom: 20px;">
                <p style="font-size: 13px; color: #5a544c; margin: 0 0 12px 0;">Your single-use collector verification code:</p>
                <div style="font-size: 40px; font-weight: 700; letter-spacing: 0.3em; color: #a45a2a; padding: 12px 0; font-family: monospace;">${code}</div>
                <p style="font-size: 11px; color: #9c9488; margin: 8px 0 0 0;">Code valid for 10 minutes. Do not share this passcode.</p>
              </div>
              <p style="font-size: 11px; color: #7d7569; text-align: center; margin: 0;">Secured via Resend · Saturn Archive Vault</p>
            </div>
          `,
        })

        if (!error && data?.id) {
          console.log(`[RESEND EMAIL] Passcode dispatched to ${normalizedEmail} (ID: ${data.id})`)
          res.statusCode = 200
          res.end(JSON.stringify({
            success: true,
            simulated: false,
            provider: 'resend',
            email: normalizedEmail,
            id: data.id,
            token,
            message: `Passcode sent to ${normalizedEmail} via Resend.`,
          }))
          return
        } else if (error) {
          console.error('[RESEND ERROR]', error)
          lastError = error.message || 'Resend error'

          // Handle Resend testing domain limitation (403 validation_error)
          // "You can only send testing emails to your own email address (prathamshivhare77@gmail.com)..."
          if (error.statusCode === 403 || String(error.message || '').includes('only send testing emails')) {
            const ownerEmail = 'prathamshivhare77@gmail.com'
            try {
              await resend.emails.send({
                from: sender,
                to: [ownerEmail],
                subject: `✦ Saturn.thrifttt Passcode for [${normalizedEmail}]: [ ${code} ]`,
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fff8f3; padding: 32px 24px; border: 2px solid #1a1715; max-width: 480px; margin: 0 auto; color: #1a1715;">
                    <h3 style="margin: 0 0 12px 0;">SATURN ARCHIVE (RESEND SANDBOX NOTICE)</h3>
                    <p style="font-size: 13px; color: #5a544c;">A user attempted to sign in with unverified address <strong>${normalizedEmail}</strong>.</p>
                    <p style="font-size: 13px; color: #5a544c;">Collector Vault Passcode:</p>
                    <div style="font-size: 36px; font-weight: 700; letter-spacing: 0.3em; color: #a45a2a; padding: 12px 0; font-family: monospace;">${code}</div>
                    <p style="font-size: 11px; color: #7d7569; margin-top: 16px;">
                      💡 Note: To send emails directly to all public customer emails, add your domain at <a href="https://resend.com/domains" target="_blank">resend.com/domains</a>.
                    </p>
                  </div>
                `,
              })
              console.log(`[RESEND SANDBOX] Passcode copy sent to owner ${ownerEmail}`)
            } catch (forwardErr) {
              console.warn('[RESEND OWNER FORWARD EXCEPTION]', forwardErr)
            }

            res.statusCode = 200
            res.end(JSON.stringify({
              success: true,
              simulated: true,
              provider: 'resend_sandbox',
              email: normalizedEmail,
              code: code,
              token,
              sandboxNotice: `Resend Sandbox Active: Since onboarding@resend.dev is in test mode, your code was delivered to registered Resend account (${ownerEmail}). Test passcode [ ${code} ] ready. Connect your custom domain at resend.com/domains to send to any public address.`,
              message: `Test passcode generated for ${normalizedEmail}.`,
            }))
            return
          }
        }
      } catch (err) {
        console.error('[RESEND EXCEPTION]', err)
        lastError = err.message || 'Resend exception'
      }
    }

    // ============================================================
    // Priority 2: Twilio Verify API (Channel: 'email') - Secondary
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
          token,
          message: `Passcode sent to ${normalizedEmail} via Twilio Verify Email.`,
        }))
        return
      } else {
        console.error('[TWILIO VERIFY EMAIL ERROR]', response.data)
      }
    }

    // ============================================================
    // Priority 3: Twilio SendGrid API - Legacy fallback
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
          token,
          message: `Passcode dispatched to ${normalizedEmail} via Twilio SendGrid.`,
        }))
        return
      } else {
        console.error('[TWILIO SENDGRID ERROR]', response.data || response.raw)
      }
    }

    // ============================================================
    // Fallback & Security Layer
    // ============================================================
    const isDev = process.env.NODE_ENV !== 'production'

    if (!isDev) {
      console.error(`[PRODUCTION NOTICE] Email dispatch failed for ${normalizedEmail}. Passcode will NOT be exposed to client.`)
      res.statusCode = 503
      res.end(JSON.stringify({
        success: false,
        error: lastError || 'Email verification service is temporarily unavailable. Please verify your RESEND_API_KEY in Vercel settings or contact support on WhatsApp.',
      }))
      return
    }

    // In Local Development ONLY (localhost): Log & allow fast test auto-fill
    console.log(`\n=================================================`)
    console.log(`[EMAIL DISPATCH · LOCAL DEV SIMULATION]`)
    console.log(`To: ${normalizedEmail}`)
    console.log(`Dev Passcode: [ ${code} ]`)
    console.log(`Provider: Resend / Local Dev Rail`)
    console.log(`Note: This dev auto-fill code is strictly hidden in production mode.`)
    console.log(`=================================================\n`)

    res.statusCode = 200
    res.end(JSON.stringify({
      success: true,
      simulated: true,
      provider: 'dev_simulated',
      code: code,
      email: normalizedEmail,
      token,
      message: `Passcode dispatched to ${normalizedEmail} via local dev simulator.`,
    }))
  } catch (err) {
    console.error('API send-email-otp error:', err)
    res.statusCode = 500
    res.end(JSON.stringify({ success: false, error: err?.message || 'Internal server error dispatching email OTP' }))
  }
}
