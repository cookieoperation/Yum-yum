# Our Table

A private family restaurant journal: the dishes you loved, photos you took, and a map
that shows nothing but your own pins — the restaurants, your home, and (when you're
traveling) your hotel. No public reviews, no other businesses cluttering the map.

## What it does

- **Map tab** — a plain, label-free basemap with only the pins you've added. Restaurant
  pins are brass, home is olive, hotel is red. Tap a pin to see the favorites and a photo.
- **Places tab** — a card per place. For restaurants: add the dishes your family loved as
  tags, and upload photos straight from your phone or computer.
- Photos are saved to disk under `/media/place/photo/<place-id>/`, so they persist across
  restarts and container rebuilds.
- Addresses are turned into coordinates using OpenStreetMap's free Nominatim lookup —
  or you can type latitude/longitude directly if you already know them.

## Running it

### With Docker (recommended)

```bash
docker compose up -d --build
```

This starts the app on **http://localhost:4025**, storing photos in `./media` and the
places list in `./data/places.json` on the host, both of which survive rebuilds.

To change the port, edit the `ports:` line in `docker-compose.yml` (left side is the
host port).

### Without Docker

Requires Node.js 18+.

```bash
npm install
MEDIA_PATH=/media/place/photo PORT=4025 npm start
```

If you don't set `MEDIA_PATH`, it defaults to `/media/place/photo` on the host — make
sure that directory is writable by whatever user runs the process, or point it
somewhere it can write:

```bash
MEDIA_PATH=./media npm start
```

## Reverse proxy / HA integration

Since you're already running Home Assistant, you can expose this the same way you
expose other local services — e.g. an Nginx Proxy Manager or Caddy entry pointing at
`http://<host>:4025`, or add it as an iframe panel in HA's dashboard if you just want
quick access from the same interface.

## Data

- `data/places.json` — all restaurants, home, and hotel entries (name, address,
  coordinates, favorite dishes, and a list of photo filenames).
- `media/<place-id>/<file>` — the actual uploaded photos, one folder per place.

Back up both folders together if you want to preserve everything.
