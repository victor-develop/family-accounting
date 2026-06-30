# Production Deployment Guide

This guide covers deploying Family Ledger to a single host (bare metal or VM)
behind a reverse tunnel (e.g. Cloudflare Tunnel). It documents the gotchas that
`bench get-app` alone does not solve.

## Prerequisites

| Dependency | Version | Notes |
|------------|---------|-------|
| MariaDB | **10.6 – 10.11** | MariaDB 11.x / 12.x is **not** compatible with Frappe v15. The installer will warn but the `notification_config` hook crashes the site at runtime. Pin to 10.11. |
| Python | 3.10 – 3.11 | Frappe v15 does not support 3.12+ reliably yet. |
| Node | 18+ | For building assets. |
| Redis | 6+ | cache + queue (socketio can share the cache instance). |

## 1. Install the app

```bash
bench init family-accounting-bench --frappe-branch version-15
cd family-accounting-bench
bench get-app family_accounting https://github.com/victor-develop/family-accounting
```

> If `bench get-app --resolve-deps` fails with a path that contains the full
> git URL, drop `--resolve-deps` and run the app install manually:
>
> ```bash
> bench get-app https://github.com/victor-develop/family-accounting
> source env/bin/activate && pip install -e apps/family_accounting
> ```

## 2. Create the site

**Name the site after the public hostname you will serve it from** (e.g. the
tunnel domain). Frappe resolves the target site from the `Host` header, so the
site name and the public hostname must match. Using `family-accounting.localhost`
for production means every request returns `404: <host> does not exist`.

```bash
bench new-site family-accounting.example.com \
  --admin-password <password> \
  --mariadb-root-password <root-password>
bench --site family-accounting.example.com install-app family_accounting
bench --site family-accounting.example.com migrate
```

## 3. Build the frontend assets

```bash
bench build --app family_accounting
```

This runs `vite build` twice: once for the local dev harness and once
(`FRAPPE_BUILD=1`) into `family_accounting/public/frontend/`, which Frappe serves
under `/assets/family_accounting/frontend/`. The `family-ledger-loader.js`
bootstrap script reads the generated `.vite/manifest.json` and injects the
hashed bundles at runtime, so the hashed filenames do not need to be hardcoded.

Verify the assets symlink exists after building:

```bash
ls -l sites/assets/family_accounting
# Should point to ../../apps/family_accounting/family_accounting/public
```

If it is missing, bench failed to link it. Recreate it manually:

```bash
ln -sfn ../../apps/family_accounting/family_accounting/public sites/assets/family_accounting
```

## 4. Run the production stack

The default `Procfile` runs `bench serve` (the Werkzeug development server) plus
`bench watch` (live reload). Neither belongs in production. Use the provided
[`examples/Procfile.prod`](../examples/Procfile.prod) instead:

```bash
bench start --procfile examples/Procfile.prod
```

> Copy `examples/Procfile.prod` into the bench root (`cp examples/Procfile.prod .`)
> before running, since `bench start` resolves the procfile path relative to the
> bench root.

### Why `wsgi.py`?

Frappe's official gunicorn invocation (`frappe.app:application --preload`) does
**not** serve `/assets/*` — that is nginx's job in a standard deployment. When
you run gunicorn without a reverse proxy (e.g. behind a Cloudflare Tunnel
pointing straight at gunicorn), static assets return 404.

[`examples/wsgi.py`](../examples/wsgi.py) wraps the app with
`application_with_statics()` so gunicorn serves assets itself. The example
`Procfile.prod` already points gunicorn at `wsgi:application`.

### Environment quirks on macOS

- Gunicorn's `gthread` worker calls `os.eventfd()`, which does not exist on
  macOS. **Do not pass `--threads`** on macOS; the default `sync` worker works
  fine for low-traffic personal deployments.
- Frappe resolves several paths relative to the worker's working directory
  (site logs, `assets/assets.json`). The example `Procfile.prod` sets the web
  process cwd to `sites/` and `SITES_PATH=.` so those relative paths resolve
  correctly. On Linux with supervisor this is handled differently (absolute
  paths in the supervisor config).

## 5. Expose via Cloudflare Tunnel

```bash
cloudflared tunnel create family-accounting-tunnel
cloudflared tunnel route dns <tunnel-id> family-accounting.example.com
```

`~/.cloudflared/config.yml`:

```yaml
tunnel: <tunnel-id>
credentials-file: ~/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: family-accounting.example.com
    service: http://localhost:8001
  - service: http_status:404
```

```bash
cloudflared tunnel run <tunnel-id>
```

### Zero Trust Access (optional)

Restrict the tunnel to specific email addresses:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/<zone-id>/access/apps" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -d '{
    "name": "family-accounting",
    "domain": "family-accounting.example.com",
    "type": "self_hosted",
    "session_duration": "24h",
    "auto_redirect_to_identity": true,
    "policies": [{
      "name": "Allow household",
      "decision": "allow",
      "include": [{"email": {"email": "you@example.com"}}],
      "precedence": 1
    }]
  }'
```

## 6. Programmatic API access (for agents)

Agents running on the same host can call the Frappe API directly on the gunicorn
port, bypassing the tunnel entirely.

1. Generate API credentials for a Frappe user:

   ```bash
   bench --site family-accounting.example.com execute \
     "frappe.core.doctype.user.user.generate_keys" --user Administrator
   ```

2. Call any whitelisted method:

   ```bash
   curl http://localhost:8001/api/method/family_accounting.api.list_entries \
     -H "Authorization: token <api_key>:<api_secret>"
   ```

The agent-facing skill package at [`llm/skills/family-accounting-assistant`](../llm/skills/family-accounting-assistant)
documents every endpoint and payload shape. Serve those docs as static assets so
agents can fetch them:

```bash
mkdir -p apps/family_accounting/family_accounting/public/agent
cp llm/skills/family-accounting-assistant/SKILL.md apps/family_accounting/family_accounting/public/agent/skill.md
cp llm/skills/family-accounting-assistant/references/api.md apps/family_accounting/family_accounting/public/agent/api.md
```

Agents then fetch `http://localhost:8001/assets/family_accounting/agent/api.md`
to self-discover the API.

## Troubleshooting

### `404: <hostname> does not exist`

The site name does not match the `Host` header. Either rename the site to match
the public hostname, or add the hostname to `site_config.json`:

```json
{ "domains": ["family-accounting.example.com"] }
```

### Assets return 404 under gunicorn

You are running gunicorn without nginx. Use [`examples/wsgi.py`](../examples/wsgi.py)
as the gunicorn entrypoint so assets are served via Werkzeug's
`SharedDataMiddleware`.

### `AttributeError: 'NoneType' object has no attribute 'get'` in templates

`bundled_assets` is `None` because Frappe cannot find `assets/assets.json`. This
file lives under `sites/assets/` but Frappe reads it relative to the worker's
cwd. Make sure the gunicorn worker cwd is the `sites/` directory (see the
example `Procfile.prod`).

### MariaDB `Access denied for user 'root'@'localhost'`

MariaDB 10.11 on Homebrew defaults the root account to `unix_socket`
authentication. Reset it:

```bash
mariadbd --skip-grant-tables --datadir=/usr/local/var/mysql &
mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '<password>'; FLUSH PRIVILEGES;"
```
