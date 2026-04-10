# Efortech Energy Monitoring

Web application for configuring energy devices, ingesting MQTT data, storing readings in PostgreSQL, visualizing analytics in Ecowatch, and exposing Grafana through the main app.

## Main services

- `efortech-energy-monitoring`
  React frontend + FastAPI backend in one app.
- `postgres`
  Stores energy readings in `energy_data`.
- `mosquitto`
  MQTT broker for realtime device payloads.
- `grafana`
  Custom-branded Grafana image built from `grafana-custom`, exposed directly on `3100` and proxied through `/grafana`.

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

## Configuration

Main environment files:

- `.env`
  Local/runtime defaults used outside containers and by compose variable substitution.
- `.env.docker`
  Environment injected into the main app container.

Important variables:

- `APP_HOST_PORT`
- `APP_PUBLIC_BASE_URL`
- `ALLOWED_SUBNET_CIDR`
- `ALLOWED_ORIGINS`
- `MQTT_BROKER_HOST`
- `MQTT_BROKER_PORT`
- `MQTT_TOPIC_FILTER`
- `ENERGY_PG_*`

Current network assumptions in this repo:

- app public IP: `192.168.10.101`
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
- the Grafana custom image is built from `grafana-custom/Dockerfile`
- no separate manual `docker build`, `docker save`, or `docker load` step is required for a fresh machine

Useful checks:

```bash
sudo docker compose logs -f efortech-energy-monitoring
sudo docker logs -f grafana
sudo docker logs -f mosquitto
sudo docker exec -it postgres psql -U postgres -d Energy -c "SELECT timestamp, device_name, tag_name, tag_address, value FROM energy_data ORDER BY timestamp DESC LIMIT 20;"
```

## Notes

- MQTT runtime matching currently depends mainly on `tag address`.
- MQTT device properties such as `IP Address`, `Username`, and `Password` are configuration metadata unless equivalent fields are present in the payload or enforced at broker level.
- Some Ecowatch pages still contain fallback logic for sparse comparison data.
- `grafana-custom` changes require rerunning `docker compose up -d --build` to rebuild the Grafana image.
