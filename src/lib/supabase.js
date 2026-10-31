import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const FALLBACK_RELIC_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBpMwMxh5Dfy-4OXiZB9iIedGEl9ZyTLWyayX6rhafm2EvBgYqGNmVvDcNqnRwoHWfLY2Yn5sfvNNoCG5JVgamSUfXtvPtoL1vXdOBFbJmfsktcjarJTA2aAcd19WCO4h08SyFQZAbFqQ5pTgAAOHVHD9-0vFr3SdHzveYB2ElCzQtFVvHmjqWbZZNQyaB4cIxXyQcxu_-oJYsZe9waOqqnBn1blc2eSnJIjMoLjQA'

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key')
)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null

/**
 * ------------------------------------------------------------------
 * REAL-TIME RELICS (INVENTORY)
 * ------------------------------------------------------------------
 */

export async function fetchRemoteRelics() {
  if (!isSupabaseConfigured || !supabase) return null
  try {
    const { data, error } = await supabase
      .from('relics')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('[SUPABASE] Fetch relics error:', error.message)
      return null
    }

    if (data && data.length > 0) {
      // Map database schema to frontend relic format with multi-image support
      return data.map((r) => {
        let cleanDesc = r.desc || ''
        let parsedImages = []
        const imagesMatch = cleanDesc.match(/<!--VAULT_IMAGES_JSON:(.*?)-->/)
        if (imagesMatch) {
          try {
            parsedImages = JSON.parse(imagesMatch[1])
            cleanDesc = cleanDesc.replace(/<!--VAULT_IMAGES_JSON:.*?-->/, '').trim()
          } catch {}
        }
        if (!parsedImages.length && r.img) {
          parsedImages = [r.img]
        }

        const realParsed = parsedImages.filter((img) => img && !img.includes('AB6AXuBpMwMxh5Dfy'))
        if (realParsed.length > 0) {
          parsedImages = realParsed
        }

        const cover = (parsedImages.length > 0 && !parsedImages[0].includes('AB6AXuBpMwMxh5Dfy'))
          ? parsedImages[0]
          : (r.img && !r.img.includes('AB6AXuBpMwMxh5Dfy') ? r.img : (parsedImages[0] || ''))

        return {
          id: r.id,
          lot: r.lot,
          category: r.category || 'tees',
          badge: r.badge || '✦ 1-OF-1 ONLY',
          title: r.title,
          price: Number(r.price),
          year: r.year,
          tag: r.tag,
          barcode: r.barcode,
          measurements: r.measurements,
          desc: cleanDesc,
          img: cover,
          images: parsedImages,
          isSold: Boolean(r.is_sold),
        }
      })
    }
    return []
  } catch (err) {
    console.warn('[SUPABASE] Relics fetch failed:', err)
    return null
  }
}

export async function syncSingleRelicToRemote(r) {
  if (!isSupabaseConfigured || !supabase || !r?.id) return
  try {
    const allImages = (Array.isArray(r.images) && r.images.length > 0
      ? r.images
      : (r.img ? [r.img] : [])
    ).filter((img) => img && !img.includes('AB6AXuBpMwMxh5Dfy'))

    const primaryImg = allImages[0] || (r.img && !r.img.includes('AB6AXuBpMwMxh5Dfy') ? r.img : '')
    let serializedDesc = (r.desc || '').replace(/<!--VAULT_IMAGES_JSON:.*?-->/g, '').trim()
    if (allImages.length > 1) {
      serializedDesc += '\n<!--VAULT_IMAGES_JSON:' + JSON.stringify(allImages) + '-->'
    }

    const row = {
      id: r.id,
      lot: r.lot,
      category: r.category || 'tees',
      badge: r.badge || '✦ 1-OF-1 ONLY',
      title: r.title,
      price: Number(r.price),
      year: r.year,
      tag: r.tag,
      barcode: r.barcode,
      measurements: r.measurements,
      desc: serializedDesc,
      img: primaryImg,
      is_sold: Boolean(r.isSold),
    }

    const { error } = await supabase.from('relics').upsert([row], { onConflict: 'id' })
    if (error) console.error('[SUPABASE] Upsert single relic error:', error.message)
  } catch (err) {
    console.error('[SUPABASE] Error syncing single relic:', err)
  }
}

export async function syncAllRelicsToRemote(relics) {
  if (!isSupabaseConfigured || !supabase || !relics?.length) return
  try {
    const dbRows = relics.map((r) => {
      const allImages = (Array.isArray(r.images) && r.images.length > 0
        ? r.images
        : (r.img ? [r.img] : [])
      ).filter((img) => img && !img.includes('AB6AXuBpMwMxh5Dfy'))

      const primaryImg = allImages[0] || (r.img && !r.img.includes('AB6AXuBpMwMxh5Dfy') ? r.img : '')
      let serializedDesc = (r.desc || '').replace(/<!--VAULT_IMAGES_JSON:.*?-->/g, '').trim()
      if (allImages.length > 1) {
        serializedDesc += '\n<!--VAULT_IMAGES_JSON:' + JSON.stringify(allImages) + '-->'
      }

      return {
        id: r.id,
        lot: r.lot,
        category: r.category || 'tees',
        badge: r.badge || '✦ 1-OF-1 ONLY',
        title: r.title,
        price: Number(r.price),
        year: r.year,
        tag: r.tag,
        barcode: r.barcode,
        measurements: r.measurements,
        desc: serializedDesc,
        img: primaryImg,
        is_sold: Boolean(r.isSold),
      }
    })

    const { error } = await supabase.from('relics').upsert(dbRows, { onConflict: 'id' })
    if (error) console.error('[SUPABASE] Upsert relics error:', error.message)
  } catch (err) {
    console.error('[SUPABASE] Error syncing relics:', err)
  }
}

export async function updateRemoteRelicSoldStatus(id, isSold) {
  if (!isSupabaseConfigured || !supabase) return
  try {
    const { error } = await supabase
      .from('relics')
      .update({ is_sold: isSold })
      .eq('id', id)
    if (error) console.error('[SUPABASE] Update is_sold error:', error.message)
  } catch (err) {
    console.error('[SUPABASE] Error updating relic status:', err)
  }
}

export async function deleteRemoteRelic(id) {
  if (!isSupabaseConfigured || !supabase) return
  try {
    const { error } = await supabase.from('relics').delete().eq('id', id)
    if (error) console.error('[SUPABASE] Delete relic error:', error.message)
  } catch (err) {
    console.error('[SUPABASE] Error deleting relic:', err)
  }
}

export function subscribeToRelics(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {}

  const channel = supabase
    .channel('realtime:relics')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'relics' },
      (payload) => {
        onChange(payload)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * ------------------------------------------------------------------
 * REAL-TIME ORDERS
 * ------------------------------------------------------------------
 */

export async function fetchRemoteOrders() {
  if (!isSupabaseConfigured || !supabase) return null
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('[SUPABASE] Fetch orders error:', error.message)
      return null
    }

    if (data && data.length > 0) {
      return data.map((o) => ({
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
      }))
    }
    return []
  } catch (err) {
    console.warn('[SUPABASE] Orders fetch failed:', err)
    return null
  }
}

export async function insertRemoteOrder(order) {
  if (!isSupabaseConfigured || !supabase) return
  try {
    const row = {
      id: order.id,
      date: order.date,
      shipping: order.shipping,
      items: order.items,
      subtotal: Number(order.subtotal || order.total),
      discount: Number(order.discount || 0),
      coupon_code: order.couponCode || 'NONE',
      total: Number(order.total),
      payment_rail: order.paymentRail,
      cod_token_amount: Number(order.codTokenAmount || 0),
      cod_balance_amount: Number(order.codBalanceAmount || 0),
      utr_number: order.utrNumber || 'N/A',
      status: order.status || 'Processing // Authentication',
    }

    const { error } = await supabase.from('orders').upsert(row, { onConflict: 'id' })
    if (error) console.error('[SUPABASE] Insert order error:', error.message)
  } catch (err) {
    console.error('[SUPABASE] Error saving order:', err)
  }
}

export function subscribeToOrders(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {}

  const channel = supabase
    .channel('realtime:orders')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      (payload) => {
        onChange(payload)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * ------------------------------------------------------------------
 * REAL-TIME STORE CONFIG (Banner, Offers, Settings)
 * ------------------------------------------------------------------
 */

export async function fetchRemoteConfig(key) {
  if (!isSupabaseConfigured || !supabase) return null
  try {
    const { data, error } = await supabase
      .from('store_config')
      .select('value')
      .eq('key', key)
      .maybeSingle()

    if (error) return null
    return data?.value || null
  } catch {
    return null
  }
}

export async function saveRemoteConfig(key, value) {
  if (!isSupabaseConfigured || !supabase) return
  try {
    const { error } = await supabase
      .from('store_config')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) console.error(`[SUPABASE] Save config ${key} error:`, error.message)
  } catch (err) {
    console.error(`[SUPABASE] Error saving config ${key}:`, err)
  }
}

export function subscribeToStoreConfig(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {}

  const channel = supabase
    .channel('realtime:store_config')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'store_config' },
      (payload) => {
        onChange(payload)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

