import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const FALLBACK_RELIC_IMG =
  "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='750' viewBox='0 0 600 750'%3E%3Crect width='100%25' height='100%25' fill='%231a1715'/%3E%3Cg fill='none' stroke='%233a342e' stroke-width='1.5'%3E%3Cpath d='M20 20h560v710H20z'/%3E%3Ccircle cx='300' cy='340' r='110' stroke='%235a4f43' stroke-dasharray='4 4'/%3E%3Cpath d='M250 340h100M300 290v100' stroke='%23a45a2a' stroke-width='2'/%3E%3C/g%3E%3Ctext x='300' y='500' font-family='monospace' font-size='16' fill='%23e0d8ce' text-anchor='middle' letter-spacing='3'%3ESATURN.THRIFTTT%3C/text%3E%3Ctext x='300' y='528' font-family='monospace' font-size='11' fill='%238c8275' text-anchor='middle' letter-spacing='2'%3E1-OF-1 ARCHIVAL RELIC%3C/text%3E%3C/svg%3E"

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

        const realParsed = parsedImages.filter((img) => img && !img.includes('AB6AXuBpMwMxh5Dfy') && !img.includes('lh3.googleusercontent.com'))
        if (realParsed.length > 0) {
          parsedImages = realParsed
        }

        const cover = (parsedImages.length > 0 && !parsedImages[0].includes('AB6AXuBpMwMxh5Dfy') && !parsedImages[0].includes('lh3.googleusercontent.com'))
          ? parsedImages[0]
          : (r.img && !r.img.includes('AB6AXuBpMwMxh5Dfy') && !r.img.includes('lh3.googleusercontent.com') ? r.img : (parsedImages[0] || FALLBACK_RELIC_IMG))

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
  if (!isSupabaseConfigured || !supabase || !r?.id) return { error: null }
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
    return { error }
  } catch (err) {
    console.error('[SUPABASE] Error syncing single relic:', err)
    return { error: err }
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

    // Upsert in safe batches of 3 to stay well within Supabase payload limits
    const CHUNK = 3
    for (let i = 0; i < dbRows.length; i += CHUNK) {
      const chunk = dbRows.slice(i, i + CHUNK)
      const { error } = await supabase.from('relics').upsert(chunk, { onConflict: 'id' })
      if (error) console.warn('[SUPABASE] Chunk upsert warning:', error.message)
    }
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
  if (!isSupabaseConfigured || !supabase) return { success: false, error: 'Supabase not configured' }
  try {
    const row = {
      id: order.id,
      date: order.date,
      shipping: {
        ...(typeof order.shipping === 'object' ? order.shipping : {}),
        deliveryFee: Number(order.deliveryFee || 0),
        isFreeDelivery: Boolean(order.isFreeDelivery),
      },
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

    const { data, error } = await supabase.from('orders').upsert(row, { onConflict: 'id' }).select()
    if (error) {
      console.error('[SUPABASE] Insert order error:', error.message)
      return { success: false, error: error.message }
    }
    console.log('[SUPABASE] Order synced to cloud database:', order.id)
    return { success: true, data }
  } catch (err) {
    console.error('[SUPABASE] Error saving order:', err)
    return { success: false, error: err.message }
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

