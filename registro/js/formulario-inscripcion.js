// ==========================================================================
// MÓDULO JS: FORMULARIO DE INSCRIPCIÓN Y REGISTRO DE VOLUNTARIOS
// ==========================================================================

/**
 * Renderiza la interfaz del formulario dentro del modal de forma segura.
 * Se ejecuta únicamente después de haber validado el correo con OTP.
 */
async function cargarFormularioNuevoVoluntario(email, idGuardia) {
    const body = document.getElementById('modalGuardiaBody');
    if (!body) return; 
    
    // Eliminamos el título duplicado de la cabecera
    const headerTitle = document.querySelector('#modalGuardia .modal-title');
    if (headerTitle) headerTitle.innerHTML = '<i class="fa-solid fa-address-card me-2"></i>Inscripción de Personal';

    body.innerHTML = `
        <h5 class="text-center mb-3 text-primary fw-bold">Formulario de Registro Nuevo</h5>
        <p class="text-success small mb-3 text-center">
            <i class="fa-solid fa-circle-check me-1"></i> Correo verificado con éxito. Complete su perfil.
        </p>
        
        <form id="formNuevoVoluntario">
            <div class="mb-2">
                <label class="form-label small fw-bold">Cédula / Pasaporte</label>
                <input type="text" class="form-control" id="regCedula" required placeholder="V-12345678" pattern="^[V|E|P|J|G]-[0-9]{5,9}$">
            </div>
            <div class="mb-2">
                <label class="form-label small fw-bold">Nombre Completo</label>
                <input type="text" class="form-control" id="regNombre" required placeholder="Nombre y Apellido">
            </div>
            
            <div class="row">
                <div class="col-md-6 mb-2">
                    <label class="form-label small fw-bold">Área de Voluntariado</label>
                    <select class="form-select" id="regAreaMacro" required>
                        <option value="" selected disabled>Seleccione su área macro</option>
                        <option value="Medicina">Medicina</option>
                        <option value="Transporte">Transporte</option>
                        <option value="Apoyo Logístico">Apoyo Logístico</option>
                    </select>
                </div>
                <div class="col-md-6 mb-2">
                    <label class="form-label small fw-bold">Especialidad Técnica</label>
                    <input type="text" class="form-control" id="regEspecialidad" list="listaEspecialidadesRegistro" placeholder="Ej. Paramédico, Conductor, etc." required>
                    <datalist id="listaEspecialidadesRegistro"></datalist>
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-6 mb-2">
                    <label class="form-label small fw-bold">Punto de Recogida</label>
                    <select class="form-select" id="regUbicacion" required>
                        <option value="" disabled selected>Cargando rutas...</option>
                    </select>
                </div>
                <div class="col-md-6 mb-2">
                    <label class="form-label small fw-bold">Dirección Exacta</label>
                    <input type="text" class="form-control" id="regDireccion" required placeholder="Ej. Av. Bolívar, Edf. X">
                </div>
            </div>
            
            <div class="mb-3">
                <label class="form-label small fw-bold">Teléfono de Contacto</label>
                <input type="tel" class="form-control" id="regTelefono" required placeholder="Ej. +58 414 1234567" pattern="^[\\+0-9\\s\\-]{10,20}$" title="Ingrese su número con código de país (Ej. +58 414 1234567)">
            </div>
            
            <div class="mt-4 p-3 bg-light rounded border border-info-subtle">
                <h6 class="small fw-bold text-dark mb-2"><i class="fa-solid fa-user-shield me-1"></i> Compromiso de Privacidad</h6>
                <div id="contenedorTextoPoliticas"></div> 
                <div class="form-check mt-3">
                    <input class="form-check-input border-primary" type="checkbox" id="checkAceptarPoliticas" required onchange="document.getElementById('btnEnviarRegistro').disabled = !this.checked">
                    <label class="form-check-label small fw-bold text-primary" for="checkAceptarPoliticas">
                        He leído y acepto las políticas de privacidad y manejo de datos.
                    </label>
                </div>
            </div>

            <button type="submit" class="btn btn-success w-100 mt-3 py-2 fw-bold shadow" id="btnEnviarRegistro" disabled>
                Confirmar e Inscribirme
            </button>
        </form>
    `;

    // Asignación de evento Submit
    const form = document.getElementById('formNuevoVoluntario');
    if (form) {
        form.addEventListener('submit', function(event) {
            registrarDirectoVoluntarioVerificado(event, email, idGuardia);
        });
    }

    // Inyección de Políticas
    const tplPol = document.getElementById('template-politicas');
    if (tplPol && document.getElementById('contenedorTextoPoliticas')) {
        document.getElementById('contenedorTextoPoliticas').appendChild(tplPol.content.cloneNode(true));
    }

    // CARGA ASÍNCRONA HOMOLOGADA: Puntos de Recogida
    const selectRecogida = document.getElementById('regUbicacion');
    try {
        const resPuntos = await callBackend('obtenerPuntosRecogida', {});
        if (selectRecogida && resPuntos && resPuntos.puntos) {
            selectRecogida.innerHTML = '<option value="" disabled selected>Seleccione una ruta</option>';
            resPuntos.puntos.forEach(lugar => {
                const option = document.createElement('option');
                option.value = lugar.id;
                option.innerText = lugar.nombre;
                selectRecogida.appendChild(option);
            });
        }
    } catch(err) {
        if (selectRecogida) selectRecogida.innerHTML = '<option value="Estación" selected>Estación / Base de Salida</option>';
    }

    // CARGA ASÍNCRONA HOMOLOGADA: Especialidades Sugeridas
    try {
        const resEsp = await callBackend('obtenerEspecialidades', {});
        const dl = document.getElementById('listaEspecialidadesRegistro');
        if (dl && resEsp && resEsp.especialidades) {
            dl.innerHTML = resEsp.especialidades.map(e => `<option value="${e}">`).join('');
        }
    } catch(err) {
        console.warn("No se pudieron pre-cargar las especialidades sugeridas.");
    }
}

/**
 * Transacción final y almacenamiento indexado en el Maestro
 */
async function registrarDirectoVoluntarioVerificado(event, email, idGuardia) {
    event.preventDefault();
    const btn = document.getElementById('btnEnviarRegistro');
    if (!btn) return;
    
    const datosVoluntario = {
        cedula: document.getElementById('regCedula').value.trim().toUpperCase(),
        nombre: document.getElementById('regNombre').value.trim(),
        areaMacro: document.getElementById('regAreaMacro').value,       
        especialidad: document.getElementById('regEspecialidad').value.trim(), 
        ubicacion: document.getElementById('regUbicacion').value,       
        direccion: document.getElementById('regDireccion').value.trim(),
        telefono: document.getElementById('regTelefono').value.trim(),  
        email: email.trim().toLowerCase()
    };
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando datos en el Maestro...';
    
    const payloadRegistro = {
        ID_Voluntario: "VOL-" + Math.random().toString(36).substr(2, 8).toUpperCase(),
        cedula: datosVoluntario.cedula,
        Nombre_Completo: datosVoluntario.nombre,
        Voluntariado: datosVoluntario.areaMacro, 
        Especialidad: datosVoluntario.especialidad,
        Punto_Recogida_Preferido: datosVoluntario.ubicacion,
        Telefono: datosVoluntario.telefono,      
        direccion: datosVoluntario.direccion,
        Correo: datosVoluntario.email
    };

    const finalRes = await callBackend('registrarVoluntario', payloadRegistro);

    if (finalRes && finalRes.status === "SUCCESS") {
        // Sincronizamos la sesión con el perfil básico creado
        sessionStorage.setItem('userProfile', JSON.stringify(finalRes.perfil));
        window.sesionUsuario = finalRes.perfil;
        
        const modalBody = document.getElementById('modalGuardiaBody');
        modalBody.innerHTML = `
            <div class="p-4 text-center animate__animated animate__zoomIn">
                <div class="text-success mb-3">
                    <i class="fa-solid fa-circle-check fa-5x"></i>
                </div>
                <h4 class="fw-bold text-dark mb-1">¡Registro Básico Exitoso!</h4>
                <p class="text-muted small mb-4">Te damos la bienvenida formal a la Red Operativa.</p>
                
                <div class="alert alert-warning text-start small border-0 bg-warning-subtle mb-4">
                   <i class="fa-solid fa-circle-exclamation me-1 text-warning"></i> <strong>ÚLTIMO PASO OBLIGATORIO:</strong><br>
                   Para activar tu acceso al calendario de misiones, ahora debes **capturar tu Selfie** y **subir tu Soporte Documental (PDF)** en el panel de tu perfil.
                </div>
                
                <button type="button" class="btn btn-primary w-100 py-2 fw-bold shadow-sm" onclick="finalizarOnboardingNuevoUsuario(${idGuardia ? `'${idGuardia}'` : 'null'}, '${email}')">
                    <i class="fa-solid fa-circle-right me-1"></i> Ir a Completar Mi Perfil
                </button>
            </div>`;
        
    } else {
        restablecerBotonRegistro(btn, "Error: " + (finalRes?.message || "Error al procesar la solicitud."));
    }
}

/**
 * Cierra el modal de registro y redirige al usuario hacia el Perfil o la Guardia
 */
function finalizarOnboardingNuevoUsuario(idGuardia, email) {
    const modalElem = document.getElementById('modalGuardia');
    if (!modalElem) return;
    
    modalElem.removeAttribute('data-bs-backdrop');
    modalElem.removeAttribute('data-bs-keyboard');
    const closeBtn = modalElem.querySelector('.btn-close');
    if (closeBtn) closeBtn.style.display = 'block';

    const modal = bootstrap.Modal.getInstance(modalElem);
    if (modal) modal.hide();

    if (idGuardia) {
        setTimeout(() => {
            if (typeof guardiasData !== 'undefined') {
                const guardia = guardiasData.find(g => g.id === idGuardia);
                if (guardia && typeof abrirModalGuardia === 'function') {
                    abrirModalGuardia(guardia, 'guardia-verde');
                }
            }
        }, 400);
    } else {
        if (typeof cargarVista === 'function') {
            cargarVista('perfil'); 
        }
    }
}

/**
 * Auxiliar para restaurar el estado del botón ante fallos
 */
function restablecerBotonRegistro(btn, mensajeError) {
    btn.disabled = false;
    btn.innerHTML = 'Confirmar e Inscribirme';
    alert(mensajeError);
}