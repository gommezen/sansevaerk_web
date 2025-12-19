# private_journal

Mirror of /private_journal on simply.com.

This folder contains PHP code that must never be web-accessible:
- authentication
- database connections
- shared helpers and config

Files here are included by scripts in public_html/.
Do not move files from this folder into public_html.
Do not expose this folder via the web server.
