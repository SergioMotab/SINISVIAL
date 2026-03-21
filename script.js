'use strict';

// ===== MAPA =====
const mapEl = document.getElementById('map');
mapEl.style.height = "calc(100vh - 64px)";

const map = L.map('map').setView([4.6097, -74.0817], 12);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

window.addEventListener('load', () => {
  setTimeout(() => map.invalidateSize(), 200);
});

// ===== GEOCODER =====
const geocoderControl = L.Control.geocoder({
  defaultMarkGeocode: false
}).on('markgeocode', function(e) {

  const center = e.geocode.center;

  map.setView(center, 16);

  L.marker(center).addTo(map)
    .bindPopup(e.geocode.name)
    .openPopup();

}).addTo(map);

// ===== INPUT =====
const input = document.getElementById('search-address');
const suggestionsBox = document.getElementById('suggestions');

let timeout = null;

// ===== AUTOCOMPLETADO =====
input.addEventListener('input', () => {

  clearTimeout(timeout);

  const query = input.value.trim();
  if (query.length < 3) {
    suggestionsBox.innerHTML = '';
    return;
  }

  timeout = setTimeout(async () => {

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=co&q=${encodeURIComponent(query + ' Bogotá Colombia')}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      suggestionsBox.innerHTML = '';

      data.forEach(place => {

        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = place.display_name;

        div.addEventListener('click', () => {

          const coords = [parseFloat(place.lat), parseFloat(place.lon)];

          map.setView(coords, 16);

          L.marker(coords).addTo(map)
            .bindPopup(place.display_name)
            .openPopup();

          input.value = place.display_name;
          suggestionsBox.innerHTML = '';
        });

        suggestionsBox.appendChild(div);
      });

    } catch (e) {
      console.error(e);
    }

  }, 400);
});

// ===== BUSQUEDA ENTER =====
input.addEventListener('keydown', e => {
  if (e.key === 'Enter') {

    const query = input.value.trim();

    geocoderControl.options.geocoder.geocode(query + ', Bogotá, Colombia', (results) => {

      if (results.length > 0) {
        geocoderControl.fire('markgeocode', { geocode: results[0] });
      } else {
        M.toast({html: 'No encontrado', classes: 'red'});
      }
    });
  }
});

// cerrar sugerencias
document.addEventListener('click', (e) => {
  if (!e.target.closest('#suggestions') && !e.target.closest('#search-address')) {
    suggestionsBox.innerHTML = '';
  }
});