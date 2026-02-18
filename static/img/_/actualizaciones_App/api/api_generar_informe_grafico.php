<?php
// api/api_generar_informe_grafico.php
require_once 'db_config.php';
require_once 'fpdf/fpdf.php';

class PDF extends FPDF {
    function Header() {
        $this->Image('../assets/imagenes/logo_calsens_completo_sinfondo.png', 10, 8, 50);
        $this->SetFont('Arial', 'B', 15);
        $this->Cell(0, 10, 'Informe Grafico de Sensores', 0, 1, 'C');
        
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
$charts = $input['charts'] ?? [];

if (!$startTime || !$endTime || empty($sensores) || empty($charts)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['message' => 'Faltan datos o gráficos para generar el informe.']);
    exit;
}

$pdf = new PDF();
$pdf->AliasNbPages();
$pdf->AddPage('L', 'A4');
$pdf->SetFont('Arial', '', 10);

$pdf->SetFont('Arial', 'B', 12);
$pdf->Cell(0, 10, 'Filtros Aplicados en el Informe', 0, 1);
$pdf->SetFont('Arial', '', 10);
$pdf->Cell(0, 7, "Periodo: Desde " . date("d/m/Y H:i", strtotime($startTime)) . " hasta " . date("d/m/Y H:i", strtotime($endTime)), 0, 1);
$pdf->MultiCell(0, 7, "Sensores Seleccionados: " . implode(', ', $sensores), 0, 1);
$pdf->Ln(10);

foreach ($charts as $chartData) {
    $title = $chartData['title'];
    $imageData = $chartData['image'];

    $imageData = str_replace('data:image/png;base64,', '', $imageData);
    $imageData = str_replace(' ', '+', $imageData);
    $decodedImage = base64_decode($imageData);

    $tempImagePath = tempnam(sys_get_temp_dir(), 'chart_') . '.png';
    file_put_contents($tempImagePath, $decodedImage);

    list($width, $height) = getimagesize($tempImagePath);
    $aspectRatio = $height / $width;
    $imageWidth = 260;
    $imageHeight = $imageWidth * $aspectRatio;

    if ($pdf->GetY() + $imageHeight + 10 > 190) { 
        $pdf->AddPage('L', 'A4');
    }

    $pdf->SetFont('Arial', 'B', 14);
    $pdf->Cell(0, 10, "Grafico: " . $title, 0, 1, 'C');
    
    $xPos = ($pdf->GetPageWidth() - $imageWidth) / 2;
    $pdf->Image($tempImagePath, $xPos, $pdf->GetY(), $imageWidth);
    
    $pdf->SetY($pdf->GetY() + $imageHeight + 10);

    unlink($tempImagePath);
}

$pdf->Output('D', 'Informe_Grafico_Calsens.pdf');
?>