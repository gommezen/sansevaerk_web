-- ======================================================================
-- Sansevaerk — training_sessions table
-- ======================================================================
-- Run once against your MySQL/MariaDB database to create the table.
--
--   mysql -u <user> -p <dbname> < schema.sql
-- ======================================================================

CREATE TABLE IF NOT EXISTS training_sessions (
    id                INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    uuid              VARCHAR(36)     NOT NULL,
    session_date      DATE            NOT NULL,
    activity_type     VARCHAR(50)     NOT NULL,
    duration_minutes  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    energy_level      TINYINT UNSIGNED NOT NULL,
    session_emphasis  VARCHAR(20)     NOT NULL,
    rpe               TINYINT UNSIGNED DEFAULT NULL,
    notes             TEXT            DEFAULT NULL,
    deleted           TINYINT UNSIGNED NOT NULL DEFAULT 0,
    updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_uuid (uuid),
    INDEX idx_session_date (session_date),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
