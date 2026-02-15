
document.getElementById('map').style.height = "calc(100vh - 64px)";
document.getElementById('map').style.width = "100%";

var map = L.map('map').setView([4.6097,-74.0817],12);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom: 19,
    attribution: '&copy; <a href= "https://www.openstreetmap.org"/copyright>OpenStreetMap</a>'
}).addTo(map);



window.addEventListener('load',function(){
    setTimeout(() => {
        map.invalidateSize();
    },200);
});



// agregar un marcador

var marker = L.marker([4.6097,-74.0817]).addTo(map);

var circle = L.circle([4.6099,-74.0819],{
    color: 'red',
    fillColor: '#f03',
    fillOpacity: 0.5,
    radius: 500
}).addTo(map);


// motor de busqueda
var marcadorTemporal;
const motorBusqueda = L.Control.Geocoder.nominatim();

document.addEventListener('DOMContentLoaded', function() {

    M.Modal.init(document.querySelectorAll('.modal'));
    M.FormSelect.init(document.querySelectorAll('select'));

    const inputBusqueda = document.getElementById('search-address');

    inputBusqueda.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();

            const direccion = e.target.value;
            if (!direccion) return;

            motorBusqueda.geocode(direccion + ",Bogotá", function(results) {
                if (results.length > 0) {
                    const r = results[0];
                    map.setView(r.center, 16);

                    L.marker(r.center).addTo(map)
                        .bindPopup(r.name)
                        .openPopup();
                } else {
                    M.toast({html: 'Dirección no encontrada', classes: 'red'});
                }
            })
        }
    })
});

// Logica boton confirmar

const btnConfirmar = document.getElementById('confirmar reporte');
if (btnConfirmar){
    btnConfirmar.addEventListener('click', function() {
        const descripcion = document.getElementById('descripcion').value;
        const tipo = document.getElementById('tipo').value;

        if (window.coordenadasIncidente) {

            L.marker(window.coordenadasIncidente).addTo(map)
                .bindPopup(`<b>${tipo}</b><br>${descripcion}`)
                .openPopup();

                if (marcadorTemporal) map.removeLayer(marcadorTemporal);

                //aviso al usuario
                M.Modal.getInstance(document.getElementById('reportar')).close();
                M.toast({html: 'Reporte enviado con éxito', classes: 'green'});
        }
});
}

// captura click

map.on('click', function(e) {
    const coordenadas = e.latlng;

    if (marcadorTemporal) map.removeLayer(marcadorTemporal);

    marcadorTemporal = L.marker(coordenadas).addTo(map)
               .bindPopup('Ubicación del incidente')
                .openPopup();

                window.coordenadasIncidente = coordenadas;

                const instance = M.Modal.getInstance(document.getElementById('reportar'));
                if (instance) instance.open();
});
