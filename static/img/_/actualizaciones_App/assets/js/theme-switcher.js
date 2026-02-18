// assets/js/theme-switcher.js

document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggle-theme-button');

    // Si el botón no existe en la página, no hacemos nada más.
    if (!toggleButton) {
        return;
    }

    // Función para aplicar el tema y cambiar el icono
    function applyTheme(theme) {
        const icon = toggleButton.querySelector('i');
        if (theme === 'light') {
            document.body.classList.add('light-mode');
            if (icon) icon.className = 'fas fa-moon';
        } else {
            document.body.classList.remove('light-mode');
            if (icon) icon.className = 'fas fa-sun';
        }
    }

    // Función para cambiar el tema y guardarlo
    function toggleTheme() {
        // Comprueba si el body ya tiene la clase 'light-mode'
        const newTheme = document.body.classList.contains('light-mode') ? 'dark' : 'light';
        localStorage.setItem('pageTheme', newTheme); // Guardamos la preferencia
        applyTheme(newTheme);
    }

    // Evento de clic en el botón
    toggleButton.addEventListener('click', toggleTheme);

    // --- Cargar el tema guardado al iniciar la página ---
    const savedTheme = localStorage.getItem('pageTheme') || 'dark'; // 'dark' por defecto
    applyTheme(savedTheme);
});