// Inicialización de Materialize
M.AutoInit();

document.addEventListener('DOMContentLoaded', function() {
  // Inicializar selects de Materialize
  var elems = document.querySelectorAll('select');
  M.FormSelect.init(elems);

  // Inicializar modales
  var modals = document.querySelectorAll('.modal');
  M.Modal.init(modals);


  // Inicializar Google Maps
  var map;
  function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
      center: { lat: 4.60971, lng: -74.08175 }, // Bogotá
      zoom: 12
    });
    // Ejemplo de marcador
    new google.maps.Marker({
      position: { lat: 4.60971, lng: -74.08175 },
      map: map,
      title: 'Ejemplo de marcador'
    });
  }
  // Esperar a que Google Maps esté listo
  if (typeof google !== 'undefined' && google.maps) {
    initMap();
  } else {
    window.initMap = initMap;
  }

  // Botón de emergencia
  document.getElementById('llamar-emergencia').addEventListener('click', function() {
    window.open('tel:123');
  });

  // Puedes agregar aquí más lógica para los botones y formularios
});
