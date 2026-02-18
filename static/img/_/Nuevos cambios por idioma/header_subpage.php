<?php
// partials/header_subpage.php
?>
<header class="main-header">
    <div class="header-left">
        <!-- Botón de Volver atrás -->
        <a href="javascript:history.back()" class="header-icon header-back-button" aria-label="Volver atrás">
            <i class="fas fa-arrow-left"></i>
        </a>

        <span class="header-title-divider">|</span>
        <span class="header-page-title"><?php echo isset($pageTitle) ? htmlspecialchars($pageTitle) : 'Gestión'; ?></span>
    </div>
    <div class="header-right">
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
        
        <!-- Botones de Tema y Usuario -->
        <button id="toggle-theme-button" class="header-icon" aria-label="Changer le mode d’affichage">
            <i class="fas fa-sun"></i> 
        </button>
        <a href="#" class="header-icon" aria-label="Usuario"><i class="fas fa-user"></i></a>
    </div>
</header>