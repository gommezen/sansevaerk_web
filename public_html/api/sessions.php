<?php
declare(strict_types=1);

/**
 * ----------------------------------------------------------------------
 * Sessions API
 * ----------------------------------------------------------------------
 * - GET  : fetch recent training sessions
 * - POST : insert single session or batch upsert
 *
 * Notes:
 * - Requires authenticated browser session
 * - Uses soft-delete via `deleted` flag
 * ----------------------------------------------------------------------
 */

require __DIR__ . '/_common.php';

require_auth();

if ($_SERVER['REQUEST_METHOD'] === 'POST' || $_SERVER['REQUEST_METHOD'] === 'DELETE') {
    require_csrf();
}

$db = pdo();

/* ----------------------------------------------------------------------
   GET — fetch sessions
   ---------------------------------------------------------------------- */

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $date  = isset($_GET['date'])  ? (string)$_GET['date']  : '';
    $since = isset($_GET['since']) ? (string)$_GET['since'] : '';

    // 1) Day overview (explicit user intent)
    if ($date !== '' && is_iso_date($date)) {
        $stmt = $db->prepare("
            SELECT
              id, session_date, activity_type, duration_minutes,
              energy_level, session_emphasis, rpe, notes, uuid, deleted, updated_at
            FROM training_sessions
            WHERE session_date = ?
              AND deleted = 0
            ORDER BY id DESC
        ");
        $stmt->execute([$date]);
        respond($stmt->fetchAll());
    }

    // 2) Incremental sync (Streamlit)
    if ($since !== '' && is_iso_date($since)) {
        $stmt = $db->prepare("
            SELECT
              id, session_date, activity_type, duration_minutes,
              energy_level, session_emphasis, rpe, notes, uuid, deleted, updated_at
            FROM training_sessions
            WHERE updated_at > ?
            ORDER BY updated_at ASC
            LIMIT 500
        ");
        $stmt->execute([$since]);
        respond($stmt->fetchAll());
    }

    // 3) Default: recent sessions
    $stmt = $db->query("
        SELECT
          id, session_date, activity_type, duration_minutes,
          energy_level, session_emphasis, rpe, notes, uuid, deleted, updated_at
        FROM training_sessions
        WHERE deleted = 0
        ORDER BY session_date DESC, id DESC
        LIMIT 200
    ");
    respond($stmt->fetchAll());
}

/* ----------------------------------------------------------------------
   POST — insert / upsert sessions
   ---------------------------------------------------------------------- */

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = json_body();

    /* --------------------------------------------------
       Batch mode: { items: [...] }
       -------------------------------------------------- */

    if (isset($b['items']) && is_array($b['items'])) {
        $stmt = $db->prepare("
            INSERT INTO training_sessions
            (session_date, activity_type, duration_minutes, energy_level,
            session_emphasis, rpe, notes, uuid, deleted)
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            session_date=VALUES(session_date),
            activity_type=VALUES(activity_type),
            duration_minutes=VALUES(duration_minutes),
            energy_level=VALUES(energy_level),
            session_emphasis=VALUES(session_emphasis),
            rpe=VALUES(rpe),
            notes=VALUES(notes),
            deleted=GREATEST(deleted, VALUES(deleted)),
            updated_at=CURRENT_TIMESTAMP
        ");



        $count = 0;

        foreach ($b['items'] as $it) {
            if (!is_array($it)) continue;

            $session_date     = (string)($it['session_date'] ?? '');
            $activity_type    = (string)($it['activity_type'] ?? '');
            $duration_minutes = (int)($it['duration_minutes'] ?? -1);
            $energy_level     = (int)($it['energy_level'] ?? 0);
            $session_emphasis = (string)($it['session_emphasis'] ?? '');
            $rpe = array_key_exists('rpe', $it) ? (int)$it['rpe'] : null;
            $notes            = array_key_exists('notes', $it) ? (string)$it['notes'] : null;
            $uuid             = (string)($it['uuid'] ?? '');
            $deleted          = (int)($it['deleted'] ?? 0);

            if (!is_iso_date($session_date)) continue;
            if ($activity_type === '' || $session_emphasis === '') continue;
            if ($rpe !== null && ($rpe < 1 || $rpe > 10)) continue;
            if ($duration_minutes < 0 || $duration_minutes > 300) continue;
            if ($energy_level < 1 || $energy_level > 5) continue;
            if (!preg_match('/^[a-f0-9-]{36}$/i', $uuid)) continue;

            $stmt->execute([
                $session_date,
                $activity_type,
                $duration_minutes,
                $energy_level,
                $session_emphasis,
                $rpe,
                $notes,
                $uuid,
                $deleted
            ]);

            $count++;
        }

        respond(['ok' => true, 'upserted' => $count]);
    }

    /* --------------------------------------------------
       Single insert (browser)
       -------------------------------------------------- */

    $session_date     = (string)($b['session_date'] ?? '');
    $activity_type    = (string)($b['activity_type'] ?? '');
    $duration_minutes = (int)($b['duration_minutes'] ?? -1);
    $energy_level     = (int)($b['energy_level'] ?? 0);
    $session_emphasis = (string)($b['session_emphasis'] ?? '');
    $rpe = array_key_exists('rpe', $b) ? (int)$b['rpe'] : null;
    $notes            = array_key_exists('notes', $b) ? (string)$b['notes'] : null;
    $uuid             = (string)($b['uuid'] ?? '');

    if (!is_iso_date($session_date)) {
        respond(['error' => 'session_date must be YYYY-MM-DD'], 400);
    }
    if ($activity_type === '') {
        respond(['error' => 'activity_type required'], 400);
    }
    if ($duration_minutes < 0 || $duration_minutes > 300) {
        respond(['error' => 'duration_minutes invalid'], 400);
    }
    if ($energy_level < 1 || $energy_level > 5) {
        respond(['error' => 'energy_level invalid'], 400);
    }
    if ($session_emphasis === '') {
        respond(['error' => 'session_emphasis required'], 400);
    }
    if ($rpe !== null && ($rpe < 1 || $rpe > 10)) {
        respond(['error' => 'rpe must be 1–10 or null'], 400);
    }
    if (!preg_match('/^[a-f0-9-]{36}$/i', $uuid)) {
        respond(['error' => 'uuid required (36 chars)'], 400);
    }

    // Explicitly set deleted = 0 so the row is visible
    // Insert new OR update existing (edit mode uses same uuid)
    $stmt = $db->prepare("
        INSERT INTO training_sessions
        (session_date, activity_type, duration_minutes, energy_level,
        session_emphasis, rpe, notes, uuid, deleted)
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE
        session_date=VALUES(session_date),
        activity_type=VALUES(activity_type),
        duration_minutes=VALUES(duration_minutes),
        energy_level=VALUES(energy_level),
        session_emphasis=VALUES(session_emphasis),
        rpe=VALUES(rpe),
        notes=VALUES(notes),
        deleted=0,
        updated_at=CURRENT_TIMESTAMP
    ");

    $stmt->execute([
        $session_date,
        $activity_type,
        $duration_minutes,
        $energy_level,
        $session_emphasis,
        $rpe,
        $notes,
        $uuid
    ]);

    respond(['ok' => true]);
}


/* ----------------------------------------------------------------------
   DELETE — soft delete session by uuid
   ---------------------------------------------------------------------- */

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $b = json_body();
    $uuid = (string)($b['uuid'] ?? '');

    if (!preg_match('/^[a-f0-9-]{36}$/i', $uuid)) {
        respond(['error' => 'invalid uuid'], 400);
    }

    $stmt = $db->prepare("
        UPDATE training_sessions
        SET deleted = 1, updated_at = CURRENT_TIMESTAMP
        WHERE uuid = ? AND deleted = 0
    ");
    $stmt->execute([$uuid]);

    if ($stmt->rowCount() === 0) {
        respond(['error' => 'not found'], 404);
    }

    respond(['ok' => true]);

}


/* ----------------------------------------------------------------------
   Fallback
   ---------------------------------------------------------------------- */

respond(['error' => 'method not allowed'], 405);
