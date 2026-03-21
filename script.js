'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // 🔥 Inicializar Materialize
  M.AutoInit();

  // 🔥 Validar Leaflet
  if (!window.L) {
    console.error('Leaflet no cargó');
    return;
  }

  // ===== MAPA =====
  const map = L.map('map').setView([4.6097, -74.0817], 12);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  setTimeout(() => map.invalidateSize(), 200);

  // ===== GEOCODER =====
  let motorBusqueda = null;

  if (L.Control.Geocoder) {
    motorBusqueda = L.Control.Geocoder.nominatim({
      geocodingQueryParams: {
        countrycodes: 'co',
        'accept-language': 'es'
      }
    });
  }

  // ===== BUSCADOR =====
  let marcadorBusqueda = null;

  async function buscarDireccion() {
    if (!motorBusqueda) {
      M.toast({ html: 'Geocoder no disponible', classes: 'red' });
      return;
    }

    const input = document.getElementById('search-address');
    const query = input.value.trim();

    if (!query) return;

    M.toast({ html: 'Buscando...', classes: 'blue' });

    motorBusqueda.geocode(query + ', Bogotá, Colombia', (results) => {

      if (!results || results.length === 0) {
        M.toast({ html: 'No encontrado', classes: 'red' });
        return;
      }

      const r = results[0];

      if (!r.center) {
        console.warn('Sin coordenadas');
        return;
      }

      map.setView(r.center, 16);

      if (marcadorBusqueda) {
        map.removeLayer(marcadorBusqueda);
      }

      marcadorBusqueda = L.marker(r.center)
        .addTo(map)
        .bindPopup(r.name)
        .openPopup();
    });
  }

  document.getElementById('search-icon')
    .addEventListener('click', buscarDireccion);

  document.getElementById('search-address')
    .addEventListener('keydown', e => {
      if (e.key === 'Enter') buscarDireccion();
    });

  // ===== REPORTES =====
  let marcadorTemp = null;
  let reportes = JSON.parse(localStorage.getItem('reportes')) || [];

  function guardar() {
    localStorage.setItem('reportes', JSON.stringify(reportes));
  }

  function pintarReportes() {
    reportes.forEach(r => {
      L.marker(r.coords)
        .addTo(map)
        .bindPopup(`<b>${r.tipo}</b><br>${r.descripcion}`);
    });
  }

  pintarReportes();

  // click en mapa
  map.on('click', (e) => {
    if (marcadorTemp) {
      map.removeLayer(marcadorTemp);
    }

    marcadorTemp = L.marker(e.latlng).addTo(map);

    M.toast({ html: 'Ubicación seleccionada', classes: 'green' });
  });

  // confirmar reporte
  document.getElementById('confirmar-reporte')
    .addEventListener('click', () => {

      if (!marcadorTemp) {
        M.toast({ html: 'Selecciona ubicación', classes: 'red' });
        return;
      }

      const descripcion = document.getElementById('incidente-descripcion').value;
      const tipo = document.getElementById('tipo-marcador').value;

      const nuevo = {
        coords: marcadorTemp.getLatLng(),
        descripcion,
        tipo
      };

      reportes.push(nuevo);
      guardar();

      marcadorTemp.bindPopup(`<b>${tipo}</b><br>${descripcion}`);

      marcadorTemp = null;

      M.toast({ html: 'Reporte guardado', classes: 'green' });
    });

  // ===== LISTA =====
  document.getElementById('markers-list')
    .addEventListener('click', () => {

      const ul = document.getElementById('markers-list-content');
      ul.innerHTML = '';

      reportes.forEach(r => {
        const li = document.createElement('li');
        li.textContent = `${r.tipo} - ${r.descripcion}`;
        ul.appendChild(li);
      });
    });

  // ===== EMERGENCIA =====
  document.getElementById('llamar-emergencia')
    .addEventListener('click', () => {
      window.location.href = 'tel:123';
    });

});