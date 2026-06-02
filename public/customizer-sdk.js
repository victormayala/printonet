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

  function _handleReviewAddToCartPayload(payload, targetWindow) {
    _addToCart(payload, function () {
      var success = arguments.length > 0 ? !!arguments[0] : true;
      var evt = new CustomEvent('customizer:addtocart', { detail: payload });
      document.dispatchEvent(evt);
      _callbacks.onComplete(payload);
      if (targetWindow && typeof targetWindow.postMessage === 'function') {
        try {
          targetWindow.postMessage({
            source: 'customizer-studio',
            type: 'review-add-to-cart-result',
            payload: { ok: success, sessionId: payload && payload.sessionId }
          }, '*');
        } catch (_) {}
      }
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
    _handleReviewAddToCartPayload(data.payload, event.source);
  }

  // Build a URL for a store-relative path. If storeUrl is configured we hit
  // the tenant store domain directly (e.g. https://royal.stores.printonet.com),
  // otherwise we fall back to a same-origin request.
  function _storeUrl(path) {
    var base = (_config.storeUrl || '').replace(/\/$/, '');
    return base ? base + path : path;
  }

  function _getShopifyVariantId() {
    if (_shopifyVariantId) return _shopifyVariantId;
    var variantInput = document.querySelector('form[action="/cart/add"] input[name="id"], form[action^="/cart/add"] input[name="id"]');
    if (variantInput && variantInput.value) return String(variantInput.value);
    try {
      var params = new URLSearchParams(window.location.search);
      var variantParam = params.get('variant');
      if (variantParam) return variantParam;
    } catch (_) {}
    if (window.Shopify && window.Shopify.product && window.Shopify.product.variants && window.Shopify.product.variants.length) {
      return String(window.Shopify.product.variants[0].id);
    }
    return null;
  }

  function _isShopifyStore() {
    return !!(_getShopifyVariantId() || window.Shopify || /\.myshopify\.com$/i.test(window.location.hostname));
  }

  function init(options) {
    _config.apiUrl = options.apiUrl || '';
    _config.baseUrl = options.baseUrl || '';
    _config.cartUrl = options.cartUrl || '';
    _config.storeUrl = options.storeUrl || '';
    _config.woocommerceSiteUrl = options.woocommerceSiteUrl || '';
    if (_isShopifyStore()) {
      _refreshExistingShopifyDesignThumbnails();
      _decorateShopifyDesignLinks();
      setTimeout(function () { _refreshExistingShopifyDesignThumbnails(); _decorateShopifyDesignLinks(); }, 600);
      setTimeout(function () { _refreshExistingShopifyDesignThumbnails(); _decorateShopifyDesignLinks(); }, 1600);
      _observeShopifyCartMutations();
    }
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
      if (_isShopifyStore()) {
        _showSummary(data.payload || {});
        return;
      }

      // Non-Shopify flows use the hosted review page.
      var sid = data.payload && data.payload.sessionId;
      var reviewBase = _config.baseUrl
        ? (_config.baseUrl + '/review/' + sid)
        : ('/review/' + sid);
      var storeReturnUrl = encodeURIComponent(window.location.href);
      var reviewUrl = reviewBase + '?returnUrl=' + storeReturnUrl;
      reviewUrl += '&storeOrigin=' + encodeURIComponent(window.location.origin);
      if (_wcProductId) reviewUrl += '&wcProductId=' + encodeURIComponent(_wcProductId);
      if (_wcVariationId) reviewUrl += '&wcVariationId=' + encodeURIComponent(String(_wcVariationId));
      if (_shopifyVariantId) reviewUrl += '&shopifyVariantId=' + encodeURIComponent(String(_shopifyVariantId));
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
      _handleReviewAddToCartPayload(data.payload, event.source);
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
    var shopifyId = (payload && payload.shopifyVariantId) || _getShopifyVariantId();

    // Shopify native cart
    if (shopifyId) {
      var properties = {};
      if (payload.sessionId) properties['_customizer_session_id'] = payload.sessionId;
      if (payload.printFileUrl) properties['_customizer_print_file_url'] = payload.printFileUrl;
      if (payload.designLayersUrl) properties['_customizer_layers_url'] = payload.designLayersUrl;
      // Only HTTPS URLs can render in Shopify cart line items — base64 data URLs are too long
      // and break theme rendering / get truncated by Shopify.
      var httpsSides = [];
      if (payload.sides && payload.sides.length > 0) {
        for (var i = 0; i < payload.sides.length; i++) {
          var s = payload.sides[i];
          var url = _isHttpUrl(s && s.previewPNG) ? s.previewPNG
                  : _isHttpUrl(s && s.designPNG) ? s.designPNG
                  : null;
          if (url) httpsSides.push({ view: s.view, url: url, preview_url: url });
        }
      }
      var frontHttps = null;
      if (httpsSides.length > 0) {
        var f = httpsSides.find(function (x) { return x.view === 'front'; }) || httpsSides[0];
        frontHttps = f && f.url;
      }
      if (!frontHttps && _isHttpUrl(payload.previewImage)) frontHttps = payload.previewImage;
      if (!frontHttps && _isHttpUrl(payload.printFileUrl)) frontHttps = payload.printFileUrl;
      if (frontHttps) {
        // Underscore-prefixed = hidden from cart/checkout UI but still readable by our SDK
        // for thumbnail swapping. We deliberately do NOT expose the raw storage URL to shoppers.
        properties['_customizer_design_url'] = frontHttps;
      }
      if (httpsSides.length > 0) {
        properties['_customizer_sides'] = JSON.stringify(httpsSides);
      }
      // Single visible, Printonet-branded link shoppers can click to preview their design.
      // Shopify themes render visible line-item properties as "<key>: <value>", and HTTPS
      // values become clickable links automatically — so the shopper sees:
      //   View Design: https://customizerstudio.com/review/<id>
      if (payload.sessionId) {
        var previewBase = (_config && _config.baseUrl) ? String(_config.baseUrl).replace(/\/+$/, '') : 'https://customizerstudio.com';
        properties['View Design'] = previewBase + '/review/' + encodeURIComponent(payload.sessionId);
      }

      // Ask Shopify to render cart sections so we can hot-swap the cart UI without a refresh
      var sectionsToRender = 'cart-drawer,cart-icon-bubble,cart-live-region-text,cart-notification,cart-notification-button,cart-notification-product,main-cart-items,main-cart-footer';

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: shopifyId,
          quantity: (payload && payload.quantity) || 1,
          properties: properties,
          sections: sectionsToRender,
          sections_url: window.location.pathname,
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
          _refreshShopifyCartUI(data && data.sections, {
            sessionId: payload && payload.sessionId,
            variantId: String(shopifyId),
            lineKey: data && data.key,
            designUrl: frontHttps || null,
          });
          callback(true);
          // Reliable cross-theme fallback: navigate to /cart so the shopper
          // immediately sees the new line item with the correct design thumbnail
          // (our _refreshExistingShopifyDesignThumbnails runs on cart-page load).
          // This avoids depending on theme-specific drawer events that often
          // require a manual page reload.
          try {
            var hasDrawer = !!document.querySelector('cart-drawer, cart-notification, [data-cart-drawer]');
            if (!hasDrawer && !/\/cart(\/|$|\?)/.test(window.location.pathname)) {
              setTimeout(function () { window.location.assign('/cart'); }, 150);
            }
          } catch (_) {}
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

  function _isHttpUrl(v) {
    return typeof v === 'string' && /^https?:\/\//i.test(v);
  }

  function _findCartLineForDesign(cart, meta) {
    if (!cart || !cart.items || !meta) return null;
    var sessionId = meta.sessionId ? String(meta.sessionId) : '';
    var variantId = meta.variantId ? String(meta.variantId) : '';
    for (var i = 0; i < cart.items.length; i++) {
      var item = cart.items[i];
      var props = item && item.properties ? item.properties : {};
      var propSession = props._customizer_session_id ? String(props._customizer_session_id) : '';
      if (sessionId && propSession === sessionId) return item;
      if (variantId && String(item && item.variant_id) === variantId && _cartItemDesignUrl(item)) return item;
    }
    return null;
  }

  function _cartLineContainers(cartItem, designUrl) {
    var containers = [];
    var itemKey = cartItem && cartItem.key ? String(cartItem.key) : '';
    var itemUrl = cartItem && cartItem.url ? String(cartItem.url) : '';
    var itemTitle = cartItem && (cartItem.product_title || cartItem.title) ? String(cartItem.product_title || cartItem.title) : '';
    var reviewUrl = _cartItemReviewUrl(cartItem);
    var lineSelectors = '.cart-item, [data-cart-item], [data-cart-item-key], [data-line-item-key], cart-drawer-items li, .cart-drawer li, cart-notification, .cart-notification-product, .cart__item, .ajaxcart__product, .mini-cart__item, tr, li';
    function add(el) {
      if (!el || containers.indexOf(el) >= 0) return;
      containers.push(el);
    }
    if (itemKey) {
      try {
        var encodedKey = encodeURIComponent(itemKey);
        document.querySelectorAll('[data-cart-item-key="' + _cssEscape(itemKey) + '"], [data-key="' + _cssEscape(itemKey) + '"], [data-line-item-key="' + _cssEscape(itemKey) + '"], a[href*="' + _cssEscape(itemKey) + '"], a[href*="' + _cssEscape(encodedKey) + '"]').forEach(function (el) {
          add(el.closest(lineSelectors) || el);
        });
      } catch (_) {}
    }
    if (itemUrl) {
      try {
        var itemPath = itemUrl.split('?')[0];
        document.querySelectorAll('a[href*="' + _cssEscape(itemPath) + '"]').forEach(function (el) {
          add(el.closest(lineSelectors));
        });
      } catch (_) {}
    }
    try {
      document.querySelectorAll(lineSelectors).forEach(function (el) {
        var html = el.innerHTML || '';
        var text = el.textContent || '';
        if ((designUrl && (html.indexOf(designUrl) >= 0 || text.indexOf(designUrl) >= 0)) ||
            (reviewUrl && (html.indexOf(reviewUrl) >= 0 || text.indexOf(reviewUrl) >= 0)) ||
            (itemTitle && text.toLowerCase().indexOf(itemTitle.toLowerCase()) >= 0)) add(el);
      });
    } catch (_) {}
    return containers;
  }

  function _replaceCartLineImages(designUrl, cartItem) {
    if (!_isHttpUrl(designUrl)) return;
    var productImage = cartItem && (cartItem.image || cartItem.featured_image && cartItem.featured_image.url || '');
    var containers = _cartLineContainers(cartItem, designUrl);

    var seen = [];
    containers.forEach(function (el) {
      try {
        el.querySelectorAll('img').forEach(function (img) {
          if (seen.indexOf(img) >= 0) return;
          seen.push(img);
          img.src = designUrl;
          img.srcset = '';
          img.setAttribute('src', designUrl);
          img.setAttribute('data-customizer-design-thumbnail', 'true');
        });
      } catch (_) {}
    });
    if (seen.length > 0) return;

    var selectors = [
      'img[src="' + _cssEscape(productImage) + '"]',
    ];
    var seen = [];
    selectors.forEach(function (selector) {
      if (!selector || selector === 'img[src=""]') return;
      try {
        document.querySelectorAll(selector).forEach(function (img) {
          if (seen.indexOf(img) >= 0) return;
          seen.push(img);
          img.src = designUrl;
          img.srcset = '';
          img.setAttribute('src', designUrl);
          img.setAttribute('data-customizer-design-thumbnail', 'true');
        });
      } catch (_) {}
    });
  }

  function _cartItemDesignUrl(item) {
    var props = item && item.properties ? item.properties : {};
    if (_isHttpUrl(props.Design)) return props.Design;
    if (_isHttpUrl(props._customizer_design_url)) return props._customizer_design_url;
    try {
      var sides = props._customizer_sides ? JSON.parse(props._customizer_sides) : [];
      if (Array.isArray(sides) && sides.length) {
        var front = sides.find(function (s) { return s && s.view === 'front'; }) || sides[0];
        if (_isHttpUrl(front && (front.preview_url || front.url))) return front.preview_url || front.url;
      }
    } catch (_) {}
    return null;
  }

  function _applyDesignThumbnailsFromCart(cart) {
    if (!cart || !Array.isArray(cart.items)) return;
    cart.items.forEach(function (item) {
      var designUrl = _cartItemDesignUrl(item);
      if (designUrl) _replaceCartLineImages(designUrl, item);
    });
  }

  function _refreshExistingShopifyDesignThumbnails() {
    if (!_isShopifyStore()) return;
    fetch('/cart.js', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(_applyDesignThumbnailsFromCart)
      .catch(function () {});
  }

  // Printonet "P" mark used inside the cart "View design" anchor.
  var _PRINTONET_MARK_SVG =
    '<svg width="14" height="14" viewBox="0 0 1918 2353" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="flex-shrink:0;display:inline-block;vertical-align:-2px;">' +
      '<path d="M1770.73 1072.54C1775.86 1566.71 1372.47 1971.39 878.29 1967.72C676.43 1966.22 490.86 1896.74 343.09 1781.54C336.96 1776.76 328.02 1781.1 328.02 1788.88V2343.44C328.02 2348.59 323.84 2352.77 318.69 2352.77H9.33C4.18 2352.77 0 2348.59 0 2343.44V1081.92C0 593.39 397.31 196.1 884.95 196.1C1020.55 196.1 1148.78 228.04 1263.31 282.42C1269.16 285.2 1270.53 292.9 1265.95 297.48L1018.41 545.01C1016.13 547.29 1012.85 548.21 1009.71 547.48C967.54 537.76 925.33 532.88 882.32 532.88C834.96 532.88 788.47 539.03 742.87 550.42C491.16 617.08 324.51 846.88 327.14 1095.95C327.14 1105.49 328 1114.17 328.02 1123.69C328.02 1123.91 328.02 1124.14 328.05 1124.36C330.7 1159.33 336.83 1194.31 345.57 1229.27C409.59 1473.97 630.61 1644.99 884.08 1644.99C912.15 1644.99 941.09 1642.37 966.52 1638.86C985.81 1635.36 1005.11 1630.97 1027.04 1625.7C1044.58 1621.32 1062.12 1616.05 1077.91 1609.92C1346.29 1509.93 1493.63 1224.89 1420.84 948.62C1418.53 937.07 1414.86 925.51 1411.04 912.77C1410.05 909.48 1410.94 905.9 1413.38 903.47L1652.34 664.51C1656.78 660.07 1664.22 661.2 1667.19 666.72C1732.2 787.85 1769.23 926.14 1770.75 1072.55L1770.73 1072.54Z" fill="currentColor"/>' +
      '<path d="M1680.82 1.33C1591.8 11.09 1516.61 78.95 1497.46 166.43C1491.31 194.55 1490.95 221.89 1495.34 247.68C1506.4 312.61 1490.04 379.11 1445.7 427.81L1444.71 428.9L1172.53 701.08C1121.55 757.06 1043.54 784.26 970.57 764.07C916.11 749.01 857.17 747.51 798.25 762.91C619.08 809.74 510.56 993.31 557.71 1173.7C601.69 1341.97 766.41 1447.66 935.49 1421.58C946.71 1419.93 957.6 1417.09 968.5 1414.24C979.4 1411.39 990.3 1408.55 1000.88 1404.49C1162.31 1344.19 1253.04 1171.73 1209.05 1003.46C1206.9 995.23 1204.44 987.18 1201.71 979.3C1175.96 905.05 1188.52 823.01 1241.42 764.9L1454.87 551.34L1521.32 484.89C1563.64 442.05 1622.56 417.45 1682.53 424.25C1688.84 424.97 1695.25 425.39 1701.74 425.49C1811.67 427.27 1903.98 344.91 1916.78 237.53C1917.69 230.42 1917.8 223.31 1917.92 216.19C1918.03 209.07 1918.15 201.95 1917.47 194.83C1907.38 77.29 1803.1 -12.09 1680.83 1.32Z" fill="#FDD100"/>' +
    '</svg>';

  function _isOurReviewHref(href) {
    if (!href) return false;
    var base = (_config && _config.baseUrl ? String(_config.baseUrl) : 'https://customizerstudio.com').replace(/\/+$/, '');
    if (href.indexOf(base + '/review/') === 0) return true;
    if (href.indexOf('://customizerstudio.com/review/') !== -1) return true;
    if (href.indexOf('://printonet.com/review/') !== -1) return true;
    if (href.indexOf('://platform.printonet.com/review/') !== -1) return true;
    return false;
  }

  // Replace Shopify's default "View design: https://..." line-item property rendering
  // with a Printonet icon + clean "View design" link. Runs on cart page, drawer, and notification.
  function _decorateShopifyDesignLinks() {
    if (!_isShopifyStore()) return;
    try {
      var anchors = document.querySelectorAll('a[href*="/review/"]');
      anchors.forEach(function (a) {
        if (a.getAttribute('data-printonet-design-link') === '1') return;
        if (!_isOurReviewHref(a.getAttribute('href') || '')) return;

        a.setAttribute('data-printonet-design-link', '1');
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        a.style.display = 'inline-flex';
        a.style.alignItems = 'center';
        a.style.gap = '6px';
        a.style.textDecoration = 'none';
        a.style.color = 'inherit';
        a.style.fontWeight = '600';
        a.innerHTML = _PRINTONET_MARK_SVG + '<span style="text-decoration:underline;">View design</span>';

        // Hide the theme-rendered "View design:" label preceding the value.
        var dd = a.closest('dd');
        if (dd) {
          var dt = dd.previousElementSibling;
          if (dt && dt.tagName === 'DT' && /view design/i.test(dt.textContent || '')) {
            dt.style.display = 'none';
          }
          // Some themes wrap the whole property in <li>; also strip a leading "View design:" text in the same <dd>.
        }
        // Strip "View design:" / "View Design:" text nodes immediately before the anchor.
        var prev = a.previousSibling;
        while (prev && prev.nodeType === 3) {
          var nv = prev.nodeValue || '';
          if (/view\s*design\s*:?\s*$/i.test(nv)) prev.nodeValue = '';
          prev = prev.previousSibling;
        }
        // Some themes render label as <span> sibling
        var prevEl = a.previousElementSibling;
        if (prevEl && /^view\s*design\s*:?\s*$/i.test((prevEl.textContent || '').trim())) {
          prevEl.style.display = 'none';
        }
      });
    } catch (e) { /* ignore */ }
  }

  var _cartMutationObserver = null;
  var _cartMutationDebounce = null;
  function _observeShopifyCartMutations() {
    if (_cartMutationObserver || typeof MutationObserver === 'undefined') return;
    try {
      _cartMutationObserver = new MutationObserver(function () {
        if (_cartMutationDebounce) return;
        _cartMutationDebounce = setTimeout(function () {
          _cartMutationDebounce = null;
          _decorateShopifyDesignLinks();
          _refreshExistingShopifyDesignThumbnails();
        }, 120);
      });
      _cartMutationObserver.observe(document.body, { childList: true, subtree: true });
    } catch (e) { /* ignore */ }
  }


  function _cssEscape(value) {
    if (!value) return '';
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  // Hot-swap Shopify cart UI (drawer, icon bubble, etc.) without a full page reload.
  function _refreshShopifyCartUI(sections, meta) {
    try {
      if (sections && typeof sections === 'object') {
        Object.keys(sections).forEach(function (sectionId) {
          var html = sections[sectionId];
          if (!html) return;
          var target = document.getElementById(sectionId);
          if (target) {
            var parsed = new DOMParser().parseFromString(html, 'text/html');
            var inner = parsed.getElementById(sectionId);
            target.innerHTML = inner ? inner.innerHTML : html;
            return;
          }
          var sectionWrapper = document.getElementById('shopify-section-' + sectionId);
          if (sectionWrapper) {
            sectionWrapper.innerHTML = html;
          }
        });
      }
    } catch (e) {
      console.warn('[CustomizerStudio] Cart section render failed:', e);
    }

    document.dispatchEvent(new CustomEvent('cart:refresh'));
    document.dispatchEvent(new CustomEvent('cart:build'));
    document.dispatchEvent(new CustomEvent('cart:updated'));
    document.dispatchEvent(new CustomEvent('cart-updated'));
    document.dispatchEvent(new CustomEvent('theme:cart:reload'));

    fetch('/cart.js', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        var designedLine = _findCartLineForDesign(cart, meta);
        var designUrl = meta && meta.designUrl;
        if (!designUrl && designedLine && designedLine.properties) designUrl = designedLine.properties.Design;
        _replaceCartLineImages(designUrl, designedLine);
        _applyDesignThumbnailsFromCart(cart);
        _decorateShopifyDesignLinks();
        setTimeout(_decorateShopifyDesignLinks, 200);
        setTimeout(_decorateShopifyDesignLinks, 800);
        document.dispatchEvent(new CustomEvent('cart:change', { detail: { cart: cart } }));
        if (window.Shopify && window.Shopify.onCartUpdate) {
          try { window.Shopify.onCartUpdate(cart); } catch (_) {}
        }
        var drawer = document.querySelector('cart-drawer, cart-notification, [data-cart-drawer]');
        if (drawer && typeof drawer.open === 'function') {
          try { drawer.open(); } catch (_) {}
        } else if (drawer && drawer.classList) {
          drawer.classList.add('active', 'is-open', 'open');
        }
      })
      .catch(function () {});
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

    var cartLink = _config.cartUrl || (_isShopifyStore() ? '/cart' : ((_config.baseUrl || '') + '/cart?returnUrl=' + encodeURIComponent(window.location.href)));
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
    if (newItem.printFileUrl) properties['_customizer_print_file_url'] = newItem.printFileUrl;
    if (newItem.designLayersUrl) properties['_customizer_layers_url'] = newItem.designLayersUrl;
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
