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
 *         theme: 'dark',           // 'light' or 'dark'
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

    // Create session via API
    var url = _config.apiUrl + '/create-session';
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: options.product,
        external_ref: options.externalRef || null,
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) {
          console.error('[CustomizerStudio] Error:', data.error);
          return;
        }
        // Always prefer our own baseUrl over the API response URL,
        // because the API infers origin from the request (which is the store's domain, not ours)
        var embedUrl = _config.baseUrl
          ? (_config.baseUrl + '/embed/' + data.sessionId)
          : (data.customizerUrl || ('/embed/' + data.sessionId));

        // Append brand config as URL params if provided
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
    // Create overlay
    _overlay = document.createElement('div');
    _overlay.style.cssText =
      'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';

    // Close button
    var closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText =
      'position:absolute;top:16px;right:16px;background:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:18px;cursor:pointer;z-index:1000000;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    closeBtn.onclick = function () { close(); _callbacks.onCancel(); };
    _overlay.appendChild(closeBtn);

    // Iframe
    _iframe = document.createElement('iframe');
    _iframe.src = url;
    _iframe.style.cssText =
      'width:95vw;height:92vh;max-width:1400px;border:none;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.5);background:#fff;';
    _iframe.allow = 'clipboard-write';
    _overlay.appendChild(_iframe);

    document.body.appendChild(_overlay);
    document.body.style.overflow = 'hidden';

    // Listen for messages from the customizer
    window.addEventListener('message', _handleMessage);
  }

  function _handleMessage(event) {
    var data = event.data;
    if (!data || data.source !== 'customizer-studio') return;

    if (data.type === 'design-complete') {
      _callbacks.onComplete(data.payload);
      close();
    } else if (data.type === 'design-cancel') {
      _callbacks.onCancel();
      close();
    }
  }

  function close() {
    window.removeEventListener('message', _handleMessage);
    if (_overlay && _overlay.parentNode) {
      _overlay.parentNode.removeChild(_overlay);
    }
    _overlay = null;
    _iframe = null;
    document.body.style.overflow = '';
  }

  root.CustomizerStudio = {
    init: init,
    open: open,
    close: close,
  };
})(typeof window !== 'undefined' ? window : this);
