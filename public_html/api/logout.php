<?php
declare(strict_types=1);

/**
 * ----------------------------------------------------------------------
 * Logout endpoint
 * ----------------------------------------------------------------------
 * - Clears session data
 * - Invalidates session cookie
 * - Destroys session
 * ----------------------------------------------------------------------
 */

require __DIR__ . '/_common.php';

require_csrf();

/**
 * Clear session array
 */
$_SESSION = [];

/**
 * Delete session cookie (important for mobile browsers)
 */
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'],
        $params['domain'] ?? '',
        $params['secure'],
        $params['httponly']
    );
}

/**
 * Destroy session
 */
session_destroy();

respond(['ok' => true]);
