import { setCorsHeaders, getRequestBody, sendTwilioRequest } from './_utils.js'

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
    const { orderId, amount, customerName, email } = await getRequestBody(req)
    const youpiUrl = process.env.YOUPI_GATEWAY_URL
    const merchantId = process.env.YOUPI_MERCHANT_ID
    const upiVpa = process.env.YOUPI_UPI_VPA || 'saturn.thrift@okhdfcbank'
    const safeOrderId = orderId || `SATURN-${Date.now().toString().slice(-6)}`
    const inrAmount = Number(amount || 0).toFixed(2)

    // Direct UPI Intent URI (compatible with GPay, PhonePe, Paytm, CRED)
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiVpa)}&pn=${encodeURIComponent('SATURN THRIFTTT')}&am=${inrAmount}&cu=INR&tn=${encodeURIComponent(`VAULT-ORDER-${safeOrderId}`)}`

    // If live YouPI-PG instance is configured
    if (youpiUrl && merchantId && !youpiUrl.includes('yourdomain.com')) {
      const youpiEndpoint = `${youpiUrl.replace(/\/$/, '')}/api/v1/payments`
      const origin = req.headers.origin || `https://${req.headers.host || 'saturnthrifttt.com'}`
      const response = await sendTwilioRequest(youpiEndpoint, '', {
        orderId: safeOrderId,
        amount: inrAmount,
        currency: 'INR',
        returnUrl: `${origin}/checkout/complete`,
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

    // Standalone YouPI-PG Sovereign Direct Rail
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
}

