import { useState } from 'react'
import { deleteRemoteRelic } from '../lib/supabase'

export default function AdminDashboardModal({
  isOpen,
  onClose,
  relics,
  onUpdateRelics,
  announcementBanner,
  onUpdateBanner,
  activeOffers,
  onUpdateOffers,
  storeSettings,
  onUpdateSettings,
  allOrders,
  onUpdateOrders,
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('saturn_admin_auth') === 'true'
  })
  const [passcode, setPasscode] = useState('')
  const [passcodeError, setPasscodeError] = useState('')

  // Active Navigation Tab: 'inventory' | 'ads' | 'offers' | 'orders' | 'settings'
  const [activeTab, setActiveTab] = useState('inventory')

  // Search & Filter state for relics
  const [relicSearch, setRelicSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Form State: Add New Relic
  const [newRelic, setNewRelic] = useState({
    title: '',
    lot: `LOT #09${Math.floor(50 + Math.random() * 50)}`,
    category: 'tees',
    badge: '✦ 1-OF-1 ONLY',
    price: 4499,
    year: `YEAR: ${new Date().getFullYear() - 30} // ARCHIVE SPEC`,
    tag: 'TAG: BROCKUM USA · SZ L',
    measurements: 'P2P: 22.5" // LEN: 28.5"',
    desc: 'Authentic 90s vintage garment. Hand-inspected, sun-faded organic patina, single stitch intact.',
    img: '',
    isSold: false,
  })
  const [imagePreview, setImagePreview] = useState('')
  const [formSuccess, setFormSuccess] = useState('')

  // Form State: New Offer
  const [newOffer, setNewOffer] = useState({
    code: '',
    type: 'percent', // 'percent' or 'flat'
    value: 15,
    minSpend: 4000,
    description: '',
    active: true,
  })

  // Settings Temp Form State
  const [localSettings, setLocalSettings] = useState({ ...storeSettings })
  const [localBanner, setLocalBanner] = useState({ ...announcementBanner })

  if (!isOpen) return null

  // Passcode verification (Configured passcode or saturn9410)
  const configuredPasscode = storeSettings?.adminPasscode || '9410'
  const handleVerifyPasscode = (e) => {
    e.preventDefault()
    if (passcode === configuredPasscode || passcode === 'saturn9410') {
      setIsAuthenticated(true)
      sessionStorage.setItem('saturn_admin_auth', 'true')
      setPasscodeError('')
    } else {
      setPasscodeError('Invalid Curator Passcode. Enter the authorized master passcode.')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem('saturn_admin_auth')
  }

  // Handle local photo file upload & convert to DataURL
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result
        setImagePreview(dataUrl)
        setNewRelic((prev) => ({ ...prev, img: dataUrl }))
      }
      reader.readAsDataURL(file)
    }
  }

  // Publish New Drop to Live Store
  const handlePublishRelic = (e) => {
    e.preventDefault()
    if (!newRelic.title || !newRelic.price) {
      alert('Please provide at least a title and price.')
      return
    }

    const fallbackImg = imagePreview || newRelic.img || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBpMwMxh5Dfy-4OXiZB9iIedGEl9ZyTLWyayX6rhafm2EvBgYqGNmVvDcNqnRwoHWfLY2Yn5sfvNNoCG5JVgamSUfXtvPtoL1vXdOBFbJmfsktcjarJTA2aAcd19WCO4h08SyFQZAbFqQ5pTgAAOHVHD9-0vFr3SdHzveYB2ElCzQtFVvHmjqWbZZNQyaB4cIxXyQcxu_-oJYsZe9waOqqnBn1blc2eSnJIjMoLjQA'

    const createdRelic = {
      id: `relic-${Date.now()}`,
      ...newRelic,
      img: fallbackImg,
      price: Number(newRelic.price),
      barcode: `BARCODE: |||| |||| ${Math.floor(100 + Math.random() * 900)}`,
    }

    const updated = [createdRelic, ...relics]
    onUpdateRelics(updated)

    setFormSuccess(`✦ Success! "${newRelic.title}" published to live store catalog.`)
    setTimeout(() => setFormSuccess(''), 4000)

    // Reset Form with next Lot
    setNewRelic({
      title: '',
      lot: `LOT #09${Math.floor(50 + Math.random() * 50)}`,
      category: 'tees',
      badge: '✦ 1-OF-1 ONLY',
      price: 4499,
      year: `YEAR: ${new Date().getFullYear() - 30} // ARCHIVE SPEC`,
      tag: 'TAG: BROCKUM USA · SZ L',
      measurements: 'P2P: 22.5" // LEN: 28.5"',
      desc: 'Authentic 90s vintage garment. Hand-inspected, sun-faded organic patina, single stitch intact.',
      img: '',
      isSold: false,
    })
    setImagePreview('')
  }

  // Toggle Relic Sold Status
  const handleToggleSold = (id) => {
    const updated = relics.map((r) => (r.id === id ? { ...r, isSold: !r.isSold } : r))
    onUpdateRelics(updated)
  }

  // Delete Relic
  const handleDeleteRelic = (id, title) => {
    if (window.confirm(`Delete "${title}" from the live vault catalog?`)) {
      const updated = relics.filter((r) => r.id !== id)
      onUpdateRelics(updated)
      deleteRemoteRelic(id)
    }
  }

  // Save Banner Changes
  const handleSaveBanner = (e) => {
    e.preventDefault()
    onUpdateBanner(localBanner)
    alert('Announcement banner & advertisement settings updated live!')
  }

  // Add Coupon Offer
  const handleAddOffer = (e) => {
    e.preventDefault()
    if (!newOffer.code) return
    const codeClean = newOffer.code.trim().toUpperCase().replace(/\s+/g, '')
    const createdOffer = {
      ...newOffer,
      code: codeClean,
      value: Number(newOffer.value),
      minSpend: Number(newOffer.minSpend || 0),
    }
    const updated = [...activeOffers, createdOffer]
    onUpdateOffers(updated)
    setNewOffer({ code: '', type: 'percent', value: 15, minSpend: 4000, description: '', active: true })
  }

  // Toggle Offer Active
  const handleToggleOffer = (code) => {
    const updated = activeOffers.map((o) => (o.code === code ? { ...o, active: !o.active } : o))
    onUpdateOffers(updated)
  }

  // Delete Offer
  const handleDeleteOffer = (code) => {
    const updated = activeOffers.filter((o) => o.code !== code)
    onUpdateOffers(updated)
  }

  // Save Settings
  const handleSaveSettings = (e) => {
    e.preventDefault()
    onUpdateSettings(localSettings)
    alert('Store payment protocols and location settings updated live!')
  }

  // Update Order Status
  const handleUpdateOrderStatus = (orderId, newStatus) => {
    const updated = allOrders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    onUpdateOrders(updated)
  }

  // Filtered relics
  const displayedRelics = relics.filter((r) => {
    const matchesCat = categoryFilter === 'all' || r.category === categoryFilter
    const matchesSearch =
      r.title.toLowerCase().includes(relicSearch.toLowerCase()) ||
      r.lot.toLowerCase().includes(relicSearch.toLowerCase())
    return matchesCat && matchesSearch
  })

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal-panel" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="admin-modal-header">
          <div className="admin-title-wrap">
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: 22 }}>
              shield_person
            </span>
            <div>
              <div className="admin-title">SATURN.THRIFTTT // CURATOR COMMAND CENTER</div>
              <div className="admin-subtitle">Master Store Control, Drop Publishing & Advertising Terminal</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isAuthenticated && (
              <button type="button" className="btn-admin-logout" onClick={handleLogout} title="Lock Terminal">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
                <span>Lock</span>
              </button>
            )}
            <button type="button" className="checkout-close-btn" onClick={onClose} aria-label="Close">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* PASSCODE GATEWAY IF NOT AUTHENTICATED */}
        {!isAuthenticated ? (
          <div className="admin-auth-gate">
            <div className="admin-auth-box">
              <span className="material-symbols-outlined" style={{ fontSize: 44, color: 'var(--primary)' }}>
                lock
              </span>
              <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 800 }}>
                Restricted Curator Protocol
              </h3>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)', maxWidth: 360, margin: '8px 0 16px 0', lineHeight: 1.5 }}>
                Enter the master curator passcode to manage inventory drops, active promotions, and UPI settlement configs.
              </p>

              <form onSubmit={handleVerifyPasscode} style={{ width: '100%', maxWidth: 300 }}>
                <input
                  type="password"
                  placeholder="Enter Curator Passcode (9410)"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="admin-passcode-input"
                  autoFocus
                />
                {passcodeError && <div className="admin-alert-error">{passcodeError}</div>}

                <button type="submit" className="btn-admin-unlock">
                  <span>Authorize Curator Session</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>key</span>
                </button>
              </form>

              <div style={{ marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--outline)' }}>
                DEFAULT PASSCODE: <strong>9410</strong>
              </div>
            </div>
          </div>
        ) : (
          /* ============================================================
             AUTHENTICATED CURATOR DASHBOARD
             ============================================================ */
          <div className="admin-dashboard-container">
            {/* Tabs Bar */}
            <div className="admin-tabs-nav">
              <button
                type="button"
                className={`admin-tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
                onClick={() => setActiveTab('inventory')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>inventory_2</span>
                <span>Drops &amp; Inventory ({relics.length})</span>
              </button>

              <button
                type="button"
                className={`admin-tab-btn ${activeTab === 'ads' ? 'active' : ''}`}
                onClick={() => setActiveTab('ads')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>campaign</span>
                <span>Advertisements &amp; Banners</span>
              </button>

              <button
                type="button"
                className={`admin-tab-btn ${activeTab === 'offers' ? 'active' : ''}`}
                onClick={() => setActiveTab('offers')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>local_offer</span>
                <span>Coupons &amp; Offers ({activeOffers.length})</span>
              </button>

              <button
                type="button"
                className={`admin-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
                onClick={() => setActiveTab('orders')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>receipt_long</span>
                <span>Customer Orders ({allOrders.length})</span>
              </button>

              <button
                type="button"
                className={`admin-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>settings</span>
                <span>Store &amp; Payments</span>
              </button>
            </div>

            {/* TAB 1: INVENTORY & UPLOAD NEW RELIC */}
            {activeTab === 'inventory' && (
              <div className="admin-tab-pane">
                <div className="admin-two-col-layout">
                  {/* Left Column: Upload New Drop Form */}
                  <div className="admin-card-panel">
                    <div className="admin-card-heading">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_circle</span>
                      <span>UPLOAD NEW 1-OF-1 VINTAGE DROP</span>
                    </div>

                    {formSuccess && <div className="admin-alert-success">{formSuccess}</div>}

                    <form onSubmit={handlePublishRelic} className="admin-form-grid">
                      {/* Photo Upload Area with Live Preview */}
                      <div className="admin-form-field full-width">
                        <label>Relic Product Photograph</label>
                        <div className="admin-photo-dropzone">
                          {imagePreview || newRelic.img ? (
                            <div className="admin-preview-box">
                              <img src={imagePreview || newRelic.img} alt="Preview" className="admin-preview-img" />
                              <button
                                type="button"
                                className="btn-remove-preview"
                                onClick={() => {
                                  setImagePreview('')
                                  setNewRelic((p) => ({ ...p, img: '' }))
                                }}
                              >
                                ✕ Change Photo
                              </button>
                            </div>
                          ) : (
                            <label className="dropzone-label">
                              <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--primary)' }}>
                                cloud_upload
                              </span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
                                Drag &amp; Drop or Click to Select Photo
                              </span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)' }}>
                                JPG, PNG, WEBP from your phone or device
                              </span>
                              <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                            </label>
                          )}
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <input
                            type="text"
                            placeholder="...or paste external image URL (https://...)"
                            value={newRelic.img}
                            onChange={(e) => {
                              setNewRelic({ ...newRelic, img: e.target.value })
                              setImagePreview(e.target.value)
                            }}
                            className="admin-input-compact"
                          />
                        </div>
                      </div>

                      <div className="admin-form-field">
                        <label>Piece Title</label>
                        <input
                          type="text"
                          placeholder="e.g. 1993 Nirvana In Utero Tour Tee"
                          value={newRelic.title}
                          onChange={(e) => setNewRelic({ ...newRelic, title: e.target.value })}
                          required
                        />
                      </div>

                      <div className="admin-form-field">
                        <label>Lot Identifier</label>
                        <input
                          type="text"
                          value={newRelic.lot}
                          onChange={(e) => setNewRelic({ ...newRelic, lot: e.target.value })}
                          required
                        />
                      </div>

                      <div className="admin-form-field">
                        <label>Archival Category</label>
                        <select
                          value={newRelic.category}
                          onChange={(e) => setNewRelic({ ...newRelic, category: e.target.value })}
                        >
                          <option value="tees">Graphic Band Tees (1974–1996)</option>
                          <option value="jackets">Work Jackets (1982–1999)</option>
                          <option value="denim">Archival Denim (1978–1995)</option>
                          <option value="knits">Knitwear &amp; Vests (1990–1999)</option>
                          <option value="hoodies">Heavy Hoodies (1989–1998)</option>
                        </select>
                      </div>

                      <div className="admin-form-field">
                        <label>Price in INR (₹)</label>
                        <input
                          type="number"
                          placeholder="e.g. 4999"
                          value={newRelic.price}
                          onChange={(e) => setNewRelic({ ...newRelic, price: e.target.value })}
                          required
                        />
                      </div>

                      <div className="admin-form-field">
                        <label>Curator Badge</label>
                        <select
                          value={newRelic.badge}
                          onChange={(e) => setNewRelic({ ...newRelic, badge: e.target.value })}
                        >
                          <option value="✦ 1-OF-1 ONLY">✦ 1-OF-1 ONLY</option>
                          <option value="✦ GRAIL SPEC">✦ GRAIL SPEC</option>
                          <option value="✦ DEADSTOCK GEM">✦ DEADSTOCK GEM</option>
                          <option value="✦ ARCHIVAL WORKWEAR">✦ ARCHIVAL WORKWEAR</option>
                        </select>
                      </div>

                      <div className="admin-form-field">
                        <label>Year &amp; Specification</label>
                        <input
                          type="text"
                          placeholder="YEAR: 1994 // TOUR SPEC"
                          value={newRelic.year}
                          onChange={(e) => setNewRelic({ ...newRelic, year: e.target.value })}
                        />
                      </div>

                      <div className="admin-form-field">
                        <label>Tag &amp; Size</label>
                        <input
                          type="text"
                          placeholder="TAG: BROCKUM USA · SZ L"
                          value={newRelic.tag}
                          onChange={(e) => setNewRelic({ ...newRelic, tag: e.target.value })}
                        />
                      </div>

                      <div className="admin-form-field">
                        <label>Measurements (P2P / Length / Waist)</label>
                        <input
                          type="text"
                          placeholder='P2P: 22.5" // LEN: 29"'
                          value={newRelic.measurements}
                          onChange={(e) => setNewRelic({ ...newRelic, measurements: e.target.value })}
                        />
                      </div>

                      <div className="admin-form-field full-width">
                        <label>Curator Condition Notes</label>
                        <textarea
                          rows={2}
                          placeholder="Condition rating, wash fade, distressing, stitching details..."
                          value={newRelic.desc}
                          onChange={(e) => setNewRelic({ ...newRelic, desc: e.target.value })}
                        />
                      </div>

                      <button type="submit" className="btn-admin-publish full-width">
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload</span>
                        <span>PUBLISH NEW RELIC TO LIVE VAULT</span>
                      </button>
                    </form>
                  </div>

                  {/* Right Column: Live Inventory Table */}
                  <div className="admin-card-panel">
                    <div className="admin-card-heading-split">
                      <div className="admin-card-heading">
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>list_alt</span>
                        <span>LIVE VAULT INVENTORY ({displayedRelics.length})</span>
                      </div>

                      {/* Filter Bar */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          placeholder="Search title/lot..."
                          value={relicSearch}
                          onChange={(e) => setRelicSearch(e.target.value)}
                          className="admin-search-input"
                        />
                        <select
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                          className="admin-select-filter"
                        >
                          <option value="all">All Categories</option>
                          <option value="tees">Tees</option>
                          <option value="jackets">Jackets</option>
                          <option value="denim">Denim</option>
                          <option value="knits">Knits</option>
                          <option value="hoodies">Hoodies</option>
                        </select>
                      </div>
                    </div>

                    <div className="admin-inventory-scroll">
                      {displayedRelics.map((r) => (
                        <div key={r.id} className={`admin-relic-row ${r.isSold ? 'sold-out' : ''}`}>
                          <img src={r.img} alt={r.title} className="admin-relic-thumb" />
                          <div className="admin-relic-details">
                            <div className="admin-relic-lot-row">
                              <span className="admin-relic-lot">{r.lot}</span>
                              <span className="admin-relic-cat">{r.category?.toUpperCase()}</span>
                              {r.isSold && <span className="admin-sold-badge">SOLD OUT</span>}
                            </div>
                            <div className="admin-relic-title">{r.title}</div>
                            <div className="admin-relic-price">₹{Number(r.price).toLocaleString('en-IN')}</div>
                          </div>

                          <div className="admin-relic-actions">
                            <button
                              type="button"
                              className={`btn-toggle-sold ${r.isSold ? 'mark-available' : 'mark-sold'}`}
                              onClick={() => handleToggleSold(r.id)}
                            >
                              {r.isSold ? 'Mark Available' : 'Mark Sold'}
                            </button>
                            <button
                              type="button"
                              className="btn-delete-relic"
                              onClick={() => handleDeleteRelic(r.id, r.title)}
                              title="Delete piece"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ADVERTISEMENTS & ANNOUNCEMENT BANNERS */}
            {activeTab === 'ads' && (
              <div className="admin-tab-pane">
                <div className="admin-card-panel" style={{ maxWidth: 800 }}>
                  <div className="admin-card-heading">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>campaign</span>
                    <span>STORE ADVERTISEMENT STRIP &amp; PROMO BANNER</span>
                  </div>

                  <form onSubmit={handleSaveBanner} className="admin-form-grid" style={{ marginTop: 16 }}>
                    <div className="admin-form-field full-width">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="checkbox"
                          id="chk-banner-enable"
                          checked={localBanner.enabled}
                          onChange={(e) => setLocalBanner({ ...localBanner, enabled: e.target.checked })}
                          style={{ width: 18, height: 18 }}
                        />
                        <label htmlFor="chk-banner-enable" style={{ fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                          Display Top Broadcast Announcement Strip on Website
                        </label>
                      </div>
                    </div>

                    <div className="admin-form-field">
                      <label>Broadcast Tag Label</label>
                      <input
                        type="text"
                        value={localBanner.tag}
                        onChange={(e) => setLocalBanner({ ...localBanner, tag: e.target.value })}
                        placeholder="e.g. VAULT BROADCAST / FESTIVE DROP"
                      />
                    </div>

                    <div className="admin-form-field">
                      <label>Call to Action Button Text</label>
                      <input
                        type="text"
                        value={localBanner.ctaText}
                        onChange={(e) => setLocalBanner({ ...localBanner, ctaText: e.target.value })}
                        placeholder="e.g. Explore Drop Now"
                      />
                    </div>

                    <div className="admin-form-field full-width">
                      <label>Advertisement Announcement Text</label>
                      <textarea
                        rows={3}
                        value={localBanner.text}
                        onChange={(e) => setLocalBanner({ ...localBanner, text: e.target.value })}
                        placeholder="e.g. ⚡ DROP #04 IS LIVE · 100% HAND-AUTHENTICATED VINTAGE RELICS · PAN-INDIA EXPRESS DELIVERY"
                      />
                    </div>

                    <div className="admin-form-field full-width">
                      <label>Call to Action Link Target</label>
                      <input
                        type="text"
                        value={localBanner.ctaLink}
                        onChange={(e) => setLocalBanner({ ...localBanner, ctaLink: e.target.value })}
                        placeholder="#vault-drop or https://instagram.com/saturn.thrifttt"
                      />
                    </div>

                    {/* Live Preview Card */}
                    <div className="admin-form-field full-width">
                      <label>Live Preview of Banner</label>
                      <div className="vault-announcement-strip" style={{ margin: '8px 0' }}>
                        <span className="announcement-tag">{localBanner.tag}</span>
                        <span className="announcement-text">{localBanner.text}</span>
                        {localBanner.ctaText && (
                          <span className="announcement-link">{localBanner.ctaText} →</span>
                        )}
                      </div>
                    </div>

                    <button type="submit" className="btn-admin-publish full-width">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
                      <span>SAVE &amp; APPLY ADVERTISEMENT STRIP LIVE</span>
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB 3: OFFERS, COUPON CODES & DISCOUNTS */}
            {activeTab === 'offers' && (
              <div className="admin-tab-pane">
                <div className="admin-two-col-layout">
                  {/* Create New Offer */}
                  <div className="admin-card-panel">
                    <div className="admin-card-heading">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_task</span>
                      <span>CREATE PROMO CODE / COUPON</span>
                    </div>

                    <form onSubmit={handleAddOffer} className="admin-form-grid" style={{ marginTop: 14 }}>
                      <div className="admin-form-field">
                        <label>Promo Code (Uppercase)</label>
                        <input
                          type="text"
                          placeholder="e.g. FESTIVE20"
                          value={newOffer.code}
                          onChange={(e) => setNewOffer({ ...newOffer, code: e.target.value.toUpperCase() })}
                          required
                        />
                      </div>

                      <div className="admin-form-field">
                        <label>Discount Type</label>
                        <select
                          value={newOffer.type}
                          onChange={(e) => setNewOffer({ ...newOffer, type: e.target.value })}
                        >
                          <option value="percent">Percentage Off (%)</option>
                          <option value="flat">Flat Rupee Amount (₹)</option>
                        </select>
                      </div>

                      <div className="admin-form-field">
                        <label>Discount Value ({newOffer.type === 'percent' ? '%' : '₹'})</label>
                        <input
                          type="number"
                          placeholder={newOffer.type === 'percent' ? '15' : '500'}
                          value={newOffer.value}
                          onChange={(e) => setNewOffer({ ...newOffer, value: e.target.value })}
                          required
                        />
                      </div>

                      <div className="admin-form-field">
                        <label>Minimum Order Value (₹)</label>
                        <input
                          type="number"
                          placeholder="e.g. 4000 (0 for no minimum)"
                          value={newOffer.minSpend}
                          onChange={(e) => setNewOffer({ ...newOffer, minSpend: e.target.value })}
                        />
                      </div>

                      <div className="admin-form-field full-width">
                        <label>Offer Headline / Description</label>
                        <input
                          type="text"
                          placeholder="e.g. 15% Off on orders above ₹4,000"
                          value={newOffer.description}
                          onChange={(e) => setNewOffer({ ...newOffer, description: e.target.value })}
                        />
                      </div>

                      <button type="submit" className="btn-admin-publish full-width">
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>sell</span>
                        <span>+ CREATE &amp; ACTIVATE COUPON</span>
                      </button>
                    </form>
                  </div>

                  {/* Active Offers List */}
                  <div className="admin-card-panel">
                    <div className="admin-card-heading">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>loyalty</span>
                      <span>ACTIVE STORE OFFERS &amp; VOUCHERS ({activeOffers.length})</span>
                    </div>

                    <div className="admin-inventory-scroll" style={{ marginTop: 14 }}>
                      {activeOffers.map((o) => (
                        <div key={o.code} className="admin-offer-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="offer-badge-code">
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>confirmation_number</span>
                              <span>{o.code}</span>
                            </div>
                            <span className={`offer-status-chip ${o.active ? 'active' : 'paused'}`}>
                              {o.active ? 'ACTIVE' : 'PAUSED'}
                            </span>
                          </div>

                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, marginTop: 8 }}>
                            {o.type === 'percent' ? `${o.value}% OFF` : `₹${o.value} FLAT DISCOUNT`}
                          </div>

                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                            {o.description || (o.minSpend > 0 ? `Valid on orders above ₹${o.minSpend.toLocaleString('en-IN')}` : 'No minimum cart total')}
                          </div>

                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button
                              type="button"
                              className="btn-toggle-sold"
                              style={{ padding: '4px 10px', fontSize: 10 }}
                              onClick={() => handleToggleOffer(o.code)}
                            >
                              {o.active ? 'Pause Coupon' : 'Activate Coupon'}
                            </button>
                            <button
                              type="button"
                              className="btn-delete-relic"
                              style={{ padding: '4px 8px' }}
                              onClick={() => handleDeleteOffer(o.code)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CUSTOMER ORDERS & RECONCILIATIONS */}
            {activeTab === 'orders' && (
              <div className="admin-tab-pane">
                <div className="admin-card-panel">
                  <div className="admin-card-heading">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>receipt_long</span>
                    <span>INCOMING DISPATCH MANIFESTS &amp; RECONCILIATIONS ({allOrders.length})</span>
                  </div>

                  {allOrders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'var(--font-mono)', color: 'var(--outline)' }}>
                      NO INCOMING ORDERS YET. PLACE AN ORDER ON THE LIVE SITE TO LOG IT HERE.
                    </div>
                  ) : (
                    <div className="admin-orders-table-wrapper">
                      <table className="admin-orders-table">
                        <thead>
                          <tr>
                            <th>Manifest ID</th>
                            <th>Date</th>
                            <th>Customer &amp; Phone</th>
                            <th>Delivery Address</th>
                            <th>Relic Items</th>
                            <th>Settlement Method</th>
                            <th>Status &amp; Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allOrders.map((ord) => (
                            <tr key={ord.id}>
                              <td style={{ fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                                #{ord.id}
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{ord.date}</td>
                              <td>
                                <div style={{ fontWeight: 700 }}>{ord.shipping?.fullName}</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)' }}>
                                  {ord.shipping?.phone}
                                </div>
                                <a
                                  href={`https://wa.me/${ord.shipping?.phone?.replace(/\D/g, '')}?text=Hi%20${encodeURIComponent(ord.shipping?.fullName || 'Collector')},%20this%20is%20Saturn.Thrifttt%20regarding%20your%20order%20#${ord.id}!`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#16a34a', textDecoration: 'none', fontWeight: 700 }}
                                >
                                  💬 WhatsApp Chat ↗
                                </a>
                              </td>
                              <td style={{ fontSize: 11, maxWidth: 180 }}>
                                {ord.shipping?.street}, {ord.shipping?.city}, {ord.shipping?.state} - {ord.shipping?.pincode}
                              </td>
                              <td>
                                {ord.items?.map((it) => (
                                  <div key={it.id} style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
                                    • {it.title} ({it.lot})
                                  </div>
                                ))}
                                <div style={{ fontWeight: 800, marginTop: 4 }}>
                                  Total: ₹{Number(ord.total).toLocaleString('en-IN')}
                                </div>
                              </td>
                              <td>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700 }}>
                                  {ord.paymentRail}
                                </div>
                                {ord.codTokenAmount ? (
                                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: '#d97706', marginTop: 2 }}>
                                    30% Token: ₹{ord.codTokenAmount.toLocaleString('en-IN')} (UTR: {ord.utrNumber})<br />
                                    Balance Due: ₹{ord.codBalanceAmount.toLocaleString('en-IN')}
                                  </div>
                                ) : (
                                  ord.utrNumber && (
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: '#16a34a', marginTop: 2 }}>
                                      Full UPI UTR: {ord.utrNumber}
                                    </div>
                                  )
                                )}
                              </td>
                              <td>
                                <select
                                  value={ord.status}
                                  onChange={(e) => handleUpdateOrderStatus(ord.id, e.target.value)}
                                  className="admin-status-dropdown"
                                >
                                  <option value="Processing // Authentication">Processing // Authentication</option>
                                  <option value="Kraft Tube Packaging">Kraft Tube Packaging</option>
                                  <option value="Dispatched via Air-Freight">Dispatched via Air-Freight</option>
                                  <option value="Delivered // Relic Acquired">Delivered // Relic Acquired</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: STORE CONFIGURATION & SETTINGS */}
            {activeTab === 'settings' && (
              <div className="admin-tab-pane">
                <div className="admin-card-panel" style={{ maxWidth: 700 }}>
                  <div className="admin-card-heading">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>tune</span>
                    <span>STORE PAYMENT RAILS &amp; TELEMETRY CONFIGURATION</span>
                  </div>

                  <form onSubmit={handleSaveSettings} className="admin-form-grid" style={{ marginTop: 14 }}>
                    <div className="admin-form-field">
                      <label>Store Owner UPI VPA (Direct Settlement)</label>
                      <input
                        type="text"
                        value={localSettings.upiVpa}
                        onChange={(e) => setLocalSettings({ ...localSettings, upiVpa: e.target.value })}
                        placeholder="yourname@okhdfcbank"
                        required
                      />
                    </div>

                    <div className="admin-form-field">
                      <label>COD Advance Reservation Token (%)</label>
                      <input
                        type="number"
                        min={10}
                        max={50}
                        value={localSettings.codTokenPercent}
                        onChange={(e) => setLocalSettings({ ...localSettings, codTokenPercent: Number(e.target.value) })}
                        placeholder="30"
                        required
                      />
                    </div>

                    <div className="admin-form-field full-width">
                      <label>Store Physical Headquarters &amp; Dispatch Location</label>
                      <input
                        type="text"
                        value={localSettings.storeLocation}
                        onChange={(e) => setLocalSettings({ ...localSettings, storeLocation: e.target.value })}
                        placeholder="Arera Colony, Bhopal, MP 462016"
                        required
                      />
                    </div>

                    <div className="admin-form-field">
                      <label>WhatsApp Support Concierge Phone</label>
                      <input
                        type="text"
                        value={localSettings.whatsappNumber}
                        onChange={(e) => setLocalSettings({ ...localSettings, whatsappNumber: e.target.value })}
                        placeholder="+91 98765 43210"
                        required
                      />
                    </div>

                    <div className="admin-form-field">
                      <label>Instagram Official Handle</label>
                      <input
                        type="text"
                        value={localSettings.instagramHandle}
                        onChange={(e) => setLocalSettings({ ...localSettings, instagramHandle: e.target.value })}
                        placeholder="@saturn.thrifttt"
                        required
                      />
                    </div>

                    <div className="admin-form-field">
                      <label>Master Curator Passcode (Security PIN)</label>
                      <input
                        type="password"
                        value={localSettings.adminPasscode || '9410'}
                        onChange={(e) => setLocalSettings({ ...localSettings, adminPasscode: e.target.value })}
                        placeholder="e.g. 9410 or custom private pin"
                        required
                      />
                    </div>

                    <button type="submit" className="btn-admin-publish full-width">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
                      <span>SAVE STORE TELEMETRY SETTINGS</span>
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
