import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react'
import HeroClothingRack from './components/ClothingRack'
import AuthModal from './components/AuthModal'
import CheckoutModal from './components/CheckoutModal'
import {
  isSupabaseConfigured,
  fetchRemoteRelics,
  syncAllRelicsToRemote,
  subscribeToRelics,
  fetchRemoteOrders,
  insertRemoteOrder,
  subscribeToOrders,
  fetchRemoteConfig,
  saveRemoteConfig,
  subscribeToStoreConfig,
} from './lib/supabase'
import './App.css'

const AdminDashboardModal = lazy(() => import('./components/AdminDashboardModal'))

const FRAMES_SET_1_COUNT = 201 // ezgif-frame-001.png to ezgif-frame-201.png from /frames/
const FRAMES_SET_2_COUNT = 240 // ezgif-frame-001.png to ezgif-frame-240.png from /frames2/ (updated)
const TOTAL_FRAMES = FRAMES_SET_1_COUNT + FRAMES_SET_2_COUNT // 441 total connecting frames

function getFrameUrl(index) {
  if (index < FRAMES_SET_1_COUNT) {
    const paddedIndex = String(index + 1).padStart(3, '0')
    return `/frames/ezgif-frame-${paddedIndex}.png`
  }
  const frame2Num = index - FRAMES_SET_1_COUNT + 1
  const paddedIndex = String(frame2Num).padStart(3, '0')
  return `/frames2/ezgif-frame-${paddedIndex}.png`
}

// Clothing Categories for 3D Rack & Store
const HANGER_CATEGORIES = [
  {
    id: 'tees',
    num: '01',
    name: 'Graphic Tees',
    shortName: 'Tees',
    era: '1974–1996',
    count: 18,
    priceRange: '₹2,499–₹5,999',
    spec: 'Single-Stitch · Sun-Washed',
    badge: 'BROCKUM & MURINA',
    color: '#242328',
    accentColor: '#e0a96d',
    tagLot: 'LOT #0941',
  },
  {
    id: 'jackets',
    num: '02',
    name: 'Work Jackets',
    shortName: 'Jackets',
    era: '1982–1999',
    count: 12,
    priceRange: '₹4,999–₹9,999',
    spec: 'Detroit Duck · Corduroy Collar',
    badge: 'CARHARTT & BEN DAVIS',
    color: '#9e632e',
    accentColor: '#3d2010',
    tagLot: 'LOT #0942',
  },
  {
    id: 'denim',
    num: '03',
    name: 'Archival Denim',
    shortName: 'Denim',
    era: '1978–1995',
    count: 15,
    priceRange: '₹3,499–₹7,999',
    spec: 'Valencia 555 · Orange Tab',
    badge: "LEVI'S & WRANGLER",
    color: '#416386',
    accentColor: '#e26d24',
    tagLot: 'LOT #0943',
  },
  {
    id: 'knits',
    num: '04',
    name: 'Knitwear & Vests',
    shortName: 'Knits',
    era: '1990–1999',
    count: 9,
    priceRange: '₹3,999–₹6,499',
    spec: 'Ribbed Jacquard · Chunky Weave',
    badge: 'STÜSSY & ISSEY',
    color: '#4e5b41',
    accentColor: '#d1c0a5',
    tagLot: 'LOT #0944',
  },
  {
    id: 'hoodies',
    num: '05',
    name: 'Heavy Hoodies',
    shortName: 'Hoodies',
    era: '1989–1998',
    count: 14,
    priceRange: '₹4,299–₹6,999',
    spec: '450 GSM Reverse Weave',
    badge: 'CHAMPION & RUSSELL',
    color: '#212d40',
    accentColor: '#d66853',
    tagLot: 'LOT #0945',
  },
]

// Relics Data
const INITIAL_RELICS = [
  {
    id: 'relic-1',
    lot: 'LOT #0941',
    category: 'tees',
    badge: '✦ 1-OF-1 ONLY',
    title: 'Pink Floyd The Division Bell Tee',
    price: 4999,
    year: 'YEAR: 1994 // TOUR SPEC',
    tag: 'TAG: BROCKUM USA · SZ L',
    barcode: 'BARCODE: ||||| | |||| |||',
    measurements: 'P2P: 22.5" // LEN: 29"',
    desc: 'Condition 9/10. Sun-faded charcoal wash, subtle collar fraying, classic Brockum cotton drape. Single stitch intact.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBpMwMxh5Dfy-4OXiZB9iIedGEl9ZyTLWyayX6rhafm2EvBgYqGNmVvDcNqnRwoHWfLY2Yn5sfvNNoCG5JVgamSUfXtvPtoL1vXdOBFbJmfsktcjarJTA2aAcd19WCO4h08SyFQZAbFqQ5pTgAAOHVHD9-0vFr3SdHzveYB2ElCzQtFVvHmjqWbZZNQyaB4cIxXyQcxu_-oJYsZe9waOqqnBn1blc2eSnJIjMoLjQA',
  },
  {
    id: 'relic-2',
    lot: 'LOT #0942',
    category: 'jackets',
    badge: '✦ 1-OF-1 ONLY',
    title: 'Detroit Duck Canvas Jacket',
    price: 7999,
    year: 'YEAR: 1998 // DETROIT CUT',
    tag: 'TAG: CARHARTT USA · SZ XL',
    barcode: 'BARCODE: |||| |||| | |||',
    measurements: 'P2P: 25.0" // LEN: 26.5"',
    desc: 'Authentic motor-city oil patina, blanket lining in mint state, original heavy brass Talon zipper pull.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBbWY5CSBqGNa1_V84jabwfttFSQ1kXVhBKo4mXsjv4f0CscflnC8Z-BzkyWwSuOV6Gd5KHUYUHaxNlQ1JjcyxHU7DH_2JMMDAUBRUIgF4xYHYLhRDZ-oirM1aMMfGWN7kZpmL79OYDDc2qeQ32OHyuhpouUe2YQVAgxzTq7-6TyfTMlOAtKDJFKacXjj8-4wBKsy9tyvH338foHwtQYHdUS-yCHfPdifWT_gbtEbA',
  },
  {
    id: 'relic-3',
    lot: 'LOT #0943',
    category: 'denim',
    badge: '✦ 1-OF-1 ONLY',
    title: "Levi's 501 Orange Tab Raw Hem",
    price: 3899,
    year: 'YEAR: 1991 // VALENCIA ST.',
    tag: 'TAG: 501 ORANGE TAB · W32 L30',
    barcode: 'BARCODE: ||| |||||| | ||',
    measurements: 'WAIST: 32" // INSEAM: 30"',
    desc: 'Naturally sun-faded indigo with hand-frayed raw hem. Straight-leg classic 90s silhouette with stamped button 555.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAseL68k-RIYRD2tIUdnbC6J2E5Ua3eeAhzwTcimF0kdtZznOrnNyenJ-FgDgTNj7F2sA3x3wd9fKr8e92QfOpd8ddfBu_jZMpKXfLyTdwGU2b0bW1Pw34a97OOBGP5MVftn4kZ8388kHmDOY-Sd7-ys9L5RkI3kS0zkfeITZ9Z3-vKV4UhUWj5UfcM9f5Wiqom61VtHjJgDMsSfmZH6YoU7Eq1vZe89Bl7Z5wrQjM',
  },
  {
    id: 'relic-4',
    lot: 'LOT #0944',
    category: 'knits',
    badge: '✦ DEADSTOCK GEM',
    title: 'Stüssy Skate Knitted Vest',
    price: 4499,
    year: 'YEAR: 1996 // SKATE ARCHIVE',
    tag: 'TAG: STÜSSY S-TAG · SZ M',
    barcode: 'BARCODE: ||||| || | ||||',
    measurements: 'P2P: 21.0" // LEN: 27.0"',
    desc: 'Deadstock condition with original store flash tags. 100% thick rib-knit cotton in desert khaki and interstellar olive.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBPQxf_vf4zdPijCmKFvZo_AF--C3U1s1B76aPnAvolQLCKwViquF43Mu06UcVAPCg66TmQCiMCV9qXLA4vEe_2Q0oSwZ6H0dW7UUUKdczbZETe4BsApgfZ6utJhpzVuhEJMMFiEB5Ah3zgJl52PrP5TLEDyCKyDOIajHvCq7iiy3AEfmrkxljBUSmrS2IurggYUOBRtMNXh50GXtKKcVcZu2RH_jO5RcO0WV5VNDc',
  },
  {
    id: 'relic-5',
    lot: 'LOT #0945',
    category: 'hoodies',
    badge: '✦ 1-OF-1 ONLY',
    title: 'Champion Reverse Weave Navy Hoodie',
    price: 5299,
    year: 'YEAR: 1993 // ROCHESTER NY',
    tag: 'TAG: CHAMPION C-LOGO · SZ XL',
    barcode: 'BARCODE: |||| ||| |||| |',
    measurements: 'P2P: 26.0" // LEN: 28.0"',
    desc: 'Boxy 90s silhouette, sun-faded cosmic navy heavyweight 450GSM reverse-weave fleece, brass eyelets, thick cotton drawstrings.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBPQxf_vf4zdPijCmKFvZo_AF--C3U1s1B76aPnAvolQLCKwViquF43Mu06UcVAPCg66TmQCiMCV9qXLA4vEe_2Q0oSwZ6H0dW7UUUKdczbZETe4BsApgfZ6utJhpzVuhEJMMFiEB5Ah3zgJl52PrP5TLEDyCKyDOIajHvCq7iiy3AEfmrkxljBUSmrS2IurggYUOBRtMNXh50GXtKKcVcZu2RH_jO5RcO0WV5VNDc',
  },
  {
    id: 'relic-6',
    lot: 'LOT #0946',
    category: 'tees',
    badge: '✦ GRAIL SPEC',
    title: 'Soundgarden 1994 Tour Tee',
    price: 4799,
    year: 'YEAR: 1994 // SUPERUNKNOWN',
    tag: 'TAG: MURINA USA · SZ L',
    barcode: 'BARCODE: ||| |||| | ||||',
    measurements: 'P2P: 22.0" // LEN: 29.5"',
    desc: 'Double-sided iconic graphic, single-stitch sleeves and hem, buttery soft fade from decades of organic laundering.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBpMwMxh5Dfy-4OXiZB9iIedGEl9ZyTLWyayX6rhafm2EvBgYqGNmVvDcNqnRwoHWfLY2Yn5sfvNNoCG5JVgamSUfXtvPtoL1vXdOBFbJmfsktcjarJTA2aAcd19WCO4h08SyFQZAbFqQ5pTgAAOHVHD9-0vFr3SdHzveYB2ElCzQtFVvHmjqWbZZNQyaB4cIxXyQcxu_-oJYsZe9waOqqnBn1blc2eSnJIjMoLjQA',
  },
  {
    id: 'relic-7',
    lot: 'LOT #0947',
    category: 'jackets',
    badge: '✦ ARCHIVAL WORKWEAR',
    title: 'Carhartt Santa Fe Aztec Bomber',
    price: 8499,
    year: 'YEAR: 1995 // SOUTHWEST SPEC',
    tag: 'TAG: CARHARTT USA · SZ L',
    barcode: 'BARCODE: |||||| | || |||',
    measurements: 'P2P: 24.5" // LEN: 26.0"',
    desc: 'Southwestern Aztec tribal embroidered chest yoke, washed black canvas shell, quilted flannel lining, heavy brass zipper.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBbWY5CSBqGNa1_V84jabwfttFSQ1kXVhBKo4mXsjv4f0CscflnC8Z-BzkyWwSuOV6Gd5KHUYUHaxNlQ1JjcyxHU7DH_2JMMDAUBRUIgF4xYHYLhRDZ-oirM1aMMfGWN7kZpmL79OYDDc2qeQ32OHyuhpouUe2YQVAgxzTq7-6TyfTMlOAtKDJFKacXjj8-4wBKsy9tyvH338foHwtQYHdUS-yCHfPdifWT_gbtEbA',
  },
  {
    id: 'relic-8',
    lot: 'LOT #0948',
    category: 'denim',
    badge: '✦ DEADSTOCK DENIM',
    title: 'Wrangler 13MWZ Broken Twill',
    price: 3999,
    year: 'YEAR: 1989 // GREENSBORO NC',
    tag: 'TAG: WRANGLER USA · W34 L32',
    barcode: 'BARCODE: || ||||||| | ||',
    measurements: 'WAIST: 34" // INSEAM: 32"',
    desc: 'Heavyweight 14.75oz broken-twill rigid denim. High-rise cowboy cut with copper rivets and signature rope-stitched W back pockets.',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAseL68k-RIYRD2tIUdnbC6J2E5Ua3eeAhzwTcimF0kdtZznOrnNyenJ-FgDgTNj7F2sA3x3wd9fKr8e92QfOpd8ddfBu_jZMpKXfLyTdwGU2b0bW1Pw34a97OOBGP5MVftn4kZ8388kHmDOY-Sd7-ys9L5RkI3kS0zkfeITZ9Z3-vKV4UhUWj5UfcM9f5Wiqom61VtHjJgDMsSfmZH6YoU7Eq1vZe89Bl7Z5wrQjM',
  },
]

// Default Store & Marketing Configurations
const DEFAULT_BANNER = {
  enabled: true,
  tag: 'FLASH ARCHIVE NOTICE',
  text: '⚡ MONSOON CURATION DROP #04 LIVE — FLAT 15% OFF ORDERS OVER ₹4,000 WITH CODE "SATURN15"',
  ctaText: 'REDEEM OFFER',
  ctaLink: '#vault-drop',
  bgColor: '#242328',
  textColor: '#fff8f3',
}

const DEFAULT_OFFERS = [
  {
    code: 'SATURN15',
    type: 'percent',
    value: 15,
    minSpend: 4000,
    description: '15% Off on orders above ₹4,000',
    active: true,
  },
  {
    code: 'FIRSTDROP',
    type: 'flat',
    value: 500,
    minSpend: 3000,
    description: 'Flat ₹500 Off for first-time collectors',
    active: true,
  },
  {
    code: 'BHOPALVINTAGE',
    type: 'percent',
    value: 20,
    minSpend: 5000,
    description: 'Special 20% Off for MP & Bhopal collectors',
    active: true,
  },
]

const DEFAULT_STORE_SETTINGS = {
  storeName: 'SATURN.THRIFTTT',
  upiVpa: 'saturn.thrift@okhdfcbank',
  codTokenPercent: 30,
  whatsappNumber: '+91 98765 43210',
  storeLocation: 'Arera Colony, Bhopal, MP 462016',
  supportEmail: 'curator@saturnthrift.in',
  instagramHandle: '@saturn.thrifttt',
}


export default function App() {
  // Website Theme State (Persisted in localStorage: cream | cosmic | tokyo)
  const [activeTheme, setActiveTheme] = useState(() => {
    try {
      return localStorage.getItem('saturn_website_theme') || 'cream'
    } catch {
      return 'cream'
    }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme)
    try {
      localStorage.setItem('saturn_website_theme', activeTheme)
    } catch {}
  }, [activeTheme])

  const handleCycleTheme = () => {
    setActiveTheme((prev) => {
      if (prev === 'cream') return 'cosmic'
      if (prev === 'cosmic') return 'tokyo'
      return 'cream'
    })
  }

  // Canvas & Frame scrubbing refs
  const canvasRef = useRef(null)
  const heroTrackRef = useRef(null)
  const imagesRef = useRef([])
  const loadedFlagsRef = useRef(new Uint8Array(TOTAL_FRAMES))
  const targetFrameRef = useRef(0)
  const currentFrameRef = useRef(0)
  const animationFrameIdRef = useRef(null)

  // State
  const [activeFrameDisplay, setActiveFrameDisplay] = useState(1)
  const [heroScrollFraction, setHeroScrollFraction] = useState(0)
  const [savedCount, setSavedCount] = useState(80)
  const [isSavedActive, setIsSavedActive] = useState(false)

  // Curator State & Store Telemetry (Persisted in localStorage)
  const [relics, setRelics] = useState(() => {
    try {
      const saved = localStorage.getItem('saturn_vault_relics')
      return saved ? JSON.parse(saved) : INITIAL_RELICS
    } catch {
      return INITIAL_RELICS
    }
  })

  const handleUpdateRelics = (newRelics) => {
    setRelics(newRelics)
    localStorage.setItem('saturn_vault_relics', JSON.stringify(newRelics))
    syncAllRelicsToRemote(newRelics)
  }

  const [announcementBanner, setAnnouncementBanner] = useState(() => {
    try {
      const saved = localStorage.getItem('saturn_announcement_banner')
      return saved ? JSON.parse(saved) : DEFAULT_BANNER
    } catch {
      return DEFAULT_BANNER
    }
  })

  const handleUpdateBanner = (banner) => {
    setAnnouncementBanner(banner)
    localStorage.setItem('saturn_announcement_banner', JSON.stringify(banner))
    saveRemoteConfig('announcement_banner', banner)
  }

  const [activeOffers, setActiveOffers] = useState(() => {
    try {
      const saved = localStorage.getItem('saturn_store_offers')
      return saved ? JSON.parse(saved) : DEFAULT_OFFERS
    } catch {
      return DEFAULT_OFFERS
    }
  })

  const handleUpdateOffers = (offers) => {
    setActiveOffers(offers)
    localStorage.setItem('saturn_store_offers', JSON.stringify(offers))
    saveRemoteConfig('store_offers', offers)
  }

  const [storeSettings, setStoreSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('saturn_store_settings')
      return saved ? JSON.parse(saved) : DEFAULT_STORE_SETTINGS
    } catch {
      return DEFAULT_STORE_SETTINGS
    }
  })

  const handleUpdateSettings = (settings) => {
    setStoreSettings(settings)
    localStorage.setItem('saturn_store_settings', JSON.stringify(settings))
    saveRemoteConfig('store_settings', settings)
  }

  const [allOrders, setAllOrders] = useState(() => {
    try {
      const saved = localStorage.getItem('saturn_all_orders')
      return saved
        ? JSON.parse(saved)
        : [
            {
              id: 'SAT-94101',
              date: '2026-10-28 16:45',
              shipping: {
                fullName: 'Aarav Sharma',
                phone: '+91 98260 12345',
                street: 'B-12, Shahpura Sector B',
                city: 'Bhopal',
                state: 'Madhya Pradesh',
                pincode: '462016',
              },
              items: [
                { id: 'relic-1', lot: 'LOT #0941', title: 'Pink Floyd The Division Bell Tee', price: 4999 },
              ],
              subtotal: 4999,
              discount: 749,
              couponCode: 'SATURN15',
              total: 4250,
              paymentRail: 'Cash on Delivery (COD) · 30% Token Paid',
              codTokenAmount: 1275,
              codBalanceAmount: 2975,
              utrNumber: '982736152431',
              status: 'Kraft Tube Packaging',
            },
            {
              id: 'SAT-94100',
              date: '2026-10-27 11:20',
              shipping: {
                fullName: 'Priya Verma',
                phone: '+91 94250 88765',
                street: 'Flat 402, Signature Towers, Arera Colony',
                city: 'Bhopal',
                state: 'Madhya Pradesh',
                pincode: '462016',
              },
              items: [
                { id: 'relic-2', lot: 'LOT #0942', title: 'Carhartt Detroit Blanket-Lined Jacket', price: 7999 },
              ],
              subtotal: 7999,
              discount: 500,
              couponCode: 'FIRSTDROP',
              total: 7499,
              paymentRail: 'Instant Sovereign UPI (Full Payment)',
              utrNumber: 'UPI/329482710492',
              status: 'Dispatched via Air-Freight',
            },
          ]
    } catch {
      return []
    }
  })

  const handleUpdateOrders = (orders) => {
    setAllOrders(orders)
    localStorage.setItem('saturn_all_orders', JSON.stringify(orders))
  }

  const [isAdminOpen, setIsAdminOpen] = useState(false)

  // Secret Logo & Copyright triple-click counter to open Curator Desk
  const logoClicksRef = useRef(0)
  const logoClickTimerRef = useRef(null)

  const handleSecretCuratorTrigger = (e) => {
    // If holding Alt or Ctrl/Cmd when clicking logo, opens immediately
    if (e.altKey || e.ctrlKey || e.metaKey) {
      e.preventDefault()
      setIsAdminOpen(true)
      return
    }

    logoClicksRef.current += 1
    if (logoClicksRef.current >= 3) {
      e.preventDefault()
      setIsAdminOpen(true)
      logoClicksRef.current = 0
      if (logoClickTimerRef.current) clearTimeout(logoClickTimerRef.current)
    } else {
      if (logoClickTimerRef.current) clearTimeout(logoClickTimerRef.current)
      logoClickTimerRef.current = setTimeout(() => {
        logoClicksRef.current = 0
      }, 1200)
    }
  }

  // Keyboard shortcut listener: Ctrl + Shift + A and URL query param (?admin=1 or ?curator=true)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('admin') === '1' || urlParams.get('curator') === 'true') {
      setIsAdminOpen(true)
    }

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault()
        setIsAdminOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Realtime Cloud Sync & Instant Telemetry (Supabase)
  useEffect(() => {
    if (!isSupabaseConfigured) return

    // 1. Initial Load & Seed Relics
    fetchRemoteRelics().then((remoteRelics) => {
      if (remoteRelics && remoteRelics.length > 0) {
        setRelics(remoteRelics)
        localStorage.setItem('saturn_vault_relics', JSON.stringify(remoteRelics))
      } else if (remoteRelics && remoteRelics.length === 0) {
        syncAllRelicsToRemote(relics)
      }
    })

    // 2. Initial Load Orders
    fetchRemoteOrders().then((remoteOrders) => {
      if (remoteOrders && remoteOrders.length > 0) {
        setAllOrders(remoteOrders)
        localStorage.setItem('saturn_all_orders', JSON.stringify(remoteOrders))
      }
    })

    // 3. Initial Load Config (Banner, Offers, Settings)
    fetchRemoteConfig('announcement_banner').then((remoteBanner) => {
      if (remoteBanner) {
        setAnnouncementBanner(remoteBanner)
        localStorage.setItem('saturn_announcement_banner', JSON.stringify(remoteBanner))
      }
    })
    fetchRemoteConfig('store_offers').then((remoteOffers) => {
      if (remoteOffers) {
        setActiveOffers(remoteOffers)
        localStorage.setItem('saturn_store_offers', JSON.stringify(remoteOffers))
      }
    })
    fetchRemoteConfig('store_settings').then((remoteSettings) => {
      if (remoteSettings) {
        setStoreSettings(remoteSettings)
        localStorage.setItem('saturn_store_settings', JSON.stringify(remoteSettings))
      }
    })

    // 4. Realtime Subscription: Relics (Instant Stock & Catalog Updates)
    const unsubRelics = subscribeToRelics((payload) => {
      if (payload.eventType === 'UPDATE') {
        const u = payload.new
        setRelics((prev) =>
          prev.map((r) =>
            r.id === u.id
              ? {
                  ...r,
                  lot: u.lot,
                  category: u.category,
                  badge: u.badge,
                  title: u.title,
                  price: Number(u.price),
                  year: u.year,
                  tag: u.tag,
                  barcode: u.barcode,
                  measurements: u.measurements,
                  desc: u.desc,
                  img: u.img,
                  isSold: Boolean(u.is_sold),
                }
              : r
          )
        )
      } else if (payload.eventType === 'INSERT') {
        const n = payload.new
        const item = {
          id: n.id,
          lot: n.lot,
          category: n.category,
          badge: n.badge,
          title: n.title,
          price: Number(n.price),
          year: n.year,
          tag: n.tag,
          barcode: n.barcode,
          measurements: n.measurements,
          desc: n.desc,
          img: n.img,
          isSold: Boolean(n.is_sold),
        }
        setRelics((prev) => (prev.some((r) => r.id === item.id) ? prev : [item, ...prev]))
      } else if (payload.eventType === 'DELETE') {
        const delId = payload.old?.id
        if (delId) {
          setRelics((prev) => prev.filter((r) => r.id !== delId))
        }
      }
    })

    // 5. Realtime Subscription: Orders (Instant Curator Alerts)
    const unsubOrders = subscribeToOrders((payload) => {
      if (payload.eventType === 'INSERT') {
        const o = payload.new
        const newOrder = {
          id: o.id,
          date: o.date,
          shipping: o.shipping,
          items: o.items,
          subtotal: Number(o.subtotal),
          discount: Number(o.discount || 0),
          couponCode: o.coupon_code,
          total: Number(o.total),
          paymentRail: o.payment_rail,
          codTokenAmount: Number(o.cod_token_amount || 0),
          codBalanceAmount: Number(o.cod_balance_amount || 0),
          utrNumber: o.utr_number,
          status: o.status,
        }
        setAllOrders((prev) => (prev.some((ord) => ord.id === newOrder.id) ? prev : [newOrder, ...prev]))
      } else if (payload.eventType === 'UPDATE') {
        setAllOrders((prev) =>
          prev.map((ord) => (ord.id === payload.new.id ? { ...ord, status: payload.new.status } : ord))
        )
      }
    })

    // 6. Realtime Subscription: Store Config (Instant Flash Banner & Promos)
    const unsubConfig = subscribeToStoreConfig((payload) => {
      const { key, value } = payload.new || {}
      if (key === 'announcement_banner' && value) {
        setAnnouncementBanner(value)
        localStorage.setItem('saturn_announcement_banner', JSON.stringify(value))
      } else if (key === 'store_offers' && value) {
        setActiveOffers(value)
        localStorage.setItem('saturn_store_offers', JSON.stringify(value))
      } else if (key === 'store_settings' && value) {
        setStoreSettings(value)
        localStorage.setItem('saturn_store_settings', JSON.stringify(value))
      }
    })

    return () => {
      unsubRelics()
      unsubOrders()
      unsubConfig()
    }
  }, [])


  // Category Filter & 3D Hanger State
  const [activeCategory, setActiveCategory] = useState('all')

  // Cart
  const [cart, setCart] = useState([
    INITIAL_RELICS[0],
    INITIAL_RELICS[1],
  ])
  const [isCartOpen, setIsCartOpen] = useState(false)

  // User Authentication State (persisted in localStorage)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('saturn_auth_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)

  const handleLogin = (user) => {
    setCurrentUser(user)
    localStorage.setItem('saturn_auth_user', JSON.stringify(user))
  }

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('saturn_auth_user')
  }

  const handleOrderComplete = (order) => {
    // 1. Mark purchased relics as SOLD OUT immediately for all collectors
    const purchasedIds = new Set((order.items || []).map((i) => i.id))
    const updatedRelics = relics.map((r) => (purchasedIds.has(r.id) ? { ...r, isSold: true } : r))
    handleUpdateRelics(updatedRelics)

    // Clear cart stack upon confirmed vault acquisition
    setCart([])

    // Log to Curator Central telemetry
    const newOrderRecord = {
      id: order.id,
      date: order.date || new Date().toLocaleString('en-IN'),
      shipping: order.shipping || {
        fullName: currentUser?.name || 'Walk-in Collector',
        phone: currentUser?.phone || '+91 98765 43210',
        street: 'Arera Colony',
        city: 'Bhopal',
        state: 'Madhya Pradesh',
        pincode: '462016',
      },
      items: order.items || [],
      subtotal: order.subtotal || order.total,
      discount: order.discount || 0,
      couponCode: order.couponCode || 'NONE',
      total: order.total,
      paymentRail: order.paymentRail || (order.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Instant UPI'),
      codTokenAmount: order.codTokenAmount || 0,
      codBalanceAmount: order.codBalanceAmount || 0,
      utrNumber: order.utrNumber || 'N/A',
      status: 'Processing // Authentication',
    }
    const updatedOrders = [newOrderRecord, ...allOrders]
    setAllOrders(updatedOrders)
    localStorage.setItem('saturn_all_orders', JSON.stringify(updatedOrders))
    insertRemoteOrder(newOrderRecord)

    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        orders: [
          {
            id: order.id,
            date: order.date,
            lot: order.items.map((i) => i.lot).join(', '),
            item: order.items.map((i) => i.title).join(' + '),
            price: order.total,
            status: order.status || 'Processing // Authentication',
          },
          ...(currentUser.orders || []),
        ],
      }
      setCurrentUser(updatedUser)
      localStorage.setItem('saturn_auth_user', JSON.stringify(updatedUser))
    }
  }

  // 2-3 Recent Drops for Frame 325 Delivery Truck Unboxing
  const recentDrops = [
    {
      ...(relics[0] || INITIAL_RELICS[0]),
      boxNumber: 'BOX #01',
      unboxedOrigin: 'TOKYO AIR-FREIGHT',
    },
    {
      ...(relics[1] || INITIAL_RELICS[1]),
      boxNumber: 'BOX #02',
      unboxedOrigin: 'DETROIT CARGO',
    },
    {
      ...(relics[2] || INITIAL_RELICS[2]),
      boxNumber: 'BOX #03',
      unboxedOrigin: 'VALENCIA ARCHIVE',
    },
  ]

  // Direct smooth scroll jump to New Arrivals unboxed state (Frame 366+)
  const scrollToNewArrivals = () => {
    const heroTrack = heroTrackRef.current
    if (!heroTrack) return
    const scrollableDistance = heroTrack.offsetHeight - window.innerHeight
    // Target fraction 0.865: sequence frame ~381 where boxes have landed and content is fully revealed
    const targetScrollY = 0.865 * scrollableDistance
    window.scrollTo({
      top: targetScrollY,
      behavior: 'smooth',
    })
  }




  // Draw a specific frame to canvas
  const drawFrame = useCallback((frameIndex) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let targetIndex = Math.round(frameIndex)
    targetIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, targetIndex))

    let img = imagesRef.current[targetIndex]
    if (!img || !img.complete || img.naturalWidth === 0) {
      for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
        const prev = targetIndex - offset
        if (prev >= 0 && loadedFlagsRef.current[prev]) {
          img = imagesRef.current[prev]
          break
        }
        const next = targetIndex + offset
        if (next < TOTAL_FRAMES && loadedFlagsRef.current[next]) {
          img = imagesRef.current[next]
          break
        }
      }
    }

    if (!img || !img.complete || img.naturalWidth === 0) return

    const cw = canvas.width
    const ch = canvas.height
    const iw = img.naturalWidth
    const ih = img.naturalHeight

    const scale = Math.max(cw / iw, ch / ih)
    const nw = iw * scale
    const nh = ih * scale
    const nx = (cw - nw) / 2
    const ny = (ch - nh) / 2

    ctx.drawImage(img, 0, 0, iw, ih, nx, ny, nw, nh)
  }, [])

  // Resize canvas
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = window.innerWidth
    const height = window.innerHeight

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    }

    drawFrame(currentFrameRef.current)
  }, [drawFrame])

  // Preload frames
  useEffect(() => {
    imagesRef.current = new Array(TOTAL_FRAMES)
    loadedFlagsRef.current = new Uint8Array(TOTAL_FRAMES)

    // Priority 1: Frame 1
    const firstImg = new Image()
    firstImg.src = getFrameUrl(0)
    firstImg.onload = () => {
      imagesRef.current[0] = firstImg
      loadedFlagsRef.current[0] = 1
      resizeCanvas()
      drawFrame(0)

      // Priority 2: Preload remaining frames
      for (let i = 1; i < TOTAL_FRAMES; i++) {
        const img = new Image()
        img.src = getFrameUrl(i)
        img.onload = () => {
          imagesRef.current[i] = img
          loadedFlagsRef.current[i] = 1
        }
      }
    }

    window.addEventListener('resize', resizeCanvas)
    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [resizeCanvas, drawFrame])

  // Handle scroll relative to the hero section track
  // Handle scroll relative to the hero section track (instant start from scrollY = 0)
  useEffect(() => {
    const handleScroll = () => {
      const heroTrack = heroTrackRef.current
      if (!heroTrack) return

      const scrollableDistance = heroTrack.offsetHeight - window.innerHeight
      if (scrollableDistance <= 0) return

      // Instant start: every pixel scrolled immediately scrubs the animation without dead zone
      const scrolled = window.scrollY
      const progress = Math.min(1, Math.max(0, scrolled / scrollableDistance))

      setHeroScrollFraction(progress)
      targetFrameRef.current = progress * (TOTAL_FRAMES - 1)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Smooth scrubbing animation loop (LERP) - only runs during active motion
  useEffect(() => {
    let lastRenderedFrame = -1
    let isRunning = false

    const renderLoop = () => {
      const current = currentFrameRef.current
      const target = targetFrameRef.current

      const diff = target - current
      if (Math.abs(diff) > 0.005) {
        currentFrameRef.current = current + diff * 0.28
      } else {
        currentFrameRef.current = target
      }

      const frameToDraw = Math.round(currentFrameRef.current)
      if (frameToDraw !== lastRenderedFrame) {
        drawFrame(frameToDraw)
        lastRenderedFrame = frameToDraw
        setActiveFrameDisplay(frameToDraw + 1)
      }

      if (Math.abs(target - currentFrameRef.current) > 0.01) {
        animationFrameIdRef.current = requestAnimationFrame(renderLoop)
      } else {
        isRunning = false
        animationFrameIdRef.current = null
      }
    }

    const triggerLoop = () => {
      if (!isRunning) {
        isRunning = true
        animationFrameIdRef.current = requestAnimationFrame(renderLoop)
      }
    }

    window.addEventListener('scroll', triggerLoop, { passive: true })
    triggerLoop() // Initial render check

    return () => {
      window.removeEventListener('scroll', triggerLoop)
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }
    }
  }, [drawFrame])


  // Quick claim relic
  const handleClaimRelic = (relic) => {
    if (!cart.some((item) => item.id === relic.id)) {
      setCart((prev) => [...prev, relic])
    }
    setIsCartOpen(true)
  }

  const handleRemoveFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id))
  }

  const cartTotal = cart.reduce((acc, curr) => acc + curr.price, 0)



  const filteredRelics = activeCategory === 'all'
    ? relics
    : relics.filter((relic) => relic.category === activeCategory)

  // Cinematic scroll interpolation: Screen 1 exits, Screen 2 enters & holds, Screen 3 (New Arrivals at Frame 325)
  const screen1Exit = Math.min(1, Math.max(0, heroScrollFraction / 0.18))

  // Screen 2 (Store Services & Concierge): Active from 0.18 to 0.52 (frames ~68 to ~200)
  let screen2Opacity = 0
  let screen2Y = 40
  let screen2Scale = 0.95
  let screen2Active = false

  if (heroScrollFraction >= 0.18 && heroScrollFraction <= 0.52) {
    screen2Active = true
    if (heroScrollFraction < 0.26) {
      const t = (heroScrollFraction - 0.18) / 0.08
      screen2Opacity = Math.max(0, Math.min(1, t))
      screen2Y = (1 - t) * 40
      screen2Scale = 0.95 + 0.05 * t
    } else if (heroScrollFraction <= 0.44) {
      screen2Opacity = 1
      screen2Y = 0
      screen2Scale = 1
    } else {
      const t = (heroScrollFraction - 0.44) / 0.08
      screen2Opacity = Math.max(0, 1 - t)
      screen2Y = -t * 40
      screen2Scale = 1 + 0.03 * t
    }
  }

  // Screen 3 (New Arrivals at Frame 366+):
  // In the updated frames2 folder, boxes drop from the truck between sequence frames 325 and 365 (~0.74 to 0.83).
  // At Frame 366+ (scrollFraction >= 0.83), the boxes have fully landed and settled on the floor.
  // The content enters and showcases the 3 unboxed recent drops!
  let screen3Opacity = 0
  let screen3Y = 35
  let screen3Scale = 0.96
  let screen3Active = false

  if (heroScrollFraction >= 0.83 && heroScrollFraction <= 0.97) {
    screen3Active = true
    if (heroScrollFraction < 0.865) {
      // Content enters gracefully right after the boxes have landed on the ground
      const t = (heroScrollFraction - 0.83) / 0.035
      screen3Opacity = Math.max(0, Math.min(1, t))
      screen3Y = (1 - t) * 35
      screen3Scale = 0.96 + 0.04 * t
    } else if (heroScrollFraction <= 0.935) {
      // Solid display hold while boxes are settled on the floor
      screen3Opacity = 1
      screen3Y = 0
      screen3Scale = 1
    } else {
      // Fade out transition into the marquee and store catalog
      const t = (heroScrollFraction - 0.935) / 0.035
      screen3Opacity = Math.max(0, 1 - t)
      screen3Y = -t * 30
      screen3Scale = 1 + 0.02 * t
    }
  }

  return (
    <div className="saturn-site">
      {/* ====================================================================
          DYNAMIC STORE ANNOUNCEMENT & ADVERTISEMENT STRIP
          ==================================================================== */}
      {announcementBanner?.enabled && (
        <div
          className="vault-announcement-strip"
          style={{
            backgroundColor: announcementBanner.bgColor || '#242328',
            color: announcementBanner.textColor || '#fff8f3',
          }}
        >
          <div className="announcement-content">
            <span className="announcement-tag">{announcementBanner.tag || 'CURATOR NOTICE'}</span>
            <span className="announcement-text">{announcementBanner.text}</span>
            {announcementBanner.ctaText && (
              <a href={announcementBanner.ctaLink || '#vault-drop'} className="announcement-link">
                {announcementBanner.ctaText} →
              </a>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          MINIMAL TRANSPARENT FIXED HEADER
          ==================================================================== */}
      <header className={`site-header transparent-header ${announcementBanner?.enabled ? 'has-announcement' : ''}`}>
        <div className="header-row">
          {/* Logo with Secret Curator Trigger (Triple Click or Alt+Click) */}
          <a
            href="#"
            className="brand-group"
            onClick={handleSecretCuratorTrigger}
            title="SATURN.THRIFTTT [Triple click for Curator Desk]"
          >
            <div className="brand-icon-box">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>auto_awesome</span>
            </div>
            <span className="brand-title">SATURN.THRIFTTT</span>
            <span className="brand-spec-chip">[SPEC. ARCHIVE]</span>
          </a>

          {/* Minimalist Centered Navigation */}
          <nav className="header-nav-minimal">
            <button
              type="button"
              className={`nav-item-minimal ${heroScrollFraction < 0.2 ? 'active' : ''}`}
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              title="Scroll to 3D Clothing Rack"
            >
              ✦ THE RACK
            </button>
            <button
              type="button"
              className={`nav-item-minimal ${heroScrollFraction >= 0.83 && heroScrollFraction <= 0.97 ? 'active' : ''}`}
              onClick={scrollToNewArrivals}
              title="Jump to New Arrivals Delivery Truck Unboxing (Frame 366)"
              style={{
                color: heroScrollFraction >= 0.83 && heroScrollFraction <= 0.97 ? 'var(--primary)' : 'inherit',
                fontWeight: 700,
              }}
            >
              ✦ NEW ARRIVALS
            </button>
            {HANGER_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`nav-item-minimal ${activeCategory === cat.id && heroScrollFraction >= 0.2 ? 'active' : ''}`}
                onClick={() => {
                  setActiveCategory(cat.id)
                  const el = document.getElementById('vault-drop')
                  if (el) el.scrollIntoView({ behavior: 'smooth' })
                }}
                title={`Filter by ${cat.name}`}
              >
                {cat.shortName.toUpperCase()}
              </button>
            ))}
          </nav>

          {/* Minimal Actions */}
          <div className="header-actions">
            <button
              type="button"
              className={`user-auth-pill ${currentUser ? 'logged-in' : ''}`}
              onClick={() => setIsAuthModalOpen(true)}
              title={currentUser ? `Collector: ${currentUser.name}` : 'Sign In / Collector Pass'}
              id="auth-toggle-btn"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {currentUser ? 'verified_user' : 'account_circle'}
              </span>
              <span>{currentUser ? currentUser.name.split(' ')[0] : 'SIGN IN'}</span>
            </button>

            {/* Real-time Theme Switcher Pill */}
            <button
              type="button"
              className="theme-toggle-pill"
              onClick={handleCycleTheme}
              title={`Active Theme: ${activeTheme.toUpperCase()} (Click to toggle: Cream → Cosmic → Tokyo)`}
              id="theme-toggle-btn"
            >
              <span className="material-symbols-outlined theme-icon" style={{ fontSize: 16 }}>
                {activeTheme === 'cream' ? 'wb_sunny' : activeTheme === 'cosmic' ? 'dark_mode' : 'contrast'}
              </span>
              <span className="theme-name">{activeTheme.toUpperCase()}</span>
            </button>

            <button
              type="button"
              className="action-pill"
              onClick={() => {
                setIsSavedActive(!isSavedActive)
                setSavedCount((c) => (isSavedActive ? c - 1 : c + 1))
              }}
              title="Saved Relics"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 16, color: isSavedActive ? 'var(--primary)' : 'inherit' }}
              >
                star
              </span>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                {String(savedCount).padStart(2, '0')}
              </span>
            </button>

            <button
              type="button"
              id="cart-toggle-btn"
              className="cart-pill"
              onClick={() => setIsCartOpen(true)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>shopping_bag</span>
              <span>CART ({cart.length}) · ₹{cartTotal.toLocaleString('en-IN')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ====================================================================
          HERO PAGE WITH SCROLLING ANIMATION ENGINE & BRAND RIBBON
          ==================================================================== */}
      <section className="hero-scroll-track" ref={heroTrackRef}>
        <div className="hero-sticky-viewport">
          {/* Canvas Engine */}
          <div className="hero-canvas-wrap">
            <canvas ref={canvasRef} className="hero-motion-canvas" />
            <div className="canvas-scrim-radial" />
            <div className="canvas-scrim-bottom" />
          </div>

          {/* Hero Interactive Stage: Left Editorial + Right 3D Cloth Hanger (Screen 1) */}
          <div
            className="hero-interactive-stage"
            style={{
              opacity: Math.max(0, 1 - screen1Exit * 1.25),
              transform: `translateY(-${screen1Exit * 36}px)`,
              pointerEvents: screen1Exit > 0.6 ? 'none' : 'auto',
              visibility: screen1Exit >= 1 ? 'hidden' : 'visible',
            }}
          >
            {/* Left: Hero Editorial Overlay - slides smoothly out to the left */}
            <div
              className="hero-content-overlay"
              style={{
                transform: `translateX(-${screen1Exit * 80}px)`,
                transition: 'transform 0.15s ease-out',
              }}
            >
              <div className="hero-stamp-badge">
                <span className="star-icon">✦</span>
                <span>GALACTIC THRIFT MANIFEST // ORBIT #04</span>
                <span className="star-icon">✦</span>
              </div>

              <h1 className="hero-heading">
                OUT OF THIS WORLD <span className="italic-accent">VINTAGE</span>
              </h1>

              <p className="hero-description">
                Every piece has orbited the earth for decades before landing in your wardrobe. Hand-selected single-stitch tees, sun-baked canvas, and archival grails.
              </p>

              <div className="hero-cta-group">
                <a href="#vault-drop" className="btn-primary-archive">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>rocket_launch</span>
                  <span>Explore Drop #04</span>
                </a>
                <button
                  type="button"
                  className="btn-secondary-archive"
                  onClick={() => setIsCartOpen(true)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>shopping_bag</span>
                  <span>View Bag ({cart.length})</span>
                </button>
              </div>
            </div>

            {/* Right: Interactive 3D Luxury Clothing Rack with In-Place Fade Disappearance */}
            <div
              className="hero-3d-rack-container"
              style={{
                opacity: Math.max(0, 1 - screen1Exit * 1.2),
                pointerEvents: screen1Exit > 0.4 ? 'none' : 'auto',
                visibility: screen1Exit >= 1 ? 'hidden' : 'visible',
              }}
            >
              <HeroClothingRack
                categories={HANGER_CATEGORIES}
                activeCategory={activeCategory}
                onSelectCategory={(cat) => {
                  setActiveCategory(cat.id)
                  const el = document.getElementById('vault-drop')
                  if (el) el.scrollIntoView({ behavior: 'smooth' })
                }}
                heroScrollFraction={heroScrollFraction}
              />
            </div>
          </div>

          {/* ================================================================
              SCREEN 2: SECOND HERO STORY STAGE (Scroll Story Scrubbed Section)
              ================================================================ */}
          <div
            className={`hero-second-screen-stage ${screen2Active && screen2Opacity > 0.5 ? 'active' : ''}`}
            style={{
              opacity: screen2Opacity,
              transform: `translate(-50%, -50%) translateY(${screen2Y}px) scale(${screen2Scale})`,
              pointerEvents: screen2Active && screen2Opacity > 0.5 ? 'auto' : 'none',
              visibility: screen2Opacity > 0.01 ? 'visible' : 'hidden',
            }}
          >
            <div className="second-screen-badge">
              <span className="pulse-beacon" />
              <span>✦ CUSTOMER SERVICES // HELP & COD ✦</span>
              <span className="star-icon">✦</span>
            </div>

            <h2 className="second-screen-heading">
              SERVICES & SUPPORT <br />
              <span className="italic-accent">WHATSAPP · INSTAGRAM · CASH ON DELIVERY</span>
            </h2>

            <p className="second-screen-desc">
              Have questions about sizing, fabric, or fit? Message us on WhatsApp or Instagram for quick help, live videos, and easy Cash on Delivery across India.
            </p>

            {/* 4 Store Service & Client Concierge Cards */}
            <div className="second-screen-telemetry-grid">
              {/* Service 1: WhatsApp Priority Desk */}
              <div className="second-screen-card">
                <span className="card-code-tag">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chat</span>
                  <span>DIRECT DESK // ACTIVE</span>
                </span>
                <span className="card-title">WhatsApp Priority Help</span>
                <span className="card-caption">
                  Chat directly with our styling team for live fit videos, pit-to-pit measurements, or instant holds.
                </span>
                <a
                  href="https://wa.me/919876543210?text=Hi%20Saturn.Thrifttt,%20I%20have%20an%20inquiry%20about%20a%20piece"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-action-link whatsapp-link"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                  </svg>
                  <span>+91 98765 43210 (Chat Now ↗)</span>
                </a>
              </div>

              {/* Service 2: Instagram Droplist */}
              <div className="second-screen-card">
                <span className="card-code-tag">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>photo_camera</span>
                  <span>DAILY RELEASES // IG DROPS</span>
                </span>
                <span className="card-title">Instagram Droplist</span>
                <span className="card-caption">
                  Follow for daily 8 PM story drops, 15-minute early access links, styling lookbooks, and community showcases.
                </span>
                <a
                  href="https://instagram.com/saturn.thrifttt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-action-link instagram-link"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  <span>@saturn.thrifttt (Follow ↗)</span>
                </a>
              </div>

              {/* Service 3: COD Protocol & Inspection */}
              <div className="second-screen-card">
                <span className="card-code-tag">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>local_shipping</span>
                  <span>PAYMENT PROTOCOL</span>
                </span>
                <span className="card-title">Cash On Delivery (COD)</span>
                <span className="card-caption">
                  Available pan-India with a 30% advance reservation token. Balance 70% payable upon doorstep delivery & inspection.
                </span>
                <div className="card-info-chip">
                  <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#16a34a' }}>check_circle</span>
                  <span>Doorstep Inspection Allowed</span>
                </div>
              </div>

              {/* Service 4: 24/7 Support & Quality Assurance */}
              <div className="second-screen-card">
                <span className="card-code-tag">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified</span>
                  <span>STORE SERVICES // 24/7 CARE</span>
                </span>
                <span className="card-title">Sizing & Express Care</span>
                <span className="card-caption">
                  0.5" measurement guarantee. Medical-grade solar ozone sterilization. 48-hour size exchange assistance via desk.
                </span>
                <div className="card-info-chip">
                  <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--primary)' }}>verified</span>
                  <span>100% Sanitized & Measured</span>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="second-screen-cta-row">
              <a href="#vault-drop" className="btn-primary-archive">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>inventory_2</span>
                <span>Inspect The Vault Drops</span>
              </a>
              <a
                href="https://wa.me/919876543210?text=Hi%20Saturn.Thrifttt,%20I%20have%20an%20inquiry%20about%20a%20piece"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary-archive"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chat</span>
                <span>Message Concierge</span>
              </a>
              <button
                type="button"
                className="btn-secondary-archive"
                onClick={() => setIsCartOpen(true)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>shopping_cart</span>
                <span>Open Cart (${cartTotal})</span>
              </button>
            </div>
          </div>

          {/* ================================================================
              SCREEN 3: NEW ARRIVALS (Frame 325 - Delivery Truck & Boxes)
              ================================================================ */}
          <div
            className={`hero-third-screen-stage ${screen3Active && screen3Opacity > 0.4 ? 'active' : ''}`}
            style={{
              opacity: screen3Opacity,
              transform: `translate(-50%, -50%) translateY(${screen3Y}px) scale(${screen3Scale})`,
              pointerEvents: screen3Active && screen3Opacity > 0.4 ? 'auto' : 'none',
              visibility: screen3Opacity > 0.01 ? 'visible' : 'hidden',
            }}
          >
            <div className="third-screen-badge">
              <span className="pulse-beacon" />
              <span>✦ EXPRESS FREIGHT UNBOXED // DROP #04 ✦</span>
              <span className="star-icon">✦</span>
            </div>

            <h2 className="third-screen-heading">
              NEW ARRIVALS
            </h2>

            <div className="third-screen-subheading">
              [ 3 ARCHIVAL RELICS JUST UNLOADED FROM EXPRESS FREIGHT ]
            </div>

            {/* 3 Recent Drops Showcase */}
            <div className="recent-drops-grid">
              {recentDrops.map((relic, idx) => {
                const inCart = cart.some((item) => item.id === relic.id)
                return (
                  <div key={relic.id || idx} className="recent-drop-card">
                    <div className="recent-drop-img-box">
                      <img src={relic.img} alt={relic.title} className="recent-drop-img" />
                      <div className="recent-drop-tag-chip">
                        {relic.boxNumber || `BOX #0${idx + 1}`}
                      </div>
                    </div>

                    <div className="recent-drop-info">
                      <div className="recent-drop-lot">{relic.lot} · {relic.unboxedOrigin || relic.category?.toUpperCase()}</div>
                      <div className="recent-drop-title" title={relic.title}>{relic.title}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--on-surface-variant)' }}>
                        {relic.measurements}
                      </div>
                    </div>

                    <div className="recent-drop-footer">
                      <div className="recent-drop-price">₹{relic.price.toLocaleString('en-IN')}</div>
                      <button
                        type="button"
                        className={`btn-quick-claim ${inCart ? 'claimed' : ''}`}
                        onClick={() => handleClaimRelic(relic)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                          {inCart ? 'done' : 'shopping_bag'}
                        </span>
                        <span>{inCart ? 'IN CART' : 'QUICK CLAIM'}</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* CTA Row */}
            <div className="third-screen-cta-row">
              <a href="#vault-drop" className="btn-primary-archive">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>inventory_2</span>
                <span>Inspect Entire Vault Catalog (40 Relics)</span>
              </a>
              <button
                type="button"
                className="btn-secondary-archive"
                onClick={() => setIsCartOpen(true)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>shopping_cart</span>
                <span>Open Cart (₹{cartTotal.toLocaleString('en-IN')})</span>
              </button>
            </div>
          </div>

          {/* Bottom HUD inside Sticky Hero */}
          <div className="hero-bottom-hud">
            {/* Scroll Cue Prompt */}
            <div
              className="scroll-cue-pill"
              style={{
                opacity: Math.max(0, 1 - heroScrollFraction * 12),
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_downward</span>
              <span>SCROLL TO ENTER ORBIT</span>
            </div>

          </div>
        </div>
      </section>

      {/* Marquee Ticker Transition into Catalog */}
      <div className="marquee-bar">
        <div className="marquee-content">
          <span>✦ DROP #04 VAULT PREVIEW ACTIVE</span>
          <span>✦ 100% HAND-AUTHENTICATED VINTAGE RELICS</span>
          <span>✦ ZERO FAST FASHION CIRCULAR SYSTEM</span>
          <span>✦ 1-OF-1 ARCHIVES SOURCED ACROSS TOKYO, DETROIT & MILAN</span>
          <span>✦ COMPLIMENTARY ORBIT TRADING CARD WITH EVERY GARMENT</span>
          <span>✦ DROP #04 VAULT PREVIEW ACTIVE</span>
          <span>✦ 100% HAND-AUTHENTICATED VINTAGE RELICS</span>
          <span>✦ ZERO FAST FASHION CIRCULAR SYSTEM</span>
        </div>
      </div>

      {/* ====================================================================
          STORE SECTION: NEW ARRIVALS & CATALOG
          ==================================================================== */}
      <section className="vault-section" id="vault-drop">
        <div className="section-container">
          {/* Reserved space for upcoming New Arrival scrolling animation */}
          <div className="new-arrivals-scroll-zone" id="new-arrivals-scroll-container">
            {/* Empty area reserved for new arrival scrolling animation */}
          </div>

          {/* Category Filter Pills synced with 3D Hanger */}
          <div className="vault-category-filter-row">
            <div className="vault-filter-pills">
              <button
                type="button"
                className={`vault-filter-pill ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => setActiveCategory('all')}
              >
                <span>ALL ARCHIVES</span>
                <span className="pill-count">{relics.length}</span>
              </button>
              {HANGER_CATEGORIES.map((cat) => {
                const count = relics.filter((r) => r.category === cat.id).length
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`vault-filter-pill ${activeCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setActiveCategory(activeCategory === cat.id ? 'all' : cat.id)}
                  >
                    <span>{cat.name.toUpperCase()}</span>
                    <span className="pill-count">{count}</span>
                  </button>
                )
              })}
            </div>

            {activeCategory !== 'all' && (
              <div className="vault-active-indicator">
                <span className="indicator-badge">
                  DEPT: {HANGER_CATEGORIES.find((c) => c.id === activeCategory)?.name.toUpperCase()} ({filteredRelics.length} RELICS)
                </span>
                <button
                  type="button"
                  className="vault-clear-filter-btn"
                  onClick={() => setActiveCategory('all')}
                >
                  <span>SHOW ALL</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                </button>
              </div>
            )}
          </div>

          {/* Relics Cards Grid */}
          <div className="relics-grid">
            {filteredRelics.map((relic) => {
              const inCart = cart.some((item) => item.id === relic.id)
              const isSold = Boolean(relic.isSold)
              return (
                <div key={relic.id} className={`relic-card ${isSold ? 'relic-is-sold' : ''}`}>
                  <div className="relic-sticker">{isSold ? '✦ ARCHIVED / SOLD' : relic.badge}</div>
                  <div className="relic-lot-chip">{relic.lot}</div>

                  <div className="relic-image-wrap">
                    <img src={relic.img} alt={relic.title} className="relic-image" />
                    <div className="relic-tag-watermark">{relic.tag}</div>
                    {isSold && (
                      <div className="relic-sold-overlay">
                        <span>SOLD OUT</span>
                      </div>
                    )}
                  </div>

                  <div className="relic-body">
                    <div>
                      <div className="relic-meta-row">
                        <span className="relic-year">{relic.year}</span>
                        <span className="relic-price">₹{relic.price.toLocaleString('en-IN')}</span>
                      </div>
                      <h3 className="relic-title">{relic.title}</h3>
                      <p className="relic-desc">{relic.desc}</p>
                    </div>

                    <div>
                      <div className="relic-barcode-row">
                        <span>{relic.barcode}</span>
                        <span>{relic.measurements}</span>
                      </div>

                      <button
                        type="button"
                        className={`btn-claim-relic ${isSold ? 'btn-disabled-sold' : ''}`}
                        onClick={() => !isSold && handleClaimRelic(relic)}
                        disabled={isSold}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          {isSold ? 'block' : inCart ? 'done' : 'shopping_cart'}
                        </span>
                        <span>{isSold ? 'RELIC SOLD OUT' : inCart ? 'CLAIMED IN CART' : 'QUICK CLAIM RELIC'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Vault Footer Capacity Indicator */}
          <div className="vault-footer-strip">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>token</span>
              <span>TOTAL DROP CAPACITY: 40 ITEMS // 12 REMAINING IN LIVE STACK</span>
            </div>
            <a href="#vault-drop" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}>
              [ VIEW COMPLETE DROP CATALOG #04 -&gt; ]
            </a>
          </div>
        </div>
      </section>



      {/* ====================================================================
          SECTION 6: COMMUNITY POLAROIDS
          ==================================================================== */}
      <section className="polaroids-section">
        <div className="section-container">
          <div className="section-header-row">
            <div>
              <span className="section-label">✦ ARCHIVE FIELD OBSERVATIONS ✦</span>
              <h2 className="section-title">Grail Sightings in the Wild</h2>
              <p className="section-subtitle">
                See how collectors across the world style authentic Saturn.thrifttt relics in daily rotation.
              </p>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>
              TAG @SATURN.THRIFTTT ON INSTAGRAM TO BE ARCHIVED
            </div>
          </div>

          <div className="polaroids-grid">
            {/* Polaroid 01 */}
            <div className="polaroid-card rot-left">
              <div className="polaroid-photo-frame">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuA7qeYbt8sET2G3KeiOnHrhYHcEBaUs2_M4UpvcVA6zvmqhYOiVHTexQPGYCmNKEvrmkgZKwSF68tOJGmoAdC15HnH2j2vFSg3Pb-2mLiWEpxPG1SwlsVHHyzsaZgWtw2Dos-sVmbIGQf0E2PBXkJKoevAedteJFfU0Wi1wMobtXmlJ6reyJ9K0YvhsSpRmx4RvIZCS4QSiEomvhfY301xKjmlJ3O664SBY04UaSRk"
                  alt="Collector in Tokyo wearing 1993 Nirvana In Utero"
                  className="polaroid-img"
                />
              </div>
              <div className="polaroid-meta">
                <div className="polaroid-user-row">
                  <span style={{ fontWeight: 700 }}>@kai.shibuya // TOKYO</span>
                  <span>ACQUIRED: DROP #02</span>
                </div>
                <p className="polaroid-quote">
                  "The natural drape on this Brockum shirt is insane. You cannot fake this kind of 30-year cotton fade. Arrived in Tokyo in 4 days with the coolest trading card."
                </p>
                <span className="polaroid-relic-tag" style={{ color: 'var(--primary)' }}>
                  RELIC: 1993 NIRVANA IN UTERO ORIGINAL
                </span>
              </div>
            </div>

            {/* Polaroid 02 */}
            <div className="polaroid-card rot-right">
              <div className="polaroid-photo-frame">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCjwzNraNggl4GnPqnAKIOLS7aTLcRFwi4lfXJcw4pZ4FTWby3-jPwApN0NTLoGgvNhtefoYg9tyEPtUXckpkFWUJzAONhAxIFf213T7UzSLxhn6t9QMYkvrtaBhCGlpm-pZQpLa5L0gqtEv5-d6tjgtFyNebb8YXDRZmddfBvvIaao3Zq3hQeO81njLxUgyvfDWz4neMkIMuPSBvJDsh0fAz7daTS5Pd9ieKs1beY"
                  alt="Collector in Brooklyn wearing Carhartt Detroit Jacket"
                  className="polaroid-img"
                />
              </div>
              <div className="polaroid-meta">
                <div className="polaroid-user-row">
                  <span style={{ fontWeight: 700 }}>@elena_raw // BROOKLYN</span>
                  <span>ACQUIRED: DROP #03</span>
                </div>
                <p className="polaroid-quote">
                  "Every single measurement was exact down to the half-inch. Finding true American duck canvas that actually fits boxy without looking sloppy is rare. Saturn is unmatched."
                </p>
                <span className="polaroid-relic-tag" style={{ color: 'var(--secondary)' }}>
                  RELIC: 1996 CARHARTT CHORE JKT (MADE IN USA)
                </span>
              </div>
            </div>

            {/* Polaroid 03 */}
            <div className="polaroid-card rot-tilt">
              <div className="polaroid-photo-frame">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAI4OkyBmrhi9LIjHJStgRI2WZSGH8xJzahvmVZXXXs3UlpRF2WRaax14112MSuyz0Bmrwj50UBsv-VXIWjBOeWhz9nc_9ClZKWnyOuG32x25Ug2RcClPSfJPboiOonF7wp-tBZdmOSUFFhtIGMyPMtxwpeC-S7OjHIuZUbr9sRhomXAFtcyrd0WTGsTgE5mJf4fx3F9OnA0Qx1Pkxd8PmyPRDuDY00FFRHKay53oo"
                  alt="Collector in Berlin wearing Stüssy Vest"
                  className="polaroid-img"
                />
              </div>
              <div className="polaroid-meta">
                <div className="polaroid-user-row">
                  <span style={{ fontWeight: 700 }}>@marcus.arc // BERLIN</span>
                  <span>ACQUIRED: DROP #01</span>
                </div>
                <p className="polaroid-quote">
                  "The condition was graded at 8.5/10 and it felt like it literally stepped out of 1996. The unboxing experience with the wax seal felt like receiving a physical artifact."
                </p>
                <span className="polaroid-relic-tag" style={{ color: 'var(--tertiary)' }}>
                  RELIC: 1995 STÜSSY JACQUARD CREW
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECTION 7: HISTORY DOESN'T RESTOCK
          ==================================================================== */}
      <section className="history-banner-section">
        <div className="history-banner-box">
          <span className="section-label" style={{ color: 'var(--on-primary-container)' }}>✦ READY TO HUNT? ✦</span>
          <h2 className="history-title">History Doesn't Restock.</h2>
          <p className="history-subtitle">
            When an archive relic is gone, it is gone forever. Step into Orbit and claim your piece of planetary culture.
          </p>
          <a href="#vault-drop" className="btn-history-explore">
            Explore Current Drop
          </a>
        </div>
      </section>

      {/* ====================================================================
          SECTION 8: ARCHIVAL FOOTER
          ==================================================================== */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-grid">
            {/* WhatsApp VIP Drop Community */}
            <div className="footer-community-box">
              <span className="section-label">✦ OFFICIAL WHATSAPP COMMUNITY ✦</span>
              <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                Join WhatsApp Drop Community
              </h3>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
                Get 15-minute early access links before drops, exclusive group discounts, piece holds, and unboxing videos directly on WhatsApp.
              </p>

              {/* Action Buttons */}
              <div className="community-btn-group">
                <a
                  href="https://chat.whatsapp.com/invite/saturn-thrifttt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp-community"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                  </svg>
                  <span>Join WhatsApp Community Group ↗</span>
                </a>
                <a
                  href="https://wa.me/919876543210?text=Hi%20Saturn.Thrifttt,%20I%20have%20an%20inquiry%20about%20a%20piece"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp-chat"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chat</span>
                  <span>Direct Concierge Chat (+91 98765 43210)</span>
                </a>
              </div>

              {/* Community Perks */}
              <div className="community-perks-row">
                <span className="community-perk-pill">⚡ 15-Min Early Links</span>
                <span className="community-perk-pill">🔒 Member Discounts</span>
                <span className="community-perk-pill">📦 Piece Holds</span>
              </div>

              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>
                Admins only post during weekly drops · Zero chat clutter or spam.
              </span>
            </div>

            {/* Directive Quote / Brand Story */}
            <div className="directive-card">
              <span className="section-label" style={{ color: 'var(--primary)' }}>✦ About Saturn.thrifttt ✦</span>
              <h4 style={{ fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>
                "Every vintage piece has a story — curated to last for decades."
              </h4>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
                We curate 100% genuine vintage clothing from across the globe. Each garment is hand-inspected, ozone-sanitized, and measured to 0.5" precision before dispatch.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tertiary)', fontWeight: 700 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>recycling</span>
                <span>100% CIRCULAR VINTAGE FASHION</span>
              </div>
            </div>

            {/* Links Columns */}
            <div className="footer-links-cols">
              <div>
                <h5 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>
                  Customer Care
                </h5>
                <ul className="footer-links-list">
                  <li><a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>WhatsApp Help</a></li>
                  <li>Cash on Delivery (COD)</li>
                  <li>Sizing & Fit Guide</li>
                  <li>Return & Exchange Policy</li>
                </ul>
              </div>

              <div>
                <h5 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>
                  Store Community
                </h5>
                <ul className="footer-links-list">
                  <li><a href="https://instagram.com/saturn.thrifttt" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>@saturn.thrifttt (Instagram)</a></li>
                  <li>Daily Story Droplist</li>
                  <li>Customer Lookbooks</li>
                  <li>Doorstep Verification</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Clean Store Bottom Bar with Secret Curator Trigger */}
          <div className="footer-telemetry-bottom">
            <span
              onClick={handleSecretCuratorTrigger}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              title="© 2026 SATURN.THRIFTTT (Triple-click for Curator Desk)"
            >
              © 2026 SATURN.THRIFTTT. ALL RIGHTS RESERVED.
            </span>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <span>PAN-INDIA FAST DELIVERY</span>
              <span>CASH ON DELIVERY AVAILABLE</span>
              <span>TERMS & PRIVACY</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ====================================================================
          CART DRAWER MODAL
          ==================================================================== */}
      {isCartOpen && (
        <div className="cart-drawer-backdrop" onClick={() => setIsCartOpen(false)}>
          <div
            className="cart-drawer-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cart-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined">shopping_bag</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>
                  Archival Stack ({cart.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="cart-drawer-list">
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'var(--font-mono)', color: 'var(--outline)' }}>
                  YOUR STACK IS EMPTY
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="cart-item-row">
                    <img src={item.img} alt={item.title} className="cart-item-thumb" />
                    <div className="cart-item-info">
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--secondary)' }}>
                          {item.lot}
                        </div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600 }}>
                          {item.title}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                          {item.tag}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 700, color: 'var(--tertiary)' }}>
                          ₹{item.price.toLocaleString('en-IN')}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--outline)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10 }}
                        >
                          [REMOVE]
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="cart-drawer-footer">
              <div className="cart-total-row">
                <span>TOTAL:</span>
                <span style={{ color: 'var(--tertiary)' }}>₹{cartTotal.toLocaleString('en-IN')}</span>
              </div>
              <button
                type="button"
                className="btn-checkout"
                id="btn-proceed-checkout"
                onClick={() => {
                  setIsCartOpen(false)
                  setIsCheckoutModalOpen(true)
                }}
                disabled={cart.length === 0}
              >
                Proceed to Vault Checkout
              </button>
              <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)' }}>
                100% POST-CONSUMER KRAFT TUBE PACKAGING INCLUDED
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collector Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      {/* Multi-Rail Vault Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        cart={cart}
        cartTotal={cartTotal}
        currentUser={currentUser}
        onOrderComplete={handleOrderComplete}
        storeSettings={storeSettings}
        activeOffers={activeOffers}
      />

      {/* Curator Command Center (Admin Dashboard) */}
      {isAdminOpen && (
        <Suspense fallback={null}>
          <AdminDashboardModal
            isOpen={isAdminOpen}
            onClose={() => setIsAdminOpen(false)}
            relics={relics}
            onUpdateRelics={handleUpdateRelics}
            announcementBanner={announcementBanner}
            onUpdateBanner={handleUpdateBanner}
            activeOffers={activeOffers}
            onUpdateOffers={handleUpdateOffers}
            storeSettings={storeSettings}
            onUpdateSettings={handleUpdateSettings}
            allOrders={allOrders}
            onUpdateOrders={handleUpdateOrders}
          />
        </Suspense>
      )}
    </div>
  )
}
