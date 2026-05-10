/**
 * Customizer Studio — Universal Loader
 *
 * Paste this single script tag in your store's <head> or before </body>.
 * It will automatically attach the product customizer to any element
 * with the `data-customizer` attribute.
 *
 * Usage:
 *   <script
 *     src="https://YOUR_DOMAIN/customizer-loader.js"
 *     data-api-url="https://YOUR_API_URL/functions/v1"
 *     data-base-url="https://YOUR_DOMAIN"
 *   ></script>
 *
 *   <!-- Opens customizer for a specific product (by name): -->
 *   <button data-customizer data-product-name="Classic T-Shirt">Customize</button>
 *
 *   <!-- Opens customizer for a specific product (by ID): -->
 *   <button data-customizer data-product-id="abc-123">Customize</button>
 *
 *   <!-- Opens a product picker showing all active products: -->
 *   <button data-customizer>Customize a Product</button>
 */
(function () {
  'use strict';

  // --- Built-in defaults so the script works standalone (e.g. when injected via Shopify ScriptTag) ---
  var DEFAULT_BASE_URL = 'https://platform.printonet.com';
  var DEFAULT_API_URL = 'https://qumrnazgdrijdcihtkah.supabase.co/functions/v1';
  var DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bXJuYXpnZHJpamRjaWh0a2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTM2OTQsImV4cCI6MjA4OTUyOTY5NH0.zVeYe3358jl3Gen7jG2I6f_kAqY1MLf1uAMn8EOb99I';

  // --- Read config from the script tag itself (with fallbacks) ---
  var scriptTag = document.currentScript;
  // Parse ?uid=... from the script's own src URL (set when Shopify ScriptTag injects the loader)
  var _scriptSrc = scriptTag && scriptTag.src ? scriptTag.src : '';
  var _srcParams = {};
  try {
    if (_scriptSrc) {
      var _u = new URL(_scriptSrc);
      _u.searchParams.forEach(function (v, k) { _srcParams[k] = v; });
    }
  } catch (e) { /* ignore */ }

  var API_URL = (scriptTag && scriptTag.getAttribute('data-api-url')) || DEFAULT_API_URL;
  var BASE_URL = (scriptTag && scriptTag.getAttribute('data-base-url')) || DEFAULT_BASE_URL;
  var SUPABASE_URL = API_URL.replace('/functions/v1', '');
  var ANON_KEY = (scriptTag && scriptTag.getAttribute('data-anon-key')) || DEFAULT_ANON_KEY;
  var USER_ID = (scriptTag && scriptTag.getAttribute('data-user-id')) || _srcParams.uid || '';
  var CART_URL = (scriptTag && scriptTag.getAttribute('data-cart-url')) || '';
  var STORE_SITE_URL =
    (scriptTag && scriptTag.getAttribute('data-store-site-url')) ||
    (typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : '');

  var _products = null; // cached after first fetch
  var _pickerOverlay = null;

  // --- Fetch all active products from the database ---
  function fetchProducts(callback) {
    if (_products) return callback(null, _products);

    var url = SUPABASE_URL + '/rest/v1/inventory_products?is_active=eq.true&select=id,name,category,description,base_price,image_front,image_back,image_side1,image_side2,variants,print_areas,user_id';
    var headers = {
      'apikey': ANON_KEY,
      'Authorization': 'Bearer ' + ANON_KEY,
      'Content-Type': 'application/json',
    };

    fetch(url, { headers: headers })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        _products = data;
        callback(null, data);
      })
      .catch(function (err) {
        callback(err, null);
      });
  }

  // --- Open customizer for a specific product ---
  // --- Get the currently selected Shopify variant ID ---
  function getShopifyVariantId() {
    if (!window.Shopify || !window.Shopify.product) return null;
    // Try to get selected variant from URL param
    var urlParams = new URLSearchParams(window.location.search);
    var variantParam = urlParams.get('variant');
    if (variantParam) return variantParam;
    // Try to get from the product form's hidden input
    var variantInput = document.querySelector('form[action="/cart/add"] input[name="id"]');
    if (variantInput) return variantInput.value;
    // Fallback: first available variant
    var variants = window.Shopify.product.variants;
    if (variants && variants.length > 0) return String(variants[0].id);
    return null;
  }

  function getWooProductForm() {
    return document.querySelector('form.variations_form.cart') || document.querySelector('form.cart');
  }

  /** Parse WooCommerce `data-product_variations` (may contain &quot; entities). */
  function parseDataProductVariations(form) {
    if (!form) return null;
    var raw = form.getAttribute('data-product_variations');
    if (!raw) return null;
    try {
      var decoded = raw.indexOf('&quot;') !== -1 ? raw.replace(/&quot;/g, '"') : raw;
      var parsed = JSON.parse(decoded);
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  /** Merge selected variation attributes + image from Woo JSON (works with swatches that hide selects). */
  function getWooVariationEnrichment(form, baseAttrs) {
    var attrs = Object.assign({}, baseAttrs || {});
    var thumbUrl = null;
    if (!form) return { attrs: attrs, thumbUrl: thumbUrl };

    var variations = parseDataProductVariations(form);
    var vidEl = form.querySelector('input.variation_id, input[name="variation_id"]');
    var vid = vidEl && vidEl.value && vidEl.value !== '0' ? String(vidEl.value) : null;

    if (variations && vid) {
      var row = variations.find(function (v) {
        return String(v.variation_id) === vid;
      });
      if (row) {
        if (row.attributes && typeof row.attributes === 'object') {
          Object.keys(row.attributes).forEach(function (k) {
            var val = row.attributes[k];
            if (val != null && String(val).trim() !== '') {
              attrs[k] = String(val).trim();
            }
          });
        }
        if (row.image && row.image.src) thumbUrl = row.image.src;
        else if (typeof row.image === 'string') thumbUrl = row.image;
      }
    }
    return { attrs: attrs, thumbUrl: thumbUrl };
  }

  function pickColorLabelFromAttrs(attrs) {
    if (!attrs || typeof attrs !== 'object') return '';
    var k;
    var prefix = '__display_';
    for (k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k.indexOf(prefix) === 0) {
        var base = k.substring(prefix.length).toLowerCase();
        if (base.indexOf('color') !== -1 || base.indexOf('colour') !== -1) {
          return attrs[k];
        }
      }
    }
    if (attrs.attribute_pa_color) return attrs.attribute_pa_color;
    for (k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k.toLowerCase().indexOf('color') !== -1 || k.toLowerCase().indexOf('colour') !== -1) {
        return attrs[k];
      }
    }
    return '';
  }

  function hasColorAttr(attrs) {
    if (!attrs || typeof attrs !== 'object') return false;
    return Object.keys(attrs).some(function (k) {
      var kl = String(k).toLowerCase();
      return kl.indexOf('color') !== -1 || kl.indexOf('colour') !== -1;
    });
  }

  /** Best-effort detection for swatch plugins that don't sync select[name^=attribute_] quickly. */
  function detectSelectedSwatchColor(form) {
    if (!form) return null;
    var candidates = [
      '.variable-item.selected',
      '[data-wvstooltip].selected',
      '[data-value][aria-pressed="true"]',
      '[role="radio"][aria-checked="true"]',
      '.swatch.selected',
      '.swatch-selected',
      '[data-value].selected',
    ];
    for (var i = 0; i < candidates.length; i++) {
      var el = form.querySelector(candidates[i]);
      if (!el) continue;
      var label =
        (el.getAttribute && (el.getAttribute('data-wvstooltip') || el.getAttribute('aria-label') || el.getAttribute('title'))) ||
        '';
      var value = (el.getAttribute && el.getAttribute('data-value')) || '';
      var text = (el.textContent || '').trim();
      var picked = String(label || value || text || '').trim();
      if (picked) {
        return { value: value || picked, label: label || picked };
      }
    }
    return null;
  }

  function injectCustomizerColorHints() {
    document.querySelectorAll('[data-customizer]').forEach(function (btn) {
      if (!btn.parentNode) return;
      if (btn.parentNode.querySelector('[data-printonet-customizer-hint]')) return;
      var hint = document.createElement('div');
      hint.setAttribute('data-printonet-customizer-hint', '1');
      hint.style.cssText =
        'margin-top:8px;font-size:13px;line-height:1.45;color:#444;display:none;' +
        'align-items:center;gap:8px;flex-wrap:wrap;';
      if (btn.nextSibling) btn.parentNode.insertBefore(hint, btn.nextSibling);
      else btn.parentNode.appendChild(hint);
    });
  }

  function refreshCustomizerColorHints() {
    if (!document.querySelector('[data-printonet-customizer-hint]')) return;

    var form = getWooProductForm();
    var isVariable = !!(form && parseDataProductVariations(form));

    var wooCtx = form ? getWooContext() : { wcAttributes: null };
    var base = wooCtx.wcAttributes ? Object.assign({}, wooCtx.wcAttributes) : {};
    var enriched = form ? getWooVariationEnrichment(form, base) : { attrs: base, thumbUrl: null };
    var merged = augmentWooAttributesWithSelectLabels(enriched.attrs, form) || enriched.attrs || {};
    var label = pickColorLabelFromAttrs(merged);
    var thumb = enriched.thumbUrl;

    var vidEl = form && form.querySelector('input[name="variation_id"]');
    var hasVariation = !!(vidEl && vidEl.value && vidEl.value !== '0');

    document.querySelectorAll('[data-printonet-customizer-hint]').forEach(function (el) {
      el.innerHTML = '';
      if (!form || !isVariable) {
        el.style.display = 'none';
        return;
      }

      if (!hasVariation && !label) {
        el.style.display = 'flex';
        var pick = document.createElement('span');
        pick.textContent = 'Choose color and options above — the customizer will match your selection.';
        el.appendChild(pick);
        return;
      }

      el.style.display = 'flex';
      if (thumb) {
        var img = document.createElement('img');
        img.src = thumb;
        img.alt = '';
        img.width = 32;
        img.height = 32;
        img.style.cssText =
          'width:32px;height:32px;object-fit:cover;border-radius:50%;border:1px solid #ddd;flex-shrink:0;';
        el.appendChild(img);
      }
      var span = document.createElement('span');
      if (label) {
        span.textContent = 'Customizer opens with this color: ' + label + '.';
      } else {
        span.textContent = 'Customizer will use your selected product options.';
      }
      el.appendChild(span);
    });
  }

  function bindWooCustomizerHintSync() {
    var form = getWooProductForm();
    if (!form || form._printonetHintBound) return;
    if (!document.querySelector('[data-printonet-customizer-hint]')) return;
    form._printonetHintBound = true;

    function tick() {
      refreshCustomizerColorHints();
    }

    form.addEventListener('change', tick);
    form.addEventListener('keyup', tick);

    var vid = form.querySelector('input[name="variation_id"]');
    if (vid) {
      vid.addEventListener('change', tick);
      vid.addEventListener('input', tick);
      try {
        var mo = new MutationObserver(tick);
        mo.observe(vid, { attributes: true, attributeFilter: ['value'] });
      } catch (e) { /* ignore */ }
    }

    try {
      form.addEventListener('woocommerce_variation_has_changed', tick);
    } catch (e2) { /* ignore */ }

    tick();
  }

  /** Add visible <select> option labels so the customizer can match human color names to catalog variants. */
  function augmentWooAttributesWithSelectLabels(attrs, formOpt) {
    if (!attrs || typeof attrs !== 'object') return attrs;
    var form = formOpt || getWooProductForm() || document.querySelector('form.cart');
    if (!form) return attrs;
    var out = Object.assign({}, attrs);
    Object.keys(attrs).forEach(function (key) {
      var kl = key.toLowerCase();
      if (kl.indexOf('color') === -1 && kl.indexOf('colour') === -1) return;
      var sel = form.querySelector('select[name="' + key.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]');
      if (!sel || sel.tagName !== 'SELECT' || sel.selectedIndex < 0) return;
      var opt = sel.options[sel.selectedIndex];
      if (!opt || !opt.textContent) return;
      var txt = opt.textContent.trim();
      if (txt) out['__display_' + key] = txt;
    });
    return out;
  }

  function getWooContext() {
    var out = { wcProductId: null, wcVariationId: null, wcAttributes: null };
    var form = getWooProductForm();
    if (!form) return out;

    // Prefer explicit add-to-cart value; fallback to hidden product_id.
    var pidInput = form.querySelector('input[name="add-to-cart"], input[name="product_id"]');
    if (pidInput && pidInput.value) out.wcProductId = String(pidInput.value);

    var vidInput = form.querySelector('input[name="variation_id"]');
    if (vidInput && vidInput.value && vidInput.value !== '0') out.wcVariationId = String(vidInput.value);

    var attrs = {};
    var attrInputs = form.querySelectorAll('select[name^="attribute_"], input[name^="attribute_"][type="hidden"], input[name^="attribute_"][type="radio"]:checked');
    attrInputs.forEach(function (el) {
      var key = (el.name || '').trim();
      var val = (el.value || '').trim();
      if (!key || !val) return;
      attrs[key] = val;
    });
    if (!hasColorAttr(attrs)) {
      var sw = detectSelectedSwatchColor(form);
      if (sw && sw.value) {
        attrs.attribute_pa_color = String(sw.value).trim();
        if (sw.label) attrs.__display_attribute_pa_color = String(sw.label).trim();
      }
    }
    if (Object.keys(attrs).length > 0) out.wcAttributes = attrs;
    return out;
  }

  function openForProduct(product, wcProductId, shopifyVariantId, wcVariationId, wcAttributes) {
    if (!window.CustomizerStudio) {
      console.error('[CustomizerLoader] SDK not loaded');
      return;
    }
    window.CustomizerStudio.init({
      apiUrl: API_URL,
      baseUrl: BASE_URL,
      cartUrl: CART_URL,
      woocommerceSiteUrl: STORE_SITE_URL || '',
    });
    window.CustomizerStudio.open({
      product: {
        name: product.name,
        category: product.category,
        image_front: product.image_front || undefined,
        image_back: product.image_back || undefined,
        image_side1: product.image_side1 || undefined,
        image_side2: product.image_side2 || undefined,
        variants: product.variants || [],
        print_areas: product.print_areas || undefined,
      },
      userId: product.user_id || USER_ID || null,
      wcProductId: wcProductId || null,
      wcVariationId: wcVariationId || null,
      wcAttributes: augmentWooAttributesWithSelectLabels(wcAttributes, getWooProductForm()) || null,
      shopifyVariantId: shopifyVariantId || null,
      onComplete: function (result) {
        var evt = new CustomEvent('customizer:complete', { detail: result });
        document.dispatchEvent(evt);
      },
      onCancel: function () {
        var evt = new CustomEvent('customizer:cancel');
        document.dispatchEvent(evt);
      },
    });
  }

  // --- Show a product picker modal ---
  function showPicker(products) {
    if (_pickerOverlay) return;

    _pickerOverlay = document.createElement('div');
    _pickerOverlay.style.cssText = 'position:fixed;inset:0;z-index:999998;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;';

    var panel = document.createElement('div');
    panel.style.cssText = 'background:#fff;border-radius:16px;max-width:560px;width:92vw;max-height:80vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.3);';

    // Header
    var header = document.createElement('div');
    header.style.cssText = 'padding:24px 24px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eee;';
    header.innerHTML = '<div style="font-size:18px;font-weight:600;">Choose a product to customize</div>';
    var closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;padding:4px 8px;border-radius:8px;color:#666;';
    closeBtn.onmouseover = function () { closeBtn.style.background = '#f3f3f3'; };
    closeBtn.onmouseout = function () { closeBtn.style.background = 'none'; };
    closeBtn.onclick = closePicker;
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Product list
    var list = document.createElement('div');
    list.style.cssText = 'padding:12px;';

    products.forEach(function (p) {
      var item = document.createElement('button');
      item.style.cssText = 'display:flex;align-items:center;gap:16px;width:100%;padding:12px;border:1px solid #eee;border-radius:12px;background:#fff;cursor:pointer;margin-bottom:8px;text-align:left;transition:border-color 0.15s,box-shadow 0.15s;';
      item.onmouseover = function () { item.style.borderColor = '#999'; item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; };
      item.onmouseout = function () { item.style.borderColor = '#eee'; item.style.boxShadow = 'none'; };

      var imgHtml = p.image_front
        ? '<img src="' + p.image_front + '" style="width:56px;height:56px;object-fit:cover;border-radius:8px;background:#f5f5f5;" />'
        : '<div style="width:56px;height:56px;border-radius:8px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:24px;">⬡</div>';

      item.innerHTML = imgHtml +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-weight:500;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + p.name + '</div>' +
          '<div style="font-size:13px;color:#888;margin-top:2px;">' + p.category + ' · $' + Number(p.base_price).toFixed(2) + '</div>' +
        '</div>' +
        '<div style="font-size:13px;color:#7c3aed;font-weight:500;white-space:nowrap;">Customize →</div>';

      item.onclick = function () {
        closePicker();
        openForProduct(p, null, getShopifyVariantId());
      };
      list.appendChild(item);
    });

    if (products.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:32px;color:#888;">No products available</div>';
    }

    panel.appendChild(list);
    _pickerOverlay.appendChild(panel);
    document.body.appendChild(_pickerOverlay);
    document.body.style.overflow = 'hidden';

    _pickerOverlay.addEventListener('click', function (e) {
      if (e.target === _pickerOverlay) closePicker();
    });
  }

  function closePicker() {
    if (_pickerOverlay && _pickerOverlay.parentNode) {
      _pickerOverlay.parentNode.removeChild(_pickerOverlay);
    }
    _pickerOverlay = null;
    document.body.style.overflow = '';
  }

  // --- Handle click on any [data-customizer] element ---
  function handleClick(e) {
    var el = e.target.closest('[data-customizer]');
    if (!el) return;

    e.preventDefault();

    var productId = (el.getAttribute('data-product-id') || '').trim();
    var productName = (el.getAttribute('data-product-name') || '').trim();
    var wcProductId = (el.getAttribute('data-wc-product-id') || '').trim();
    var wcVariationId = (el.getAttribute('data-wc-variation-id') || '').trim();
    var wcAttributes = null;
    var wcAttrsRaw = (el.getAttribute('data-wc-attributes') || '').trim();
    if (wcAttrsRaw) {
      try { wcAttributes = JSON.parse(wcAttrsRaw); } catch (_) {}
    }
    // Automatic Woo fallback from current product form + variation JSON (swatches).
    var wooCtx = getWooContext();
    var wooForm = getWooProductForm();
    if (!wcProductId && wooCtx.wcProductId) wcProductId = wooCtx.wcProductId;
    if (!wcVariationId && wooCtx.wcVariationId) wcVariationId = wooCtx.wcVariationId;

    var mergedAttrs = Object.assign({}, wooCtx.wcAttributes || {}, wcAttributes || {});
    if (wooForm) {
      mergedAttrs = getWooVariationEnrichment(wooForm, mergedAttrs).attrs;
    }
    if (!hasColorAttr(mergedAttrs)) {
      var swFallback = detectSelectedSwatchColor(wooForm);
      if (swFallback && swFallback.value) {
        mergedAttrs.attribute_pa_color = String(swFallback.value).trim();
        if (swFallback.label) {
          mergedAttrs.__display_attribute_pa_color = String(swFallback.label).trim();
        }
      }
    }
    wcAttributes = augmentWooAttributesWithSelectLabels(mergedAttrs, wooForm);
    if (!wcAttributes || Object.keys(wcAttributes).length === 0) wcAttributes = null;
    var shopifyVariantId = (el.getAttribute('data-shopify-variant-id') || '').trim() || getShopifyVariantId();

    fetchProducts(function (err, products) {
      if (err || !products) {
        console.error('[CustomizerLoader] Failed to load products:', err);
        return;
      }

      var match = null;
      if (productId) {
        match = products.find(function (p) { return p.id === productId; });
      } else if (productName) {
        var needle = productName.toLowerCase();
        match = products.find(function (p) { return p.name.toLowerCase() === needle; });
      }

      if (match) {
        try {
          console.info('[CustomizerLoader] PDP selection', {
            wcProductId: wcProductId || null,
            wcVariationId: wcVariationId || null,
            wcAttributes: wcAttributes || null,
          });
        } catch (_) { /* ignore */ }
        openForProduct(match, wcProductId, shopifyVariantId, wcVariationId, wcAttributes);
      } else if (!productId && !productName) {
        showPicker(products);
      } else {
        console.warn('[CustomizerLoader] Product not found. Searched for:', productId ? 'id=' + productId : 'name=' + productName);
        console.warn('[CustomizerLoader] Available products:', products.map(function(p) { return { id: p.id, name: p.name }; }));
        showPicker(products);
      }
    });
  }

  // --- Load the SDK script ---
  function loadSDK(cb) {
    if (window.CustomizerStudio) return cb();
    var s = document.createElement('script');
    // Cache-bust to ensure store pages pick up latest SDK logic immediately.
    s.src = BASE_URL + '/customizer-sdk.js?v=20260508-5';
    s.onload = cb;
    s.onerror = function () { console.error('[CustomizerLoader] Failed to load SDK'); };
    document.head.appendChild(s);
  }

  // --- Auto-inject "Customize" button on Shopify product pages ---
  function autoInjectButton(attempt) {
    attempt = attempt || 0;

    // Don't inject if there's already a data-customizer element
    if (document.querySelector('[data-customizer]')) return;

    // Detect Shopify: check window.Shopify or URL pattern
    var isShopify = !!(window.Shopify);
    var isProductPage = isShopify && (
      (window.Shopify.product) ||
      /\/products\/[^/]+/.test(window.location.pathname)
    );

    if (!isProductPage) return;

    // Get product name from Shopify object, meta tag, or page title
    var productName = '';
    if (window.Shopify && window.Shopify.product) {
      productName = window.Shopify.product.title || window.Shopify.product.handle || '';
    }
    if (!productName) {
      var metaTag = document.querySelector('meta[property="og:title"]');
      if (metaTag) productName = metaTag.getAttribute('content') || '';
    }
    if (!productName) {
      // Extract from URL: /products/my-product -> my product
      var match = window.location.pathname.match(/\/products\/([^/?#]+)/);
      if (match) productName = match[1].replace(/-/g, ' ');
    }
    if (!productName) {
      productName = document.title.split('–')[0].split('|')[0].trim();
    }

    // Find the best place to inject
    var targets = [
      '.product-form__submit',                            // Dawn theme
      'form[action="/cart/add"] [type="submit"]',         // Add to cart button
      '.shopify-payment-button',                          // Dynamic checkout
      'form[action="/cart/add"]',                         // Cart form
      '.product-form',                                    // Generic product form
      '.product__info-wrapper',                           // Dawn product info
      '.product-single__meta',                            // Debut theme
      '.product-single__description',                     // Debut description
      '#product-price',                                   // Some themes
      '.product__title',                                  // Fallback
    ];

    var anchor = null;
    for (var i = 0; i < targets.length; i++) {
      anchor = document.querySelector(targets[i]);
      if (anchor) break;
    }

    // If no anchor found yet and we haven't retried too much, wait and retry
    if (!anchor) {
      if (attempt < 10) {
        setTimeout(function () { autoInjectButton(attempt + 1); }, 500);
      } else {
        console.warn('[CustomizerLoader] Could not find a place to inject the Customize button');
      }
      return;
    }

    var btn = document.createElement('button');
    btn.setAttribute('data-customizer', '');
    btn.setAttribute('data-product-name', productName);
    btn.type = 'button';
    btn.textContent = '🎨 Customize This Product';
    btn.style.cssText =
      'display:block;width:100%;margin-top:12px;margin-bottom:16px;padding:14px 24px;' +
      'font-size:15px;font-weight:600;font-family:inherit;' +
      'background:#7c3aed;color:#fff;border:none;border-radius:8px;' +
      'cursor:pointer;transition:background .15s,transform .1s;' +
      'text-align:center;letter-spacing:0.02em;';
    btn.onmouseover = function () { btn.style.background = '#6d28d9'; };
    btn.onmouseout = function () { btn.style.background = '#7c3aed'; };
    btn.onmousedown = function () { btn.style.transform = 'scale(0.98)'; };
    btn.onmouseup = function () { btn.style.transform = 'scale(1)'; };

    // Insert after the anchor element
    if (anchor.parentNode) {
      anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    }

    console.log('[CustomizerLoader] Auto-injected Customize button for:', productName);
  }

  // --- Initialize ---
  function init() {
    loadSDK(function () {
      window.CustomizerStudio.init({
        apiUrl: API_URL,
        baseUrl: BASE_URL,
        cartUrl: CART_URL,
        woocommerceSiteUrl: STORE_SITE_URL || '',
      });
      document.addEventListener('click', handleClick);
      // Auto-show floating cart widget on store pages
      window.CustomizerStudio.showCartWidget();
      // Auto-inject button on Shopify product pages
      autoInjectButton();
      // PDP hint: selected Woo variation ↔ customizer (after theme renders buttons)
      setTimeout(function () {
        injectCustomizerColorHints();
        bindWooCustomizerHintSync();
      }, 150);
      setTimeout(function () {
        refreshCustomizerColorHints();
      }, 600);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
