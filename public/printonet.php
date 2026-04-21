<?php
/**
 * Plugin Name: Printonet
 * Plugin URI:  https://app.printonet.com
 * Description: Receives store branding (name, colors, fonts, logos) from the Printonet dashboard and applies it to this WordPress site. Exposes /wp-json/printonet/v1/health and /wp-json/printonet/v1/branding.
 * Version:     1.0.0
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

define( 'PRINTONET_PLUGIN_VERSION', '1.0.0' );
define( 'PRINTONET_BRANDING_OPTION', 'printonet_branding' );

/* -------------------------------------------------------------------------
 * Auth helpers
 * ------------------------------------------------------------------------- */

/**
 * Constant-time comparison of the incoming token against the configured one.
 *
 * @param string $provided Header value from the request.
 * @return bool
 */
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

/**
 * Sanitize a single branding payload field. Allows empty strings so the
 * dashboard can clear a value by sending null or an empty string.
 *
 * @param mixed  $value Raw value.
 * @param string $kind  One of: text, email, url, hex, font.
 * @return string
 */
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
			// Allow letters, numbers, spaces, hyphens — typical Google Font names.
			return preg_match( '/^[A-Za-z0-9 \-]{1,64}$/', $value ) ? $value : '';
		case 'text':
		default:
			return sanitize_text_field( $value );
	}
}

/* -------------------------------------------------------------------------
 * REST routes
 * ------------------------------------------------------------------------- */

add_action(
	'rest_api_init',
	function () {
		// Public liveness check used by Printonet to confirm a freshly
		// cloned site is responsive before pushing branding.
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

		// Receives store identity + theme + asset URLs from the Printonet
		// dashboard. Authenticated with X-Printonet-Token shared secret.
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
						'accent_color'       => printonet_sanitize_field( $body['accent_color'] ?? null, 'hex' ),
						'font_family'        => printonet_sanitize_field( $body['font_family'] ?? null, 'font' ),
						'logo_url'           => printonet_sanitize_field( $body['logo_url'] ?? null, 'url' ),
						'secondary_logo_url' => printonet_sanitize_field( $body['secondary_logo_url'] ?? null, 'url' ),
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

					return new WP_REST_Response(
						[
							'ok'      => true,
							'stored'  => $clean,
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
 * ------------------------------------------------------------------------- */

add_action(
	'wp_head',
	function () {
		$branding = get_option( PRINTONET_BRANDING_OPTION );
		if ( ! is_array( $branding ) || empty( $branding ) ) {
			return;
		}

		$primary = isset( $branding['primary_color'] ) ? $branding['primary_color'] : '';
		$accent  = isset( $branding['accent_color'] ) ? $branding['accent_color'] : '';
		$font    = isset( $branding['font_family'] ) ? $branding['font_family'] : '';
		$favicon = isset( $branding['favicon_url'] ) ? $branding['favicon_url'] : '';

		// Google Fonts <link> for the selected font.
		if ( '' !== $font ) {
			$family = rawurlencode( $font );
			printf(
				'<link rel="preconnect" href="https://fonts.googleapis.com">' . "\n" .
				'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' . "\n" .
				'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=%s:wght@400;500;600;700&display=swap">' . "\n",
				$family . '%3Awght%40400%3B500%3B600%3B700&display=swap' === '' ? $family : $family
			);
		}

		// Favicon override.
		if ( '' !== $favicon ) {
			printf( '<link rel="icon" href="%s">' . "\n", esc_url( $favicon ) );
		}

		// CSS variables consumable by themes/blocks.
		$css = ':root{';
		if ( '' !== $primary ) {
			$css .= '--printonet-primary:' . esc_attr( $primary ) . ';';
		}
		if ( '' !== $accent ) {
			$css .= '--printonet-accent:' . esc_attr( $accent ) . ';';
		}
		if ( '' !== $font ) {
			$css .= "--printonet-font:'" . esc_attr( $font ) . "',sans-serif;";
		}
		$css .= '}';
		echo "<style id=\"printonet-branding\">{$css}</style>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	},
	5
);

/* -------------------------------------------------------------------------
 * Activation: flush rewrite rules so REST routes are immediately available.
 * ------------------------------------------------------------------------- */

register_activation_hook( __FILE__, function () {
	flush_rewrite_rules();
} );

register_deactivation_hook( __FILE__, function () {
	flush_rewrite_rules();
} );
