// Variables globales
let currentData = [];
let map = null;
let mapMarker = null;
let currentSensorInfo = null;
let dateSlider = null;
let depthSlider = null;

const COLOR_A = "#1f77b4";
const COLOR_B = "#ff7f0e";

// --- INICIALIZACIÓN PRINCIPAL ---
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. ACTIVAR BOTÓN DE SALIR (PRIORIDAD MÁXIMA)
    const btnExit = document.getElementById('btnExit');
    if (btnExit) {
        btnExit.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log("Cerrando sesión...");
            try {
                await axios.get('api.php?action=logout');
            } catch (err) {
                console.warn("Error red logout", err);
            } finally {
                window.location.href = 'login.html';
            }
        });
    }

    // 2. INICIAR EL RESTO DE LA APP
    initApp();
});

// --- LÓGICA DE LA APP ---
async function initApp() {
    console.log("Iniciando App..."); // DEBUG
    try {
        // Verificar sesión
        const res = await axios.get('api.php?action=check_session');
        
        if (!res.data.logged_in) {
            window.location.href = 'login.html';
            return;
        }

        console.log("Usuario logueado:", res.data.usuario);
        setupUserUI(res.data);

        // Cargar datos iniciales
        initMap();
        await loadSensors();
        setupCreateVersionUI();
        
        // Listeners del Dashboard
        const btnUpdate = document.getElementById('btnUpdate');
        if(btnUpdate) btnUpdate.addEventListener('click', (e) => { e.preventDefault(); updateDashboard(); });
        
        const uploadForm = document.getElementById('uploadForm');
        if(uploadForm) uploadForm.addEventListener('submit', handleUpload);
        
        // --- EL LISTENER CLAVE ---
        const sensorSelect = document.getElementById('sensorSelect');
        if(sensorSelect) {
            // Eliminamos listeners antiguos clonando el nodo (truco para limpiar basura en memoria)
            const newSelect = sensorSelect.cloneNode(true);
            sensorSelect.parentNode.replaceChild(newSelect, sensorSelect);
            
            // Añadimos el evento limpio
            newSelect.addEventListener('change', () => { 
                console.log("¡Cambio de sensor detectado!"); // DEBUG
                updateDashboard(); 
            });
        }
        // Listener para Crear Usuario
        const createUserForm = document.getElementById('createUserForm');
        if(createUserForm) {
            createUserForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // Recoger datos
                const formData = new FormData(e.target);
                
                // Cerrar el modal (usando la instancia de Bootstrap)
                const modalEl = document.getElementById('userModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();

                showLoading(true);

                try {
                    const res = await axios.post('api.php?action=create_user', formData);
                    
                    if (res.data.success) {
                        Swal.fire('Creado', res.data.message, 'success');
                        e.target.reset(); // Limpiar formulario
                    } else {
                        Swal.fire('Error', res.data.message, 'error');
                    }
                } catch (err) {
                    console.error(err);
                    Swal.fire('Error', 'No se pudo crear el usuario', 'error');
                } finally {
                    showLoading(false);
                }
            });
            
        }
        // --- NUEVO LISTENER: CREAR SENSOR ---
        const createSensorForm = document.getElementById('createSensorForm');
        if(createSensorForm) {
            createSensorForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // Recoger datos (incluyendo archivo)
                const formData = new FormData(e.target);
                
                // Cerrar modal
                const modalEl = document.getElementById('sensorModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();

                showLoading(true);

                try {
                    // Enviamos a la nueva acción de la API
                    const res = await axios.post('api.php?action=add_sensor', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    
                    if (res.data.success) {
                        Swal.fire('Guardado', res.data.message, 'success');
                        e.target.reset(); // Limpiar formulario
                        
                        // IMPORTANTE: Recargar la lista de sensores para que salga el nuevo
                        await loadSensors(); 
                    } else {
                        Swal.fire('Error', res.data.message, 'error');
                    }
                } catch (err) {
                    console.error(err);
                    Swal.fire('Error', 'No se pudo crear el sensor', 'error');
                } finally {
                    showLoading(false);
                }
            });
        }
        // --- LISTENER PARA DESCARGAR CSV (NUEVO) ---
        const btnDownload = document.getElementById('btnDownloadCsv');
        if (btnDownload) {
            btnDownload.addEventListener('click', () => {
                const sel = document.getElementById('sensorSelect');
                const start = document.getElementById('startDate').value;
                const end = document.getElementById('endDate').value;

                // Validación: ¿Hay sensor seleccionado?
                if (!sel || !sel.value) {
                    Swal.fire('Atención', 'Selecciona un sensor primero', 'warning');
                    return;
                }

                // Generar enlace de descarga directa con los filtros actuales
                const url = `api.php?action=export_csv&id=${sel.value}&start=${start}&end=${end}`;
                
                // Forzar la descarga
                window.location.href = url;
            });
        }

    } catch (err) {
        console.error("Error en inicialización:", err);
    }
}

function setupUserUI(userData) {
    const userDisplay = document.getElementById('userDisplay');
    if(userDisplay) userDisplay.textContent = `${userData.usuario} (${userData.rol})`;

    // Lógica CLIENTE (Ocultar carga)
    if (userData.rol === 'cliente') {
        const uploadZone = document.querySelector('.upload-zone');
        if(uploadZone) uploadZone.style.display = 'none';
    }

    // Lógica SUPERADMIN (Mostrar panel de crear usuarios)
    if (userData.rol === 'superAdmin') {
        const adminPanel = document.getElementById('adminPanel');
        if(adminPanel) adminPanel.style.display = 'block';
    }

    // LOGICA NUEVA PARA EL BOTÓN ADMIN
    if (userData.rol === 'superAdmin' || userData.rol === 'admin') {
        const btnAdmin = document.getElementById('btnAdminLink');
        if(btnAdmin) btnAdmin.style.display = 'block';
    }
}

// --- API CALLS ---
async function loadSensors() {
    try {
        const res = await axios.get('api.php?action=get_sensors');
        const sensores = res.data;
        const sel = document.getElementById('sensorSelect');
        
        if(sel) {
            sel.innerHTML = ''; 

            // 1. Opción por defecto (CORREGIDO)
            const defaultOpt = document.createElement('option');
            defaultOpt.value = "";
            defaultOpt.textContent = "-- Selecciona un sensor --";
            
            defaultOpt.selected = true; // La marcamos como seleccionada
            defaultOpt.hidden = true;   // La ocultamos del desplegable (truco visual)
            // defaultOpt.disabled = true; <--- ESTA LÍNEA ERA EL PROBLEMA (Bórrala)
            
            sel.appendChild(defaultOpt);

            // 2. Crear grupos visuales
            const groupCanal = document.createElement('optgroup');
            groupCanal.label = "--- CANAL ---";
            groupCanal.style.color = "#1f77b4";
            groupCanal.style.fontWeight = "bold";

            const groupColector = document.createElement('optgroup');
            groupColector.label = "--- COLECTOR ---";
            groupColector.style.color = "#ff7f0e";
            groupColector.style.fontWeight = "bold";

            // 3. Clasificar sensores
            if (Array.isArray(sensores)) {
                sensores.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = s.nombre;
                    opt.style.color = "#333";
                    opt.style.fontWeight = "normal";
                    
                    // Datos extra
                    opt.dataset.lat = s.latitud;
                    opt.dataset.lon = s.longitud;
                    opt.dataset.nf = s.nf;
                    opt.dataset.foto = s.foto_path;

                    // Clasificación
                    const lugar = (s.lugar || 'Canal').toLowerCase().trim();

                    if (lugar === 'colector') {
                        groupColector.appendChild(opt);
                    } else {
                        groupCanal.appendChild(opt);
                    }
                });
            }

            // 4. Añadir grupos
            if (groupCanal.children.length > 0) sel.appendChild(groupCanal);
            if (groupColector.children.length > 0) sel.appendChild(groupColector);
            
            // 5. FORZAR LA SELECCIÓN VACÍA (Extra seguridad)
            sel.value = ""; 
        }
        fillBaseSensorSelect(sensores);
    } catch (err) {
        console.error("Error cargando sensores", err);
    }
}

function fillBaseSensorSelect(sensores) {
    const baseSel = document.getElementById('baseSensorSelect');
    if (!baseSel) return;

    baseSel.innerHTML = '<option value="">-- Selecciona sensor --</option>';
    if (!Array.isArray(sensores)) return;

    sensores.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.nombre;
        opt.dataset.lat = s.latitud;
        opt.dataset.lon = s.longitud;
        opt.dataset.nf = s.nf;
        opt.dataset.lugar = s.lugar;
        baseSel.appendChild(opt);
    });
}

function setupCreateVersionUI() {
    const toggle = document.getElementById('createVersionToggle');
    const baseWrap = document.getElementById('createVersionFields');
    const baseSel = document.getElementById('baseSensorSelect');
    const hidden = document.getElementById('createVersionInput');

    if (!toggle || !hidden) return;

    const form = document.getElementById('createSensorForm');
    const nombreInput = form ? form.querySelector('input[name="nombre"]') : null;
    const latInput = form ? form.querySelector('input[name="latitud"]') : null;
    const lonInput = form ? form.querySelector('input[name="longitud"]') : null;
    const nfInput = form ? form.querySelector('input[name="nf"]') : null;
    const lugarSelect = form ? form.querySelector('select[name="lugar"]') : null;

    const lockFields = (lock) => {
        if (nombreInput) nombreInput.readOnly = lock;
        if (latInput) latInput.disabled = lock;
        if (lonInput) lonInput.disabled = lock;
        if (nfInput) nfInput.disabled = lock;
        if (lugarSelect) lugarSelect.disabled = lock;
        if (baseSel) baseSel.required = lock;
        if (baseWrap) baseWrap.classList.toggle('d-none', !lock);
    };

    const applyBaseToFields = () => {
        if (!baseSel || baseSel.selectedIndex < 0) return;
        const opt = baseSel.options[baseSel.selectedIndex];
        if (!opt || !opt.value) return;
        if (nombreInput) nombreInput.value = opt.textContent;
        if (latInput) latInput.value = opt.dataset.lat || '';
        if (lonInput) lonInput.value = opt.dataset.lon || '';
        if (nfInput) nfInput.value = opt.dataset.nf || '';
        if (lugarSelect && opt.dataset.lugar) lugarSelect.value = opt.dataset.lugar;
    };

    toggle.addEventListener('change', () => {
        const isVersion = toggle.checked;
        hidden.value = isVersion ? '1' : '0';
        lockFields(isVersion);
        if (isVersion) {
            applyBaseToFields();
        }
    });

    if (baseSel) {
        baseSel.addEventListener('change', () => {
            if (toggle.checked) applyBaseToFields();
        });
    }
}

async function updateDashboard() {
    const sel = document.getElementById('sensorSelect');
    if(!sel || !sel.value) return;

    console.log("Actualizando Dashboard para sensor ID:", sel.value); // DEBUG
    showLoading(true);

    try {
        // 1. Actualizar Info Visual (Mapa/Foto)
        updateSensorInfo();

        // 2. Descargar Datos Nuevos
        const res = await axios.get(`api.php?action=get_data&id=${sel.value}`);
        console.log("Datos recibidos:", res.data.length, "registros"); // DEBUG
        
        currentData = res.data;

        // 3. Repintar Todo
        // Importante: Si no hay datos, currentData es [], setupDates maneja eso limpiando.
        setupDates();
        setupDepths();
        renderAllCharts();

    } catch (err) {
        console.error("Error en updateDashboard:", err);
        Swal.fire('Error', 'No se pudieron cargar los datos', 'error');
    } finally {
        showLoading(false);
    }
}

// --- CONFIGURACIÓN DE SLIDERS Y DATOS ---

function setupDates() {
    const slider = document.getElementById('dateSlider');
    if(!slider) return;

    // Si no hay datos, limpiamos inputs pero dejamos el slider 'inutilizado'
    if(currentData.length === 0) {
        if (slider.noUiSlider) slider.noUiSlider.destroy();
        return; 
    }
    
    const feMinStr = currentData[0].fecha_str;
    const feMaxStr = currentData[currentData.length - 1].fecha_str;
    const minTs = new Date(feMinStr).getTime();
    const maxTs = new Date(feMaxStr).getTime();

    if (slider.noUiSlider) slider.noUiSlider.destroy();

    noUiSlider.create(slider, {
        start: [minTs, maxTs],
        connect: true,
        range: { 'min': minTs, 'max': maxTs },
        step: 86400000, 
        tooltips: [
            { to: (val) => new Date(parseInt(val)).toLocaleDateString('es-ES') },
            { to: (val) => new Date(parseInt(val)).toLocaleDateString('es-ES') }
        ]
    });

    slider.noUiSlider.on('set', function (values) {
        const start = new Date(parseInt(values[0])).toISOString().split('T')[0];
        const end = new Date(parseInt(values[1])).toISOString().split('T')[0];
        document.getElementById('startDate').value = start;
        document.getElementById('endDate').value = end;
        renderAllCharts();
    });
    
    document.getElementById('startDate').value = feMinStr;
    document.getElementById('endDate').value = feMaxStr;
}

function setupDepths() {
    const sliderElement = document.getElementById('depthSlider');
    const hiddenInput = document.getElementById('profSelect');
    if(!sliderElement) return;

    // Protección contra datos vacíos
    const uniqueProfs = [...new Set(currentData.map(item => parseFloat(item.profundidad)))].sort((a,b) => a - b);
    
    if (uniqueProfs.length === 0) {
        if (sliderElement.noUiSlider) sliderElement.noUiSlider.destroy();
        return;
    }

    const minProf = uniqueProfs[0];
    const maxProf = uniqueProfs[uniqueProfs.length - 1];
    let stepVal = uniqueProfs.length > 1 ? (uniqueProfs[1] - uniqueProfs[0]) : 0.5;

    if (sliderElement.noUiSlider) sliderElement.noUiSlider.destroy();

    noUiSlider.create(sliderElement, {
        start: [minProf],
        connect: 'lower',
        range: { 'min': minProf, 'max': maxProf },
        step: stepVal,
        tooltips: { to: (val) => parseFloat(val).toFixed(1) + " m" }
    });

    sliderElement.noUiSlider.on('update', function (values) {
        hiddenInput.value = parseFloat(values[0]);
        const txtTime = document.getElementById('txtProfTime');
        const txtPolar = document.getElementById('txtProfPolar');
        if(txtTime) txtTime.textContent = parseFloat(values[0]);
        if(txtPolar) txtPolar.textContent = parseFloat(values[0]);
    });

    sliderElement.noUiSlider.on('change', function () { renderAllCharts(); });
    hiddenInput.value = minProf;
}

function getFilteredData() {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    // Si los inputs están vacíos (porque no hay datos), devolvemos array vacío
    if(!start || !end) return [];
    return currentData.filter(d => d.fecha_str >= start && d.fecha_str <= end);
}

// --- RENDERIZADO ---

function updateSensorInfo() {
    const sel = document.getElementById('sensorSelect');
    if(!sel || sel.selectedIndex < 0) return;
    
    const opt = sel.options[sel.selectedIndex];
    
    const latRaw = String(opt.dataset.lat).replace(',', '.');
    const lonRaw = String(opt.dataset.lon).replace(',', '.');

    currentSensorInfo = {
        lat: parseFloat(latRaw),
        lon: parseFloat(lonRaw),
        nf: parseFloat(opt.dataset.nf),
        foto: opt.dataset.foto
    };

    // 1. Mostrar caja de información
    const infoBox = document.getElementById('sensorInfoBox');
    if(infoBox) infoBox.style.display = 'block';
    
    const infoNombre = document.getElementById('infoNombre');
    const infoCoords = document.getElementById('infoCoords');
    if(infoNombre) infoNombre.textContent = opt.text;
    if(infoCoords) infoCoords.textContent = `${currentSensorInfo.lat.toFixed(5)}, ${currentSensorInfo.lon.toFixed(5)}`;

    // 2. Actualizar enlace Google Maps
    const linkMaps = document.getElementById('linkGoogleMaps');
    if (linkMaps && !isNaN(currentSensorInfo.lat)) {
        linkMaps.href = `https://www.google.com/maps?q=${currentSensorInfo.lat},${currentSensorInfo.lon}`;
        linkMaps.style.display = 'inline-block';
    }

    // 3. ACTUALIZAR MAPA (LÓGICA CORREGIDA)
    if(map && !isNaN(currentSensorInfo.lat)) {
        map.invalidateSize();

        // A) Borrar la bolita anterior INMEDIATAMENTE para que no estorbe
        if(mapMarker) {
            map.removeLayer(mapMarker);
            mapMarker = null;
        }

        // B) Iniciar el vuelo (animación) hacia el destino
        map.flyTo([currentSensorInfo.lat, currentSensorInfo.lon], 18, {
            animate: true,
            duration: 1.5 // Duración del vuelo en segundos
        });

        // C) Esperar a que termine el vuelo ('moveend') para pintar la nueva bolita
        map.once('moveend', function() {
            // Creamos el marcador SOLO cuando el mapa ya está quieto en el sitio
            mapMarker = L.circleMarker([currentSensorInfo.lat, currentSensorInfo.lon], {
                radius: 12, 
                color: 'red', 
                fillColor: '#f03', 
                fillOpacity: 0.8
            }).addTo(map);

            // Añadir el popup
            mapMarker.bindPopup(`
                <b>${opt.text}</b><br>
                <a href="https://www.google.com/maps?q=${currentSensorInfo.lat},${currentSensorInfo.lon}" target="_blank">
                    Abrir en Google Maps
                </a>
            `);
        });
    }

    // 4. Actualizar Foto
    const img = document.getElementById('sensorPhoto');
    const txt = document.getElementById('noPhotoText');
    if(img && txt) {
        if(currentSensorInfo.foto && currentSensorInfo.foto !== 'null' && currentSensorInfo.foto !== '') {
            img.src = `static/img/${currentSensorInfo.foto}`;
            img.style.display = 'block';
            txt.style.display = 'none';
        } else {
            img.style.display = 'none';
            txt.style.display = 'block';
        }
    }
}

// MOSTRAR BOTÓN DE VERSIONES
const btnVer = document.getElementById('btnVersions');
if(btnVer) {
    btnVer.style.display = 'block';
    // Le asignamos el evento onclick aquí mismo para pasarle el ID actual
    btnVer.onclick = () => {
        const sel = document.getElementById('sensorSelect');
        if (!sel || !sel.value) {
            Swal.fire('Atención', 'Selecciona un sensor primero', 'warning');
            return;
        }
        openVersionsModal(sel.value);
    };
}

function renderAllCharts() {
    const data = getFilteredData();
    const profInput = document.getElementById('profSelect');
    const profVal = parseFloat(profInput ? profInput.value : 0) || 0;

    // Si no hay datos, limpiamos los gráficos y salimos
    if (data.length === 0) {
        ['chartA', 'chartB', 'chartTime', 'chartPolar', 'chart3D'].forEach(id => {
            Plotly.newPlot(id, [], {title: 'Sin datos'});
        });
        return;
    }

    // 1. Gráficos de Perfil (A y B)
    const dates = [...new Set(data.map(d => d.fecha_str))].sort().reverse();
    const latestDate = dates[0]; 

    const formatDateES = (str) => {
        if(!str) return str;
        const [y, m, d] = str.split('-');
        return `${d}/${m}/${y}`;
    };

    function makeProfileTrace(axis) {
        const traces = [];
        dates.forEach(date => {
            const dateData = data.filter(d => d.fecha_str === date);
            const isLatest = (date === latestDate);

            traces.push({
                x: dateData.map(d => axis === 'A' ? d.valor_a : d.valor_b),
                y: dateData.map(d => d.profundidad),
                mode: isLatest ? 'lines+markers' : 'lines',
                name: formatDateES(date),
                
                // --- AÑADE ESTA LÍNEA AQUÍ ---
                zorder: isLatest ? 100 : 1, 
                // -----------------------------

                line: { width: isLatest ? 3 : 1 },
                marker: { size: 6, symbol: 'circle' },
                opacity: isLatest ? 1 : 0.7,
                showlegend: true,
                hovertemplate: `<b>${formatDateES(date)}</b><br>Prof: %{y:.1f}m<br>Desp: %{x:.2f}mm<extra></extra>`
            });
        });
        return traces;
    }

    const layoutProfile = (title) => ({
        title: title,
        yaxis: { title: 'Profundidad (m)', autorange: 'reversed' },
        xaxis: { title: 'Desplazamiento (mm)', range: [-20, 20] },
        shapes: [
            { type: 'rect', x0: -20, x1: -10, y0: 0, y1: 1, xref: 'x', yref: 'paper', fillcolor: 'yellow', opacity: 0.15, line: {width: 0}, layer: 'below' },
            { type: 'rect', x0: 10, x1: 20, y0: 0, y1: 1, xref: 'x', yref: 'paper', fillcolor: 'yellow', opacity: 0.15, line: {width: 0}, layer: 'below' },
            { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: currentSensorInfo.nf, y1: currentSensorInfo.nf, yref: 'y', line: { color: 'blue', dash: 'dash', width: 2 } }
        ],
        hovermode: 'closest'
    });

    Plotly.newPlot('chartA', makeProfileTrace('A'), layoutProfile('Eje A'));
    Plotly.newPlot('chartB', makeProfileTrace('B'), layoutProfile('Eje B'));

    // 2. Serie Temporal
    const dataProf = data.filter(d => parseFloat(d.profundidad) === profVal);
    
    const traceTimeA = { x: dataProf.map(d => d.fecha_str), y: dataProf.map(d => d.valor_a), name: 'Eje A', type: 'scatter', mode: 'lines+markers', marker: {color: COLOR_A} };
    const traceTimeB = { x: dataProf.map(d => d.fecha_str), y: dataProf.map(d => d.valor_b), name: 'Eje B', type: 'scatter', mode: 'lines+markers', marker: {color: COLOR_B} };

    const layoutTime = {
        title: `Serie Temporal - ${profVal}m`,
        yaxis: { title: 'Desplazamiento (mm)', range: [-20, 20] },
        shapes: [
            { type: 'rect', xref: 'paper', x0: 0, x1: 1, y0: 10, y1: 20, fillcolor: 'yellow', opacity: 0.15, line: {width: 0}, layer: 'below' },
            { type: 'rect', xref: 'paper', x0: 0, x1: 1, y0: -20, y1: -10, fillcolor: 'yellow', opacity: 0.15, line: {width: 0}, layer: 'below' },
            { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 10, y1: 10, line: { color: '#ffbd2e', dash: 'dash', width: 1 } },
            { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: -10, y1: -10, line: { color: '#ffbd2e', dash: 'dash', width: 1 } }
        ],
        hovermode: 'closest'
    };
    Plotly.newPlot('chartTime', [traceTimeA, traceTimeB], layoutTime);

    // 3. Polar
    const rVals = dataProf.map(d => Math.sqrt(d.valor_a**2 + d.valor_b**2));
    const thetaVals = dataProf.map(d => Math.atan2(d.valor_b, d.valor_a) * (180/Math.PI));
    
    Plotly.newPlot('chartPolar', [
        { type: 'scatterpolar', r: new Array(360).fill(10), theta: Array.from({length:360}, (_,i)=>i), mode: 'lines', line: {color: '#e8e01e'}, name: 'Umbral', hoverinfo: 'skip' },
        { type: 'scatterpolar', r: rVals, theta: thetaVals, mode: 'markers+lines', marker: { color: COLOR_A, size: 6 }, name: 'Lectura' }
    ], {
        title: 'Desplazamiento Polar (mm)',
        polar: { radialaxis: { range: [0, 20] } }
    });

    // 4. 3D
    Plotly.newPlot('chart3D', [{
        x: data.map(d => d.valor_a), y: data.map(d => d.valor_b), z: data.map(d => d.profundidad),
        mode: 'markers', marker: { size: 3, color: COLOR_A }, type: 'scatter3d'
    }], {
        title: 'Modelo 3D',
        scene: { xaxis: {title: 'A', range:[-20,20]}, yaxis: {title: 'B', range:[-20,20]}, zaxis: {title: 'Prof', autorange:'reversed'} },
        height: 600
    });
}

function initMap() {
    if (map) { map.remove(); map = null; }
    map = L.map('map').setView([40.416, -3.703], 6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    setTimeout(() => { map.invalidateSize(); }, 1000);
}

async function handleUpload(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const sel = document.getElementById('sensorSelect');
    if(!sel) return;
    formData.append('sensor_id', sel.value);

    showLoading(true);
    try {
        const res = await axios.post('api.php?action=upload', formData, { headers: {'Content-Type': 'multipart/form-data'} });
        if(res.data.success) {
            Swal.fire('Éxito', res.data.message, 'success');
            updateDashboard();
        } else {
            Swal.fire('Error', res.data.message, 'error');
        }
    } catch (err) {
        Swal.fire('Error', 'Fallo en la subida', 'error');
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if(overlay) overlay.style.display = show ? 'flex' : 'none';
}

// --- GESTIÓN DE VERSIONES ---

async function openVersionsModal(currentId) {
    const listContainer = document.getElementById('versionsList');
    listContainer.innerHTML = '<div class="p-3 text-center text-muted">Cargando versiones...</div>';
    
    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('versionsModal'));
    modal.show();

    try {
        const res = await axios.get(`api.php?action=get_versions&id=${currentId}`);
        const versiones = res.data;

        listContainer.innerHTML = ''; // Limpiar

        const versionConFinMasReciente = versiones.reduce((acc, v) => {
            if (!v.f_fin) return acc;
            const ts = new Date(v.f_fin.split('/').reverse().join('-')).getTime();
            if (!acc || ts > acc.ts) return { id: v.id, ts };
            return acc;
        }, null);

        versiones.forEach(v => {
            const isCurrent = (v.id == currentId); // ¿Es el que estamos viendo?
            const isPeriodoActual = versionConFinMasReciente && v.id == versionConFinMasReciente.id;
            
            // Texto de fechas
            let fechaTexto = 'Período: Sin datos';
            if (v.f_ini && v.f_fin) {
                fechaTexto = `Período: ${v.f_ini} - ${v.f_fin}`;
            }

            // Crear elemento de lista
            const item = document.createElement('button');
            item.className = `list-group-item list-group-item-action py-3 ${isCurrent ? 'active bg-light text-dark border-start border-4 border-primary' : ''}`;
            
            // Contenido HTML del botón
            item.innerHTML = `
                <div class="d-flex w-100 justify-content-between align-items-center">
                    <h6 class="mb-1 fw-bold">Período</h6>
                    ${isCurrent ? '<span class="badge bg-primary">Viendo ahora</span>' : ''}
                </div>
                <p class="mb-1 small">${fechaTexto}</p>
                ${isPeriodoActual ? '<span class="badge bg-success">Período actual</span>' : ''}
            `;

            // Al hacer clic
            if (!isCurrent) {
                item.onclick = () => switchVersion(v.id, modal);
            } else {
                item.style.cursor = 'default';
            }

            listContainer.appendChild(item);
        });

    } catch (err) {
        console.error(err);
        listContainer.innerHTML = '<div class="p-3 text-danger">Error al cargar versiones</div>';
    }
}

async function switchVersion(newId, modalInstance) {
    // 1. Cerrar modal
    modalInstance.hide();
    showLoading(true);

    // 2. Truco: El select principal a veces no tiene la opción antigua.
    // Vamos a forzar la actualización manual.
    
    // Actualizamos variable global (si la usas)
    // Pero lo más importante es llamar a updateDashboard con el nuevo ID.
    
    // Para que funcione con tu lógica actual que lee de 'sensorSelect', 
    // necesitamos añadir temporalmente esta opción al select si no existe.
    const sel = document.getElementById('sensorSelect');
    let opt = sel.querySelector(`option[value="${newId}"]`);
    
    if (!opt) {
        // Si es una versión antigua que no sale en el listado principal, la creamos al vuelo
        opt = document.createElement('option');
        opt.value = newId;
        opt.text = "Versión Histórica"; // Se actualizará luego
        opt.selected = true;
        sel.appendChild(opt);
    }
    
    sel.value = newId;

    // 3. Forzar actualización del dashboard
    // Necesitamos recargar la info del sensor (lat, lon, etc) porque puede haber cambiado en la versión vieja
    // Como tu función loadSensors solo carga los actuales, haremos una llamada extra rápida
    // O simplemente llamamos a updateDashboard y dejamos que él intente cargar.
    
    // TRUCO: Volver a cargar los sensores pero asegurarnos de que el seleccionado es el newId
    // Esto es complejo. Lo más fácil es:
    
    console.log("Cambiando a versión ID:", newId);
    
    // Llamada directa a obtener datos
    await updateDashboard(); 

    // Actualizar visualmente que estamos en una versión antigua
    const infoNombre = document.getElementById('infoNombre');
    if(infoNombre) infoNombre.innerHTML += ` <span class="badge bg-warning text-dark">HISTÓRICO</span>`;

    showLoading(false);
}