<?php
// api/api_get_comments.php
require_once 'db_config.php';
header('Content-Type: application/json');

$alarm_id = $_GET['alarm_id'] ?? '';

if (empty($alarm_id)) {
    echo json_encode([]); // Devolver un array vacío si no se especifica alarma
    exit;
}

$dbconn = get_db_connection();
$query = 'SELECT user_id, comment_text, created_at FROM alarm_comments WHERE alarm_id = $1 ORDER BY created_at ASC';
$result = pg_query_params($dbconn, $query, [$alarm_id]);

if ($result) {
    echo json_encode(pg_fetch_all($result) ?: []);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Error al obtener comentarios.']);
}
pg_close($dbconn);
?>