<?php
// api/api_eliminar_usuario.php

require_once 'api_check_session.php'; // Incluimos nuestro guardia de seguridad
check_session_and_activity(); // Ejecutamos la comprobación de sesión y timeout

header('Content-Type: application/json');

// La comprobación de rol sigue siendo necesaria, pero la de sesión ya está hecha.
if ($_SESSION['rol'] !== 'admin') {
    http_response_code(403); // 403 Forbidden
    echo json_encode(['success' => false, 'message' => 'Acceso denegado. Permisos de administrador requeridos.']);
    exit;
}

require_once 'db_config.php';
$dbconn = get_db_connection();

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No se especificó el ID del usuario a eliminar.']);
    exit;
}

$id = $input['id'];

$query = 'DELETE FROM usuarios WHERE id = $1';
$result = pg_query_params($dbconn, $query, array($id));

if ($result) {
    echo json_encode(['success' => true, 'message' => 'Usuario eliminado correctamente.']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error al eliminar el usuario.']);
}

pg_close($dbconn);
?>