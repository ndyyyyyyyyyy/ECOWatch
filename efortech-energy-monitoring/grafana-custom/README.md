# Grafana Custom

This folder contains the custom Grafana build used by the project.

## Purpose

- apply Efortech branding
- hide selected default Grafana UI elements
- add a `Back to portal` menu item
- provision PostgreSQL datasource
- bundle required plugins

## Folder layout

- `Dockerfile`
  Builds `efortech-grafana-custom` from `grafana/grafana:12.2.1`.
- `grafana.ini`
  Grafana server settings used by the custom image.
- `public/views/index.html`
  Main branding and DOM-level UI customization entry point.
- `provisioning/datasources/postgres-energy.yml`
  Default PostgreSQL datasource definition.
- `plugins/`
  Bundled Grafana plugins used by this deployment.

## What is customized

### Branding

In `public/views/index.html`:

- browser title is changed to `Efortech`
- loading label is changed from Grafana to Efortech
- visible `Grafana` text is replaced dynamically where possible

### Hidden UI elements

Also in `public/views/index.html`:

- Help button is hidden
- selected toolbar actions on the `/home` dashboard are hidden

### Back to portal

The same file injects a `Back to portal` item into the user menu and resolves the destination from:

```js
new URL('/portal', window.location.origin)
```

So the portal URL follows the current host automatically after the image is rebuilt and redeployed.

## Build locally

From this folder:

```bash
docker build -t efortech-grafana-custom .
```

To export the built image:

```bash
docker save -o efortech-grafana-custom.tar efortech-grafana-custom
```

## Restore on server

```bash
docker load -i efortech-grafana-custom.tar
```

Then recreate the Grafana container from compose.

## Important note

Editing files in this folder does not change the running Grafana container until the custom image is rebuilt and redeployed.
