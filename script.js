// Inicialización de Materialize
M.AutoInit();

document.addEventListener('DOMContentLoaded', function() {
  // Inicializar selects de Materialize
  var elems = document.querySelectorAll('select');
  M.FormSelect.init(elems);

  // Inicializar modales
  var modals = document.querySelectorAll('.modal');
  M.Modal.init(modals);

  // Inicializar mapa de Mapbox
  mapboxgl.accessToken = 'TU_MAPBOX_ACCESS_TOKEN'; // Reemplaza con tu token
  var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [-74.08175, 4.60971], // Bogotá por defecto
    zoom: 12
  });

  // Ejemplo de marcador
  var marker = new mapboxgl.Marker()
    .setLngLat([-74.08175, 4.60971])
    .setPopup(new mapboxgl.Popup().setHTML('<b>Ejemplo de marcador</b>'))
    .addTo(map);

  // Botón de emergencia
  document.getElementById('llamar-emergencia').addEventListener('click', function() {
    window.open('tel:123');
  });

  // Puedes agregar aquí más lógica para los botones y formularios
});
