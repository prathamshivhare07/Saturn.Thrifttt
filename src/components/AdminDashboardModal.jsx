import { useState, useEffect } from 'react'
import { deleteRemoteRelic, insertRemoteOrder, syncSingleRelicToRemote } from '../lib/supabase'

export const FALLBACK_RELIC_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBpMwMxh5Dfy-4OXiZB9iIedGEl9ZyTLWyayX6rhafm2EvBgYqGNmVvDcNqnRwoHWfLY2Yn5sfvNNoCG5JVgamSUfXtvPtoL1vXdOBFbJmfsktcjarJTA2aAcd19WCO4h08SyFQZAbFqQ5pTgAAOHVHD9-0vFr3SdHzveYB2ElCzQtFVvHmjqWbZZNQyaB4cIxXyQcxu_-oJYsZe9waOqqnBn1blc2eSnJIjMoLjQA'

// Compress and downscale uploaded photo to keep payload light (~40KB) and preserve quality
function compressImage(file, maxWidth = 900, maxHeight = 900, quality = 0.75) {
  return new Promise((resolve) => {
    if (!file) return resolve('')
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result || '')
      reader.readAsDataURL(file)
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(compressedDataUrl)
      }
      img.onerror = () => resolve(event.target?.result || '')
      img.src = event.target?.result
    }
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

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
    images: [],
    isSold: false,
  })
  const [newRelicImages, setNewRelicImages] = useState([])
  const [newUrlInput, setNewUrlInput] = useState('')
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [formSuccess, setFormSuccess] = useState('')

  // Relic Editing State (Addon to edit already uploaded articles)
  const [editingRelic, setEditingRelic] = useState(null)
  const [editRelicImages, setEditRelicImages] = useState([])
  const [editUrlInput, setEditUrlInput] = useState('')

  // Order Search & Filter State
  const [orderSearch, setOrderSearch] = useState('')
  const [orderStatusFilter, setOrderStatusFilter] = useState('all')

  // Selected Order for Full Dossier Inspector Modal
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderTrackingPartner, setOrderTrackingPartner] = useState('')
  const [orderTrackingNumber, setOrderTrackingNumber] = useState('')
  const [orderAdminNotes, setOrderAdminNotes] = useState('')
  const [copyFeedback, setCopyFeedback] = useState('')

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
  const [localSettings, setLocalSettings] = useState(() => {
    const s = { ...storeSettings }
    if (!s.upiVpa || s.upiVpa === 'saturn.thrift@okhdfcbank') {
      s.upiVpa = '9329993116@kotakbank'
    }
    if (!s.whatsappNumber || s.whatsappNumber === '+91 98765 43210') {
      s.whatsappNumber = '+919329993116'
    }
    if (s.deliveryFee === undefined) {
      s.deliveryFee = 120
    }
    return s
  })
  const [localBanner, setLocalBanner] = useState({ ...announcementBanner })

  // Keep localSettings in sync if storeSettings updates
  useEffect(() => {
    if (storeSettings) {
      setLocalSettings({
        ...storeSettings,
        deliveryFee: storeSettings.deliveryFee !== undefined ? storeSettings.deliveryFee : 120,
        upiVpa: (storeSettings.upiVpa && !storeSettings.upiVpa.includes('okhdfcbank'))
          ? storeSettings.upiVpa
          : (import.meta.env.VITE_YOUPI_UPI_VPA || '9329993116@kotakbank'),
        whatsappNumber: (storeSettings.whatsappNumber && storeSettings.whatsappNumber !== '+91 98765 43210')
          ? storeSettings.whatsappNumber
          : (import.meta.env.VITE_WHATSAPP_CONCIERGE_NUMBER || '+919329993116'),
      })
    }
  }, [storeSettings])

  // Sync tracking fields when selectedOrder changes
  useEffect(() => {
    if (selectedOrder) {
      setOrderTrackingPartner(selectedOrder.trackingPartner || 'Bluedart Air')
      setOrderTrackingNumber(selectedOrder.trackingNumber || '')
      setOrderAdminNotes(selectedOrder.adminNotes || '')
    }
  }, [selectedOrder])

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

  // Handle multi-photo file upload for new relic with client-side compression
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setIsUploadingPhoto(true)
    try {
      const compressedList = await Promise.all(files.map((f) => compressImage(f)))
      const valid = compressedList.filter(Boolean)
      setNewRelicImages((prev) => {
        const cleanPrev = prev.filter((img) => img && !img.includes('AB6AXuBpMwMxh5Dfy'))
        const combined = [...cleanPrev, ...valid]
        setNewRelic((p) => ({
          ...p,
          img: combined[0] || '',
          images: combined,
        }))
        return combined
      })
    } finally {
      setIsUploadingPhoto(false)
      e.target.value = ''
    }
  }

  const handleAddNewUrl = () => {
    if (!newUrlInput.trim()) return
    const url = newUrlInput.trim()
    setNewRelicImages((prev) => {
      const combined = [...prev, url]
      setNewRelic((p) => ({
        ...p,
        img: combined[0] || p.img || '',
        images: combined,
      }))
      return combined
    })
    setNewUrlInput('')
  }

  const handleRemoveNewPhoto = (index) => {
    setNewRelicImages((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      setNewRelic((p) => ({
        ...p,
        img: updated[0] || '',
        images: updated,
      }))
      return updated
    })
  }

  const handleSetCoverNewPhoto = (index) => {
    setNewRelicImages((prev) => {
      if (index === 0) return prev
      const target = prev[index]
      const rest = prev.filter((_, i) => i !== index)
      const updated = [target, ...rest]
      setNewRelic((p) => ({
        ...p,
        img: target,
        images: updated,
      }))
      return updated
    })
  }

  // Smart Category Auto-Detection when typing piece title
  const handleTitleChange = (title) => {
    const lower = title.toLowerCase()
    let detectedCat = newRelic.category
    if (lower.includes('jacket') || lower.includes('coat') || lower.includes('windcheater') || lower.includes('bomber') || lower.includes('parka')) {
      detectedCat = 'jackets'
    } else if (lower.includes('denim') || lower.includes('jean') || lower.includes('501') || lower.includes('pant') || lower.includes('wrangler')) {
      detectedCat = 'denim'
    } else if (lower.includes('knit') || lower.includes('vest') || lower.includes('sweater') || lower.includes('cardigan')) {
      detectedCat = 'knits'
    } else if (lower.includes('hoodie') || lower.includes('fleece') || lower.includes('sweatshirt')) {
      detectedCat = 'hoodies'
    } else if (lower.includes('tee') || lower.includes('shirt') || lower.includes('band')) {
      detectedCat = 'tees'
    }
    setNewRelic((prev) => ({ ...prev, title, category: detectedCat }))
  }

  // Publish New Drop to Live Store
  const handlePublishRelic = (e) => {
    e.preventDefault()
    if (!newRelic.title || !newRelic.price) {
      alert('Please provide at least a title and price.')
      return
    }

    const allImgs = (newRelicImages.length > 0 ? newRelicImages : (newRelic.img ? [newRelic.img] : []))
      .filter((img) => img && !img.includes('AB6AXuBpMwMxh5Dfy'))

    if (allImgs.length === 0) {
      alert('Please upload at least 1 photo for this relic.')
      return
    }

    const primaryImg = allImgs[0]

    const createdRelic = {
      id: `relic-${Date.now()}`,
      ...newRelic,
      img: primaryImg,
      images: allImgs,
      price: Number(newRelic.price),
      barcode: `BARCODE: |||| |||| ${Math.floor(100 + Math.random() * 900)}`,
    }

    const updated = [createdRelic, ...relics]
    onUpdateRelics(updated)
    syncSingleRelicToRemote(createdRelic)

    setFormSuccess(`✦ Success! "${newRelic.title}" published to live store catalog with ${createdRelic.images.length} photos.`)
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
      images: [],
      isSold: false,
    })
    setNewRelicImages([])
    setNewUrlInput('')
  }

  // ============================================================
  // EDIT EXISTING RELIC HANDLERS
  // ============================================================
  const handleStartEdit = (relic) => {
    const rawImages = Array.isArray(relic.images) && relic.images.length > 0
      ? [...relic.images]
      : (relic.img ? [relic.img] : [])

    // Filter out fallback placeholder so real photos are preserved cleanly
    const realImages = rawImages.filter(
      (img) => img && !img.includes('AB6AXuBpMwMxh5Dfy')
    )

    setEditingRelic({ ...relic, img: realImages[0] || '', images: realImages })
    setEditRelicImages(realImages)
    setActiveTab('inventory')
  }

  const handleCancelEdit = () => {
    setEditingRelic(null)
    setEditRelicImages([])
    setEditUrlInput('')
  }

  const handleEditPhotoUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setIsUploadingPhoto(true)
    try {
      const compressedList = await Promise.all(files.map((f) => compressImage(f)))
      const valid = compressedList.filter(Boolean)
      setEditRelicImages((prev) => {
        const cleanPrev = prev.filter((img) => img && !img.includes('AB6AXuBpMwMxh5Dfy'))
        const combined = [...cleanPrev, ...valid]
        setEditingRelic((p) => ({
          ...p,
          img: combined[0] || '',
          images: combined,
        }))
        return combined
      })
    } finally {
      setIsUploadingPhoto(false)
      e.target.value = ''
    }
  }

  const handleAddEditUrl = () => {
    if (!editUrlInput.trim()) return
    const url = editUrlInput.trim()
    setEditRelicImages((prev) => {
      const combined = [...prev, url]
      setEditingRelic((p) => ({
        ...p,
        img: combined[0] || p.img || '',
        images: combined,
      }))
      return combined
    })
    setEditUrlInput('')
  }

  const handleRemoveEditPhoto = (index) => {
    setEditRelicImages((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      setEditingRelic((p) => ({
        ...p,
        img: updated[0] || '',
        images: updated,
      }))
      return updated
    })
  }

  const handleSetCoverEditPhoto = (index) => {
    setEditRelicImages((prev) => {
      if (index === 0) return prev
      const target = prev[index]
      const rest = prev.filter((_, i) => i !== index)
      const updated = [target, ...rest]
      setEditingRelic((p) => ({
        ...p,
        img: target,
        images: updated,
      }))
      return updated
    })
  }

  const handleSaveEditedRelic = (e) => {
    e.preventDefault()
    if (!editingRelic.title || !editingRelic.price) {
      alert('Please provide at least a title and price.')
      return
    }

    const allImgs = (editRelicImages.length > 0 ? editRelicImages : (editingRelic.img ? [editingRelic.img] : []))
      .filter((img) => img && !img.includes('AB6AXuBpMwMxh5Dfy'))

    const primaryImg = allImgs[0] || (editingRelic.img && !editingRelic.img.includes('AB6AXuBpMwMxh5Dfy') ? editingRelic.img : '') || FALLBACK_RELIC_IMG

    const updatedRelic = {
      ...editingRelic,
      img: primaryImg,
      images: allImgs.length > 0 ? allImgs : [primaryImg],
      price: Number(editingRelic.price),
    }

    const updated = relics.map((r) => (r.id === updatedRelic.id ? updatedRelic : r))
    onUpdateRelics(updated)
    syncSingleRelicToRemote(updatedRelic)

    setFormSuccess(`✦ Success! "${updatedRelic.title}" updated in live vault catalog with ${updatedRelic.images.length} photos.`)
    setTimeout(() => setFormSuccess(''), 4000)

    setEditingRelic(null)
    setEditRelicImages([])
    setEditUrlInput('')
  }

  // ============================================================
  // ORDER MANAGEMENT & FULFILLMENT HANDLERS
  // ============================================================
  const handleSelectOrder = (order) => {
    setSelectedOrder(order)
    setOrderTrackingPartner(order.trackingPartner || 'Bluedart Air')
    setOrderTrackingNumber(order.trackingNumber || '')
    setOrderAdminNotes(order.adminNotes || '')
  }

  const handleSaveOrderTracking = () => {
    if (!selectedOrder) return
    const updatedOrder = {
      ...selectedOrder,
      trackingPartner: orderTrackingPartner,
      trackingNumber: orderTrackingNumber,
      adminNotes: orderAdminNotes,
    }
    const updatedOrders = allOrders.map((o) => (o.id === selectedOrder.id ? updatedOrder : o))
    onUpdateOrders(updatedOrders)
    setSelectedOrder(updatedOrder)
    try {
      insertRemoteOrder(updatedOrder)
    } catch {}
    alert(`Manifest #${selectedOrder.id} dispatch tracking details updated!`)
  }

  const handleCopyCustomerAddress = (order) => {
    if (!order?.shipping) return
    const s = order.shipping
    const fullText = `${s.fullName}\nPhone: ${s.phone}\n${s.street}\n${s.city}, ${s.state} - ${s.pincode}\nIndia`
    navigator.clipboard.writeText(fullText)
    setCopyFeedback('Address copied to clipboard!')
    setTimeout(() => setCopyFeedback(''), 2500)
  }

  const handlePrintOrderManifest = (order) => {
    if (!order) return
    const printWindow = window.open('', '_blank', 'width=800,height=700')
    if (!printWindow) return

    const itemsHtml = (order.items || [])
      .map(
        (it) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>${it.lot}</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">${it.title}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">₹${Number(it.price).toLocaleString('en-IN')}</td>
        </tr>`
      )
      .join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dispatch Manifest #${order.id} - Saturn.Thrifttt</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1715; }
          .header { border-bottom: 2px solid #1a1715; padding-bottom: 16px; margin-bottom: 24px; }
          .brand { font-size: 24px; font-weight: 800; letter-spacing: 0.1em; }
          .sub { font-size: 11px; text-transform: uppercase; color: #666; margin-top: 4px; }
          .meta-grid { display: flex; justify-content: space-between; margin-bottom: 24px; }
          .box { background: #faf7f2; border: 1px solid #e0d8ce; padding: 14px; border-radius: 4px; flex: 1; margin-right: 12px; }
          .box:last-child { margin-right: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { text-align: left; padding: 8px 10px; background: #eee; font-size: 12px; text-transform: uppercase; }
          .total-row { font-size: 16px; font-weight: bold; text-align: right; margin-top: 20px; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #888; border-top: 1px dashed #ccc; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">SATURN.THRIFTTT // DISPATCH MANIFEST</div>
          <div class="sub">1-of-1 Cosmic Vintage Archive · Arera Colony, Bhopal, MP 462016</div>
        </div>
        <div class="meta-grid">
          <div class="box">
            <strong>MANIFEST ID:</strong> #${order.id}<br>
            <strong>ORDER DATE:</strong> ${order.date}<br>
            <strong>PAYMENT STATUS:</strong> ${order.paymentRail}<br>
            ${order.utrNumber ? `<strong>BANK UTR:</strong> ${order.utrNumber}` : ''}
          </div>
          <div class="box">
            <strong>DELIVERY TO:</strong><br>
            ${order.shipping?.fullName}<br>
            Phone: ${order.shipping?.phone}<br>
            ${order.shipping?.street}<br>
            ${order.shipping?.city}, ${order.shipping?.state} - ${order.shipping?.pincode}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Lot</th>
              <th>Archival Garment</th>
              <th style="text-align: right;">Value</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="total-row">
          Total Amount: ₹${Number(order.total).toLocaleString('en-IN')}
          ${order.codTokenAmount ? `<br><span style="font-size: 12px; color: #b45309;">(30% Advance Token Paid: ₹${order.codTokenAmount.toLocaleString('en-IN')} // Doorstep Balance: ₹${order.codBalanceAmount.toLocaleString('en-IN')})</span>` : ''}
        </div>
        <div class="footer">
          Each piece is ozone-sanitized & authenticated. Saturn Vault Archive Guarantee · curator@saturnthrift.in
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 400)
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

            {/* TAB 1: INVENTORY & UPLOAD / EDIT RELIC */}
            {activeTab === 'inventory' && (
              <div className="admin-tab-pane">
                <div className="admin-two-col-layout">
                  {/* Left Column: Edit Existing Relic OR Upload New Drop Form */}
                  {editingRelic ? (
                    <div className="admin-card-panel edit-mode-card">
                      <div className="admin-card-heading-split">
                        <div className="admin-card-heading" style={{ color: 'var(--primary)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>edit_note</span>
                          <span>EDIT ARCHIVAL RELIC // {editingRelic.lot}</span>
                        </div>
                        <button
                          type="button"
                          className="btn-admin-cancel-edit"
                          onClick={handleCancelEdit}
                          title="Cancel editing and return to new upload"
                        >
                          ✕ Cancel Edit
                        </button>
                      </div>

                      {formSuccess && <div className="admin-alert-success">{formSuccess}</div>}

                      <form onSubmit={handleSaveEditedRelic} className="admin-form-grid">
                        {/* Multi-Photo Management for Edit Mode */}
                        <div className="admin-form-field full-width">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ margin: 0, fontWeight: 700 }}>
                              Relic Photo Gallery ({editRelicImages.length} {editRelicImages.length === 1 ? 'photo' : 'photos'})
                            </label>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)' }}>
                              First photo is the Cover / Feed image
                            </span>
                          </div>

                          {/* Thumbnails Grid */}
                          {editRelicImages.length > 0 ? (
                            <div className="admin-photo-grid">
                              {editRelicImages.map((imgSrc, idx) => (
                                <div key={idx} className={`admin-photo-thumb-card ${idx === 0 ? 'is-cover' : ''}`}>
                                  <img
                                    src={imgSrc || FALLBACK_RELIC_IMG}
                                    alt={`Photo ${idx + 1}`}
                                    className="admin-photo-thumb-img"
                                    onError={(e) => {
                                      e.currentTarget.onerror = null
                                      e.currentTarget.src = FALLBACK_RELIC_IMG
                                    }}
                                  />
                                  {idx === 0 ? (
                                    <span className="badge-cover-photo">★ COVER</span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn-set-cover"
                                      onClick={() => handleSetCoverEditPhoto(idx)}
                                      title="Make this photo the primary cover image"
                                    >
                                      Set Cover
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn-delete-photo"
                                    onClick={() => handleRemoveEditPhoto(idx)}
                                    title="Remove photo"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="admin-empty-photo-box">
                              <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--outline)' }}>
                                image_not_supported
                              </span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>
                                No photos attached. Upload from device or paste an image URL below.
                              </span>
                            </div>
                          )}

                          {/* Actions: Upload Files + Add URL */}
                          <div className="admin-photo-actions-row">
                            <label className="btn-add-photos-label">
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_photo_alternate</span>
                              <span>{isUploadingPhoto ? 'Compressing & Loading...' : '+ Upload Photos (Multiple)'}</span>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleEditPhotoUpload}
                                style={{ display: 'none' }}
                                disabled={isUploadingPhoto}
                              />
                            </label>

                            <div className="admin-url-add-box">
                              <input
                                type="text"
                                placeholder="Paste image URL (https://...)"
                                value={editUrlInput}
                                onChange={(e) => setEditUrlInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleAddEditUrl()
                                  }
                                }}
                                className="admin-input-compact"
                              />
                              <button
                                type="button"
                                className="btn-add-url"
                                onClick={handleAddEditUrl}
                              >
                                + Add URL
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="admin-form-field">
                          <label>Piece Title</label>
                          <input
                            type="text"
                            value={editingRelic.title}
                            onChange={(e) => setEditingRelic({ ...editingRelic, title: e.target.value })}
                            required
                          />
                        </div>

                        <div className="admin-form-field">
                          <label>Lot Identifier</label>
                          <input
                            type="text"
                            value={editingRelic.lot}
                            onChange={(e) => setEditingRelic({ ...editingRelic, lot: e.target.value })}
                            required
                          />
                        </div>

                        <div className="admin-form-field">
                          <label>Archival Category</label>
                          <select
                            value={editingRelic.category}
                            onChange={(e) => setEditingRelic({ ...editingRelic, category: e.target.value })}
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
                            value={editingRelic.price}
                            onChange={(e) => setEditingRelic({ ...editingRelic, price: e.target.value })}
                            required
                          />
                        </div>

                        <div className="admin-form-field">
                          <label>Curator Badge</label>
                          <select
                            value={editingRelic.badge}
                            onChange={(e) => setEditingRelic({ ...editingRelic, badge: e.target.value })}
                          >
                            <option value="✦ 1-OF-1 ONLY">✦ 1-OF-1 ONLY</option>
                            <option value="✦ GRAIL SPEC">✦ GRAIL SPEC</option>
                            <option value="✦ DEADSTOCK GEM">✦ DEADSTOCK GEM</option>
                            <option value="✦ ARCHIVAL WORKWEAR">✦ ARCHIVAL WORKWEAR</option>
                          </select>
                        </div>

                        <div className="admin-form-field">
                          <label>Availability Status</label>
                          <select
                            value={editingRelic.isSold ? 'sold' : 'available'}
                            onChange={(e) => setEditingRelic({ ...editingRelic, isSold: e.target.value === 'sold' })}
                          >
                            <option value="available">In Stock // Available for Collectors</option>
                            <option value="sold">Sold Out // Archived in Museum</option>
                          </select>
                        </div>

                        <div className="admin-form-field">
                          <label>Year &amp; Specification</label>
                          <input
                            type="text"
                            value={editingRelic.year || ''}
                            onChange={(e) => setEditingRelic({ ...editingRelic, year: e.target.value })}
                          />
                        </div>

                        <div className="admin-form-field">
                          <label>Tag &amp; Size</label>
                          <input
                            type="text"
                            value={editingRelic.tag || ''}
                            onChange={(e) => setEditingRelic({ ...editingRelic, tag: e.target.value })}
                          />
                        </div>

                        <div className="admin-form-field">
                          <label>Measurements (P2P / Length / Waist)</label>
                          <input
                            type="text"
                            value={editingRelic.measurements || ''}
                            onChange={(e) => setEditingRelic({ ...editingRelic, measurements: e.target.value })}
                          />
                        </div>

                        <div className="admin-form-field full-width">
                          <label>Curator Condition Notes</label>
                          <textarea
                            rows={2}
                            value={editingRelic.desc || ''}
                            onChange={(e) => setEditingRelic({ ...editingRelic, desc: e.target.value })}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: 10, gridColumn: 'span 2' }}>
                          <button type="submit" className="btn-admin-publish" style={{ flex: 1 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
                            <span>SAVE CHANGES TO RELIC</span>
                          </button>
                          <button
                            type="button"
                            className="btn-admin-cancel-edit"
                            style={{ padding: '12px 18px', background: 'var(--surface-variant)', border: '1px solid var(--outline-variant)' }}
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="admin-card-panel">
                      <div className="admin-card-heading">
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_circle</span>
                        <span>UPLOAD NEW 1-OF-1 VINTAGE DROP</span>
                      </div>

                      {formSuccess && <div className="admin-alert-success">{formSuccess}</div>}

                      <form onSubmit={handlePublishRelic} className="admin-form-grid">
                        {/* Multi-Photo Management for New Relic */}
                        <div className="admin-form-field full-width">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ margin: 0, fontWeight: 700 }}>
                              Relic Photo Gallery ({newRelicImages.length} {newRelicImages.length === 1 ? 'photo' : 'photos'})
                            </label>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)' }}>
                              First photo is the Cover / Feed image
                            </span>
                          </div>

                          {/* Thumbnails Grid */}
                          {newRelicImages.length > 0 ? (
                            <div className="admin-photo-grid">
                              {newRelicImages.map((imgSrc, idx) => (
                                <div key={idx} className={`admin-photo-thumb-card ${idx === 0 ? 'is-cover' : ''}`}>
                                  <img
                                    src={imgSrc || FALLBACK_RELIC_IMG}
                                    alt={`Photo ${idx + 1}`}
                                    className="admin-photo-thumb-img"
                                    onError={(e) => {
                                      e.currentTarget.onerror = null
                                      e.currentTarget.src = FALLBACK_RELIC_IMG
                                    }}
                                  />
                                  {idx === 0 ? (
                                    <span className="badge-cover-photo">★ COVER</span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn-set-cover"
                                      onClick={() => handleSetCoverNewPhoto(idx)}
                                      title="Make this photo the primary cover image"
                                    >
                                      Set Cover
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn-delete-photo"
                                    onClick={() => handleRemoveNewPhoto(idx)}
                                    title="Remove photo"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="admin-photo-dropzone">
                              <label className="dropzone-label">
                                <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--primary)' }}>
                                  cloud_upload
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
                                  {isUploadingPhoto ? 'Compressing & Loading Photos...' : 'Click to Select One or Multiple Photos'}
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)' }}>
                                  JPG, PNG, WEBP from your phone or device · Multiple photos supported
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={handlePhotoUpload}
                                  style={{ display: 'none' }}
                                  disabled={isUploadingPhoto}
                                />
                              </label>
                            </div>
                          )}

                          {/* Actions Row */}
                          <div className="admin-photo-actions-row">
                            {newRelicImages.length > 0 && (
                              <label className="btn-add-photos-label">
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_photo_alternate</span>
                                <span>{isUploadingPhoto ? 'Compressing...' : '+ Add More Photos'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={handlePhotoUpload}
                                  style={{ display: 'none' }}
                                  disabled={isUploadingPhoto}
                                />
                              </label>
                            )}

                            <div className="admin-url-add-box">
                              <input
                                type="text"
                                placeholder="...or paste image URL (https://...)"
                                value={newUrlInput}
                                onChange={(e) => setNewUrlInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleAddNewUrl()
                                  }
                                }}
                                className="admin-input-compact"
                              />
                              <button
                                type="button"
                                className="btn-add-url"
                                onClick={handleAddNewUrl}
                              >
                                + Add URL
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="admin-form-field">
                          <label>Piece Title</label>
                          <input
                            type="text"
                            placeholder="e.g. 1993 Nirvana In Utero Tour Tee"
                            value={newRelic.title}
                            onChange={(e) => handleTitleChange(e.target.value)}
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
                  )}

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
                        <div key={r.id} className={`admin-relic-row ${r.isSold ? 'sold-out' : ''} ${editingRelic?.id === r.id ? 'being-edited' : ''}`}>
                          <img
                            src={r.img || FALLBACK_RELIC_IMG}
                            alt={r.title}
                            className="admin-relic-thumb"
                            onError={(e) => {
                              e.currentTarget.onerror = null
                              e.currentTarget.src = FALLBACK_RELIC_IMG
                            }}
                          />
                          <div className="admin-relic-details">
                            <div className="admin-relic-lot-row">
                              <span className="admin-relic-lot">{r.lot}</span>
                              <span className="admin-relic-cat">{r.category?.toUpperCase()}</span>
                              <span className="admin-relic-photos-count" title={`${r.images?.length || (r.img ? 1 : 0)} photos in archival gallery`}>
                                📷 {r.images && r.images.length > 0 ? r.images.length : (r.img ? 1 : 0)}
                              </span>
                              {r.isSold && <span className="admin-sold-badge">SOLD OUT</span>}
                              {editingRelic?.id === r.id && <span className="admin-editing-badge">EDITING NOW</span>}
                            </div>
                            <div className="admin-relic-title">{r.title}</div>
                            <div className="admin-relic-price">₹{Number(r.price).toLocaleString('en-IN')}</div>
                          </div>

                          <div className="admin-relic-actions">
                            <button
                              type="button"
                              className={`btn-edit-relic ${editingRelic?.id === r.id ? 'active' : ''}`}
                              onClick={() => handleStartEdit(r)}
                              title="Edit piece details (Price, Photo, Description, Size)"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              className={`btn-toggle-sold ${r.isSold ? 'mark-available' : 'mark-sold'}`}
                              onClick={() => handleToggleSold(r.id)}
                            >
                              {r.isSold ? 'Available' : 'Sold'}
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
                {/* Orders KPI Metrics Bar */}
                <div className="admin-orders-kpi-grid">
                  <div className="admin-kpi-card">
                    <div className="kpi-label">TOTAL STORE REVENUE</div>
                    <div className="kpi-value" style={{ color: 'var(--primary)' }}>
                      ₹{allOrders.reduce((sum, o) => sum + Number(o.total || 0), 0).toLocaleString('en-IN')}
                    </div>
                    <div className="kpi-sub">Across all live customer checkouts</div>
                  </div>

                  <div className="admin-kpi-card">
                    <div className="kpi-label">TOTAL ORDERS PLACED</div>
                    <div className="kpi-value">{allOrders.length}</div>
                    <div className="kpi-sub">Archival vintage manifests</div>
                  </div>

                  <div className="admin-kpi-card">
                    <div className="kpi-label">AWAITING DISPATCH</div>
                    <div className="kpi-value" style={{ color: '#d97706' }}>
                      {allOrders.filter((o) => o.status?.includes('Processing') || o.status?.includes('Packaging')).length}
                    </div>
                    <div className="kpi-sub">In authentication / kraft tube packaging</div>
                  </div>

                  <div className="admin-kpi-card">
                    <div className="kpi-label">FULFILLED / DELIVERED</div>
                    <div className="kpi-value" style={{ color: '#16a34a' }}>
                      {allOrders.filter((o) => o.status?.includes('Delivered')).length}
                    </div>
                    <div className="kpi-sub">Safely received by collectors</div>
                  </div>
                </div>

                <div className="admin-card-panel" style={{ marginTop: 14 }}>
                  <div className="admin-card-heading-split">
                    <div className="admin-card-heading">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>receipt_long</span>
                      <span>INCOMING DISPATCH MANIFESTS &amp; RECONCILIATIONS ({allOrders.length})</span>
                    </div>

                    {/* Order Search & Status Filter */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        placeholder="Search order ID, name, phone, UTR..."
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        className="admin-search-input"
                        style={{ width: 220 }}
                      />
                      <select
                        value={orderStatusFilter}
                        onChange={(e) => setOrderStatusFilter(e.target.value)}
                        className="admin-select-filter"
                      >
                        <option value="all">All Statuses</option>
                        <option value="Processing">Processing</option>
                        <option value="Packaging">Packaging</option>
                        <option value="Dispatched">Dispatched</option>
                        <option value="Delivered">Delivered</option>
                      </select>
                    </div>
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
                            <th>Relic Items</th>
                            <th>Payment Rail &amp; UTR</th>
                            <th>Status &amp; Tracking</th>
                            <th>Full Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allOrders
                            .filter((ord) => {
                              const matchesFilter =
                                orderStatusFilter === 'all' ||
                                ord.status?.toLowerCase().includes(orderStatusFilter.toLowerCase())
                              const q = orderSearch.toLowerCase()
                              const matchesSearch =
                                !q ||
                                ord.id?.toLowerCase().includes(q) ||
                                ord.shipping?.fullName?.toLowerCase().includes(q) ||
                                ord.shipping?.phone?.includes(q) ||
                                ord.shipping?.city?.toLowerCase().includes(q) ||
                                ord.utrNumber?.toLowerCase().includes(q)
                              return matchesFilter && matchesSearch
                            })
                            .map((ord) => (
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
                                  <div style={{ fontSize: 10.5, color: 'var(--on-surface-variant)' }}>
                                    {ord.shipping?.city}, {ord.shipping?.state}
                                  </div>
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
                                      30% Token: ₹{ord.codTokenAmount.toLocaleString('en-IN')}<br />
                                      UTR: {ord.utrNumber}<br />
                                      Balance: ₹{ord.codBalanceAmount.toLocaleString('en-IN')}
                                    </div>
                                  ) : (
                                    ord.utrNumber && (
                                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: '#16a34a', marginTop: 2 }}>
                                        UTR: {ord.utrNumber}
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
                                  {ord.trackingNumber && (
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--tertiary)', marginTop: 4 }}>
                                      AWB: {ord.trackingNumber}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn-admin-view-dossier"
                                    onClick={() => handleSelectOrder(ord)}
                                    title="View all order and delivery details"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>visibility</span>
                                    <span>Details</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* ============================================================
                    FULL ORDER DOSSIER INSPECTOR MODAL
                    ============================================================ */}
                {selectedOrder && (
                  <div className="admin-order-dossier-overlay" onClick={() => setSelectedOrder(null)}>
                    <div className="admin-order-dossier-modal" onClick={(e) => e.stopPropagation()}>
                      <div className="dossier-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: 24 }}>
                            verified
                          </span>
                          <div>
                            <div className="dossier-title">MANIFEST DOSSIER #{selectedOrder.id}</div>
                            <div className="dossier-sub">Placed on {selectedOrder.date} · Status: <strong>{selectedOrder.status}</strong></div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="checkout-close-btn"
                          onClick={() => setSelectedOrder(null)}
                          aria-label="Close Dossier"
                        >
                          <span className="material-symbols-outlined">close</span>
                        </button>
                      </div>

                      <div className="dossier-body">
                        {/* Section 1: Customer Information & Shipping */}
                        <div className="dossier-card">
                          <div className="dossier-card-title">
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_pin</span>
                            <span>COLLECTOR &amp; DELIVERY ADDRESS</span>
                          </div>

                          <div className="dossier-grid-two">
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 14 }}>{selectedOrder.shipping?.fullName}</div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                                Phone: {selectedOrder.shipping?.phone}
                              </div>
                              {selectedOrder.shipping?.email && (
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>
                                  Email: {selectedOrder.shipping?.email}
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <a
                                  href={`https://wa.me/${selectedOrder.shipping?.phone?.replace(/\D/g, '')}?text=Hi%20${encodeURIComponent(selectedOrder.shipping?.fullName || 'Collector')},%20this%20is%20Saturn.Thrifttt%20regarding%20your%20order%20#${selectedOrder.id}!`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="dossier-btn-wa"
                                >
                                  💬 Message on WhatsApp ↗
                                </a>
                              </div>
                            </div>

                            <div style={{ background: 'var(--surface)', padding: 12, border: '1px solid var(--outline-variant)' }}>
                              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--outline)', textTransform: 'uppercase' }}>
                                Destination Shipping Address:
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, lineHeight: 1.4 }}>
                                {selectedOrder.shipping?.street}<br />
                                {selectedOrder.shipping?.city}, {selectedOrder.shipping?.state} - {selectedOrder.shipping?.pincode}<br />
                                India
                              </div>
                              <button
                                type="button"
                                className="dossier-btn-copy"
                                onClick={() => handleCopyCustomerAddress(selectedOrder)}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
                                <span>Copy Full Address for Courier Label</span>
                              </button>
                              {copyFeedback && (
                                <div style={{ fontSize: 10, color: '#16a34a', fontFamily: 'var(--font-mono)', marginTop: 4, fontWeight: 700 }}>
                                  ✓ {copyFeedback}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Section 2: Items in Order */}
                        <div className="dossier-card">
                          <div className="dossier-card-title">
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>inventory_2</span>
                            <span>AUTHENTICATED RELICS IN THIS DISPATCH ({selectedOrder.items?.length || 0})</span>
                          </div>

                          <div className="dossier-items-list">
                            {selectedOrder.items?.map((it) => (
                              <div key={it.id} className="dossier-item-row">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  {it.img && <img src={it.img} alt={it.title} className="dossier-item-thumb" />}
                                  <div>
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--primary)', fontWeight: 800 }}>
                                      {it.lot}
                                    </div>
                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{it.title}</div>
                                    {it.tag && <div style={{ fontSize: 10.5, color: 'var(--on-surface-variant)' }}>{it.tag}</div>}
                                  </div>
                                </div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 13 }}>
                                  ₹{Number(it.price).toLocaleString('en-IN')}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Section 3: Financial Settlement & UTR Breakdown */}
                        <div className="dossier-card">
                          <div className="dossier-card-title">
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>account_balance_wallet</span>
                            <span>FINANCIAL SETTLEMENT &amp; AUDIT TRAIL</span>
                          </div>

                          <div className="dossier-grid-two">
                            <div>
                              <div className="dossier-fee-row">
                                <span>Garment Subtotal:</span>
                                <strong>₹{Number(selectedOrder.subtotal || selectedOrder.total).toLocaleString('en-IN')}</strong>
                              </div>
                              {selectedOrder.discount > 0 && (
                                <div className="dossier-fee-row" style={{ color: '#16a34a' }}>
                                  <span>Coupon Discount ({selectedOrder.couponCode}):</span>
                                  <strong>-₹{Number(selectedOrder.discount).toLocaleString('en-IN')}</strong>
                                </div>
                              )}
                              <div className="dossier-fee-row">
                                <span>Pan-India Delivery Fee:</span>
                                <strong>
                                  {selectedOrder.deliveryFee === 0 || selectedOrder.isFirstOrder
                                    ? 'FREE (1st Order Privilege ✦)'
                                    : `₹${selectedOrder.deliveryFee || 120}`}
                                </strong>
                              </div>
                              <div className="dossier-fee-row total-highlight">
                                <span>Final Order Value:</span>
                                <strong style={{ color: 'var(--primary)' }}>
                                  ₹{Number(selectedOrder.total).toLocaleString('en-IN')}
                                </strong>
                              </div>
                            </div>

                            <div style={{ background: 'var(--surface)', padding: 12, border: '1px solid var(--outline-variant)' }}>
                              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--outline)', textTransform: 'uppercase' }}>
                                Payment Method &amp; Bank Reference:
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4 }}>
                                {selectedOrder.paymentRail}
                              </div>
                              {selectedOrder.utrNumber && (
                                <div style={{ marginTop: 8, padding: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4 }}>
                                  <div style={{ fontSize: 10, color: '#15803d', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                                    BANK REFERENCE / UPI UTR NUMBER:
                                  </div>
                                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#166534', marginTop: 2 }}>
                                    {selectedOrder.utrNumber}
                                  </div>
                                </div>
                              )}
                              {selectedOrder.codTokenAmount ? (
                                <div style={{ marginTop: 8, padding: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4 }}>
                                  <div style={{ fontSize: 10, color: '#b45309', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                                    30% ADVANCE TOKEN SETTLED: ₹{selectedOrder.codTokenAmount.toLocaleString('en-IN')}
                                  </div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginTop: 2 }}>
                                    Balance to collect on doorstep: ₹{selectedOrder.codBalanceAmount.toLocaleString('en-IN')}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Section 4: Courier Tracking & Fulfillment Dispatch */}
                        <div className="dossier-card">
                          <div className="dossier-card-title">
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>local_shipping</span>
                            <span>COURIER AIR-FREIGHT TRACKING &amp; DISPATCH</span>
                          </div>

                          <div className="dossier-grid-two">
                            <div className="admin-form-field">
                              <label>Courier Air Logistics Partner</label>
                              <select
                                value={orderTrackingPartner}
                                onChange={(e) => setOrderTrackingPartner(e.target.value)}
                              >
                                <option value="Bluedart Air Express">Bluedart Air Express</option>
                                <option value="Delhivery Express">Delhivery Express</option>
                                <option value="DTDC Air Prime">DTDC Air Prime</option>
                                <option value="India Post Speed Post">India Post Speed Post</option>
                                <option value="Shiprocket Surface">Shiprocket Surface</option>
                                <option value="Local Courier / Hand Delivered">Local Courier / Hand Delivered</option>
                              </select>
                            </div>

                            <div className="admin-form-field">
                              <label>AWB Tracking Number / Courier Reference</label>
                              <input
                                type="text"
                                placeholder="e.g. 74839201948 or DELH-94812"
                                value={orderTrackingNumber}
                                onChange={(e) => setOrderTrackingNumber(e.target.value)}
                              />
                            </div>

                            <div className="admin-form-field full-width">
                              <label>Curator Internal Notes for this Order</label>
                              <input
                                type="text"
                                placeholder="e.g. Customer called for urgent Saturday delivery; kraft tube sealed."
                                value={orderAdminNotes}
                                onChange={(e) => setOrderAdminNotes(e.target.value)}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn-admin-publish"
                              style={{ padding: '8px 16px', fontSize: 12 }}
                              onClick={handleSaveOrderTracking}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
                              <span>Save Tracking &amp; Notes</span>
                            </button>

                            <button
                              type="button"
                              className="btn-admin-cancel-edit"
                              style={{ padding: '8px 16px', fontSize: 12, background: 'var(--surface-variant)', border: '1px solid var(--outline-variant)' }}
                              onClick={() => handlePrintOrderManifest(selectedOrder)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>print</span>
                              <span>Print Packing Slip</span>
                            </button>

                            <a
                              href={`https://wa.me/${selectedOrder.shipping?.phone?.replace(/\D/g, '')}?text=Hi%20${encodeURIComponent(selectedOrder.shipping?.fullName || 'Collector')}!%20Your%20Saturn.Thrifttt%20order%20%23${selectedOrder.id}%20has%20been%20updated%20to%20"${encodeURIComponent(selectedOrder.status)}".%20${orderTrackingNumber ? `Courier:%20${encodeURIComponent(orderTrackingPartner)}%20(AWB:%20${encodeURIComponent(orderTrackingNumber)})` : ''}%20Thank%20you%20for%20collecting%20with%20us!`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="dossier-btn-wa"
                              style={{ padding: '8px 16px', fontSize: 12 }}
                            >
                              📲 WhatsApp Tracking Link to Customer
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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
                        placeholder="9329993116@kotakbank"
                        required
                      />
                    </div>

                    <div className="admin-form-field">
                      <label>Standard Delivery Fee (₹) [1st Order Free]</label>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={localSettings.deliveryFee !== undefined ? localSettings.deliveryFee : 120}
                        onChange={(e) => setLocalSettings({ ...localSettings, deliveryFee: Number(e.target.value) })}
                        placeholder="120"
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
                        placeholder="+919329993116"
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
