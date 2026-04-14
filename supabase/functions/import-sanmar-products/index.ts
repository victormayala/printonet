const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// SanMar PromoStandards Product Data Service V2.0.0
const PS_ENDPOINT = 'https://ws.sanmar.com:8080/promostandards/ProductDataServiceBindingV2'
const PS_NS = 'http://www.promostandards.org/WSDL/ProductDataService/2.0.0/'
const PS_SHARED = 'http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization' }, 401)
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const body = await req.json()
    const { action, username, password, search, category, style_id, user_id, page, per_page } = body

    if (!username || !password) {
      return jsonResponse({ error: 'username and password are required' }, 400)
    }

    // ---- PromoStandards SOAP builders ----

    const buildGetProductSellable = (productId?: string) => `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="${PS_NS}" xmlns:shar="${PS_SHARED}">
  <soapenv:Header/>
  <soapenv:Body>
    <ns:GetProductSellableRequest>
      <shar:wsVersion>2.0.0</shar:wsVersion>
      <shar:id>${escapeXml(username)}</shar:id>
      <shar:password>${escapeXml(password)}</shar:password>
      ${productId ? `<shar:productId>${escapeXml(productId)}</shar:productId>` : ''}
      <shar:isSellable>true</shar:isSellable>
    </ns:GetProductSellableRequest>
  </soapenv:Body>
</soapenv:Envelope>`

    const buildGetProduct = (productId: string) => `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="${PS_NS}" xmlns:shar="${PS_SHARED}">
  <soapenv:Header/>
  <soapenv:Body>
    <ns:GetProductRequest>
      <shar:wsVersion>2.0.0</shar:wsVersion>
      <shar:id>${escapeXml(username)}</shar:id>
      <shar:password>${escapeXml(password)}</shar:password>
      <shar:localizationCountry>US</shar:localizationCountry>
      <shar:localizationLanguage>en</shar:localizationLanguage>
      <shar:productId>${escapeXml(productId)}</shar:productId>
    </ns:GetProductRequest>
  </soapenv:Body>
</soapenv:Envelope>`

    // Make a SOAP call
    const soapCall = async (xmlBody: string): Promise<string> => {
      console.log('Making PromoStandards SOAP call...')
      const res = await fetch(PS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '' },
        body: xmlBody,
      })
      const text = await res.text()
      console.log('SanMar response status:', res.status, 'body length:', text.length)
      console.log('SanMar response preview:', text.substring(0, 800))

      const lowerText = text.toLowerCase()
      // PromoStandards returns auth errors as ServiceMessage with severity=Error
      if (lowerText.includes('authentication') && (lowerText.includes('failed') || lowerText.includes('credentials'))) {
        throw new Error('Authentication failed. Please verify your SanMar.com username and password. Ensure your account has Web Services access by emailing sanmarintegrations@sanmar.com.')
      }
      // Check for ServiceMessage errors (PromoStandards error pattern)
      const severity = extractTag(text, 'severity')
      const errorCode = extractTag(text, 'code')
      if (severity?.toLowerCase() === 'error') {
        // Code 130 = "Product Id not found" — not a real error, just no results
        if (errorCode === '130') {
          return text // let caller handle empty results
        }
        const desc = extractTag(text, 'description') || 'Unknown error'
        throw new Error(`SanMar error: ${desc}`)
      }
      if (lowerText.includes('fault')) {
        const faultMsg = extractTag(text, 'faultstring') || extractTag(text, 'faultString') || text.substring(0, 300)
        throw new Error(`SanMar error: ${faultMsg}`)
      }
      if (!res.ok) {
        throw new Error(`SanMar API error ${res.status}: ${text.substring(0, 300)}`)
      }
      return text
    }

    // XML helpers
    const extractTag = (xml: string, tag: string): string => {
      const regex = new RegExp(`<(?:[^:]+:)?${tag}(?:\\s[^>]*)?>([^<]*)</(?:[^:]+:)?${tag}>`, 'i')
      const match = xml.match(regex)
      return match ? match[1].trim() : ''
    }

    const extractAllBlocks = (xml: string, tag: string): string[] => {
      // Use (?=[\\s>/]) to prevent 'Part' from matching 'PartArray'
      const regex = new RegExp(`<(?:[^:]+:)?${tag}(?=[\\s>/])([^>]*)>([\\s\\S]*?)</(?:[^:]+:)?${tag}>`, 'gi')
      const results: string[] = []
      let match
      while ((match = regex.exec(xml)) !== null) {
        results.push(match[2])
      }
      return results
    }

    // Parse GetProductSellable response — returns array of {productId, partId}
    const parseProductSellable = (xml: string): Array<{productId: string, partId?: string}> => {
      // Code 130 / "not found" are handled upstream — just return empty
      const errorCode = extractTag(xml, 'code')
      if (errorCode === '130') return []
      const errorMsg = extractTag(xml, 'errorMessage')
      if (errorMsg && !errorMsg.toLowerCase().includes('not found')) throw new Error(errorMsg)

      const products: Array<{productId: string, partId?: string}> = []
      const productBlocks = extractAllBlocks(xml, 'ProductSellable')
      
      for (const block of productBlocks) {
        const productId = extractTag(block, 'productId')
        const partId = extractTag(block, 'partId')
        if (productId) {
          products.push({ productId, partId: partId || undefined })
        }
      }
      return products
    }

    // Parse GetProduct response — returns detailed product data
    const parseGetProduct = (xml: string) => {
      const errorMsg = extractTag(xml, 'errorMessage')
      if (errorMsg && !xml.toLowerCase().includes('product')) throw new Error(errorMsg)

      const productName = extractTag(xml, 'productName')
      const description = extractTag(xml, 'description')
      const productBrand = extractTag(xml, 'productBrand')
      const productCat = extractTag(xml, 'ProductCategory') || extractTag(xml, 'productCategory')

      // Parse parts — PromoStandards uses <ns2:Part> or <Part> inside <PartArray>
      // The Part tag can conflict with other tags, so try PartArray first
      let partBlocks = extractAllBlocks(xml, 'Part')
      
      // Filter out PartArray wrapper blocks — we want individual Part elements only
      // Each Part should contain partId
      partBlocks = partBlocks.filter(b => {
        const hasPartId = b.toLowerCase().includes('partid')
        const isWrapper = b.includes('<Part>') || b.includes(':Part>')
        return hasPartId && !isWrapper
      })

      console.log(`parseGetProduct: found ${partBlocks.length} Part blocks for ${productName}`)
      if (partBlocks.length === 0) {
        // Fallback: try extracting from ProductPartArray or PartArray
        const partArrayContent = extractAllBlocks(xml, 'ProductPartArray').join('') || extractAllBlocks(xml, 'PartArray').join('')
        if (partArrayContent) {
          partBlocks = extractAllBlocks(partArrayContent, 'Part')
          console.log(`parseGetProduct: fallback found ${partBlocks.length} Part blocks from PartArray`)
        }
      }
      if (partBlocks.length === 0) {
        // Last resort: log a sample of XML around "partId" to diagnose
        const idx = xml.toLowerCase().indexOf('partid')
        if (idx > -1) {
          console.log('parseGetProduct: XML near partId:', xml.substring(Math.max(0, idx - 200), idx + 300))
        } else {
          console.log('parseGetProduct: no partId found in XML at all. XML length:', xml.length)
        }
      }

      const parts: any[] = []
      for (const block of partBlocks) {
        const partId = extractTag(block, 'partId')
        const colorName = extractTag(block, 'colorName') || extractTag(block, 'Color')
        const sizeName = extractTag(block, 'apparelSize') || extractTag(block, 'labelSize') || extractTag(block, 'Size')
        const partPrice = extractTag(block, 'partPrice') || extractTag(block, 'price')
        const primaryImage = extractTag(block, 'url')

        const mediaBlocks = extractAllBlocks(block, 'MediaContent')
        let frontImage = ''
        let backImage = ''
        let swatchImage = ''
        for (const media of mediaBlocks) {
          const url = extractTag(media, 'url')
          const mediaType = extractTag(media, 'mediaType')?.toLowerCase()
          const classType = extractTag(media, 'classType')?.toLowerCase()
          if (!url) continue
          if (classType?.includes('front') || mediaType?.includes('front')) frontImage = frontImage || url
          else if (classType?.includes('back') || mediaType?.includes('back')) backImage = backImage || url
          else if (classType?.includes('swatch') || mediaType?.includes('swatch')) swatchImage = swatchImage || url
          else if (!frontImage) frontImage = url
        }

        parts.push({
          partId,
          color: colorName,
          size: sizeName,
          price: parseFloat(partPrice || '0'),
          frontImage: frontImage || primaryImage,
          backImage,
          swatchImage,
        })
      }

      return {
        productName: productName || '',
        description: description || '',
        brand: productBrand || 'SanMar',
        category: productCat || 'Apparel',
        parts,
      }
    }

    // ACTION: browse — search by style/product ID
    if (action === 'browse') {
      try {
        if (!search || !search.trim()) {
          return jsonResponse({
            styles: [],
            page: 1,
            per_page: per_page || 50,
            total: 0,
            total_pages: 0,
            message: 'Enter a style number (e.g. PC61, DT6000, ST350) to search the SanMar catalog.',
          })
        }

        // Search by specific product/style ID
        const styleQuery = search.trim().toUpperCase()
        const xmlBody = buildGetProductSellable(styleQuery)
        const xml = await soapCall(xmlBody)
        const sellableProducts = parseProductSellable(xml)

        // Deduplicate by productId and fall back to direct product lookup for valid styles
        // that may not be returned by GetProductSellable.
        let uniqueIds = [...new Set(sellableProducts.map(p => p.productId))]
        const detailCache = new Map<string, any>()

        if (!uniqueIds.length) {
          try {
            const detailXml = await soapCall(buildGetProduct(styleQuery))
            const detail = parseGetProduct(detailXml)
            if (detail.productName || detail.parts.length) {
              uniqueIds = [styleQuery]
              detailCache.set(styleQuery, detail)
            }
          } catch {
            // Leave empty and return a graceful no-results response
          }
        }

        const pageSize = per_page || 50
        const currentPage = page || 1
        const totalCount = uniqueIds.length
        const totalPages = Math.ceil(totalCount / pageSize)
        const startIdx = (currentPage - 1) * pageSize
        const paged = uniqueIds.slice(startIdx, startIdx + pageSize)

        // Enrich results with product details (since we're searching specific styles, count is small)
        const styles: any[] = []
        const enrichPromises = paged.map(async (id) => {
          try {
            const detail = detailCache.get(id) ?? parseGetProduct(await soapCall(buildGetProduct(id)))
            const uniqueColors = new Set(detail.parts.map(p => p.color).filter(Boolean))
            styles.push({
              styleID: id,
              styleName: id,
              brandName: detail.brand,
              title: detail.productName,
              baseCategory: detail.category,
              styleImage: detail.parts[0]?.frontImage || null,
              customerPrice: detail.parts[0]?.price || 0,
              colorCount: uniqueColors.size,
            })
          } catch {
            styles.push({
              styleID: id, styleName: id, brandName: 'SanMar', title: '',
              baseCategory: 'Apparel', styleImage: null, customerPrice: 0, colorCount: 0,
            })
          }
        })
        await Promise.all(enrichPromises)

        return jsonResponse({
          styles,
          page: currentPage,
          per_page: pageSize,
          total: totalCount,
          total_pages: totalPages,
        })
      } catch (err: any) {
        return jsonResponse({ error: err.message }, err.message.includes('uthenticat') ? 401 : 500)
      }
    }

    // ACTION: details — fetch full product info for a style
    if (action === 'details') {
      if (!style_id) {
        return jsonResponse({ error: 'style_id is required' }, 400)
      }
      try {
        const xml = await soapCall(buildGetProduct(style_id))
        const product = parseGetProduct(xml)

        // Group parts by color
        const colorMap = new Map<string, any[]>()
        for (const part of product.parts) {
          const colorName = part.color || 'Default'
          if (!colorMap.has(colorName)) colorMap.set(colorName, [])
          colorMap.get(colorName)!.push(part)
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
          styleID: style_id,
          styleName: style_id,
          brandName: product.brand,
          title: product.productName,
          description: product.description,
          baseCategory: product.category,
          variants,
        })
      } catch (err: any) {
        return jsonResponse({ error: err.message }, 500)
      }
    }

    // ACTION: import / sync
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
          const xml = await soapCall(buildGetProduct(sid))
          const product = parseGetProduct(xml)

          if (!product.parts.length) continue

          const colorMap = new Map<string, any[]>()
          for (const part of product.parts) {
            const colorName = part.color || 'Default'
            if (!colorMap.has(colorName)) colorMap.set(colorName, [])
            colorMap.get(colorName)!.push(part)
          }

          const variants = Array.from(colorMap.entries()).map(([colorName, parts]) => ({
            color: colorName,
            hex: null,
            image: parts[0].frontImage || null,
            sizes: parts.map(p => ({
              size: p.size || 'OS',
              sku: p.partId || `${sid}-${colorName}-${p.size || 'OS'}`,
              price: p.price,
              qty: 0,
            })),
          }))

          const firstPart = product.parts[0]
          const productName = `${product.brand} ${sid}`.trim()
          const supplierSource = {
            provider: 'sanmar',
            style_id: sid,
            style_name: sid,
            brand: product.brand,
            last_synced: new Date().toISOString(),
          }

          const { data: existing } = await supabase
            .from('inventory_products')
            .select('id')
            .eq('user_id', targetUserId)
            .filter('supplier_source->>provider', 'eq', 'sanmar')
            .filter('supplier_source->>style_id', 'eq', String(sid))
            .maybeSingle()

          const payload = {
            name: productName,
            category: product.category || 'apparel',
            description: product.description || null,
            base_price: firstPart.price,
            image_front: firstPart.frontImage || null,
            image_back: firstPart.backImage || null,
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
          continue
        }
      }

      return jsonResponse({ imported, updated, total: styleIds.length })
    }

    // ACTION: categories — SanMar doesn't expose categories via PromoStandards, return common ones
    if (action === 'categories') {
      const categories = [
        'T-Shirts', 'Polos/Knits', 'Sweatshirts/Fleece', 'Woven Shirts',
        'Caps', 'Bags', 'Outerwear', 'Activewear', 'Youth',
        'Women\'s', 'Tall', 'Accessories', 'Bottoms',
        'Infant & Toddler', 'Workwear', 'Personal Protection'
      ]
      return jsonResponse({ categories })
    }

    return jsonResponse({ error: 'Invalid action. Use: browse, import, sync, details, categories' }, 400)
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function jsonResponse(data: any, status = 200) {
  return new Response(
    JSON.stringify(data),
    { status, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' } }
  )
}
