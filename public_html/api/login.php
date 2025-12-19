<?php
declare(strict_types=1);

/**
 * Login endpoint
 * - Verifies credentials
 * - Establishes authenticated session
 */

require __DIR__ . '/_common.php';

$b = json_body();

$user = trim((string)($b['username'] ?? ''));
$pass = (string)($b['password'] ?? '');

if ($user === '' || $pass === '') {
    respond(['error' => 'missing credentials'], 400);
}

if ($user !== APP_USER || !password_verify($pass, APP_PASS_HASH)) {
    respond(['error' => 'invalid credentials'], 401);
}

// Prevent session fixation
session_regenerate_id(true);

// Mark session as authenticated
$_SESSION['auth'] = true;
$_SESSION['user'] = $user;

respond(['ok' => true]);
