'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // ===== MATERIALIZE =====
  M.AutoInit();

  // ===== MAPA =====
  const mapEl = document.getElementById('map');
  if (!mapEl) {
    console.error('No existe #map');
    return;
  }

  mapEl.style.height = "calc(100vh - 64px)";
  mapEl.style.width = "100%";

  const map = L.map('map').setView([4.6097, -74.0817], 12);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  // Arreglo render Leaflet
  map.whenReady(() => {
    setTimeout(() => map.invalidateSize(), 200);
  });

  // ===== GEOCODER =====
  map.whenReady(() => {

    const geocoderControl = L.Control.geocoder({
      defaultMarkGeocode: false,
      placeholder: "Buscar dirección en Bogotá...",
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
    .addTo(map); // 🔥 SIEMPRE al mapa

    // ===== MOVER A NAVBAR =====
    const navbar = document.getElementById('geocoder-navbar');
    const geocoderEl = document.querySelector('.leaflet-control-geocoder');

    if (navbar && geocoderEl) {
      navbar.appendChild(geocoderEl);
    } else {
      console.error('No se pudo mover el geocoder');
    }
  });

  // ===== REPORTES =====
  let marcadorTemporal = null;
  let listaDeReportes = [];

  map.on('click', (e) => {

    // Eliminar marcador previo
    if (marcadorTemporal) {
      map.removeLayer(marcadorTemporal);
    }

    marcadorTemporal = L.marker(e.latlng).addTo(map)
      .bindPopup("¿Reportar aquí?")
      .openPopup();

    window.coordenadasIncidente = e.latlng;

    // Abrir modal
    const modalEl = document.getElementById('reportar');
    const modal = M.Modal.getInstance(modalEl);
    if (modal) modal.open();
  });

  // ===== CONFIRMAR REPORTE =====
  const btnConfirmar = document.getElementById('confirmar-reporte');

  if (btnConfirmar) {
    btnConfirmar.addEventListener('click', () => {

      if (!window.coordenadasIncidente) {
        M.toast({ html: 'Selecciona una ubicación', classes: 'red' });
        return;
      }

      const descripcion = document.getElementById('incidente-descripcion').value;
      const tipo = document.getElementById('tipo-marcador').value;

      const marker = L.marker(window.coordenadasIncidente).addTo(map)
        .bindPopup(`<b>${tipo}</b><br>${descripcion}`)
        .openPopup();

      listaDeReportes.push({
        tipo,
        descripcion,
        coords: window.coordenadasIncidente
      });

      // limpiar temporal
      if (marcadorTemporal) {
        map.removeLayer(marcadorTemporal);
        marcadorTemporal = null;
      }

      // cerrar modal
      const modal = M.Modal.getInstance(document.getElementById('reportar'));
      if (modal) modal.close();

      // limpiar input
      document.getElementById('incidente-descripcion').value = "";

      M.toast({ html: 'Reporte guardado', classes: 'green' });
    });
  }

  // ===== LISTA DE MARCADORES =====
  const btnLista = document.getElementById('markers-list');

  if (btnLista) {
    btnLista.addEventListener('click', () => {

      const ul = document.getElementById('markers-list-content');
      ul.innerHTML = '';

      listaDeReportes.forEach(r => {
        const li = document.createElement('li');
        li.textContent = `${r.tipo} - ${r.descripcion}`;
        ul.appendChild(li);
      });
    });
  }

  // ===== EMERGENCIA =====
  const btnEmergencia = document.getElementById('llamar-emergencia');

  if (btnEmergencia) {
    btnEmergencia.addEventListener('click', () => {
      window.location.href = 'tel:123';
    });
  }

});