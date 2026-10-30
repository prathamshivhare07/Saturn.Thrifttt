import https from 'node:https'
import { createClient } from '@supabase/supabase-js'

// Global in-memory store (retained during warm container lifecycles)
if (!globalThis.__saturnOtpStore) {
  globalThis.__saturnOtpStore = new Map()
}
export const emailOtpStore = globalThis.__saturnOtpStore

/**
 * Supabase client for persisting OTP verifications across serverless instances
 */
export function getSupabaseServerClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Persists OTP in both in-memory store and Supabase for serverless resilience
 */
export async function saveOtp(email, code, expiresAt) {
  emailOtpStore.set(email, { code, expiresAt })
  try {
    const supabase = getSupabaseServerClient()
    if (supabase) {
      await supabase.from('store_config').upsert({
        key: `otp:${email}`,
        value: { code, expiresAt },
      })
    }
  } catch (err) {
    console.warn('[OTP STORE] Note: Supabase store_config save skipped, using memory cache:', err?.message)
  }
}

/**
 * Verifies and consumes the OTP from either memory or Supabase store
 */
export async function verifyAndConsumeOtp(email, enteredCode) {
  // 1. Check in-memory cache first (instant)
  const stored = emailOtpStore.get(email)
  if (stored && stored.code === enteredCode && stored.expiresAt > Date.now()) {
    emailOtpStore.delete(email)
    try {
      const supabase = getSupabaseServerClient()
      if (supabase) {
        await supabase.from('store_config').delete().eq('key', `otp:${email}`)
      }
    } catch {}
    return true
  }

  // 2. Check Supabase (handles cross-container requests on Vercel)
  try {
    const supabase = getSupabaseServerClient()
    if (supabase) {
      const { data, error } = await supabase
        .from('store_config')
        .select('value')
        .eq('key', `otp:${email}`)
        .maybeSingle()

      if (!error && data?.value && data.value.code === enteredCode && data.value.expiresAt > Date.now()) {
        await supabase.from('store_config').delete().eq('key', `otp:${email}`)
        emailOtpStore.delete(email)
        return true
      }
    }
  } catch (err) {
    console.warn('[OTP VERIFY] Note: Supabase check encountered:', err?.message)
  }

  return false
}

export function parseEmailFrom(raw) {
  if (!raw) return { email: 'onboarding@resend.dev', name: 'Saturn Archive' }
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

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )
}

export async function getRequestBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body)
      } catch {
        return {}
      }
    }
    return req.body
  }

  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

export function sendTwilioRequest(url, authHeader, bodyParams, isJson = false) {
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
