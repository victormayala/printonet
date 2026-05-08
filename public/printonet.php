<?php
/**
 * Plugin Name: Printonet
 * Plugin URI:  https://app.printonet.com
 * Description: Receives store branding (name, color, font, logo, favicon) from the Printonet dashboard and applies it to this WordPress site. Exposes /wp-json/printonet/v1/health and /wp-json/printonet/v1/branding.
 * Version:     1.5.0
 * Author:      Printonet
 * Author URI:  https://app.printonet.com
 * License:     GPL-2.0-or-later
 * Text Domain: printonet
 *
 * Authentication for the /branding endpoint uses a shared secret. Define it
 * in wp-config.php (above "That's all, stop editing!"):
 *
 *     define('PRINTONET_BRANDING_TOKEN', 'your-long-random-string');
 *
 * The same string must be configured in the Printonet dashboard backend
 * (Lovable Cloud secret named PRINTONET_BRANDING_TOKEN).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'PRINTONET_PLUGIN_VERSION', '1.5.0' );
define( 'PRINTONET_BRANDING_OPTION', 'printonet_branding' );
define( 'PRINTONET_ASSET_IDS_OPTION', 'printonet_branding_asset_ids' );

/* -------------------------------------------------------------------------
 * Auth helpers
 * ------------------------------------------------------------------------- */

function printonet_token_is_valid( $provided ) {
	if ( ! defined( 'PRINTONET_BRANDING_TOKEN' ) ) {
		return false;
	}
	$expected = (string) PRINTONET_BRANDING_TOKEN;
	if ( '' === $expected || ! is_string( $provided ) || '' === $provided ) {
		return false;
	}
	return hash_equals( $expected, $provided );
}

/* -------------------------------------------------------------------------
 * Sanitization
 * ------------------------------------------------------------------------- */

function printonet_sanitize_field( $value, $kind ) {
	if ( null === $value ) {
		return '';
	}
	if ( ! is_string( $value ) ) {
		$value = (string) $value;
	}
	$value = trim( wp_unslash( $value ) );
	if ( '' === $value ) {
		return '';
	}
	switch ( $kind ) {
		case 'email':
			$v = sanitize_email( $value );
			return false !== $v ? $v : '';
		case 'url':
			return esc_url_raw( $value );
		case 'hex':
			return preg_match( '/^#[0-9a-fA-F]{6}$/', $value ) ? strtolower( $value ) : '';
		case 'font':
			return preg_match( '/^[A-Za-z0-9 \-]{1,64}$/', $value ) ? $value : '';
		case 'text':
		default:
			return sanitize_text_field( $value );
	}
}

/* -------------------------------------------------------------------------
 * Asset sideloading — pulls remote logo/favicon URLs into the media library
 * so WordPress can use them as custom_logo / site_icon. Returns the
 * attachment ID, or 0 on failure.
 * ------------------------------------------------------------------------- */

function printonet_sideload_to_media( $url ) {
	if ( empty( $url ) ) {
		return 0;
	}
	if ( ! function_exists( 'media_sideload_image' ) ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';
	}

	$tmp = download_url( $url, 30 );
	if ( is_wp_error( $tmp ) ) {
		return 0;
	}

	// Determine a reasonable filename + extension.
	$path     = wp_parse_url( $url, PHP_URL_PATH );
	$basename = $path ? basename( $path ) : 'printonet-asset';
	if ( false === strpos( $basename, '.' ) ) {
		$basename .= '.png';
	}

	$file_array = [
		'name'     => sanitize_file_name( $basename ),
		'tmp_name' => $tmp,
	];

	$attachment_id = media_handle_sideload( $file_array, 0 );

	if ( is_wp_error( $attachment_id ) ) {
		@unlink( $tmp );
		return 0;
	}
	return (int) $attachment_id;
}

/**
 * Apply a logo / favicon URL to WordPress. If we previously sideloaded an
 * asset for the same "kind" (logo|favicon) at the same URL, reuse it; else
 * sideload fresh and remove the old one.
 */
function printonet_apply_asset( $kind, $url ) {
	$ids       = get_option( PRINTONET_ASSET_IDS_OPTION, [] );
	$prev_id   = isset( $ids[ $kind ]['id'] ) ? (int) $ids[ $kind ]['id'] : 0;
	$prev_url  = isset( $ids[ $kind ]['url'] ) ? (string) $ids[ $kind ]['url'] : '';

	// Clearing the asset.
	if ( '' === $url ) {
		if ( $prev_id ) {
			wp_delete_attachment( $prev_id, true );
		}
		unset( $ids[ $kind ] );
		update_option( PRINTONET_ASSET_IDS_OPTION, $ids, false );
		if ( 'logo' === $kind ) {
			remove_theme_mod( 'custom_logo' );
		} elseif ( 'favicon' === $kind ) {
			delete_option( 'site_icon' );
		}
		return 0;
	}

	// Already up to date.
	if ( $prev_id && $prev_url === $url && get_post( $prev_id ) ) {
		if ( 'logo' === $kind ) {
			set_theme_mod( 'custom_logo', $prev_id );
		} elseif ( 'favicon' === $kind ) {
			update_option( 'site_icon', $prev_id );
		}
		return $prev_id;
	}

	// Sideload fresh.
	$new_id = printonet_sideload_to_media( $url );
	if ( ! $new_id ) {
		return 0;
	}

	if ( $prev_id ) {
		wp_delete_attachment( $prev_id, true );
	}

	$ids[ $kind ] = [ 'id' => $new_id, 'url' => $url ];
	update_option( PRINTONET_ASSET_IDS_OPTION, $ids, false );

	if ( 'logo' === $kind ) {
		set_theme_mod( 'custom_logo', $new_id );
		// Most themes look at this for header logo display.
		add_theme_support( 'custom-logo' );
	} elseif ( 'favicon' === $kind ) {
		update_option( 'site_icon', $new_id );
	}

	return $new_id;
}

/* -------------------------------------------------------------------------
 * REST routes
 * ------------------------------------------------------------------------- */

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'printonet/v1',
			'/health',
			[
				'methods'             => 'GET',
				'permission_callback' => '__return_true',
				'callback'            => function () {
					return new WP_REST_Response(
						[
							'ok'              => true,
							'plugin'          => 'printonet',
							'version'         => PRINTONET_PLUGIN_VERSION,
							'token_configured' => defined( 'PRINTONET_BRANDING_TOKEN' ) && '' !== (string) PRINTONET_BRANDING_TOKEN,
						],
						200
					);
				},
			]
		);

		register_rest_route(
			'printonet/v1',
			'/customizer-flags',
			[
				'methods'             => 'POST',
				'permission_callback' => function ( WP_REST_Request $request ) {
					$token = (string) $request->get_header( 'x_printonet_token' );
					if ( '' === $token ) {
						$token = (string) $request->get_header( 'X-Printonet-Token' );
					}
					if ( ! printonet_token_is_valid( $token ) ) {
						return new WP_Error( 'printonet_unauthorized', 'Invalid token', [ 'status' => 401 ] );
					}
					return true;
				},
				'callback'            => function ( WP_REST_Request $request ) {
					$body = $request->get_json_params();
					$items = is_array( $body ) && isset( $body['items'] ) && is_array( $body['items'] ) ? $body['items'] : [];
					$updated = 0;
					$missing = [];
					foreach ( $items as $it ) {
						$sku  = isset( $it['sku'] ) ? sanitize_text_field( $it['sku'] ) : '';
						$url  = isset( $it['customizer_url'] ) ? esc_url_raw( $it['customizer_url'] ) : '';
						$name = isset( $it['name'] ) ? sanitize_text_field( $it['name'] ) : '';
						if ( '' === $sku || '' === $url ) { continue; }
						$product_id = function_exists( 'wc_get_product_id_by_sku' ) ? (int) wc_get_product_id_by_sku( $sku ) : 0;
						if ( ! $product_id ) {
							// Fallback: lookup posts by _sku meta directly.
							$q = get_posts( [
								'post_type'      => [ 'product', 'product_variation' ],
								'meta_key'       => '_sku',
								'meta_value'     => $sku,
								'posts_per_page' => 1,
								'fields'         => 'ids',
								'post_status'    => 'any',
							] );
							$product_id = ! empty( $q ) ? (int) $q[0] : 0;
						}
						if ( ! $product_id ) { $missing[] = $sku; continue; }
						update_post_meta( $product_id, '_cs_enabled', '1' );
						update_post_meta( $product_id, '_cs_product_id', $sku );
						update_post_meta( $product_id, '_cs_customizer_url', $url );
						if ( '' !== $name ) {
							update_post_meta( $product_id, '_cs_product_name', $name );
						}
						$updated++;
					}
					return new WP_REST_Response( [ 'ok' => true, 'updated' => $updated, 'missing' => $missing ], 200 );
				},
			]
		);

		register_rest_route(
			'printonet/v1',
			'/branding',
			[
				'methods'             => 'POST',
				'permission_callback' => function ( WP_REST_Request $request ) {
					$token = (string) $request->get_header( 'x_printonet_token' );
					if ( '' === $token ) {
						$token = (string) $request->get_header( 'X-Printonet-Token' );
					}
					if ( ! printonet_token_is_valid( $token ) ) {
						return new WP_Error(
							'printonet_unauthorized',
							'Invalid or missing X-Printonet-Token',
							[ 'status' => 401 ]
						);
					}
					return true;
				},
				'callback'            => function ( WP_REST_Request $request ) {
					$body = $request->get_json_params();
					if ( ! is_array( $body ) ) {
						return new WP_Error(
							'printonet_bad_payload',
							'Expected JSON object',
							[ 'status' => 400 ]
						);
					}

					$clean = [
						'store_name'         => printonet_sanitize_field( $body['store_name'] ?? null, 'text' ),
						'contact_email'      => printonet_sanitize_field( $body['contact_email'] ?? null, 'email' ),
						'custom_domain'      => printonet_sanitize_field( $body['custom_domain'] ?? null, 'text' ),
						'primary_color'      => printonet_sanitize_field( $body['primary_color'] ?? null, 'hex' ),
						'font_family'        => printonet_sanitize_field( $body['font_family'] ?? null, 'font' ),
						'logo_url'           => printonet_sanitize_field( $body['logo_url'] ?? null, 'url' ),
						'favicon_url'        => printonet_sanitize_field( $body['favicon_url'] ?? null, 'url' ),
						'updated_at'         => gmdate( 'c' ),
					];

					update_option( PRINTONET_BRANDING_OPTION, $clean, true );

					if ( ! empty( $clean['store_name'] ) ) {
						update_option( 'blogname', $clean['store_name'] );
					}
					if ( ! empty( $clean['contact_email'] ) ) {
						update_option( 'admin_email', $clean['contact_email'] );
					}

					// Sideload + apply logo and favicon as native WP assets.
					$logo_id    = printonet_apply_asset( 'logo', $clean['logo_url'] );
					$favicon_id = printonet_apply_asset( 'favicon', $clean['favicon_url'] );

					return new WP_REST_Response(
						[
							'ok'         => true,
							'stored'     => $clean,
							'logo_id'    => $logo_id,
							'favicon_id' => $favicon_id,
						],
						200
					);
				},
			]
		);
	}
);

/* -------------------------------------------------------------------------
 * Front-end: inject branding into <head>
 *
 * We override common theme color/typography selectors so the brand colors
 * are visible on default themes (Twenty Twenty-Four, Storefront, Astra, etc.)
 * without requiring theme customization.
 * ------------------------------------------------------------------------- */

add_action(
	'wp_head',
	function () {
		$branding = get_option( PRINTONET_BRANDING_OPTION );
		if ( ! is_array( $branding ) || empty( $branding ) ) {
			return;
		}

		$primary = isset( $branding['primary_color'] ) ? $branding['primary_color'] : '';
		$font    = isset( $branding['font_family'] ) ? $branding['font_family'] : '';
		$favicon = isset( $branding['favicon_url'] ) ? $branding['favicon_url'] : '';

		// Google Fonts <link> for the selected font.
		if ( '' !== $font ) {
			$family = rawurlencode( $font );
			echo "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n";
			echo "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n";
			printf(
				"<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=%s:wght@400;500;600;700&display=swap\">\n",
				$family
			);
		}

		// Fallback favicon link if the site_icon option doesn't render one.
		if ( '' !== $favicon && ! has_site_icon() ) {
			printf( "<link rel=\"icon\" href=\"%s\">\n", esc_url( $favicon ) );
		}

		// Build the actual brand stylesheet.
		$css = '';

		// Custom-property tokens (themes/blocks can opt in).
		$css .= ':root{';
		if ( '' !== $primary ) {
			$css .= '--printonet-primary:' . esc_attr( $primary ) . ';';
			// Override common WP block-editor / theme.json color tokens so most themes pick this up.
			$css .= '--wp--preset--color--primary:' . esc_attr( $primary ) . ';';
			$css .= '--wp--preset--color--vivid-cyan-blue:' . esc_attr( $primary ) . ';';
		}
		if ( '' !== $font ) {
			$css .= "--printonet-font:'" . esc_attr( $font ) . "',sans-serif;";
			$css .= "--wp--preset--font-family--body:'" . esc_attr( $font ) . "',sans-serif;";
			$css .= "--wp--preset--font-family--heading:'" . esc_attr( $font ) . "',sans-serif;";
		}
		$css .= '}';

		// Direct selector overrides — high specificity so they beat default theme rules.
		if ( '' !== $primary ) {
			$css .= "
a, .wp-block-button__link:not(.has-background), .button, button.alt, .woocommerce a.button.alt, .woocommerce #respond input#submit.alt, .woocommerce-page a.button.alt, .woocommerce-page button.button.alt, .woocommerce-page input.button.alt {
  color: {$primary};
}
.wp-block-button__link:not(.has-background), .button.alt, .woocommerce a.button.alt, .woocommerce #respond input#submit.alt, .woocommerce-page a.button.alt, .woocommerce-page button.button.alt, .woocommerce-page input.button.alt, .woocommerce ul.products li.product .button, .woocommerce span.onsale {
  background-color: {$primary} !important;
  border-color: {$primary} !important;
  color: #fff !important;
}
.has-primary-color { color: {$primary} !important; }
.has-primary-background-color { background-color: {$primary} !important; }
.is-style-outline > .wp-block-button__link, .wp-block-button.is-style-outline .wp-block-button__link { border-color: {$primary} !important; color: {$primary} !important; }
a:hover, .wp-block-button__link:hover { opacity: 0.85; }
";
		}

		if ( '' !== $font ) {
			$css .= "
body, button, input, select, optgroup, textarea, .wp-block-post-title, h1, h2, h3, h4, h5, h6 {
  font-family: '" . esc_attr( $font ) . "', sans-serif;
}
";
		}

		echo "<style id=\"printonet-branding\">{$css}</style>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	},
	5
);

/* -------------------------------------------------------------------------
 * CORS: allow cross-origin add-to-cart from the customizer SDK so
 * cookie-based cart sessions persist when the SDK is hosted on
 * customizerstudio.com / app.printonet.com and the store lives on a
 * tenant subdomain.
 * ------------------------------------------------------------------------- */

add_action( 'init', function () {
	if ( empty( $_SERVER['HTTP_ORIGIN'] ) ) { return; }
	$origin = (string) $_SERVER['HTTP_ORIGIN'];
	$allowed = [
		'https://app.printonet.com',
		'https://customizerstudio.com',
		'https://printonet.lovable.app',
	];
	$ok = in_array( $origin, $allowed, true )
		|| preg_match( '#^https://[a-z0-9-]+\.lovable\.app$#i', $origin )
		|| preg_match( '#^https://[a-z0-9-]+\.lovableproject\.com$#i', $origin );
	if ( ! $ok ) { return; }
	header( 'Access-Control-Allow-Origin: ' . $origin );
	header( 'Vary: Origin' );
	header( 'Access-Control-Allow-Credentials: true' );
	header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' );
	header( 'Access-Control-Allow-Headers: Content-Type, X-Requested-With' );
	if ( 'OPTIONS' === ( $_SERVER['REQUEST_METHOD'] ?? '' ) ) {
		status_header( 204 );
		exit;
	}
}, 0 );

/* -------------------------------------------------------------------------
 * WooCommerce: capture customizer design data on add-to-cart and
 * persist it to the order line items so print shops see it.
 * ------------------------------------------------------------------------- */

if ( ! function_exists( 'printonet_sanitize_design_url' ) ) {
	function printonet_sanitize_design_url( $value ) {
		$value = is_string( $value ) ? trim( wp_unslash( $value ) ) : '';
		if ( '' === $value ) {
			return '';
		}
		// Allow data: URLs (base64 PNG) and http(s) URLs.
		if ( 0 === strpos( $value, 'data:image/' ) ) {
			return $value;
		}
		return esc_url_raw( $value );
	}
}

// 1. Read POST/GET fields the customizer SDK sends and attach to cart item.
add_filter( 'woocommerce_add_cart_item_data', function ( $cart_item_data, $product_id, $variation_id ) {
	if ( ! empty( $_POST['customizer_session_id'] ) ) {
		$cart_item_data['customizer_session_id'] = sanitize_text_field( wp_unslash( $_POST['customizer_session_id'] ) );
	} elseif ( ! empty( $_GET['customizer_session'] ) ) {
		$cart_item_data['customizer_session_id'] = sanitize_text_field( wp_unslash( $_GET['customizer_session'] ) );
	}
	if ( ! empty( $_POST['customizer_design_url'] ) ) {
		$cart_item_data['customizer_design_url'] = printonet_sanitize_design_url( $_POST['customizer_design_url'] );
	}
	if ( ! empty( $_POST['customizer_sides'] ) ) {
		$raw = wp_unslash( $_POST['customizer_sides'] );
		if ( is_string( $raw ) ) {
			$decoded = json_decode( $raw, true );
			if ( is_array( $decoded ) ) {
				$cart_item_data['customizer_sides'] = wp_json_encode( $decoded );
			}
		}
	}
	// Force unique cart line per session so two custom designs of the same product don't merge.
	if ( ! empty( $cart_item_data['customizer_session_id'] ) ) {
		$cart_item_data['unique_key'] = md5( 'cs_' . $cart_item_data['customizer_session_id'] );
	}
	return $cart_item_data;
}, 10, 3 );

// 2. Restore the data when WC rebuilds cart items from the session.
add_filter( 'woocommerce_get_cart_item_from_session', function ( $cart_item, $values ) {
	foreach ( [ 'customizer_session_id', 'customizer_design_url', 'customizer_sides' ] as $k ) {
		if ( isset( $values[ $k ] ) ) {
			$cart_item[ $k ] = $values[ $k ];
		}
	}
	return $cart_item;
}, 10, 2 );

// 3. Show a thumbnail + "Custom Design" label in the cart/checkout.
add_filter( 'woocommerce_get_item_data', function ( $item_data, $cart_item ) {
	if ( ! empty( $cart_item['customizer_session_id'] ) ) {
		$item_data[] = [
			'key'     => __( 'Custom Design', 'printonet' ),
			'value'   => substr( $cart_item['customizer_session_id'], 0, 8 ),
			'display' => '<code>' . esc_html( substr( $cart_item['customizer_session_id'], 0, 8 ) ) . '</code>',
		];
	}
	return $item_data;
}, 10, 2 );

add_filter( 'woocommerce_cart_item_thumbnail', function ( $thumbnail, $cart_item, $cart_item_key ) {
	if ( ! empty( $cart_item['customizer_design_url'] ) ) {
		return '<img src="' . esc_attr( $cart_item['customizer_design_url'] ) . '" style="width:64px;height:64px;object-fit:contain;background:#f5f5f5;border-radius:6px;" alt="Custom design" />';
	}
	return $thumbnail;
}, 10, 3 );

// 4. Persist to the order line item so admins / print shops can see the design.
add_action( 'woocommerce_checkout_create_order_line_item', function ( $item, $cart_item_key, $values, $order ) {
	if ( ! empty( $values['customizer_session_id'] ) ) {
		$item->add_meta_data( '_customizer_session_id', $values['customizer_session_id'], true );
	}
	if ( ! empty( $values['customizer_design_url'] ) ) {
		$item->add_meta_data( '_customizer_design_url', $values['customizer_design_url'], true );
	}
	if ( ! empty( $values['customizer_sides'] ) ) {
		$item->add_meta_data( '_customizer_sides_json', $values['customizer_sides'], true );
	}
}, 10, 4 );

// 5. Render preview in admin order view.
add_action( 'woocommerce_after_order_itemmeta', function ( $item_id, $item, $product ) {
	$session_id = $item->get_meta( '_customizer_session_id' );
	$design_url = $item->get_meta( '_customizer_design_url' );
	if ( ! $session_id && ! $design_url ) {
		return;
	}
	echo '<div style="margin-top:8px;padding:8px;background:#f8f9fa;border-radius:6px;font-size:12px;">';
	echo '<strong>🎨 Customizer Studio</strong><br/>';
	if ( $session_id ) {
		echo 'Session: <code>' . esc_html( $session_id ) . '</code><br/>';
	}
	if ( $design_url ) {
		echo '<img src="' . esc_attr( $design_url ) . '" style="width:120px;height:120px;object-fit:contain;border:1px solid #ddd;border-radius:4px;background:#f3f4f6;margin-top:4px;" alt="Custom design" />';
	}
	echo '</div>';
}, 10, 3 );

/* -------------------------------------------------------------------------
 * Activation: flush rewrite rules so REST routes are immediately available.
 * ------------------------------------------------------------------------- */

register_activation_hook( __FILE__, function () {
	flush_rewrite_rules();
} );

register_deactivation_hook( __FILE__, function () {
	flush_rewrite_rules();
} );
