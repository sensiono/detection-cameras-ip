# Frontend — Angular dashboard

Supervision screen for the two roles of the cahier des charges. Talks only to the
Django API; it never knows a camera exists.

## Run

```bash
nvm use 20            # Angular 20 needs Node >= 20
npm install
npm start             # http://localhost:4200
npm test              # 4 specs, headless Chrome
npm run build
```

`proxy.conf.json` forwards `/api` and `/media` to `http://127.0.0.1:8000`, so there is
no CORS in development and no API base URL to configure per environment.

## Pages

| Route | What it shows |
|---|---|
| `/login` | JWT login |
| `/` | today's counters and the five latest alerts |
| `/attendance` | presences, filters, Excel/PDF export |
| `/logs` | gate passages with the plate crop that justified the decision |
| `/vehicles` | the authorisation list — admin writes, supervisor reads |
| `/alerts` | refused plates and unknown faces, with their snapshot |

## Structure

```
src/app/
  app.routes.ts     every route lazy: loadComponent, so a page is its own chunk
  app.config.ts     providers — HttpClient with the auth interceptor, zoneless
  core/
    api.ts          one typed service per endpoint group; the only place fetch happens
    auth.ts         signal-based session, HTTP interceptor, route guard
    models.ts       the API's shapes, mirroring backend/core/serializers.py
  pages/            one standalone component per route
```

`core/models.ts` is hand-written rather than generated. It is small enough that a
generator would be more machinery than the thing it generates, but it does mean an API
field rename must be applied twice — worth knowing before you rename one.

## Auth flow

```
/login ── POST /api/auth/login/ ── access + refresh
   │                                  │
   │                          localStorage (read once at startup,
   │                          so F5 does not log you out)
   │                                  │
   └── authInterceptor adds  Authorization: Bearer <access>  to every request
       authGuard redirects to /login when there is no token
```

The token lives in `localStorage`, which is readable by any script on the origin. That
is acceptable here because the dashboard has no third-party scripts and Angular escapes
interpolation by default — but it is a real trade-off, not a non-issue, and the report
should say so rather than claim the choice was free. The alternative (`HttpOnly` cookie
plus CSRF token) is more moving parts than this dashboard justifies.

## Choices worth defending in the report

**No UI framework.** The dashboard is tables, six tiles and one form. `src/styles.css`
is 90 lines and carries the dark theme for free via `prefers-color-scheme`. Adding
Material would have been more code, not less.

**No NgRx.** There is no client-side state to speak of: every page loads what it shows.
A store would add a second copy of the truth, and supervision numbers must be current
rather than consistent with a cache.

**Signals, standalone components, zoneless.** No `NgModule`, no Zone.js — each page is
a lazy chunk, and the whole app is 86 kB over the wire.

**The role check is duplicated on purpose.** `auth.canEdit` hides what
`IsSupervisorOrAdmin` would refuse anyway. The UI check is courtesy; the server one is
the security boundary. Never present the first as if it were the second.
