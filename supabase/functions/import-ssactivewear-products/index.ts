const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SS_API_BASE = 'https://api.ssactivewear.com/v2'

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
    const { action, account_number, api_key, search, category, style_id, user_id, page, per_page } = body

    if (!account_number || !api_key) {
      return new Response(JSON.stringify({ error: 'account_number and api_key are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const basicAuth = btoa(`${account_number}:${api_key}`)
    const ssHeaders = {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    }

    // ACTION: browse — search styles catalog
    if (action === 'browse') {
      let url = `${SS_API_BASE}/styles/`
      const params: string[] = []
      if (search) params.push(`search=${encodeURIComponent(search)}`)
      if (params.length) url += `?${params.join('&')}`

      const res = await fetch(url, { headers: ssHeaders })
      if (!res.ok) {
        const errText = await res.text()
        return new Response(JSON.stringify({ error: `S&S API error: ${res.status}`, details: errText }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const styles = await res.json()
      const normalizedCategory = typeof category === 'string' ? category.trim().toLowerCase() : null
      const allStyles = (Array.isArray(styles) ? styles : []).filter((style: any) => {
        if (!normalizedCategory) return true
        const styleCategory = typeof style?.baseCategory === 'string' ? style.baseCategory.trim().toLowerCase() : ''
        return styleCategory === normalizedCategory
      })
      const pageSize = per_page || 50
      const currentPage = page || 1
      const totalCount = allStyles.length
      const totalPages = Math.ceil(totalCount / pageSize)
      const startIdx = (currentPage - 1) * pageSize
      const paged = allStyles.slice(startIdx, startIdx + pageSize)

      const items = paged.map((s: any) => ({
        styleID: s.styleID,
        styleName: s.styleName,
        brandName: s.brandName,
        title: s.title,
        baseCategory: s.baseCategory,
        styleImage: s.styleImage ? `https://www.ssactivewear.com/${s.styleImage}` : null,
        customerPrice: s.customerPrice || s.piecePrice,
        colorCount: s.colorCount || 0,
      }))

      return new Response(JSON.stringify({ styles: items, page: currentPage, per_page: pageSize, total: totalCount, total_pages: totalPages }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ACTION: import — import a specific style as inventory product
    if (action === 'import' || action === 'sync') {
      const styleIds = action === 'sync' ? body.style_ids : [style_id]
      if (!styleIds || !styleIds.length) {
        return new Response(JSON.stringify({ error: 'style_id or style_ids required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const targetUserId = user_id || user.id
      let imported = 0
      let updated = 0

      for (const sid of styleIds) {
        // Fetch style info
        const styleRes = await fetch(`${SS_API_BASE}/styles/${sid}`, { headers: ssHeaders })
        if (!styleRes.ok) {
          await styleRes.text()
          continue
        }
        const styleArr = await styleRes.json()
        const style = Array.isArray(styleArr) ? styleArr[0] : styleArr
        if (!style) continue

        // Fetch products (SKU-level) for this style
        const prodRes = await fetch(`${SS_API_BASE}/products/?style=${sid}`, { headers: ssHeaders })
        if (!prodRes.ok) {
          await prodRes.text()
          continue
        }
        const products = await prodRes.json()

        // Group by color
        const colorMap = new Map<string, any[]>()
        for (const p of (Array.isArray(products) ? products : [])) {
          const key = p.colorName || 'Default'
          if (!colorMap.has(key)) colorMap.set(key, [])
          colorMap.get(key)!.push(p)
        }

        // Build variants array (with up to 6-image gallery per color)
        const MAX_GALLERY = 6
        const imgBaseUrl = 'https://www.ssactivewear.com/'
        const toLargeUrl = (path: string | null | undefined) =>
          path ? `${imgBaseUrl}${path.replace('_fm.', '_fl.')}` : null
        const buildColorGallery = (sku: any): string[] => {
          const candidates = [
            sku.colorFrontImage,
            sku.colorOnModelFrontImage,
            sku.colorBackImage,
            sku.colorOnModelBackImage,
            sku.colorSideImage,
            sku.colorOnModelSideImage,
            sku.colorDirectSideImage,
            sku.colorThreeQuarterImage,
          ]
          const urls: string[] = []
          for (const c of candidates) {
            const u = toLargeUrl(c)
            if (u && !urls.includes(u) && urls.length < MAX_GALLERY) urls.push(u)
          }
          return urls
        }

        const variants = Array.from(colorMap.entries()).map(([colorName, skus]) => {
          const first = skus[0]
          return {
            color: colorName,
            hex: first.color1 || null,
            image: toLargeUrl(first.colorFrontImage),
            gallery: buildColorGallery(first),
            sizes: skus.map((s: any) => ({
              size: s.sizeName || s.size2Name || 'OS',
              sku: s.sku,
              price: s.customerPrice || s.piecePrice || 0,
              qty: s.qty ?? 0,
            })),
          }
        })

        // Pick images from first color — populate all 4 side slots when available
        const firstProduct = Array.isArray(products) && products.length > 0 ? products[0] : null
        const imageFront = toLargeUrl(firstProduct?.colorFrontImage)
          || (style.styleImage ? `${imgBaseUrl}${style.styleImage}` : null)
        const imageBack = toLargeUrl(firstProduct?.colorBackImage)
        const imageSide1 = toLargeUrl(firstProduct?.colorSideImage)
          || toLargeUrl(firstProduct?.colorOnModelSideImage)
        const imageSide2 = toLargeUrl(firstProduct?.colorOnModelFrontImage)
          || toLargeUrl(firstProduct?.colorThreeQuarterImage)

        const productName = `${style.brandName} ${style.styleName}`.trim()
        const supplierSource = {
          provider: 'ssactivewear',
          style_id: sid,
          style_name: style.styleName,
          brand: style.brandName,
          last_synced: new Date().toISOString(),
        }

        // Check if already imported (by supplier_source->style_id)
        const { data: existing } = await supabase
          .from('inventory_products')
          .select('id')
          .eq('user_id', targetUserId)
          .filter('supplier_source->>provider', 'eq', 'ssactivewear')
          .filter('supplier_source->>style_id', 'eq', String(sid))
          .maybeSingle()

        const payload = {
          name: productName,
          category: style.baseCategory || 'apparel',
          description: style.title || style.description || null,
          base_price: style.customerPrice || style.piecePrice || 0,
          image_front: imageFront,
          image_back: imageBack,
          image_side1: imageSide1,
          image_side2: imageSide2,
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
      }

      return new Response(JSON.stringify({ imported, updated, total: styleIds.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ACTION: details — fetch variants for a specific style
    if (action === 'details') {
      if (!style_id) {
        return new Response(JSON.stringify({ error: 'style_id is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Fetch style info
      const styleRes = await fetch(`${SS_API_BASE}/styles/${style_id}`, { headers: ssHeaders })
      if (!styleRes.ok) {
        const errText = await styleRes.text()
        return new Response(JSON.stringify({ error: `S&S API error: ${styleRes.status}`, details: errText }), {
          status: styleRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const styleArr = await styleRes.json()
      const style = Array.isArray(styleArr) ? styleArr[0] : styleArr

      // Fetch products (SKU-level) for this style
      const prodRes = await fetch(`${SS_API_BASE}/products/?style=${style_id}`, { headers: ssHeaders })
      if (!prodRes.ok) {
        const errText = await prodRes.text()
        return new Response(JSON.stringify({ error: `S&S API error: ${prodRes.status}`, details: errText }), {
          status: prodRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const products = await prodRes.json()

      // Group by color
      const colorMap = new Map<string, any[]>()
      for (const p of (Array.isArray(products) ? products : [])) {
        const key = p.colorName || 'Default'
        if (!colorMap.has(key)) colorMap.set(key, [])
        colorMap.get(key)!.push(p)
      }

      const variants = Array.from(colorMap.entries()).map(([colorName, skus]) => {
        const first = skus[0]
        return {
          color: colorName,
          hex: first.color1 || null,
          colorFrontImage: first.colorFrontImage ? `https://www.ssactivewear.com/${first.colorFrontImage.replace('_fm.', '_fl.')}` : null,
          colorSwatchImage: first.colorSwatchImage ? `https://www.ssactivewear.com/${first.colorSwatchImage}` : null,
          sizes: skus.map((s: any) => ({
            size: s.sizeName || s.size2Name || 'OS',
            sku: s.sku,
            price: s.customerPrice || s.piecePrice || 0,
            qty: s.qty ?? 0,
          })),
        }
      })

      return new Response(JSON.stringify({
        styleID: style?.styleID || style_id,
        styleName: style?.styleName,
        brandName: style?.brandName,
        title: style?.title,
        description: style?.description || null,
        baseCategory: style?.baseCategory,
        variants,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ACTION: categories — fetch available categories
    if (action === 'categories') {
      const res = await fetch(`${SS_API_BASE}/categories/`, { headers: ssHeaders })
      if (!res.ok) {
        const errText = await res.text()
        return new Response(JSON.stringify({ error: `S&S API error: ${res.status}`, details: errText }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const categories = await res.json()
      return new Response(JSON.stringify({ categories }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: browse, import, sync, categories' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
