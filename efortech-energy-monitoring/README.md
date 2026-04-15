# Efortech Energy Monitoring

Web application for configuring energy devices, ingesting MQTT data, storing readings in PostgreSQL, visualizing analytics in Ecowatch, and exposing Grafana through the main app.

## Main services

- `backend`
  React frontend + FastAPI backend in one app, running as container `efortech-backend`.
- `postgres`
  Stores energy readings in `energy_data`.
- `mosquitto`
  MQTT broker for realtime device payloads.
- `grafana`
  Custom-branded Grafana image built from `grafana-custom`, exposed directly on `3000` and proxied through `/grafana`.

## Main features

- `Project`
  Configure devices and tags, deploy devices, monitor runtime match status, and persist configuration in `backend/data/project_store.json`.
- `Ecowatch`
  Analytics pages such as Area Usage, Demand, TOU Period, Energy Ranking, Energy Flow, Loss Analysis, Item Summary, and Annual Report.
- `Grafana`
  PostgreSQL datasource provisioning and custom branding through `grafana-custom`.

## Runtime flow

1. Devices publish MQTT payloads to the broker.
2. Backend subscribes to `MQTT_TOPIC_FILTER`.
3. Incoming payload items are matched to configured tags by `address`.
4. Valid numeric values are written to PostgreSQL table `energy_data`.
5. Ecowatch pages query backend endpoint `/energy`.
6. Grafana reads the same PostgreSQL database.

## Important backend files

- `backend/server.py`
  App startup and route registration.
- `backend/project_store.py`
  MQTT ingestion, device/tag runtime matching, deploy state, and persistence.
- `backend/energy_db.py`
  Database table creation, inserts, and energy reads.
- `backend/energy_routes.py`
  Legacy Ecowatch tree rollup for `/energy`.
- `backend/grafana_proxy.py`
  Auth proxy and websocket proxy for Grafana.
- `backend/middleware.py`
  Subnet and origin guards.
- `backend/security.py`
  Origin handling and allowed subnet parsing.

## Frontend structure

- `src/pages/project`
  Project UI, hooks, and components.
- `src/pages/ecowatch`
  Main Ecowatch pages.
- `src/pages/portal`
  Main launcher page for Project, Ecowatch, and Grafana.

## Infrastructure folders

- `mosquitto/`
  Mosquitto broker configuration mounted by Docker Compose.
- `grafana-custom/`
  Custom Grafana image, branding assets, and provisioning files.

## Configuration

Main environment files:

- `.env`
  Local/runtime defaults used outside containers and as an optional host-side compose helper.
- `.env.docker`
  Environment injected into the main app container.

Important variables:

- `ALLOWED_SUBNET_CIDR`
- `ALLOWED_ORIGINS`
- `MQTT_BROKER_HOST`
- `MQTT_BROKER_PORT`
- `MQTT_TOPIC_FILTER`
- `ENERGY_PG_*`

Optional variable:

- `APP_PUBLIC_BASE_URL`
  Only needed if you want to pin a single canonical public URL instead of relying on the incoming request host.

Gateway and access notes:

- `ALLOWED_SUBNET_CIDR`
  Accepts comma-separated IPv4 and IPv6 CIDR entries.
- For LAN-only deployments, use local ranges such as `192.168.10.0/24`.
- For reverse-proxy setups, include the trusted proxy subnet or IP if the app sees proxy peer addresses.
- For public domain deployments behind a trusted proxy or CDN, `0.0.0.0/0,::/0` allows all IPv4 and IPv6 clients at the app layer.
- `ALLOWED_ORIGINS`
  Must explicitly include non-IP browser origins such as `https://efortech-ems.wahyutech.my.id`.
- The backend reads `X-Forwarded-For`, `X-Real-IP`, and `Forwarded` when the immediate peer is a trusted local/private hop.

Current network assumptions in this repo:

- app public IP: `192.168.10.12`
- allowed client subnet: `192.168.10.0/24`

## Development

Install dependencies:

```bash
npm install
```

Run frontend/backend build:

```bash
npm run build
```

## Deploy with Docker Compose

```bash
sudo docker compose up -d --build --force-recreate
```

This repo is now self-contained for Docker deployment:

- the main app image is built from the root `Dockerfile`
- the Mosquitto config is mounted from `mosquitto/mosquitto.conf`
- the Grafana custom image is built from `grafana-custom/Dockerfile`
- the backend container reads runtime settings from `.env.docker`
- the backend host port is fixed to `4000:4000` in `docker-compose.yml`
- no separate manual `docker build`, `docker save`, or `docker load` step is required for a fresh machine

Useful checks:

```bash
sudo docker compose logs -f backend
sudo docker logs -f efortech-backend
sudo docker logs -f grafana
sudo docker logs -f mosquitto
sudo docker exec -it postgres psql -U postgres -d Energy -c "SELECT timestamp, device_name, tag_name, tag_address, value FROM energy_data ORDER BY timestamp DESC LIMIT 20;"
```

## Notes

- MQTT runtime matching currently depends mainly on `tag address`.
- MQTT device properties such as `IP Address`, `Username`, and `Password` are configuration metadata unless equivalent fields are present in the payload or enforced at broker level.
- Some Ecowatch pages still contain fallback logic for sparse comparison data.
- `grafana-custom` changes require rerunning `docker compose up -d --build` to rebuild the Grafana image.
