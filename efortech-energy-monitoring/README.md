# Efortech Energy Monitoring

Frontend berjalan dengan Vite React, backend memakai FastAPI.

## Menjalankan project

```bash
npm install
python -m pip install -r backend/python/requirements.txt
npm run dev
npm run backend
```

Backend default ada di `http://localhost:4000`.

## Konfigurasi PostgreSQL untuk Energy API

Endpoint `/energy` sekarang membaca data dari PostgreSQL. Konfigurasi minimum di `.env`:

```env
ENERGY_PG_HOST=192.168.1.101
ENERGY_PG_PORT=5432
ENERGY_PG_DATABASE=modbus
ENERGY_PG_USER=postgres
ENERGY_PG_PASSWORD=postgres
```

Backend mengharapkan tabel `"SensorData"` dengan kolom:
- `"RegisterAddressText"`
- `"Value"`
- `"Timestamp"`

## Menjalankan dengan Docker

Project ini juga bisa dijalankan dalam satu container: frontend dibuild saat image dibuat, lalu diserve oleh backend FastAPI.

```bash
cp .env.example .env
docker compose up -d --build
```

App akan tersedia di `http://localhost:4000`.

Untuk deploy awal `app-only`, gunakan nilai berikut di `.env`:

```env
AUTH_MODE=local
LOCAL_AUTH_USERNAME=admin
LOCAL_AUTH_PASSWORD=admin123
GRAFANA_TARGET=http://grafana:3000
ALLOWED_SUBNET_CIDR=192.168.1.0/24
ALLOWED_ORIGINS=http://192.168.1.101:4000,http://localhost:4000,http://127.0.0.1:4000
MQTT_ENABLED=false
```

Catatan:
- mode ini tidak bergantung pada Grafana dan MQTT untuk startup awal container
- route/proxy Grafana baru akan dipakai setelah `GRAFANA_TARGET` diarahkan ke service Grafana yang aktif
- jika nanti MQTT dan Grafana sudah siap di Docker Compose, update `.env` lalu rebuild container app

## Menjalankan dengan Grafana

`docker-compose.yml` sekarang juga menyiapkan service `grafana`. App akan mem-proxy Grafana ke path `/grafana` melalui `GRAFANA_TARGET=http://grafana:3000`.

Service ini dibuild dari folder [grafana-custom/Dockerfile](/d:/KerjaPraktek/Projek/Project%20Home/efortech-energy-monitoring/grafana-custom/Dockerfile) dan memakai aset custom:
- [grafana-custom/grafana.ini](/d:/KerjaPraktek/Projek/Project%20Home/efortech-energy-monitoring/grafana-custom/grafana.ini)
- [grafana-custom/public](/d:/KerjaPraktek/Projek/Project%20Home/efortech-energy-monitoring/grafana-custom/public)
- [grafana-custom/plugins](/d:/KerjaPraktek/Projek/Project%20Home/efortech-energy-monitoring/grafana-custom/plugins)

Setelah update file di server, jalankan:

```bash
docker compose up -d --build
```

Lalu akses dashboard dari app:

```text
http://192.168.1.101:4000/grafana/
```

Untuk melihat log:

```bash
docker compose logs -f
```

Untuk stop:

```bash
docker compose down
```

## Integrasi MQTT untuk halaman Project

Project page sekarang bisa mengambil data dari backend MQTT.

Konfigurasi minimum di `.env`:

```env
MQTT_ENABLED=true
MQTT_BROKER_HOST=127.0.0.1
MQTT_BROKER_PORT=1883
MQTT_TOPIC_FILTER=devices/+
```

Format topic default yang diharapkan:

```text
devices/{deviceName}
```

Payload MQTT yang direkomendasikan untuk mengikuti UI project:

```json
{
  "device": {
    "device_type": "Modicon",
    "primary_ip": "192.168.1.10",
    "primary_port": "502",
    "device_address": "1"
  },
  "tag": {
    "address": "40001"
  },
  "telemetry": {
    "value": 12.5,
    "timestamp": "2026-03-16T10:15:00"
  }
}
```

Catatan validasi:
- device hanya divalidasi dengan `device_type`, `primary_ip`, `primary_port`, `device_address`
- tag hanya divalidasi dengan `address`
- field UI lain tetap boleh diisi custom oleh user dan tidak ikut menentukan match/mismatch

Catatan:
- Jika backend belum terhubung ke broker atau belum ada message masuk, frontend tetap fallback ke dummy/local data.
- Saat source data berasal dari MQTT, halaman Project dan Tag Management dibuat read-only karena device/tag dibentuk dari topic yang disubscribe.
