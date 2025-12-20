# sansevaerk

A personal training journal designed for daily use, reliability, and long-term continuity.

The system supports logging, reviewing, and maintaining training sessions across days and weeks, with a strong focus on correctness, safety, and offline compatibility. It is intentionally minimal in scope, single-user by design, and optimized for habitual use rather than social or competitive features.

## Purpose

A single-user, authenticated training journal built to function as a durable personal record rather than a social platform.

Core capabilities include:

- Session-based authentication
- Day- and time-based querying
- Safe, UUID-based soft deletion
- Incremental offline/online synchronization
- Mobile-first daily usage

## System design

The journal is built around a small, explicit core:

- Authenticated API surface with centralized guards
- Deterministic data access patterns
- Non-destructive data operations by default
- Clear separation between infrastructure, API logic, and UI behavior

The system favors predictability and safety over feature breadth, making it easy to extend without destabilizing existing functionality.

## API characteristics

- Authentication required for all mutating operations
- Deterministic query precedence (day → incremental sync → recent)
- Soft-delete semantics (idempotent and sync-safe)
- Locale-safe date handling
- Defensive defaults and explicit empty-state responses

## Frontend behavior

- Mobile-first interface intended for frequent, short interactions
- Day and recent views kept in sync after mutations
- Immediate feedback on create and delete actions
- Graceful handling of expired sessions and empty states

## Security posture

Appropriate for a single-user personal system:

- HttpOnly session cookies
- Server-side validation on all inputs
- UUID-based identifiers
- Non-destructive deletes
- No secrets committed to version control

Further hardening is possible, but the current level is intentional and sufficient for the intended scope.

---
