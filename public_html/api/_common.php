<?php
declare(strict_types=1);

/**
 * ----------------------------------------------------------------------
 * API bootstrap & shared utilities
 * ----------------------------------------------------------------------
 * - Starts PHP session with safe, compatible cookie settings
 * - Loads config
 * - Provides shared helpers for all API endpoints
 * ----------------------------------------------------------------------
 */

/* ----------------------------------------------------------------------
   Session configuration (defensive & compatible)
   ---------------------------------------------------------------------- */

$isHttps = (
    (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || ($_SERVER['SERVER_PORT'] ?? null) == 443
);

// Base params (always safe)
$cookieParams = [
    'lifetime' => 0,
    'path'     => '/',
    'domain'   => '',
    'httponly' => true,
    'secure'   => $isHttps,
];

// Only set SameSite=None when:
// - PHP supports it
// - HTTPS is active
if (PHP_VERSION_ID >= 70300 && $isHttps) {
    $cookieParams['samesite'] = 'None';
}

session_set_cookie_params($cookieParams);
session_start();

/* ----------------------------------------------------------------------
   Configuration
   ---------------------------------------------------------------------- */

require_once __DIR__ . '/../../private_journal/config.php';

/* ----------------------------------------------------------------------
   Request / response helpers
   ---------------------------------------------------------------------- */

function json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function respond(mixed $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/* ----------------------------------------------------------------------
   Authentication
   ---------------------------------------------------------------------- */

function require_auth(): void
{
    if (empty($_SESSION['auth'])) {
        respond(['error' => 'unauthorized'], 401);
    }
}

/* ----------------------------------------------------------------------
   Database (PDO singleton)
   ---------------------------------------------------------------------- */

function pdo(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=utf8mb4',
        DB_HOST,
        DB_NAME
    );

    $pdo = new PDO(
        $dsn,
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    return $pdo;
}

/* ----------------------------------------------------------------------
   Utilities
   ---------------------------------------------------------------------- */

function is_iso_date(string $value): bool
{
    return (bool)preg_match('/^\d{4}-\d{2}-\d{2}$/', $value);
}

function is_iso_datetime(string $value): bool
{
    return (bool)preg_match(
        '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/',
        $value
    );
}


