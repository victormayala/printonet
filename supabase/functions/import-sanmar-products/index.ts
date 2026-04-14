const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// SanMar uses SOAP/XML APIs
// Standard API: https://ws.sanmar.com:8080/SanMarWebService/SanMarProductInfoServicePort?wsdl
// Auth: customerNumber + sanmar.com username + sanmar.com password
const SANMAR_STANDARD_WSDL = 'https://ws.sanmar.com:8080/SanMarWebService/SanMarProductInfoServicePort?wsdl'
const SANMAR_STANDARD_ENDPOINT = 'https://ws.sanmar.com:8080/SanMarWebService/SanMarProductInfoServicePort'

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
    const { action, customer_number, username, password, search, category, style_id, user_id, page, per_page } = body

    if (!customer_number || !username || !password) {
      return jsonResponse({ error: 'customer_number, username, and password are required' }, 400)
    }

    // Build SOAP XML for getProductInfoByStyleColorSize
    const buildProductInfoRequest = (style: string, color?: string, size?: string) => {
      return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:impl="http://impl.webservice.integration.sanmar.com/">
  <soapenv:Header/>
  <soapenv:Body>
    <impl:getProductInfoByStyleColorSize>
      <arg0>
        ${color ? `<color>${escapeXml(color)}</color>` : '<color></color>'}
        ${size ? `<size>${escapeXml(size)}</size>` : '<size></size>'}
        <style>${escapeXml(style)}</style>
      </arg0>
      <arg1>
        <sanMarCustomerNumber>${escapeXml(customer_number)}</sanMarCustomerNumber>
        <sanMarUserName>${escapeXml(username)}</sanMarUserName>
        <sanMarUserPassword>${escapeXml(password)}</sanMarUserPassword>
      </arg1>
    </impl:getProductInfoByStyleColorSize>
  </soapenv:Body>
</soapenv:Envelope>`
    }

    // Build SOAP XML for getProductInfoByCategory
    const buildCategoryRequest = (cat: string) => {
      return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:impl="http://impl.webservice.integration.sanmar.com/">
  <soapenv:Header/>
  <soapenv:Body>
    <impl:getProductInfoByCategory>
      <arg0>
        <category>${escapeXml(cat)}</category>
      </arg0>
      <arg1>
        <sanMarCustomerNumber>${escapeXml(customer_number)}</sanMarCustomerNumber>
        <sanMarUserName>${escapeXml(username)}</sanMarUserName>
        <sanMarUserPassword>${escapeXml(password)}</sanMarUserPassword>
      </arg1>
    </impl:getProductInfoByCategory>
  </soapenv:Body>
</soapenv:Envelope>`
    }

    // Build SOAP XML for getProductInfoByBrand
    const buildBrandRequest = (brand: string) => {
      return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:impl="http://impl.webservice.integration.sanmar.com/">
  <soapenv:Header/>
  <soapenv:Body>
    <impl:getProductInfoByBrand>
      <arg0>
        <brand>${escapeXml(brand)}</brand>
      </arg0>
      <arg1>
        <sanMarCustomerNumber>${escapeXml(customer_number)}</sanMarCustomerNumber>
        <sanMarUserName>${escapeXml(username)}</sanMarUserName>
        <sanMarUserPassword>${escapeXml(password)}</sanMarUserPassword>
      </arg1>
    </impl:getProductInfoByBrand>
  </soapenv:Body>
</soapenv:Envelope>`
    }

    // Make a SOAP call and return raw XML text
    const soapCall = async (xmlBody: string): Promise<string> => {
      const res = await fetch(SANMAR_STANDARD_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': '',
        },
        body: xmlBody,
      })
      const text = await res.text()
      if (!res.ok) {
        // Check for auth errors
        if (text.includes('authentication failed') || text.includes('Authentication')) {
          throw new Error('Authentication failed. Please check your customer number, username, and password.')
        }
        throw new Error(`SanMar API error ${res.status}: ${text.substring(0, 200)}`)
      }
      return text
    }

    // Simple XML value extractor (no XML parser needed for well-structured SOAP responses)
    const extractTag = (xml: string, tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i')
      const match = xml.match(regex)
      return match ? match[1].trim() : ''
    }

    const extractAllTags = (xml: string, tag: string): string[] => {
      const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'gi')
      const results: string[] = []
      let match
      while ((match = regex.exec(xml)) !== null) {
        results.push(match[1].trim())
      }
      return results
    }

    // Parse product list from SanMar's getProductInfoByStyleColorSize response
    // Each <listResponse> block is one SKU (style+color+size)
    const parseProductListResponse = (xml: string) => {
      const errorOccurred = extractTag(xml, 'errorOccured') === 'true' || extractTag(xml, 'errorOccurred') === 'true'
      if (errorOccurred) {
        const msg = extractTag(xml, 'message')
        throw new Error(msg || 'SanMar returned an error')
      }

      // Split by listResponse blocks
      const blocks = xml.split(/<listResponse>/i).slice(1)
      const products: any[] = []

      for (const block of blocks) {
        const p: any = {
          style: extractTag(block, 'style'),
          brandName: extractTag(block, 'brandName'),
          productTitle: extractTag(block, 'productTitle'),
          productDescription: extractTag(block, 'productDescription'),
          productStatus: extractTag(block, 'productStatus'),
          color: extractTag(block, 'color'),
          catalogColor: extractTag(block, 'catalogColor'),
          size: extractTag(block, 'size'),
          uniqueKey: extractTag(block, 'uniqueKey'),
          inventoryKey: extractTag(block, 'inventoryKey'),
          piecePrice: extractTag(block, 'piecePrice'),
          casePrice: extractTag(block, 'casePrice'),
          pieceSalePrice: extractTag(block, 'pieceSalePrice'),
          caseSalePrice: extractTag(block, 'caseSalePrice'),
          category: extractTag(block, 'category'),
          colorProductImage: extractTag(block, 'colorProductImage'),
          colorSquareImage: extractTag(block, 'colorSquareImage'),
          colorSwatchImage: extractTag(block, 'colorSwatchImage'),
          thumbnailImage: extractTag(block, 'thumbnailImage'),
          productImage: extractTag(block, 'productImage'),
          frontModel: extractTag(block, 'frontModel'),
          backModel: extractTag(block, 'backModel'),
          sideModel: extractTag(block, 'sideModel'),
          frontFlat: extractTag(block, 'frontFlat'),
          backFlat: extractTag(block, 'backFlat'),
        }
        if (p.style) products.push(p)
      }

      return products
    }

    // ACTION: browse — search styles
    if (action === 'browse') {
      try {
        let xmlBody: string
        let products: any[] = []

        if (search && search.trim()) {
          // Search by style number first
          xmlBody = buildProductInfoRequest(search.trim())
          try {
            const xml = await soapCall(xmlBody)
            products = parseProductListResponse(xml)
          } catch (e: any) {
            // If style not found, it might be a brand search
            if (e.message.includes('Invalid Style') || e.message.includes('not found')) {
              try {
                xmlBody = buildBrandRequest(search.trim())
                const xml = await soapCall(xmlBody)
                products = parseProductListResponse(xml)
              } catch {
                // No results
                products = []
              }
            } else {
              throw e
            }
          }
        } else if (category && category !== 'all') {
          xmlBody = buildCategoryRequest(category)
          const xml = await soapCall(xmlBody)
          products = parseProductListResponse(xml)
        } else {
          // Default: fetch T-Shirts category
          xmlBody = buildCategoryRequest('T-Shirts')
          const xml = await soapCall(xmlBody)
          products = parseProductListResponse(xml)
        }

        // Group by style number
        const styleMap = new Map<string, any>()
        for (const p of products) {
          const styleNo = p.style
          if (!styleNo) continue
          if (!styleMap.has(styleNo)) {
            styleMap.set(styleNo, {
              styleID: styleNo,
              styleName: styleNo,
              brandName: p.brandName || 'SanMar',
              title: p.productTitle || '',
              baseCategory: p.category || 'Apparel',
              styleImage: p.colorProductImage || p.productImage || p.frontModel || null,
              customerPrice: parseFloat(p.piecePrice || '0'),
              colorCount: 0,
              colors: [],
            })
          }
          const style = styleMap.get(styleNo)!
          if (p.color && !style.colors.includes(p.color)) {
            style.colors.push(p.color)
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

        const items = paged.map(({ colors, ...rest }: any) => rest)

        return jsonResponse({
          styles: items,
          page: currentPage,
          per_page: pageSize,
          total: totalCount,
          total_pages: totalPages,
        })
      } catch (err: any) {
        return jsonResponse({ error: err.message }, err.message.includes('Authentication') ? 401 : 500)
      }
    }

    // ACTION: details — fetch variants for a specific style
    if (action === 'details') {
      if (!style_id) {
        return jsonResponse({ error: 'style_id is required' }, 400)
      }

      try {
        const xmlBody = buildProductInfoRequest(style_id)
        const xml = await soapCall(xmlBody)
        const products = parseProductListResponse(xml)

        // Group by color
        const colorMap = new Map<string, any[]>()
        let brandName = 'SanMar'
        let title = ''
        let description = ''
        let baseCategory = 'Apparel'

        for (const p of products) {
          brandName = p.brandName || brandName
          title = p.productTitle || title
          description = p.productDescription || description
          baseCategory = p.category || baseCategory

          const colorName = p.color || 'Default'
          if (!colorMap.has(colorName)) colorMap.set(colorName, [])
          colorMap.get(colorName)!.push(p)
        }

        const variants = Array.from(colorMap.entries()).map(([colorName, skus]) => {
          const first = skus[0]
          return {
            color: colorName,
            hex: null,
            colorFrontImage: first.colorProductImage || first.frontModel || null,
            colorSwatchImage: first.colorSwatchImage || first.colorSquareImage || null,
            sizes: skus.map((s: any) => ({
              size: s.size || 'OS',
              sku: s.uniqueKey || `${style_id}-${colorName}-${s.size || 'OS'}`,
              price: parseFloat(s.piecePrice || '0'),
              casePrice: parseFloat(s.casePrice || '0'),
              salePrice: parseFloat(s.pieceSalePrice || '0'),
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
          const xmlBody = buildProductInfoRequest(sid)
          const xml = await soapCall(xmlBody)
          const products = parseProductListResponse(xml)

          if (!products.length) continue

          const firstProd = products[0]
          const brandName = firstProd.brandName || 'SanMar'
          const productTitle = firstProd.productTitle || ''

          // Group by color
          const colorMap = new Map<string, any[]>()
          for (const p of products) {
            const colorName = p.color || 'Default'
            if (!colorMap.has(colorName)) colorMap.set(colorName, [])
            colorMap.get(colorName)!.push(p)
          }

          const variants = Array.from(colorMap.entries()).map(([colorName, skus]) => {
            const first = skus[0]
            return {
              color: colorName,
              hex: null,
              image: first.colorProductImage || first.frontModel || null,
              sizes: skus.map((s: any) => ({
                size: s.size || 'OS',
                sku: s.uniqueKey || `${sid}-${colorName}-${s.size || 'OS'}`,
                price: parseFloat(s.piecePrice || '0'),
                qty: 0,
              })),
            }
          })

          const imageFront = firstProd.colorProductImage || firstProd.frontModel || firstProd.productImage || null
          const imageBack = firstProd.backModel || firstProd.backFlat || null

          const productName = `${brandName} ${sid}`.trim()
          const supplierSource = {
            provider: 'sanmar',
            style_id: sid,
            style_name: sid,
            brand: brandName,
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
            category: firstProd.category || 'apparel',
            description: productTitle || firstProd.productDescription || null,
            base_price: parseFloat(firstProd.piecePrice || '0'),
            image_front: imageFront,
            image_back: imageBack,
            image_side1: firstProd.sideModel || null,
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

    // ACTION: categories
    if (action === 'categories') {
      // SanMar's documented categories
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
