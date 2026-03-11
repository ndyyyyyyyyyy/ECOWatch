# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## ECOWatch (Option 2)

ECOWatch has been merged into the main frontend app and now runs with the same router/session flow.

- Portal route: `/portal`
- ECOWatch routes: `/ecowatch/*` (default to `/ecowatch/area-usage`)

Portal button `ECOWatch` can still be overridden with `VITE_ECOWATCH_URL` (default: `/ecowatch/area-usage`).

Run from repo root:

1. `npm install`
2. `npm run build`
3. `npm run backend` (Python backend)

## Auth Mode

Python backend login mode can be controlled via env `AUTH_MODE`:

- `AUTH_MODE=hybrid` (default): try Grafana auth first, fallback to local login if Grafana is unreachable.
- `AUTH_MODE=grafana`: strict Grafana-only login.
- `AUTH_MODE=local`: local login only (for ECOWatch development without Grafana setup).
- In `hybrid`, local credential `admin/admin123` is also accepted directly.

Default local auth credentials:

- Username: `admin`
- Password: `admin123`
