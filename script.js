
document.getElementById('map').style.height = "calc(100vh - 64px)";
document.getElementById('map').style.width = "100%";

var map = L.map('map').setView([4.6097, -74.0817], 12);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

window.addEventListener('load', function() {
    setTimeout(() => { map.invalidateSize(); }, 200);
});

var marker = L.marker([4.6097, -74.0817]).addTo(map);
var circle = L.circle([4.6099, -74.0819], {
    color: 'red',
    fillColor: '#f03',
    fillOpacity: 0.5,
    radius: 500
}).addTo(map);

var marcadorTemporal;
var listaDeReportes = []; // Para el Requerimiento de "Ver Marcadores"
const motorBusqueda = L.Control.Geocoder.nominatim();

// 4. LÓGICA PRINCIPAL (Al cargar el DOM)
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar componentes de Materialize (Modales y Selects)
    M.Modal.init(document.querySelectorAll('.modal'));
    M.FormSelect.init(document.querySelectorAll('select'));

    const inputBusqueda = document.getElementById('search-address');
    if (inputBusqueda) {
        inputBusqueda.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault(); // Evita recarga de página
                const direccion = e.target.value;
                if (!direccion) return;

                // Geocodificación enfocada en Bogotá
                motorBusqueda.geocode(direccion + ", Bogotá", function(results) {
                    if (results && results.length > 0) {
                        const r = results[0];
                        map.setView(r.center, 16);
                        L.marker(r.center).addTo(map)
                            .bindPopup("<b>Ubicación:</b><br>" + r.name)
                            .openPopup();
                    } else {
                        M.toast({html: 'No se encontró la dirección', classes: 'red'});
                    }
                });
            }
        });
    }

    // --- FUNCIONALIDAD: CONFIRMAR REPORTE (RF 3) ---
    const btnConfirmar = document.getElementById('confirmar-reporte');
    if (btnConfirmar) {
        btnConfirmar.addEventListener('click', function() {
            const descripcion = document.getElementById('incidente-descripcion').value;
            const tipo = document.getElementById('tipo-marcador').value;

            if (window.coordenadasIncidente) {
                // Crear marcador permanente con la información
                const nuevoMarcador = L.marker(window.coordenadasIncidente).addTo(map)
                    .bindPopup(`<b>TIPO: ${tipo.toUpperCase()}</b><br>DESCRIPCIÓN: ${descripcion}`)
                    .openPopup();

                // Guardar en la lista para el historial
                listaDeReportes.push({ tipo, descripcion, coords: window.coordenadasIncidente });

                // Limpiar marcador azul temporal
                if (marcadorTemporal) map.removeLayer(marcadorTemporal);

                // CERRAR MODAL Y LIMPIAR
                const instance = M.Modal.getInstance(document.getElementById('reportar'));
                instance.close();
                document.getElementById('incidente-descripcion').value = "";
                
                M.toast({html: '✅ Reporte registrado con éxito', classes: 'green'});
            } else {
                M.toast({html: '❌ Primero selecciona un punto en el mapa', classes: 'orange'});
            }
        });
    }
});

map.on('click', function(e) {
    const coordenadas = e.latlng;
    
    // Eliminar el marcador previo si el usuario cambia de opinión antes de confirmar
    if (marcadorTemporal) {
        map.removeLayer(marcadorTemporal);
    }

    marcadorTemporal = L.marker(coordenadas).addTo(map)
        .bindPopup("¿Reportar incidente aquí?")
        .openPopup();

    window.coordenadasIncidente = coordenadas;

    // Abrir el modal automáticamente
    const instance = M.Modal.getInstance(document.getElementById('reportar'));
    if (instance) {
        instance.open();
    }
});