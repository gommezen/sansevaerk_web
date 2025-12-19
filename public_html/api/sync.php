<?php
require __DIR__ . '/_common.php';

$token = $_SERVER['HTTP_X_SYNC_TOKEN'] ?? '';
if (!hash_equals(SYNC_TOKEN, $token)) {
  respond(['error' => 'unauthorized'], 401);
}

$db = pdo();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $b = json_body();
  if (!isset($b['items']) || !is_array($b['items'])) {
    respond(['error' => 'no items'], 400);
  }

  $stmt = $db->prepare("
    INSERT INTO training_sessions
      (session_date, activity_type, duration_minutes, energy_level,
       session_emphasis, notes, uuid, deleted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      session_date=VALUES(session_date),
      activity_type=VALUES(activity_type),
      duration_minutes=VALUES(duration_minutes),
      energy_level=VALUES(energy_level),
      session_emphasis=VALUES(session_emphasis),
      notes=VALUES(notes),
      deleted=VALUES(deleted),
      updated_at=CURRENT_TIMESTAMP
  ");

  $count = 0;
  foreach ($b['items'] as $it) {
    $stmt->execute([
      $it['session_date'],
      $it['activity_type'],
      (int)$it['duration_minutes'],
      (int)$it['energy_level'],
      $it['session_emphasis'],
      $it['notes'] ?? null,
      $it['uuid'],
      (int)($it['deleted'] ?? 0),
    ]);
    $count++;
  }

  respond(['ok' => true, 'upserted' => $count]);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $since = $_GET['since'] ?? '1970-01-01 00:00:00';

  $stmt = $db->prepare("
    SELECT session_date, activity_type, duration_minutes, energy_level,
           session_emphasis, notes, uuid, deleted, updated_at
    FROM training_sessions
    WHERE updated_at > ?
    ORDER BY updated_at ASC
    LIMIT 500
  ");
  $stmt->execute([$since]);
  respond($stmt->fetchAll());
}

respond(['error' => 'method not allowed'], 405);
