const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'places.json');
const MEDIA_PATH = process.env.MEDIA_PATH || '/media/place/photo';
const PORT = process.env.PORT || 4025;

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
fs.mkdirSync(MEDIA_PATH, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

function loadPlaces() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function savePlaces(places) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(places, null, 2));
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/media/place/photo', express.static(MEDIA_PATH));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(MEDIA_PATH, req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

// --- Places ---

app.get('/api/places', (req, res) => {
  res.json(loadPlaces());
});

app.post('/api/places', (req, res) => {
  const { type, name, address, lat, lng, favorites } = req.body;
  if (!type || !name || lat == null || lng == null) {
    return res.status(400).json({ error: 'type, name, lat, and lng are required' });
  }
  if (!['restaurant', 'home', 'hotel'].includes(type)) {
    return res.status(400).json({ error: 'type must be restaurant, home, or hotel' });
  }
  let places = loadPlaces();
  // Home and hotel are singletons — adding a new one replaces the old.
  if (type === 'home' || type === 'hotel') {
    const old = places.find(p => p.type === type);
    if (old) {
      fs.rm(path.join(MEDIA_PATH, old.id), { recursive: true, force: true }, () => {});
    }
    places = places.filter(p => p.type !== type);
  }
  const place = {
    id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    type,
    name,
    address: address || '',
    lat: Number(lat),
    lng: Number(lng),
    favorites: Array.isArray(favorites) ? favorites.filter(Boolean) : [],
    photos: [],
    createdAt: new Date().toISOString()
  };
  places.push(place);
  savePlaces(places);
  res.json(place);
});

app.patch('/api/places/:id', (req, res) => {
  const places = loadPlaces();
  const p = places.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const { name, address, lat, lng, favorites } = req.body;
  if (name != null) p.name = name;
  if (address != null) p.address = address;
  if (lat != null) p.lat = Number(lat);
  if (lng != null) p.lng = Number(lng);
  if (favorites != null) p.favorites = favorites.filter(Boolean);
  savePlaces(places);
  res.json(p);
});

app.delete('/api/places/:id', (req, res) => {
  let places = loadPlaces();
  const p = places.find(x => x.id === req.params.id);
  places = places.filter(x => x.id !== req.params.id);
  savePlaces(places);
  if (p) {
    fs.rm(path.join(MEDIA_PATH, p.id), { recursive: true, force: true }, () => {});
  }
  res.json({ ok: true });
});

// --- Photos ---

app.post('/api/places/:id/photos', upload.array('photos', 10), (req, res) => {
  const places = loadPlaces();
  const p = places.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const files = (req.files || []).map(f => f.filename);
  p.photos.push(...files);
  savePlaces(places);
  res.json(p);
});

app.delete('/api/places/:id/photos/:filename', (req, res) => {
  const places = loadPlaces();
  const p = places.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  p.photos = p.photos.filter(f => f !== req.params.filename);
  savePlaces(places);
  fs.unlink(path.join(MEDIA_PATH, p.id, req.params.filename), () => {});
  res.json(p);
});

// --- Geocoding (OpenStreetMap Nominatim, no API key needed) ---

app.post('/api/geocode', async (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: 'address is required' });
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'family-restaurant-map/1.0' } });
    const data = await r.json();
    if (!data.length) return res.status(404).json({ error: 'Address not found' });
    res.json({
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      display_name: data[0].display_name
    });
  } catch (e) {
    res.status(500).json({ error: 'Geocoding request failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Family restaurant map running at http://localhost:${PORT}`);
  console.log(`Photos are stored under ${MEDIA_PATH}`);
});
