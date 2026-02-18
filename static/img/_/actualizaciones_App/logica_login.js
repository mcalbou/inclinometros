// assets/js/logica_login.js

document.addEventListener('DOMContentLoaded', function() {
    // --- NUEVA LÓGICA DE LOGIN ---
    const loginForm = document.getElementById('login-form');
    const errorMessageElement = document.getElementById('login-error-message');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const usuario = document.getElementById('usuario').value;
            const contrasena = document.getElementById('contrasena').value;
            const loginButton = loginForm.querySelector('button[type="submit"]');

            errorMessageElement.textContent = '';
            loginButton.disabled = true;
            loginButton.textContent = 'Verificando...';

            // El objeto que vamos a enviar
            const loginData = {
                usuario: usuario,
                contrasena: contrasena
            };

            try {
                // AQUÍ ESTÁ LA CORRECCIÓN
                const response = await fetch('api/api_login.php', {
                    method: 'POST',
                    headers: {                                           // <<< 1. AÑADE ESTA SECCIÓN
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(loginData)                      // <<< 2. AÑADE ESTA LÍNEA (y usa el objeto loginData)
                });
                // FIN DE LA CORRECCIÓN

                const data = await response.json(); // <<< 3. Esto ya lo tenías bien, pero ahora sí recibirá un JSON válido

                if (response.ok && data.success) {
                    errorMessageElement.textContent = '¡Inicio de sesión exitoso! Redirigiendo...';
                    errorMessageElement.style.color = 'var(--login-button-text)';

                    // Bien hecho al usar localStorage para guardar el estado
                    localStorage.setItem('tipoUsuario', data.rol);
                    localStorage.setItem('usuarioLogueado', data.usuario);

                setTimeout(function() {
                    // Redirigimos directamente a la escena, indicando el ID de la obra y que queremos ver el dashboard.
                    // Usamos 'Belgica_Namur' como ejemplo.
                    const obraID = "Belgica_Namur";
                    const idiomaPreferido = "es"; // Puedes obtenerlo de alguna configuración si quieres

                    window.location.href = `escena_3d.html?id=${obraID}&vista=dashboard&lang=${idiomaPreferido}`; 
                }, 1500);

                } else {
                    errorMessageElement.textContent = data.message || "Error desconocido.";
                    errorMessageElement.style.color = 'var(--login-error-text)';
                    loginButton.disabled = false;
                    loginButton.textContent = 'Entrar';
                }

            } catch (error) {
                console.error('Error de conexión:', error);
                errorMessageElement.textContent = 'No se pudo conectar con el servidor.';
                errorMessageElement.style.color = 'var(--login-error-text)';
                loginButton.disabled = false;
                loginButton.textContent = 'Entrar';
            }
        });
    }
});

// --- FUNCIÓN PARA MOSTRAR/OCULTAR CONTRASEÑA (SIN CAMBIOS) ---
function togglePasswordVisibility() {
    const contrasenaInput = document.getElementById('contrasena');
    const icon = document.querySelector('.toggle-password i');
    if (contrasenaInput.type === "password") {
        contrasenaInput.type = "text";
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        contrasenaInput.type = "password";
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}