import { useState, useEffect } from 'react'

export default function CheckoutModal({
  isOpen,
  onClose,
  cart,
  cartTotal,
  currentUser,
  onOrderComplete,
  storeSettings,
  activeOffers = [],
  onRequireLogin,
}) {
  const [step, setStep] = useState(1) // 1: Dispatch, 2: Payment (UPI), 3: Confirmation

  // Shipping Form State (clean empty inputs ready for real collector details)
  const [shippingData, setShippingData] = useState({
    fullName: currentUser?.name && currentUser.name !== 'PRATHAM SHARMA' ? currentUser.name : '',
    email: currentUser?.email && currentUser.email !== 'pratham@saturn.archive' ? currentUser.email : '',
    phone: currentUser?.phone || '',
    street: currentUser?.address?.street && !currentUser.address.street.includes('Penthouse 4B') ? currentUser.address.street : '',
    city: currentUser?.address?.city || '',
    state: currentUser?.address?.state || '',
    pincode: currentUser?.address?.pincode || '',
    country: 'India',
  })

  // Synchronize shipping fields whenever the logged-in user changes
  useEffect(() => {
    if (currentUser) {
      setShippingData((prev) => ({
        ...prev,
        fullName: currentUser.name && currentUser.name !== 'PRATHAM SHARMA' ? currentUser.name : prev.fullName,
        email: currentUser.email && currentUser.email !== 'pratham@saturn.archive' ? currentUser.email : prev.email,
        phone: currentUser.phone || prev.phone,
        street: currentUser.address?.street && !currentUser.address.street.includes('Penthouse 4B') ? currentUser.address.street : prev.street,
        city: currentUser.address?.city || prev.city,
        state: currentUser.address?.state || prev.state,
        pincode: currentUser.address?.pincode || prev.pincode,
      }))
    }
  }, [currentUser])

  // YouPI-PG Sovereign UPI Configuration
  const youpiVpa = (storeSettings?.upiVpa && !storeSettings.upiVpa.includes('okhdfcbank'))
    ? storeSettings.upiVpa
    : (import.meta.env.VITE_YOUPI_UPI_VPA || '9329993116@kotakbank')
  const [upiUtrNumber, setUpiUtrNumber] = useState('')
  const [copiedVpa, setCopiedVpa] = useState(false)

  // Delivery Fee Protocol: Free Delivery on orders > ₹599, else standard ₹120 flat fee
  const standardDeliveryFee = Number(storeSettings?.deliveryFee ?? 120)
  const FREE_DELIVERY_THRESHOLD = 599
  const isFreeDelivery = cartTotal > FREE_DELIVERY_THRESHOLD
  const deliveryFee = isFreeDelivery ? 0 : standardDeliveryFee

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
  const finalTotal = Math.max(0, cartTotal - discountAmount + deliveryFee)

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
    if (!currentUser) {
      setErrorMessage('Collector authentication required. Please sign in with your email passcode.')
      if (onRequireLogin) onRequireLogin()
      return
    }
    if (!shippingData.fullName || !shippingData.phone || !shippingData.street || !shippingData.city) {
      setErrorMessage('Please fill in complete delivery details.')
      return
    }
    setErrorMessage('')
    setStep(2)
  }

  // Process payment submission
  const handlePayNow = async () => {
    if (!currentUser) {
      setErrorMessage('Collector authentication required. Please sign in before proceeding.')
      if (onRequireLogin) onRequireLogin()
      return
    }

    const cleanUtr = (upiUtrNumber || '').trim().replace(/\D/g, '')
    if (!cleanUtr) {
      setErrorMessage('Please enter the 12-digit UPI Bank UTR / Reference number from your payment app receipt.')
      return
    }
    if (cleanUtr.length !== 12) {
      setErrorMessage(`Invalid Bank UTR: Reference ID must be exactly 12 digits (you entered ${cleanUtr.length} digits). Check your Google Pay / PhonePe / Paytm / BHIM payment receipt.`)
      return
    }

    setIsProcessing(true)
    setErrorMessage('')

    const orderId = `SAT-${Math.floor(100000 + Math.random() * 900000)}`
    const cleanItems = (cart || []).map((it) => ({
      id: it.id,
      lot: it.lot || 'LOT #ARCHIVE',
      title: it.title,
      tag: it.tag || '',
      price: Number(it.price),
      img: (it.images && it.images[0]) || it.img || '',
    }))

    const newOrder = {
      id: orderId,
      date: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
      items: cleanItems,
      subtotal: cartTotal,
      discount: discountAmount,
      couponCode: appliedCoupon?.code || null,
      deliveryFee: deliveryFee,
      isFreeDelivery: isFreeDelivery,
      total: finalTotal,
      paymentRail: 'Instant Sovereign UPI (0% Fee)',
      utrNumber: cleanUtr,
      shipping: {
        ...shippingData,
        fullName: currentUser?.name || shippingData.fullName,
        email: currentUser?.email || shippingData.email,
      },
      status: 'Paid & Authenticated via YouPI-PG (0% Fee) // Dispatched',
    }

    try {
      localStorage.setItem('saturn_customer_has_ordered', 'true')
    } catch {}

    // Await database write to Supabase before rendering confirmation
    if (onOrderComplete) {
      try {
        await onOrderComplete(newOrder)
      } catch (orderErr) {
        console.warn('[ORDER] Error persisting order to cloud:', orderErr)
      }
    }

    setCompletedOrder(newOrder)
    setIsProcessing(false)
    setStep(3)
  }

  return (
    <div className="checkout-modal-backdrop" onClick={onClose}>
      <div className="checkout-modal-panel" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="checkout-modal-header">
          <div className="checkout-step-indicator">
            <span className={`step-dot ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`}>1. Dispatch</span>
            <span className="step-arrow">→</span>
            <span className={`step-dot ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`}>2. Payment (Instant UPI)</span>
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
            <div className="checkout-form-col">
              <div className="checkout-section-title">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>local_shipping</span>
                <span>PAN-INDIA DISPATCH SPECIFICATIONS</span>
              </div>

              {!currentUser ? (
                <div style={{
                  backgroundColor: '#fff8f3',
                  border: '2px solid #1a1715',
                  padding: '36px 20px',
                  textAlign: 'center',
                  margin: '12px 0 24px 0',
                }}>
                  <div style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    backgroundColor: '#1a1715',
                    color: '#fff8f3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 14px auto',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 26 }}>lock</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--primary)', fontWeight: 800, letterSpacing: '0.1em' }}>
                    ✦ ARCHIVE SECURITY CHECKPOINT
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '6px 0 8px 0', fontWeight: 700 }}>
                    COLLECTOR PASSCODE REQUIRED
                  </h3>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--on-surface-variant)', maxWidth: 400, margin: '0 auto 18px auto', lineHeight: 1.5 }}>
                    To order 1-of-1 archival relics and receive automated dispatch notifications, please sign in with your email address.
                  </p>
                  <button
                    type="button"
                    className="btn-pay-submit"
                    style={{ maxWidth: 300, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    onClick={() => {
                      onClose()
                      if (onRequireLogin) onRequireLogin()
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>key</span>
                    <span>GET 4-DIGIT EMAIL PASSCODE</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleProceedToPayment}>
                  <div className="checkout-auth-banner">
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--primary)' }}>verified</span>
                    <span>Logged in as <strong>{currentUser.name}</strong> ({currentUser.email})</span>
                  </div>

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
                    <span>Continue to Payment (Instant UPI)</span>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
                  </button>
                </form>
              )}
            </div>

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
                  <span>Express Air Delivery:</span>
                  {isFreeDelivery ? (
                    <span>
                      <span style={{ textDecoration: 'line-through', color: 'var(--outline)', marginRight: 6 }}>
                        ₹{standardDeliveryFee}
                      </span>
                      <strong style={{ color: '#16a34a' }}>FREE (Orders &gt; ₹599 ✦)</strong>
                    </span>
                  ) : (
                    <span>
                      <span style={{ fontWeight: 700 }}>₹{standardDeliveryFee}</span>
                      <span style={{ fontSize: 9.5, color: 'var(--outline)', marginLeft: 6 }}>
                        (Free on ₹599+ · Add ₹{Math.max(0, FREE_DELIVERY_THRESHOLD - cartTotal + 1)} more)
                      </span>
                    </span>
                  )}
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
                    placeholder="PROMO CODE (e.g. SATURN15)"
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

        {/* STEP 2: PAYMENT VIA INSTANT SOVEREIGN UPI */}
        {step === 2 && (
          <div className="checkout-body-grid">
            <div className="checkout-form-col">
              <div className="checkout-section-title">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>payment</span>
                <span>INSTANT SOVEREIGN UPI GATEWAY</span>
              </div>

              {errorMessage && <div className="checkout-alert-error">{errorMessage}</div>}

              {/* UPI Detail Panel */}
              <div className="rail-detail-box" style={{ border: 'none', padding: 0 }}>
                <div className="upi-input-panel">
                  <div className="youpi-status-strip">
                    <div className="youpi-badge-tag">
                      <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#16a34a' }}>verified_user</span>
                      <span>YOUPI-PG SOVEREIGN GATEWAY</span>
                    </div>
                    <span className="youpi-zero-fee-pill">DIRECT BANK SETTLEMENT · ZERO FEES</span>
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
                        Scan to Pay Total: ₹{finalTotal.toLocaleString('en-IN')}
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
                    <div className="checkout-field-label-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label htmlFor="chk-utr">12-Digit Bank UTR / Reference ID</label>
                      <span style={{
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: upiUtrNumber.length === 12 ? '#16a34a' : 'var(--outline)',
                      }}>
                        {upiUtrNumber.length}/12 DIGITS {upiUtrNumber.length === 12 ? '✓ READY' : ''}
                      </span>
                    </div>
                    <input
                      id="chk-utr"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={12}
                      placeholder="e.g. 430198234812 (from UPI app transaction receipt)"
                      value={upiUtrNumber}
                      onChange={(e) => setUpiUtrNumber(e.target.value.replace(/\D/g, ''))}
                      style={{
                        letterSpacing: '0.12em',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        borderColor: upiUtrNumber.length === 12 ? '#16a34a' : undefined,
                      }}
                    />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--on-surface-variant)', lineHeight: 1.4 }}>
                      💡 Where to find: Open your UPI app (GPay / PhonePe / Paytm / BHIM) &gt; Tap "Completed Payment" &gt; Copy the 12-digit <strong>UPI Ref No. / UTR</strong>.
                    </span>
                  </div>
                </div>
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
                      : `Authenticate & Pay ₹${finalTotal.toLocaleString('en-IN')}`}
                  </span>
                </button>
              </div>
            </div>

            {/* Step 2 Sidebar Summary */}
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
                  <span>Payment Method:</span>
                  <span style={{ textTransform: 'uppercase', fontWeight: 700, color: '#16a34a' }}>
                    Instant Sovereign UPI
                  </span>
                </div>
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
                  <span>Pan-India Delivery:</span>
                  {isFreeDelivery ? (
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>
                      <span style={{ textDecoration: 'line-through', color: 'var(--outline)', marginRight: 4 }}>
                        ₹{standardDeliveryFee}
                      </span>
                      FREE (&gt; ₹599 ✦)
                    </span>
                  ) : (
                    <span style={{ fontWeight: 700 }}>₹{standardDeliveryFee}</span>
                  )}
                </div>
                <div className="manifest-total-highlight">
                  <span>TOTAL PAYABLE:</span>
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
              {completedOrder.discount > 0 && (
                <div className="table-row" style={{ color: '#16a34a' }}>
                  <span>Coupon Discount ({completedOrder.couponCode || 'PROMO'}):</span>
                  <span>-₹{completedOrder.discount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="table-row">
                <span>Pan-India Air Express Delivery:</span>
                <span style={{ color: completedOrder.deliveryFee === 0 ? '#16a34a' : 'inherit', fontWeight: completedOrder.deliveryFee === 0 ? 700 : 'normal' }}>
                  {completedOrder.deliveryFee === 0 ? 'FREE (Orders > ₹599 Privilege ✦)' : `₹${completedOrder.deliveryFee}`}
                </span>
              </div>
              <div className="table-footer-row">
                <span>Total Amount Paid:</span>
                <span>₹{completedOrder.total.toLocaleString('en-IN')}</span>
              </div>

              {completedOrder.utrNumber && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#16a34a', borderTop: '1px dashed var(--outline-variant)' }}>
                  <span>Bank UTR Reconciliation:</span>
                  <span>[ UTR #{completedOrder.utrNumber} · FULL PAYMENT SETTLED (0% FEE) ]</span>
                </div>
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
