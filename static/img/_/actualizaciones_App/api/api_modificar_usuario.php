<?php
// api/api_modificar_usuario.php

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

if (!isset($input['id'], $input['email'], $input['rol'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Faltan datos para la modificación.']);
    exit;
}

$id = $input['id'];
$email = $input['email'];
$rol = $input['rol'];

$query = 'UPDATE usuarios SET email = $1, rol = $2 WHERE id = $3';
@$result = pg_query_params($dbconn, $query, array($email, $rol, $id));

if ($result) {
    echo json_encode(['success' => true, 'message' => 'Usuario actualizado correctamente.']);
} else {
    $error = pg_last_error($dbconn);
    if (strpos($error, 'duplicate key value violates unique constraint') !== false) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'El email ya está en uso por otro usuario.']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error al actualizar el usuario.']);
    }
}

pg_close($dbconn);
?>