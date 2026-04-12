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

/**
 * Sanitize design preview value from the customizer.
 * Supports https URLs and data:image/*;base64,... (common for exported PNG previews).
 * WordPress esc_url_raw() rejects data: URIs, so the URL was often dropped while session_id still saved.
 *
 * @param mixed $raw Raw POST/GET value.
 * @return string
 */
function cs_sanitize_design_source( $raw ) {
	if ( ! is_string( $raw ) || $raw === '' ) {
		return '';
	}
	$raw = wp_unslash( $raw );
	$raw = trim( $raw );

	// Standard remote or same-origin HTTP(S) URL.
	if ( preg_match( '#^https?://#i', $raw ) ) {
		return esc_url_raw( $raw );
	}

	// Data URI for inline PNG/JPEG/GIF/WebP (base64 only).
	if ( preg_match( '#^data:image/(png|jpeg|jpg|gif|webp);base64,#i', $raw ) ) {
		$parts = explode( ',', $raw, 2 );
		if ( count( $parts ) !== 2 ) {
			return '';
		}
		$header = $parts[0];
		$b64    = $parts[1];
		// ~6MB base64 cap to avoid session bloat / DoS.
		if ( strlen( $b64 ) > 8000000 ) {
			return '';
		}
		if ( ! preg_match( '/^[A-Za-z0-9+\/=*\r\n]+$/', $b64 ) ) {
			return '';
		}
		$b64 = preg_replace( '/\s+/', '', $b64 );
		return $header . ',' . $b64;
	}

	return '';
}

/**
 * Escape a design URL or data URI for use in an HTML attribute (e.g. img src).
 *
 * @param string $src Stored design value.
 * @return string
 */
function cs_esc_design_attr( $src ) {
	if ( ! is_string( $src ) || $src === '' ) {
		return '';
	}
	if ( preg_match( '#^data:image/(png|jpeg|jpg|gif|webp);base64,#i', $src ) ) {
		return esc_attr( $src );
	}
	return esc_url( $src );
}

/**
 * Escape design value for use in href (View design link).
 *
 * @param string $src Stored design value.
 * @return string
 */
function cs_esc_design_href( $src ) {
	if ( ! is_string( $src ) || $src === '' ) {
		return '';
	}
	if ( preg_match( '#^data:image/#i', $src ) ) {
		return esc_attr( $src );
	}
	return esc_url( $src );
}

/**
 * Normalize and sanitize an array of side designs: [ { view, url }, ... ].
 *
 * @param mixed $arr Raw array from JSON or POST.
 * @return array<int, array{view:string,url:string}>
 */
function cs_sanitize_customizer_sides_array( $arr ) {
	$out = [];
	if ( ! is_array( $arr ) ) {
		return $out;
	}
	foreach ( $arr as $row ) {
		if ( ! is_array( $row ) ) {
			continue;
		}
		$view = 'front';
		if ( isset( $row['view'] ) && is_string( $row['view'] ) && $row['view'] !== '' ) {
			$view = sanitize_key( strtolower( trim( $row['view'] ) ) );
		}
		if ( $view === '' ) {
			$view = 'front';
		}
		$url = '';
		if ( isset( $row['url'] ) ) {
			$url = cs_sanitize_design_source( $row['url'] );
		} elseif ( isset( $row['designPNG'] ) ) {
			$url = cs_sanitize_design_source( $row['designPNG'] );
		}
		if ( $url === '' ) {
			continue;
		}
		$side = [
			'view' => $view,
			'url'  => $url,
		];
		// Preserve print area coordinates for proportional positioning
		if ( isset( $row['print_area'] ) && is_array( $row['print_area'] ) ) {
			$pa = $row['print_area'];
			$side['print_area'] = [
				'x'      => isset( $pa['x'] ) ? floatval( $pa['x'] ) : 0,
				'y'      => isset( $pa['y'] ) ? floatval( $pa['y'] ) : 0,
				'width'  => isset( $pa['width'] ) ? floatval( $pa['width'] ) : 100,
				'height' => isset( $pa['height'] ) ? floatval( $pa['height'] ) : 100,
			];
		}
		// Preserve product image URL for composite previews
		if ( isset( $row['product_image'] ) ) {
			$img = cs_sanitize_design_source( $row['product_image'] );
			if ( $img !== '' ) {
				$side['product_image'] = $img;
			}
		}
		$out[] = $side;
	}
	return $out;
}

/**
 * Parse customizer_sides from JSON string or array (REST/POST).
 *
 * @param mixed $raw Raw value.
 * @return array<int, array{view:string,url:string}>
 */
function cs_parse_customizer_sides_from_request( $raw ) {
	if ( is_array( $raw ) ) {
		return cs_sanitize_customizer_sides_array( $raw );
	}
	if ( ! is_string( $raw ) || trim( $raw ) === '' ) {
		return [];
	}
	$raw = wp_unslash( $raw );
	$decoded = json_decode( $raw, true );
	if ( ! is_array( $decoded ) ) {
		return [];
	}
	return cs_sanitize_customizer_sides_array( $decoded );
}

/**
 * Prefer "front", else first side URL (for legacy customizer_design_url field).
 *
 * @param array $sides Sanitized sides.
 * @return string
 */
function cs_primary_design_url_from_sides( array $sides ) {
	foreach ( $sides as $s ) {
		if ( ! empty( $s['url'] ) && isset( $s['view'] ) && $s['view'] === 'front' ) {
			return $s['url'];
		}
	}
	return $sides[0]['url'] ?? '';
}

/**
 * Legacy single-design URL only (no multi-side JSON). Used to build a synthetic front side.
 *
 * @param array $cart_item Cart line.
 * @return string
 */
function cs_resolve_legacy_design_url( $cart_item ) {
	if ( ! is_array( $cart_item ) ) {
		return '';
	}
	if ( ! empty( $cart_item['customizer_design_url'] ) ) {
		return $cart_item['customizer_design_url'];
	}
	if ( ! empty( $cart_item['_cs_design_transient_key'] ) ) {
		$stored = get_transient( $cart_item['_cs_design_transient_key'] );
		if ( is_string( $stored ) && $stored !== '' ) {
			return $stored;
		}
	}
	if ( ! empty( $cart_item['product_id'] ) ) {
		$product_id = $cart_item['product_id'];
		if ( ! empty( $cart_item['variation_id'] ) ) {
			$product_id = $cart_item['variation_id'];
		}
		$design_url = get_post_meta( $product_id, '_cs_cart_design_url', true );
		if ( $design_url ) {
			return $design_url;
		}
	}
	return '';
}

/**
 * All design sides for a cart line (hydrates transients).
 *
 * @param array $cart_item Cart line.
 * @return array<int, array{view:string,url:string}>
 */
function cs_get_cart_item_sides( $cart_item ) {
	$sides = [];
	if ( ! empty( $cart_item['_cs_sides_transient_key'] ) ) {
		$blob = get_transient( $cart_item['_cs_sides_transient_key'] );
		if ( is_string( $blob ) && $blob !== '' ) {
			$decoded = json_decode( $blob, true );
			if ( is_array( $decoded ) ) {
				$sides = cs_sanitize_customizer_sides_array( $decoded );
			}
		}
	}
	if ( empty( $sides ) && ! empty( $cart_item['customizer_sides'] ) ) {
		if ( is_string( $cart_item['customizer_sides'] ) ) {
			$decoded = json_decode( $cart_item['customizer_sides'], true );
			if ( is_array( $decoded ) ) {
				$sides = cs_sanitize_customizer_sides_array( $decoded );
			}
		} elseif ( is_array( $cart_item['customizer_sides'] ) ) {
			$sides = cs_sanitize_customizer_sides_array( $cart_item['customizer_sides'] );
		}
	}
	if ( empty( $sides ) ) {
		$legacy = cs_resolve_legacy_design_url( $cart_item );
		if ( $legacy !== '' ) {
			$sides = [
				[
					'view' => 'front',
					'url'  => $legacy,
				],
			];
		}
	}
	return $sides;
}

/**
 * Build URL to a full-page preview that shows product image behind the design (new tab).
 * Raw design URLs only show the artwork; this page stacks both layers.
 *
 * @param string $product_thumb_url Escaped product thumbnail URL, or empty.
 * @param string $design_url        Raw design URL or data URI.
 * @return string Safe href for <a>.
 */
function cs_build_stacked_preview_page_url( $product_thumb_url, $design_url, $sides = null ) {
	$design_url = is_string( $design_url ) ? $design_url : '';
	$has_sides  = is_array( $sides ) && ! empty( $sides );
	if ( $design_url === '' && ! $has_sides ) {
		return '';
	}
	$thumb = is_string( $product_thumb_url ) ? trim( $product_thumb_url ) : '';
	if ( $thumb === '' ) {
		return $design_url !== '' ? cs_esc_design_href( $design_url ) : '';
	}

	$token = wp_generate_password( 32, false, false );
	$payload = [
		'product_thumb_url' => $thumb,
		'design_url'        => $design_url,
	];
	if ( $has_sides ) {
		$payload['sides'] = array_values( $sides );
	}
	// Large data URIs: transient may fail on some hosts; fall back to design-only link.
	if ( false === set_transient( 'cs_dspv_' . $token, $payload, HOUR_IN_SECONDS ) ) {
		return $design_url !== '' ? cs_esc_design_href( $design_url ) : '';
	}

	return esc_url( add_query_arg( 'cs_dspreview', $token, home_url( '/' ) ) );
}

/**
 * Stacked preview URL for a cart line item.
 *
 * @param array $cart_item WooCommerce cart item.
 * @return string
 */
function cs_get_stacked_preview_url_for_cart_item( $cart_item ) {
	$design = cs_get_cart_item_design_url( $cart_item );
	$sides  = cs_get_cart_item_sides( $cart_item );
	if ( $design === '' && empty( $sides ) ) {
		return '';
	}
	$thumb = cs_get_cart_item_product_thumb_url( $cart_item );
	if ( count( $sides ) > 1 ) {
		return cs_build_stacked_preview_page_url( $thumb, $design, $sides );
	}
	return cs_build_stacked_preview_page_url( $thumb, $design );
}

/**
 * Stacked preview URL for an order line item (admin / emails).
 *
 * @param WC_Order_Item_Product $item Order item.
 * @return string
 */
function cs_get_stacked_preview_url_for_order_item( $item ) {
	$design = $item->get_meta( '_customizer_design_url' );
	if ( ! is_string( $design ) ) {
		$design = '';
	}
	$sides_json = $item->get_meta( '_customizer_sides_json' );
	$sides      = [];
	if ( is_string( $sides_json ) && $sides_json !== '' ) {
		$decoded = json_decode( $sides_json, true );
		if ( is_array( $decoded ) ) {
			$sides = cs_sanitize_customizer_sides_array( $decoded );
		}
	}
	if ( $design === '' && empty( $sides ) ) {
		return '';
	}
	$thumb = '';
	$product = $item->get_product();
	if ( $product && is_a( $product, 'WC_Product' ) ) {
		$img_id = $product->get_image_id();
		if ( $img_id ) {
			$src = wp_get_attachment_image_src( $img_id, 'large' );
			if ( $src ) {
				$thumb = esc_url( $src[0] );
			}
		}
		if ( ! $thumb && $product->is_type( 'variation' ) ) {
			$parent = wc_get_product( $product->get_parent_id() );
			if ( $parent && $parent->get_image_id() ) {
				$src = wp_get_attachment_image_src( $parent->get_image_id(), 'large' );
				if ( $src ) {
					$thumb = esc_url( $src[0] );
				}
			}
		}
	}
	if ( count( $sides ) > 1 ) {
		return cs_build_stacked_preview_page_url( $thumb, $design !== '' ? $design : ( $sides[0]['url'] ?? '' ), $sides );
	}
	return cs_build_stacked_preview_page_url( $thumb, $design !== '' ? $design : ( $sides[0]['url'] ?? '' ) );
}

/**
 * Output full-page product + design preview (query arg cs_dspreview).
 */
function cs_output_design_preview_page() {
	if ( empty( $_GET['cs_dspreview'] ) || is_admin() ) {
		return;
	}

	$token = sanitize_text_field( wp_unslash( $_GET['cs_dspreview'] ) );
	if ( strlen( $token ) < 20 ) {
		wp_die( esc_html__( 'Invalid preview link.', 'customizer-studio-for-woocommerce' ), '', [ 'response' => 404 ] );
	}

	$data = get_transient( 'cs_dspv_' . $token );
	if ( ! is_array( $data ) ) {
		wp_die( esc_html__( 'This preview link has expired. Open it again from your cart.', 'customizer-studio-for-woocommerce' ), '', [ 'response' => 410 ] );
	}

	$product_src = isset( $data['product_thumb_url'] ) ? $data['product_thumb_url'] : '';
	$design_src  = isset( $data['design_url'] ) ? $data['design_url'] : '';
	$sides       = isset( $data['sides'] ) && is_array( $data['sides'] ) ? $data['sides'] : [];

	if ( $design_src === '' && empty( $sides ) ) {
		wp_die( esc_html__( 'This preview link has expired. Open it again from your cart.', 'customizer-studio-for-woocommerce' ), '', [ 'response' => 410 ] );
	}

	nocache_headers();
	header( 'Content-Type: text/html; charset=' . get_option( 'blog_charset' ) );

	$product_attr = is_string( $product_src ) && $product_src !== '' ? cs_esc_design_attr( $product_src ) : '';

	$title = esc_html__( 'Design preview', 'customizer-studio-for-woocommerce' );
	$site  = esc_html( get_bloginfo( 'name' ) );

	echo '<!DOCTYPE html><html lang="' . esc_attr( get_bloginfo( 'language' ) ) . '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
	echo '<title>' . $title . ' — ' . $site . '</title>';
	echo '<style>
		*{box-sizing:border-box;}
		body{margin:0;min-height:100vh;background:#0f0f10;color:#e5e7eb;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;}
		.cs-dsp-wrap{position:relative;width:min(92vw,520px);aspect-ratio:1;max-height:85vh;background:#1a1a1c;border-radius:16px;overflow:hidden;border:1px solid #2d2d32;box-shadow:0 20px 50px rgba(0,0,0,.45);}
		.cs-dsp-wrap img.cs-dsp-product{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:1;}
		.cs-dsp-wrap img.cs-dsp-design{position:absolute;object-fit:contain;z-index:2;pointer-events:none;}
		.cs-dsp-wrap img.cs-dsp-design-full{inset:0;width:100%;height:100%;}
		.cs-dsp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;width:min(96vw,920px);margin-top:8px;}
		.cs-dsp-panel{position:relative;aspect-ratio:1;background:#1a1a1c;border-radius:12px;overflow:hidden;border:1px solid #2d2d32;}
		.cs-dsp-panel .cs-dsp-label{position:absolute;top:8px;left:8px;z-index:4;background:rgba(0,0,0,.55);padding:4px 8px;border-radius:6px;font-size:12px;text-transform:capitalize;}
		p.cs-dsp-note{margin-top:20px;font-size:14px;color:#9ca3af;text-align:center;max-width:36rem;line-height:1.5;}
	</style>
	<script>
	function csPositionDesign(container){
		var designImg = container.querySelector("img.cs-dsp-design[data-pa-x]");
		if(!designImg) return;
		var baseImg = container.querySelector("img.cs-dsp-product");
		if(!baseImg) return;
		var paX=parseFloat(designImg.getAttribute("data-pa-x"))||0;
		var paY=parseFloat(designImg.getAttribute("data-pa-y"))||0;
		var paW=parseFloat(designImg.getAttribute("data-pa-w"))||100;
		var paH=parseFloat(designImg.getAttribute("data-pa-h"))||100;
		function apply(){
			var cw=container.offsetWidth,ch=container.offsetHeight;
			if(!cw||!ch)return;
			var nw=baseImg.naturalWidth||cw,nh=baseImg.naturalHeight||ch;
			var s=Math.min(cw/nw,ch/nh);
			var rw=nw*s,rh=nh*s;
			var offX=(cw-rw)/2,offY=(ch-rh)/2;
			designImg.style.left=(offX+(paX/100)*rw)+"px";
			designImg.style.top=(offY+(paY/100)*rh)+"px";
			designImg.style.width=((paW/100)*rw)+"px";
			designImg.style.height=((paH/100)*rh)+"px";
		}
		if(baseImg.complete&&baseImg.naturalWidth)apply();
		else baseImg.addEventListener("load",apply);
		setTimeout(apply,200);
	}
	document.addEventListener("DOMContentLoaded",function(){
		document.querySelectorAll(".cs-dsp-wrap,.cs-dsp-panel").forEach(csPositionDesign);
	});
	</script>
	</head><body>';

	if ( count( $sides ) > 1 ) {
		echo '<h1 style="font-size:1.1rem;margin:0 0 12px;font-weight:600;">' . esc_html__( 'All sides', 'customizer-studio-for-woocommerce' ) . '</h1>';
		echo '<div class="cs-dsp-grid">';
		foreach ( $sides as $side ) {
			if ( ! is_array( $side ) ) {
				continue;
			}
			$v = isset( $side['view'] ) ? sanitize_text_field( (string) $side['view'] ) : 'side';
			$u = isset( $side['url'] ) ? $side['url'] : '';
			if ( ! is_string( $u ) || $u === '' ) {
				continue;
			}
			$dattr = cs_esc_design_attr( $u );
			$spa = isset( $side['print_area'] ) && is_array( $side['print_area'] ) ? $side['print_area'] : null;
			echo '<div class="cs-dsp-panel" role="img" aria-label="' . esc_attr( $v ) . '">';
			echo '<span class="cs-dsp-label">' . esc_html( $v ) . '</span>';
			if ( $product_attr !== '' ) {
				echo '<img class="cs-dsp-product" src="' . $product_attr . '" alt="">';
			}
			if ( $spa && $product_attr !== '' ) {
				echo '<img class="cs-dsp-design" src="' . $dattr . '" alt=""'
					. ' data-pa-x="' . esc_attr( $spa['x'] ) . '"'
					. ' data-pa-y="' . esc_attr( $spa['y'] ) . '"'
					. ' data-pa-w="' . esc_attr( $spa['width'] ) . '"'
					. ' data-pa-h="' . esc_attr( $spa['height'] ) . '">';
			} else {
				echo '<img class="cs-dsp-design cs-dsp-design-full" src="' . $dattr . '" alt="">';
			}
			echo '</div>';
		}
		echo '</div>';
		echo '<p class="cs-dsp-note">' . esc_html__( 'Product image (back) and your art per side (front). Save or print from your browser.', 'customizer-studio-for-woocommerce' ) . '</p>';
	} else {
		$design_attr = cs_esc_design_attr( $design_src !== '' ? $design_src : ( is_array( $sides[0] ?? null ) && ! empty( $sides[0]['url'] ) ? $sides[0]['url'] : '' ) );
		$primary_pa = null;
		if ( ! empty( $sides[0]['print_area'] ) && is_array( $sides[0]['print_area'] ) ) {
			$primary_pa = $sides[0]['print_area'];
		}
		echo '<div class="cs-dsp-wrap" role="img" aria-label="' . esc_attr__( 'Product with custom design overlay', 'customizer-studio-for-woocommerce' ) . '">';
		if ( $product_attr !== '' ) {
			echo '<img class="cs-dsp-product" src="' . $product_attr . '" alt="">';
		}
		if ( $primary_pa && $product_attr !== '' ) {
			echo '<img class="cs-dsp-design" src="' . $design_attr . '" alt=""'
				. ' data-pa-x="' . esc_attr( $primary_pa['x'] ) . '"'
				. ' data-pa-y="' . esc_attr( $primary_pa['y'] ) . '"'
				. ' data-pa-w="' . esc_attr( $primary_pa['width'] ) . '"'
				. ' data-pa-h="' . esc_attr( $primary_pa['height'] ) . '">';
		} else {
			echo '<img class="cs-dsp-design cs-dsp-design-full" src="' . $design_attr . '" alt="">';
		}
		echo '</div>';
		echo '<p class="cs-dsp-note">' . esc_html__( 'Product image (back) and your custom design (front). Use your browser to save or print.', 'customizer-studio-for-woocommerce' ) . '</p>';
	}
	echo '</body></html>';
	exit;
}

add_action( 'template_redirect', 'cs_output_design_preview_page', 0 );

/**
 * Mini-cart fragment payload (same shape as WC_AJAX::get_refreshed_fragments).
 *
 * @return array{fragments: array, cart_hash: string}
 */
function cs_get_cart_fragments_data() {
	ob_start();
	woocommerce_mini_cart();
	$mini_cart = ob_get_clean();

	return [
		'fragments' => apply_filters(
			'woocommerce_add_to_cart_fragments',
			[
				'div.widget_shopping_cart_content' => '<div class="widget_shopping_cart_content">' . $mini_cart . '</div>',
			]
		),
		'cart_hash' => WC()->cart->get_cart_hash(),
	];
}

/**
 * Core add-to-cart for variable products (Customizer). Used by admin-ajax and REST.
 *
 * @param array $input Raw request fields (product_id, variation_id, quantity, customizer_*).
 * @return true|WP_Error
 */
function cs_process_add_to_cart( array $input ) {
	if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
		return new WP_Error( 'wc', __( 'Cart is not available.', 'customizer-studio-for-woocommerce' ) );
	}

	$product_id   = absint( $input['product_id'] ?? 0 );
	$variation_id = absint( $input['variation_id'] ?? 0 );
	$quantity     = absint( $input['quantity'] ?? 1 );

	if ( ! $product_id ) {
		return new WP_Error( 'invalid', __( 'No product ID provided.', 'customizer-studio-for-woocommerce' ) );
	}

	$cart_item_data = [];

	if ( ! empty( $input['customizer_session_id'] ) ) {
		$cart_item_data['customizer_session_id'] = sanitize_text_field( wp_unslash( $input['customizer_session_id'] ) );
	}
	if ( ! empty( $input['customizer_design_url'] ) ) {
		$cart_item_data['customizer_design_url'] = cs_sanitize_design_source( $input['customizer_design_url'] );
	}
	if ( ! empty( $input['customizer_sides'] ) ) {
		$parsed = cs_parse_customizer_sides_from_request( $input['customizer_sides'] );
		if ( ! empty( $parsed ) ) {
			$cart_item_data['customizer_sides']     = wp_json_encode( $parsed );
			$cart_item_data['customizer_design_url'] = cs_primary_design_url_from_sides( $parsed );
		}
	} elseif ( ! empty( $cart_item_data['customizer_design_url'] ) ) {
		$cart_item_data['customizer_sides'] = wp_json_encode(
			[
				[
					'view' => 'front',
					'url'  => $cart_item_data['customizer_design_url'],
				],
			]
		);
	}

	$variation = [];
	if ( $variation_id ) {
		$variation_obj = wc_get_product( $variation_id );
		if ( $variation_obj ) {
			$variation = $variation_obj->get_variation_attributes();
		}
	}

	$added = WC()->cart->add_to_cart( $product_id, $quantity, $variation_id, $variation, $cart_item_data );

	if ( ! $added ) {
		$notices = function_exists( 'wc_get_notices' ) ? wc_get_notices( 'error' ) : [];
		$msg     = __( 'Could not add to cart.', 'customizer-studio-for-woocommerce' );
		if ( ! empty( $notices ) && is_array( $notices ) ) {
			$msg = wp_strip_all_tags( $notices[0]['notice'] ?? $msg );
		}
		return new WP_Error( 'add_failed', $msg );
	}

	return true;
}

/**
 * REST: add customized variable product to cart (often bypasses WAF rules that block admin-ajax.php).
 */
function cs_rest_add_to_cart( WP_REST_Request $request ) {
	if ( ! wp_verify_nonce( $request->get_header( 'X-WP-Nonce' ), 'wp_rest' ) ) {
		return new WP_Error(
			'rest_forbidden',
			__( 'Invalid or expired nonce. Refresh the page.', 'customizer-studio-for-woocommerce' ),
			[ 'status' => 403 ]
		);
	}

	$params = $request->get_json_params();
	if ( ! is_array( $params ) || empty( $params ) ) {
		$params = $request->get_body_params();
	}
	if ( ! is_array( $params ) ) {
		$params = [];
	}

	$result = cs_process_add_to_cart( $params );
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	$data = cs_get_cart_fragments_data();
	return new WP_REST_Response( $data, 200 );
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'customizer-studio/v1',
			'/add-to-cart',
			[
				'methods'             => 'POST',
				'callback'            => 'cs_rest_add_to_cart',
				'permission_callback' => '__return_true',
			]
		);
	}
);

/**
 * If design data is very large (typical for data:image PNG), storing it in the session can
 * exceed PHP post_max_size / session limits and the add-to-cart request fails silently.
 * Offload to a short-lived transient and keep only the key in cart data.
 *
 * @param array $cart_item_data Cart item data.
 * @return array
 */
function cs_offload_large_design_to_transient( $cart_item_data ) {
	if ( empty( $cart_item_data['customizer_design_url'] ) || ! is_string( $cart_item_data['customizer_design_url'] ) ) {
		return $cart_item_data;
	}
	$raw = $cart_item_data['customizer_design_url'];
	// ~96KB — stay under typical post_max_size issues when combined with other fields.
	$max_inline = (int) apply_filters( 'cs_max_inline_design_bytes', 98304 );
	if ( strlen( $raw ) <= $max_inline ) {
		return $cart_item_data;
	}
	$key = 'csd_' . wp_generate_password( 22, false, false );
	set_transient( $key, $raw, 7 * DAY_IN_SECONDS );
	$cart_item_data['customizer_design_url']       = '';
	$cart_item_data['_cs_design_transient_key'] = $key;
	return $cart_item_data;
}

/**
 * Offload very large multi-side JSON (many data: URIs) to a transient.
 *
 * @param array $cart_item_data Cart item data.
 * @return array
 */
function cs_offload_large_sides_to_transient( $cart_item_data ) {
	if ( empty( $cart_item_data['customizer_sides'] ) || ! is_string( $cart_item_data['customizer_sides'] ) ) {
		return $cart_item_data;
	}
	$raw = $cart_item_data['customizer_sides'];
	$max = (int) apply_filters( 'cs_max_inline_sides_bytes', 196608 );
	if ( strlen( $raw ) <= $max ) {
		return $cart_item_data;
	}
	$key = 'cssd_' . wp_generate_password( 22, false, false );
	set_transient( $key, $raw, 7 * DAY_IN_SECONDS );
	$cart_item_data['customizer_sides']          = '';
	$cart_item_data['_cs_sides_transient_key'] = $key;
	return $cart_item_data;
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
	register_setting( 'cs_settings', 'cs_user_id', [ 'sanitize_callback' => 'sanitize_text_field' ] );
	register_setting( 'cs_settings', 'cs_button_label', [ 'sanitize_callback' => 'sanitize_text_field' ] );
	register_setting( 'cs_settings', 'cs_button_position', [ 'sanitize_callback' => 'sanitize_text_field' ] );
} );

function cs_render_settings_page() {
	$base_url        = get_option( 'cs_base_url', '' );
	$api_url         = get_option( 'cs_api_url', '' );
	$anon_key        = get_option( 'cs_anon_key', '' );
	$user_id         = get_option( 'cs_user_id', '' );
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
					<th>User ID</th>
					<td>
						<input type="text" name="cs_user_id" value="<?php echo esc_attr( $user_id ); ?>" class="regular-text" placeholder="Your Customizer Studio user ID (UUID)" />
						<p class="description">Your account ID from Customizer Studio. Required for branding to appear in the customizer. Find it on your Profile Settings page.</p>
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
		'userId'  => get_option( 'cs_user_id', '' ),
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
	$user_id  = esc_attr( get_option( 'cs_user_id', '' ) );

	$tag = str_replace( ' src=', " data-api-url=\"{$api_url}\" data-base-url=\"{$base_url}\" data-anon-key=\"{$anon_key}\" data-user-id=\"{$user_id}\" src=", $tag );

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
		$cart_item_data['customizer_design_url'] = cs_sanitize_design_source( $_POST['customizer_design_url'] );
	}
	if ( ! empty( $_POST['customizer_sides'] ) ) {
		$parsed = cs_parse_customizer_sides_from_request( wp_unslash( $_POST['customizer_sides'] ) );
		if ( ! empty( $parsed ) ) {
			$cart_item_data['customizer_sides'] = wp_json_encode( $parsed );
		}
	}

	// Also check GET params (for variable product redirect flow)
	if ( empty( $cart_item_data['customizer_session_id'] ) && ! empty( $_GET['customizer_session'] ) ) {
		$cart_item_data['customizer_session_id'] = sanitize_text_field( wp_unslash( $_GET['customizer_session'] ) );
	}
	if ( empty( $cart_item_data['customizer_design_url'] ) && ! empty( $_GET['customizer_design_url'] ) ) {
		$cart_item_data['customizer_design_url'] = cs_sanitize_design_source( $_GET['customizer_design_url'] );
	}
	if ( empty( $cart_item_data['customizer_sides'] ) && ! empty( $_GET['customizer_sides'] ) ) {
		$parsed = cs_parse_customizer_sides_from_request( wp_unslash( $_GET['customizer_sides'] ) );
		if ( ! empty( $parsed ) ) {
			$cart_item_data['customizer_sides'] = wp_json_encode( $parsed );
		}
	}

	return $cart_item_data;
}, 10, 3 );

// Ensure customizer_sides JSON exists when only a single URL was posted; sync primary URL from multi-side data.
add_filter(
	'woocommerce_add_cart_item_data',
	function ( $cart_item_data, $product_id, $variation_id ) {
		if ( ! empty( $cart_item_data['customizer_sides'] ) ) {
			$parsed = cs_parse_customizer_sides_from_request( $cart_item_data['customizer_sides'] );
			if ( ! empty( $parsed ) ) {
				$cart_item_data['customizer_sides']     = wp_json_encode( $parsed );
				$cart_item_data['customizer_design_url'] = cs_primary_design_url_from_sides( $parsed );
			}
		} elseif ( ! empty( $cart_item_data['customizer_design_url'] ) ) {
			$cart_item_data['customizer_sides'] = wp_json_encode(
				[
					[
						'view' => 'front',
						'url'  => $cart_item_data['customizer_design_url'],
					],
				]
			);
		}
		return $cart_item_data;
	},
	15,
	3
);

// Offload huge design payloads so POST/session limits do not drop the whole add-to-cart request.
add_filter( 'woocommerce_add_cart_item_data', 'cs_offload_large_design_to_transient', 25, 3 );
add_filter( 'woocommerce_add_cart_item_data', 'cs_offload_large_sides_to_transient', 26, 3 );

/**
 * Primary design URL for overlays / legacy hooks (prefers "front" side).
 *
 * @param array $cart_item Cart line.
 * @return string
 */
function cs_get_cart_item_design_url( $cart_item ) {
	$sides = cs_get_cart_item_sides( $cart_item );
	if ( empty( $sides ) ) {
		return '';
	}
	foreach ( $sides as $s ) {
		if ( ! empty( $s['url'] ) && isset( $s['view'] ) && $s['view'] === 'front' ) {
			return $s['url'];
		}
	}
	return $sides[0]['url'] ?? '';
}

/**
 * Whether the line has any customizer artwork (any side).
 *
 * @param array $cart_item Cart line.
 * @return bool
 */
function cs_cart_item_has_customizer_design( $cart_item ) {
	return ! empty( cs_get_cart_item_sides( $cart_item ) );
}

/**
 * Product thumbnail URL for cart line (variation-aware), for composite previews.
 *
 * @param array $cart_item WooCommerce cart item.
 * @return string Escaped URL or empty.
 */
function cs_get_cart_item_product_thumb_url( $cart_item ) {
	$product_obj = isset( $cart_item['data'] ) ? $cart_item['data'] : null;
	if ( ! $product_obj ) {
		return '';
	}
	$img_id = $product_obj->get_image_id();
	if ( ! $img_id && ! empty( $cart_item['variation_id'] ) ) {
		$variation_obj = wc_get_product( $cart_item['variation_id'] );
		if ( $variation_obj ) {
			$img_id = $variation_obj->get_image_id();
			if ( ! $img_id ) {
				$parent_id = $variation_obj->get_parent_id();
				if ( $parent_id ) {
					$img_id = get_post_thumbnail_id( $parent_id );
				}
			}
		}
	} elseif ( ! $img_id && ! empty( $cart_item['product_id'] ) ) {
		$img_id = get_post_thumbnail_id( $cart_item['product_id'] );
	}
	if ( ! $img_id ) {
		return '';
	}
	$img_src = wp_get_attachment_image_src( $img_id, 'woocommerce_thumbnail' );
	return $img_src ? esc_url( $img_src[0] ) : '';
}

/**
 * Cart/checkout thumbnail: product base + design (primary), optional row of extra sides.
 *
 * @param array  $cart_item        Cart line.
 * @param string $inner_image_html If set, used as product base in main cell (WC product_get_image).
 * @return string
 */
function cs_render_cart_thumb_composite_html( $cart_item, $inner_image_html = '' ) {
	if ( ! cs_cart_item_has_customizer_design( $cart_item ) ) {
		return '';
	}
	$sides         = cs_get_cart_item_sides( $cart_item );
	$primary       = cs_get_cart_item_design_url( $cart_item );
	$design_src    = cs_esc_design_attr( $primary );
	$preview_href  = cs_get_stacked_preview_url_for_cart_item( $cart_item );
	$product_img   = cs_get_cart_item_product_thumb_url( $cart_item );
	$multi         = count( $sides ) > 1;

	// Get print area from the primary (front) side
	$primary_side = null;
	foreach ( $sides as $s ) {
		if ( isset( $s['view'] ) && $s['view'] === 'front' ) {
			$primary_side = $s;
			break;
		}
	}
	if ( ! $primary_side && ! empty( $sides ) ) {
		$primary_side = $sides[0];
	}
	$print_area = isset( $primary_side['print_area'] ) ? $primary_side['print_area'] : null;

	$uid = 'cs-ct-' . wp_generate_password( 8, false, false );

	$html  = '<div class="cs-cart-thumb-wrap" style="display:inline-block;vertical-align:middle;text-align:center;">';
	$html .= '<div id="' . esc_attr( $uid ) . '" class="cs-cart-thumb" style="position:relative;width:80px;height:80px;border-radius:4px;overflow:hidden;background:#f5f5f5;">';
	if ( $inner_image_html !== '' ) {
		$html .= '<div class="cs-product-base-wrap" style="position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;">' . $inner_image_html . '</div>';
	} elseif ( $product_img ) {
		$html .= '<img src="' . $product_img . '" alt="" class="cs-product-base-img" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:1;" />';
	}
	if ( $print_area && $product_img ) {
		// Design positioned within print area — use percentage-based positioning
		$html .= '<img src="' . $design_src . '" alt="" class="cs-design-top-img cs-design-needs-pa" '
			. 'data-pa-x="' . esc_attr( $print_area['x'] ) . '" '
			. 'data-pa-y="' . esc_attr( $print_area['y'] ) . '" '
			. 'data-pa-w="' . esc_attr( $print_area['width'] ) . '" '
			. 'data-pa-h="' . esc_attr( $print_area['height'] ) . '" '
			. 'style="position:absolute;object-fit:contain;z-index:2;pointer-events:none;" />';
	} else {
		$html .= '<img src="' . $design_src . '" alt="" class="cs-design-top-img" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2;pointer-events:none;" />';
	}
	$html .= '</div>';

	if ( $multi ) {
		$html .= '<div class="cs-side-thumbs" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:6px;max-width:240px;">';
		foreach ( $sides as $side ) {
			if ( isset( $side['view'] ) && strtolower( (string) $side['view'] ) === 'front' ) {
				continue;
			}
			$v = isset( $side['view'] ) ? (string) $side['view'] : '';
			$u = isset( $side['url'] ) ? cs_esc_design_attr( $side['url'] ) : '';
			if ( $u === '' ) {
				continue;
			}
			$spa = isset( $side['print_area'] ) ? $side['print_area'] : null;
			$html .= '<div style="text-align:center;flex:0 0 auto;">';
			$html .= '<div class="cs-cart-thumb cs-side-mini" style="position:relative;width:44px;height:44px;border-radius:4px;overflow:hidden;background:#eee;margin:0 auto;">';
			if ( $product_img ) {
				$html .= '<img src="' . $product_img . '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:1;" />';
			}
			if ( $spa && $product_img ) {
				$html .= '<img src="' . $u . '" alt="" class="cs-design-needs-pa" '
					. 'data-pa-x="' . esc_attr( $spa['x'] ) . '" '
					. 'data-pa-y="' . esc_attr( $spa['y'] ) . '" '
					. 'data-pa-w="' . esc_attr( $spa['width'] ) . '" '
					. 'data-pa-h="' . esc_attr( $spa['height'] ) . '" '
					. 'style="position:absolute;object-fit:contain;z-index:2;pointer-events:none;" />';
			} else {
				$html .= '<img src="' . $u . '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2;pointer-events:none;" />';
			}
			$html .= '</div>';
			if ( $v !== '' ) {
				$html .= '<span style="font-size:9px;color:#6b7280;text-transform:capitalize;display:block;margin-top:2px;">' . esc_html( $v ) . '</span>';
			}
			$html .= '</div>';
		}
		$html .= '</div>';
	}

	$html .= '<a href="' . esc_attr( $preview_href ) . '" target="_blank" rel="noopener" class="cs-view-design-link" style="display:block;font-size:11px;margin-top:4px;color:#2563eb;text-decoration:none;">View Design &nearr;</a>';
	$html .= '</div>';
	return $html;
}

// Replace cart item thumbnail with composite: product image + design overlay
add_filter( 'woocommerce_cart_item_thumbnail', function ( $thumbnail, $cart_item, $cart_item_key ) {
	if ( ! cs_cart_item_has_customizer_design( $cart_item ) ) {
		return $thumbnail;
	}
	return cs_render_cart_thumb_composite_html( $cart_item, '' );
}, 10, 3 );

// Also override product image on cart page (some themes use woocommerce_product_get_image)
add_filter( 'woocommerce_product_get_image', function ( $image, $product, $size, $attr, $placeholder ) {
	if ( ! is_cart() && ! is_checkout() ) {
		return $image;
	}

	// Check if this product is in the cart with a custom design
	$cart = WC()->cart;
	if ( ! $cart ) {
		return $image;
	}

	$product_id = $product->get_id();
	$is_variation = $product->is_type( 'variation' );
	$variation_id = $is_variation ? $product_id : 0;
	$parent_id = $is_variation ? $product->get_parent_id() : $product_id;

	foreach ( $cart->get_cart() as $cart_item ) {
		if ( ! cs_cart_item_has_customizer_design( $cart_item ) ) {
			continue;
		}

		$cart_product_id = (int) $cart_item['product_id'];
		$cart_variation_id = ! empty( $cart_item['variation_id'] ) ? (int) $cart_item['variation_id'] : 0;

		// Match by variation_id if both are variations, otherwise match by product_id
		$matches = false;
		if ( $is_variation && $cart_variation_id ) {
			$matches = ( $variation_id === $cart_variation_id );
		} else {
			$matches = ( $parent_id === $cart_product_id && ( ! $is_variation || $cart_variation_id === 0 ) );
		}

		if ( $matches ) {
			return cs_render_cart_thumb_composite_html( $cart_item, $image );
		}
	}

	return $image;
}, 10, 5 );

// Add data attributes to cart item names for JavaScript matching
add_filter( 'woocommerce_cart_item_name', function ( $name, $cart_item, $cart_item_key ) {
	if ( cs_cart_item_has_customizer_design( $cart_item ) ) {
		$product_id = ! empty( $cart_item['product_id'] ) ? (int) $cart_item['product_id'] : 0;
		$variation_id = ! empty( $cart_item['variation_id'] ) ? (int) $cart_item['variation_id'] : 0;
		// Wrap in a span with data attributes for JS matching
		if ( strpos( $name, '<a' ) !== false ) {
			$name = str_replace( '<a ', '<a data-cs-product-id="' . $product_id . '" data-cs-variation-id="' . $variation_id . '" ', $name );
		} else {
			$name = '<span data-cs-product-id="' . $product_id . '" data-cs-variation-id="' . $variation_id . '">' . $name . '</span>';
		}
	}
	return $name;
}, 10, 3 );

// Inject CSS for composite thumbnails (classic + block cart/checkout)
add_action( 'wp_head', function () {
	if ( ! function_exists( 'is_woocommerce' ) ) {
		return;
	}
	echo '<style>
		.cs-cart-thumb { display:inline-block; vertical-align:middle; position:relative; }
		.widget_shopping_cart .cs-cart-thumb,
		.woocommerce-mini-cart .cs-cart-thumb { width:60px; height:60px; }
		.woocommerce-cart-form .cs-cart-thumb { width:80px; height:80px; }
		/* Block cart/checkout overlay */
		.cs-design-overlay-wrap { position:relative; display:inline-block; }
		.cs-design-overlay-wrap img.cs-design-overlay {
			position:absolute; inset:0; width:100%; height:100%; object-fit:contain; pointer-events:none; z-index:3;
		}
		/* Product image sits under design in JS-enhanced thumbnails */
		.cs-cart-thumb .cs-product-base-wrap img {
			max-width:100%; max-height:100%; width:auto; height:auto; object-fit:contain;
		}
		.cs-view-design-link { display:block; font-size:11px; margin-top:4px; color:#2563eb; text-decoration:none; }
		.cs-view-design-link:hover { text-decoration:underline; color:#1d4ed8; }
		/* Block Cart: inline preview (mirrors mini-cart item meta) */
		.cs-block-cart-design-preview {
			margin-top:10px;padding:8px;border:1px solid #e5e7eb;border-radius:6px;background:#fafafa;max-width:220px;
		}
		.cs-block-cart-design-preview .cs-block-cart-design-label { font-size:12px;color:#374151;margin:0 0 6px;font-weight:600; }
		.cs-block-cart-design-preview img { max-width:120px;max-height:120px;display:block;border-radius:4px; }
		.cs-block-cart-composite { position:relative; border-radius:6px; overflow:hidden; background:#f3f4f6; }
		.cs-block-cart-composite img { display:block; }
	</style>
	<script>
	/* Position design overlays within print areas for cart thumbnails */
	(function(){
		function positionPrintAreaDesigns(){
			var els = document.querySelectorAll(".cs-design-needs-pa");
			els.forEach(function(designImg){
				var container = designImg.parentElement;
				if(!container) return;
				var baseImg = container.querySelector("img.cs-product-base-img") || container.querySelector(".cs-product-base-wrap img");
				if(!baseImg) return;
				var paX = parseFloat(designImg.getAttribute("data-pa-x")) || 0;
				var paY = parseFloat(designImg.getAttribute("data-pa-y")) || 0;
				var paW = parseFloat(designImg.getAttribute("data-pa-w")) || 100;
				var paH = parseFloat(designImg.getAttribute("data-pa-h")) || 100;
				function apply(){
					var cw = container.offsetWidth;
					var ch = container.offsetHeight;
					if(!cw || !ch) return;
					var nw = baseImg.naturalWidth || cw;
					var nh = baseImg.naturalHeight || ch;
					var scale = Math.min(cw/nw, ch/nh);
					var rw = nw*scale, rh = nh*scale;
					var offX = (cw-rw)/2, offY = (ch-rh)/2;
					designImg.style.left = (offX + (paX/100)*rw) + "px";
					designImg.style.top = (offY + (paY/100)*rh) + "px";
					designImg.style.width = ((paW/100)*rw) + "px";
					designImg.style.height = ((paH/100)*rh) + "px";
				}
				if(baseImg.complete && baseImg.naturalWidth) apply();
				else baseImg.addEventListener("load", apply);
				setTimeout(apply, 200);
			});
		}
		if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", positionPrintAreaDesigns);
		else positionPrintAreaDesigns();
		new MutationObserver(positionPrintAreaDesigns).observe(document.body,{childList:true,subtree:true});
	})();
	</script>';
} );

/* ================================================================
   5b. BLOCK CART/CHECKOUT SUPPORT — JS-based design overlay
   ================================================================ */

// Expose design URLs to the frontend via a global JS object for block-based cart/checkout
add_action( 'wp_footer', function () {
	if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
		return;
	}

	$design_map = [];
	foreach ( WC()->cart->get_cart() as $cart_item_key => $cart_item ) {
		if ( ! cs_cart_item_has_customizer_design( $cart_item ) ) {
			continue;
		}
		$design_url = cs_get_cart_item_design_url( $cart_item );
		$sides      = cs_get_cart_item_sides( $cart_item );
		$design_map[ $cart_item_key ] = [
			'product_id'          => (int) $cart_item['product_id'],
			'variation_id'        => (int) ( $cart_item['variation_id'] ?? 0 ),
			// Raw value — wp_json_encode handles escaping. esc_url() strips data: URIs used by many customizers.
			'design_url'          => $design_url,
			'sides'               => $sides,
			'name'                => $cart_item['data'] ? $cart_item['data']->get_name() : '',
			'product_thumb_url'   => cs_get_cart_item_product_thumb_url( $cart_item ),
			'stacked_preview_url' => cs_get_stacked_preview_url_for_cart_item( $cart_item ),
		];
	}

	if ( empty( $design_map ) ) {
		return;
	}

	// Same order as PHP cart — aligns with Cart block row order (index match).
	$cart_line_order = [];
	foreach ( WC()->cart->get_cart() as $cart_item_key => $cart_item ) {
		$du = cs_get_cart_item_design_url( $cart_item );
		if ( ! cs_cart_item_has_customizer_design( $cart_item ) ) {
			$cart_line_order[] = [
				'cart_item_key'       => $cart_item_key,
				'design_url'          => '',
				'sides'               => [],
				'product_id'          => (int) $cart_item['product_id'],
				'variation_id'        => (int) ( $cart_item['variation_id'] ?? 0 ),
				'name'                => $cart_item['data'] ? $cart_item['data']->get_name() : '',
				'product_thumb_url'   => '',
				'stacked_preview_url' => '',
			];
			continue;
		}
		$cart_line_order[] = [
			'cart_item_key'         => $cart_item_key,
			'design_url'            => $du ? $du : '',
			'sides'                 => cs_get_cart_item_sides( $cart_item ),
			'product_id'            => (int) $cart_item['product_id'],
			'variation_id'        => (int) ( $cart_item['variation_id'] ?? 0 ),
			'name'                  => $cart_item['data'] ? $cart_item['data']->get_name() : '',
			'product_thumb_url'     => cs_get_cart_item_product_thumb_url( $cart_item ),
			'stacked_preview_url'   => $du ? cs_get_stacked_preview_url_for_cart_item( $cart_item ) : '',
		];
	}

	$json      = wp_json_encode( $design_map );
	$jsonLines = wp_json_encode( $cart_line_order );
	echo "<script id='cs-design-data'>
		window.csDesignMap = {$json};
		window.csDesignCartLines = {$jsonLines};

		(function(){
			function getDesignMatchByName(designs, productName){
				if(!productName) return null;
				for(var i=0;i<designs.length;i++){
					if(designs[i].name && productName.indexOf(designs[i].name)!==-1){
						return designs[i];
					}
					if(designs[i].name && designs[i].name.indexOf(productName)!==-1){
						return designs[i];
					}
				}
				return null;
			}

			function getDesignsInBlockOrder(){
				var fallback = Object.values(window.csDesignMap || {});
				try {
					if(!window.wp || !window.wp.data || !window.wc || !window.wc.wcBlocksData || !window.wc.wcBlocksData.cartStore) {
						return fallback;
					}

					var cartStore = window.wc.wcBlocksData.cartStore;
					var cartData = window.wp.data.select(cartStore).getCartData();
					if(!cartData || !Array.isArray(cartData.items)) {
						return fallback;
					}

					var byName = fallback.slice();
					return cartData.items.map(function(item){
						var itemName = item && item.name ? item.name : '';
						var matchIndex = byName.findIndex(function(design){
							return design.name && itemName && (itemName.indexOf(design.name)!==-1 || design.name.indexOf(itemName)!==-1);
						});
						if(matchIndex === -1) return null;
						return byName.splice(matchIndex, 1)[0];
					}).filter(Boolean);
				} catch (e) {
					return fallback;
				}
			}

			function appendViewDesignLink(target, designUrl, center, previewUrl){
				if(!target || !designUrl) return;
				var scope = target.parentNode || target;
				if(scope.querySelector('.cs-view-design-link')) return;

				var link = document.createElement('a');
				link.href = (previewUrl && String(previewUrl).length) ? previewUrl : designUrl;
				link.target = '_blank';
				link.rel = 'noopener';
				link.className = 'cs-view-design-link';
				link.innerHTML = 'View Design &nearr;';
				link.style.cssText = 'display:block;font-size:11px;margin-top:4px;color:#2563eb;text-decoration:none;' + (center ? 'text-align:center;' : '');
				scope.insertBefore(link, target.nextSibling);
			}

			function getProductIdFromElement(row){
				// First try our custom data attributes (most reliable)
				var productIdEl = row.querySelector('[data-cs-product-id]');
				if(productIdEl) {
					var pid = productIdEl.getAttribute('data-cs-product-id');
					var vid = productIdEl.getAttribute('data-cs-variation-id');
					return {
						productId: pid ? parseInt(pid, 10) : null,
						variationId: vid ? parseInt(vid, 10) : null
					};
				}
				
				// Try to extract product ID from standard data attributes
				var productId = row.getAttribute('data-product-id') || row.getAttribute('data-product_id');
				var variationId = row.getAttribute('data-variation-id') || row.getAttribute('data-variation_id');
				if(productId || variationId) {
					return {
						productId: productId ? parseInt(productId, 10) : null,
						variationId: variationId ? parseInt(variationId, 10) : null
					};
				}
				
				// Try to extract from link href (e.g., /product/name/?variation_id=123)
				var link = row.querySelector('a[href*=\'variation_id\'], a[href*=\'product\']');
				if(link && link.href){
					var match = link.href.match(/variation_id[=:](\d+)/i);
					if(match) {
						return {
							productId: null,
							variationId: parseInt(match[1], 10)
						};
					}
					match = link.href.match(/\/product\/[^\/]+\/(\d+)/);
					if(match) {
						return {
							productId: parseInt(match[1], 10),
							variationId: null
						};
					}
				}
				
				return { productId: null, variationId: null };
			}

			function findDesignMatch(designs, productId, variationId, productName){
				if(productId || variationId){
					// Try to match by ID first (most reliable)
					for(var i = 0; i < designs.length; i++){
						var d = designs[i];
						// Match variation first if both have variation IDs
						if(variationId && d.variation_id && d.variation_id === variationId){
							return d;
						}
						// Match product ID if variation IDs match (both 0 or both null)
						if(productId && d.product_id && d.product_id === productId){
							var dHasVariation = d.variation_id && d.variation_id !== 0;
							var hasVariation = variationId && variationId !== 0;
							if(!dHasVariation && !hasVariation){
								return d;
							}
						}
					}
				}
				// Fall back to name matching
				return getDesignMatchByName(designs, productName);
			}

			function injectBlockCartLinePreviews(){
				var lines = window.csDesignCartLines;
				if(!lines || !lines.length) return;
				var rows = document.querySelectorAll('.wc-block-cart-items__row');
				if(!rows.length) return;
				rows.forEach(function(row, index){
					if(row.querySelector('.cs-block-cart-design-preview')) return;
					var line = lines[index];
					if(!line || (!line.design_url && !(line.sides && line.sides.length))) return;
					var productCol = row.querySelector('.wc-block-cart-item__product, .wc-block-components-product-metadata, td.wc-block-cart-item__product');
					if(!productCol) productCol = row.querySelector('.wc-block-cart-item__wrap') || row;
					var wrap = document.createElement('div');
					wrap.className = 'cs-block-cart-design-preview';
					var lbl = document.createElement('p');
					lbl.className = 'cs-block-cart-design-label';
					lbl.textContent = 'Design: ✓ Custom design applied';
					var link = document.createElement('a');
					link.href = (line.stacked_preview_url && String(line.stacked_preview_url).length) ? line.stacked_preview_url : (line.design_url || '');
					link.target = '_blank';
					link.rel = 'noopener';
					link.className = 'cs-view-design-link';
					link.style.marginTop = '6px';
					link.textContent = 'View full size →';
					wrap.appendChild(lbl);
					function addStack(targetUrl, w, h, printArea){
						var stack = document.createElement('div');
						stack.className = 'cs-block-cart-composite';
						stack.style.cssText = 'position:relative;width:'+w+'px;height:'+h+'px;margin-top:4px;overflow:hidden;';
						if(line.product_thumb_url){
							var pimg = document.createElement('img');
							pimg.alt = '';
							pimg.setAttribute('src', line.product_thumb_url);
							pimg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:1;';
							stack.appendChild(pimg);
						}
						var dimg = document.createElement('img');
						dimg.alt = '';
						dimg.setAttribute('src', targetUrl);
						if(printArea && line.product_thumb_url){
							dimg.style.cssText = 'position:absolute;object-fit:contain;z-index:2;pointer-events:none;';
							dimg.setAttribute('data-pa-x', printArea.x);
							dimg.setAttribute('data-pa-y', printArea.y);
							dimg.setAttribute('data-pa-w', printArea.width);
							dimg.setAttribute('data-pa-h', printArea.height);
							dimg.className = 'cs-design-needs-pa';
							var pimgRef = stack.querySelector('img');
							if(pimgRef){
								function applyPA(){
									var nw=pimgRef.naturalWidth||w,nh=pimgRef.naturalHeight||h;
									var s=Math.min(w/nw,h/nh);
									var rw=nw*s,rh=nh*s;
									var offX=(w-rw)/2,offY=(h-rh)/2;
									dimg.style.left=(offX+(printArea.x/100)*rw)+'px';
									dimg.style.top=(offY+(printArea.y/100)*rh)+'px';
									dimg.style.width=((printArea.width/100)*rw)+'px';
									dimg.style.height=((printArea.height/100)*rh)+'px';
								}
								if(pimgRef.complete&&pimgRef.naturalWidth)applyPA();
								else pimgRef.addEventListener('load',applyPA);
								setTimeout(applyPA,200);
							}
						} else {
							dimg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2;pointer-events:none;';
						}
						stack.appendChild(dimg);
						return stack;
					}
					if(line.sides && line.sides.length > 1){
						var grid = document.createElement('div');
						grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin-top:4px;';
						line.sides.forEach(function(side){
							var cell = document.createElement('div');
							cell.style.textAlign = 'center';
							var u = side.url || '';
							if(!u) return;
							cell.appendChild(addStack(u, 88, 88, side.print_area || null));
							var vn = document.createElement('span');
							vn.style.cssText = 'font-size:10px;color:#6b7280;text-transform:capitalize;display:block;margin-top:4px;';
							vn.textContent = side.view || '';
							cell.appendChild(vn);
							grid.appendChild(cell);
						});
						wrap.appendChild(grid);
					} else if(line.product_thumb_url){
						var primarySide = (line.sides && line.sides.length) ? line.sides[0] : null;
						wrap.appendChild(addStack(line.design_url, 120, 120, primarySide && primarySide.print_area ? primarySide.print_area : null));
					} else {
						var img = document.createElement('img');
						img.alt = '';
						img.setAttribute('src', line.design_url);
						img.style.maxWidth = '120px';
						img.style.maxHeight = '120px';
						img.style.display = 'block';
						img.style.borderRadius = '4px';
						wrap.appendChild(img);
					}
					wrap.appendChild(link);
					productCol.appendChild(wrap);
				});
			}

			function stackProductImageBehindDesign(container){
				if(!container) return;
				var baseImg = container.querySelector('img:not(.cs-design-overlay)');
				if(!baseImg) return;
				var link = baseImg.closest('a');
				container.style.position = 'relative';
				if(link){
					link.style.cssText += ';position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;';
					baseImg.style.cssText += ';max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain;';
				} else {
					baseImg.style.cssText += ';position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:contain;';
				}
			}

			function ensureProductBaseImage(container, match){
				if(!match || !match.product_thumb_url) return;
				if(container.querySelector('img.cs-product-base-js')) return;
				if(container.querySelector('img:not(.cs-design-overlay)')) return;
				var base = document.createElement('img');
				base.className = 'cs-product-base-js';
				base.alt = '';
				base.setAttribute('src', match.product_thumb_url);
				base.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:1;';
				container.insertBefore(base, container.firstChild);
			}

			function blockRowIndex(row){
				var all = document.querySelectorAll('.wc-block-cart-items__row');
				for(var i = 0; i < all.length; i++){
					if(all[i] === row) return i;
				}
				return -1;
			}

			function applyDesignOverlays(){
				if(!window.csDesignMap) return;
				var fallbackDesigns = Object.values(window.csDesignMap);
				if(!fallbackDesigns.length) return;

				injectBlockCartLinePreviews();

				var orderedDesigns = getDesignsInBlockOrder();
				// Cart / checkout blocks — multiple possible wrappers across WC + theme versions.
				var thumbContainers = document.querySelectorAll(
					'.wc-block-cart-items .wc-block-components-product-image,' +
					'.wc-block-cart-items .wc-block-cart-item__image,' +
					'.wc-block-cart .wc-block-components-product-image,' +
					'.wc-block-checkout .wc-block-components-product-image,' +
					'.wc-block-components-order-summary .wc-block-components-product-image'
				);

				thumbContainers.forEach(function(container, index){
					if(container.querySelector('.cs-design-overlay')) return;

					var row = container.closest('.wc-block-cart-items__row, .wc-block-components-order-summary-item, tr, li');
					if(!row) return;

					var match = null;
					if(window.csDesignCartLines && window.csDesignCartLines.length && row.classList.contains('wc-block-cart-items__row')){
						var ri = blockRowIndex(row);
						var lineRow = ri >= 0 ? window.csDesignCartLines[ri] : null;
						if(lineRow && (lineRow.design_url || (lineRow.sides && lineRow.sides.length))){
							match = {
								design_url: lineRow.design_url,
								sides: lineRow.sides || [],
								product_id: lineRow.product_id,
								variation_id: lineRow.variation_id,
								name: lineRow.name,
								stacked_preview_url: lineRow.stacked_preview_url || ''
							};
						}
					}
					
					var ids = getProductIdFromElement(row);
					var productId = ids.productId;
					var variationId = ids.variationId;
					
					var nameEl = row.querySelector(
						'.wc-block-components-product-name,' +
						'.wc-block-components-order-summary-item__description .wc-block-components-product-name,' +
						'a[href]'
					);
					var productName = nameEl ? nameEl.textContent.trim() : '';
					
					if(!match){
						match = orderedDesigns[index] || findDesignMatch(fallbackDesigns, productId, variationId, productName);
					}
					if(!match) return;

					ensureProductBaseImage(container, match);
					stackProductImageBehindDesign(container);

					container.style.position = 'relative';
					var overlay = document.createElement('img');
					overlay.src = match.design_url;
					overlay.alt = '';
					overlay.className = 'cs-design-overlay';
					overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;z-index:3;';
					container.appendChild(overlay);
					appendViewDesignLink(container, match.design_url, true, match.stacked_preview_url);
				});

				var classicRows = document.querySelectorAll(
					'.woocommerce-cart-form .cart_item,' +
					'table.shop_table.cart .cart_item,' +
					'.woocommerce-cart table.shop_table .cart_item,' +
					'.woocommerce-checkout .cart_item'
				);
				classicRows.forEach(function(row){
					var thumbTd = row.querySelector('.product-thumbnail');
					if(!thumbTd || thumbTd.querySelector('.cs-design-overlay')) return;

					var ids = getProductIdFromElement(row);
					var productId = ids.productId;
					var variationId = ids.variationId;
					
					// Fallback: try to get variation ID from hidden input
					if(!variationId) {
						var variationInput = row.querySelector('input[name*=\'variation_id\'], input[value*=\'variation\']');
						if(variationInput) {
							var val = parseInt(variationInput.value, 10);
							if(!isNaN(val)) variationId = val;
						}
					}
					
					var nameLink = row.querySelector('.product-name a');
					var productName = nameLink ? nameLink.textContent.trim() : '';
					var match = findDesignMatch(fallbackDesigns, productId, variationId, productName);
					if(!match) return;

					var imgWrap = thumbTd.querySelector('a') || thumbTd;
					imgWrap.style.position = 'relative';
					imgWrap.style.display = 'inline-block';
					ensureProductBaseImage(imgWrap, match);
					stackProductImageBehindDesign(imgWrap);
					var overlay = document.createElement('img');
					overlay.src = match.design_url;
					overlay.alt = '';
					overlay.className = 'cs-design-overlay';
					overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;z-index:3;';
					imgWrap.appendChild(overlay);
					appendViewDesignLink(imgWrap, match.design_url, false, match.stacked_preview_url);
				});
			}

			if(document.readyState==='loading'){
				document.addEventListener('DOMContentLoaded', applyDesignOverlays);
			} else {
				applyDesignOverlays();
			}

			var observer = new MutationObserver(function(){
				applyDesignOverlays();
			});
			observer.observe(document.body, { childList:true, subtree:true });

			document.addEventListener('updated_wc_div', applyDesignOverlays);
			if(typeof jQuery !== 'undefined'){
				jQuery(document.body).on('updated_cart_totals updated_checkout wc_fragments_refreshed', applyDesignOverlays);
			}
		})();
	</script>";
} );

// Show "Customized" label in cart item details (+ inline preview when we have image data)
add_filter( 'woocommerce_get_item_data', function ( $item_data, $cart_item ) {
	$design_url = cs_get_cart_item_design_url( $cart_item );
	$sides      = cs_get_cart_item_sides( $cart_item );
	if ( ! empty( $design_url ) || ! empty( $sides ) || ! empty( $cart_item['customizer_session_id'] ) ) {
		$value = '✓ Custom design applied';
		if ( ! empty( $design_url ) || ! empty( $sides ) ) {
			$preview_href = cs_get_stacked_preview_url_for_cart_item( $cart_item );
			$pthumb       = cs_get_cart_item_product_thumb_url( $cart_item );
			if ( count( $sides ) > 1 ) {
				$value .= '<br/><div class="cs-item-data-sides" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;">';
				foreach ( $sides as $side ) {
					$u = isset( $side['url'] ) ? cs_esc_design_attr( $side['url'] ) : '';
					$v = isset( $side['view'] ) ? esc_html( (string) $side['view'] ) : '';
					if ( $u === '' ) {
						continue;
					}
					$value .= '<div style="text-align:center;">';
					$value .= '<span style="position:relative;display:inline-block;width:100px;height:100px;border-radius:6px;overflow:hidden;border:1px solid #e5e7eb;background:#f3f4f6;">';
					if ( $pthumb ) {
						$value .= '<img src="' . $pthumb . '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:1;" />';
					}
					$value .= '<img src="' . $u . '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2;pointer-events:none;" />';
					$value .= '</span>';
					if ( $v !== '' ) {
						$value .= '<span style="font-size:11px;color:#6b7280;text-transform:capitalize;display:block;margin-top:4px;">' . $v . '</span>';
					}
					$value .= '</div>';
				}
				$value .= '</div>';
			} elseif ( ! empty( $design_url ) ) {
				$src = cs_esc_design_attr( $design_url );
				if ( $pthumb ) {
					$value .= '<br/><span class="cs-item-data-composite" style="position:relative;display:inline-block;width:120px;height:120px;margin-top:8px;border-radius:6px;overflow:hidden;border:1px solid #e5e7eb;background:#f3f4f6;">';
					$value .= '<img src="' . $pthumb . '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:1;" />';
					$value .= '<img src="' . $src . '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2;pointer-events:none;" />';
					$value .= '</span>';
				} else {
					$value .= '<br/><img src="' . $src . '" alt="" style="max-width:120px;max-height:120px;margin-top:8px;border-radius:6px;border:1px solid #e5e7eb;display:block;" />';
				}
			}
			$value .= ' <a href="' . esc_attr( $preview_href ) . '" target="_blank" rel="noopener" style="margin-left:0;margin-top:6px;display:inline-block;color:#2563eb;">View full size →</a>';
		} elseif ( ! empty( $cart_item['customizer_session_id'] ) ) {
			$value .= '<br/><small style="color:#666;">Preview unavailable (no image URL in cart). Re-add the product after updating the plugin, or ensure your customizer posts <code>customizer_design_url</code> / <code>customizer_sides</code> as an HTTPS link or PNG data URL.</small>';
		}
		$item_data[] = [
			'key'   => 'Design',
			'value' => $value,
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
	if ( isset( $values['customizer_sides'] ) ) {
		$cart_item['customizer_sides'] = $values['customizer_sides'];
	}
	if ( isset( $values['_cs_design_transient_key'] ) ) {
		$cart_item['_cs_design_transient_key'] = $values['_cs_design_transient_key'];
		// Hydrate from transient if inline URL was offloaded.
		if ( empty( $cart_item['customizer_design_url'] ) && $cart_item['_cs_design_transient_key'] ) {
			$stored = get_transient( $cart_item['_cs_design_transient_key'] );
			if ( is_string( $stored ) && $stored !== '' ) {
				$cart_item['customizer_design_url'] = $stored;
			}
		}
	}
	if ( isset( $values['_cs_sides_transient_key'] ) ) {
		$cart_item['_cs_sides_transient_key'] = $values['_cs_sides_transient_key'];
		if ( empty( $cart_item['customizer_sides'] ) && $cart_item['_cs_sides_transient_key'] ) {
			$stored = get_transient( $cart_item['_cs_sides_transient_key'] );
			if ( is_string( $stored ) && $stored !== '' ) {
				$cart_item['customizer_sides'] = $stored;
			}
		}
	}
	return $cart_item;
}, 10, 2 );

/* ================================================================
   6. ORDER INTEGRATION — Save design data to order line items
   ================================================================ */

add_filter(
	'woocommerce_hidden_order_itemmeta',
	function ( $keys ) {
		$keys[] = '_customizer_sides_json';
		return $keys;
	}
);

add_action( 'woocommerce_checkout_create_order_line_item', function ( $item, $cart_item_key, $values, $order ) {
	if ( ! empty( $values['customizer_session_id'] ) ) {
		$item->add_meta_data( '_customizer_session_id', $values['customizer_session_id'], true );
	}
	// Resolve design URL (includes transient-stored previews).
	$design_url = '';
	if ( function_exists( 'cs_get_cart_item_design_url' ) ) {
		$cart = WC()->cart ? WC()->cart->get_cart() : [];
		if ( isset( $cart[ $cart_item_key ] ) ) {
			$design_url = cs_get_cart_item_design_url( $cart[ $cart_item_key ] );
		}
	}
	if ( $design_url === '' && ! empty( $values['customizer_design_url'] ) ) {
		$design_url = $values['customizer_design_url'];
	}
	if ( $design_url !== '' ) {
		$item->add_meta_data( '_customizer_design_url', $design_url, true );
	}
	$sides = [];
	if ( function_exists( 'cs_get_cart_item_sides' ) ) {
		$cart = WC()->cart ? WC()->cart->get_cart() : [];
		if ( isset( $cart[ $cart_item_key ] ) ) {
			$sides = cs_get_cart_item_sides( $cart[ $cart_item_key ] );
		}
	}
	if ( ! empty( $sides ) ) {
		$item->add_meta_data( '_customizer_sides_json', wp_json_encode( $sides ), true );
	}
}, 10, 4 );

// Display design preview in admin order view
add_action( 'woocommerce_after_order_itemmeta', function ( $item_id, $item, $product ) {
	$session_id  = $item->get_meta( '_customizer_session_id' );
	$design_url  = $item->get_meta( '_customizer_design_url' );
	$sides_json  = $item->get_meta( '_customizer_sides_json' );
	$sides       = [];
	if ( is_string( $sides_json ) && $sides_json !== '' ) {
		$decoded = json_decode( $sides_json, true );
		if ( is_array( $decoded ) ) {
			$sides = cs_sanitize_customizer_sides_array( $decoded );
		}
	}

	if ( $session_id || $design_url || ! empty( $sides ) ) {
		echo '<div class="cs-order-meta" style="margin-top:8px;padding:8px;background:#f8f9fa;border-radius:6px;font-size:12px;">';
		echo '<strong>🎨 Customizer Studio</strong><br/>';
		if ( $session_id ) {
			echo 'Session: <code>' . esc_html( $session_id ) . '</code><br/>';
		}
		if ( count( $sides ) > 1 ) {
			$preview_href = cs_get_stacked_preview_url_for_order_item( $item );
			echo '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:6px;">';
			foreach ( $sides as $side ) {
				$u = isset( $side['url'] ) ? $side['url'] : '';
				$v = isset( $side['view'] ) ? (string) $side['view'] : '';
				if ( $u === '' ) {
					continue;
				}
				echo '<div style="text-align:center;">';
				echo '<a href="' . esc_attr( $preview_href ) . '" target="_blank" rel="noopener">';
				echo '<img src="' . cs_esc_design_attr( $u ) . '" alt="" style="max-width:88px;margin-top:4px;border-radius:4px;border:1px solid #ddd;display:block;" />';
				echo '</a>';
				if ( $v !== '' ) {
					echo '<span style="font-size:10px;color:#666;text-transform:capitalize;">' . esc_html( $v ) . '</span>';
				}
				echo '</div>';
			}
			echo '</div>';
		} elseif ( $design_url ) {
			$preview_href = cs_get_stacked_preview_url_for_order_item( $item );
			echo '<a href="' . esc_attr( $preview_href ) . '" target="_blank" rel="noopener">';
			echo '<img src="' . cs_esc_design_attr( $design_url ) . '" alt="Custom Design" style="max-width:120px;margin-top:4px;border-radius:4px;border:1px solid #ddd;" />';
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
			// Footer script uses AJAX (cs_add_to_cart). Do NOT also POST the form — duplicate requests
			// and huge hidden fields (data:image) can exceed PHP limits and leave the cart empty.
			if (typeof csVariantConfig !== 'undefined') {
				return;
			}

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

				// Multi-side JSON + primary design URL (backward compatible)
				var sides = detail.sides || [];
				var sidePayload = sides.map(function(s) {
					return { view: (s.view || 'front'), url: (s.designPNG || s.url || '') };
				}).filter(function(x) { return x.url; });
				var sidesInput = form.querySelector('input[name="customizer_sides"]');
				if (sidePayload.length) {
					if (!sidesInput) {
						sidesInput = document.createElement('input');
						sidesInput.type = 'hidden';
						sidesInput.name = 'customizer_sides';
						form.appendChild(sidesInput);
					}
					sidesInput.value = JSON.stringify(sidePayload);
				}
				var front = sidePayload.find(function(s) { return s.view === 'front'; }) || sidePayload[0];
				if (front && front.url) {
					var designInput = form.querySelector('input[name="customizer_design_url"]');
					if (!designInput) {
						designInput = document.createElement('input');
						designInput.type = 'hidden';
						designInput.name = 'customizer_design_url';
						designInput.value = front.url;
						form.appendChild(designInput);
					} else {
						designInput.value = front.url;
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
	if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['security'] ?? '' ) ), 'cs_add_to_cart' ) ) {
		wp_send_json_error(
			[
				'message' => __( 'Session expired or security check failed. Refresh the page and try again.', 'customizer-studio-for-woocommerce' ),
			]
		);
		return;
	}

	$result = cs_process_add_to_cart( wp_unslash( $_POST ) );
	if ( is_wp_error( $result ) ) {
		wp_send_json_error( [ 'message' => $result->get_error_message() ] );
		return;
	}

	wp_send_json( cs_get_cart_fragments_data() );
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
		// Map every variation attribute slug => variation_id (not only color — avoids empty cart when attribute isn't "color").
		foreach ( $v['attributes'] as $attr_name => $attr_value ) {
			if ( $attr_value === '' || $attr_value === null ) {
				continue;
			}
			$key = strtolower( rawurldecode( (string) $attr_value ) );
			$variant_map[ $key ] = (int) $v['variation_id'];
		}
	}

	$fallback_variation_id = 0;
	if ( count( $variations ) === 1 ) {
		$fallback_variation_id = (int) $variations[0]['variation_id'];
	}

	?>
	<script>
	var csVariantConfig = {
		ajaxUrl: '<?php echo esc_url( admin_url( 'admin-ajax.php' ) ); ?>',
		ajaxNonce: '<?php echo esc_js( wp_create_nonce( 'cs_add_to_cart' ) ); ?>',
		restNonce: '<?php echo esc_js( wp_create_nonce( 'wp_rest' ) ); ?>',
		restAddToCartUrl: '<?php echo esc_url( rest_url( 'customizer-studio/v1/add-to-cart' ) ); ?>',
		productId: <?php echo (int) $product->get_id(); ?>,
		variantMap: <?php echo wp_json_encode( $variant_map ); ?>,
		fallbackVariationId: <?php echo (int) $fallback_variation_id; ?>
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

			var variationId = parseInt(detail.variationId || detail.variation_id || (variant && variant.variationId) || (variant && variant.variation_id), 10) || 0;
			if (!variationId && colorName) {
				variationId = csVariantConfig.variantMap[colorName] || 0;
			}
			if (!variationId && variant) {
				for (var vk in variant) {
					if (variationId) break;
					var vv = variant[vk];
					if (typeof vv === 'string' && vv !== '') {
						var k = vv.toLowerCase().trim();
						if (k && csVariantConfig.variantMap[k]) {
							variationId = csVariantConfig.variantMap[k];
						}
					}
				}
			}
			if (!variationId && csVariantConfig.fallbackVariationId) {
				variationId = csVariantConfig.fallbackVariationId;
			}

			if (!variationId) {
				console.error('[CS Plugin] Could not resolve variation. Send variationId in the event, or a variant.* value matching the product attribute slug. detail:', detail, 'map:', csVariantConfig.variantMap);
				return;
			}

			var sides = detail.sides || [];
			var sidePayload = sides.map(function(s) {
				return { view: (s.view || 'front'), url: (s.designPNG || s.url || '') };
			}).filter(function(x) { return x.url; });
			var front = sidePayload.find(function(s) { return s.view === 'front'; }) || sidePayload[0];
			var designUrl = front ? front.url : '';

			var formData = new FormData();
			formData.append('action', 'cs_add_to_cart');
			formData.append('security', csVariantConfig.ajaxNonce);
			formData.append('product_id', csVariantConfig.productId);
			formData.append('variation_id', variationId);
			formData.append('quantity', '1');
			if (detail.sessionId) formData.append('customizer_session_id', detail.sessionId);
			if (sidePayload.length) {
				formData.append('customizer_sides', JSON.stringify(sidePayload));
			}
			if (designUrl) formData.append('customizer_design_url', designUrl);

			function formDataToObject(fd) {
				var o = {};
				fd.forEach(function(v, k) { o[k] = v; });
				return o;
			}

			function handleCartResponse(res) {
				var ct = res.headers.get('content-type') || '';
				if (!res.ok) {
					return res.text().then(function(text) {
						var plain = (text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
						throw new Error('HTTP ' + res.status + (plain ? ': ' + plain : ''));
					});
				}
				if (ct.indexOf('application/json') === -1) {
					return res.text().then(function(text) {
						throw new Error('Expected JSON but received HTML (firewall/WAF may be blocking the request). ' + (text || '').slice(0, 120));
					});
				}
				return res.json();
			}

			function applyFragments(data) {
				if (data && data.code && data.message) {
					console.error('[CS Plugin] Add to cart failed:', data.message);
					return;
				}
				if (data.success === false || data.error) {
					console.error('[CS Plugin] Add to cart failed:', data);
					return;
				}
				var fragments = data.fragments || (data.data && data.data.fragments);
				var cartHash = data.cart_hash || (data.data && data.data.cart_hash);
				if (typeof jQuery !== 'undefined' && fragments) {
					jQuery(document.body).trigger('added_to_cart', [fragments, cartHash]);
				}
			}

			var restUrl = csVariantConfig.restAddToCartUrl;
			var restNonce = csVariantConfig.restNonce;
			var ajaxUrl = csVariantConfig.ajaxUrl;

			var restAttempt = (restUrl && restNonce)
				? fetch(restUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': restNonce,
						'X-Requested-With': 'XMLHttpRequest'
					},
					credentials: 'same-origin',
					body: JSON.stringify(formDataToObject(formData))
				}).then(handleCartResponse).then(applyFragments)
				: Promise.reject(new Error('no REST'));

			restAttempt.catch(function(err) {
				console.warn('[CS Plugin] REST add-to-cart failed, falling back to admin-ajax.php:', err && err.message ? err.message : err);
				return fetch(ajaxUrl, {
					method: 'POST',
					body: formData,
					credentials: 'same-origin',
					headers: { 'X-Requested-With': 'XMLHttpRequest' }
				}).then(handleCartResponse).then(applyFragments);
			}).catch(function(err) {
				console.error('[CS Plugin] Add to cart error:', err && err.message ? err.message : err);
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
	$sides_json = $item->get_meta( '_customizer_sides_json' );
	$sides      = [];
	if ( is_string( $sides_json ) && $sides_json !== '' ) {
		$decoded = json_decode( $sides_json, true );
		if ( is_array( $decoded ) ) {
			$sides = cs_sanitize_customizer_sides_array( $decoded );
		}
	}
	if ( ! $design_url && empty( $sides ) ) {
		return;
	}

	$preview_href = cs_get_stacked_preview_url_for_order_item( $item );

	if ( $plain_text ) {
		if ( count( $sides ) > 1 ) {
			echo "\nCustom Design: multiple sides (see HTML email)\n";
		} elseif ( $design_url ) {
			if ( preg_match( '#^data:image/#i', $design_url ) ) {
				echo "\nCustom Design: (see HTML email for image)\n";
			} else {
				echo "\nCustom Design: " . esc_url( $design_url ) . "\n";
			}
		}
		if ( $preview_href && strpos( $preview_href, 'http' ) === 0 ) {
			echo 'Full preview (product + design): ' . esc_url( $preview_href ) . "\n";
		}
	} else {
		echo '<br/><small style="color:#666;">Custom Design:</small><br/>';
		if ( count( $sides ) > 1 ) {
			echo '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;">';
			foreach ( $sides as $side ) {
				$u = isset( $side['url'] ) ? $side['url'] : '';
				$v = isset( $side['view'] ) ? (string) $side['view'] : '';
				if ( $u === '' ) {
					continue;
				}
				echo '<span style="display:inline-block;text-align:center;">';
				echo '<img src="' . cs_esc_design_attr( $u ) . '" alt="" style="max-width:72px;border-radius:4px;margin-top:4px;display:block;border:1px solid #ddd;" />';
				if ( $v !== '' ) {
					echo '<span style="font-size:10px;color:#666;text-transform:capitalize;">' . esc_html( $v ) . '</span>';
				}
				echo '</span>';
			}
			echo '</div>';
		} elseif ( $design_url ) {
			echo '<img src="' . cs_esc_design_attr( $design_url ) . '" alt="Custom Design" style="max-width:100px;border-radius:4px;margin-top:4px;" />';
		}
		if ( $preview_href ) {
			echo '<br/><a href="' . esc_attr( $preview_href ) . '" target="_blank" rel="noopener" style="font-size:12px;">View product + design (full preview)</a>';
		}
	}
}, 10, 4 );
