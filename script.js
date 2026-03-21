'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // ===== VALIDACIONES DE LIBRERÍAS =====
  if (typeof L === 'undefined') {
    console.error('Leaflet NO está cargado');
    return;
  }

  if (!L.Control || !L.Control.Geocoder) {
    console.error('Leaflet Control Geocoder NO está cargado');
    return;
  }

  if (typeof M === 'undefined') {
    console.error('Materialize NO está cargado');
    return;
  }

  // ===== INICIALIZAR MATERIALIZE =====
  M.Modal.init(document.querySelectorAll('.modal'));
  M.FormSelect.init(document.querySelectorAll('select'));

  // ===== MAPA =====
  const map = L.map('map').setView([4.6097, -74.0817], 12);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team hosted by OpenStreetMap France'
  }).addTo(map);

  map.whenReady(() => {
    setTimeout(() => map.invalidateSize(), 200);
  });

  // ===== GEOCODER (SEGURO) =====
  let geocoderControl;

  map.whenReady(() => {

    geocoderControl = L.Control.geocoder({
      defaultMarkGeocode: false,
      placeholder: "Buscar en Bogotá...",
      errorMessage: "No se encontró",
      geocoder: L.Control.Geocoder.nominatim({
        geocodingQueryParams: {
          countrycodes: 'co',
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

    })
    .addTo(map);

    // 🔥 MOVER A NAVBAR (CUANDO YA EXISTE)
    requestAnimationFrame(() => {

      const navbar = document.getElementById('geocoder-navbar');
      const geocoderEl = document.querySelector('.leaflet-control-geocoder');

      if (navbar && geocoderEl) {
        navbar.appendChild(geocoderEl);
      } else {
        console.warn('No se pudo mover el geocoder');
      }

    });

  });

  // ===== PERSISTENCIA =====
  function guardarReportes(data) {
    localStorage.setItem('reportes', JSON.stringify(data));
  }

  function cargarReportes() {
    return JSON.parse(localStorage.getItem('reportes')) || [];
  }

  let listaDeReportes = cargarReportes();

  // ===== REPINTAR REPORTES =====
  listaDeReportes.forEach(r => {
    L.marker(r.coords).addTo(map)
      .bindPopup(`<b>${r.tipo}</b><br>${r.descripcion}`);
  });

  // ===== CLICK EN MAPA =====
  let marcadorTemporal = null;

  map.on('click', (e) => {

    if (marcadorTemporal) {
      map.removeLayer(marcadorTemporal);
    }

    marcadorTemporal = L.marker(e.latlng).addTo(map)
      .bindPopup("¿Reportar aquí?")
      .openPopup();

    window.coordenadasIncidente = e.latlng;

    const modalEl = document.getElementById('reportar');
    const modal = M.Modal.getInstance(modalEl);

    if (modal) {
      modal.open();
    } else {
      console.error('Modal no inicializado');
    }
  });

  // ===== CONFIRMAR REPORTE =====
  const btnConfirmar = document.getElementById('confirmar-reporte');

  btnConfirmar?.addEventListener('click', () => {

    if (!window.coordenadasIncidente) {
      M.toast({ html: 'Selecciona ubicación', classes: 'red' });
      return;
    }

    const descripcion = document.getElementById('incidente-descripcion').value;
    const tipo = document.getElementById('tipo-marcador').value;

    const nuevo = {
      tipo,
      descripcion,
      coords: window.coordenadasIncidente
    };

    listaDeReportes.push(nuevo);
    guardarReportes(listaDeReportes);

    L.marker(nuevo.coords).addTo(map)
      .bindPopup(`<b>${tipo}</b><br>${descripcion}`)
      .openPopup();

    if (marcadorTemporal) {
      map.removeLayer(marcadorTemporal);
      marcadorTemporal = null;
    }

    const modal = M.Modal.getInstance(document.getElementById('reportar'));
    modal?.close();

    document.getElementById('incidente-descripcion').value = "";

    M.toast({ html: 'Reporte guardado', classes: 'green' });
  });

  // ===== LISTA DE MARCADORES =====
  document.getElementById('markers-list')?.addEventListener('click', () => {

    const ul = document.getElementById('markers-list-content');
    ul.innerHTML = '';

    listaDeReportes.forEach(r => {
      const li = document.createElement('li');
      li.textContent = `${r.tipo} - ${r.descripcion}`;
      ul.appendChild(li);
    });
  });

  // ===== EMERGENCIA =====
  document.getElementById('llamar-emergencia')?.addEventListener('click', () => {
    window.location.href = 'tel:123';
  });

});