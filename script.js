
document.getElementById('map').style.height = "calc(100vh - 64px)";
document.getElementById('map').style.width = "100%";

var map = L.map('map').setView([51.505,-0.09],13);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom: 19,
    attribution: '&copy; <a href= "https://www.openstreetmap.org"/copyright>OpenStreetMap</a>'
}).addTo(map);



window.addEventListener('load',function(){
    setTimeout(() => {
        map.invalidateSize();
    },200);
});
