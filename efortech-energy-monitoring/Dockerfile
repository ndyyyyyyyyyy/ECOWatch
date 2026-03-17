FROM node:20-bookworm AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js eslint.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build


FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=4000

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential gcc unixodbc unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/python/requirements.txt ./backend/python/requirements.txt
RUN pip install --no-cache-dir -r backend/python/requirements.txt

COPY backend ./backend
COPY --from=frontend-builder /app/dist ./dist
COPY .env.example ./

EXPOSE 4000

CMD ["python", "backend/python/server.py"]
