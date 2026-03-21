'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // ===== MATERIALIZE =====
  M.AutoInit();

  // ===== MAPA =====
  const map = L.map('map').setView([4.6097, -74.0817], 12);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  setTimeout(() => map.invalidateSize(), 200);

  // ===== HISTORIAL =====
  let historial = JSON.parse(localStorage.getItem('historial_busquedas')) || [];

  function guardarHistorial(lugar) {
    historial.unshift(lugar);
    historial = historial.slice(0, 5);
    localStorage.setItem('historial_busquedas', JSON.stringify(historial));
  }

  // ===== GEOCODER PRO =====
  const geocoderControl = L.Control.geocoder({
    defaultMarkGeocode: false,
    placeholder: "Buscar dirección en Bogotá...",
    errorMessage: "No se encontró",
    geocoder: L.Control.Geocoder.nominatim({
      geocodingQueryParams: {
        countrycodes: 'co',
        viewbox: '-74.3,4.4,-73.9,4.8', // 🔥 limitar a Bogotá
        bounded: 1,
        'accept-language': 'es'
      }
    })
  })
  .on('markgeocode', function(e) {

    const center = e.geocode.center;

    map.setView(center, 16);

    L.marker(center).addTo(map)
      .bindPopup(`<b>${e.geocode.name}</b>`)
      .openPopup();

    guardarHistorial(e.geocode.name);
  })
  .addTo(document.getElementById('geocoder-navbar'));

  // ===== MOSTRAR HISTORIAL (UX PRO) =====
  const input = document.querySelector('.leaflet-control-geocoder-form input');

  input.addEventListener('focus', () => {

    const container = document.querySelector('.leaflet-control-geocoder-alternatives');
    if (!container) return;

    container.innerHTML = '';

    historial.forEach(item => {
      const div = document.createElement('div');
      div.className = 'leaflet-control-geocoder-alternatives-minimized';
      div.textContent = "🕘 " + item;

      div.onclick = () => {
        input.value = item;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      };

      container.appendChild(div);
    });
  });

  // ===== REPORTES =====
  let marcadorTemporal;
  let listaDeReportes = [];

  map.on('click', (e) => {

    if (marcadorTemporal) {
      map.removeLayer(marcadorTemporal);
    }

    marcadorTemporal = L.marker(e.latlng).addTo(map)
      .bindPopup("¿Reportar aquí?")
      .openPopup();

    window.coordenadasIncidente = e.latlng;

    const modal = M.Modal.getInstance(document.getElementById('reportar'));
    if (modal) modal.open();
  });

  document.getElementById('confirmar-reporte').addEventListener('click', () => {

    if (!window.coordenadasIncidente) {
      M.toast({html: 'Selecciona ubicación', classes: 'red'});
      return;
    }

    const descripcion = document.getElementById('incidente-descripcion').value;
    const tipo = document.getElementById('tipo-marcador').value;

    L.marker(window.coordenadasIncidente).addTo(map)
      .bindPopup(`<b>${tipo}</b><br>${descripcion}`)
      .openPopup();

    listaDeReportes.push({
      tipo,
      descripcion,
      coords: window.coordenadasIncidente
    });

    if (marcadorTemporal) map.removeLayer(marcadorTemporal);

    M.toast({html: 'Reporte guardado', classes: 'green'});
  });

  // ===== LISTA =====
  document.getElementById('markers-list').addEventListener('click', () => {

    const ul = document.getElementById('markers-list-content');
    ul.innerHTML = '';

    listaDeReportes.forEach(r => {
      const li = document.createElement('li');
      li.textContent = `${r.tipo} - ${r.descripcion}`;
      ul.appendChild(li);
    });
  });

  // ===== EMERGENCIA =====
  document.getElementById('llamar-emergencia').addEventListener('click', () => {
    window.location.href = 'tel:123';
  });

});