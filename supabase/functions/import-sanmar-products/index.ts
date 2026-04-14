const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// SanMar PromoStandards Endpoints
const PS_PRODUCT_V2 = 'https://ws.sanmar.com:8080/promostandards/ProductDataServiceBindingV2'
const PS_MEDIA = 'https://ws.sanmar.com:8080/promostandards/MediaContentServiceBinding'
const PS_PRICING = 'https://ws.sanmar.com:8080/promostandards/PricingAndConfigurationServiceBinding'

// Namespaces
const NS_PRODUCT = 'http://www.promostandards.org/WSDL/ProductDataService/2.0.0/'
const NS_PRODUCT_SHARED = 'http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/'
const NS_MEDIA = 'http://www.promostandards.org/WSDL/MediaService/1.0.0/'
const NS_MEDIA_SHARED = 'http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/'
const NS_PRICING = 'http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/'
const NS_PRICING_SHARED = 'http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Missing authorization' }, 401)
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    const body = await req.json()
    const { action, username, password, search, category, style_id, user_id, page, per_page } = body

    if (!username || !password) return jsonResponse({ error: 'username and password are required' }, 400)

    // ============ XML Helpers ============

    const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
    const decodeXml = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")

    const extractTag = (xml: string, tag: string): string => {
      const m = xml.match(new RegExp(`<(?:[^:]+:)?${tag}(?:\\s[^>]*)?>([^<]*)</(?:[^:]+:)?${tag}>`, 'i'))
      return m ? m[1].trim() : ''
    }

    const extractAllBlocks = (xml: string, tag: string): string[] => {
      const regex = new RegExp(`<(?:[^:]+:)?${tag}(?=[\\s>/])([^>]*)>([\\s\\S]*?)</(?:[^:]+:)?${tag}>`, 'gi')
      const results: string[] = []
      let m
      while ((m = regex.exec(xml)) !== null) results.push(m[2])
      return results
    }

    // ============ SOAP Callers ============

    const soapCall = async (endpoint: string, xmlBody: string): Promise<string> => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '' },
        body: xmlBody,
      })
      const text = await res.text()

      const lowerText = text.toLowerCase()
      if (lowerText.includes('authentication') && (lowerText.includes('failed') || lowerText.includes('credentials'))) {
        throw new Error('Authentication failed. Please verify your SanMar.com username and password.')
      }
      const severity = extractTag(text, 'severity')
      const errorCode = extractTag(text, 'code')
      if (severity?.toLowerCase() === 'error') {
        if (errorCode === '130' || errorCode === '160') return text // not found / no results
        const desc = extractTag(text, 'description') || 'Unknown error'
        throw new Error(`SanMar error: ${desc}`)
      }
      if (lowerText.includes('fault')) {
        const faultMsg = extractTag(text, 'faultstring') || extractTag(text, 'faultString') || text.substring(0, 300)
        throw new Error(`SanMar error: ${faultMsg}`)
      }
      if (!res.ok) throw new Error(`SanMar API error ${res.status}: ${text.substring(0, 300)}`)
      return text
    }

    // ============ SOAP Builders ============

    const buildGetProductSellable = (productId?: string) => `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="${NS_PRODUCT}" xmlns:shar="${NS_PRODUCT_SHARED}">
  <soapenv:Header/><soapenv:Body>
    <ns:GetProductSellableRequest>
      <shar:wsVersion>2.0.0</shar:wsVersion>
      <shar:id>${escXml(username)}</shar:id>
      <shar:password>${escXml(password)}</shar:password>
      ${productId ? `<shar:productId>${escXml(productId)}</shar:productId>` : ''}
      <shar:isSellable>true</shar:isSellable>
    </ns:GetProductSellableRequest>
  </soapenv:Body>
</soapenv:Envelope>`

    const buildGetProduct = (productId: string) => `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="${NS_PRODUCT}" xmlns:shar="${NS_PRODUCT_SHARED}">
  <soapenv:Header/><soapenv:Body>
    <ns:GetProductRequest>
      <shar:wsVersion>2.0.0</shar:wsVersion>
      <shar:id>${escXml(username)}</shar:id>
      <shar:password>${escXml(password)}</shar:password>
      <shar:localizationCountry>US</shar:localizationCountry>
      <shar:localizationLanguage>en</shar:localizationLanguage>
      <shar:productId>${escXml(productId)}</shar:productId>
    </ns:GetProductRequest>
  </soapenv:Body>
</soapenv:Envelope>`

    const buildGetMediaContent = (productId: string) => `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="${NS_MEDIA}" xmlns:shar="${NS_MEDIA_SHARED}">
  <soapenv:Header/><soapenv:Body>
    <ns:GetMediaContentRequest>
      <shar:wsVersion>1.1.0</shar:wsVersion>
      <shar:id>${escXml(username)}</shar:id>
      <shar:password>${escXml(password)}</shar:password>
      <shar:mediaType>Image</shar:mediaType>
      <shar:productId>${escXml(productId)}</shar:productId>
    </ns:GetMediaContentRequest>
  </soapenv:Body>
</soapenv:Envelope>`

    const buildGetPricing = (productId: string) => `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="${NS_PRICING}" xmlns:shar="${NS_PRICING_SHARED}">
  <soapenv:Header/><soapenv:Body>
    <ns:GetConfigurationAndPricingRequest>
      <shar:wsVersion>1.0.0</shar:wsVersion>
      <shar:id>${escXml(username)}</shar:id>
      <shar:password>${escXml(password)}</shar:password>
      <shar:productId>${escXml(productId)}</shar:productId>
      <shar:currency>USD</shar:currency>
      <shar:priceType>Net</shar:priceType>
      <shar:localizationCountry>US</shar:localizationCountry>
      <shar:localizationLanguage>en</shar:localizationLanguage>
      <shar:configurationType>Blank</shar:configurationType>
    </ns:GetConfigurationAndPricingRequest>
  </soapenv:Body>
</soapenv:Envelope>`

    // ============ Parsers ============

    const parseProductSellable = (xml: string): Array<{productId: string}> => {
      const errorCode = extractTag(xml, 'code')
      if (errorCode === '130' || errorCode === '160') return []
      const errorMsg = extractTag(xml, 'errorMessage')
      if (errorMsg && !errorMsg.toLowerCase().includes('not found')) throw new Error(errorMsg)
      const products: Array<{productId: string}> = []
      for (const block of extractAllBlocks(xml, 'ProductSellable')) {
        const pid = extractTag(block, 'productId')
        if (pid) products.push({ productId: pid })
      }
      return products
    }

    // Parse Media Content response — returns map of color → { front, back, swatch }
    const parseMediaContent = (xml: string): Map<string, { front: string, back: string, swatch: string }> => {
      const mediaMap = new Map<string, { front: string, back: string, swatch: string }>()
      let firstFront = ''
      for (const block of extractAllBlocks(xml, 'MediaContent')) {
        const url = extractTag(block, 'url')
        if (!url) continue
        const color = extractTag(block, 'color') || '_default'
        // classTypeId: 1006=Primary, 1007=Front, 1008=Rear, 1004=Swatch, 1001=Blank
        const classTypeId = extractTag(block, 'classTypeId')
        const entry = mediaMap.get(color) || { front: '', back: '', swatch: '' }
        if (classTypeId === '1007' || classTypeId === '1006' || classTypeId === '1001') {
          entry.front = entry.front || url
        } else if (classTypeId === '1008') {
          entry.back = entry.back || url
        } else if (classTypeId === '1004') {
          entry.swatch = entry.swatch || url
        } else if (!entry.front) {
          entry.front = url
        }
        mediaMap.set(color, entry)
        if (!firstFront && entry.front) firstFront = entry.front
      }
      // Ensure _default has at least one front image
      if (!mediaMap.has('_default') && firstFront) {
        mediaMap.set('_default', { front: firstFront, back: '', swatch: '' })
      }
      return mediaMap
    }

    // Parse Pricing response — returns map of partId → price
    const parsePricing = (xml: string): Map<string, number> => {
      const priceMap = new Map<string, number>()
      // PPC response: Configuration > PartArray > Part (each has partId, PartPriceArray > PartPrice > price)
      for (const partBlock of extractAllBlocks(xml, 'Part')) {
        const partId = extractTag(partBlock, 'partId')
        if (!partId) continue
        // Get the first price from PartPriceArray
        const priceBlocks = extractAllBlocks(partBlock, 'PartPrice')
        for (const pb of priceBlocks) {
          const price = parseFloat(extractTag(pb, 'price') || '0')
          if (price > 0) { priceMap.set(partId, price); break }
        }
      }
      return priceMap
    }

    // Parse GetProduct response — returns product metadata and parts
    const parseGetProduct = (xml: string) => {
      const errorMsg = extractTag(xml, 'errorMessage')
      if (errorMsg && !xml.toLowerCase().includes('productname')) throw new Error(errorMsg)
      return {
        productName: decodeXml(extractTag(xml, 'productName')),
        description: decodeXml(extractTag(xml, 'description')),
        brand: decodeXml(extractTag(xml, 'productBrand')) || 'SanMar',
        category: extractTag(xml, 'ProductCategory') || extractTag(xml, 'productCategory') || 'Apparel',
        productId: extractTag(xml, 'productId'),
        parts: parseProductParts(xml),
      }
    }

    const parseProductParts = (xml: string) => {
      let partBlocks = extractAllBlocks(xml, 'ProductPart')
      if (!partBlocks.length) partBlocks = extractAllBlocks(xml, 'Part')
      const parts: Array<{partId: string, color: string, size: string}> = []
      for (const block of partBlocks) {
        const partId = extractTag(block, 'partId')
        const colorArrayBlock = extractAllBlocks(block, 'ColorArray')[0] || ''
        const colorBlock = colorArrayBlock ? extractAllBlocks(colorArrayBlock, 'Color')[0] || '' : ''
        let color = colorBlock ? extractTag(colorBlock, 'colorName') : ''
        if (!color) color = extractTag(block, 'colorName') || extractTag(block, 'standardColorName')
        const size = extractTag(block, 'labelSize') || extractTag(block, 'apparelSize')
        parts.push({ partId, color, size })
      }
      return parts
    }

    // ============ Enrichment: fetch media + pricing in parallel ============

    const enrichProduct = async (productId: string, product: ReturnType<typeof parseGetProduct>) => {
      // Fetch media and pricing in parallel
      const [mediaXml, pricingXml] = await Promise.all([
        soapCall(PS_MEDIA, buildGetMediaContent(productId)).catch(() => ''),
        soapCall(PS_PRICING, buildGetPricing(productId)).catch(() => ''),
      ])

      const mediaMap = mediaXml ? parseMediaContent(mediaXml) : new Map()
      const priceMap = pricingXml ? parsePricing(pricingXml) : new Map()

      console.log(`Enriched ${productId}: ${mediaMap.size} media colors, ${priceMap.size} prices, ${product.parts.length} parts`)

      // Build enriched parts
      const parts = product.parts.map(p => {
        const colorMedia = mediaMap.get(p.color) || mediaMap.get('_default') || { front: '', back: '', swatch: '' }
        return {
          partId: p.partId,
          color: p.color,
          size: p.size,
          price: priceMap.get(p.partId) || 0,
          frontImage: colorMedia.front,
          backImage: colorMedia.back,
          swatchImage: colorMedia.swatch,
        }
      })

      return { ...product, parts }
    }

    // ============ ACTION: browse ============

    if (action === 'browse') {
      try {
        if (!search?.trim()) {
          return jsonResponse({
            styles: [], page: 1, per_page: per_page || 50, total: 0, total_pages: 0,
            message: 'Enter a style number (e.g. PC61, DT6000, ST350) to search the SanMar catalog.',
          })
        }

        const styleQuery = search.trim().toUpperCase()
        const xml = await soapCall(PS_PRODUCT_V2, buildGetProductSellable(styleQuery))
        const sellableProducts = parseProductSellable(xml)
        let uniqueIds = [...new Set(sellableProducts.map(p => p.productId))]

        // Fallback: try direct GetProduct if sellable returned nothing
        if (!uniqueIds.length) {
          try {
            const detailXml = await soapCall(PS_PRODUCT_V2, buildGetProduct(styleQuery))
            const detail = parseGetProduct(detailXml)
            if (detail.productName || detail.parts.length) uniqueIds = [styleQuery]
          } catch { /* no results */ }
        }

        const pageSize = per_page || 50
        const currentPage = page || 1
        const totalCount = uniqueIds.length
        const totalPages = Math.ceil(totalCount / pageSize)
        const paged = uniqueIds.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize)

        // Enrich each style with product data + media + pricing in parallel
        const stylePromises = paged.map(async (id) => {
          try {
            const prodXml = await soapCall(PS_PRODUCT_V2, buildGetProduct(id))
            const product = parseGetProduct(prodXml)
            const enriched = await enrichProduct(id, product)
            const uniqueColors = new Set(enriched.parts.map(p => p.color).filter(Boolean))
            const firstPartWithImage = enriched.parts.find(p => p.frontImage) || enriched.parts[0]
            return {
              styleID: id,
              styleName: id,
              brandName: enriched.brand,
              title: enriched.productName,
              baseCategory: enriched.category,
              styleImage: firstPartWithImage?.frontImage || null,
              customerPrice: firstPartWithImage?.price || 0,
              colorCount: uniqueColors.size,
            }
          } catch {
            return {
              styleID: id, styleName: id, brandName: 'SanMar', title: '',
              baseCategory: 'Apparel', styleImage: null, customerPrice: 0, colorCount: 0,
            }
          }
        })
        const styles = await Promise.all(stylePromises)

        if (!styles.length && currentPage === 1) {
          return jsonResponse({ styles: [], page: 1, per_page: pageSize, total: 0, total_pages: 0 })
        }
        return jsonResponse({ styles, page: currentPage, per_page: pageSize, total: totalCount, total_pages: totalPages })
      } catch (err: any) {
        return jsonResponse({ error: err.message }, err.message.includes('uthenticat') ? 401 : 500)
      }
    }

    // ============ ACTION: details ============

    if (action === 'details') {
      if (!style_id) return jsonResponse({ error: 'style_id is required' }, 400)
      try {
        const prodXml = await soapCall(PS_PRODUCT_V2, buildGetProduct(style_id))
        const product = parseGetProduct(prodXml)
        const enriched = await enrichProduct(style_id, product)

        // Group parts by color
        const colorMap = new Map<string, typeof enriched.parts>()
        for (const part of enriched.parts) {
          const c = part.color || 'Default'
          if (!colorMap.has(c)) colorMap.set(c, [])
          colorMap.get(c)!.push(part)
        }

        const variants = Array.from(colorMap.entries()).map(([colorName, parts]) => ({
          color: colorName,
          hex: null,
          colorFrontImage: parts[0].frontImage || null,
          colorSwatchImage: parts[0].swatchImage || null,
          sizes: parts.map(p => ({
            size: p.size || 'OS',
            sku: p.partId || `${style_id}-${colorName}-${p.size || 'OS'}`,
            price: p.price,
            casePrice: 0,
            salePrice: 0,
            qty: 0,
          })),
        }))

        return jsonResponse({
          styleID: style_id, styleName: style_id,
          brandName: enriched.brand, title: enriched.productName,
          description: enriched.description, baseCategory: enriched.category, variants,
        })
      } catch (err: any) {
        return jsonResponse({ error: err.message }, 500)
      }
    }

    // ============ ACTION: import / sync ============

    if (action === 'import' || action === 'sync') {
      const styleIds = action === 'sync' ? body.style_ids : [style_id]
      if (!styleIds?.length) return jsonResponse({ error: 'style_id or style_ids required' }, 400)

      const targetUserId = user_id || user.id
      let imported = 0, updated = 0

      for (const sid of styleIds) {
        try {
          const prodXml = await soapCall(PS_PRODUCT_V2, buildGetProduct(sid))
          const product = parseGetProduct(prodXml)
          if (!product.parts.length) continue
          const enriched = await enrichProduct(sid, product)

          const colorMap = new Map<string, typeof enriched.parts>()
          for (const part of enriched.parts) {
            const c = part.color || 'Default'
            if (!colorMap.has(c)) colorMap.set(c, [])
            colorMap.get(c)!.push(part)
          }

          const variants = Array.from(colorMap.entries()).map(([colorName, parts]) => ({
            color: colorName, hex: null,
            image: parts[0].frontImage || null,
            sizes: parts.map(p => ({
              size: p.size || 'OS',
              sku: p.partId || `${sid}-${colorName}-${p.size || 'OS'}`,
              price: p.price, qty: 0,
            })),
          }))

          const firstPart = enriched.parts.find(p => p.frontImage) || enriched.parts[0]
          const backPart = enriched.parts.find(p => p.backImage)
          const supplierSource = {
            provider: 'sanmar', style_id: sid, style_name: sid,
            brand: enriched.brand, last_synced: new Date().toISOString(),
          }

          const { data: existing } = await supabase
            .from('inventory_products').select('id')
            .eq('user_id', targetUserId)
            .filter('supplier_source->>provider', 'eq', 'sanmar')
            .filter('supplier_source->>style_id', 'eq', String(sid))
            .maybeSingle()

          const payload = {
            name: `${enriched.brand} ${sid}`.trim(),
            category: enriched.category?.toLowerCase() || 'apparel',
            description: enriched.description || null,
            base_price: firstPart?.price || 0,
            image_front: firstPart?.frontImage || null,
            image_back: backPart?.backImage || null,
            image_side1: null, image_side2: null,
            variants, is_active: true, supplier_source: supplierSource,
            user_id: targetUserId,
          }

          if (existing) {
            await supabase.from('inventory_products').update(payload).eq('id', existing.id)
            updated++
          } else {
            await supabase.from('inventory_products').insert(payload)
            imported++
          }
        } catch { continue }
      }

      return jsonResponse({ imported, updated, total: styleIds.length })
    }

    // ============ ACTION: categories ============

    if (action === 'categories') {
      return jsonResponse({
        categories: [
          'T-Shirts', 'Polos/Knits', 'Sweatshirts/Fleece', 'Woven Shirts',
          'Caps', 'Bags', 'Outerwear', 'Activewear', 'Youth',
          "Women's", 'Tall', 'Accessories', 'Bottoms',
          'Infant & Toddler', 'Workwear', 'Personal Protection'
        ]
      })
    }

    return jsonResponse({ error: 'Invalid action. Use: browse, import, sync, details, categories' }, 400)
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }
  })
}
