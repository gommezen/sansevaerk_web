<?php
declare(strict_types=1);

/**
 * ----------------------------------------------------------------------
 * Auth status endpoint
 * ----------------------------------------------------------------------
 * - GET: verify authenticated session
 *
 * Returns:
 *   200 { ok: true }
 *   401 if not authenticated
 * ----------------------------------------------------------------------
 */

require __DIR__ . '/_common.php';

require_auth();

respond([
    'ok' => true
]);
