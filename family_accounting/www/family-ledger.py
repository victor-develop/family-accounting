import json
import os

import frappe


def get_context(context):
    context.no_cache = 1
    context.title = "Family Ledger"
    assets = get_frontend_assets()
    context.frontend_js = assets["js"]
    context.frontend_css = assets["css"]
    context.boot = {
        "app_name": "family_accounting",
        "frontend_route": "/family-ledger",
    }


def get_frontend_assets():
    base_url = "/assets/family_accounting/frontend"
    fallback = {"js": f"{base_url}/main.js", "css": []}
    manifest_path = frappe.get_app_path(
        "family_accounting",
        "public",
        "frontend",
        ".vite",
        "manifest.json",
    )
    if not os.path.exists(manifest_path):
        return fallback
    with open(manifest_path, encoding="utf-8") as handle:
        manifest = json.load(handle)
    entry = manifest.get("index.html")
    if not entry:
        entry = next((item for item in manifest.values() if item.get("isEntry")), None)
    if not entry or not entry.get("file"):
        return fallback
    return {
        "js": f"{base_url}/{entry['file']}",
        "css": [f"{base_url}/{item}" for item in entry.get("css", [])],
    }
