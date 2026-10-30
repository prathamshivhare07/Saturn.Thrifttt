import https from 'node:https'

// Global in-memory store (retained during warm container lifecycles)
if (!globalThis.__saturnOtpStore) {
  globalThis.__saturnOtpStore = new Map()
}
export const emailOtpStore = globalThis.__saturnOtpStore

export function parseEmailFrom(raw) {
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

