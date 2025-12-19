# sansevaerk

Local mirror of the sansevaerk.dk web domain.

This folder represents the production PHP/HTML/JS environment hosted on simply.com.
Files here are edited locally and uploaded to the server via SFTP.

Nothing in this folder is executed locally.
Nothing here depends on Python or Streamlit.

Structure:
- private_journal/  → non-public PHP code (auth, DB, helpers)
- public_html/      → web root (HTML, JS, API endpoints)

This folder is infrastructure, not an application.


### Password hash

Generate APP_PASS_HASH using PHP:

php -r "echo password_hash('your-password', PASSWORD_DEFAULT) . PHP_EOL;"

Never store plain-text passwords.

### Sync token

Generate a long random token, e.g.:

openssl rand -hex 32
