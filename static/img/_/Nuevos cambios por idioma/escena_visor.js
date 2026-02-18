// escena_visor.js - VERSIÓN FINAL UNIFICADA Y COMPLETA

document.addEventListener('DOMContentLoaded', () => {
    // --- REFERENCIAS A ELEMENTOS DEL DOM ---
    const planoPrincipalCentro = document.getElementById('plano-principal-centro');
    const sensoresSidebarList = document.getElementById('lista-sensores-sidebar');
    const dashboardContainer = document.getElementById('dashboard-container');
    const tituloHeaderDinamico = document.getElementById('scene-header-main-title');
    const tituloPaginaDinamico = document.getElementById('scene-page-title-dinamico');
    const botonDashboardObra = document.getElementById('botonDashboardObra'); 
    const botonToggleVista = document.getElementById('botonToggleVista');
    const botonTodosSensores = document.getElementById('botonTodosSensores');
    const todosSensoresContainer = document.getElementById('todos-sensores-container');
    const variableSelectModal = document.getElementById('variable-select-modal');
    const variableModalCloseBtn = document.getElementById('variable-modal-close-btn');
    const variableModalTitle = document.getElementById('variable-modal-title');
    const variableButtonsContainer = document.getElementById('variable-buttons-container');
    const groupSelectModal = document.getElementById('group-select-modal');
    const groupModalCloseBtn = document.getElementById('group-modal-close-btn');
    const groupModalTitle = document.getElementById('group-modal-title');
    const groupSensorsList = document.getElementById('group-sensors-list');
    const customChartCreatorPanel = document.getElementById('custom-chart-creator');
    const createCustomChartBtn = document.getElementById('create-custom-chart-btn');
    const sensorSelectCustom = document.getElementById('sensor-select-custom');
    const toggleCreatorBtn = document.getElementById('toggle-custom-chart-creator-btn');

    // --- VARIABLES GLOBALES ---
    let vistaActualEsDashboard = false;
    let configActualEscena = null;
    let activeWindows = {};
    let activeCharts = {}; 
    let activeIndividualCharts = {}; 
    let highestZIndex = 1100;
    let slimSelectInstance = null;
    let translations = {};


    const CHART_COLORS_PALETTE = [
    '#9cbbd3', '#7cb5ec', '#434348', '#90ed7d', '#f7a35c', 
    '#f15c80', '#e4d354', '#2b908f', '#f45b5b', '#91e8e1'
    ];

    // --- PUNTO DE ENTRADA PRINCIPAL ---
    async function inicializarApp() {
        if (window.ChartAnnotation) Chart.register(window.ChartAnnotation);
        if (window.ChartZoom) Chart.register(window.ChartZoom);
        if (window.flatpickr) initializeFlatpickr();

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const idEscenaActual = urlParams.get('id');
            if (!idEscenaActual) throw new Error("Falta el parámetro ?id de la obra.");

            const lang = urlParams.get('lang') || 'es';
            await loadTranslations(lang);
            
            const configUrl = `config/obras/${idEscenaActual}.json?v=${new Date().getTime()}`;
            const response = await fetch(configUrl);
            if (!response.ok) throw new Error(`No se encontró el config para '${idEscenaActual}'.`);
            
            // Aquí usamos la variable ya corregida
            configActualEscena = await response.json(); 
            
            applyStaticTranslations(lang);
            actualizarBotonDashboard();

            const vistaInicial = urlParams.get('vista');
            if (vistaInicial === 'dashboard') {
                mostrarVistaDashboard();
            } else {
                // La vista por defecto siempre será la de los planos
                mostrarVistaPlanos();
            }
            
        } catch (error) {
            handleFatalError(error.message);
        }
        
        initializeModals();
        initializeLanguageSwitcher();
    }

    async function loadTranslations(lang) {
        const response = await fetch(`lang/${lang}.json`);
        if (!response.ok) {
            console.error(`No se pudo cargar el archivo de traducción para '${lang}'.`);
            translations = {}; // Usar un objeto vacío como fallback
            return;
        }
        translations = await response.json();
    }

    function t(key) {
        return translations[key] || key; // Si no encuentra la clave, devuelve la clave misma
    }

    function applyStaticTranslations(lang) {
        document.querySelectorAll('[data-lang]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        const langMap = {
            '#botonToggleVista': 'visor',
            'a[href="informe_datos.php"]': 'reports',
            '.sidebar-title-container h3': 'sensorsInPlanes',
            '.time-range-btn[data-range="day"]': 'day',
            '.time-range-btn[data-range="week"]': 'week',
            '.time-range-btn[data-range="month"]': 'month',
            'label[for="start-time"]': 'from',
            'label[for="end-time"]': 'to',
            '#refresh-btn': 'filter',
            '#toggle-custom-chart-creator-btn': 'createChart',
            '#custom-chart-creator h2': 'customChartTitle',
            '#custom-chart-creator p': 'customChartSelect',
            '#custom-chart-creator label[for="sensor-select-custom"]': 'customChartSensorLabel',
            '#create-custom-chart-btn': 'customChartCreateBtn',
            '.alert-panel-header h3': 'activeAlarms',
            'a[href="mi_perfil.php"]': 'myProfile',
            'a[href="api/api_logout.php"]': 'logout'
        };

        for (const selector in langMap) {
            const element = document.querySelector(selector);
            
            if (element) {
                const key = langMap[selector];
                // Si el elemento es un icono, encontramos su 'padre' (el enlace <a>)
                const targetElement = element.tagName === 'I' ? element.parentElement : element;
                const icon = targetElement.querySelector('i');
                
                if (icon) {
                    // Reconstruimos el contenido: el icono + un espacio + el texto traducido
                    targetElement.innerHTML = `${icon.outerHTML} ${t(key)}`;
                } else {
                    targetElement.textContent = t(key);
                }
            } /*else {
                console.warn(`Elemento no encontrado para el selector de traducción: ${selector}`);
            }*/
        }
        
        if (vistaActualEsDashboard) {
            tituloHeaderDinamico.textContent = t('dashboard');
        } else {
            tituloHeaderDinamico.textContent = t('visor');
        }
    }

    function initializeLanguageSwitcher() {
        document.getElementById('language-switcher').addEventListener('click', (e) => {
            e.preventDefault();
            if (e.target.tagName === 'A' && e.target.dataset.lang) {
                const newLang = e.target.dataset.lang;
                const url = new URL(window.location);
                url.searchParams.set('lang', newLang);
                window.location.href = url.toString(); // Recargar la página con el nuevo idioma
            }
        });
    }

    function handleFatalError(message) {
        console.error("Error fatal:", message);
        planoPrincipalCentro.innerHTML = `<p class="loading-message error">${message}</p>`;
        if (tituloPaginaDinamico) tituloPaginaDinamico.textContent = "Error";
        if (tituloHeaderDinamico) tituloHeaderDinamico.textContent = "Error";
        if (botonDashboardObra) botonDashboardObra.style.display = 'none';
        document.title = "Error - Carga de Obra";
    }

    function initializeModals() {
        if (variableSelectModal) { variableModalCloseBtn.addEventListener('click', () => variableSelectModal.style.display = 'none'); variableSelectModal.addEventListener('click', (e) => { if (e.target === variableSelectModal) variableSelectModal.style.display = 'none'; }); }
        if (groupSelectModal) { groupModalCloseBtn.addEventListener('click', () => groupSelectModal.style.display = 'none'); groupSelectModal.addEventListener('click', (e) => { if (e.target === groupSelectModal) groupSelectModal.style.display = 'none'; }); }
    }

    function initializeFlatpickr() {
        const urlParams = new URLSearchParams(window.location.search);
        const lang = urlParams.get('lang') || 'es';

        // Primero, establecemos el idioma global para flatpickr
        if (lang === 'fr' && flatpickr.l10ns.fr) {
            flatpickr.localize(flatpickr.l10ns.fr);
        } else {
            flatpickr.localize(flatpickr.l10ns.es);
        }
        
        const commonConfig = {
            enableTime: true,
            dateFormat: "Y-m-d H:i",
            altInput: true,
            altFormat: "d/m/Y H:i",
            // Ya no es necesario poner 'locale' aquí, porque lo hemos hecho globalmente
            plugins: [new confirmDatePlugin({ confirmText: "Aceptar", showAlways: true })]
        };
        
        if (document.getElementById('start-time')) flatpickr("#start-time", commonConfig);
        if (document.getElementById('end-time')) flatpickr("#end-time", commonConfig);

        if (document.getElementById('start-time_ts')) flatpickr("#start-time_ts", commonConfig);
        if (document.getElementById('end-time_ts')) flatpickr("#end-time_ts", commonConfig);
    }

    function cargarVistaUnificada(config) {
        planoPrincipalCentro.innerHTML = ''; sensoresSidebarList.innerHTML = ''; dashboardContainer.style.display = 'none';
        document.getElementById('vista-unificada-container').style.display = 'flex';
        if (tituloHeaderDinamico) tituloHeaderDinamico.textContent = t('visor');
        if (tituloPaginaDinamico) tituloPaginaDinamico.textContent = config.nombreParaTitulo;
        document.title = `${config.nombreParaTitulo} - Calsens`;

        if (config.planos2D && config.planos2D.length > 0) {
            config.planos2D.forEach((plano, index) => {
                const seccionPlano = document.createElement('div'); seccionPlano.className = 'plano-seccion';
                if (plano.titulo) { const tituloElemento = document.createElement('h3'); tituloElemento.className = 'plano-titulo'; tituloElemento.textContent = plano.titulo; seccionPlano.appendChild(tituloElemento); }
                const imgContainer = document.createElement('div'); imgContainer.className = 'plano-imagen-contenedor';
                const imgElement = document.createElement('img'); imgElement.src = plano.rutaImagen; imgElement.alt = plano.titulo || 'Plano';
                imgElement.addEventListener('load', () => { cargarPuntosInteresYActualizarSensores(imgContainer, index, plano.titulo || 'Plano sin título'); });
                imgContainer.appendChild(imgElement); seccionPlano.appendChild(imgContainer); planoPrincipalCentro.appendChild(seccionPlano);
            });
        } else { planoPrincipalCentro.innerHTML = '<p class="loading-message">No hay planos 2D definidos para esta obra.</p>'; }
    }

    function actualizarBotonDashboard() {
        if (configActualEscena && botonToggleVista) {
            botonToggleVista.style.display = 'inline-block';
            botonToggleVista.onclick = toggleVistaPrincipal; // Correcto

            // Añadimos el listener para el nuevo botón
            if (botonTodosSensores) {
                botonTodosSensores.style.display = 'inline-block';
                botonTodosSensores.onclick = (e) => {
                    e.preventDefault();
                    mostrarVistaTodosSensores();
                };
            }

        } else if (botonToggleVista) {
            botonToggleVista.style.display = 'none';
            if (botonTodosSensores) botonTodosSensores.style.display = 'none';
        }
    }

    function toggleVistaPrincipal() {
        if (dashboardContainer.style.display === 'none') {
            mostrarVistaDashboard();
        } else {
            mostrarVistaPlanos();
        }
    }

    function mostrarVistaPlanos() {
        dashboardContainer.style.display = 'none';
        todosSensoresContainer.style.display = 'none';
        document.getElementById('vista-unificada-container').style.display = 'flex';
        
        vistaActualEsDashboard = false;
        tituloHeaderDinamico.textContent = t('visor');
        if (configActualEscena) {
            tituloPaginaDinamico.textContent = configActualEscena.nombreParaTitulo;
            // La clave: Dibujamos los planos aquí si no existen
            if (planoPrincipalCentro.innerHTML.trim() === '') {
                cargarVistaUnificada(configActualEscena);
            }
        }
        botonToggleVista.innerHTML = `<i class="fas fa-chart-line"></i> Dashboard`;
        botonToggleVista.title = "Ver Dashboard de la Obra";
    }

    function mostrarVistaDashboard() {
        document.getElementById('vista-unificada-container').style.display = 'none';
        todosSensoresContainer.style.display = 'none';
        dashboardContainer.style.display = 'flex';
        
        vistaActualEsDashboard = true;
        tituloHeaderDinamico.textContent = "Dashboard";
        if (configActualEscena) {
            tituloPaginaDinamico.textContent = configActualEscena.nombreParaTitulo;
        }
        botonToggleVista.innerHTML = `<i class="fas fa-ruler-combined"></i>  Voir les plans`;
        botonToggleVista.title = "Volver al Visor de Planos";

        setupDashboardToolbarListeners();

        // Carga los datos de la semana por defecto SÓLO si no hay gráficos cargados
        if (Object.keys(activeCharts).length === 0) {
            const rangeButton = document.querySelector('.time-range-btn[data-range="week"]');
            if (rangeButton) {
                rangeButton.click();
            }
        }
    }
    
    // ===== NUEVA FUNCIÓN PARA MOSTRAR TODOS LOS SENSORES =====
    function mostrarVistaTodosSensores() {
        document.getElementById('vista-unificada-container').style.display = 'none';
        dashboardContainer.style.display = 'none';
        todosSensoresContainer.style.display = 'flex';

        vistaActualEsDashboard = true; 
        if (tituloHeaderDinamico) tituloHeaderDinamico.textContent = "Tous les capteurs";
        if (tituloPaginaDinamico) tituloPaginaDinamico.textContent = configActualEscena.nombreParaTitulo;
        
        // --- LÍNEA A AÑADIR ---
        setupTodosSensoresToolbarListeners();
        
        // Para la primera carga, simulamos un clic en "Semana"
        const hayGraficos = document.getElementById('todos-sensores-grid').querySelector('.chart-container');
        if (!hayGraficos) {
            const rangeButton = document.querySelector('.time-range-btn-ts[data-range="week"]');
            if (rangeButton) rangeButton.click();
        }
    }

    function setupDashboardToolbarListeners() {
        const timeRangeButtons = document.querySelectorAll('.time-range-btn');
        timeRangeButtons.forEach(button => {
            if (button.dataset.listenerAttached) return;
            button.addEventListener('click', () => {
                const range = button.dataset.range;
                const now = new Date();
                let start = new Date();
                if (range === 'day') start.setDate(now.getDate() - 1);
                else if (range === 'week') start.setDate(now.getDate() - 7);
                else if (range === 'month') start.setMonth(now.getMonth() - 1);
                document.getElementById('start-time')._flatpickr.setDate(start);
                document.getElementById('end-time')._flatpickr.setDate(now);
                timeRangeButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                fetchAndDrawCharts();
            });
            button.dataset.listenerAttached = 'true';
        });

        const refreshButton = document.getElementById('refresh-btn');
        if (refreshButton && !refreshButton.dataset.listenerAttached) {
            refreshButton.addEventListener('click', () => {
                document.querySelectorAll('.time-range-btn').forEach(btn => btn.classList.remove('active'));
                fetchAndDrawCharts();
            });
            refreshButton.dataset.listenerAttached = 'true';
        }

        if (toggleCreatorBtn && customChartCreatorPanel) {
            if (!toggleCreatorBtn.dataset.listenerAttached) {
                toggleCreatorBtn.addEventListener('click', () => {
                    const isVisible = customChartCreatorPanel.style.display === 'block';
                    customChartCreatorPanel.style.display = isVisible ? 'none' : 'block';
                    if (!isVisible) {
                        // ¡La llamada a populateCustomChartSelector solo ocurre aquí!
                        populateCustomChartSelector(); 
                    }
                });
                toggleCreatorBtn.dataset.listenerAttached = 'true';
            }
        }
        
        if (createCustomChartBtn && !createCustomChartBtn.dataset.listenerAttached) {
            createCustomChartBtn.addEventListener('click', handleCreateCustomChart);
            createCustomChartBtn.dataset.listenerAttached = 'true';
        }
    }

    function setupTodosSensoresToolbarListeners() {
        const timeRangeButtons = document.querySelectorAll('.time-range-btn-ts');
        timeRangeButtons.forEach(button => {
            if (button.dataset.listenerAttached) return;
            button.addEventListener('click', () => {
                const range = button.dataset.range;
                const now = new Date();
                let start = new Date();
                if (range === 'day') start.setDate(now.getDate() - 1);
                else if (range === 'week') start.setDate(now.getDate() - 7);
                else if (range === 'month') start.setMonth(now.getMonth() - 1);
                
                document.getElementById('start-time_ts')._flatpickr.setDate(start);
                document.getElementById('end-time_ts')._flatpickr.setDate(now);

                timeRangeButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Llamamos a la función que carga los gráficos individuales
                cargarTodosLosGraficosIndividuales();
            });
            button.dataset.listenerAttached = 'true';
        });

        const refreshButton = document.getElementById('refresh-btn_ts');
        if (refreshButton && !refreshButton.dataset.listenerAttached) {
            refreshButton.addEventListener('click', () => {
                document.querySelectorAll('.time-range-btn-ts').forEach(btn => btn.classList.remove('active'));
                
                // Llamamos a la función que carga los gráficos individuales
                cargarTodosLosGraficosIndividuales();
            });
            refreshButton.dataset.listenerAttached = 'true';
        }
    }

    async function fetchAndDrawCharts() {
        const chartsGrid = document.getElementById('charts-grid');

        // --- INICIO DE LA CORRECCIÓN ---
        // 1. Destruimos los gráficos del dashboard que existan.
        Object.values(activeCharts).forEach(chart => chart.destroy());
        
        // 2. Reseteamos el objeto de seguimiento.
        activeCharts = {};
        // --- FIN DE LA CORRECCIÓN ---

        // 3. Limpiamos el DOM (tu código original ya hacía esto correctamente).
        chartsGrid.querySelectorAll('.chart-container:not(.creator-panel)').forEach(el => el.remove());
        const existingMessage = chartsGrid.querySelector('.loading-message, .error');
        if (existingMessage) existingMessage.remove();

        // El resto de la función permanece igual...
        const loadingMessage = document.createElement('p'); 
        loadingMessage.className = 'loading-message';
        loadingMessage.textContent = 'Cargando gráficos por defecto...'; 
        chartsGrid.appendChild(loadingMessage);

        const startTime = document.getElementById('start-time')._flatpickr.selectedDates[0]?.toISOString();
        const endTime = document.getElementById('end-time')._flatpickr.selectedDates[0]?.toISOString();
        if (!startTime || !endTime) { loadingMessage.textContent = 'Selecciona un rango de fechas.'; return; }

        try {
            const apiUrl = `api/api_get_dashboard_data.php?obra=${configActualEscena.idEscena}&startTime=${startTime}&endTime=${endTime}`;
            const response = await fetch(apiUrl); 

            if (response.status === 401) {
                alert("Tu sesión ha expirado. Por favor, inicia sesión de nuevo.");
                window.location.href = 'login.html';
                return; 
            }

            if (!response.ok) {
                throw new Error(`El servidor respondió con estado ${response.status}`);
            }

            const datosAgrupados = await response.json(); loadingMessage.remove();
            if (Object.keys(datosAgrupados).length === 0) { 
                if (chartsGrid.childElementCount <= 1) { 
                    chartsGrid.insertAdjacentHTML('beforeend', '<p class="loading-message">No hay datos para este rango.</p>'); 
                } return; 
            }
            for (const variable in datosAgrupados) { 
                createChartCard(variable, datosAgrupados[variable], false); 
            }
        } catch (error) { console.error('Error al dibujar gráficos:', error); chartsGrid.innerHTML = `<p class="loading-message error">Error: ${error.message}</p>`; }
    }

    function createChartCard(title, data, isCustom) {
        const chartId = `chart-${isCustom ? 'custom-' : ''}${title.replace(/\s+/g, '-')}-${Date.now()}`;

        const futureCanvasId = chartId;
        const existingChart = Chart.getChart(futureCanvasId);
        if (existingChart) {
            existingChart.destroy();
        }

        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';

        // Lógica de traducción para el título del gráfico
        const variableKey = Object.keys(translations).find(key => translations[key] === title);
        const translatedTitle = t(variableKey || title);
        chartContainer.innerHTML = `<h2>${translatedTitle}</h2><div class="chart-canvas-wrapper"><canvas id="${chartId}"></canvas></div>`;
        
        const chartsGrid = document.getElementById('charts-grid');
        isCustom ? chartsGrid.prepend(chartContainer) : chartsGrid.appendChild(chartContainer);
        
        // ... (el resto de la función es idéntico al que ya tienes y funciona bien)
        const datasets = []; const yAxes = {}; let axisCount = 0; 
        const variableToAxisId = new Map();



        const isLightMode = document.body.classList.contains('light-mode');
        const textColor = isLightMode ? '#333' : '#e0e0e0'; const gridColor = isLightMode ? '#e0e0e0' : '#4a4a4c';
        let colorIndex = 0;
        for (const sensorId in data) {
            const dataPoints = data[sensorId].map(point => ({ x: point.timestamp, y: point.lectura }));
            const variableInfo = data[sensorId][0] || {};
            const variableName = variableInfo.variable || title; 
            const unidad = variableInfo.unidad || '';
            const variableKey = Object.keys(translations).find(key => translations[key] === variableName);
            const translatedVariableName = t(variableKey || variableName);
            let yAxisID;
            if (!variableToAxisId.has(variableName)) {
                yAxisID = axisCount === 0 ? 'y' : `y${axisCount}`; 
                variableToAxisId.set(variableName, yAxisID);
                const variableKeyEje = Object.keys(translations).find(key => translations[key] === variableName);


                const translatedVariableName = t(variableKeyEje || variableName);
                const axisTitle = unidad ? `${translatedVariableName} (${unidad})` : translatedVariableName;

                yAxes[yAxisID] = {
                     type: 'linear', 
                     position: axisCount % 2 === 0 ? 'left' : 'right', 
                     title: { display: true, text: axisTitle, color: textColor },
                     grid: { drawOnChartArea: axisCount === 0, color: gridColor },
                     ticks: { color: textColor } 
                };

                axisCount++;

            } else { 
                yAxisID = variableToAxisId.get(variableName); 
            }
            const sensorType = sensorId.split('_')[0].replace(/[0-9]/g, '');
            datasets.push({ 
                label: sensorId, 
                data: dataPoints, 
                yAxisID: yAxisID, 
                borderColor: CHART_COLORS_PALETTE[colorIndex % CHART_COLORS_PALETTE.length], 
                borderWidth: 1.5, pointRadius: 0, tension: 0.1 
            });
            colorIndex++;
        }
        const options = { responsive: true, maintainAspectRatio: false, interaction: { mode: 'nearest', intersect: false }, plugins: { legend: { display: true, labels: { color: textColor } }, title: { display: false }, zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } } }, scales: { x: { type: 'time', time: { tooltipFormat: 'dd/MM/yy HH:mm' }, ticks: { color: textColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { color: gridColor } }, ...yAxes } };
        const ctx = document.getElementById(chartId).getContext('2d');
        activeCharts[chartId] = new Chart(ctx, { type: 'line', data: { datasets }, options });
    }

    function getUnifiedChartOptions(showLegend = true) {
        const isLightMode = document.body.classList.contains('light-mode');
        const textColor = isLightMode ? '#333' : '#e0e0e0';
        const gridColor = isLightMode ? '#e0e0e0' : '#4a4a4c';
        
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', intersect: false },
            plugins: {
                legend: { 
                    display: showLegend, 
                    labels: { color: textColor } 
                },
                title: { display: false },
                zoom: { 
                    pan: { enabled: true, mode: 'x' }, 
                    zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } 
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: { tooltipFormat: 'dd/MM/yy HH:mm' },
                    ticks: { color: textColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
                    grid: { color: gridColor }
                },
                y: {
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                }
            }
        };
    }

    //ALERTAS
    function checkAlerts(sensorId, dataPoints, variable) {
        const sensorThresholds = SENSOR_THRESHOLDS[sensorId];
        const variableKey = variable.toLowerCase().startsWith('deformaci') ? 'deformation' : 'temperature';
        if (!sensorThresholds || !sensorThresholds[variableKey]) return [];

        const alerts = [];
        const thresholds = sensorThresholds[variableKey];
        dataPoints.forEach(point => {
            thresholds.forEach(threshold => {
                const { level, upper, lower, label } = threshold;
                let triggered = false, message = '';
                if (point.y > upper) {
                    triggered = true;
                    message = `${variable} superó el umbral de ${label} (${upper}) con un valor de <span>${point.y.toFixed(3)}</span>.`;
                } else if (point.y < lower) {
                    triggered = true;
                    message = `${variable} cayó por debajo del umbral de ${label} (${lower}) con un valor de <span>${point.y.toFixed(3)}</span>.`;
                }
                if (triggered) {
                    alerts.push({
                        id: `${sensorId}-${variable}-${level}-${point.x}`, sensorId, level, message, timestamp: point.x
                    });
                }
            });
        });
        return alerts;
    }

    function updateAlertFilterOptions() {
        if (!alertSensorFilter) return;
        const previousValue = alertSensorFilter.value;
        alertSensorFilter.innerHTML = '<option value="all">Todos los sensores</option>';

        const sensorsWithAlerts = new Set();
        Object.values(activeAlerts).flat().forEach(alert => {
            sensorsWithAlerts.add(alert.sensorId);
        });
        const sortedSensors = Array.from(sensorsWithAlerts).sort();

        sortedSensors.forEach(sensorId => {
            const option = document.createElement('option');
            option.value = sensorId;
            option.textContent = sensorId;
            alertSensorFilter.appendChild(option);
        });

        if (Array.from(alertSensorFilter.options).some(opt => opt.value === previousValue)) {
            alertSensorFilter.value = previousValue;
        } else {
            currentAlertFilter = 'all';
        }
    }

    function renderAlerts(acknowledgedAlarmsSet = new Set()) {
        if (!alertTableBody || !alertCountDanger || !alertCountWarning) return;

        let allAlerts = Object.values(activeAlerts).flat();
        alertTableBody.innerHTML = '';

        const filteredAlerts = currentAlertFilter === 'all'
            ? allAlerts
            : allAlerts.filter(alert => alert.sensorId === currentAlertFilter);

        if (filteredAlerts.length === 0) {
            const message = currentAlertFilter === 'all'
                ? 'No hay alarmas activas en el rango de tiempo seleccionado.'
                : `No hay alarmas para el sensor ${currentAlertFilter}.`;
            alertTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color: #7c8f9b;">${message}</td></tr>`;
        } else {
            filteredAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            filteredAlerts.forEach(alert => {
                const isAcknowledged = acknowledgedAlarmsSet.has(alert.id);
                const row = document.createElement('tr');
                row.dataset.level = alert.level;
                row.onclick = () => openAlarmDetailsModal(alert);

                const date = new Date(alert.timestamp);
                const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                const reconocidaHtml = isAcknowledged ? '<i class="fas fa-check-circle acknowledged-icon"></i>' : '—';

                row.innerHTML = `
                    <td>${alert.sensorId}</td>
                    <td>${alert.message.replace(/<\/?span>/g, '')}</td>
                    <td>${formattedDate}</td>
                    <td>${reconocidaHtml}</td>
                `;
                alertTableBody.appendChild(row);
            });
        }

        const totalDanger = allAlerts.filter(a => a.level === 'danger').length;
        const totalWarning = allAlerts.filter(a => a.level === 'warning').length;
        if (alertCountDanger) alertCountDanger.textContent = totalDanger;
        if (alertCountWarning) alertCountWarning.textContent = totalWarning;
    }

    async function openAlarmDetailsModal(alert) {
        alarmDetailsTitle.textContent = `Alarma en ${alert.sensorId}`;
        alarmDetailsDescription.textContent = alert.message.replace(/<\/?span>/g, '');
        commentTextarea.value = '';

        await fetchAndDisplayComments(alert.id);

        commentForm.onsubmit = async (e) => {
            e.preventDefault();
            const commentText = commentTextarea.value.trim();
            if (commentText) {
                await saveComment(alert.id, commentText);

                // Refrescar la lista de comentarios en el modal actual
                await fetchAndDisplayComments(alert.id);

                // Volver a cargar TODA la información de alarmas para actualizar la tabla principal
                const response = await fetch('api/api_get_comments.php');
                const acknowledgedData = await response.json();
                const acknowledgedSet = new Set(acknowledgedData.map(item => item.alarm_id));
                renderAlerts(acknowledgedSet);
            }
        };

        alarmDetailsModal.style.display = 'flex';
    }

    async function fetchAndDisplayComments(alarmId) {
        commentsList.innerHTML = '<p>Cargando comentarios...</p>';
        try {
            const response = await fetch(`api/api_get_comments.php?alarm_id=${encodeURIComponent(alarmId)}`);
            const comments = await response.json();

            if (comments.length > 0) {
                acknowledgedAlarms.add(alarmId);
                commentsList.innerHTML = '';
                comments.forEach(comment => {
                    const date = new Date(comment.created_at);
                    const formattedDate = `${date.toLocaleDateString()} a las ${date.toLocaleTimeString()}`;
                    const commentEl = document.createElement('div');
                    commentEl.className = 'comment-item';
                    commentEl.innerHTML = `
                    <div class="comment-meta">
                        <span class="user">${comment.user_id || 'Usuario'}</span> - <span>${formattedDate}</span>
                    </div>
                    <p class="comment-text">${comment.comment_text}</p>
                `;
                    commentsList.appendChild(commentEl);
                });
            } else {
                commentsList.innerHTML = '<p class="no-alerts">No hay comentarios para esta alarma.</p>';
            }
        } catch (error) {
            commentsList.innerHTML = '<p class="error-message">No se pudieron cargar los comentarios.</p>';
        }
    }

    async function saveComment(alarmId, commentText) {
        try {
            const response = await fetch('api/api_save_comment.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alarm_id: alarmId, comment_text: commentText })
            });
            if (!response.ok) throw new Error('El servidor no pudo guardar el comentario.');
        } catch (error) {
            console.error("Error al guardar comentario:", error);
            alert("No se pudo guardar el comentario.");
        }
    }

    function handleSensorClick(sensorId, sensorTitulo) {
        const sensorType = sensorId.replace(/[0-9]/g, '');
        const variables = configActualEscena.configuracionSensores.variablesMap[sensorType];
        if (variables && variables.length > 1) { showVariableSelector(sensorId, sensorTitulo, variables); }
        else if (variables && variables.length === 1) {
            const variable = variables[0];
            const fullSensorId = variable.sufijo ? `${sensorId}_${variable.sufijo}` : sensorId;
            createSensorChartWindow(fullSensorId, sensorTitulo, variable.nombreKey);
        } else { console.warn(`No hay variables definidas para: ${sensorType}`); createSensorChartWindow(sensorId, sensorTitulo, 'Lectura'); }
    }

    function showVariableSelector(sensorId, sensorTitulo, variables) {
        if (!variableSelectModal) return;
        variableModalTitle.textContent = `¿Qué desea graficar para ${sensorTitulo}?`;
        variableButtonsContainer.innerHTML = '';
        variables.forEach(variable => {
            const button = document.createElement('button'); button.className = 'variable-select-btn';
            button.textContent = t(variable.nombreKey);
            button.onclick = () => {
                variableSelectModal.style.display = 'none';
                const fullSensorId = variable.sufijo ? `${sensorId}_${variable.sufijo}` : sensorId;
                createSensorChartWindow(fullSensorId, sensorTitulo, t(variable.nombreKey));
            };
            variableButtonsContainer.appendChild(button);
        });
        variableSelectModal.style.display = 'flex';
    }

    function showGroupSelectorModal(group) {
        if (!groupSelectModal) return;
        groupModalTitle.textContent = group.titulo || 'Sensores en el Grupo';
        groupSensorsList.innerHTML = '';
        group.items.forEach(item => {
            const button = document.createElement('button'); button.className = 'group-sensor-item';
            button.textContent = item.titulo || item.id;
            button.onclick = () => { groupSelectModal.style.display = 'none'; handleSensorClick(item.id, item.titulo || item.id); };
            groupSensorsList.appendChild(button);
        });
        groupSelectModal.style.display = 'flex';
    }

    function cargarPuntosInteresYActualizarSensores(contenedorImgDiv, indicePlano, tituloDelPlano) {
        const plano = configActualEscena.planos2D[indicePlano]; if (!plano || !plano.puntosInteres) return;
        const planTitleDiv = document.createElement('div'); planTitleDiv.className = 'sensor-item-plan-title';
        planTitleDiv.textContent = tituloDelPlano; sensoresSidebarList.appendChild(planTitleDiv);
        plano.puntosInteres.forEach(punto => {
            const marker = document.createElement('div'); marker.className = punto.type === 'group' ? 'plano-marker-group' : 'plano-marker';
            marker.style.left = punto.x + '%'; marker.style.top = punto.y + '%'; marker.title = punto.titulo;
            marker.onclick = () => punto.type === 'group' ? showGroupSelectorModal(punto) : handleSensorClick(punto.id, punto.titulo);
            contenedorImgDiv.appendChild(marker);
            const itemsToList = punto.type === 'group' ? punto.items : [punto];
            itemsToList.forEach(item => {
                const sensorDiv = document.createElement('li'); sensorDiv.className = 'sensor-item';
                const titulo = item.titulo || item.id;
                sensorDiv.innerHTML = `<h4>${titulo}</h4><p>${punto.type === 'group' ? `En ${punto.titulo}` : ''}</p>`;
                sensorDiv.onclick = () => handleSensorClick(item.id, titulo);
                sensoresSidebarList.appendChild(sensorDiv);
            });
        });
    }

    async function createSensorChartWindow(fullSensorId, sensorTitulo, variableNombre) {
        const modalId = `modal-window-${fullSensorId.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const windowTitle = `${sensorTitulo} - ${variableNombre}`;

        if (document.getElementById(modalId)) {
            document.getElementById(modalId).style.zIndex = ++highestZIndex;
            return;
        }

        const windowEl = document.createElement('div');
        windowEl.id = modalId;
        windowEl.className = 'chart-window';
        windowEl.style.zIndex = ++highestZIndex;
        windowEl.innerHTML = `<div class="chart-window-header"><span class="chart-window-title">Cargando...</span><button class="chart-window-close">×</button></div><div class="chart-window-body"><canvas></canvas></div><div class="chart-window-resize-handle"></div>`;
        document.body.appendChild(windowEl);
        makeWindowInteractive(windowEl);

        const titleEl = windowEl.querySelector('.chart-window-title');
        const closeBtn = windowEl.querySelector('.chart-window-close');
        const canvas = windowEl.querySelector('canvas');
        const bodyEl = windowEl.querySelector('.chart-window-body');

        closeBtn.onclick = () => {
            if (activeWindows[modalId]?.chart) activeWindows[modalId].chart.destroy();
            delete activeWindows[modalId];
            windowEl.remove();
        };
        
        const startTime = new Date('1970-01-01T00:00:00.000Z');
        const endTime = new Date('2099-12-31T23:59:59.000Z');
        const apiUrl = `api/api_get_sensor_data.php?obra=${configActualEscena.idEscena}&sensorId=${fullSensorId}&startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`;
        
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`Error de red: ${response.status}`);
            const data = await response.json();
            
            if (!Array.isArray(data) || data.length === 0) throw new Error('No se encontraron datos.');
            const dataPoints = data.map(row => ({ x: row.timestamp, y: parseFloat(row.lectura) })).filter(point => !isNaN(point.y));
            if (dataPoints.length === 0) throw new Error(`No hay datos numéricos.`);
            
            const sensorBaseId = fullSensorId.split('_')[0];
            const sensorType = sensorBaseId.replace(/[0-9]/g, '');
            const suffix = fullSensorId.split('_')[1] || '';
            
            const variables = configActualEscena.configuracionSensores.variablesMap[sensorType] || [];
            
            // --- LÍNEA CORREGIDA (ESTA FALTABA) ---
            const variableInfo = variables.find(v => v.sufijo === suffix) || variables[0];

            const finalVariableName = variableInfo ? t(variableInfo.nombreKey) : variableNombre;
            const unidad = variableInfo ? `(${variableInfo.unidad})` : '';
            
            titleEl.textContent = `${sensorTitulo} - ${finalVariableName}`;
            const color = configActualEscena.configuracionSensores.colorMap[sensorType] || '#95a5a6';
            const options = getUnifiedChartOptions(false);
            const textColor = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
            options.scales.y.title = { display: true, text: `${finalVariableName} ${unidad}`, color: textColor };
            
            const chart = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    datasets: [{
                        label: `${sensorTitulo} (${finalVariableName})`,
                        data: dataPoints,
                        borderColor: color,
                        borderWidth: 1.5,
                        pointRadius: 0,
                        tension: 0.1
                    }]
                },
                options: options
            });
            activeWindows[modalId] = { chart };
        } catch (error) {
            console.error(`Error al crear ventana para ${fullSensorId}:`, error);
            titleEl.textContent = `Error: ${sensorTitulo}`;
            bodyEl.innerHTML = `<p class="chart-window-error">${error.message}</p>`;
        }
    }

    function makeWindowInteractive(windowEl) {
        const header = windowEl.querySelector('.chart-window-header'); const resizeHandle = windowEl.querySelector('.chart-window-resize-handle');
        windowEl.addEventListener('mousedown', () => { windowEl.style.zIndex = ++highestZIndex; });
        header.addEventListener('mousedown', (e) => { if (e.target.tagName === 'BUTTON') return; let offsetX = e.clientX - windowEl.offsetLeft, offsetY = e.clientY - windowEl.offsetTop; header.style.cursor = 'grabbing'; function onMouseMove(moveEvent) { windowEl.style.left = `${moveEvent.clientX - offsetX}px`; windowEl.style.top = `${moveEvent.clientY - offsetY}px`; } function onMouseUp() { header.style.cursor = 'grab'; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); } document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); });
        resizeHandle.addEventListener('mousedown', (e) => { let startWidth = windowEl.offsetWidth, startHeight = windowEl.offsetHeight; let startX = e.clientX, startY = e.clientY; function onResizeMouseMove(moveEvent) { const newWidth = startWidth + (moveEvent.clientX - startX); const newHeight = startHeight + (moveEvent.clientY - startY); windowEl.style.width = `${Math.max(350, newWidth)}px`; windowEl.style.height = `${Math.max(250, newHeight)}px`; } function onResizeMouseUp() { document.removeEventListener('mousemove', onResizeMouseMove); document.removeEventListener('mouseup', onResizeMouseUp); } document.addEventListener('mousemove', onResizeMouseMove); document.addEventListener('mouseup', onResizeMouseUp); });
    }

    function populateCustomChartSelector() {
        if (!configActualEscena || !sensorSelectCustom) return;
        if (slimSelectInstance) {
            slimSelectInstance.destroy();
        }

        const optionsData = [];
        const allSensors = new Map();
        
        configActualEscena.planos2D.forEach(plano => {
            if (plano.puntosInteres) {
                plano.puntosInteres.forEach(punto => {
                    const items = punto.type === 'group' ? punto.items : [punto];
                    items.forEach(item => {
                        if (!allSensors.has(item.id)) {
                            allSensors.set(item.id, { titulo: item.titulo || item.id });
                        }
                    });
                });
            }
        });

        const sortedSensors = Array.from(allSensors.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        
        sortedSensors.forEach(([id, sensorInfo]) => {
            const sensorType = id.replace(/[0-9]/g, '');
            const variables = configActualEscena.configuracionSensores.variablesMap[sensorType];
            if (variables) {
                const groupOptions = variables.map(variable => {
                    const fullSensorId = variable.sufijo ? `${id}_${variable.sufijo}` : id;
                    // Usamos el nombre de la variable que viene del JSON
                    return { text: `${sensorInfo.titulo} - ${variable.nombre}`, value: fullSensorId, 'data-variable-name': variable.nombre, 'data-base-id': id };
                });
                optionsData.push({ label: sensorInfo.titulo, options: groupOptions });
            }
        });
        
        slimSelectInstance = new SlimSelect({
            select: '#sensor-select-custom',
            data: optionsData,
            settings: {
                placeholderText: 'Selecciona sensores...',
                searchText: 'No se encontraron sensores.'
            }
        });
    }

    async function cargarTodosLosGraficosIndividuales() {
        const grid = document.getElementById('todos-sensores-grid');

        Object.values(activeIndividualCharts).forEach(chart => chart.destroy());
        activeIndividualCharts = {};

        grid.innerHTML = '<p class="loading-message">Cargando datos de todos los sensores...</p>';

        // --- CAMBIO PRINCIPAL: AHORA LEE LAS FECHAS DE LA NUEVA BARRA ---
        const startTimeInput = document.getElementById('start-time_ts');
        const endTimeInput = document.getElementById('end-time_ts');

        // Comprobamos si los calendarios ya están inicializados
        if (!startTimeInput || !startTimeInput._flatpickr || !endTimeInput || !endTimeInput._flatpickr) {
            grid.innerHTML = '<p class="loading-message error">Error: Los selectores de fecha no están listos.</p>';
            return;
        }

        const startTime = startTimeInput._flatpickr.selectedDates[0]?.toISOString();
        const endTime = endTimeInput._flatpickr.selectedDates[0]?.toISOString();

        if (!startTime || !endTime) {
            grid.innerHTML = '<p class="loading-message">Por favor, selecciona un rango de tiempo y pulsa "Filtrer".</p>';
            return;
        }
        // --- FIN DEL CAMBIO ---

        try {
            // La llamada a la API ahora usa las fechas seleccionadas
            const apiUrl = `api/api_get_dashboard_data.php?obra=${configActualEscena.idEscena}&startTime=${startTime}&endTime=${endTime}`;
            const response = await fetch(apiUrl);
            if (response.status === 401) {
                alert("Tu sesión ha expirado. Por favor, inicia sesión de nuevo.");
                window.location.href = 'login.html';
                return;
            }
            if (!response.ok) throw new Error(`El servidor respondió con estado ${response.status}`);

            const datosPorVariable = await response.json();
            grid.innerHTML = '';

            if (Object.keys(datosPorVariable).length === 0) {
                grid.innerHTML = '<p class="loading-message">No se encontraron datos para este rango.</p>';
                return;
            }

            for (const variable in datosPorVariable) {
                const sensoresDeVariable = datosPorVariable[variable];
                for (const sensorId in sensoresDeVariable) {
                    const datosSensor = sensoresDeVariable[sensorId];
                    createIndividualChartCard(sensorId, datosSensor);
                }
            }

        } catch (error) {
            console.error('Error al cargar gráficos individuales:', error);
            grid.innerHTML = `<p class="loading-message error">Error: ${error.message}</p>`;
        }
    }

    // REEMPLAZA TU FUNCIÓN CON ESTA VERSIÓN CORREGIDA
    function createIndividualChartCard(sensorId, dataPoints) {
        if (!dataPoints || dataPoints.length === 0) return;

        const grid = document.getElementById('todos-sensores-grid');
        const baseSensorId = sensorId.split('_')[0];
        const chartId = `individual-chart-${sensorId.replace(/[^a-zA-Z0-9]/g, '-')}`;

        const existingChart = Chart.getChart(chartId);
        if (existingChart) {
            existingChart.destroy();
        }

        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';

        const variableInfo = dataPoints[0];
        const variableName = variableInfo.variable || 'Lectura';
        const unidad = variableInfo.unidad || '';
        const variableKey = Object.keys(translations).find(key => translations[key] === variableName);
        const translatedVariableName = t(variableKey || variableName);

        chartContainer.innerHTML = `
            <h2>${baseSensorId}</h2>
            <p class="chart-subtitle">${translatedVariableName} ${unidad ? `(${unidad})` : ''}</p>
            <div class="chart-canvas-wrapper">
                <canvas id="${chartId}"></canvas>
            </div>
        `;
        grid.appendChild(chartContainer);

        // --- ¡¡¡ESTA ES LA LÍNEA MÁS IMPORTANTE Y LA SOLUCIÓN!!! ---
        // Nos aseguramos de convertir la `lectura` (que viene como texto) a un número con parseFloat()
        const points = dataPoints
            .map(p => ({ x: p.timestamp, y: parseFloat(p.lectura) }))
            .filter(p => p.y !== null && !isNaN(p.y)); // El filtro elimina cualquier lectura que no sea un número válido

        // Opcional: Para depurar, puedes añadir esta línea y ver la consola del navegador
        // console.log(`Datos para ${sensorId}:`, points); 

        if (points.length === 0) {
            const wrapper = chartContainer.querySelector('.chart-canvas-wrapper');
            wrapper.innerHTML = '<p class="no-data-message">No hay datos en este rango</p>';
            return;
        }

        const options = getUnifiedChartOptions(false);
        

        const ctx = document.getElementById(chartId).getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: `${baseSensorId} - ${translatedVariableName}`,
                    data: points,
                    borderColor: '#9cbbd3',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.1
                }]
            },
            options: options
        });
    }

    async function handleCreateCustomChart() {
        if (!slimSelectInstance) return;

        const selectedValues = slimSelectInstance.getSelected();
        if (selectedValues.length === 0) {
            alert('Por favor, selecciona al menos una variable para graficar.');
            return;
        }

        const chartTitle = "Gráfico Personalizado"; // Título simple
        const startTime = document.getElementById('start-time')._flatpickr.selectedDates[0]?.toISOString();
        const endTime = document.getElementById('end-time')._flatpickr.selectedDates[0]?.toISOString();

        if (!startTime || !endTime) {
            alert('Por favor, selecciona un rango de fechas en la barra superior primero.');
            return;
        }
        
        try {
            const apiUrl = `api/api_get_custom_chart_data.php?obra=${configActualEscena.idEscena}&startTime=${startTime}&endTime=${endTime}&sensorIds=${selectedValues.join(',')}`;
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`El servidor respondió con estado ${response.status}`);
            const data = await response.json();
            
            createChartCard(chartTitle, data, true); // Llama a la función que dibuja el gráfico
            
            // Opcional: Ocultar el panel después de crear el gráfico
            if (customChartCreatorPanel) {
                customChartCreatorPanel.style.display = 'none';
            }

        } catch (error) {
            console.error('Error al crear gráfico personalizado:', error);
            alert(`Error al crear el gráfico: ${error.message}`);
        }
    }

    window.mostrarDatosSensorDesdeUnity = (sensorId, sensorTitulo) => {
        showVariableSelector(sensorId, sensorTitulo);
    };

    inicializarApp();
});