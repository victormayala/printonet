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

  // --- Read config from the script tag itself ---
  var scriptTag = document.currentScript;
  var API_URL = scriptTag && scriptTag.getAttribute('data-api-url') || '';
  var BASE_URL = scriptTag && scriptTag.getAttribute('data-base-url') || '';
  var SUPABASE_URL = API_URL.replace('/functions/v1', '');
  var ANON_KEY = scriptTag && scriptTag.getAttribute('data-anon-key') || '';
  var USER_ID = scriptTag && scriptTag.getAttribute('data-user-id') || '';
  var CART_URL = scriptTag && scriptTag.getAttribute('data-cart-url') || '';

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

  function openForProduct(product, wcProductId, shopifyVariantId) {
    if (!window.CustomizerStudio) {
      console.error('[CustomizerLoader] SDK not loaded');
      return;
    }
    window.CustomizerStudio.init({ apiUrl: API_URL, baseUrl: BASE_URL, cartUrl: CART_URL });
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
        openForProduct(p);
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
        openForProduct(match, wcProductId);
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
    s.src = BASE_URL + '/customizer-sdk.js';
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
      window.CustomizerStudio.init({ apiUrl: API_URL, baseUrl: BASE_URL, cartUrl: CART_URL });
      document.addEventListener('click', handleClick);
      // Auto-show floating cart widget on store pages
      window.CustomizerStudio.showCartWidget();
      // Auto-inject button on Shopify product pages
      autoInjectButton();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
