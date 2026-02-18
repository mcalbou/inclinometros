// assets/js/logica_modificar_usuario.js
document.addEventListener('DOMContentLoaded', () => {
    const selectUsuario = document.getElementById('select-usuario');
    const formModificar = document.getElementById('form-modificar');
    const btnEliminar = document.getElementById('btn-eliminar');
    const messageEl = document.getElementById('message');
    
    let listaUsuarios = []; // Guardaremos la lista de usuarios aquí

    // --- 1. Cargar la lista de usuarios al abrir la página ---
    async function cargarUsuarios() {
        try {
            const response = await fetch('api/api_listar_usuarios.php');
            if (!response.ok) throw new Error('No se pudo obtener la lista de usuarios.');
            
            listaUsuarios = await response.json();
            
            selectUsuario.innerHTML = '<option value="">-- Seleccione un usuario --</option>'; // Opción por defecto
            listaUsuarios.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.nombre_usuario} (${user.rol})`;
                selectUsuario.appendChild(option);
            });

        } catch (error) {
            messageEl.textContent = error.message;
            messageEl.style.color = 'red';
        }
    }

    // --- 2. Cuando se selecciona un usuario del desplegable ---
    selectUsuario.addEventListener('change', () => {
        const userId = selectUsuario.value;
        if (!userId) {
            formModificar.classList.add('hidden');
            btnEliminar.classList.add('hidden');
            messageEl.textContent = '';
            return;
        }

        const usuarioSeleccionado = listaUsuarios.find(user => user.id == userId);
        
        document.getElementById('usuario-id').value = usuarioSeleccionado.id;
        document.getElementById('usuario-nombre').value = usuarioSeleccionado.nombre_usuario;
        document.getElementById('usuario-email').value = usuarioSeleccionado.email;
        document.getElementById('usuario-rol').value = usuarioSeleccionado.rol;

        formModificar.classList.remove('hidden');
        btnEliminar.classList.remove('hidden');
        messageEl.textContent = '';
    });

    // --- 3. Cuando se envía el formulario para ACTUALIZAR ---
    formModificar.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            id: document.getElementById('usuario-id').value,
            email: document.getElementById('usuario-email').value,
            rol: document.getElementById('usuario-rol').value
        };

        try {
            const res = await fetch('api/api_modificar_usuario.php', { 
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload) 
            });
            const data = await res.json();
            
            messageEl.textContent = data.message;
            messageEl.style.color = res.ok ? 'green' : 'red';
            
            if (res.ok) {
                // Pequeña mejora: esperar un poco antes de recargar para que el usuario lea el mensaje
                setTimeout(cargarUsuarios, 1500); 
            }
        } catch(err) {
            console.error('Error al actualizar:', err);
            messageEl.textContent = 'Error de conexión al intentar actualizar.';
            messageEl.style.color = 'red';
        }
    });

    // --- 4. Cuando se hace clic en ELIMINAR ---
    btnEliminar.addEventListener('click', async () => {
        const userId = document.getElementById('usuario-id').value;
        const userName = document.getElementById('usuario-nombre').value;
        
        // El diálogo de confirmación es muy importante
        if (!confirm(`¿Estás SEGURO de que quieres eliminar permanentemente al usuario "${userName}"?\n\n¡Esta acción no se puede deshacer!`)) {
            return;
        }
        
        try {
            const res = await fetch('api/api_eliminar_usuario.php', { 
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id: userId }) 
            });
            const data = await res.json();
            
            if (res.ok) {
                messageEl.textContent = data.message;
                messageEl.style.color = 'green';
                formModificar.classList.add('hidden');
                btnEliminar.classList.add('hidden');
                // Recargar la lista para que el usuario eliminado desaparezca
                cargarUsuarios(); 
            } else {
                messageEl.textContent = data.message || 'No se pudo eliminar al usuario.';
                messageEl.style.color = 'red';
            }
        } catch(err) {
            console.error('Error al eliminar:', err);
            messageEl.textContent = 'Error de conexión al intentar eliminar.';
            messageEl.style.color = 'red';
        }
    });

    // Iniciar todo cargando los usuarios
    cargarUsuarios();
});