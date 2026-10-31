import { useState } from 'react'

export default function CheckoutModal({
  isOpen,
  onClose,
  cart,
  cartTotal,
  currentUser,
  onOrderComplete,
  storeSettings,
  activeOffers = [],
}) {
  const [step, setStep] = useState(1) // 1: Shipping, 2: Payment Rail, 3: Confirmation
  const [paymentRail, setPaymentRail] = useState('upi') // Only 2 options: 'upi', 'cod'

  // Shipping Form State (prefill if logged in)
  const [shippingData, setShippingData] = useState({
    fullName: currentUser?.name || 'Pratham Sharma',
    email: currentUser?.email || 'pratham@saturn.archive',
    phone: currentUser?.phone || '+91 93299 93116',
    street: currentUser?.address?.street || 'Arera Colony',
    city: currentUser?.address?.city || 'Bhopal',
    state: currentUser?.address?.state || 'Madhya Pradesh',
    pincode: currentUser?.address?.pincode || '462016',
    country: 'India',
  })

  // YouPI-PG Sovereign UPI & COD Token Configuration
  const youpiVpa = (storeSettings?.upiVpa && !storeSettings.upiVpa.includes('okhdfcbank'))
    ? storeSettings.upiVpa
    : (import.meta.env.VITE_YOUPI_UPI_VPA || '9329993116@kotakbank')
  const codPercent = storeSettings?.codTokenPercent || 30
  const [upiUtrNumber, setUpiUtrNumber] = useState('')
  const [codTokenUtr, setCodTokenUtr] = useState('')
  const [copiedVpa, setCopiedVpa] = useState(false)

  // Promo Code / Coupon Offer State
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponError, setCouponError] = useState('')

  // Calculate discount
  let discountAmount = 0
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percent') {
      discountAmount = Math.round((cartTotal * appliedCoupon.value) / 100)
    } else {
      discountAmount = appliedCoupon.value
    }
  }
  const finalTotal = Math.max(0, cartTotal - discountAmount)

  // COD Calculations based on configured percentage
  const codTokenAmount = Math.round(finalTotal * (codPercent / 100))
  const codBalanceAmount = finalTotal - codTokenAmount

  // Payment processing states
  const [isProcessing, setIsProcessing] = useState(false)
  const [completedOrder, setCompletedOrder] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  if (!isOpen) return null

  const handleShippingChange = (e) => {
    const { name, value } = e.target
    setShippingData((prev) => ({ ...prev, [name]: value }))
  }

  const handleProceedToPayment = (e) => {
    e.preventDefault()
    if (!shippingData.fullName || !shippingData.phone || !shippingData.street || !shippingData.city) {
      setErrorMessage('Please fill in complete delivery details.')
      return
    }
    setErrorMessage('')
    setStep(2)
  }

  // Process payment submission
  const handlePayNow = () => {
    if (paymentRail === 'upi' && (!upiUtrNumber || upiUtrNumber.length < 6)) {
      setErrorMessage('Please enter your 12-digit UPI Bank UTR / Reference ID from your payment receipt.')
      return
    }

    if (paymentRail === 'cod' && (!codTokenUtr || codTokenUtr.length < 6)) {
      setErrorMessage(`Please enter the 12-digit Bank UTR for your ${codPercent}% advance reservation token.`)
      return
    }

    setIsProcessing(true)
    setErrorMessage('')

    setTimeout(() => {
      const orderId = `SAT-${Math.floor(100000 + Math.random() * 900000)}`
      const activeUtr = paymentRail === 'upi' ? upiUtrNumber : codTokenUtr
      const newOrder = {
        id: orderId,
        date: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
        items: [...cart],
        subtotal: cartTotal,
        discount: discountAmount,
        couponCode: appliedCoupon?.code || null,
        total: finalTotal,
        paymentRail: paymentRail === 'upi' ? 'YouPI-PG Sovereign UPI' : 'Cash On Delivery (COD)',
        utrNumber: activeUtr,
        codTokenAmount: paymentRail === 'cod' ? codTokenAmount : null,
        codBalanceAmount: paymentRail === 'cod' ? codBalanceAmount : null,
        shipping: shippingData,
        status: paymentRail === 'cod'
          ? `COD Confirmed · ${codPercent}% Token (₹${codTokenAmount.toLocaleString('en-IN')}) Secured · Balance ₹${codBalanceAmount.toLocaleString('en-IN')} Due on Delivery`
          : 'Paid & Authenticated via YouPI-PG (0% Fee) // Dispatched',
      }

      setCompletedOrder(newOrder)
      setIsProcessing(false)
      setStep(3)
      onOrderComplete(newOrder)
    }, 1200)
  }

  return (
    <div className="checkout-modal-backdrop" onClick={onClose}>
      <div className="checkout-modal-panel" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="checkout-modal-header">
          <div className="checkout-step-indicator">
            <span className={`step-dot ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`}>1. Dispatch</span>
            <span className="step-arrow">→</span>
            <span className={`step-dot ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`}>2. Payment (UPI / COD)</span>
            <span className="step-arrow">→</span>
            <span className={`step-dot ${step === 3 ? 'active done' : ''}`}>3. Confirmation</span>
          </div>

          <button
            type="button"
            className="checkout-close-btn"
            onClick={onClose}
            aria-label="Close checkout"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* STEP 1: SHIPPING & DISPATCH */}
        {step === 1 && (
          <div className="checkout-body-grid">
            <form onSubmit={handleProceedToPayment} className="checkout-form-col">
              <div className="checkout-section-title">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>local_shipping</span>
                <span>PAN-INDIA DISPATCH SPECIFICATIONS</span>
              </div>

              {currentUser && (
                <div className="checkout-auth-banner">
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--primary)' }}>verified</span>
                  <span>Logged in as <strong>{currentUser.name}</strong> · Address pre-filled from your collector pass</span>
                </div>
              )}

              {errorMessage && <div className="checkout-alert-error">{errorMessage}</div>}

              <div className="checkout-field-group">
                <label htmlFor="chk-fullName">Recipient Full Name</label>
                <input
                  id="chk-fullName"
                  name="fullName"
                  type="text"
                  value={shippingData.fullName}
                  onChange={handleShippingChange}
                  required
                />
              </div>

              <div className="checkout-field-row">
                <div className="checkout-field-group">
                  <label htmlFor="chk-phone">WhatsApp Contact Number</label>
                  <input
                    id="chk-phone"
                    name="phone"
                    type="text"
                    value={shippingData.phone}
                    onChange={handleShippingChange}
                    required
                  />
                </div>
                <div className="checkout-field-group">
                  <label htmlFor="chk-email">Email (Vault Manifest)</label>
                  <input
                    id="chk-email"
                    name="email"
                    type="email"
                    value={shippingData.email}
                    onChange={handleShippingChange}
                    required
                  />
                </div>
              </div>

              <div className="checkout-field-group">
                <label htmlFor="chk-street">Street Address &amp; Studio / Apartment #</label>
                <input
                  id="chk-street"
                  name="street"
                  type="text"
                  value={shippingData.street}
                  onChange={handleShippingChange}
                  required
                />
              </div>

              <div className="checkout-field-row">
                <div className="checkout-field-group">
                  <label htmlFor="chk-city">City</label>
                  <input
                    id="chk-city"
                    name="city"
                    type="text"
                    value={shippingData.city}
                    onChange={handleShippingChange}
                    required
                  />
                </div>
                <div className="checkout-field-group">
                  <label htmlFor="chk-state">State</label>
                  <input
                    id="chk-state"
                    name="state"
                    type="text"
                    value={shippingData.state}
                    onChange={handleShippingChange}
                    required
                  />
                </div>
                <div className="checkout-field-group">
                  <label htmlFor="chk-pincode">PIN Code</label>
                  <input
                    id="chk-pincode"
                    name="pincode"
                    type="text"
                    value={shippingData.pincode}
                    onChange={handleShippingChange}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-checkout-next">
                <span>Continue to Payment (UPI / COD)</span>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
              </button>
            </form>

            {/* Order Manifest Summary Sidebar */}
            <div className="checkout-manifest-col">
              <div className="manifest-header">
                <span>VAULT MANIFEST ({cart.length} ITEMS)</span>
                <span className="manifest-lot">ORBIT #04</span>
              </div>

              <div className="manifest-items-scroll">
                {cart.map((item) => (
                  <div key={item.id} className="manifest-item-card">
                    <img src={item.img} alt={item.title} className="manifest-thumb" />
                    <div className="manifest-details">
                      <div className="manifest-lot-tag">{item.lot}</div>
                      <div className="manifest-title">{item.title}</div>
                      <div className="manifest-price">₹{item.price.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="manifest-totals-box">
                <div className="manifest-row">
                  <span>Vault Subtotal:</span>
                  <span>₹{cartTotal.toLocaleString('en-IN')}</span>
                </div>

                {appliedCoupon && (
                  <div className="manifest-row" style={{ color: '#16a34a', fontWeight: 700 }}>
                    <span>Coupon ({appliedCoupon.code}):</span>
                    <span>-₹{discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="manifest-row">
                  <span>Reinforced Kraft Tube:</span>
                  <span style={{ color: '#16a34a' }}>COMPLIMENTARY</span>
                </div>
                <div className="manifest-row">
                  <span>Pan-India Transit:</span>
                  <span style={{ color: '#16a34a' }}>FREE // FAST DISPATCH</span>
                </div>
                <div className="manifest-total-highlight">
                  <span>TOTAL DISPATCH:</span>
                  <span>₹{finalTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Coupon Code Redemption Box */}
              <div className="checkout-coupon-card">
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    placeholder="PROMO CODE (e.g. SATURN10)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={!!appliedCoupon}
                    className="checkout-coupon-input"
                  />
                  {appliedCoupon ? (
                    <button
                      type="button"
                      className="btn-coupon-remove"
                      onClick={() => {
                        setAppliedCoupon(null)
                        setCouponCode('')
                        setCouponError('')
                      }}
                    >
                      ✕ Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-coupon-apply"
                      onClick={() => {
                        if (!couponCode.trim()) return
                        const found = activeOffers.find(
                          (o) => o.active && o.code.toUpperCase() === couponCode.trim().toUpperCase()
                        )
                        if (!found) {
                          setCouponError('Invalid or expired coupon code.')
                          return
                        }
                        if (found.minSpend && cartTotal < found.minSpend) {
                          setCouponError(`Min order of ₹${found.minSpend.toLocaleString('en-IN')} required`)
                          return
                        }
                        setAppliedCoupon(found)
                        setCouponError('')
                      }}
                    >
                      APPLY
                    </button>
                  )}
                </div>
                {couponError && <div className="coupon-error-text">{couponError}</div>}
                {appliedCoupon && (
                  <div className="coupon-success-text">
                    ✦ Code {appliedCoupon.code} applied! Saved ₹{discountAmount.toLocaleString('en-IN')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PAYMENT RAIL SELECTION (ONLY UPI & COD) */}
        {step === 2 && (
          <div className="checkout-body-grid">
            <div className="checkout-form-col">
              <div className="checkout-section-title">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>payment</span>
                <span>SELECT PAYMENT METHOD</span>
              </div>

              {errorMessage && <div className="checkout-alert-error">{errorMessage}</div>}

              {/* 2 Primary Payment Options: UPI and COD */}
              <div className="payment-rails-grid">
                {/* Option 1: YouPI-PG 0% Fee Instant UPI */}
                <div
                  className={`payment-rail-card ${paymentRail === 'upi' ? 'selected' : ''}`}
                  onClick={() => {
                    setPaymentRail('upi')
                    setErrorMessage('')
                  }}
                >
                  <div className="rail-radio-row">
                    <input
                      type="radio"
                      name="paymentRail"
                      checked={paymentRail === 'upi'}
                      onChange={() => setPaymentRail('upi')}
                    />
                    <span className="rail-title">Instant UPI &amp; QR</span>
                  </div>
                  <span className="rail-caption">
                    Zero gateway cut · GPay, PhonePe, Paytm, CRED · Instant bank settlement
                  </span>
                  <div className="rail-chips">
                    <span className="rail-chip" style={{ color: '#16a34a', borderColor: '#16a34a' }}>
                      0% PLATFORM FEE
                    </span>
                    <span className="rail-chip">₹{finalTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Option 2: Cash On Delivery (COD) with Configurable Token */}
                <div
                  className={`payment-rail-card ${paymentRail === 'cod' ? 'selected' : ''}`}
                  onClick={() => {
                    setPaymentRail('cod')
                    setErrorMessage('')
                  }}
                >
                  <div className="rail-radio-row">
                    <input
                      type="radio"
                      name="paymentRail"
                      checked={paymentRail === 'cod'}
                      onChange={() => setPaymentRail('cod')}
                    />
                    <span className="rail-title">Cash On Delivery (COD)</span>
                  </div>
                  <span className="rail-caption">
                    Pay {codPercent}% advance token now, balance {100 - codPercent}% cash/UPI upon doorstep unboxing
                  </span>
                  <div className="rail-chips">
                    <span className="rail-chip" style={{ color: '#d97706', borderColor: '#d97706' }}>
                      {codPercent}% TOKEN (₹{codTokenAmount.toLocaleString('en-IN')})
                    </span>
                    <span className="rail-chip" style={{ color: '#16a34a', borderColor: '#16a34a' }}>
                      DOORSTEP INSPECTION
                    </span>
                  </div>
                </div>
              </div>

              {/* Sub-Form Based on Rail */}
              <div className="rail-detail-box">
                {/* UPI DETAIL PANEL */}
                {paymentRail === 'upi' && (
                  <div className="upi-input-panel">
                    <div className="youpi-status-strip">
                      <div className="youpi-badge-tag">
                        <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#16a34a' }}>verified_user</span>
                        <span>YOUPI-PG SOVEREIGN GATEWAY</span>
                      </div>
                      <span className="youpi-zero-fee-pill">0% COMMISSIONS · DIRECT BANK SETTLEMENT</span>
                    </div>

                    {/* VPA Display with Copy */}
                    <div className="checkout-field-group" style={{ marginTop: 12 }}>
                      <label>Vault Recipient UPI Address (VPA)</label>
                      <div className="youpi-vpa-copy-bar">
                        <span className="youpi-vpa-text">{youpiVpa}</span>
                        <button
                          type="button"
                          className="btn-copy-vpa"
                          onClick={() => {
                            navigator.clipboard.writeText(youpiVpa)
                            setCopiedVpa(true)
                            setTimeout(() => setCopiedVpa(false), 2000)
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                            {copiedVpa ? 'check' : 'content_copy'}
                          </span>
                          <span>{copiedVpa ? 'COPIED!' : 'COPY VPA'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Dynamic Real QR Code & Mobile Deep Link */}
                    <div className="upi-qr-preview youpi-qr-box">
                      <div className="qr-img-wrapper">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`upi://pay?pa=${youpiVpa}&pn=SATURN%20THRIFTTT&am=${finalTotal}&cu=INR&tn=VAULT-ORDER`)}&bgcolor=fff8f3&color=1a1715`}
                          alt="YouPI-PG Dynamic UPI QR Code"
                          className="youpi-live-qr-img"
                        />
                      </div>
                      <div className="qr-meta" style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: 'var(--on-surface)' }}>
                          Scan to Pay Full Amount: ₹{finalTotal.toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                          Instant checkout with Google Pay, PhonePe, Paytm, CRED, or BHIM.
                        </div>
                        <a
                          href={`upi://pay?pa=${encodeURIComponent(youpiVpa)}&pn=${encodeURIComponent('SATURN THRIFTTT')}&am=${finalTotal}&cu=INR&tn=${encodeURIComponent('VAULT-ORDER')}`}
                          className="btn-youpi-deeplink"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>bolt</span>
                          <span>Tap to Open UPI App on Mobile</span>
                        </a>
                      </div>
                    </div>

                    {/* 12-Digit Bank UTR Input */}
                    <div className="checkout-field-group" style={{ marginTop: 14 }}>
                      <div className="checkout-field-label-row">
                        <label htmlFor="chk-utr">12-Digit Bank UTR / Reference ID</label>
                      </div>
                      <input
                        id="chk-utr"
                        type="text"
                        maxLength={12}
                        placeholder="e.g. 430198234812 (from UPI app transaction receipt)"
                        value={upiUtrNumber}
                        onChange={(e) => setUpiUtrNumber(e.target.value.replace(/\D/g, ''))}
                      />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--on-surface-variant)' }}>
                        YouPI-PG matches this 12-digit bank reference with incoming account credits to verify payment instantly with 0% gateway cut.
                      </span>
                    </div>
                  </div>
                )}

                {/* COD DETAIL PANEL */}
                {paymentRail === 'cod' && (
                  <div className="cod-info-panel">
                    <div className="youpi-status-strip" style={{ marginBottom: 12 }}>
                      <div className="youpi-badge-tag">
                        <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#d97706' }}>local_shipping</span>
                        <span>CASH ON DELIVERY ({codPercent}% RESERVATION TOKEN)</span>
                      </div>
                      <span className="youpi-zero-fee-pill" style={{ color: '#d97706', background: '#fef3c7', borderColor: '#d97706' }}>
                        {codPercent}% ADVANCE TOKEN REQUIRED
                      </span>
                    </div>

                    {/* Transparent COD Breakdown Box */}
                    <div className="cod-breakdown-box">
                      <div className="cod-breakdown-row">
                        <span>Total Order Valuation:</span>
                        <span>₹{finalTotal.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="cod-breakdown-row highlight-token">
                        <span>✦ {codPercent}% Advance Token (Pay Now to Reserve):</span>
                        <span style={{ color: 'var(--primary)', fontWeight: 800 }}>₹{codTokenAmount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="cod-breakdown-row">
                        <span>Balance Due on Doorstep (Cash or UPI):</span>
                        <span style={{ color: '#16a34a', fontWeight: 800 }}>₹{codBalanceAmount.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', margin: '10px 0 12px 0', lineHeight: 1.5 }}>
                      To protect authentic 1-of-1 vintage relics from courier delays and false bookings, a {codPercent}% reservation token is collected upfront. The remaining {100 - codPercent}% is collected at your doorstep during unboxing and fit-check.
                    </div>

                    {/* Token Payment via Dynamic QR */}
                    <div className="upi-qr-preview youpi-qr-box">
                      <div className="qr-img-wrapper">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`upi://pay?pa=${youpiVpa}&pn=SATURN%20THRIFTTT&am=${codTokenAmount}&cu=INR&tn=COD-${codPercent}PCT-TOKEN`)}&bgcolor=fff8f3&color=1a1715`}
                          alt="Token QR Code"
                          className="youpi-live-qr-img"
                        />
                      </div>
                      <div className="qr-meta" style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 800, color: 'var(--on-surface)' }}>
                          Scan to Pay {codPercent}% Token: ₹{codTokenAmount.toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                          Balance ₹{codBalanceAmount.toLocaleString('en-IN')} payable at delivery.
                        </div>
                        <a
                          href={`upi://pay?pa=${encodeURIComponent(youpiVpa)}&pn=${encodeURIComponent('SATURN THRIFTTT')}&am=${codTokenAmount}&cu=INR&tn=COD-${codPercent}PCT-TOKEN`}
                          className="btn-youpi-deeplink"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>bolt</span>
                          <span>Pay ₹{codTokenAmount.toLocaleString('en-IN')} Token via UPI</span>
                        </a>
                      </div>
                    </div>

                    {/* UTR Input for Token */}
                    <div className="checkout-field-group" style={{ marginTop: 14 }}>
                      <div className="checkout-field-label-row">
                        <label htmlFor="chk-cod-utr">12-Digit Token Bank UTR / Reference ID</label>
                      </div>
                      <input
                        id="chk-cod-utr"
                        type="text"
                        maxLength={12}
                        placeholder="e.g. 430198234812 (from token payment receipt)"
                        value={codTokenUtr}
                        onChange={(e) => setCodTokenUtr(e.target.value.replace(/\D/g, ''))}
                      />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--on-surface-variant)' }}>
                        Enter the 12-digit UTR from your ₹{codTokenAmount.toLocaleString('en-IN')} token payment to confirm your delivery booking.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="checkout-action-row">
                <button
                  type="button"
                  className="btn-checkout-back"
                  onClick={() => setStep(1)}
                  disabled={isProcessing}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
                  <span>Edit Address</span>
                </button>

                <button
                  type="button"
                  className="btn-pay-submit"
                  onClick={handlePayNow}
                  disabled={isProcessing}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {isProcessing ? 'hourglass_top' : 'lock'}
                  </span>
                  <span>
                    {isProcessing
                      ? 'Authenticating & Locking...'
                      : paymentRail === 'cod'
                      ? `Confirm COD (Pay ₹${codTokenAmount.toLocaleString('en-IN')} Token)`
                      : `Pay Total ₹${finalTotal.toLocaleString('en-IN')}`}
                  </span>
                </button>
              </div>
            </div>

            {/* Sidebar Summary */}
            <div className="checkout-manifest-col">
              <div className="manifest-header">
                <span>DESTINATION &amp; MANIFEST</span>
              </div>
              <div className="manifest-summary-card">
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700 }}>
                  {shippingData.fullName}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                  {shippingData.street}, {shippingData.city}, {shippingData.state} - {shippingData.pincode}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--primary)', marginTop: 4 }}>
                  {shippingData.phone}
                </div>
              </div>

              <div className="manifest-totals-box" style={{ marginTop: 16 }}>
                <div className="manifest-row">
                  <span>Selected Rail:</span>
                  <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                    {paymentRail === 'upi' ? 'Instant UPI (0% Fee)' : `COD (${codPercent}% Token)`}
                  </span>
                </div>
                {paymentRail === 'cod' && (
                  <>
                    <div className="manifest-row" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                      <span>{codPercent}% Token Now:</span>
                      <span>₹{codTokenAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="manifest-row" style={{ color: '#16a34a', fontWeight: 700 }}>
                      <span>Balance on Delivery:</span>
                      <span>₹{codBalanceAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </>
                )}
                <div className="manifest-total-highlight">
                  <span>TOTAL ORDER:</span>
                  <span>₹{finalTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: ORDER CONFIRMATION & RECEIPT */}
        {step === 3 && completedOrder && (
          <div className="checkout-confirmation-panel">
            <div className="confirmation-badge-circle">
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#16a34a' }}>
                verified
              </span>
            </div>

            <h2 className="confirmation-heading">VAULT ACQUISITION CONFIRMED</h2>
            <div className="confirmation-order-id">
              [ MANIFEST #{completedOrder.id} // 1-OF-1 ARCHIVES LOCKED ]
            </div>

            <p className="confirmation-desc">
              Your vintage pieces have been secured and transferred to our sterilization and kraft packaging station. A dispatch tracking link has been sent to <strong>{completedOrder.shipping.phone}</strong>.
            </p>

            {/* Delivery Timeline Tracker */}
            <div className="vault-tracking-timeline">
              <div className="timeline-step completed">
                <div className="dot" />
                <span className="label">1. Vault Locked</span>
              </div>
              <div className="timeline-step active">
                <div className="dot" />
                <span className="label">2. Kraft Packaging</span>
              </div>
              <div className="timeline-step">
                <div className="dot" />
                <span className="label">3. Express Freight</span>
              </div>
              <div className="timeline-step">
                <div className="dot" />
                <span className="label">4. Doorstep Drop</span>
              </div>
            </div>

            {/* Receipt Table */}
            <div className="confirmation-items-table">
              <div className="table-header">
                <span>Relic Title &amp; Lot</span>
                <span>Amount</span>
              </div>
              {completedOrder.items.map((it) => (
                <div key={it.id} className="table-row">
                  <span>{it.title} ({it.lot})</span>
                  <span>₹{it.price.toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div className="table-footer-row">
                <span>Total Order Value:</span>
                <span>₹{completedOrder.total.toLocaleString('en-IN')}</span>
              </div>

              {completedOrder.codTokenAmount ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--primary)', borderTop: '1px dashed var(--outline-variant)' }}>
                    <span>{codPercent}% Advance Token Paid (UPI):</span>
                    <span>₹{completedOrder.codTokenAmount.toLocaleString('en-IN')} [UTR #{completedOrder.utrNumber}]</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 800, color: '#16a34a' }}>
                    <span>Remaining Balance on Doorstep:</span>
                    <span>₹{completedOrder.codBalanceAmount.toLocaleString('en-IN')} (Cash/UPI upon delivery)</span>
                  </div>
                </>
              ) : (
                completedOrder.utrNumber && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#16a34a', borderTop: '1px dashed var(--outline-variant)' }}>
                    <span>Bank UTR Reconciliation:</span>
                    <span>[ UTR #{completedOrder.utrNumber} · FULL PAYMENT SETTLED (0% FEE) ]</span>
                  </div>
                )
              )}
            </div>

            <div className="confirmation-actions">
              <button
                type="button"
                className="btn-print-receipt"
                onClick={() => window.print()}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>print</span>
                <span>Print Vault Receipt</span>
              </button>
              <button
                type="button"
                className="btn-continue-shopping"
                onClick={onClose}
              >
                <span>Continue Exploring Archives</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
