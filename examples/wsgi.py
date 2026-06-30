"""WSGI entrypoint that serves static assets without nginx.

Frappe's official gunicorn config (`frappe.app:application --preload`) does NOT
serve `/assets/*` — in a standard deployment that is nginx's job. When running
gunicorn behind a reverse tunnel (e.g. Cloudflare Tunnel) without a separate
reverse proxy, assets return 404.

This module wraps the application with `application_with_statics()`, which adds
Werkzeug's SharedDataMiddleware so gunicorn serves assets itself.

Usage (from the bench root):

    cp examples/wsgi.py .
    # then in Procfile.prod:
    #   web: ... gunicorn ... wsgi:application
"""

import os

os.environ.setdefault("SITES_PATH", "sites")

import frappe.app

application = frappe.app.application_with_statics()
