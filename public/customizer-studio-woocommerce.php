<?php
/**
 * Plugin Name: Customizer Studio for WooCommerce
 * Description: All-in-one product customizer integration. Auto-injects scripts, adds "Customize" buttons, saves designs to cart & orders. Supports simple and variable products.
 * Version: 1.0.0
 * Author: Customizer Studio
 * Requires Plugins: woocommerce
 * License: GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* ================================================================
   1. SETTINGS PAGE
   ================================================================ */

add_action( 'admin_menu', function () {
	add_submenu_page(
		'woocommerce',
		'Customizer Studio',
		'Customizer Studio',
		'manage_woocommerce',
		'customizer-studio',
		'cs_render_settings_page'
	);
} );

add_action( 'admin_init', function () {
	register_setting( 'cs_settings', 'cs_base_url', [ 'sanitize_callback' => 'esc_url_raw' ] );
	register_setting( 'cs_settings', 'cs_api_url', [ 'sanitize_callback' => 'esc_url_raw' ] );
	register_setting( 'cs_settings', 'cs_anon_key', [ 'sanitize_callback' => 'sanitize_text_field' ] );
	register_setting( 'cs_settings', 'cs_button_label', [ 'sanitize_callback' => 'sanitize_text_field' ] );
	register_setting( 'cs_settings', 'cs_button_position', [ 'sanitize_callback' => 'sanitize_text_field' ] );
} );

function cs_render_settings_page() {
	$base_url        = get_option( 'cs_base_url', '' );
	$api_url         = get_option( 'cs_api_url', '' );
	$anon_key        = get_option( 'cs_anon_key', '' );
	$button_label    = get_option( 'cs_button_label', '🎨 Customize This Product' );
	$button_position = get_option( 'cs_button_position', 'before_add_to_cart' );
	?>
	<div class="wrap">
		<h1>Customizer Studio Settings</h1>

		<?php if ( isset( $_GET['settings-updated'] ) && $_GET['settings-updated'] === 'true' ) : ?>
			<div class="notice notice-success is-dismissible" style="border-left-color:#10b981;">
				<p><strong>✓ Settings saved successfully!</strong> Your Customizer Studio configuration has been updated.</p>
			</div>
		<?php endif; ?>

		<form method="post" action="options.php">
			<?php settings_fields( 'cs_settings' ); ?>
			<table class="form-table">
				<tr>
					<th>Base URL</th>
					<td>
						<input type="url" name="cs_base_url" value="<?php echo esc_attr( $base_url ); ?>" class="regular-text" placeholder="https://cstmzr.lovable.app" />
						<p class="description">Your Customizer Studio hosted URL.</p>
					</td>
				</tr>
				<tr>
					<th>API URL</th>
					<td>
						<input type="url" name="cs_api_url" value="<?php echo esc_attr( $api_url ); ?>" class="regular-text" placeholder="https://xxx.supabase.co/functions/v1" />
						<p class="description">Backend API endpoint.</p>
					</td>
				</tr>
				<tr>
					<th>Anon Key</th>
					<td>
						<input type="text" name="cs_anon_key" value="<?php echo esc_attr( $anon_key ); ?>" class="regular-text" />
						<p class="description">Public API key for product fetching.</p>
					</td>
				</tr>
				<tr>
					<th>Button Label</th>
					<td>
						<input type="text" name="cs_button_label" value="<?php echo esc_attr( $button_label ); ?>" class="regular-text" />
					</td>
				</tr>
				<tr>
					<th>Button Position</th>
					<td>
						<select name="cs_button_position">
							<option value="before_add_to_cart" <?php selected( $button_position, 'before_add_to_cart' ); ?>>Before Add to Cart</option>
							<option value="after_add_to_cart" <?php selected( $button_position, 'after_add_to_cart' ); ?>>After Add to Cart</option>
							<option value="after_summary" <?php selected( $button_position, 'after_summary' ); ?>>After Product Summary</option>
						</select>
						<p class="description">If the button doesn't appear, try a different position or use the shortcode <code>[customizer_button]</code>.</p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>

		<hr />
		<h2>Troubleshooting</h2>
		<p>If the Customize button doesn't appear on your product pages:</p>
		<ol>
			<li>Make sure you've <strong>enabled</strong> the customizer in the product's edit page (sidebar meta box).</li>
			<li>Try changing the <strong>Button Position</strong> above — some themes don't support all hooks.</li>
			<li>Use the shortcode <code>[customizer_button]</code> in your product description or page builder.</li>
			<li>Check that your Base URL and API URL are correct and accessible.</li>
		</ol>
	</div>
	<?php
}

/* ================================================================
   2. PRODUCT META BOX — Link WC product to Customizer product
   ================================================================ */

add_action( 'add_meta_boxes', function () {
	add_meta_box(
		'cs_product_meta',
		'Customizer Studio',
		'cs_render_product_meta_box',
		'product',
		'side',
		'default'
	);
} );

function cs_render_product_meta_box( $post ) {
	wp_nonce_field( 'cs_product_meta', 'cs_product_meta_nonce' );
	$product_id   = get_post_meta( $post->ID, '_cs_product_id', true );
	$product_name = get_post_meta( $post->ID, '_cs_product_name', true );
	$enabled      = get_post_meta( $post->ID, '_cs_enabled', true );
	?>
	<p>
		<label>
			<input type="checkbox" name="cs_enabled" value="1" <?php checked( $enabled, '1' ); ?> />
			Enable Customizer
		</label>
	</p>
	<p>
		<label>Customizer Product ID:</label><br />
		<input type="text" name="cs_product_id" value="<?php echo esc_attr( $product_id ); ?>" style="width:100%;" placeholder="UUID from Customizer Studio" />
	</p>
	<p>
		<label>Or Product Name:</label><br />
		<input type="text" name="cs_product_name" value="<?php echo esc_attr( $product_name ); ?>" style="width:100%;" placeholder="Exact product name" />
	</p>
	<p class="description">Enter either the Customizer Product ID or the exact product name. If both are provided, the ID takes priority.</p>
	<?php
}

add_action( 'save_post_product', function ( $post_id ) {
	if ( ! isset( $_POST['cs_product_meta_nonce'] ) || ! wp_verify_nonce( $_POST['cs_product_meta_nonce'], 'cs_product_meta' ) ) {
		return;
	}
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}

	update_post_meta( $post_id, '_cs_enabled', isset( $_POST['cs_enabled'] ) ? '1' : '0' );
	update_post_meta( $post_id, '_cs_product_id', sanitize_text_field( $_POST['cs_product_id'] ?? '' ) );
	update_post_meta( $post_id, '_cs_product_name', sanitize_text_field( $_POST['cs_product_name'] ?? '' ) );
} );

/* ================================================================
   3. ENQUEUE SCRIPTS — Auto-inject SDK & Loader on frontend
   ================================================================ */

add_action( 'wp_enqueue_scripts', function () {
	// Load scripts on all frontend pages where WooCommerce is active
	// This ensures the SDK is available even if is_product() is not yet resolved
	if ( ! function_exists( 'is_woocommerce' ) ) {
		return;
	}

	$base_url = untrailingslashit( get_option( 'cs_base_url', '' ) );
	$api_url  = get_option( 'cs_api_url', '' );
	$anon_key = get_option( 'cs_anon_key', '' );

	if ( empty( $base_url ) || empty( $api_url ) ) {
		return;
	}

	// SDK
	wp_enqueue_script( 'customizer-sdk', $base_url . '/customizer-sdk.js', [], null, true );

	// Loader — we register and add data attributes via script_loader_tag filter
	wp_enqueue_script( 'customizer-loader', $base_url . '/customizer-loader.js', [ 'customizer-sdk' ], null, true );

	// Store config for the filter below
	wp_localize_script( 'customizer-loader', 'csLoaderConfig', [
		'apiUrl'  => $api_url,
		'baseUrl' => $base_url,
		'anonKey' => $anon_key,
	] );
} );

// Add data-* attributes to the loader script tag
add_filter( 'script_loader_tag', function ( $tag, $handle ) {
	if ( $handle !== 'customizer-loader' ) {
		return $tag;
	}

	$api_url  = esc_attr( get_option( 'cs_api_url', '' ) );
	$base_url = esc_attr( untrailingslashit( get_option( 'cs_base_url', '' ) ) );
	$anon_key = esc_attr( get_option( 'cs_anon_key', '' ) );

	$tag = str_replace( ' src=', " data-api-url=\"{$api_url}\" data-base-url=\"{$base_url}\" data-anon-key=\"{$anon_key}\" src=", $tag );

	return $tag;
}, 10, 2 );

/* ================================================================
   4. INJECT CUSTOMIZE BUTTON ON PRODUCT PAGES
   ================================================================ */

// Register button on ALL common WooCommerce product page hooks for maximum compatibility
add_action( 'wp', function () {
	if ( ! is_product() ) {
		return;
	}

	$position = get_option( 'cs_button_position', 'before_add_to_cart' );

	switch ( $position ) {
		case 'after_add_to_cart':
			add_action( 'woocommerce_after_add_to_cart_button', 'cs_render_customize_button' );
			break;
		case 'after_summary':
			add_action( 'woocommerce_single_product_summary', 'cs_render_customize_button', 60 );
			break;
		default: // before_add_to_cart
			add_action( 'woocommerce_before_add_to_cart_button', 'cs_render_customize_button' );
			break;
	}

	// Always register a fallback on woocommerce_single_product_summary at priority 35
	// (after price, before add-to-cart form) in case the primary hook doesn't fire
	add_action( 'woocommerce_single_product_summary', 'cs_render_customize_button_fallback', 35 );
} );

// Shortcode support: [customizer_button] — for manual placement in product descriptions or page builders
add_shortcode( 'customizer_button', function ( $atts ) {
	global $product;
	if ( ! $product ) {
		return '';
	}

	$atts = shortcode_atts( [ 'label' => '' ], $atts );

	$enabled = get_post_meta( $product->get_id(), '_cs_enabled', true );
	if ( $enabled !== '1' ) {
		return '';
	}

	ob_start();
	cs_render_customize_button( $atts['label'] ?: null );
	return ob_get_clean();
} );

// Track whether the button has already been rendered for this product to avoid duplicates
function cs_button_was_rendered( $set = false ) {
	static $rendered = false;
	if ( $set ) {
		$rendered = true;
	}
	return $rendered;
}

// Fallback render — only fires if the primary hook didn't render the button
function cs_render_customize_button_fallback() {
	if ( cs_button_was_rendered() ) {
		return; // Already rendered by primary hook
	}
	cs_render_customize_button();
}

function cs_render_customize_button( $custom_label = null ) {
	global $product;

	if ( ! $product ) {
		return;
	}

	// Prevent duplicate rendering
	if ( cs_button_was_rendered() ) {
		return;
	}

	$enabled = get_post_meta( $product->get_id(), '_cs_enabled', true );
	if ( $enabled !== '1' ) {
		return;
	}

	// Mark as rendered
	cs_button_was_rendered( true );

	$cs_product_id   = get_post_meta( $product->get_id(), '_cs_product_id', true );
	$cs_product_name = get_post_meta( $product->get_id(), '_cs_product_name', true );
	$wc_product_id   = $product->get_id();
	$button_label    = $custom_label ?: get_option( 'cs_button_label', '🎨 Customize This Product' );

	$data_attrs = 'data-customizer';
	$data_attrs .= ' data-wc-product-id="' . esc_attr( $wc_product_id ) . '"';

	if ( ! empty( $cs_product_id ) ) {
		$data_attrs .= ' data-product-id="' . esc_attr( $cs_product_id ) . '"';
	} elseif ( ! empty( $cs_product_name ) ) {
		$data_attrs .= ' data-product-name="' . esc_attr( $cs_product_name ) . '"';
	}

	echo '<div style="margin:12px 0;">';
	echo '<button type="button" ' . $data_attrs . ' class="button alt cs-customize-btn" style="width:100%;padding:12px 24px;font-size:15px;font-weight:600;background:#111;color:#fff;border:none;border-radius:8px;cursor:pointer;transition:background 0.2s;">';
	echo esc_html( $button_label );
	echo '</button>';
	echo '</div>';
}

/* ================================================================
   5. CART INTEGRATION — Save design data as cart item meta
   ================================================================ */

// Capture customizer data on add-to-cart (works for simple & variable products)
add_filter( 'woocommerce_add_cart_item_data', function ( $cart_item_data, $product_id, $variation_id ) {
	if ( ! empty( $_POST['customizer_session_id'] ) ) {
		$cart_item_data['customizer_session_id'] = sanitize_text_field( wp_unslash( $_POST['customizer_session_id'] ) );
	}
	if ( ! empty( $_POST['customizer_design_url'] ) ) {
		$cart_item_data['customizer_design_url'] = esc_url_raw( wp_unslash( $_POST['customizer_design_url'] ) );
	}

	// Also check GET params (for variable product redirect flow)
	if ( empty( $cart_item_data['customizer_session_id'] ) && ! empty( $_GET['customizer_session'] ) ) {
		$cart_item_data['customizer_session_id'] = sanitize_text_field( wp_unslash( $_GET['customizer_session'] ) );
	}

	return $cart_item_data;
}, 10, 3 );

// Replace cart item thumbnail with design image
add_filter( 'woocommerce_cart_item_thumbnail', function ( $thumbnail, $cart_item, $cart_item_key ) {
	if ( ! empty( $cart_item['customizer_design_url'] ) ) {
		$url = esc_url( $cart_item['customizer_design_url'] );
		return '<img src="' . $url . '" alt="Custom Design" style="max-width:80px;border-radius:4px;" />';
	}
	return $thumbnail;
}, 10, 3 );

// Show "Customized" label in cart item details
add_filter( 'woocommerce_get_item_data', function ( $item_data, $cart_item ) {
	if ( ! empty( $cart_item['customizer_session_id'] ) ) {
		$item_data[] = [
			'key'   => 'Design',
			'value' => '✓ Custom design applied',
		];
	}
	return $item_data;
}, 10, 2 );

// Persist customizer data through cart session
add_filter( 'woocommerce_get_cart_item_from_session', function ( $cart_item, $values ) {
	if ( isset( $values['customizer_session_id'] ) ) {
		$cart_item['customizer_session_id'] = $values['customizer_session_id'];
	}
	if ( isset( $values['customizer_design_url'] ) ) {
		$cart_item['customizer_design_url'] = $values['customizer_design_url'];
	}
	return $cart_item;
}, 10, 2 );

/* ================================================================
   6. ORDER INTEGRATION — Save design data to order line items
   ================================================================ */

add_action( 'woocommerce_checkout_create_order_line_item', function ( $item, $cart_item_key, $values, $order ) {
	if ( ! empty( $values['customizer_session_id'] ) ) {
		$item->add_meta_data( '_customizer_session_id', $values['customizer_session_id'], true );
	}
	if ( ! empty( $values['customizer_design_url'] ) ) {
		$item->add_meta_data( '_customizer_design_url', $values['customizer_design_url'], true );
	}
}, 10, 4 );

// Display design preview in admin order view
add_action( 'woocommerce_after_order_itemmeta', function ( $item_id, $item, $product ) {
	$session_id = $item->get_meta( '_customizer_session_id' );
	$design_url = $item->get_meta( '_customizer_design_url' );

	if ( $session_id || $design_url ) {
		echo '<div class="cs-order-meta" style="margin-top:8px;padding:8px;background:#f8f9fa;border-radius:6px;font-size:12px;">';
		echo '<strong>🎨 Customizer Studio</strong><br/>';
		if ( $session_id ) {
			echo 'Session: <code>' . esc_html( $session_id ) . '</code><br/>';
		}
		if ( $design_url ) {
			echo '<a href="' . esc_url( $design_url ) . '" target="_blank">';
			echo '<img src="' . esc_url( $design_url ) . '" alt="Custom Design" style="max-width:120px;margin-top:4px;border-radius:4px;border:1px solid #ddd;" />';
			echo '</a>';
		}
		echo '</div>';
	}
}, 10, 3 );

/* ================================================================
   7. VARIABLE PRODUCT SUPPORT — Handle variant selection
   ================================================================ */

// Inject JS on product pages to auto-select the variant chosen in the customizer
add_action( 'woocommerce_after_single_product', function () {
	global $product;

	if ( ! $product || ! $product->is_type( 'variable' ) ) {
		return;
	}

	$enabled = get_post_meta( $product->get_id(), '_cs_enabled', true );
	if ( $enabled !== '1' ) {
		return;
	}

	?>
	<script>
	(function() {
		'use strict';

		// Listen for the customizer complete event to auto-add variable product to cart
		document.addEventListener('customizer:addtocart', function(e) {
			var detail = e.detail || {};
			var variant = detail.variant || {};
			var colorName = (variant.colorName || '').toLowerCase().trim();
			var sessionId = detail.sessionId || '';

			if (!colorName) return;

			// Try to find and select the matching variation attribute
			var selects = document.querySelectorAll('.variations select');
			selects.forEach(function(sel) {
				var attrName = (sel.getAttribute('data-attribute_name') || sel.name || '').toLowerCase();
				// Common attribute names for color
				if (attrName.indexOf('color') >= 0 || attrName.indexOf('colour') >= 0) {
					var options = sel.querySelectorAll('option');
					options.forEach(function(opt) {
						if (opt.value.toLowerCase().trim() === colorName || opt.textContent.toLowerCase().trim() === colorName) {
							sel.value = opt.value;
							sel.dispatchEvent(new Event('change', { bubbles: true }));
						}
					});
				}
			});

			// Also try swatch buttons (common in themes like Flavor, Flavor Theme, etc.)
			document.querySelectorAll('.variable-items-wrapper .variable-item, .swatch-wrapper .swatch').forEach(function(swatch) {
				var val = (swatch.getAttribute('data-value') || swatch.getAttribute('data-title') || '').toLowerCase().trim();
				if (val === colorName) {
					swatch.click();
				}
			});

			// Store session ID in a hidden field so it's included when the form submits
			var form = document.querySelector('form.variations_form, form.cart');
			if (form) {
				var existing = form.querySelector('input[name="customizer_session_id"]');
				if (!existing) {
					var input = document.createElement('input');
					input.type = 'hidden';
					input.name = 'customizer_session_id';
					input.value = sessionId;
					form.appendChild(input);
				} else {
					existing.value = sessionId;
				}

				// Also add design URL
				var sides = detail.sides || [];
				var front = sides.find(function(s) { return s.view === 'front'; }) || sides[0];
				if (front && front.designPNG) {
					var designInput = form.querySelector('input[name="customizer_design_url"]');
					if (!designInput) {
						designInput = document.createElement('input');
						designInput.type = 'hidden';
						designInput.name = 'customizer_design_url';
						designInput.value = front.designPNG;
						form.appendChild(designInput);
					} else {
						designInput.value = front.designPNG;
					}
				}
			}

			// Wait for WooCommerce to resolve the variation, then click add to cart
			setTimeout(function() {
				var addBtn = document.querySelector('.single_add_to_cart_button');
				if (addBtn && !addBtn.disabled && !addBtn.classList.contains('disabled')) {
					addBtn.click();
				}
			}, 800);
		});

		// Also capture customizer session from URL params (redirect flow)
		var urlParams = new URLSearchParams(window.location.search);
		var csSession = urlParams.get('customizer_session');
		if (csSession) {
			var form = document.querySelector('form.variations_form, form.cart');
			if (form) {
				var input = document.createElement('input');
				input.type = 'hidden';
				input.name = 'customizer_session_id';
				input.value = csSession;
				form.appendChild(input);
			}
		}
	})();
	</script>
	<?php
} );

/* ================================================================
   8. VARIABLE PRODUCT AJAX ADD TO CART SUPPORT
   ================================================================ */

// Override the default WooCommerce AJAX add-to-cart to support variable products
// when triggered from the customizer (sends variation_id via AJAX)
add_action( 'wp_ajax_cs_add_to_cart', 'cs_ajax_add_to_cart' );
add_action( 'wp_ajax_nopriv_cs_add_to_cart', 'cs_ajax_add_to_cart' );

function cs_ajax_add_to_cart() {
	$product_id   = absint( $_POST['product_id'] ?? 0 );
	$variation_id = absint( $_POST['variation_id'] ?? 0 );
	$quantity     = absint( $_POST['quantity'] ?? 1 );

	if ( ! $product_id ) {
		wp_send_json_error( [ 'message' => 'No product ID provided' ] );
		return;
	}

	$cart_item_data = [];

	if ( ! empty( $_POST['customizer_session_id'] ) ) {
		$cart_item_data['customizer_session_id'] = sanitize_text_field( wp_unslash( $_POST['customizer_session_id'] ) );
	}
	if ( ! empty( $_POST['customizer_design_url'] ) ) {
		$cart_item_data['customizer_design_url'] = esc_url_raw( wp_unslash( $_POST['customizer_design_url'] ) );
	}

	$variation = [];
	if ( $variation_id ) {
		$variation_obj = wc_get_product( $variation_id );
		if ( $variation_obj ) {
			$variation = $variation_obj->get_variation_attributes();
		}
	}

	$added = WC()->cart->add_to_cart( $product_id, $quantity, $variation_id, $variation, $cart_item_data );

	if ( $added ) {
		WC_AJAX::get_refreshed_fragments();
	} else {
		wp_send_json_error( [ 'message' => 'Could not add to cart' ] );
	}

	wp_die();
}

// Expose the AJAX URL and product variant data to the frontend
add_action( 'wp_footer', function () {
	if ( ! is_product() ) {
		return;
	}

	global $product;
	if ( ! $product || ! $product->is_type( 'variable' ) ) {
		return;
	}

	$enabled = get_post_meta( $product->get_id(), '_cs_enabled', true );
	if ( $enabled !== '1' ) {
		return;
	}

	$variations = $product->get_available_variations();
	$variant_map = [];

	foreach ( $variations as $v ) {
		// Build a map: color_name => variation_id
		foreach ( $v['attributes'] as $attr_name => $attr_value ) {
			if ( stripos( $attr_name, 'color' ) !== false || stripos( $attr_name, 'colour' ) !== false ) {
				$variant_map[ strtolower( $attr_value ) ] = $v['variation_id'];
			}
		}
	}

	?>
	<script>
	var csVariantConfig = {
		ajaxUrl: '<?php echo esc_url( admin_url( 'admin-ajax.php' ) ); ?>',
		productId: <?php echo (int) $product->get_id(); ?>,
		variantMap: <?php echo wp_json_encode( $variant_map ); ?>
	};
	</script>
	<?php
} );

/* ================================================================
   9. UPDATE SDK ADD-TO-CART FOR VARIABLE PRODUCTS
   ================================================================ */

// Add inline script that overrides SDK add-to-cart for variable products
add_action( 'wp_footer', function () {
	if ( ! is_product() ) {
		return;
	}

	global $product;
	if ( ! $product ) {
		return;
	}

	$enabled = get_post_meta( $product->get_id(), '_cs_enabled', true );
	if ( $enabled !== '1' ) {
		return;
	}

	?>
	<script>
	(function() {
		'use strict';

		// Override the SDK's add-to-cart event to use our AJAX endpoint for variable products
		document.addEventListener('customizer:addtocart', function(e) {
			if (typeof csVariantConfig === 'undefined') return; // not a variable product

			var detail = e.detail || {};
			var variant = detail.variant || {};
			var colorName = (variant.colorName || '').toLowerCase().trim();
			var variationId = csVariantConfig.variantMap[colorName] || 0;

			if (!variationId) {
				console.warn('[CS Plugin] Could not find variation for color:', colorName);
				console.warn('[CS Plugin] Available variants:', csVariantConfig.variantMap);
				return;
			}

			var sides = detail.sides || [];
			var front = sides.find(function(s) { return s.view === 'front'; }) || sides[0];
			var designUrl = (front && front.designPNG) || '';

			var formData = new FormData();
			formData.append('action', 'cs_add_to_cart');
			formData.append('product_id', csVariantConfig.productId);
			formData.append('variation_id', variationId);
			formData.append('quantity', '1');
			if (detail.sessionId) formData.append('customizer_session_id', detail.sessionId);
			if (designUrl) formData.append('customizer_design_url', designUrl);

			fetch(csVariantConfig.ajaxUrl, {
				method: 'POST',
				body: formData,
				credentials: 'same-origin',
			})
			.then(function(res) { return res.json(); })
			.then(function(data) {
				if (data.error) {
					console.error('[CS Plugin] Add to cart failed:', data);
					return;
				}
				// Refresh cart fragments
				if (typeof jQuery !== 'undefined') {
					jQuery(document.body).trigger('added_to_cart', [data.fragments, data.cart_hash]);
				}
			})
			.catch(function(err) {
				console.error('[CS Plugin] AJAX error:', err);
			});
		});
	})();
	</script>
	<?php
} );

/* ================================================================
   10. EMAIL INTEGRATION — Show design in order confirmation emails
   ================================================================ */

add_action( 'woocommerce_order_item_meta_end', function ( $item_id, $item, $order, $plain_text ) {
	$design_url = $item->get_meta( '_customizer_design_url' );
	if ( ! $design_url ) {
		return;
	}

	if ( $plain_text ) {
		echo "\nCustom Design: " . esc_url( $design_url ) . "\n";
	} else {
		echo '<br/><small style="color:#666;">Custom Design:</small><br/>';
		echo '<img src="' . esc_url( $design_url ) . '" alt="Custom Design" style="max-width:100px;border-radius:4px;margin-top:4px;" />';
	}
}, 10, 4 );
