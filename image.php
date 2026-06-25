<?php
// Endpoint público para servir imágenes de sensores sin pasar por api.php.
$rawName = (string) ($_GET['name'] ?? '');
$rawName = urldecode(trim($rawName));
$rawName = preg_split('/[?#]/', $rawName)[0] ?? '';
$name = basename($rawName);
$imagesDir = __DIR__ . '/static/img';
$filePath = $imagesDir . '/' . $name;

if ($name === '') {
    http_response_code(404);
    exit;
}

if (!is_file($filePath)) {
    $targetLower = strtolower($name);
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    $base = strtolower(pathinfo($name, PATHINFO_FILENAME));
    $allowedExt = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];

    $matches = glob($imagesDir . '/*');
    foreach ($matches as $candidate) {
        if (!is_file($candidate)) continue;
        $candidateName = basename($candidate);
        $candidateLower = strtolower($candidateName);
        $candidateExt = strtolower(pathinfo($candidateName, PATHINFO_EXTENSION));
        $candidateBase = strtolower(pathinfo($candidateName, PATHINFO_FILENAME));

        $sameName = ($candidateLower === $targetLower);
        $sameBaseWithAllowedExt = ($ext === '' && $candidateBase === $base && in_array($candidateExt, $allowedExt, true));
        if ($sameName || $sameBaseWithAllowedExt) {
            $filePath = $candidate;
            break;
        }
    }
}

if (!is_file($filePath)) {
    http_response_code(404);
    exit;
}

$extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
$allowedMimesByExt = [
    'png' => 'image/png',
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'gif' => 'image/gif',
    'webp' => 'image/webp',
    'bmp' => 'image/bmp',
    'svg' => 'image/svg+xml'
];
$mime = $allowedMimesByExt[$extension] ?? '';
if ($mime === '') {
    http_response_code(415);
    exit;
}

while (ob_get_level() > 0) {
    ob_end_clean();
}

header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($filePath));
header('Cache-Control: public, max-age=300');
header('X-Content-Type-Options: nosniff');
readfile($filePath);
exit;
