# UrbanScene (frontend)

Angular 19 SPA aligned with [urban-scene in k-tourist/demo-gis](https://github.com/k-tourist/demo-gis/tree/main/urban-scene): same routes, map, workspace, and **`SiteService`** REST usage against a **`/sites`** resource. **This repository contains only the web app**—no `server/`, no json-server scripts, and no bundled seed data. Run your API elsewhere (for example the `server/` + `npm run api` setup from that repo in a separate checkout or deploy).

## API expectations

- **Development (`ng serve`)**: `SiteService` calls `http://localhost:3001/sites` (same as the upstream app when json-server listens there with CORS). Ensure your backend matches json-server-style routes: `GET/POST /sites`, `GET/PATCH/DELETE /sites/:id`.
- **Production builds**: `SiteService` uses `src/environments/environment.ts` → `environment.apiBase` plus `/sites` (default `apiBase` is `/api`, so requests go to `/api/sites` on the app origin; change `apiBase` or use a reverse proxy as needed).

## Run the UI

```bash
npm start
```

Open `http://localhost:4200/` (map workspace) or `http://localhost:4200/dashboard` (fleet dashboard). If the API is not reachable, the app shows an error banner until requests succeed.

## Build

```bash
npm run build
```

Output: `dist/urban-scene`.

## Tests

```bash
npm test
```

## CLI

[Angular CLI documentation](https://angular.dev/tools/cli).
