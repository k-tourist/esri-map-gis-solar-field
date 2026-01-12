# UrbanScene

Angular 19 app for planning and viewing solar sites on a 3D map ([ArcGIS Maps SDK for JavaScript](https://developers.arcgis.com/javascript/latest/)). Site data is loaded from an in-memory catalog seeded from `src/app/data/db.json` (no separate backend).

## Development

```bash
npm start
```

Open `http://localhost:4200/` for the map workspace (proposals, installations, footer actions) or `http://localhost:4200/dashboard` for the read-only fleet dashboard.

## Build

```bash
npm run build
```

Output is under `dist/urban-scene`.

## Tests

```bash
npm test
```

## CLI

See [Angular CLI documentation](https://angular.dev/tools/cli).
