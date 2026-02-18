<?php
// ver_sensores.php
$host = 'localhost';
$db   = 'inclinometros_db';
$user = 'postgres';
$pass = 'DatosBase1'; 
$dsn  = "pgsql:host=$host;port=5432;dbname=$db";

try {
    $pdo = new PDO($dsn, $user, $pass);
    // Pedimos TODOS los sensores sin filtros
    $stmt = $pdo->query("SELECT id, nombre, lugar FROM sensores ORDER BY nombre");
    $sensores = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "<h1>Hay " . count($sensores) . " sensores en la Base de Datos</h1>";
    echo "<table border='1'><tr><th>ID</th><th>Nombre</th><th>Tipo</th></tr>";
    
    foreach ($sensores as $s) {
        echo "<tr>";
        echo "<td>" . $s['id'] . "</td>";
        echo "<td>" . $s['nombre'] . "</td>";
        echo "<td>" . ($s['lugar'] ? $s['lugar'] : '<em>NULL</em>') . "</td>";
        echo "</tr>";
    }
    echo "</table>";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>