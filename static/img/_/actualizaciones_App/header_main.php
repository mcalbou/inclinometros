<?php
// partials/header_main.php

// Definimos valores por defecto por si no se especifican en la página
$pageTitle = isset($pageTitle) ? $pageTitle : 'Calsens';
$pageType = isset($pageType) ? $pageType : 'main'; // 'main' o 'subpage'
?>
<header class="main-header">
    <div class="header-left">
        <?php if ($pageType === 'subpage'): ?>
            <!-- Si es una subpágina, mostramos el botón de Volver -->
            <a href="javascript:history.back()" class="header-icon header-back-button" aria-label="Volver atrás">
                <i class="fas fa-arrow-left"></i>
            </a>
        <?php else: ?>
            <!-- Si es la página principal, mostramos el logo -->
            <img src="assets/imagenes/logo_calsens_completo_sinfondo.png" alt="Logo Calsens" class="header-logo">
        <?php endif; ?>

        <span class="header-title-divider">|</span>
        <span class="header-page-title"><?php echo htmlspecialchars($pageTitle); ?></span>
    </div>
    <div class="header-right">
        <?php if ($pageType === 'main'): ?>
            <!-- Los iconos de Lupa e Informes solo se muestran en la página principal -->
            <a href= "informe_datos.php" class="header-link">
                <i href= "informe_datos.php" class="fas fa-chart-bar"></i> RAPPORTS
            </a>
        <?php endif; ?>

        <!-- El menú de Gestión siempre se muestra si el usuario es admin -->
        <?php
            if (isset($_SESSION['rol']) && $_SESSION['rol'] === 'admin') {
                echo '
                <div class="dropdown">
                    <button class="dropdown-btn">
                        <i class="fas fa-cog"></i> GESTIÓN <i class="fas fa-caret-down" style="font-size: 0.8em; margin-left: 5px;"></i>
                    </button>
                    <div class="dropdown-content">
                        <a href="gestionar_usuarios.php">
                            <i class="fas fa-users-cog"></i> Usuarios
                        </a>
                    </div>
                </div>
                ';
            }
        ?>
        
        <!-- Los botones de Tema y Usuario siempre están presentes -->
        <button id="toggle-theme-button" class="header-icon" aria-label="Cambiar modo">
            <i class="fas fa-sun"></i> 
        </button>
        <!-- Menú Desplegable de Usuario -->
            <div class="dropdown">
            <a class="header-icon" aria-label="Usuario"><i class="fas fa-user"></i></a>
                <div class="dropdown-content">
                    <a href="mi_perfil.php"><i class="fas fa-user-circle"></i>Mon profil</a>
                    <a href="api/api_logout.php"><i class="fas fa-sign-out-alt"></i>Se déconnecter</a>
                </div>
            </div>
    </div>
</header>