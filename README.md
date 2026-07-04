# Mini Activity Analytics Platform

This repository implements a small ActivTrak-style platform with three main parts:

1. A visible Windows desktop agent
2. A backend ingestion and analytics API
3. A web dashboard
4. A Chrome browser extension for active-tab tracking

The current production architecture is:

- desktop agent: `Rust + Tauri + React`
- browser extension: `Chrome Extension Manifest V3`
- backend API: `NestJS`
- server database: `PostgreSQL`
- offline local agent database: `SQLite`
- frontend architecture: `React + atomic design + shadcn-style primitives`

The agent is intentionally visible and user-controlled. It supports explicit `Start`, `Pause`, and `Stop` actions, tracks active vs idle time, stores events locally when offline, and syncs them automatically when connectivity returns.

## Workspace Layout

- `apps/agent`
  Supported desktop agent. Tauri desktop shell, Rust runtime, React UI.
- `apps/backend`
  NestJS backend API and PostgreSQL analytics access layer.
- `apps/browser-extension`
  Chrome extension that tracks active tabs/domains and syncs browser activity to the backend.
- `apps/dashboard`
  React dashboard for analytics and device views.
- `packages/shared`
  Shared TypeScript payload and response contracts used by the agent, backend, and dashboard.
- `apps/shared-ui`
  Shared frontend component workspace for both desktop and web frontends, organized with atomic design.
- `docs/adr/0001-platform-architecture.md`
  Architecture decision record, tradeoffs, diagrams, and microfrontend target design.

## Shared Package Split

The repository now has two different kinds of shared packages:

- `packages/shared`
  Domain-level TypeScript contracts only. This package exports shared payloads and response types such as `ActivityEventPayload`, `HeartbeatPayload`, `DashboardSummary`, `DeviceStatus`, and `DeviceDetail`.
- `apps/shared-ui`
  Reusable frontend UI components only. This package contains the atomic-design UI layer shared by the desktop agent frontend and the web dashboard, including atoms, molecules, and templates.

In short:

- `packages/shared` = shared data shapes
- `apps/shared-ui` = shared React UI

## What The Platform Does

The platform collects lightweight activity telemetry only:

- foreground application name
- active browser tab domain and URL when captured by the extension
- current window title when available
- active vs idle state
- timestamps and slice durations
- device identifier and device name
- heartbeat status for current presence

It does not implement:

- keylogging
- browser history import
- hidden or stealth tracking
- camera or microphone access

## Key Enhancements Implemented

- Explicit `Start`, `Pause`, and `Stop` controls in the desktop agent
- Real-time tracked session timer in the desktop UI
- Local SQLite outbox in the agent when backend or internet is unavailable
- Automatic replay from SQLite to the backend through `POST /api/agent/sync`
- Configurable backend API URL in the agent
- Optional API token authentication across the dashboard, desktop agent, and browser extension
- Excluded application masking in the agent
- Browser extension support for active tab/domain tracking with offline queueing
- Idle-aware sessionization for desktop and browser activity
- Productive / neutral / unproductive classification rules
- NestJS backend migration
- PostgreSQL-backed analytics
- Docker Compose support for backend, dashboard, and database
- Preset and custom date range filtering in the dashboard
- Device detail page flow in the dashboard
- Live "active now" device panel in the dashboard
- Browser privacy controls for excluded domains and tracking schedules
- Atomic design + shadcn-style component structure in both frontends


## API Endpoints

- `GET /health`
- `POST /api/activity`
- `POST /api/activity/bulk`
- `POST /api/heartbeat`
- `POST /api/heartbeat/bulk`
- `POST /api/agent/sync`
- `GET /api/dashboard/summary?days=1`
- `GET /api/dashboard/devices?days=1`
- `GET /api/dashboard/recent-activity?days=1&limit=12`
- `GET /api/dashboard/top-apps?days=1&limit=6`
- `GET /api/dashboard/timeline?days=1`
- `GET /api/dashboard/device/:deviceId?days=1`
- `GET /api/classification-rules`
- `PUT /api/classification-rules`

## Local Development

### Prerequisites

- Node.js 22+
- `pnpm` 11+
- Rust toolchain with Cargo
- Windows 10 or 11 for the desktop agent
- Microsoft Edge WebView2 runtime
  Usually already present on current Windows installs
- PostgreSQL if you are not using Docker

## Docker

The desktop agent is intentionally not containerized because it depends on local Windows desktop APIs and a visible local UI.

Docker is provided for:

- PostgreSQL
- NestJS backend
- React dashboard

Start the stack:

```bash
docker compose up --build
```

This is the easiest way to run the server-side application locally because the database, backend, and dashboard are already defined in Docker.

Verified in this workspace:

- `docker compose build backend dashboard`

Default service URLs:

- dashboard: `http://localhost:8080`
- backend: `http://localhost:4000`
- PostgreSQL: `localhost:5432`
- desktop agent backend target: `http://localhost:4000`
- browser extension backend target: `http://localhost:4000`

Default database credentials from `docker-compose.yml`:

- database: `activity_analytics`
- user: `postgres`
- password: `postgres`

Stop the stack:

```bash
docker compose down
```

Stop and remove database volume too:

```bash
docker compose down -v
```

## Desktop Agent

The desktop agent still runs natively on Windows because it depends on local desktop APIs, Tauri, and a visible app window.

Run it separately from Docker:

```bash
pnpm dev:agent
```

This starts the Tauri desktop shell and its React UI dev server.

To generate the packaged Tauri Windows executable and installer artifacts:

```bash
pnpm run build:tauri
```

This runs Tauri's production bundle flow and emits release output under the Tauri build directories.

## Browser Extension

The browser extension lives in `apps/browser-extension`.

Load it in Chrome or Edge using:

1. Open `chrome://extensions` or `edge://extensions`
2. Enable Developer Mode
3. Choose `Load unpacked`
4. Select `apps/browser-extension`

The extension supports:

- active tab and domain tracking
- idle-aware browser sessionization
- offline queueing and backend sync
- optional API token auth
- excluded domains
- tracking schedules and weekdays-only windows

## Validation

Use these commands to check whether the codebase builds cleanly and whether the shared frontend components can be rendered without runtime import/render failures.

### Validate Backend

```bash
pnpm run validate:backend
```

This validates:

- shared API/data contracts in `packages/shared`
- backend TypeScript compilation in `apps/backend`

### Validate Frontend

```bash
pnpm run validate:frontend
```

This validates:

- shared UI package build in `apps/shared-ui`
- browser extension script syntax
- shared UI runtime smoke rendering
- dashboard production build
- agent web frontend build

### Validate Everything

```bash
pnpm run validate
```

### Build Everything

```bash
pnpm build
```

This builds:

- shared contracts package
- shared UI package
- backend
- browser extension assets remain source-based and unpacked
- dashboard
- Tauri agent frontend
- Rust desktop runtime

## Environment Variables

### Backend

- `PORT`
  Overrides the backend port.
- `DATABASE_URL`
  Overrides the PostgreSQL connection string.
- `API_TOKEN`
  Enables bearer-token protection for all backend routes except `GET /health`.

### Dashboard

- `VITE_API_URL`
  Overrides the backend base URL used by the dashboard.

### Agent

- `API_URL`
  Optional default backend URL if you extend the runtime config flow further.
  The current app also allows API URL changes directly from the desktop settings UI.

## Dashboard Features

The dashboard currently supports:

- preset date ranges for 24 hours, 7 days, and 30 days
- custom `from` / `to` date filtering
- device detail page flow by selected device ID
- recent activity feed
- top applications by tracked time
- live "active now" panel based on recent heartbeats
- productivity time rollups for productive, neutral, and unproductive activity

## Offline Sync Behavior

When the backend is unreachable:

- activity and heartbeat payloads are written into the agent-local SQLite outbox
- the desktop UI continues to show status and pending queue count
- the runtime keeps retrying automatically
- once connectivity returns, the agent calls `POST /api/agent/sync`
- synced items are removed from the local SQLite queue

The local SQLite database lives under the user's local app data directory for the Tauri agent runtime.

## Security and Privacy Notes

- the desktop agent is visible to the user
- tracking can be started, paused, and stopped explicitly
- excluded applications can be masked
- browser tracking can be disabled, domain-filtered, or constrained to a schedule
- optional bearer-token auth can be enabled at the backend
- the platform collects foreground-app metadata, not keystrokes
- offline storage is local SQLite only and is replayed through explicit backend APIs

## Current Limitations

- the desktop agent currently targets Windows
- the dashboard still uses polling rather than WebSockets or SSE
- the backend currently supports bearer tokens rather than a fuller auth/user model
- privacy controls are still local configuration rather than centrally managed policies
- the dashboard production bundle shows a chunk-size warning due to the current charting dependency

## Suggested Next Improvements

- add a real user/session auth model
- add a dashboard UI for managing productivity rules
- add centrally managed privacy policies and agent enrollment
- add push-based real-time updates
- split the dashboard into runtime microfrontends if product scope grows enough to justify it

## ADR

Architecture rationale, diagrams, tradeoffs, and the microfrontend target design are documented in:

- `docs/adr/0001-platform-architecture.md`
