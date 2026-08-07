// ==========================================================================
// MÓDULO JS: PERFIL OPERATIVO Y CONSOLA DE COORDINACIÓN (NETLIFY / API REST)
// Cadena de Favores Venezuela — Resiliente y Desacoplado
// ==========================================================================

var cacheFotoPerfilB64 = { base64: null, nombre: null, cargando: false };
var cacheDocumentacionB64 = { base64: null, nombre: null, cargando: false };
var poolVoluntarios = poolVoluntarios || []; 

// ==========================================================================
// CONFIGURACIÓN DE CACHÉ LOCAL DEL PERFIL (TTL: 5 MINUTOS)
// ==========================================================================
const PROFILE_CACHE_KEY = 'cdf_perfil_cache';
const PROFILE_CACHE_TIME_KEY = 'cdf_perfil_cache_time';
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Invalida la caché del perfil para forzar la sincronización fresca desde Apps Script
 */
function invalidarCachePerfil() {
  sessionStorage.removeItem(PROFILE_CACHE_KEY);
  sessionStorage.removeItem(PROFILE_CACHE_TIME_KEY);
}

/**
 * Inicializador modular expuesto de forma global.
 * @param {boolean} forzarRecarga - Si es true, ignora la caché local y consulta al backend
 */
window.inicializarPerfilModulo = async function(forzarRecarga = false) {
    if (typeof refrescarSesionLocal === "function") refrescarSesionLocal();

    // 1. Ocultar inmediatamente el loader spinner global de la app
    const spinnerGlobal = document.getElementById('appGlobalSpinner');
    if (spinnerGlobal) spinnerGlobal.style.display = 'none';

    // 2. Verificar credenciales de sesión reales
    let cuentaActiva = window.sesionUsuario || JSON.parse(sessionStorage.getItem('userProfile') || 'null');
    
    if (!cuentaActiva || !cuentaActiva.email || cuentaActiva.email.trim() === "") {
        console.warn("No hay sesión activa en perfil.js. Omitiendo carga del perfil.");
        return;
    }

    // 3. CACHÉ INTELIGENTE
    const now = new Date().getTime();
    const cacheGuardado = sessionStorage.getItem(PROFILE_CACHE_KEY);
    const cacheTiempo = sessionStorage.getItem(PROFILE_CACHE_TIME_KEY);

    const esCacheValida = !forzarRecarga && cacheGuardado && cacheTiempo && (now - parseInt(cacheTiempo, 10) < PROFILE_CACHE_TTL_MS);

    if (esCacheValida) {
        try {
            const perfilCache = JSON.parse(cacheGuardado);
            cuentaActiva = { ...cuentaActiva, ...perfilCache };
            window.sesionUsuario = cuentaActiva;
            sessionStorage.setItem('userProfile', JSON.stringify(cuentaActiva));
        } catch (e) {
            console.warn("Caché de perfil corrupta, reconsultando servidor...", e);
            invalidarCachePerfil();
        }
    } else {
        try {
            const resPerfil = await callBackend('obtenerPerfilVoluntario', { email: cuentaActiva.email });
            if (resPerfil && resPerfil.status === "SUCCESS" && resPerfil.perfil) {
                cuentaActiva = { ...cuentaActiva, ...resPerfil.perfil };
                window.sesionUsuario = cuentaActiva;
                sessionStorage.setItem('userProfile', JSON.stringify(cuentaActiva));
                
                sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(resPerfil.perfil));
                sessionStorage.setItem(PROFILE_CACHE_TIME_KEY, now.toString());
            }
        } catch (e) {
            console.warn("No se pudo sincronizar el perfil con el servidor, usando datos locales.", e);
        }
    }

    // 4. Inyección atómica en campos del formulario
    const setFieldValue = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || "";
    };

    setFieldValue('perfilNombre', cuentaActiva.nombre || cuentaActiva.Nombre_Completo);
    setFieldValue('perfilVoluntariado', cuentaActiva.voluntariado || cuentaActiva.Voluntariado);
    setFieldValue('perfilEspecialidad', cuentaActiva.especialidad || cuentaActiva.Especialidad);
    setFieldValue('perfilTelefono', cuentaActiva.telefono || cuentaActiva.Telefono);
    setFieldValue('perfilCedula', cuentaActiva.cedula || cuentaActiva.ID_Voluntario || cuentaActiva.id);
    setFieldValue('perfilUrlFotoActual', cuentaActiva.imagen_profile || cuentaActiva.imagenProfile || cuentaActiva.urlProfile || "");
    setFieldValue('perfilImgAppActual', cuentaActiva.imgApp || cuentaActiva.Imagen_Appsheet || "");
    setFieldValue('perfilUrlDocActual', cuentaActiva.Documentacion_URL || cuentaActiva.docUrl || "");
    setFieldValue('perfilDireccion', cuentaActiva.direccion || cuentaActiva.Direccion || "");

    // Actualizar nombre en encabezado
    const txtNombreHeader = document.getElementById('txtPerfilNombreHeader');
    if (txtNombreHeader && (cuentaActiva.nombre || cuentaActiva.Nombre_Completo)) {
        txtNombreHeader.innerText = cuentaActiva.nombre || cuentaActiva.Nombre_Completo;
    }

    // 5. RESOLUCIÓN DE LA SELFIE
    const urlFotoDrive = cuentaActiva.imagen_profile || cuentaActiva.imagenProfile || cuentaActiva.urlProfile || "";
    const avatarImg = document.getElementById('avatarPrevisualizacion');
    
    if (avatarImg) {
        avatarImg.style.width = "90px";
        avatarImg.style.height = "90px";
        avatarImg.style.objectFit = "cover";
        avatarImg.className = "rounded-circle border border-3 border-primary shadow-sm";

        const nombreUsuario = cuentaActiva.nombre || cuentaActiva.Nombre_Completo || "Usuario";
        avatarImg.src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(nombreUsuario) + "&background=0d6efd&color=ffffff&size=130&bold=true";

        if (urlFotoDrive && urlFotoDrive.trim() !== "") {
            if (urlFotoDrive.startsWith("data:image")) {
                avatarImg.src = urlFotoDrive;
            } else if (urlFotoDrive.startsWith("http") && !urlFotoDrive.includes("drive.google.com")) {
                avatarImg.src = urlFotoDrive;
            } else {
                callBackend('obtenerImagenBase64', { urlFoto: urlFotoDrive }).then(base64Res => {
                    if (base64Res && base64Res.base64) {
                        avatarImg.src = base64Res.base64;
                    }
                }).catch(err => {
                    console.warn("No se pudo obtener la imagen en Base64 de la API:", err);
                });
            }
        }
    }

    // 6. Despliegue del historial de credenciales
    const urlDocExistente = cuentaActiva.Documentacion_URL || cuentaActiva.docUrl;
    if (urlDocExistente && urlDocExistente.trim() !== "") {
        cargarHistorialDocumentosFicha();
    }

    // 7. Catálogo maestro de especialidades
    try {
        const resEsp = await callBackend('obtenerEspecialidades', {});
        const datalist = document.getElementById('listaEspecialidades');
        if (datalist && resEsp && resEsp.especialidades) {
            datalist.innerHTML = '';
            resEsp.especialidades.forEach(esp => {
                const option = document.createElement('option');
                option.value = esp;
                datalist.appendChild(option);
            });
        }
    } catch(err) {
        console.warn("No se pudieron pre-cargar especialidades maestro.");
    }

    // 8. Selector dinámico de puntos de recogida
    const selectRecogida = document.getElementById('perfilRecogida');
    if (selectRecogida) {
        const puntoDefinido = cuentaActiva.puntoRecogida || cuentaActiva.Punto_Recogida_Preferido || "";
        try {
            const resPuntos = await callBackend('obtenerPuntosRecogida', {});
            if (resPuntos && resPuntos.puntos) {
                selectRecogida.innerHTML = '<option value="" disabled>-- Seleccione un Punto --</option>'; 
                
                resPuntos.puntos.forEach((lugar) => {
                    const option = document.createElement('option');
                    option.value = lugar.id || lugar.nombre;     
                    option.innerText = lugar.nombre; 
                    
                    if (puntoDefinido === lugar.id || puntoDefinido === lugar.nombre) {
                        option.selected = true;
                    }
                    selectRecogida.appendChild(option);
                });

                if (puntoDefinido && !selectRecogida.value) {
                    const optExtra = document.createElement('option');
                    optExtra.value = puntoDefinido;
                    optExtra.innerText = puntoDefinido;
                    optExtra.selected = true;
                    selectRecogida.appendChild(optExtra);
                }
            }
        } catch(err) {
            selectRecogida.innerHTML = `<option value="Estación">Estación / Base de Salida</option>`;
        }
    }

    // 9. Control de permisos, roles y estatus
    const lblEstatus = document.getElementById('lblEstatusVerificacion');
    const seccionCalendario = document.getElementById('seccionCalendarioDesplegable');
    const contenedorBloqueo = document.getElementById('contenedorBloqueo');
    const msgBloqueo = contenedorBloqueo ? contenedorBloqueo.querySelector('span.small') : null;

    const esRolCoordinador = Boolean(
        cuentaActiva.esCoordinador || 
        cuentaActiva.coordinador === true || 
        cuentaActiva.isCoordinador === true ||
        cuentaActiva.rolActivo === "coordinador" || 
        cuentaActiva.rolActive === "coordinador" ||
        cuentaActiva.role === "coordinador"
    );

    if (esRolCoordinador) {
        if (lblEstatus) {
            lblEstatus.className = "badge bg-danger";
            lblEstatus.innerHTML = '<i class="fa-solid fa-user-shield me-1"></i> Autoridad / Coordinador';
        }
        if (seccionCalendario) seccionCalendario.classList.remove('d-none');
        if (contenedorBloqueo) contenedorBloqueo.classList.add('d-none');
        
        const panelAcc = document.getElementById('panelAccionesCoordinador');
        if (panelAcc) panelAcc.classList.remove('d-none');

        const panelMon = document.getElementById('panelMonitoreoCuota');
        if (panelMon) panelMon.classList.remove('d-none');
        
        if (typeof sincronizarCuotaDeEnvios === 'function') sincronizarCuotaDeEnvios();
        if (typeof cargarPoolVoluntariosAsincrono === 'function') cargarPoolVoluntariosAsincrono();  
    } 
    else if (cuentaActiva.banned === true) {
        if (lblEstatus) {
            lblEstatus.className = "badge bg-dark";
            lblEstatus.innerHTML = '<i class="fa-solid fa-ban me-1"></i> Perfil Restringido';
        }
        if (msgBloqueo) msgBloqueo.innerText = "Su perfil está siendo verificado por la coordinación central. El acceso se restaurará al finalizar el proceso.";
        if (contenedorBloqueo) contenedorBloqueo.classList.remove('d-none');
        if (seccionCalendario) seccionCalendario.classList.add('d-none');
    } 
    else if (cuentaActiva.verificado) {
        if (lblEstatus) {
            lblEstatus.className = "badge bg-success";
            lblEstatus.innerHTML = '<i class="fa-solid fa-circle-check me-1"></i> Verificado';
        }
        if (seccionCalendario) seccionCalendario.classList.remove('d-none');
        if (contenedorBloqueo) contenedorBloqueo.classList.add('d-none');
    } 
    else {
        if (lblEstatus) {
            lblEstatus.className = "badge bg-warning text-dark";
            lblEstatus.innerHTML = '<i class="fa-solid fa-clock me-1"></i> En Revisión';
        }
        if (msgBloqueo) msgBloqueo.innerText = "El acceso al calendario se activará automáticamente cuando complete su perfil y la coordinación valide sus credenciales.";
        if (contenedorBloqueo) contenedorBloqueo.classList.remove('d-none');
        if (seccionCalendario) seccionCalendario.classList.add('d-none');
    }
};

// Autoejecución tras la inyección en el DOM
setTimeout(function() {
    if (typeof window.inicializarPerfilModulo === "function") window.inicializarPerfilModulo();
}, 50);

function procesarPrevisualizacionFoto(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        cacheFotoPerfilB64.cargando = true;
        reader.onload = function(e) {
            const imgEl = document.getElementById('avatarPrevisualizacion');
            if (imgEl) imgEl.src = e.target.result;
            cacheFotoPerfilB64.base64 = e.target.result;
            cacheFotoPerfilB64.nombre = file.name;
            cacheFotoPerfilB64.cargando = false;
        };
        reader.readAsDataURL(file);
    }
}

function procesarDocumentoLocal(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        cacheDocumentacionB64.cargando = true;
        reader.onload = function(e) {
            cacheDocumentacionB64.base64 = e.target.result;
            cacheDocumentacionB64.nombre = file.name;
            cacheDocumentacionB64.cargando = false;
        };
        reader.readAsDataURL(file);
    }
}

/**
 * Procesa el guardado del perfil alineando las claves requeridas por Apps Script.
 */
async function actualizarPerfil(event) {
    event.preventDefault();
    const formElement = document.getElementById('formPerfil');
    
    if (!formElement) return;

    if (cacheFotoPerfilB64.cargando || cacheDocumentacionB64.cargando) {
        alert("Los archivos adjuntos aún se están procesando localmente. Espere un momento.");
        return;
    }
    
    formElement.classList.add('was-validated');
    if (!formElement.checkValidity()) {
        return;
    }

    const cuentaActiva = window.sesionUsuario || JSON.parse(sessionStorage.getItem('userProfile')) || {};
    const idVoluntarioCalculado = document.getElementById('perfilCedula').value.trim() || cuentaActiva.ID_Voluntario || cuentaActiva.id || cuentaActiva.cedula;

    // PAYLOAD SERIALIZADO DUAL PARA APPS SCRIPT Y APPSHEET
    const datos = {
        idVoluntario: idVoluntarioCalculado,
        ID_Voluntario: idVoluntarioCalculado,
        cedula: document.getElementById('perfilCedula').value.trim(),
        nombre: document.getElementById('perfilNombre').value.trim(),
        Nombre_Completo: document.getElementById('perfilNombre').value.trim(),
        voluntariado: document.getElementById('perfilVoluntariado').value.trim(),
        Voluntariado: document.getElementById('perfilVoluntariado').value.trim(),
        especialidad: document.getElementById('perfilEspecialidad').value.trim(),
        Especialidad: document.getElementById('perfilEspecialidad').value.trim(),
        puntoRecogida: document.getElementById('perfilRecogida')?.value || "",
        Punto_Recogida_Preferido: document.getElementById('perfilRecogida')?.value || "",
        telefono: document.getElementById('perfilTelefono').value.trim(),
        Telefono: document.getElementById('perfilTelefono').value.trim(),
        direccion: document.getElementById('perfilDireccion').value.trim(),
        correo: cuentaActiva.email || cuentaActiva.Correo || "voluntario@cadenadefavoresvzla.org",
        Correo: cuentaActiva.email || cuentaActiva.Correo || "voluntario@cadenadefavoresvzla.org",
        
        // Punteros e imágenes
        imagen_profile_actual: document.getElementById('perfilUrlFotoActual')?.value || "",
        imgApp_actual: document.getElementById('perfilImgAppActual')?.value || "",
        Documentacion_URL_actual: document.getElementById('perfilUrlDocActual')?.value || "",
        
        // Archivos procesados en Base64
        imagen_profile_base64: cacheFotoPerfilB64.base64,
        imagen_profile_nombre: cacheFotoPerfilB64.nombre,
        Documentacion_base64: cacheDocumentacionB64.base64,
        Documentacion_nombre: cacheDocumentacionB64.nombre
    };

    const btnSubmit = formElement.querySelector('button[type="submit"]');
    let htmlOriginalBtn = "";
    if (btnSubmit) {
        btnSubmit.disabled = true;
        htmlOriginalBtn = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span> Guardando en la Red...';
    }

    const res = await callBackend('registrarVoluntario', datos);

    if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = htmlOriginalBtn;
    }

    if (res && res.status === "SUCCESS") {
        const perfilActualizado = res.perfil || { ...cuentaActiva, ...datos };
        
        if (res.urlProfile) perfilActualizado.imagen_profile = res.urlProfile;
        if (res.imgApp) perfilActualizado.imgApp = res.imgApp;

        sessionStorage.setItem('userProfile', JSON.stringify(perfilActualizado));
        window.sesionUsuario = perfilActualizado;
        
        if (typeof refrescarSesionLocal === "function") refrescarSesionLocal();
        
        // Limpiar caché de archivos locales
        cacheFotoPerfilB64 = { base64: null, nombre: null, cargando: false };
        cacheDocumentacionB64 = { base64: null, nombre: null, cargando: false };

        invalidarCachePerfil();

        alert("¡Perfil guardado y sincronizado exitosamente con la Red Operativa!");
        if (typeof window.inicializarPerfilModulo === "function") window.inicializarPerfilModulo(true);

    } else {
        alert("Atención: " + (res ? res.message : "No se pudo sincronizar el perfil con el servidor. Reintente más tarde."));
    }
}

async function cargarPoolVoluntariosAsincrono() {
    const res = await callBackend('obtenerVoluntarios', {});
    if (res && res.voluntarios) {
        poolVoluntarios = res.voluntarios;
        if (typeof renderizarTarjetasAgendaLocal === "function") {
            renderizarTarjetasAgendaLocal(poolVoluntarios);
        }
        actualizarContadorAptosLocal();
    }
}

function actualizarContadorAptosLocal() {
    const lblAptos = document.getElementById('lblVoluntariosDisponibles');
    if (lblAptos) {
        let aptosCount = 0;
        const ahora = Date.now();
        
        if (poolVoluntarios && poolVoluntarios.length > 0) {
            poolVoluntarios.forEach(vol => {
                const lastAdviseTime = vol.lastAdvise ? parseInt(vol.lastAdvise) : 0;
                const horasDiff = lastAdviseTime > 0 ? (ahora - lastAdviseTime) / (1000 * 60 * 60) : 999;
                if (vol.verificado && !vol.banned && vol.masiveAdvise !== "FALSE" && !vol.esCoordinador && horasDiff > 48) {
                    aptosCount++;
                }
            });
        }
        
        lblAptos.innerText = aptosCount;
        lblAptos.className = aptosCount > 0 ? "badge bg-purple font-monospace fs-6 text-white" : "badge bg-secondary font-monospace fs-6 text-white";
    }
}

async function sincronizarCuotaDeEnvios(btn) {
    let originalText = "";
    if (btn) {
        btn.disabled = true;
        originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Sincronizando...';
    }
    
    const lbl = document.getElementById('lblCuotaDisponible');
    if (lbl) lbl.innerText = "Consultando...";

    const res = await callBackend('obtenerCuotaDisponible', {});

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
    if (lbl && res && res.status === "SUCCESS") {
        lbl.innerText = res.cuota;
        lbl.className = res.cuota > 150 ? "badge bg-success font-monospace fs-6 text-white" : "badge bg-warning font-monospace fs-6 text-dark";
    } else if (lbl) {
        lbl.innerText = "N/D";
    }
}

async function cargarHistorialDocumentosFicha() {
    const cuentaActiva = window.sesionUsuario || JSON.parse(sessionStorage.getItem('userProfile')) || {};
    const idVol = cuentaActiva.id || cuentaActiva.ID_Voluntario || "";
    const tbody = document.getElementById('tablaDocsVoluntarioBody');
    const divContenedor = document.getElementById('contenedorDocsVoluntario');
    
    if (!tbody || !divContenedor || !idVol) return;
    
    const res = await callBackend('obtenerDocumentosVoluntario', { idVoluntario: idVol });

    if (res && res.status === "SUCCESS" && res.documentos && res.documentos.length > 0) {
        divContenedor.classList.remove('d-none');
        tbody.innerHTML = "";
        
        res.documentos.forEach(doc => {
            tbody.innerHTML += `
              <tr>
                <td class="text-truncate" style="max-width: 250px;" title="${doc.nombre}">
                   <i class="fa-solid fa-file-pdf text-danger me-2"></i><strong>${doc.nombre}</strong>
                </td>
                <td class="text-muted" style="font-size:0.75rem;">${doc.fecha}</td>
                <td class="text-center">
                   <a href="${doc.url}" target="_blank" class="btn btn-sm btn-outline-primary p-0 px-2 border-0" title="Ver archivo"><i class="fa-solid fa-eye fs-6"></i></a>
                   <button type="button" class="btn btn-sm btn-outline-danger p-0 px-2 border-0 ms-1" title="Eliminar de Drive" onclick="eliminarCredencialFicha('${doc.id}', '${idVol}')"><i class="fa-solid fa-trash fs-6"></i></button>
                </td>
              </tr>
            `;
        });
    } else {
        divContenedor.classList.add('d-none');
    }
}

async function eliminarCredencialFicha(fileId, idVol) {
    if (!confirm("ADVERTENCIA:\n¿Está seguro de eliminar esta credencial de su expediente en Google Drive?")) return;
    
    const res = await callBackend('eliminarDocumentoDrive', { fileId: fileId, idVoluntario: idVol });

    if (res && res.status === "SUCCESS") {
        alert("Documento removido exitosamente.");
        invalidarCachePerfil();
        cargarHistorialDocumentosFicha();
    } else {
        alert("Error al eliminar documento: " + (res ? res.message : "Error de comunicación"));
    }
}

async function abrirInformeConvocadosHoy(btn) {
    let originalText = "";
    if (btn) {
        btn.disabled = true;
        originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Generando...';
    }

    try {
        const res = await callBackend('obtenerConvocadosHoy', {});
        
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }

        if (res && res.status === "SUCCESS") {
            alert("Reporte generado con éxito. Total convocados hoy: " + (res.total || 0));
        } else {
            alert("Información: " + (res ? res.message : "No hay convocados registrados para el día de hoy."));
        }
    } catch (e) {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
        console.error("Error al obtener reporte de convocados:", e);
        alert("No se pudo conectar con el servidor para generar el reporte.");
    }
}