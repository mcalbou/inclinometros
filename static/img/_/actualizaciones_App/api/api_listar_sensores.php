<?php
// api/api_listar_sensores.php
header('Content-Type: application/json');
require_once 'db_config.php';

$dbconn = get_db_connection();

// Ahora consultamos la tabla maestra de sensores
$query = 'SELECT sensor_id FROM sensores ORDER BY sensor_id ASC';
$result = pg_query($dbconn, $query);

if ($result) {
    $sensores = pg_fetch_all($result);
    echo json_encode($sensores ?: []);
} else {
    http_response_code(500);
    echo json_encode([]);
}

pg_close($dbconn);
?>