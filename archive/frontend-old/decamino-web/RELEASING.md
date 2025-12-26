## Releasing (Web + Mobile scaffolding)

This repository is a Vite web app. Mobile (Android/iOS) pipelines are scaffolded for future use without affecting the web build.

### Versioning
- Bump version: `npm run version:bump` (or use `minor`/`major`)
- Generate changelog section: `npm run release:notes`

### Preflight
- Run basic checks: `npm run preflight`

### Web build
- `npx vite build`

### Mobile (future)
- Scripts and CI are prepared but do not modify web build. Configure Fastlane/EAS only after adding native projects.


