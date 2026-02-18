<?php
// api/api_get_dashboard_data.php
header('Content-Type: application/json');
require_once 'db_config.php';

$obraId = $_GET['obra'] ?? null;
$startTime = $_GET['startTime'] ?? null;
$endTime = $_GET['endTime'] ?? null;

if (!$obraId || !$startTime || !$endTime) { http_response_code(400); echo json_encode(['error' => 'Faltan parámetros.']); exit; }

$dbconn = get_db_connection();
if (!$dbconn) { http_response_code(500); echo json_encode(['error' => 'No se pudo conectar.']); exit; }

$query = 'SELECT sensor_id, timestamp, temperatura, humedad, desplazamiento, "inclinacion A" AS inclinacion_a, "inclinacion B" AS inclinacion_b FROM lecturas_sensores WHERE LOWER(obra_id) = LOWER($1) AND timestamp BETWEEN $2 AND $3 ORDER BY sensor_id, timestamp ASC;';
$params = [$obraId, $startTime, $endTime];
$result = pg_query_params($dbconn, $query, $params);

if (!$result) { http_response_code(500); echo json_encode(['error' => 'Error SQL.', 'details' => pg_last_error($dbconn)]); pg_close($dbconn); exit; }

$data = pg_fetch_all($result, PGSQL_ASSOC) ?: [];
pg_close($dbconn);

$groupedData = [];
// --- AÑADIMOS LAS UNIDADES AQUÍ ---
$variables = [
    'temperatura' => '°C', 
    'humedad' => '%RH', 
    'desplazamiento' => 'mm', 
    'inclinacion_a' => '°', 
    'inclinacion_b' => '°'
];

foreach ($data as $row) {
    $sensor_id = $row['sensor_id'];
    foreach ($variables as $variable => $unidad) {
        if (isset($row[$variable]) && $row[$variable] !== null) {
            $nombreVariableGrafico = ucwords(str_replace('_', ' ', $variable));
            if (!isset($groupedData[$nombreVariableGrafico])) $groupedData[$nombreVariableGrafico] = [];
            if (!isset($groupedData[$nombreVariableGrafico][$sensor_id])) $groupedData[$nombreVariableGrafico][$sensor_id] = [];
            
            $groupedData[$nombreVariableGrafico][$sensor_id][] = [
                'timestamp' => $row['timestamp'],
                'lectura' => (float)$row[$variable],
                'unidad' => $unidad, // Añadimos la unidad a la respuesta
                'variable' => $nombreVariableGrafico // Y el nombre limpio de la variable
            ];
        }
    }
}
echo json_encode($groupedData);
?>