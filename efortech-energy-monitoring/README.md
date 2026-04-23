# Efortech Energy Monitoring

Web application for configuring energy devices, ingesting MQTT data, storing readings in PostgreSQL, visualizing analytics in Ecowatch, and exposing Grafana behind nginx.

## Main services

- `nginx`
  Main entrypoint on port `4000`, routing app traffic to `backend` and `/grafana` directly to `grafana`.
- `backend`
  React frontend + FastAPI backend in one app, running as container `efortech-backend` behind nginx.
- `postgres`
  Stores project configuration, Ecowatch analytics data, area tree, TOU config, and usage targets.
- `influxdb`
  Stores realtime raw telemetry for Grafana through InfluxQL.
- `mosquitto`
  MQTT broker for realtime device payloads.
- `grafana`
  Custom-branded Grafana image built from `grafana-custom`, served internally on `3000` and exposed to users through nginx path `/grafana`.

## Main features

- `Project`
  Configure devices and tags, deploy devices, monitor runtime match status, and persist configuration in PostgreSQL.
- `Ecowatch`
  Analytics pages such as Area Usage, Demand, TOU Period, Energy Ranking, Energy Flow, Loss Analysis, Item Summary, and Annual Report.
- `Grafana`
  InfluxDB datasource provisioning plus custom branding through `grafana-custom`.

## Runtime flow

1. Devices publish MQTT payloads to the broker.
2. Backend subscribes to the exact MQTT topic configured per device.
3. Incoming payload items are matched to configured devices by broker session, exact topic, and tag `address`.
4. Valid raw numeric values are written to InfluxDB measurement `energy_meter_raw`.
5. Energy-analysis tags are written into the Ecowatch PostgreSQL schema (`devices`, `tag_configs`, `logs`, and `mqtt_messages`).
6. Ecowatch pages query backend endpoint `/energy`.
7. nginx protects `/grafana` using the backend session cookie and forwards authenticated requests directly to Grafana.
8. Grafana reads realtime raw telemetry from InfluxDB.

## Backend structure

- `backend/server.py`
  App startup and route registration.
- `backend/api/`
  Route modules for auth, project, and Ecowatch energy endpoints.
- `backend/core/`
  Runtime configuration, middleware, HTTP client, and security helpers.
- `backend/project/`
  MQTT ingestion, broker sessions, matching, heartbeat state, and project persistence.
- `backend/queues/`
  Redis Streams queue producers and metrics for analysis and raw telemetry.
- `backend/storage/`
  PostgreSQL and InfluxDB storage adapters.
- `backend/workers/`
  Consumer workers for PostgreSQL analysis and InfluxDB raw ingestion.

## Frontend structure

- `src/pages/project`
  Project UI, hooks, and components.
- `src/pages/ecowatch`
  Main Ecowatch pages.
- `src/pages/portal`
  Main launcher page for Project, Ecowatch, and Grafana.

## Infrastructure folders

- `nginx/`
  Reverse-proxy configuration used as the public entrypoint.
- `mosquitto/`
  Mosquitto broker configuration mounted by Docker Compose.
- `grafana-custom/`
  Custom Grafana image, branding assets, and provisioning files.

## Configuration

Main environment files:

- `.env.docker`
  Docker runtime configuration used by `backend`, both workers, `mosquitto`, `postgres`, `influxdb`, and `grafana`.

Important variables:

- `ALLOWED_SUBNET_CIDR`
- `ALLOWED_ORIGINS`
- `MQTT_BROKER_HOST`
- `MQTT_BROKER_PORT`
- `ENERGY_PG_*`
- `INFLUX_*`
- `POSTGRES_*`
- `INFLUXDB_*`
- `GF_SECURITY_ADMIN_*`

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

Example network assumptions:

- app public IP: `192.168.10.12`
- allowed client subnet: `192.168.10.0/24`

Adjust those values for the actual server or proxy environment where you deploy this stack.

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

- nginx is the public entrypoint on host port `4000`
- the main app image is built from the root `Dockerfile`
- the Mosquitto config is mounted from `mosquitto/mosquitto.conf`
- the Grafana custom image is built from `grafana-custom/Dockerfile`
- backend, workers, mosquitto, postgres, influxdb, and grafana all read runtime settings from `.env.docker`
- the backend is only exposed inside the Docker network
- Grafana is accessed through `http://HOST:4000/grafana/`
- Grafana host port is not published; direct access is intentionally disabled
- no separate manual `docker build`, `docker save`, or `docker load` step is required for a fresh machine

Useful checks:

```bash
sudo docker compose logs -f nginx
sudo docker compose logs -f backend
sudo docker logs -f efortech-backend
sudo docker logs -f grafana
sudo docker logs -f mosquitto
sudo docker logs -f influxdb
sudo docker exec -it postgres psql -U postgres -d Energy -c "SELECT device_id, payload_tag, value, ts_sensor FROM logs ORDER BY ts_sensor DESC LIMIT 20;"
```

## Notes

- MQTT runtime matching depends on broker session config, exact topic, and `tag address`.
- MQTT device properties `IP Address`, `Port Number`, `Username`, and `Password` are enforced through the active broker session.
- Project configuration is persisted in PostgreSQL tables `project_devices` and `project_tags`.
- Ecowatch analytics data is persisted in PostgreSQL tables such as `devices`, `tag_configs`, `logs`, `area_nodes`, and `area_tag_assignments`.
- Legacy Ecowatch April simulation data is not seeded automatically on startup. If you want the legacy demo tree to show values on a fresh deployment, run:

```bash
sudo docker exec -w /app/backend efortech-backend python -m scripts.seed_legacy_ecowatch_april
```

- `grafana-custom` changes require rerunning `docker compose up -d --build` to rebuild the Grafana image.
