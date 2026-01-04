<?php
require __DIR__ . '/_common.php';

$token = $_SERVER['HTTP_X_SYNC_TOKEN'] ?? '';
if (!hash_equals(SYNC_TOKEN, $token)) {
  respond(['error' => 'unauthorized'], 401);
}

$db = pdo();

/* ----------------------------------------------------------------------
   POST — upsert sessions (CREATE + UPDATE)
   ---------------------------------------------------------------------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

  $b = json_body();
  if (!isset($b['items']) || !is_array($b['items'])) {
    respond(['error' => 'no items'], 400);
  }

  $stmt = $db->prepare("
    INSERT INTO training_sessions
      (
        session_date,
        activity_type,
        duration_minutes,
        energy_level,
        session_emphasis,
        rpe,
        notes,
        uuid,
        deleted
      )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      session_date      = VALUES(session_date),
      activity_type     = VALUES(activity_type),
      duration_minutes  = VALUES(duration_minutes),
      energy_level      = VALUES(energy_level),
      session_emphasis  = VALUES(session_emphasis),
      rpe               = VALUES(rpe),
      notes             = VALUES(notes),
      deleted           = GREATEST(deleted, VALUES(deleted)),
      updated_at        = CURRENT_TIMESTAMP
  ");

  $count = 0;

  foreach ($b['items'] as $it) {

    // --- defensiv, eksplicit mapping (KRITISK for RPE) ---
    $session_date     = (string)($it['session_date'] ?? '');
    $activity_type    = (string)($it['activity_type'] ?? '');
    $duration_minutes = (int)($it['duration_minutes'] ?? 0);
    $energy_level     = (int)($it['energy_level'] ?? 0);
    $session_emphasis = (string)($it['session_emphasis'] ?? '');
    $rpe              = array_key_exists('rpe', $it) ? (int)$it['rpe'] : null;
    $notes            = $it['notes'] ?? null;
    $uuid             = (string)($it['uuid'] ?? '');
    $deleted          = (int)($it['deleted'] ?? 0);

    // --- skip ugyldige rækker ---
    if ($uuid === '' || !preg_match('/^[a-f0-9-]{36}$/i', $uuid)) {
      error_log("Skipping item with invalid uuid");
      continue;
    }

    $stmt->execute([
      $session_date,
      $activity_type,
      $duration_minutes,
      $energy_level,
      $session_emphasis,
      $rpe,
      $notes,
      $uuid,
      $deleted,
    ]);

    // --- vigtig: afslør stille fejl ---
    if ($stmt->rowCount() === 0) {
      error_log("Upsert had no effect for uuid={$uuid}");
    }

    $count++;
  }

  respond([
    'ok'        => true,
    'upserted' => $count
  ]);
}

/* ----------------------------------------------------------------------
   GET — fetch changed sessions
   ---------------------------------------------------------------------- */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

  $since = $_GET['since'] ?? '1970-01-01 00:00:00';

  $stmt = $db->prepare("
    SELECT
      session_date,
      activity_type,
      duration_minutes,
      energy_level,
      session_emphasis,
      rpe,
      notes,
      uuid,
      deleted,
      updated_at
    FROM training_sessions
    WHERE updated_at > ?
    ORDER BY updated_at ASC
    LIMIT 500
  ");

  $stmt->execute([$since]);
  respond($stmt->fetchAll());
}

respond(['error' => 'method not allowed'], 405);
