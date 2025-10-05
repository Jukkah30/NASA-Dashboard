// -----------------------
// MAPA
// -----------------------
const map = L.map('map').setView([0, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Panel lateral
const sidebar = L.control({position: 'right'});
sidebar.onAdd = function(map) {
  const div = L.DomUtil.create('div', 'sidebar');
  div.innerHTML = `<h2>Dashboard Espacial</h2>
                   <h3>Asteroides Cercanos</h3>
                   <label>Tamaño mínimo (m): <input type="number" id="sizeFilter" value="0"></label><br>
                   <label>Peligroso: <input type="checkbox" id="hazardFilter"></label>
                   <ul id="asteroidList"></ul>
                   <h3>Incendios Activos</h3>
                   <ul id="fireList"></ul>`;
  return div;
};
sidebar.addTo(map);

// Leyenda
const legend = L.control({position: 'bottomright'});
legend.onAdd = function(map) {
  const div = L.DomUtil.create('div', 'legend');
  div.innerHTML = `<h4>Leyenda</h4>
                   <i style="background: green; width:15px;height:15px;display:inline-block;margin-right:5px;"></i> No peligroso<br>
                   <i style="background: red; width:15px;height:15px;display:inline-block;margin-right:5px;"></i> Peligroso<br>
                   <i style="background: orange; width:15px;height:15px;display:inline-block;margin-right:5px;"></i> Incendio activo<br>`;
  return div;
};
legend.addTo(map);

// -----------------------
// VARIABLES GLOBALES
// -----------------------
let asteroidMarkers = [];
let fireMarkers = [];

// -----------------------
// ASTEROIDES NASA
// -----------------------
const apiKey = 'DEMO_KEY'; // reemplaza con tu clave NASA
const neoURL = `https://api.nasa.gov/neo/rest/v1/feed/today?api_key=${apiKey}`;

fetch(neoURL)
  .then(res => res.json())
  .then(data => {
    const neoData = data.near_earth_objects;
    Object.keys(neoData).forEach(date => {
      neoData[date].forEach(asteroid => addAsteroidMarker(asteroid));
    });

    // Configurar filtros
    document.getElementById('sizeFilter').addEventListener('input', applyFilters);
    document.getElementById('hazardFilter').addEventListener('change', applyFilters);

    // Actualizar gráficos después de cargar asteroides
    updateCharts();
  })
  .catch(err => console.error('Error asteroides:', err));

function addAsteroidMarker(asteroid) {
  const name = asteroid.name;
  const diameter = asteroid.estimated_diameter.meters.estimated_diameter_max;
  const hazardous = asteroid.is_potentially_hazardous_asteroid;
  const approach = asteroid.close_approach_data[0];
  const distance = parseFloat(approach.miss_distance.kilometers);
  const speed = parseFloat(approach.relative_velocity.kilometers_per_hour);
  const dateTime = approach.close_approach_date_full;

  const color = hazardous ? 'red' : 'green';
  const lat = Math.random() * 180 - 90;
  const lon = Math.random() * 360 - 180;

  const marker = L.circle([lat, lon], {
    color: color,
    radius: diameter * 10,
    fillOpacity: 0.6
  }).bindPopup(`
    <b>${name}</b><br>
    Diámetro: ${Math.round(diameter)} m<br>
    Peligroso: ${hazardous ? 'Sí' : 'No'}<br>
    Distancia: ${Math.round(distance)} km<br>
    Velocidad: ${Math.round(speed)} km/h<br>
    Fecha: ${dateTime}
  `).addTo(map);

  // Animación para peligrosos
  if (hazardous) {
    let growing = true;
    setInterval(() => {
      const radius = marker.getRadius();
      marker.setRadius(growing ? radius * 1.05 : radius / 1.05);
      growing = radius > diameter*12 ? false : (radius < diameter*8 ? true : growing);
    }, 300);
  }

  asteroidMarkers.push({marker, diameter, hazardous, distance});

  // Lista lateral
  const li = document.createElement('li');
  li.textContent = `${name} (${Math.round(diameter)} m) ${hazardous ? '[Peligroso]' : ''}`;
  li.style.cursor = 'pointer';
  li.onclick = () => {
    map.setView([lat, lon], 5);
    marker.openPopup();
  };
  document.getElementById('asteroidList').appendChild(li);

  // Alertas automáticas
  if (hazardous && distance < 500000) {
    alert(`¡ALERTA! Asteroide peligroso cercano: ${name}, Distancia: ${Math.round(distance)} km`);
  }
}

function applyFilters() {
  const sizeMin = parseFloat(document.getElementById('sizeFilter').value) || 0;
  const hazardOnly = document.getElementById('hazardFilter').checked;

  asteroidMarkers.forEach(obj => {
    const show = obj.diameter >= sizeMin && (!hazardOnly || obj.hazardous);
    if (show) obj.marker.addTo(map);
    else map.removeLayer(obj.marker);
  });

  updateCharts();
}

// -----------------------
// INCENDIOS ACTIVOS
// -----------------------
function addFires(fires) {
  fires.forEach(f => {
    const marker = L.circle([f.latitude, f.longitude], {
      color: 'orange',
      radius: 5000,
      fillOpacity: 0.5
    }).bindPopup(`
      <b>Incendio activo</b><br>
      Fecha: ${f.acq_date}<br>
      Intensidad: ${f.brightness}
    `).addTo(map);

    fireMarkers.push(marker);

    const li = document.createElement('li');
    li.textContent = `🔥 Incendio (${f.latitude.toFixed(2)}, ${f.longitude.toFixed(2)})`;
    li.style.color = 'orange';
    li.style.cursor = 'pointer';
    li.onclick = () => {
      map.setView([f.latitude, f.longitude], 5);
      marker.openPopup();
    };
    document.getElementById('fireList').appendChild(li);
  });

  updateCharts();
}

// Datos simulados (reemplazar con API real MODIS)
const sampleFires = [
  {latitude: -15.6, longitude: -47.9, acq_date: '2025-10-05', brightness: 310},
  {latitude: 34.2, longitude: -118.5, acq_date: '2025-10-05', brightness: 295},
  {latitude: -3.1, longitude: -60.0, acq_date: '2025-10-05', brightness: 320},
];

addFires(sampleFires);

// -----------------------
// GRÁFICOS CON CHART.JS
// -----------------------
function updateCharts() {
  const hazardousCount = asteroidMarkers.filter(a => a.hazardous).length;
  const nonHazardousCount = asteroidMarkers.length - hazardousCount;
  const fireCount = fireMarkers.length;

  // Asteroides
  const ctxAst = document.getElementById('asteroidChart').getContext('2d');
  new Chart(ctxAst, {
    type: 'doughnut',
    data: {
      labels: ['Peligrosos', 'No peligrosos'],
      datasets: [{
        data: [hazardousCount, nonHazardousCount],
        backgroundColor: ['red', 'green']
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });

  // Incendios
  const ctxFire = document.getElementById('fireChart').getContext('2d');
  new Chart(ctxFire, {
    type: 'bar',
    data: {
      labels: ['Incendios activos'],
      datasets: [{
        label: 'Cantidad',
        data: [fireCount],
        backgroundColor: 'orange'
      }]
    },
    options: { responsive: true }
  });
}
