<?php
// api/api_listar_sensores_por_obra.php
header('Content-Type: application/json');
require_once 'db_config.php';

// Obtenemos el ID de la obra desde la URL (ej: ?obra=murcia_yecla)
$obra_id = $_GET['obra'] ?? '';

if (empty($obra_id)) {
    http_response_code(400);
    echo json_encode([]);
    exit;
}

$dbconn = get_db_connection();

// Consultamos la tabla maestra de sensores, filtrando por obra
$query = 'SELECT sensor_id FROM sensores WHERE obra_id = $1 ORDER BY sensor_id ASC';
$result = pg_query_params($dbconn, $query, array($obra_id));

if ($result) {
    echo json_encode(pg_fetch_all($result) ?: []);
} else {
    http_response_code(500);
    echo json_encode([]);
}

pg_close($dbconn);
?>