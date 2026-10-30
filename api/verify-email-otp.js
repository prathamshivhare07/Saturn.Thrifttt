import { emailOtpStore, setCorsHeaders, getRequestBody, sendTwilioRequest } from './_utils.js'

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
    const { email, code } = await getRequestBody(req)
    if (!email || !code) {
      res.statusCode = 400
      res.end(JSON.stringify({ success: false, error: 'Email and verification code are required.' }))
      return
    }

    const normalizedEmail = email.toLowerCase().trim()
    const enteredCode = String(code).trim()
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID

    // ============================================================
    // Path 1: Twilio Verify Check API
    // ============================================================
    if (accountSid && authToken && verifySid && !accountSid.includes('your_account_sid')) {
      const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
      const twilioUrl = `https://verify.twilio.com/v2/Services/${verifySid}/VerificationCheck`

      const response = await sendTwilioRequest(twilioUrl, `Basic ${authHeader}`, {
        To: normalizedEmail,
        Code: enteredCode,
      })

      if (response.ok && response.data?.status === 'approved') {
        res.statusCode = 200
        res.end(JSON.stringify({ success: true, verified: true }))
        return
      }
    }

    // ============================================================
    // Path 2: In-Memory / Dev Cache Verification
    // ============================================================
    const stored = emailOtpStore.get(normalizedEmail)
    if (stored && stored.code === enteredCode && stored.expiresAt > Date.now()) {
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
}

