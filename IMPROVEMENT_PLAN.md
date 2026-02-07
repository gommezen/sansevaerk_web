# Sansevaerk Security, Error Handling & Improvement Plan

This document captures a comprehensive analysis of the codebase for security vulnerabilities, error handling gaps, and architectural improvements.

**Created:** 2026-01-24

---

## CRITICAL BUG (Fix Immediately)

**File:** `public_html/api/sessions.php` line 47

```php
if ($since !== '' && is_iso_date) {  // BUG: Missing () - checks if function exists, not validates $since
```

**Should be:** `is_iso_date($since)`

**Impact:** The `?since=` parameter is completely ignored, breaking incremental sync functionality.

---

## 1. SECURITY VULNERABILITIES

### Critical Priority

| Issue | File:Line | Description |
|-------|-----------|-------------|
| Missing CSRF Protection | All POST/DELETE endpoints | No CSRF token validation on state-changing operations |
| Plaintext DB Password | private_journal/config.php | Database credentials in source code |
| Hardcoded SYNC_TOKEN | private_journal/config.php | API token visible in config file |
| No Login Rate Limiting | api/login.php | Unlimited login attempts allow brute force |

### High Priority

| Issue | File:Line | Description |
|-------|-----------|-------------|
| No HTTPS Enforcement | .htaccess | No automatic redirect from HTTP to HTTPS |
| No Sync Rate Limiting | api/sync.php | SYNC_TOKEN endpoint allows unlimited requests |
| Missing Security Headers | .htaccess | No CSP, X-Frame-Options, X-Content-Type-Options |

### Medium Priority

| Issue | File:Line | Description |
|-------|-----------|-------------|
| Weak Session Timeout | api/_common.php:25 | No explicit session garbage collection config |
| No Batch Size Limit | api/sessions.php:85 | Batch operations accept unlimited items |
| DOM innerHTML Usage | app.js (multiple) | Direct HTML insertion relies on escapeHtml working perfectly |

### Recommendations

**1. CSRF Protection** - Add to `_common.php`:
```php
function csrf_token(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf(): void {
    $token = $_POST['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!hash_equals($_SESSION['csrf_token'] ?? '', $token)) {
        respond(['error' => 'invalid csrf token'], 403);
    }
}
```

**2. Environment Variables** - Move secrets to `.env`:
```php
// In config.php
define('DB_PASS', getenv('DB_PASS') ?: die('DB_PASS not set'));
define('SYNC_TOKEN', getenv('SYNC_TOKEN') ?: die('SYNC_TOKEN not set'));
```

**3. Rate Limiting** - Add to `login.php`:
```php
$ip = $_SERVER['REMOTE_ADDR'];
$key = "login_attempts:$ip";
// Use file-based or database counter
// Block after 5 failed attempts for 15 minutes
```

**4. Security Headers** - Add to `.htaccess`:
```apache
<IfModule mod_headers.c>
  Header set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
  Header set X-Frame-Options "DENY"
  Header set X-Content-Type-Options "nosniff"
  Header set Strict-Transport-Security "max-age=31536000; includeSubDomains"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
```

---

## 2. ERROR HANDLING GAPS

### PHP Issues

| Issue | File | Description |
|-------|------|-------------|
| No DB connection try-catch | api/_common.php:100-108 | PDO connection throws uncaught exceptions |
| No query error handling | All API endpoints | Query failures expose PHP fatal errors |
| Minimal logging | Only 2 error_log() calls | No centralized logging system |
| Silent batch failures | api/sessions.php:108-141 | Invalid items skipped without user notification |

### JavaScript Issues

| Issue | File:Line | Description |
|-------|-----------|-------------|
| No network error distinction | app.js:3-14 | Can't tell network failure from server error |
| Generic error messages | Throughout | "Could not save." provides no debugging info |
| Mixed language errors | app.js:366 | "Login fejlede" (Danish) mixed with English |
| No console logging | Throughout | Errors not logged for debugging |

### API Response Inconsistencies

| Endpoint | Response Format |
|----------|-----------------|
| GET /api/sessions.php | Returns array directly `[{...}]` |
| POST /api/sessions.php | Returns `{ ok: true, upserted: N }` |
| GET /api/me.php | Returns `{ ok: true }` |
| Errors | Return `{ error: "message" }` |

### Recommendations

**1. Database Error Handling** - Wrap in `_common.php`:
```php
function pdo(): PDO {
    static $pdo;
    if (!$pdo) {
        try {
            $pdo = new PDO(...);
        } catch (PDOException $e) {
            error_log("DB connection failed: " . $e->getMessage());
            respond(['error' => 'database unavailable'], 503);
        }
    }
    return $pdo;
}
```

**2. Centralized Logger** - Create `private_journal/logger.php`:
```php
function app_log(string $level, string $msg, array $ctx = []): void {
    $entry = sprintf("[%s %s] %s %s\n", date('c'), $level, $msg, json_encode($ctx));
    error_log($entry, 3, __DIR__ . '/logs/' . date('Y-m-d') . '.log');
}
```

**3. Standardize API Responses**:
```php
// Success: { "data": [...] } or { "data": {...} }
// Error: { "error": "code", "message": "Human readable" }
```

---

## 3. CODE QUALITY IMPROVEMENTS

### Code Duplication

**Validation logic duplicated:**
- `sessions.php` lines 85-143 (batch) and 150-212 (single) - nearly identical
- `sessions.php` and `sync.php` both validate UUID with same regex
- Same range checks repeated in multiple places

**Fix:** Extract to `_common.php`:
```php
function validate_session(array $data): array|string {
    // Centralized validation returning validated array or error string
}

function validate_uuid(string $uuid): bool {
    return (bool)preg_match('/^[a-f0-9-]{36}$/i', $uuid);
}
```

### Missing Database Schema

No `schema.sql` exists. Create `private_journal/schema.sql`:
```sql
CREATE TABLE training_sessions (
    id INT AUTO_INCREMENT,
    uuid CHAR(36) NOT NULL,
    session_date DATE NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    duration_minutes INT UNSIGNED NOT NULL,
    energy_level TINYINT UNSIGNED NOT NULL,
    session_emphasis ENUM('physical','technical','mixed') NOT NULL,
    rpe TINYINT UNSIGNED DEFAULT NULL,
    notes TEXT,
    deleted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY (uuid)
);

-- Required indexes for query performance
CREATE INDEX idx_updated_at ON training_sessions(updated_at);
CREATE INDEX idx_session_date_deleted ON training_sessions(session_date, deleted);
```

### Missing Configuration Options

Add to `config.example.php`:
```php
define('ENV', $_ENV['APP_ENV'] ?? 'development');
define('DEBUG', ENV === 'development');
define('SESSION_TIMEOUT', 86400);
define('API_RATE_LIMIT', 100);  // requests per hour
```

### Frontend Architecture (app.js)

**Current issues:**
- Monolithic 446-line file
- Global state (`editingUuid`)
- Event handlers re-bound every render
- No offline capability despite README mentioning it

**Suggested improvements:**
- Extract state management
- Add localStorage caching for offline access
- Modularize into separate concerns

---

## 4. NEW FEATURES TO ADD

### Health Check Endpoint

Create `public_html/api/health.php`:
```php
<?php
require __DIR__ . '/_common.php';

try {
    $db = pdo();
    $db->query("SELECT 1");
    respond(['status' => 'ok', 'database' => 'connected', 'timestamp' => date('c')]);
} catch (Exception $e) {
    respond(['status' => 'error', 'database' => 'disconnected'], 503);
}
```

### Export Endpoint

Create `public_html/api/export.php` for CSV backup.

### Logging System

Create `private_journal/logger.php` for centralized logging with daily rotation.

---

## 5. IMPLEMENTATION PRIORITY

### Phase 1: Critical Fixes (Do First)
1. Fix `is_iso_date` bug in sessions.php:47
2. Add security headers to .htaccess
3. Move secrets to environment variables
4. Add CSRF token validation

### Phase 2: Security Hardening
5. Implement login rate limiting
6. Add sync endpoint rate limiting
7. Force HTTPS redirect
8. Add session timeout handling

### Phase 3: Error Handling
9. Wrap database connection in try-catch
10. Create centralized logger
11. Standardize API response format
12. Add batch operation error reporting

### Phase 4: Code Quality
13. Create schema.sql with indexes
14. Extract validation helpers to _common.php
15. Add health check endpoint
16. Add export/backup endpoint

### Phase 5: Frontend Improvements
17. Add localStorage caching for offline
18. Standardize error messages (English)
19. Add console logging for debugging

---

## 6. FILES TO MODIFY

| File | Changes |
|------|---------|
| `public_html/api/sessions.php` | Fix line 47 bug, extract validation, add error handling |
| `public_html/api/_common.php` | Add CSRF, rate limiting, logger, DB error handling |
| `public_html/api/sync.php` | Add rate limiting, improve logging |
| `public_html/api/login.php` | Add rate limiting |
| `public_html/.htaccess` | Add security headers, HTTPS redirect |
| `private_journal/config.example.php` | Add ENV, DEBUG, timeout options |
| `public_html/app.js` | Standardize error messages, add caching |

## 7. NEW FILES TO CREATE

| File | Purpose |
|------|---------|
| `private_journal/schema.sql` | Database schema with indexes |
| `private_journal/logger.php` | Centralized logging |
| `public_html/api/health.php` | Health check endpoint |
| `public_html/api/export.php` | CSV export endpoint |
| `.env.example` | Environment variables template |

---

## 8. VERIFICATION

After implementing changes:
1. Run `php -S localhost:8000 -t public_html` and test login/logout
2. Verify CSRF tokens work (check Network tab for token in requests)
3. Test rate limiting by attempting multiple failed logins
4. Check security headers with browser DevTools (Network > Response Headers)
5. Verify sync endpoint works with `?since=` parameter
6. Test health endpoint: `curl http://localhost:8000/api/health.php`
7. Verify error responses are consistent JSON format
