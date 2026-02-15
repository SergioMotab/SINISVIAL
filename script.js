
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