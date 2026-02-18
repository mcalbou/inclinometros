<?php
// api/api_listar_obras.php
header('Content-Type: application/json');
require_once 'db_config.php';

$dbconn = get_db_connection();
// Obtenemos obras únicas que no sean nulas o vacías
$query = 'SELECT DISTINCT obra_id FROM sensores WHERE obra_id IS NOT NULL AND obra_id != \'\' ORDER BY obra_id ASC';
$result = pg_query($dbconn, $query);

if ($result) {
    echo json_encode(pg_fetch_all($result) ?: []);
} else {
    echo json_encode([]);
}
pg_close($dbconn);
?>