import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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
      .order('created_at', { ascending: true })

    if (error) {
      console.warn('[SUPABASE] Fetch relics error:', error.message)
      return null
    }

    if (data && data.length > 0) {
      // Map database schema to frontend relic format
      return data.map((r) => ({
        id: r.id,
        lot: r.lot,
        category: r.category,
        badge: r.badge,
        title: r.title,
        price: Number(r.price),
        year: r.year,
        tag: r.tag,
        barcode: r.barcode,
        measurements: r.measurements,
        desc: r.desc,
        img: r.img,
        isSold: Boolean(r.is_sold),
      }))
    }
    return []
  } catch (err) {
    console.warn('[SUPABASE] Relics fetch failed:', err)
    return null
  }
}

export async function syncAllRelicsToRemote(relics) {
  if (!isSupabaseConfigured || !supabase || !relics?.length) return
  try {
    const dbRows = relics.map((r) => ({
      id: r.id,
      lot: r.lot,
      category: r.category,
      badge: r.badge,
      title: r.title,
      price: Number(r.price),
      year: r.year,
      tag: r.tag,
      barcode: r.barcode,
      measurements: r.measurements,
      desc: r.desc,
      img: r.img,
      is_sold: Boolean(r.isSold),
    }))

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

