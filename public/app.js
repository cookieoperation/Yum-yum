let places = [];
let map;
let markers = [];

// --- Tabs ---

function switchTab(tab) {
  document.querySelectorAll('.md-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  if (tab === 'map') setTimeout(() => map.invalidateSize(), 50);
}

document.querySelectorAll('.md-tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.getElementById('places-back-btn').addEventListener('click', () => switchTab('map'));

document.getElementById('fab-add').addEventListener('click', () => openAddModal('restaurant'));

// --- Map setup ---

// --- Map setup ---

function initMap() {
  map = new maplibregl.Map({
    container: 'map',

    center: [-77.03, 38.9],
    zoom: 12,

    style: {
      version: 8,

      sources: {
        carto: {
          type: 'raster',

          tiles: [
            'https://{a-c}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
          ],

          tileSize: 256,

          attribution:
            '&copy; OpenStreetMap contributors &copy; CARTO'
        }
      },

      layers: [
        {
          id: 'carto-tiles',

          type: 'raster',

          source: 'carto',

          minzoom: 0,
          maxzoom: 19
        }
      ]
    }
  });

  // Navigation controls
  map.addControl(
    new maplibregl.NavigationControl(),
    'top-right'
  );
}

function iconFor(type) {
  const colors = { restaurant: '#1A73E8', home: '#1E8E3E', hotel: '#E37400' };
  const glyphs = { restaurant: 'restaurant', home: 'home', hotel: 'hotel' };
  return L.divIcon({
    className: 'place-marker',
    html: `<div style="
      background:${colors[type]};
      width:34px;height:34px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
      border:2px solid white;
    "><span class="material-symbols-rounded" style="transform:rotate(45deg);font-size:18px;color:white;">${glyphs[type]}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 32],
    popupAnchor: [0, -30]
  });
}

function renderMap() {
  markersLayer.clearLayers();
  const bounds = [];
  places.forEach(p => {
    const marker = L.marker([p.lat, p.lng], { icon: iconFor(p.type) });
    const favs = p.favorites.length
      ? `<p class="popup-favorites">${escapeHtml(p.favorites.join(', '))}</p>`
      : '';
    const photo = p.photos[0]
      ? `<img src="/media/place/photo/${p.id}/${p.photos[0]}" style="width:100%;border-radius:3px;margin-top:0.4rem;max-height:120px;object-fit:cover;">`
      : '';
    marker.bindPopup(`<div class="popup-title">${escapeHtml(p.name)}</div>${favs}${photo}`);
    marker.addTo(markersLayer);
    bounds.push([p.lat, p.lng]);
  });
  if (bounds.length) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }
}

// --- Data loading ---

async function loadPlaces() {
  const res = await fetch('/api/places');
  places = await res.json();
  renderMap();
  renderPlacesList();
}

// --- Places list (Places tab) ---

function renderPlacesList() {
  const container = document.getElementById('places-list');
  const restaurants = places.filter(p => p.type === 'restaurant')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const home = places.find(p => p.type === 'home');
  const hotel = places.find(p => p.type === 'hotel');

  container.innerHTML = '';

  [home, hotel].filter(Boolean).forEach(p => container.appendChild(renderPlaceCard(p, false)));

  if (!restaurants.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `<div class="stamp">No restaurants yet</div><p>Add the first one your family loved.</p>`;
    container.appendChild(empty);
  } else {
    restaurants.forEach(p => container.appendChild(renderPlaceCard(p, true)));
  }
}

function renderPlaceCard(p, withFavorites) {
  const card = document.createElement('div');
  card.className = 'place-card';

  const badge = p.type === 'restaurant' ? '' :
    `<span class="place-badge ${p.type}">${p.type}</span><br>`;

  card.innerHTML = `
    <div class="place-card-head">
      <div>
        ${badge}
        <h3 class="place-name">${escapeHtml(p.name)}</h3>
        ${p.address ? `<p class="place-address">${escapeHtml(p.address)}</p>` : ''}
      </div>
      <div class="place-actions">
        <button class="icon-btn edit-btn" aria-label="Edit"><span class="material-symbols-rounded">edit</span></button>
        <button class="icon-btn icon-btn-danger delete-btn" aria-label="Delete"><span class="material-symbols-rounded">delete</span></button>
      </div>
    </div>
  `;

  if (withFavorites) {
    const favSection = document.createElement('div');
    favSection.className = 'favorites-section';
    favSection.innerHTML = `<p class="favorites-label">Family favorites</p>`;

    const tags = document.createElement('div');
    tags.className = 'favorites-tags';
    p.favorites.forEach(f => {
      const tag = document.createElement('span');
      tag.className = 'favorite-tag';
      tag.innerHTML = `${escapeHtml(f)} <button data-fav="${escapeHtml(f)}"><span class="material-symbols-rounded">close</span></button>`;
      tag.querySelector('button').addEventListener('click', () => removeFavorite(p.id, f));
      tags.appendChild(tag);
    });
    favSection.appendChild(tags);

    const addRow = document.createElement('div');
    addRow.className = 'add-favorite-row';
    addRow.innerHTML = `<input type="text" placeholder="Add a dish they loved" />
      <button class="btn btn-quiet">Add</button>`;
    const input = addRow.querySelector('input');
    const addBtn = addRow.querySelector('button');
    const submit = () => {
      if (input.value.trim()) {
        addFavorite(p.id, input.value.trim());
        input.value = '';
      }
    };
    addBtn.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    favSection.appendChild(addRow);

    const photoGrid = document.createElement('div');
    photoGrid.className = 'photo-grid';
    p.photos.forEach(filename => {
      const thumb = document.createElement('div');
      thumb.className = 'photo-thumb';
      thumb.innerHTML = `<img src="/media/place/photo/${p.id}/${filename}" alt="${escapeHtml(p.name)} photo">
        <button class="remove-photo"><span class="material-symbols-rounded">close</span></button>`;
      thumb.querySelector('img').addEventListener('click', () => openLightbox(`/media/place/photo/${p.id}/${filename}`));
      thumb.querySelector('.remove-photo').addEventListener('click', () => removePhoto(p.id, filename));
      photoGrid.appendChild(thumb);
    });
    const uploadLabel = document.createElement('label');
    uploadLabel.className = 'photo-upload-label';
    uploadLabel.innerHTML = `<span class="material-symbols-rounded">add_a_photo</span><input type="file" accept="image/*" multiple hidden>`;
    uploadLabel.querySelector('input').addEventListener('change', e => uploadPhotos(p.id, e.target.files));
    photoGrid.appendChild(uploadLabel);
    favSection.appendChild(photoGrid);

    card.appendChild(favSection);
  }

  card.querySelector('.edit-btn').addEventListener('click', () => openEditModal(p));
  card.querySelector('.delete-btn').addEventListener('click', () => deletePlace(p));

  return card;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Actions ---

async function addFavorite(id, item) {
  const p = places.find(x => x.id === id);
  const favorites = [...p.favorites, item];
  await fetch(`/api/places/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ favorites })
  });
  await loadPlaces();
}

async function removeFavorite(id, item) {
  const p = places.find(x => x.id === id);
  const favorites = p.favorites.filter(f => f !== item);
  await fetch(`/api/places/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ favorites })
  });
  await loadPlaces();
}

async function uploadPhotos(id, fileList) {
  const formData = new FormData();
  Array.from(fileList).forEach(f => formData.append('photos', f));
  await fetch(`/api/places/${id}/photos`, { method: 'POST', body: formData });
  await loadPlaces();
}

async function removePhoto(id, filename) {
  await fetch(`/api/places/${id}/photos/${encodeURIComponent(filename)}`, { method: 'DELETE' });
  await loadPlaces();
}

async function deletePlace(p) {
  if (!confirm(`Remove ${p.name}? This deletes its photos too.`)) return;
  await fetch(`/api/places/${p.id}`, { method: 'DELETE' });
  await loadPlaces();
}

function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.remove('hidden');
}
document.getElementById('lightbox').addEventListener('click', () => {
  document.getElementById('lightbox').classList.add('hidden');
});

// --- Modal: add / edit place ---

const backdrop = document.getElementById('modal-backdrop');
const modalContent = document.getElementById('modal-content');
document.getElementById('modal-close').addEventListener('click', closeModal);
backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

function closeModal() {
  backdrop.classList.add('hidden');
  modalContent.innerHTML = '';
}

function openAddModal(type) {
  const titles = { restaurant: 'Add a restaurant', home: 'Set home location', hotel: 'Set hotel location' };
  modalContent.innerHTML = `
    <h2>${titles[type]}</h2>
    <form id="place-form">
      <div class="field">
        <label>Name</label>
        <input type="text" name="name" required placeholder="${type === 'restaurant' ? "e.g. Luigi's Trattoria" : type === 'home' ? 'Home' : 'Hotel name'}">
      </div>
      <div class="geocode-row">
        <div class="field">
          <label>Address</label>
          <input type="text" name="address" placeholder="Street, city, state">
        </div>
        <button type="button" class="btn btn-quiet" id="lookup-btn">Look up</button>
      </div>
      <p class="hint" id="geocode-hint">We'll turn the address into map coordinates.</p>
      <div class="field-row">
        <div class="field">
          <label>Latitude</label>
          <input type="text" name="lat" id="lat-input" required>
        </div>
        <div class="field">
          <label>Longitude</label>
          <input type="text" name="lng" id="lng-input" required>
        </div>
      </div>
      ${type === 'restaurant' ? `
      <div class="field">
        <label>Family favorites (comma separated)</label>
        <input type="text" name="favorites" placeholder="Carbonara, tiramisu">
      </div>` : ''}
      <div class="modal-actions">
        <button type="button" class="btn btn-quiet" id="cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>
  `;
  backdrop.classList.remove('hidden');

  document.getElementById('cancel-btn').addEventListener('click', closeModal);
  document.getElementById('lookup-btn').addEventListener('click', async () => {
    const address = modalContent.querySelector('[name="address"]').value.trim();
    const hint = document.getElementById('geocode-hint');
    if (!address) { hint.textContent = 'Type an address first.'; hint.className = 'hint error'; return; }
    hint.textContent = 'Looking up…';
    hint.className = 'hint';
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      document.getElementById('lat-input').value = data.lat.toFixed(6);
      document.getElementById('lng-input').value = data.lng.toFixed(6);
      hint.textContent = `Found: ${data.display_name}`;
      hint.className = 'hint success';
    } catch {
      hint.textContent = "Couldn't find that address — enter coordinates directly instead.";
      hint.className = 'hint error';
    }
  });

  document.getElementById('place-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const favorites = type === 'restaurant'
      ? (fd.get('favorites') || '').split(',').map(s => s.trim()).filter(Boolean)
      : [];
    await fetch('/api/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        name: fd.get('name'),
        address: fd.get('address'),
        lat: fd.get('lat'),
        lng: fd.get('lng'),
        favorites
      })
    });
    closeModal();
    await loadPlaces();
  });
}

function openEditModal(p) {
  modalContent.innerHTML = `
    <h2>Edit ${p.type === 'restaurant' ? 'restaurant' : p.type}</h2>
    <form id="edit-form">
      <div class="field">
        <label>Name</label>
        <input type="text" name="name" required value="${escapeHtml(p.name)}">
      </div>
      <div class="field">
        <label>Address</label>
        <input type="text" name="address" value="${escapeHtml(p.address || '')}">
      </div>
      <div class="field-row">
        <div class="field">
          <label>Latitude</label>
          <input type="text" name="lat" required value="${p.lat}">
        </div>
        <div class="field">
          <label>Longitude</label>
          <input type="text" name="lng" required value="${p.lng}">
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-quiet" id="cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>
  `;
  backdrop.classList.remove('hidden');
  document.getElementById('cancel-btn').addEventListener('click', closeModal);
  document.getElementById('edit-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await fetch(`/api/places/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fd.get('name'), address: fd.get('address'),
        lat: fd.get('lat'), lng: fd.get('lng')
      })
    });
    closeModal();
    await loadPlaces();
  });
}

document.getElementById('add-restaurant-btn').addEventListener('click', () => openAddModal('restaurant'));
document.getElementById('set-home-btn').addEventListener('click', () => openAddModal('home'));
document.getElementById('set-hotel-btn').addEventListener('click', () => openAddModal('hotel'));

// --- Init ---

initMap();
loadPlaces();
