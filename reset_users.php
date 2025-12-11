<?php
// reset_users.php
// ESTE SCRIPT REINICIA TUS USUARIOS CON LA CONTRASEÑA CORRECTA

$host = 'localhost';
$db   = 'inclinometros_db';
$user = 'postgres';
$pass = 'DatosBase1'; 
$dsn  = "pgsql:host=$host;port=5432;dbname=$db";

try {
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    
    // 1. Generar la contraseña encriptada real compatible con tu PHP
    $passwordRaw = '1234';
    $passwordHash = password_hash($passwordRaw, PASSWORD_DEFAULT);

    // 2. Limpiar la tabla de usuarios (Borrar los viejos que no funcionan)
    $pdo->exec("DELETE FROM usuarios");

    // 3. Insertar los usuarios nuevos con el hash correcto
    $sql = "INSERT INTO usuarios (usuario, password, rol) VALUES (?, ?, ?)";
    $stmt = $pdo->prepare($sql);

    // Usuario ADMIN
    $stmt->execute(['admin', $passwordHash, 'admin']);
    
    // Usuario CLIENTE
    $stmt->execute(['cliente', $passwordHash, 'cliente']);
    
    // Usuario SUPER
    $stmt->execute(['super', $passwordHash, 'superAdmin']);

    echo "<h1 style='color:green; font-family:sans-serif;'>¡ÉXITO! Usuarios restablecidos.</h1>";
    echo "<p>Ahora la contraseña <b>1234</b> funcionará correctamente.</p>";
    echo "<a href='login.html'>Ir al Login</a>";

} catch (PDOException $e) {
    echo "<h1 style='color:red;'>ERROR DE CONEXIÓN</h1>";
    echo "Revisa tu archivo api.php para ver si la contraseña de la BD es correcta.<br>";
    echo "Error: " . $e->getMessage();
}
?>