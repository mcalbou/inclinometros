<?php
// api/api_generar_informe.php
require_once 'db_config.php';
require_once 'fpdf/fpdf.php';

class PDF extends FPDF {
    function Header() {
        $this->Image('../assets/imagenes/logo_calsens_completo_sinfondo.png', 10, 8, 50);
        $this->SetFont('Arial', 'B', 15);
        $this->Cell(0, 10, 'Informe de Lecturas', 0, 1, 'C');
        
        $this->SetFont('Arial', '', 9);
        $pageWidth = $this->GetPageWidth();
        $this->SetX($pageWidth - 30);
        $this->Cell(20, 10, 'Pagina ' . $this->PageNo() . '/{nb}', 0, 0, 'R');
        
        $this->Ln(15);
    }
}

$input = json_decode(file_get_contents('php://input'), true);

$startTime = $input['startTime'] ?? null;
$endTime = $input['endTime'] ?? null;
$sensores = $input['sensores'] ?? [];

if (!$startTime || !$endTime || empty($sensores)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['message' => 'Faltan parámetros para generar el informe.']);
    exit;
}

$dbconn = get_db_connection();
$placeholders = implode(',', array_map(function($i) { return '$' . ($i + 3); }, array_keys($sensores)));
$query = "
    SELECT sensor_id, timestamp, lectura, temperatura 
    FROM lecturas_sensores 
    WHERE timestamp BETWEEN $1 AND $2 
    AND sensor_id IN ({$placeholders})
    ORDER BY sensor_id, timestamp ASC
";
$params = array_merge([$startTime, $endTime], $sensores);
$result = pg_query_params($dbconn, $query, $params);

if (!$result) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['message' => 'Error al consultar la base de datos.']);
    exit;
}

$data = pg_fetch_all($result);
pg_close($dbconn);

$pdf = new PDF();
$pdf->AliasNbPages();
$pdf->AddPage('L', 'A4');
$pdf->SetFont('Arial', '', 10);

$pdf->SetFont('Arial', 'B', 12);
$pdf->Cell(0, 10, 'Filtros Aplicados', 0, 1);
$pdf->SetFont('Arial', '', 10);
$pdf->Cell(0, 7, "Periodo: Desde " . date("d/m/Y H:i", strtotime($startTime)) . " hasta " . date("d/m/Y H:i", strtotime($endTime)), 0, 1);
$pdf->MultiCell(0, 7, "Sensores: " . implode(', ', $sensores), 0, 1);
$pdf->Ln(5);

if (!empty($data)) {
    $pdf->SetFont('Arial', 'B', 10);
    $pdf->SetFillColor(230, 230, 230);
    $pdf->Cell(60, 7, 'Sensor ID', 1, 0, 'C', true);
    $pdf->Cell(60, 7, 'Fecha y Hora', 1, 0, 'C', true);
    $pdf->Cell(75, 7, 'Lectura (deformacion)', 1, 0, 'C', true);
    $pdf->Cell(75, 7, 'Temperatura (C)', 1, 1, 'C', true);
    
    $pdf->SetFont('Arial', '', 9);
    foreach ($data as $row) {
        $pdf->Cell(60, 6, $row['sensor_id'], 1);
        $pdf->Cell(60, 6, date("d/m/Y H:i:s", strtotime($row['timestamp'])), 1);
        $pdf->Cell(75, 6, $row['lectura'] !== null ? number_format($row['lectura'], 4) : 'N/A', 1, 0, 'R');
        $pdf->Cell(75, 6, $row['temperatura'] !== null ? number_format($row['temperatura'], 2) : 'N/A', 1, 1, 'R');
    }
} else {
    $pdf->Cell(0, 10, 'No se encontraron datos para los filtros seleccionados.', 0, 1);
}

$pdf->Output('D', 'Informe_Calsens.pdf');
?>