/**
 * Customizer Studio SDK
 * Embed the product customizer in any e-commerce store.
 *
 * Usage:
 *   <script src="https://app.printonet.com/customizer-sdk.js"></script>
 *   <script>
 *     CustomizerStudio.init({ apiUrl: 'https://qumrnazgdrijdcihtkah.supabase.co/functions/v1' });
 *     CustomizerStudio.open({
 *       product: {
 *         name: 'Classic T-Shirt',
 *         category: 'T-Shirts',
 *         image_front: 'https://example.com/tshirt-front.png',
 *         image_back: 'https://example.com/tshirt-back.png',
 *         variants: [{ color: 'white', colorName: 'White', hex: '#FFFFFF' }]
 *       },
 *       brand: {
 *         name: 'My Store',
 *         logoUrl: 'https://example.com/logo.png',
 *         theme: 'dark',
 *         primaryColor: '#7c3aed',
 *         accentColor: '#e0459b',
 *         fontFamily: 'Inter',
 *         borderRadius: 12,
 *       },
 *       externalRef: 'cart-item-123',
 *       onComplete: function(result) { console.log('Design completed:', result); },
 *       onCancel: function() { console.log('User cancelled'); }
 *     });
 *   </script>
 */
(function (root) {
  'use strict';

  var _config = { apiUrl: '', baseUrl: '', cartUrl: '', storeUrl: '', woocommerceSiteUrl: '' };
  var _overlay = null;
  var _iframe = null;
  var _callbacks = {};
  var _productInfo = null;
  var _wcProductId = null;
  var _wcVariationId = null;
  var _wcAttributes = null; // { color: 'red', size: 'M' } -> attribute_pa_color etc.
  var _shopifyVariantId = null;
  var _summaryOverlay = null;
  /** After design-complete we close the iframe and remove _handleMessage; review tab posts here — keep listening on the storefront window. */
  var _reviewTabCartListenerAttached = false;

  function _handleReviewAddToCartPayload(payload) {
    _addToCart(payload, function () {
      var evt = new CustomEvent('customizer:addtocart', { detail: payload });
      document.dispatchEvent(evt);
      _callbacks.onComplete(payload);
    });
  }

  function _attachReviewTabCartListener() {
    if (_reviewTabCartListenerAttached) return;
    _reviewTabCartListenerAttached = true;
    window.addEventListener('message', _handleReviewTabCartMessage);
  }

  function _handleReviewTabCartMessage(event) {
    var data = event.data;
    if (!data || data.source !== 'customizer-studio' || data.type !== 'review-add-to-cart') return;
    _handleReviewAddToCartPayload(data.payload);
  }

  // Build a URL for a store-relative path. If storeUrl is configured we hit
  // the tenant store domain directly (e.g. https://royal.stores.printonet.com),
  // otherwise we fall back to a same-origin request.
  function _storeUrl(path) {
    var base = (_config.storeUrl || '').replace(/\/$/, '');
    return base ? base + path : path;
  }

  function init(options) {
    _config.apiUrl = options.apiUrl || '';
    _config.baseUrl = options.baseUrl || '';
    _config.cartUrl = options.cartUrl || '';
    _config.storeUrl = options.storeUrl || '';
    _config.woocommerceSiteUrl = options.woocommerceSiteUrl || '';
  }

  function open(options) {
    if (!options || !options.product) {
      console.error('[CustomizerStudio] product is required');
      return;
    }

    _callbacks.onComplete = options.onComplete || function () {};
    _callbacks.onCancel = options.onCancel || function () {};
    _productInfo = options.product;
    _wcProductId = options.wcProductId || null;
    _wcVariationId = options.wcVariationId || null;
    _wcAttributes = options.wcAttributes || null;
    _shopifyVariantId = options.shopifyVariantId || null;
    if (options.storeUrl) _config.storeUrl = options.storeUrl;

    var url = _config.apiUrl + '/create-session';
    var productPayload = Object.assign({}, options.product);
    if (options.wcVariationId != null && options.wcVariationId !== '') {
      productPayload.wc_variation_id = options.wcVariationId;
    }
    if (options.wcAttributes && typeof options.wcAttributes === 'object') {
      productPayload.wc_attributes = options.wcAttributes;
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: productPayload,
        external_ref: options.externalRef || null,
        user_id: options.userId || null,
        woocommerce_site_url: options.woocommerceSiteUrl || _config.woocommerceSiteUrl || null,
        store_id: options.storeId || null,
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) {
          console.error('[CustomizerStudio] Error:', data.error);
          return;
        }
        var embedUrl = _config.baseUrl
          ? (_config.baseUrl + '/embed/' + data.sessionId)
          : (data.customizerUrl || ('/embed/' + data.sessionId));

        if (options.brand) {
          var params = new URLSearchParams();
          if (options.brand.name) params.set('brandName', options.brand.name);
          if (options.brand.logoUrl) params.set('brandLogo', options.brand.logoUrl);
          if (options.brand.theme) params.set('brandTheme', options.brand.theme);
          if (options.brand.primaryColor) params.set('brandPrimary', options.brand.primaryColor);
          if (options.brand.accentColor) params.set('brandAccent', options.brand.accentColor);
          if (options.brand.fontFamily) params.set('brandFont', options.brand.fontFamily);
          if (options.brand.borderRadius !== undefined) params.set('brandRadius', String(options.brand.borderRadius));
          var qs = params.toString();
          if (qs) embedUrl += (embedUrl.indexOf('?') >= 0 ? '&' : '?') + qs;
        }

        try {
          if (productPayload.wc_attributes && typeof productPayload.wc_attributes === 'object') {
            var sep = embedUrl.indexOf('?') >= 0 ? '&' : '?';
            embedUrl += sep + 'wcAttributes=' + encodeURIComponent(JSON.stringify(productPayload.wc_attributes));
          }
        } catch (wcQsErr) {
          console.warn('[CustomizerStudio] wcAttributes query failed:', wcQsErr);
        }

        _showIframe(embedUrl);
      })
      .catch(function (err) {
        console.error('[CustomizerStudio] Network error:', err);
      });
  }

  function _showIframe(url) {
    _overlay = document.createElement('div');
    _overlay.style.cssText =
      'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText =
      'position:absolute;top:16px;right:16px;background:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:18px;cursor:pointer;z-index:1000000;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    closeBtn.onclick = function () { _closeIframe(); _callbacks.onCancel(); };
    _overlay.appendChild(closeBtn);

    _iframe = document.createElement('iframe');
    _iframe.src = url;
    _iframe.style.cssText =
      'width:95vw;height:92vh;max-width:1400px;border:none;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.5);background:#fff;';
    _iframe.allow = 'clipboard-write';
    _overlay.appendChild(_iframe);

    document.body.appendChild(_overlay);
    document.body.style.overflow = 'hidden';

    window.addEventListener('message', _handleMessage);
  }

  function _handleMessage(event) {
    var data = event.data;
    if (!data || data.source !== 'customizer-studio') return;

    if (data.type === 'design-complete') {
      _closeIframe();
      // Redirect the iframe (or open) the hosted review page with returnUrl
      var sid = data.payload && data.payload.sessionId;
      var reviewBase = _config.baseUrl
        ? (_config.baseUrl + '/review/' + sid)
        : ('/review/' + sid);
      var storeReturnUrl = encodeURIComponent(window.location.href);
      var reviewUrl = reviewBase + '?returnUrl=' + storeReturnUrl;
      reviewUrl += '&storeOrigin=' + encodeURIComponent(window.location.origin);
      if (_wcProductId) reviewUrl += '&wcProductId=' + encodeURIComponent(_wcProductId);
      if (_wcVariationId) reviewUrl += '&wcVariationId=' + encodeURIComponent(String(_wcVariationId));
      if (_wcAttributes && typeof _wcAttributes === 'object') {
        try {
          reviewUrl += '&wcAttributes=' + encodeURIComponent(JSON.stringify(_wcAttributes));
        } catch (e) { /* ignore */ }
      }
      window.open(reviewUrl, '_blank');
      _attachReviewTabCartListener();
      _callbacks.onComplete(data.payload);
    } else if (data.type === 'cart-updated') {
      // Update floating cart widget count
      _updateCartWidget(data.payload && data.payload.totalItems || 0);
    } else if (data.type === 'review-add-to-cart') {
      // Fired from hosted review while iframe overlay is still active (rare)
      _handleReviewAddToCartPayload(data.payload);
    } else if (data.type === 'design-cancel') {
      _callbacks.onCancel();
      _closeIframe();
    }
  }

  function _closeIframe() {
    window.removeEventListener('message', _handleMessage);
    if (_overlay && _overlay.parentNode) {
      _overlay.parentNode.removeChild(_overlay);
    }
    _overlay = null;
    _iframe = null;
  }

  // --- Design Summary Modal ---
  function _showSummary(payload) {
    var sides = (payload && payload.sides) || [];
    var designSides = sides.filter(function (s) { return s.designPNG && s.designPNG.length > 0; });
    var productName = (_productInfo && _productInfo.name) || 'Your Product';
    var variantLabel = (payload && payload.variant && payload.variant.colorName) || '';

    _summaryOverlay = document.createElement('div');
    _summaryOverlay.style.cssText =
      'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;animation:csFadeIn .25s ease;';

    // Inject keyframes
    if (!document.getElementById('cs-summary-styles')) {
      var style = document.createElement('style');
      style.id = 'cs-summary-styles';
      style.textContent = '@keyframes csFadeIn{from{opacity:0}to{opacity:1}}@keyframes csSlideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}';
      document.head.appendChild(style);
    }

    var panel = document.createElement('div');
    panel.style.cssText =
      'background:#fff;border-radius:20px;max-width:520px;width:92vw;max-height:85vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.35);animation:csSlideUp .35s ease;';

    // Header
    var header = document.createElement('div');
    header.style.cssText = 'padding:28px 28px 0;text-align:center;';
    header.innerHTML =
      '<div style="margin:0 auto 16px;width:56px;height:56px;border-radius:50%;background:#ecfdf5;display:flex;align-items:center;justify-content:center;">' +
        '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>' +
      '</div>' +
      '<div style="font-size:20px;font-weight:700;color:#111;margin-bottom:4px;">Design Complete!</div>' +
      '<div style="font-size:14px;color:#666;">' + _escHtml(productName) + (variantLabel ? ' · ' + _escHtml(variantLabel) : '') + '</div>';
    panel.appendChild(header);

    // Design previews
    if (designSides.length > 0) {
      var grid = document.createElement('div');
      var cols = designSides.length === 1 ? '1fr' : 'repeat(2, 1fr)';
      grid.style.cssText = 'display:grid;grid-template-columns:' + cols + ';gap:12px;padding:24px 28px 16px;';

      designSides.forEach(function (side) {
        var card = document.createElement('div');
        card.style.cssText = 'border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;background:#fafafa;';
        var label = document.createElement('div');
        label.style.cssText = 'padding:8px 12px;font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.5px;';
        label.textContent = side.view;
        card.appendChild(label);

        // Always use the canonical previewPNG snapshot — no dynamic overlays
        var imgSrc = side.previewPNG || side.designPNG;
        var img = document.createElement('img');
        img.src = imgSrc;
        img.alt = side.view + ' preview';
        img.style.cssText = 'width:100%;aspect-ratio:1;object-fit:contain;background:#f5f5f5;display:block;';
        card.appendChild(img);

        grid.appendChild(card);
      });

      panel.appendChild(grid);
    }

    // Session reference
    if (payload && payload.sessionId) {
      var refBox = document.createElement('div');
      refBox.style.cssText = 'margin:0 28px 16px;padding:10px 14px;background:#f8f9fa;border-radius:8px;display:flex;align-items:center;justify-content:space-between;';
      refBox.innerHTML =
        '<span style="font-size:12px;color:#888;">Design Reference</span>' +
        '<span style="font-size:12px;font-family:monospace;color:#444;user-select:all;">' + _escHtml(payload.sessionId.slice(0, 8)) + '</span>';
      panel.appendChild(refBox);
    }

    // Actions
    var actions = document.createElement('div');
    actions.style.cssText = 'padding:8px 28px 28px;display:flex;gap:10px;';

    var closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'flex:1;padding:12px;border-radius:10px;border:1px solid #ddd;background:#fff;font-size:14px;font-weight:500;cursor:pointer;color:#555;transition:background .15s;';
    closeBtn.onmouseover = function () { closeBtn.style.background = '#f5f5f5'; };
    closeBtn.onmouseout = function () { closeBtn.style.background = '#fff'; };
    closeBtn.onclick = function () { _closeSummary(); };
    actions.appendChild(closeBtn);

    var addBtn = document.createElement('button');
    addBtn.textContent = '🛒  Add to Cart';
    addBtn.style.cssText = 'flex:2;padding:12px;border-radius:10px;border:none;background:#111;color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s;';
    addBtn.onmouseover = function () { addBtn.style.background = '#333'; };
    addBtn.onmouseout = function () { addBtn.style.background = '#111'; };
    addBtn.onclick = function () {
      addBtn.disabled = true;
      addBtn.textContent = 'Adding...';
      addBtn.style.opacity = '0.7';

      _addToCart(payload, function (success) {
        // Dispatch events regardless
        var evt = new CustomEvent('customizer:addtocart', { detail: payload });
        document.dispatchEvent(evt);
        _callbacks.onComplete(payload);

        if (success) {
          addBtn.textContent = '✓ Added!';
          addBtn.style.background = '#16a34a';
          addBtn.style.opacity = '1';
          setTimeout(function () { _closeSummary(); }, 1200);
        } else {
          addBtn.textContent = '🛒  Add to Cart';
          addBtn.style.opacity = '1';
          addBtn.disabled = false;
          _closeSummary();
        }
      });
    };
    actions.appendChild(addBtn);

    panel.appendChild(actions);
    _summaryOverlay.appendChild(panel);
    document.body.appendChild(_summaryOverlay);
    document.body.style.overflow = 'hidden';

    // Click backdrop to close
    _summaryOverlay.addEventListener('click', function (e) {
      if (e.target === _summaryOverlay) _closeSummary();
    });

    // Also dispatch the complete event
    var completeEvt = new CustomEvent('customizer:complete', { detail: payload });
    document.dispatchEvent(completeEvt);
  }

  // --- Add to cart (Shopify, WooCommerce, or generic) ---
  function _addToCart(payload, callback) {
    // Shopify native cart
    if (_shopifyVariantId && window.Shopify) {
      var properties = {};
      if (payload.sessionId) properties['_customizer_session_id'] = payload.sessionId;
      if (payload.sides && payload.sides.length > 0) {
        var frontSide = payload.sides.find(function (s) { return s.view === 'front'; }) || payload.sides[0];
        if (frontSide && (frontSide.previewPNG || frontSide.designPNG)) {
          properties['_customizer_design_url'] = frontSide.previewPNG || frontSide.designPNG;
        }
        properties['_customizer_sides'] = JSON.stringify(payload.sides.map(function (s) {
          var side = { view: s.view, url: s.designPNG };
          if (s.previewPNG) side.preview_url = s.previewPNG;
          return side;
        }));
      }

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: _shopifyVariantId,
          quantity: 1,
          properties: properties,
        }),
        credentials: 'same-origin',
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.status && data.status >= 400) {
            console.error('[CustomizerStudio] Shopify add to cart error:', data.description || data.message);
            callback(false);
            return;
          }
          // Dispatch Shopify cart update event for themes that listen
          document.dispatchEvent(new CustomEvent('cart:refresh'));
          // Some themes use this
          if (typeof window.Shopify !== 'undefined' && window.Shopify.onCartUpdate) {
            fetch('/cart.js', { credentials: 'same-origin' })
              .then(function (r) { return r.json(); })
              .then(function (cart) { window.Shopify.onCartUpdate(cart); })
              .catch(function () {});
          }
          callback(true);
        })
        .catch(function (err) {
          console.error('[CustomizerStudio] Shopify add to cart failed:', err);
          callback(false);
        });
      return;
    }

    // WooCommerce native cart (IDs may come from SDK open() or from review page postMessage payload)
    var wcPid = _wcProductId || (payload && payload.wcProductId) || null;
    var wcVid = _wcVariationId || (payload && payload.wcVariationId) || null;
    var wcAttr = _wcAttributes || (payload && payload.wcAttributes) || null;

    if (wcPid) {
      var formData = new FormData();
      formData.append('product_id', String(wcPid));
      formData.append('quantity', String((payload && payload.quantity) || 1));
      // Variable products: WC requires variation_id + attribute_* fields
      if (wcVid) {
        formData.append('variation_id', String(wcVid));
      }
      if (wcAttr && typeof wcAttr === 'object') {
        Object.keys(wcAttr).forEach(function (k) {
          // Accept both 'color' and 'attribute_pa_color' style keys.
          var key = k.indexOf('attribute_') === 0 ? k : 'attribute_pa_' + k;
          formData.append(key, String(wcAttr[k]));
        });
      }
      if (payload.sessionId) formData.append('customizer_session_id', payload.sessionId);
      if (payload.sides && payload.sides.length > 0) {
        var frontSide = payload.sides.find(function (s) { return s.view === 'front'; }) || payload.sides[0];
        if (frontSide && frontSide.designPNG) formData.append('customizer_design_url', frontSide.designPNG);
        var sidesData = payload.sides.map(function (s) {
          var side = { view: s.view, url: s.designPNG };
          if (s.previewPNG) side.preview_url = s.previewPNG;
          if (s.printArea) side.print_area = s.printArea;
          if (s.productImage) side.product_image = s.productImage;
          return side;
        });
        formData.append('customizer_sides', JSON.stringify(sidesData));
      }

      fetch(_storeUrl('/?wc-ajax=add_to_cart'), {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.error) {
            console.log('[CustomizerStudio] Variable product detected, redirecting to product page');
            var productUrl = data.product_url || '';
            if (productUrl) {
              var sep = productUrl.indexOf('?') >= 0 ? '&' : '?';
              var sessionParam = payload.sessionId ? 'customizer_session=' + encodeURIComponent(payload.sessionId) : '';
              window.location.href = productUrl + (sessionParam ? sep + sessionParam : '');
            }
            callback(true);
            return;
          }
          if (typeof jQuery !== 'undefined') {
            jQuery(document.body).trigger('added_to_cart', [data.fragments, data.cart_hash]);
          }
          callback(true);
        })
        .catch(function (err) {
          console.error('[CustomizerStudio] WooCommerce add to cart failed:', err);
          callback(false);
        });
      return;
    }

    // No store integration — just complete
    callback(true);
  }

  function _closeSummary() {
    if (_summaryOverlay && _summaryOverlay.parentNode) {
      _summaryOverlay.parentNode.removeChild(_summaryOverlay);
    }
    _summaryOverlay = null;
    document.body.style.overflow = '';
  }

  function _escHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function close() {
    _closeIframe();
    _closeSummary();
  }

  // --- Floating Cart Widget ---
  var _cartWidget = null;
  var _cartBadge = null;

  function _getCartCount() {
    try {
      var raw = localStorage.getItem('customizer_cart');
      if (!raw) return 0;
      var items = JSON.parse(raw);
      return items.reduce(function (sum, i) { return sum + (i.quantity || 1); }, 0);
    } catch (_) { return 0; }
  }

  function _updateCartWidget(count) {
    if (!_cartWidget) return;
    if (count > 0) {
      _cartWidget.style.display = 'flex';
      _cartBadge.textContent = count > 99 ? '99+' : String(count);
    } else {
      _cartWidget.style.display = 'none';
    }
  }

  function _createCartWidget() {
    if (_cartWidget) return;

    var cartLink = _config.cartUrl || ((_config.baseUrl || '') + '/cart?returnUrl=' + encodeURIComponent(window.location.href));
    _cartWidget = document.createElement('a');
    _cartWidget.href = cartLink;
    _cartWidget.target = '_blank';
    _cartWidget.rel = 'noopener';
    _cartWidget.style.cssText =
      'position:fixed;bottom:24px;right:24px;z-index:999990;width:56px;height:56px;border-radius:50%;' +
      'background:#111;color:#fff;display:none;align-items:center;justify-content:center;' +
      'box-shadow:0 4px 16px rgba(0,0,0,0.3);cursor:pointer;text-decoration:none;transition:transform .15s;';
    _cartWidget.onmouseover = function () { _cartWidget.style.transform = 'scale(1.1)'; };
    _cartWidget.onmouseout = function () { _cartWidget.style.transform = 'scale(1)'; };

    // Cart icon (SVG)
    _cartWidget.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>' +
      '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>' +
      '</svg>';

    // Badge
    _cartBadge = document.createElement('span');
    _cartBadge.style.cssText =
      'position:absolute;top:-4px;right:-4px;background:#e11d48;color:#fff;font-size:11px;font-weight:700;' +
      'min-width:20px;height:20px;border-radius:10px;display:flex;align-items:center;justify-content:center;' +
      'padding:0 5px;font-family:system-ui,sans-serif;';
    _cartWidget.appendChild(_cartBadge);

    document.body.appendChild(_cartWidget);

    // Init with current count
    var count = _getCartCount();
    _updateCartWidget(count);

    // Listen for cart-updated messages from review/cart pages opened in new tabs
    window.addEventListener('message', function (e) {
      var d = e.data;
      if (d && d.source === 'customizer-studio' && d.type === 'cart-updated') {
        _updateCartWidget(d.payload && d.payload.totalItems || 0);
        // Sync new item to native store cart if applicable
        if (d.payload && d.payload.newItem) {
          _syncToShopify(d.payload.newItem);
          _syncToWooCommerce(d.payload.newItem);
        }
      }
    });

    // Also poll localStorage periodically (for same-origin tab changes)
    setInterval(function () {
      var c = _getCartCount();
      _updateCartWidget(c);
    }, 2000);
  }

  // --- Sync to Shopify (duplicate-safe) ---
  function _syncToShopify(newItem) {
    if (!newItem || !newItem.shopifyVariantId || !newItem.sessionId) return;
    if (!window.Shopify) return;

    var synced = _getSyncedSessions();
    if (synced.indexOf(newItem.sessionId) !== -1) return; // already synced

    var properties = {};
    properties['_customizer_session_id'] = newItem.sessionId;
    if (newItem.previewImage) {
      properties['_customizer_design_url'] = newItem.previewImage;
      properties['_customizer_sides'] = JSON.stringify([{ view: 'front', url: newItem.previewImage, preview_url: newItem.previewImage }]);
    }

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newItem.shopifyVariantId,
        quantity: newItem.quantity || 1,
        properties: properties,
      }),
      credentials: 'same-origin',
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        _markSynced(newItem.sessionId);
        if (data.status && data.status >= 400) {
          console.log('[CustomizerStudio] Shopify sync error:', data.description || data.message);
          return;
        }
        // Trigger Shopify cart refresh events
        document.dispatchEvent(new CustomEvent('cart:refresh'));
        if (window.Shopify && window.Shopify.onCartUpdate) {
          fetch('/cart.js', { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (cart) { window.Shopify.onCartUpdate(cart); })
            .catch(function () {});
        }
      })
      .catch(function (err) {
        console.error('[CustomizerStudio] Shopify cart sync failed:', err);
      });
  }

  // --- Sync to WooCommerce (duplicate-safe) ---
  var SYNCED_KEY = 'customizer_synced_sessions';

  function _getSyncedSessions() {
    try {
      var raw = localStorage.getItem(SYNCED_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }

  function _markSynced(sessionId) {
    var synced = _getSyncedSessions();
    if (synced.indexOf(sessionId) === -1) {
      synced.push(sessionId);
      localStorage.setItem(SYNCED_KEY, JSON.stringify(synced));
    }
  }

  function _syncToWooCommerce(newItem) {
    if (!newItem || !newItem.sessionId) return;
    var syncPid = newItem.wcProductId || _wcProductId;
    if (!syncPid) return;

    var synced = _getSyncedSessions();
    if (synced.indexOf(newItem.sessionId) !== -1) return; // already synced

    var formData = new FormData();
    formData.append('product_id', String(syncPid));
    formData.append('quantity', String(newItem.quantity || 1));
    var syncVid = newItem.wcVariationId || _wcVariationId;
    if (syncVid) {
      formData.append('variation_id', String(syncVid));
    }
    var syncAttr = newItem.wcAttributes || _wcAttributes;
    if (syncAttr && typeof syncAttr === 'object') {
      Object.keys(syncAttr).forEach(function (k) {
        var key = k.indexOf('attribute_') === 0 ? k : 'attribute_pa_' + k;
        formData.append(key, String(syncAttr[k]));
      });
    }
    formData.append('customizer_session_id', newItem.sessionId);
    if (newItem.previewImage) {
      formData.append('customizer_design_url', newItem.previewImage);
      // Also send as sides array so the plugin picks it up
      formData.append('customizer_sides', JSON.stringify([{ view: 'front', url: newItem.previewImage, preview_url: newItem.previewImage }]));
    }

    fetch(_storeUrl('/?wc-ajax=add_to_cart'), {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        _markSynced(newItem.sessionId);
        if (data.error) {
          console.log('[CustomizerStudio] WC sync: variable product, may need variation selection');
          return;
        }
        // Trigger WC mini-cart refresh
        if (typeof jQuery !== 'undefined') {
          jQuery(document.body).trigger('added_to_cart', [data.fragments, data.cart_hash]);
        }
      })
      .catch(function (err) {
        console.error('[CustomizerStudio] WC cart sync failed:', err);
      });
  }

  root.CustomizerStudio = {
    init: init,
    open: open,
    close: close,
    showCartWidget: _createCartWidget,
  };
})(typeof window !== 'undefined' ? window : this);
