# sansevaerk

Sansevaerk is a minimal, single-user personal training journal (PHP + simple frontend) focused on daily logging, reliable offline/online synchronization, and long-term data continuity.

![Screenshot — Warm Dojo theme](screenshot.png)

## Quick Start

1. Copy the example config and edit required values:

```bash
# Unix / Git Bash
cp private_journal/config.example.php private_journal/config.php

# PowerShell (Windows)
Copy-Item private_journal\config.example.php private_journal\config.php

# Edit private_journal/config.php and set DB and secret values
```

2. Start a development server:

```bash
php -S localhost:8000 -t public_html
# Open http://localhost:8000 in your browser
```

## Requirements

- PHP 7.4+  
- MySQL/MariaDB database  
- A modern browser


## Configuration

- Copy `private_journal/config.example.php` → `private_journal/config.php` and fill in real values.
- Fields present in the example:

  - `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` — database connection
  - `APP_USER` — login username for the single-user system
  - `APP_PASS_HASH` — password hash generated with `password_hash()`
  - `SYNC_TOKEN` — shared secret for sync/authenticated sync endpoints

- Important: `private_journal/config.php` contains secrets and must NEVER be committed to version control.

## Usage / API

See `public_html/api/` for endpoint implementations and parameter definitions.

## Features

- Authenticated, session-based API
- Create, edit, and soft-delete training sessions
- Day-based and recent session views
- RPE (Rate of Perceived Exertion) tracking per session
- UUID-based session identities
- Incremental sync endpoint for external clients
- Responsive UI designed for mobile logging
- Four themes: Light, Dark, Warm Dojo (Win95 retro), Classic 95

## Architecture & Design Principles

- Centralized authentication and request guarding
- Deterministic data access and update paths
- Non-destructive operations by default (soft delete)
- Clear separation of infrastructure, API logic, and UI behavior

Refer to the `api/` folder for endpoint implementations and `public_html/` for frontend assets.

## Development

- Recommended local workflow:
  - Copy and edit `private_journal/config.example.php` → `private_journal/config.php`
  - Run the built-in server for quick iteration
- Add tests and linters as needed (not currently included)
- Keep secrets out of source control
