<?php
session_start();
if (!isset($_SESSION['rol'])) {
    header('Location: login.html');
    exit;
}
$pageTitle = 'Générateur de rapports';
$header_to_include = 'partials/header_subpage.php';
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Calsens - <?php echo htmlspecialchars($pageTitle); ?></title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="assets/css/estilos_mapa.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
    <link rel="stylesheet" href="assets/css/estilos_informe.css">
</head>
<body>

    <?php include $_SERVER['DOCUMENT_ROOT'] . '/mi_mapa_3d/' . $header_to_include; ?>

    <main>
        <div class="report-form-container">
            <h1><?php echo htmlspecialchars($pageTitle); ?></h1>
            <p class="report-subtitle">Suivez les étapes pour générer votre rapport.</p>

            <form id="informe-form">
                
                <div id="step-1" class="report-step">
                    <h2><span class="step-number">1</span>Sélectionnez un ouvrage</h2>
                    <div class="input-group">
                        <i class="fas fa-hard-hat icon"></i>
                        <select id="obra-select" required>
                            <option value="">Chargement des ouvrages…</option>
                        </select>
                    </div>
                </div>

                <div id="step-2" class="report-step hidden">
                    <h2><span class="step-number">2</span>Définissez la période</h2>
                    <div class="compact-grid">
                        <div class="compact-grid-item">
                            <label for="fecha-inicio">De</label>
                            <div class="input-group">
                                <i class="fas fa-calendar-alt icon"></i>
                                <input type="text" id="fecha-inicio" required>
                            </div>
                        </div>
                        <div class="compact-grid-item">
                            <label for="fecha-fin">À</label>
                            <div class="input-group">
                                <i class="fas fa-calendar-alt icon"></i>
                                <input type="text" id="fecha-fin" required>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="step-3" class="report-step hidden">
                    <h2><span class="step-number">3</span>Sélectionnez les capteurs</h2>
                    <div class="action-checkboxes">
                        <div class="checkbox-item">
                            <input type="checkbox" id="select-all">
                            <label for="select-all">Tout sélectionner</label>
                        </div>
                    </div>
                    <div id="sensores-checkbox-container" class="checkbox-container"></div>
                </div>

                <div id="report-actions" class="report-step hidden">
                    <h2><span class="step-number">4</span>Téléchargez vos rapports</h2>
                    <p class="helper-text">Complétez les étapes précédentes puis exportez les informations dans le format de votre choix.</p>
                    
                    <div class="action-buttons-container">
                        <button type="submit" id="btn-informe-datos" class="action-button" disabled>
                            <i class="fas fa-table"></i> Données (PDF)
                        </button>
                        <button type="button" id="btn-informe-excel" class="action-button" disabled>
                            <i class="fas fa-file-excel"></i> Données (Excel)
                        </button>
                        <button type="button" id="btn-informe-grafico" class="action-button" disabled>
                            <i class="fas fa-chart-line"></i> Configurer et télécharger les graphiques
                        </button>
                    </div>
                    <p id="informe-message" class="error-message" style="text-align: center; margin-top: 15px;"></p>
                </div>
                
            </form>
        </div>

        <div id="hidden-chart-container" style="position: absolute; left: -9999px; top: -9999px; width: 1200px;"></div>

        <div id="graph-config-panel" class="report-step hidden">
            <div class="graph-panel-header">
                <h2><span class="step-number">5</span>Configurer des graphiques personnalisés</h2>
                <button type="button" id="graph-panel-close" class="graph-panel-close" aria-label="Masquer la configuration">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <p class="helper-text">Définissez le nombre de graphiques nécessaires, leur type et les capteurs à inclure (vous pouvez répéter des capteurs dans différents graphiques).</p>
            <p class="helper-text axis-legend">
                <span class="axis-pill axis-pill-left"></span>Axe A: Température / Face A
                <span class="axis-pill axis-pill-right"></span>Axe B: Humidité / Face B
            </p>

            <div class="graph-config-controls">
                <div class="graph-config-control">
                    <label for="graph-layout">Comment souhaitez-vous les disposer ?</label>
                    <select id="graph-layout">
                        <option value="single-column">Une colonne (1 par ligne)</option>
                        <option value="two-columns">Deux colonnes (2 par ligne)</option>
                        <option value="grid">Mosaïque (jusqu’à 4 par page)</option>
                    </select>
                </div>
                <div class="graph-config-control">
                    <label for="graph-count">Combien de graphiques vous faut-il ?</label>
                    <input type="number" id="graph-count" min="1" max="6" value="1">
                </div>
            </div>

            <div id="graph-config-list" class="graph-config-list"></div>
            <p id="graph-config-error" class="error-message" style="margin-top: 10px;"></p>

            <div class="graph-config-actions">
                <button type="button" id="btn-descargar-graficos-png" class="secondary-action">
                    <i class="fas fa-image"></i>Télécharger en PNG
                </button>
                <button type="button" id="btn-generar-graficos-pdf" class="primary-action">
                    <i class="fas fa-file-pdf"></i>Générer le PDF
                </button>
            </div>
        </div>
    </main>
    
    <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
    <script src="https://npmcdn.com/flatpickr/dist/l10n/es.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
    <script src="assets/js/theme-switcher.js"></script>
    <script src="assets/js/logica_informe_datos.js"></script>
</body>
</html>