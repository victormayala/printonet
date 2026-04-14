const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// SanMar uses a REST/JSON API for product data
const SANMAR_API_BASE = 'https://ws.sanmar.com/promostandards/rest'
const SANMAR_MEDIA_BASE = 'https://cdnm.sanmar.com/imglib/mresjpg'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Validate auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { action, customer_number, api_key, search, category, style_id, user_id, page, per_page } = body

    if (!customer_number || !api_key) {
      return new Response(JSON.stringify({ error: 'customer_number and api_key are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // SanMar API helper - uses their PromoStandards-compatible REST endpoints
    const sanmarFetch = async (endpoint: string, params: Record<string, string> = {}) => {
      const url = new URL(`${SANMAR_API_BASE}/${endpoint}`)
      url.searchParams.set('customerNumber', customer_number)
      url.searchParams.set('apiKey', api_key)
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v)
      }
      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`SanMar API error ${res.status}: ${errText}`)
      }
      return res.json()
    }

    // Helper to build SanMar image URL
    const buildImageUrl = (styleNo: string, colorName: string, view: string = 'fl') => {
      if (!styleNo) return null
      const cleanStyle = styleNo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      const cleanColor = colorName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '')
      return `${SANMAR_MEDIA_BASE}/${cleanStyle}_${cleanColor}_${view}.jpg`
    }

    const jsonResponse = (data: any, status = 200) => new Response(
      JSON.stringify(data),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

    // ACTION: browse — search styles catalog
    if (action === 'browse') {
      try {
        // SanMar's product search endpoint
        const searchParams: Record<string, string> = {}
        if (search) searchParams.searchText = search
        if (category) searchParams.category = category

        const data = await sanmarFetch('getProductSellable', searchParams)
        
        // Normalize the response - SanMar returns products in various formats
        let products = []
        if (data?.ProductSellableArray?.ProductSellable) {
          products = Array.isArray(data.ProductSellableArray.ProductSellable)
            ? data.ProductSellableArray.ProductSellable
            : [data.ProductSellableArray.ProductSellable]
        } else if (data?.products) {
          products = Array.isArray(data.products) ? data.products : [data.products]
        } else if (Array.isArray(data)) {
          products = data
        }

        // Group by style number to deduplicate
        const styleMap = new Map<string, any>()
        for (const p of products) {
          const styleNo = p.styleNo || p.productId || p.style || ''
          if (!styleNo) continue
          if (!styleMap.has(styleNo)) {
            styleMap.set(styleNo, {
              styleID: styleNo,
              styleName: styleNo,
              brandName: p.brandName || p.brand || 'SanMar',
              title: p.productName || p.description || p.title || '',
              baseCategory: p.category || p.productCategory || 'Apparel',
              styleImage: p.imageUrl || p.thumbnailUrl || buildImageUrl(styleNo, 'White') || null,
              customerPrice: p.price || p.listPrice || p.piecePrice || 0,
              colorCount: 0,
              colors: [],
            })
          }
          const style = styleMap.get(styleNo)!
          const colorName = p.colorName || p.color || ''
          if (colorName && !style.colors.includes(colorName)) {
            style.colors.push(colorName)
            style.colorCount = style.colors.length
          }
        }

        const allStyles = Array.from(styleMap.values())
        const pageSize = per_page || 50
        const currentPage = page || 1
        const totalCount = allStyles.length
        const totalPages = Math.ceil(totalCount / pageSize)
        const startIdx = (currentPage - 1) * pageSize
        const paged = allStyles.slice(startIdx, startIdx + pageSize)

        // Clean up colors array from output
        const items = paged.map(({ colors, ...rest }: any) => rest)

        return jsonResponse({
          styles: items,
          page: currentPage,
          per_page: pageSize,
          total: totalCount,
          total_pages: totalPages,
        })
      } catch (err: any) {
        return jsonResponse({ error: err.message }, err.message.includes('API error') ? 502 : 500)
      }
    }

    // ACTION: details — fetch variants for a specific style
    if (action === 'details') {
      if (!style_id) {
        return jsonResponse({ error: 'style_id is required' }, 400)
      }

      try {
        const data = await sanmarFetch('getProductSellable', { styleNo: style_id })

        let products = []
        if (data?.ProductSellableArray?.ProductSellable) {
          products = Array.isArray(data.ProductSellableArray.ProductSellable)
            ? data.ProductSellableArray.ProductSellable
            : [data.ProductSellableArray.ProductSellable]
        } else if (data?.products) {
          products = Array.isArray(data.products) ? data.products : [data.products]
        } else if (Array.isArray(data)) {
          products = data
        }

        // Group by color
        const colorMap = new Map<string, any[]>()
        let brandName = 'SanMar'
        let title = ''
        let description = ''
        let baseCategory = 'Apparel'

        for (const p of products) {
          brandName = p.brandName || p.brand || brandName
          title = p.productName || p.title || title
          description = p.description || description
          baseCategory = p.category || p.productCategory || baseCategory

          const colorName = p.colorName || p.color || 'Default'
          if (!colorMap.has(colorName)) colorMap.set(colorName, [])
          colorMap.get(colorName)!.push(p)
        }

        const variants = Array.from(colorMap.entries()).map(([colorName, skus]) => {
          const first = skus[0]
          return {
            color: colorName,
            hex: first.hexColor || first.colorHex || null,
            colorFrontImage: first.imageUrl || buildImageUrl(style_id, colorName, 'fl'),
            colorSwatchImage: first.swatchImageUrl || null,
            sizes: skus.map((s: any) => ({
              size: s.sizeName || s.size || s.labelSize || 'OS',
              sku: s.sku || s.uniqueKey || `${style_id}-${colorName}-${s.sizeName || s.size || 'OS'}`,
              price: parseFloat(s.price || s.listPrice || s.piecePrice || '0'),
              qty: 0,
            })),
          }
        })

        return jsonResponse({
          styleID: style_id,
          styleName: style_id,
          brandName,
          title,
          description,
          baseCategory,
          variants,
        })
      } catch (err: any) {
        return jsonResponse({ error: err.message }, err.message.includes('API error') ? 502 : 500)
      }
    }

    // ACTION: import / sync — import specific styles as inventory products
    if (action === 'import' || action === 'sync') {
      const styleIds = action === 'sync' ? body.style_ids : [style_id]
      if (!styleIds || !styleIds.length) {
        return jsonResponse({ error: 'style_id or style_ids required' }, 400)
      }

      const targetUserId = user_id || user.id
      let imported = 0
      let updated = 0

      for (const sid of styleIds) {
        try {
          const data = await sanmarFetch('getProductSellable', { styleNo: sid })

          let products = []
          if (data?.ProductSellableArray?.ProductSellable) {
            products = Array.isArray(data.ProductSellableArray.ProductSellable)
              ? data.ProductSellableArray.ProductSellable
              : [data.ProductSellableArray.ProductSellable]
          } else if (data?.products) {
            products = Array.isArray(data.products) ? data.products : [data.products]
          } else if (Array.isArray(data)) {
            products = data
          }

          if (!products.length) continue

          const firstProd = products[0]
          const brandName = firstProd.brandName || firstProd.brand || 'SanMar'
          const productTitle = firstProd.productName || firstProd.title || ''

          // Group by color
          const colorMap = new Map<string, any[]>()
          for (const p of products) {
            const colorName = p.colorName || p.color || 'Default'
            if (!colorMap.has(colorName)) colorMap.set(colorName, [])
            colorMap.get(colorName)!.push(p)
          }

          const variants = Array.from(colorMap.entries()).map(([colorName, skus]) => {
            const first = skus[0]
            return {
              color: colorName,
              hex: first.hexColor || first.colorHex || null,
              image: first.imageUrl || buildImageUrl(sid, colorName, 'fl'),
              sizes: skus.map((s: any) => ({
                size: s.sizeName || s.size || s.labelSize || 'OS',
                sku: s.sku || s.uniqueKey || `${sid}-${colorName}-${s.sizeName || s.size || 'OS'}`,
                price: parseFloat(s.price || s.listPrice || s.piecePrice || '0'),
                qty: 0,
              })),
            }
          })

          const imageFront = firstProd.imageUrl || buildImageUrl(sid, products[0]?.colorName || 'White', 'fl')
          const imageBack = buildImageUrl(sid, products[0]?.colorName || 'White', 'bk')

          const productName = `${brandName} ${sid}`.trim()
          const supplierSource = {
            provider: 'sanmar',
            style_id: sid,
            style_name: sid,
            brand: brandName,
            last_synced: new Date().toISOString(),
          }

          // Check if already imported
          const { data: existing } = await supabase
            .from('inventory_products')
            .select('id')
            .eq('user_id', targetUserId)
            .filter('supplier_source->>provider', 'eq', 'sanmar')
            .filter('supplier_source->>style_id', 'eq', String(sid))
            .maybeSingle()

          const payload = {
            name: productName,
            category: firstProd.category || firstProd.productCategory || 'apparel',
            description: productTitle || firstProd.description || null,
            base_price: parseFloat(firstProd.price || firstProd.listPrice || firstProd.piecePrice || '0'),
            image_front: imageFront,
            image_back: imageBack,
            image_side1: null,
            image_side2: null,
            variants,
            is_active: true,
            supplier_source: supplierSource,
            user_id: targetUserId,
          }

          if (existing) {
            await supabase.from('inventory_products').update(payload).eq('id', existing.id)
            updated++
          } else {
            await supabase.from('inventory_products').insert(payload)
            imported++
          }
        } catch {
          // Skip failed individual styles
          continue
        }
      }

      return jsonResponse({ imported, updated, total: styleIds.length })
    }

    // ACTION: categories
    if (action === 'categories') {
      try {
        // SanMar doesn't have a dedicated categories endpoint in all versions
        // Return common apparel categories
        const categories = [
          'T-Shirts', 'Polos', 'Sweatshirts/Fleece', 'Woven Shirts',
          'Caps', 'Bags', 'Outerwear', 'Activewear', 'Youth',
          'Ladies', 'Tall', 'Accessories'
        ]
        return jsonResponse({ categories })
      } catch (err: any) {
        return jsonResponse({ error: err.message }, 500)
      }
    }

    return jsonResponse({ error: 'Invalid action. Use: browse, import, sync, details, categories' }, 400)
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
