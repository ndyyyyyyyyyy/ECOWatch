# ECOWatch

This repository contains the main application in [`efortech-energy-monitoring/`](./efortech-energy-monitoring).

Main documentation:
- [`efortech-energy-monitoring/README.md`](./efortech-energy-monitoring/README.md)
- [`efortech-energy-monitoring/grafana-custom/README.md`](./efortech-energy-monitoring/grafana-custom/README.md)

Main components:
- `efortech-energy-monitoring`: React frontend, FastAPI backend, project management UI, Ecowatch analytics, MQTT ingestion, PostgreSQL integration, and InfluxDB raw telemetry flow
- `efortech-energy-monitoring/nginx`: Public reverse proxy entrypoint for the app and `/grafana`
- `efortech-energy-monitoring/backend/workers`: Background workers for PostgreSQL analytics writes and InfluxDB raw writes
- `efortech-energy-monitoring/mosquitto`: Mosquitto broker configuration
- `efortech-energy-monitoring/grafana-custom`: Custom Grafana image, branding, and datasource provisioning
- `efortech-energy-monitoring/docker-compose.yml`: Deployment stack for nginx, backend, workers, PostgreSQL, InfluxDB, Mosquitto, Redis, and Grafana
