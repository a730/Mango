# Mango

![Build](https://github.com/a730/Mango/workflows/Build/badge.svg)

Mango is a self-hosted manga server and web reader with built-in anime streaming and manga search. Forked from [getmango/Mango](https://github.com/getmango/Mango) v0.27.0 after upstream development stopped, this fork adds online content browsing alongside the original local library reader.

## Features

### Original (local library)
- Multi-user support with admin controls
- OPDS support
- Dark/light mode switch
- Supported formats: `.cbz`, `.zip`, `.cbr` and `.rar`
- Supports nested folders in library
- Automatically stores reading progress
- Thumbnail generation
- Responsive web reader (mobile-friendly)
- Single binary deployment

### New (online streaming + search)
- **Anime streaming** — Search and watch anime from **AnimeKai** via the built-in middleware. Browse, save, and stream with episode selection, quality switching, and HLS playback.
- **Manga search** — Search and read manga online from **ComicK**, **MangaDex**, **MangaHere**, **MangaPill**, and **WeebCentral** via `@consumet/extensions`. Browse chapters and read in-page.
- **Plugin system** — Extended to support both `manga` and `anime` capabilities. Plugins run in a sandboxed Duktape JS engine.
- **HLS streaming proxy** — Built-in proxy rewrites HLS playlists for secure streaming through Mango.

## Screenshots

### Anime Browse

![anime browse](.github/screenshots/anime-browse.png)

### Anime Player

![anime player](.github/screenshots/anime-player.png)

### Manga Browse

![manga browse](.github/screenshots/manga-browse.png)

### Library

![library](.github/screenshots/library.png)

### Reader

![reader](.github/screenshots/reader.png)

## Quick Start (Docker)

```bash
git clone https://github.com/a730/Mango.git
cd Mango
cp env.example .env
# Edit .env with your paths
docker compose up -d
```

Visit `http://localhost:9000`. The anime middleware starts automatically alongside Mango.

## Quick Start (binary)

```bash
# Download the latest mango binary
wget https://github.com/a730/Mango/releases/latest/download/mango
chmod +x mango

# Start the anime middleware (requires Node.js)
cd anime-middleware
npm install
node server.js &
cd ..

# Start Mango
./mango
```

## Building from Source

Requires **Crystal 1.16.3+** and **Node.js 20+**.

```bash
git clone https://github.com/a730/Mango.git
cd Mango

# Build vendored image_size native extensions
cd lib/image_size && make && cd ../..

# Install Crystal dependencies
shards install

# Build Mango binary
crystal build src/mango.cr --release --progress

# Install anime middleware deps
cd anime-middleware
npm install
cd ..
```

The `lib/image_size`, `lib/mg`, and `lib/archive` shards are vendored with
patches for Crystal 1.16 compatibility. Other shards are fetched by
`shards install`.

## Docker (GHCR)

Pre-built images are available on [GitHub Container Registry](https://github.com/a730/Mango/pkgs/container/mango):

- `ghcr.io/a730/mango:latest` — Mango server
- `ghcr.io/a730/mango-anime-middleware:latest` — Anime streaming middleware

The docker-compose.yml pulls these by default. Images are automatically rebuilt
on every push to `master`.

### Local Docker build

```bash
docker compose build    # build from source (takes ~10 min)
docker compose up -d    # or pull pre-built images from GHCR
```

Override images via `.env`:
```
MANGO_IMAGE=ghcr.io/your-org/mango:latest
MIDDLEWARE_IMAGE=ghcr.io/your-org/mango-anime-middleware:latest
```

## Usage

### CLI

```
  Mango - Manga Server and Web Reader. Version 0.27.0

  Usage:
    mango [sub_command] [options]

  Options:
    -c PATH, --config=PATH    Path to the config file
    -h, --help                Show this help
    -v, --version             Show version

  Sub Commands:
    admin                     Run admin tools
```

### Config

Default config location: `~/.config/mango/config.yml`

```yaml
host: 0.0.0.0
port: 9000
base_url: /
session_secret: mango-session-secret
library_path: ~/mango/library
db_path: ~/mango/mango.db
queue_db_path: ~/mango/queue.db
scan_interval_minutes: 5
thumbnail_generation_interval_hours: 24
log_level: info
upload_path: ~/mango/uploads
plugin_path: ~/mango/plugins
download_timeout_seconds: 30
library_cache_path: ~/mango/library.yml.gz
cache_enabled: true
cache_size_mbs: 50
cache_log_enabled: true
disable_login: false
default_username: ""
auth_proxy_header_name: ""
plugin_update_interval_hours: 24
```

**New config options:**
- `proxy_allowed_domains` — Comma-separated domain allowlist for the streaming/image proxy. Empty = allow all (default).

### Library Structure

Place your `.cbz`/`.zip`/`.cbr`/`.rar` files in the library directory:

```
library/
├── Manga 1
│   ├── Volume 1.cbz
│   ├── Volume 2.cbz
│   └── Volume 3.zip
└── Manga 2
    └── Vol. 1
        └── Ch.1 - Ch.3
            ├── 1.zip
            ├── 2.zip
            └── 3.zip
```

## Anime Streaming

Browse at `/anime/browse` using the **"AnimeKai (via Middleware)"** plugin. Requires the anime middleware running on port 3456.

1. Select the plugin from the dropdown
2. Search for an anime title
3. Click a result → episodes load
4. Click an episode → save to library → watch with HLS player

The anime-middleware sits between Mango and external providers. It fetches metadata from AnimeKai and resolves HLS stream URLs through a MegaUp decrypt pipeline.

## Manga Search

Browse at `/manga` using the **"ComicK (Manga)"** or **"MangaDex (Manga)"** plugins.

1. Select a manga plugin
2. Search for a title
3. Click a result → chapters load
4. Click a chapter → read in-page

Manga pages are loaded directly from CDN. A proxy endpoint is available for CORS-restricted sources (`/api/manga/image_proxy`).

## Security

- **Login rate limiting**: 10 failed attempts per minute per IP (both form and API login)
- **Proxy allowlist**: Optional domain restriction for `/stream/proxy` and `/api/manga/image_proxy`
- **Docker hardening**: Non-root user, `no-new-privileges`, `cap_drop: ALL`, resource limits
- **Plugin sandbox**: Duktape JS engine isolates plugin code from the host
- **Session tokens**: Signed cookies with configurable `session_secret`

## Architecture

```
Browser ──→ Mango (Kemal/Crystal)
              │
              ├── /manga/* → Plugin JS → Middleware (Node.js) → MangaDex/ComicK API
              │
              ├── /anime/* → Plugin JS → Middleware (Node.js) → AnimeKai + MegaUp
              │
              └── /library/* → Local CBZ/ZIP/CBR files
```

The middleware (`anime-middleware/server.js`) is an Express server that proxies requests through `@consumet/extensions` to upstream providers.

## Tech Stack

- **Backend**: Crystal 1.16, Kemal web framework, SQLite3
- **Frontend**: Alpine.js v2, UIKit 3, hls.js
- **Plugins**: Duktape (embedded JS engine)
- **Middleware**: Node.js 22, Express, @consumet/extensions
- **Templates**: ECR (Embedded Crystal)

## License

MIT
