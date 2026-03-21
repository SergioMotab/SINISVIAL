  // ----- BUSCADOR EN LA BARRA DE NAVEGACIÓN -----
  const inputBusqueda = document.getElementById('search-address');
  const searchIcon = document.getElementById('search-icon');

  async function buscarDireccion() {
    if (!motorBusqueda) {
      M?.toast({ html: 'Geocoder no disponible', classes: 'red' });
      return;
    }
    const raw = (inputBusqueda?.value || '').trim();
    if (!raw) return;

    // Añadimos pista de ciudad para mejorar resultados
    const q = raw.toLowerCase().includes('bogotá') ? raw : `${raw}, Bogotá, Colombia`;

    M?.toast({ html: 'Buscando dirección…', classes: 'blue' });

    try {
      const results = await geocodeConTimeout(q, { timeoutMs: 4500 });

      if (!results || results.length === 0) {
        M?.toast({ html: 'No se encontró la dirección', classes: 'red' });
        return;
      }
      const r = results[0];
      map.setView(r.center, 16);
      if (marcadorBusqueda) {
        map.removeLayer(marcadorBusqueda);
      }
      marcadorBusqueda = L.marker(r.center).addTo(map)
        .bindPopup(r.name)
        .openPopup();
    } catch (e) {
      M?.toast({ html: 'Error en la búsqueda', classes: 'red' });
      console.error('Error en buscarDireccion:', e);
    }
  }

  if (inputBusqueda) {
    inputBusqueda.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        buscarDireccion();
      }
    });
  }
  if (searchIcon) {
    searchIcon.addEventListener('click', function() {
      buscarDireccion();
    });
  }