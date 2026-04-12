/**
 * Customizer Studio SDK
 * Embed the product customizer in any e-commerce store.
 *
 * Usage:
 *   <script src="https://customizerstudio.com/customizer-sdk.js"></script>
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

  var _config = { apiUrl: '', baseUrl: '' };
  var _overlay = null;
  var _iframe = null;
  var _callbacks = {};
  var _productInfo = null;
  var _wcProductId = null;
  var _summaryOverlay = null;

  function init(options) {
    _config.apiUrl = options.apiUrl || '';
    _config.baseUrl = options.baseUrl || '';
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

    var url = _config.apiUrl + '/create-session';
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: options.product,
        external_ref: options.externalRef || null,
        user_id: options.userId || null,
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
      _showSummary(data.payload);
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

        var previewSrc = side.previewPNG || '';

        if (previewSrc) {
          var previewImg = document.createElement('img');
          previewImg.src = previewSrc;
          previewImg.alt = side.view + ' preview';
          previewImg.style.cssText = 'width:100%;aspect-ratio:1;object-fit:contain;background:#f5f5f5;display:block;';
          card.appendChild(previewImg);
        } else if (side.productImage && side.designPNG) {
          var stage = document.createElement('div');
          stage.style.cssText = 'position:relative;width:100%;aspect-ratio:1;background:#f5f5f5;overflow:hidden;';

          var productImg = document.createElement('img');
          productImg.src = side.productImage;
          productImg.alt = side.view + ' product preview';
          productImg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;';
          stage.appendChild(productImg);

          var designImg = document.createElement('img');
          designImg.src = side.designPNG;
          designImg.alt = side.view + ' design preview';
          designImg.style.cssText = 'position:absolute;object-fit:contain;display:block;';

          if (side.printArea) {
            var applyPlacement = function () {
              var cw = stage.clientWidth;
              var ch = stage.clientHeight;
              if (!cw || !ch) return;
              var nw = productImg.naturalWidth || cw;
              var nh = productImg.naturalHeight || ch;
              var scale = Math.min(cw / nw, ch / nh);
              var renderedW = nw * scale;
              var renderedH = nh * scale;
              var offsetX = (cw - renderedW) / 2;
              var offsetY = (ch - renderedH) / 2;

              designImg.style.left = (offsetX + (side.printArea.x / 100) * renderedW) + 'px';
              designImg.style.top = (offsetY + (side.printArea.y / 100) * renderedH) + 'px';
              designImg.style.width = ((side.printArea.width / 100) * renderedW) + 'px';
              designImg.style.height = ((side.printArea.height / 100) * renderedH) + 'px';
            };

            if (productImg.complete && productImg.naturalWidth) {
              applyPlacement();
            } else {
              productImg.onload = applyPlacement;
            }
            setTimeout(applyPlacement, 0);
          } else {
            designImg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;';
          }

          stage.appendChild(designImg);
          card.appendChild(stage);
        } else {
          var fallbackImg = document.createElement('img');
          fallbackImg.src = side.designPNG;
          fallbackImg.alt = side.view + ' preview';
          fallbackImg.style.cssText = 'width:100%;aspect-ratio:1;object-fit:contain;background:#f5f5f5;display:block;';
          card.appendChild(fallbackImg);
        }
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

  // --- Add to cart (WooCommerce or generic) ---
  function _addToCart(payload, callback) {
    if (_wcProductId) {
      var formData = new FormData();
      formData.append('product_id', _wcProductId);
      formData.append('quantity', '1');
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

      fetch('/?wc-ajax=add_to_cart', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.error) {
            // Variable product — needs variation selection on product page
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
          // Simple product — added successfully
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

    // No WooCommerce product ID — just complete
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

  root.CustomizerStudio = {
    init: init,
    open: open,
    close: close,
  };
})(typeof window !== 'undefined' ? window : this);
