<?php
// api/api_save_comment.php
session_start();
require_once 'db_config.php';

header('Content-Type: application/json');

// Simulación de usuario logueado. En tu sistema real, usa $_SESSION.
$user_id = $_SESSION['usuario'] ?? 'usuario_desconocido';

$input = json_decode(file_get_contents('php://input'), true);
$alarm_id = $input['alarm_id'] ?? null;
$comment_text = $input['comment_text'] ?? null;

if (empty($alarm_id) || empty($comment_text)) {
    http_response_code(400);
    echo json_encode(['error' => 'Faltan datos para guardar el comentario.']);
    exit;
}

$dbconn = get_db_connection();
$query = 'INSERT INTO alarm_comments (alarm_id, comment_text, user_id) VALUES ($1, $2, $3)';
$result = pg_query_params($dbconn, $query, [$alarm_id, $comment_text, $user_id]);

if ($result) {
    echo json_encode(['success' => true, 'message' => 'Comentario guardado.']);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'No se pudo guardar el comentario en la base de datos.']);
}
pg_close($dbconn);
?>