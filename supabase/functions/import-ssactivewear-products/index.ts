import { corsHeaders } from '@supabase/supabase-js/cors'
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
    const { action, account_number, api_key, search, category, style_id, user_id } = body

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
      if (category) params.push(`baseCategory=${encodeURIComponent(category)}`)
      if (params.length) url += `?${params.join('&')}`

      const res = await fetch(url, { headers: ssHeaders })
      if (!res.ok) {
        const errText = await res.text()
        return new Response(JSON.stringify({ error: `S&S API error: ${res.status}`, details: errText }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const styles = await res.json()

      // Map to simplified catalog items (limit to 50 for browsing)
      const items = (Array.isArray(styles) ? styles : []).slice(0, 50).map((s: any) => ({
        styleID: s.styleID,
        styleName: s.styleName,
        brandName: s.brandName,
        title: s.title,
        baseCategory: s.baseCategory,
        styleImage: s.styleImage ? `https://www.ssactivewear.com/${s.styleImage}` : null,
        customerPrice: s.customerPrice || s.piecePrice,
        colorCount: s.colorCount || 0,
      }))

      return new Response(JSON.stringify({ styles: items }), {
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

        // Build variants array
        const variants = Array.from(colorMap.entries()).map(([colorName, skus]) => {
          const first = skus[0]
          return {
            color: colorName,
            hex: first.color1 || null,
            image: first.colorFrontImage ? `https://www.ssactivewear.com/${first.colorFrontImage.replace('_fm.', '_fl.')}` : null,
            sizes: skus.map((s: any) => ({
              size: s.sizeName || s.size2Name || 'OS',
              sku: s.sku,
              price: s.customerPrice || s.piecePrice || 0,
              qty: s.qty ?? 0,
            })),
          }
        })

        // Pick images from first color
        const firstProduct = Array.isArray(products) && products.length > 0 ? products[0] : null
        const imgBase = 'https://www.ssactivewear.com/'
        const imageFront = firstProduct?.colorFrontImage
          ? `${imgBase}${firstProduct.colorFrontImage.replace('_fm.', '_fl.')}`
          : (style.styleImage ? `${imgBase}${style.styleImage}` : null)
        const imageBack = firstProduct?.colorBackImage
          ? `${imgBase}${firstProduct.colorBackImage.replace('_fm.', '_fl.')}` : null
        const imageSide1 = firstProduct?.colorSideImage
          ? `${imgBase}${firstProduct.colorSideImage.replace('_fm.', '_fl.')}` : null

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
      }

      return new Response(JSON.stringify({ imported, updated, total: styleIds.length }), {
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
