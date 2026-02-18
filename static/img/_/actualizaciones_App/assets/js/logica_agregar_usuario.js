// assets/js/logica_agregar_usuario.js
document.addEventListener('DOMContentLoaded', function() {
    const registroForm = document.getElementById('registro-form');
    const messageElement = document.getElementById('registro-message');
    


    if (registroForm) {
        registroForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const usuario = document.getElementById('nuevo_usuario').value;
            const email = document.getElementById('nuevo_email').value;
            const contrasena = document.getElementById('nuevo_contrasena').value;
            const rol = document.getElementById('nuevo_rol').value;
            const button = registroForm.querySelector('button[type="submit"]');

            button.disabled = true;
            button.textContent = 'Creando...';
            messageElement.textContent = '';

            try {
                const response = await fetch('api/api_agregar_usuario.php', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ usuario, email, contrasena, rol })
                });

                const data = await response.json();

                if (response.ok) {
                    messageElement.textContent = data.message;
                    messageElement.style.color = 'green';
                    registroForm.reset(); // Limpiar el formulario
                } else {
                    messageElement.textContent = data.message || 'Ocurrió un error.';
                    messageElement.style.color = 'red';
                }
            } catch (error) {
                console.error('Error:', error);
                messageElement.textContent = 'Error de conexión con el servidor.';
                messageElement.style.color = 'red';
            } finally {
                button.disabled = false;
                button.textContent = 'Crear Usuario';
            }
        });
    }
});