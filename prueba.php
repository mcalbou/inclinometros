<?php
// debug_users.php
header('Content-Type: text/html; charset=utf-8');

// Configuración de conexión (Misma que en api.php)
$host = 'localhost';
$db   = 'inclinometros_db';
$user = 'postgres';
//$pass = 'DatosBase1';
$pass = 'EstrucDatosAdmin';
$dsn  = "pgsql:host=$host;port=5432;dbname=$db";

try {
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (PDOException $e) {
    die("<h1>Error de Conexión</h1><p>" . $e->getMessage() . "</p>");
}

// Lógica para probar una contraseña (si se envía el formulario)
$msg = "";
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $testUser = $_POST['test_user'] ?? '';
    $testPass = $_POST['test_pass'] ?? '';

    $stmt = $pdo->prepare("SELECT password FROM usuarios WHERE usuario = ?");
    $stmt->execute([$testUser]);
    $hash = $stmt->fetchColumn();

    if ($hash) {
        if (password_verify($testPass, $hash)) {
            $msg = "<div style='color:green; border:1px solid green; padding:10px; margin:10px 0;'>✅ La contraseña es <b>CORRECTA</b> para el usuario '<b>$testUser</b>'.</div>";
        } else {
            $msg = "<div style='color:red; border:1px solid red; padding:10px; margin:10px 0;'>❌ La contraseña es <b>INCORRECTA</b>.</div>";
        }
    } else {
        $msg = "<div style='color:orange; border:1px solid orange; padding:10px; margin:10px 0;'>⚠️ El usuario '<b>$testUser</b>' no existe.</div>";
    }
}

// Obtener lista de usuarios (SIN las contraseñas por seguridad)
$users = $pdo->query("SELECT id, usuario, rol FROM usuarios ORDER BY id ASC")->fetchAll(PDO::FETCH_ASSOC);
?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Depuración de Usuarios</title>
    <style>
        body { font-family: sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; background: #f8fafc; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #5c87b2; color: white; }
        .card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
        input, button { padding: 8px; margin-top: 5px; }
        button { background: #5c87b2; color: white; border: none; cursor: pointer; }
        button:hover { background: #4a6d91; }
    </style>
</head>
<body>

    <h1>🛠️ Panel de Depuración de Usuarios</h1>

    <div class="card">
        <h3>Usuarios en Base de Datos</h3>
        <p>Estos son los usuarios registrados actualmente:</p>
        <?php if (count($users) > 0): ?>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Usuario</th>
                        <th>Rol</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($users as $u): ?>
                        <tr>
                            <td><?= htmlspecialchars($u['id']) ?></td>
                            <td><strong><?= htmlspecialchars($u['usuario']) ?></strong></td>
                            <td><?= htmlspecialchars($u['rol']) ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php else: ?>
            <p style="color:red;">No hay usuarios en la base de datos.</p>
        <?php endif; ?>
    </div>

    <div class="card">
        <h3>Verificar Login</h3>
        <p>Prueba si una contraseña coincide con el hash guardado:</p>
        
        <?= $msg ?>

        <form method="POST">
            <div style="display:flex; gap:10px;">
                <div>
                    <label>Usuario:</label><br>
                    <input type="text" name="test_user" required placeholder="Ej: admin">
                </div>
                <div>
                    <label>Contraseña a probar:</label><br>
                    <input type="text" name="test_pass" required placeholder="Ej: 1234">
                </div>
            </div>
            <br>
            <button type="submit">Verificar</button>
        </form>
    </div>

</body>
</html>