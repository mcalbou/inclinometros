<?php
// api/api_agregar_usuario.php

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

if (!isset($input['usuario'], $input['email'], $input['contrasena'], $input['rol'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Todos los campos son requeridos.']);
    exit;
}

$nuevoUsuario = $input['usuario'];
$nuevoEmail = $input['email'];
$nuevaContrasena = $input['contrasena'];
$nuevoRol = $input['rol'];

if ($nuevoRol !== 'cliente' && $nuevoRol !== 'editor') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Rol no válido.']);
    exit;
}

$hashContrasena = password_hash($nuevaContrasena, PASSWORD_BCRYPT);

$query = 'INSERT INTO usuarios (nombre_usuario, email, contrasena_hash, rol) VALUES ($1, $2, $3, $4)';

// Desactivamos el manejo de errores de PHP para controlarlo nosotros
@$result = pg_query_params($dbconn, $query, array($nuevoUsuario, $nuevoEmail, $hashContrasena, $nuevoRol));

if ($result) {
    http_response_code(201); // 201 Created
    echo json_encode(['success' => true, 'message' => "Usuario '{$nuevoUsuario}' creado con éxito."]);
} else {
    // Si la consulta falla, verificamos el porqué
    $error = pg_last_error($dbconn);
    if (strpos($error, 'duplicate key value violates unique constraint') !== false) {
        // El error es por un duplicado
        http_response_code(409); // 409 Conflict
        echo json_encode(['success' => false, 'message' => 'El nombre de usuario o el email ya están en uso.']);
    } else {
        // Es otro tipo de error del servidor
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No se pudo crear el usuario.', 'error_details' => $error]);
    }
}

pg_close($dbconn);
?>