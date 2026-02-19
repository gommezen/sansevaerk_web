<?php
/**
 * Example configuration file.
 *
 * Copy this file to config.php and fill in real values.
 * config.php contains secrets and must NEVER be committed to git.
 */

/* ----------------------------------------------------------------------
   Database
   ---------------------------------------------------------------------- */

define('DB_HOST', 'localhost');
define('DB_NAME', 'database_name');
define('DB_USER', 'username');
define('DB_PASS', 'password');

/* ----------------------------------------------------------------------
   Application authentication
   ---------------------------------------------------------------------- */

// Username for web login
define('APP_USER', 'your_username');

// Password hash (use password_hash() to generate)
define('APP_PASS_HASH', '$2y$10$exampleexampleexampleexampleexample');

/* ----------------------------------------------------------------------
   Sync authentication
   ---------------------------------------------------------------------- */

// Shared secret for Streamlit / API sync
define('SYNC_TOKEN', 'replace-with-long-random-string');

/* ----------------------------------------------------------------------
   Session settings (optional)
   ---------------------------------------------------------------------- */

// Session idle timeout in seconds (default: 86400 = 24 hours)
// define('SESSION_TIMEOUT', 86400);
