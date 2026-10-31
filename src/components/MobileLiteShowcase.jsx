import React from 'react'
import { FALLBACK_RELIC_IMG } from '../lib/supabase'

export function MobileLiteShowcase({
  categories = [],
  activeCategory = 'all',
  onSelectCategory,
  relics = [],
  onClaimRelic,
  cart = [],
}) {
  const featuredRelics = relics.filter((r) => !r.isSold).slice(0, 10)

  return (
    <div className="mobile-lite-showcase">
      {/* 1. Archive Category Selector */}
      <div className="mobile-lite-category-label">
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>category</span>
        <span>BROWSE BY ARCHIVE CATEGORY</span>
      </div>
      <div className="mobile-lite-category-pills">
        <button
          type="button"
          className={`mobile-cat-pill ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => onSelectCategory('all')}
        >
          <span>✦ ALL RELICS</span>
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`mobile-cat-pill ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => onSelectCategory(cat.id)}
          >
            <span>{cat.shortName || cat.name}</span>
          </button>
        ))}
      </div>

      {/* 2. Featured 1-of-1 Relics Swipe Rail */}
      <div className="mobile-lite-featured-header">
        <div className="mobile-lite-featured-title">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bolt</span>
          <span>1-OF-1 ARCHIVE HIGHLIGHTS</span>
        </div>
        <span className="mobile-lite-swipe-hint">SWIPE TO VIEW →</span>
      </div>

      <div className="mobile-lite-cards-scroll">
        {featuredRelics.map((relic) => {
          const inCart = cart.some((i) => i.id === relic.id)
          return (
            <div key={relic.id} className="mobile-lite-card">
              <div className="mobile-lite-img-box">
                <img
                  src={relic.img || (Array.isArray(relic.images) && relic.images[0]) || FALLBACK_RELIC_IMG}
                  alt={relic.title}
                  className="mobile-lite-img"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = FALLBACK_RELIC_IMG
                  }}
                />
                <span className="mobile-lite-badge">{relic.lot}</span>
              </div>
              <div className="mobile-lite-info">
                <div>
                  <div className="mobile-lite-title" title={relic.title}>
                    {relic.title}
                  </div>
                  <div className="mobile-lite-tag">
                    {relic.tag || `${relic.category?.toUpperCase()} · ARCHIVE SPEC`}
                  </div>
                </div>
                <div className="mobile-lite-bottom">
                  <span className="mobile-lite-price">₹{relic.price.toLocaleString('en-IN')}</span>
                  <button
                    type="button"
                    className={`mobile-lite-claim-btn ${inCart ? 'claimed' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onClaimRelic(relic)
                    }}
                  >
                    {inCart ? 'IN BAG' : '+ BAG'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 3. Mobile Fast Trust Badges */}
      <div className="mobile-lite-trust-strip">
        <div className="trust-item">
          <span className="material-symbols-outlined">verified</span>
          <span>100% Authentic</span>
        </div>
        <div className="trust-item">
          <span className="material-symbols-outlined">local_shipping</span>
          <span>Free Delivery &gt; ₹599</span>
        </div>
        <div className="trust-item">
          <span className="material-symbols-outlined">bolt</span>
          <span>Express Delivery</span>
        </div>
      </div>
    </div>
  )
}

export function MobileServicesBar({ whatsappNumber = '+919329993116' }) {
  const cleanPhone = whatsappNumber.replace(/\D/g, '')

  return (
    <section className="mobile-services-section">
      <div className="mobile-services-badge">
        <span>✦ CLIENT CONCIERGE // PRIORITY DESK ✦</span>
      </div>
      <h3 className="mobile-services-heading">
        AUTHENTICATED VINTAGE &amp; CLIENT CONCIERGE
      </h3>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--on-surface-variant)', margin: '0 0 14px 0', lineHeight: 1.4 }}>
        Direct styling desk for live videos, sizing checks, pit-to-pit measurements, and fast express dispatch across India.
      </p>

      <div className="mobile-services-grid">
        <a
          href={`https://wa.me/${cleanPhone}?text=Hi%20Saturn.Thrifttt,%20I'd%20like%20to%20inquire%20about%20a%20vintage%20relic.`}
          target="_blank"
          rel="noopener noreferrer"
          className="mobile-service-pill-card"
        >
          <div className="mobile-service-pill-left">
            <div className="mobile-service-icon" style={{ background: '#25D366', color: '#ffffff' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chat</span>
            </div>
            <div>
              <div className="mobile-service-title">WhatsApp Priority Concierge</div>
              <div className="mobile-service-sub">Instant fit videos &amp; reserve holds ↗</div>
            </div>
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--on-surface-variant)' }}>arrow_forward</span>
        </a>

        <a
          href="https://instagram.com/saturn.thrifttt"
          target="_blank"
          rel="noopener noreferrer"
          className="mobile-service-pill-card"
        >
          <div className="mobile-service-pill-left">
            <div className="mobile-service-icon" style={{ background: '#E1306C', color: '#ffffff' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>photo_camera</span>
            </div>
            <div>
              <div className="mobile-service-title">Instagram @saturn.thrifttt</div>
              <div className="mobile-service-sub">Daily 8 PM drops &amp; community lookbooks ↗</div>
            </div>
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--on-surface-variant)' }}>arrow_forward</span>
        </a>
      </div>
    </section>
  )
}

