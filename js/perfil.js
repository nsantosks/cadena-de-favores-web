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
    const cuentaActiva = window.sesionUsuario || JSON.parse(sessionStorage.getItem('userProfile') || '{}');
    const idVol = cuentaActiva.id || cuentaActiva.ID_Voluntario || cuentaActiva.cedula || "";
    if (idVol) sessionStorage.removeItem('cdf_docs_cache_' + idVol);
    if (cuentaActiva.email) sessionStorage.removeItem('cdf_avatar_b64_' + cuentaActiva.email);
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
            // CORRECCIÓN CRÍTICA: La acción en el switch de Apps Script es 'obtenerPerfil'
            const resPerfil = await callBackend('obtenerPerfil', { email: cuentaActiva.email });
            if (resPerfil && resPerfil.status === "SUCCESS" && resPerfil.perfil) {
                cuentaActiva = { ...cuentaActiva, ...resPerfil.perfil };
                window.sesionUsuario = cuentaActiva;
                sessionStorage.setItem('userProfile', JSON.stringify(cuentaActiva));
                localStorage.setItem('userProfile', JSON.stringify(cuentaActiva));
                
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
    
    // Inyección de valor en el desplegable de Voluntariado/Grupo
    const valVoluntariado = cuentaActiva.voluntariado || cuentaActiva.Voluntariado || "";
    setFieldValue('perfilVoluntariado', valVoluntariado);
    setFieldValue('selVoluntariadoGrupo', valVoluntariado);

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

    // 5. RESOLUCIÓN DE LA SELFIE CON CACHÉ LOCAL OPTIMIZADA
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
                const avatarCacheKey = 'cdf_avatar_b64_' + cuentaActiva.email;
                const base64Cached = sessionStorage.getItem(avatarCacheKey);
                const urlDriveCached = sessionStorage.getItem(avatarCacheKey + '_url');

                if (base64Cached && urlDriveCached === urlFotoDrive) {
                    avatarImg.src = base64Cached;
                } else {
                    callBackend('obtenerImagenBase64', { urlDrive: urlFotoDrive }).then(base64Res => {
                        if (base64Res && base64Res.base64) {
                            avatarImg.src = base64Res.base64;
                            sessionStorage.setItem(avatarCacheKey, base64Res.base64);
                            sessionStorage.setItem(avatarCacheKey + '_url', urlFotoDrive);
                        }
                    }).catch(err => {
                        console.warn("No se pudo obtener la imagen en Base64 de la API:", err);
                    });
                }
            }
        }
    }

    // 6. DESPLIEGUE CACHEADO DEL HISTORIAL DE CREDENCIALES
    cargarHistorialDocumentosFicha();

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

    // 8. SELECTOR DINÁMICO DE PUNTOS DE RECOGIDA
    const selectRecogida = document.getElementById('perfilRecogida');
    if (selectRecogida) {
        const puntoDefinido = cuentaActiva.puntoRecogida || cuentaActiva.Punto_Recogida_Preferido || cuentaActiva.puntoRecogidaID || "";
        
        let puntosCache = sessionStorage.getItem('cdf_puntos_cache');
        let puntosLista = puntosCache ? JSON.parse(puntosCache) : null;

        if (!puntosLista) {
            try {
                const resPuntos = await callBackend('obtenerPuntosRecogida', {});
                if (resPuntos && resPuntos.puntos) {
                    puntosLista = resPuntos.puntos;
                    sessionStorage.setItem('cdf_puntos_cache', JSON.stringify(puntosLista));
                }
            } catch(err) {
                console.warn("No se pudo cargar los puntos.");
            }
        }

        if (puntosLista) {
            selectRecogida.innerHTML = '<option value="" disabled>-- Seleccione un Punto --</option>'; 
            puntosLista.forEach((lugar) => {
                const option = document.createElement('option');
                option.value = lugar.id || lugar.nombre;     
                option.innerText = lugar.nombre; 
                if (puntoDefinido === lugar.id || puntoDefinido === lugar.nombre) option.selected = true;
                selectRecogida.appendChild(option);
            });
            
            if (puntoDefinido && !selectRecogida.value) {
                selectRecogida.innerHTML += `<option value="${puntoDefinido}" selected>${puntoDefinido}</option>`;
            }
        }
    }

    // 9. CONTROL DE PERMISOS, ROLES Y ESTATUS
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
 * Procesa el guardado general del perfil enviando texto y asegurando sincronización inmediata.
 */
async function actualizarPerfil(event) {
    event.preventDefault();
    const formElement = document.getElementById('formPerfil');
    
    if (!formElement) return;
    
    formElement.classList.add('was-validated');
    if (!formElement.checkValidity()) {
        return;
    }

    const cuentaActiva = window.sesionUsuario || JSON.parse(sessionStorage.getItem('userProfile')) || {};
    const idVoluntarioCalculado = document.getElementById('perfilCedula').value.trim() || cuentaActiva.ID_Voluntario || cuentaActiva.id || cuentaActiva.cedula;

    const nombreIngresado = document.getElementById('perfilNombre').value.trim();
    const cedulaIngresada = document.getElementById('perfilCedula').value.trim();
    
    // Captura el valor del desplegable (soporta tanto id="perfilVoluntariado" como id="selVoluntariadoGrupo")
    const elVoluntariado = document.getElementById('perfilVoluntariado') || document.getElementById('selVoluntariadoGrupo');
    const voluntariadoIngresado = elVoluntariado ? elVoluntariado.value : "";

    const especialidadIngresada = document.getElementById('perfilEspecialidad').value.trim();
    const puntoIngresado = document.getElementById('perfilRecogida')?.value || "";
    const telefonoIngresado = document.getElementById('perfilTelefono').value.trim();
    const direccionIngresada = document.getElementById('perfilDireccion').value.trim();

    const datos = {
        idVoluntario: idVoluntarioCalculado,
        ID_Voluntario: idVoluntarioCalculado,
        cedula: cedulaIngresada,
        nombre: nombreIngresado,
        Nombre_Completo: nombreIngresado,
        voluntariado: voluntariadoIngresado,
        Voluntariado: voluntariadoIngresado,
        especialidad: especialidadIngresada,
        Especialidad: especialidadIngresada,
        puntoRecogida: puntoIngresado,
        Punto_Recogida_Preferido: puntoIngresado,
        telefono: telefonoIngresado,
        Telefono: telefonoIngresado,
        direccion: direccionIngresada,
        correo: cuentaActiva.email || cuentaActiva.Correo || "voluntario@cadenadefavoresvzla.org",
        Correo: cuentaActiva.email || cuentaActiva.Correo || "voluntario@cadenadefavoresvzla.org",
        
        imagen_profile_actual: document.getElementById('perfilUrlFotoActual')?.value || "",
        imgApp_actual: document.getElementById('perfilImgAppActual')?.value || "",
        Documentacion_URL_actual: document.getElementById('perfilUrlDocActual')?.value || ""
    };

    const btnSubmit = formElement.querySelector('button[type="submit"]');
    let htmlOriginalBtn = "";
    if (btnSubmit) {
        btnSubmit.disabled = true;
        htmlOriginalBtn = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span> Sincronizando con la Red...';
    }

    const res = await callBackend('registrarVoluntario', datos);

    if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = htmlOriginalBtn;
    }

    if (res && res.status === "SUCCESS") {
        const perfilActualizado = {
            ...cuentaActiva,
            ...datos,
            nombre: nombreIngresado,
            Nombre_Completo: nombreIngresado,
            cedula: cedulaIngresada,
            voluntariado: voluntariadoIngresado,
            Voluntariado: voluntariadoIngresado,
            especialidad: especialidadIngresada,
            Especialidad: especialidadIngresada,
            telefono: telefonoIngresado,
            Telefono: telefonoIngresado,
            puntoRecogida: puntoIngresado,
            Punto_Recogida_Preferido: puntoIngresado,
            direccion: direccionIngresada,
            ...(res.perfil || {})
        };
        
        if (res.urlProfile) perfilActualizado.imagen_profile = res.urlProfile;
        if (res.imgApp) perfilActualizado.imgApp = res.imgApp;

        // 1. ACTUALIZACIÓN DIRECTA DE SESIÓN Y CACHÉ LOCAL
        window.sesionUsuario = perfilActualizado;
        sessionStorage.setItem('userProfile', JSON.stringify(perfilActualizado));
        localStorage.setItem('userProfile', JSON.stringify(perfilActualizado));
        
        invalidarCachePerfil();

        if (typeof refrescarSesionLocal === "function") refrescarSesionLocal();
        
        // 2. RE-SINCRONIZAR EL HEADER GLOBAL
        if (typeof sincronizarHeaderGlobal === 'function') {
            sincronizarHeaderGlobal();
        }

        cacheFotoPerfilB64 = { base64: null, nombre: null, cargando: false };
        cacheDocumentacionB64 = { base64: null, nombre: null, cargando: false };

        // 3. NAVEGACIÓN O DESPLIEGUE SEGÚN VERIFICACIÓN
        const esVerificadoReal = Boolean(
            perfilActualizado.verificado === true || 
            perfilActualizado.verificado === "Verificado" || 
            perfilActualizado.verificado === "TRUE"
        );

        const esCoordinadorReal = Boolean(
            perfilActualizado.esCoordinador || 
            perfilActualizado.coordinador === true || 
            perfilActualizado.rolActivo === "coordinador"
        );

        alert("¡Perfil guardado y sincronizado exitosamente con la Red Operativa!");

        if (esVerificadoReal || esCoordinadorReal) {
            if (typeof cargarVista === 'function') {
                cargarVista('calendario');
            } else {
                window.location.href = "../calendario/index.html";
            }
        } else {
            if (typeof window.inicializarPerfilModulo === "function") {
                window.inicializarPerfilModulo(true); 
            }
        }

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

/**
 * Carga el historial de documentos
 */
async function cargarHistorialDocumentosFicha() {
    const cuentaActiva = window.sesionUsuario || JSON.parse(sessionStorage.getItem('userProfile')) || {};
    // BÚSQUEDA TRIPLE DEL ID PARA EVITAR DESCONEXIONES
    const idVol = cuentaActiva.id || cuentaActiva.ID_Voluntario || cuentaActiva.cedula || document.getElementById('perfilCedula')?.value.trim() || "";
    const tbody = document.getElementById('tablaDocsVoluntarioBody');
    const divContenedor = document.getElementById('contenedorDocsVoluntario');
    
    if (!tbody || !divContenedor || !idVol) return;

    const docsCacheKey = 'cdf_docs_cache_' + idVol;
    let docsHistorial = JSON.parse(sessionStorage.getItem(docsCacheKey));

    if (!docsHistorial) {
        const res = await callBackend('obtenerDocumentosVoluntario', { idVoluntario: idVol });
        if (res && res.status === "SUCCESS" && res.documentos) {
            docsHistorial = res.documentos;
            sessionStorage.setItem(docsCacheKey, JSON.stringify(docsHistorial));
        }
    }

    if (docsHistorial && docsHistorial.length > 0) {
        divContenedor.classList.remove('d-none');
        tbody.innerHTML = "";
        
        docsHistorial.forEach(doc => {
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

/**
 * Consulta al servidor los voluntarios convocados hoy y despliega el modal enriquecido
 * @param {HTMLElement} btn - Botón desencadenante para gestionar el estado de carga
 */
async function abrirInformeConvocadosHoy(btn) {
  let originalText = "";
  if (btn) {
    btn.disabled = true;
    originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Cargando...';
  }

  const tbody = document.getElementById('tablaInformeConvocadosBody');
  const countBadge = document.getElementById('lblTotalConvocadosHoy');

  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm text-primary me-1"></div> Generando reporte...</td></tr>';
  }

  try {
    // Petición al backend central
    const res = await callBackend('obtenerVoluntariosConvocadosHoy', {});

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }

    if (res && res.status === "SUCCESS") {
      const lista = res.convocados || [];

      if (countBadge) countBadge.innerText = lista.length;

      if (tbody) {
        tbody.innerHTML = "";
        if (lista.length === 0) {
          tbody.innerHTML = `
            <tr>
              <td colspan="4" class="text-center py-4 text-muted small">
                <i class="fa-solid fa-folder-open me-1"></i> No se han realizado envíos de convocatoria el día de hoy.
              </td>
            </tr>`;
        } else {
          lista.forEach((c, idx) => {
            tbody.innerHTML += `
              <tr>
                <td class="text-center font-monospace text-muted" style="font-size:0.75rem;">${idx + 1}</td>
                <td>
                  <strong>${c.nombre || 'N/D'}</strong><br>
                  <span class="badge bg-light text-primary border border-primary-subtle p-1" style="font-size:0.65rem;">${c.especialidad || 'N/D'}</span>
                </td>
                <td>
                  <small class="font-monospace">${c.email || 'N/D'}</small><br>
                  <small class="text-muted"><i class="fa-solid fa-phone me-1"></i>${c.telefono || 'N/D'}</small>
                </td>
                <td class="text-center font-monospace fw-bold text-primary" style="font-size:0.85rem;">
                  <i class="fa-regular fa-clock me-1"></i>${c.hora || '--:--'}
                </td>
              </tr>`;
          });
        }
      }

      // Despliegue del Modal de Bootstrap
      const modalElement = document.getElementById('modalInformeConvocados');
      if (modalElement) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
        modal.show();
      }

    } else {
      alert("Error al cargar informe: " + (res ? res.message : "Sin respuesta del servidor."));
    }
  } catch (e) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
    console.error("Error al obtener reporte de convocados:", e);
    alert("Error crítico de red al cargar el reporte.");
  }
}

function comprimirImagenLocal(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.src = e.target.result;
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrlCompressed = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrlCompressed);
            };
        };
        reader.readAsDataURL(file);
    });
}


/**
 * Evalúa y re-renderiza dinámicamente los badges de verificación, bloqueos de pantalla
 * y acceso al calendario sin recargar la página.
 */
function evaluarEstatusYPermisosLocales(cuentaActiva) {
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

    const esVerificado = Boolean(
        cuentaActiva.verificado === true || 
        cuentaActiva.verificado === "Verificado" || 
        cuentaActiva.verificado === "TRUE"
    );

    if (esRolCoordinador) {
        if (lblEstatus) {
            lblEstatus.className = "badge bg-danger";
            lblEstatus.innerHTML = '<i class="fa-solid fa-user-shield me-1"></i> Autoridad / Coordinador';
        }
        if (seccionCalendario) seccionCalendario.classList.remove('d-none');
        if (contenedorBloqueo) contenedorBloqueo.classList.add('d-none');
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
    else if (esVerificado) {
        if (lblEstatus) {
            lblEstatus.className = "badge bg-success";
            lblEstatus.innerHTML = '<i class="fa-solid fa-circle-check me-1"></i> Verificado';
        }
        if (seccionCalendario) seccionCalendario.classList.remove('d-none');
        if (contenedorBloqueo) contenedorBloqueo.classList.add('d-none');
        
        // Cargar calendario si acaba de desbloquearse
        if (typeof cargarDatos === 'function') cargarDatos();
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
}

/**
 * Sube la Selfie de forma independiente y recalcula la verificación inmediatamente.
 */
async function procesarYSubirSelfie(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    let cuentaActiva = window.sesionUsuario || JSON.parse(sessionStorage.getItem('userProfile')) || {};
    const idVol = cuentaActiva.id || cuentaActiva.ID_Voluntario || cuentaActiva.cedula || document.getElementById('perfilCedula').value.trim();

    if (!idVol) {
        alert("Por favor, ingrese y verifique primero su Cédula de Identidad antes de actualizar la foto.");
        input.value = "";
        return;
    }

    const avatarImg = document.getElementById('avatarPrevisualizacion');
    let feedbackEl = document.getElementById('feedbackSelfie');
    if (!feedbackEl) {
        feedbackEl = document.createElement('div');
        feedbackEl.id = 'feedbackSelfie';
        feedbackEl.className = 'form-text text-primary fw-bold mt-1';
        input.parentNode.appendChild(feedbackEl);
    }
    feedbackEl.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Comprimiendo y subiendo a Drive...';
    input.disabled = true;
    if (avatarImg) avatarImg.style.opacity = "0.4";

    try {
        const base64Comprimido = await comprimirImagenLocal(file, 800, 0.75);
        if (avatarImg) avatarImg.src = base64Comprimido;

        const payload = {
            idVoluntario: idVol,
            imagen_profile_base64: base64Comprimido,
            imagen_profile_nombre: file.name
        };

        const res = await callBackend('subirArchivoIndividual', payload);
        if (res && res.status === "SUCCESS") {
            if (res.urlProfile) document.getElementById('perfilUrlFotoActual').value = res.urlProfile;
            if (res.imgApp) document.getElementById('perfilImgAppActual').value = res.imgApp;

            // ACTUALIZACIÓN DIRECTA DE LA SESIÓN LOCAL
            cuentaActiva.imagen_profile = res.urlProfile || cuentaActiva.imagen_profile;
            if (typeof res.verificado !== 'undefined') cuentaActiva.verificado = res.verificado;
            if (res.perfil) cuentaActiva = { ...cuentaActiva, ...res.perfil };

            window.sesionUsuario = cuentaActiva;
            sessionStorage.setItem('userProfile', JSON.stringify(cuentaActiva));
            localStorage.setItem('userProfile', JSON.stringify(cuentaActiva));

            invalidarCachePerfil();

            feedbackEl.className = 'form-text text-success fw-bold mt-1';
            feedbackEl.innerHTML = '<i class="fa-solid fa-circle-check me-1"></i> ¡Selfie sincronizada con éxito!';

            // RE-EVALUAR ESTATUS Y PERMISOS EN TIEMPO REAL
            evaluarEstatusYPermisosLocales(cuentaActiva);

        } else {
            feedbackEl.className = 'form-text text-danger fw-bold mt-1';
            feedbackEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i> Error al subir.';
            alert("No se pudo guardar la selfie: " + (res ? res.message : "Error"));
        }
    } catch (e) {
        console.error("Error al procesar la selfie:", e);
        feedbackEl.className = 'form-text text-danger fw-bold mt-1';
        feedbackEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i> Error de red.';
    } finally {
        input.disabled = false;
        if (avatarImg) avatarImg.style.opacity = "1";
        setTimeout(() => { if (feedbackEl) feedbackEl.innerHTML = ""; }, 4000);
        input.value = "";
    }
}

/**
 * Sube un Documento y recalcula la verificación inmediatamente.
 */
async function procesarYSubirDocumento(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    let cuentaActiva = window.sesionUsuario || JSON.parse(sessionStorage.getItem('userProfile')) || {};
    const idVol = cuentaActiva.id || cuentaActiva.ID_Voluntario || cuentaActiva.cedula || document.getElementById('perfilCedula').value.trim();

    if (!idVol) {
        alert("Por favor, ingrese primero su Cédula de Identidad.");
        input.value = "";
        return;
    }

    let feedbackEl = document.getElementById('feedbackDoc');
    if (!feedbackEl) {
        feedbackEl = document.createElement('div');
        feedbackEl.id = 'feedbackDoc';
        feedbackEl.className = 'form-text text-primary fw-bold mt-1';
        input.parentNode.appendChild(feedbackEl);
    }
    feedbackEl.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Subiendo documento a Drive...';
    input.disabled = true;

    let base64Data = "";
    if (file.type.startsWith('image/')) {
        base64Data = await comprimirImagenLocal(file, 1000, 0.8);
    } else {
        base64Data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    }

    const payload = {
        idVoluntario: idVol,
        Documentacion_base64: base64Data,
        Documentacion_nombre: file.name
    };

    try {
        const res = await callBackend('subirArchivoIndividual', payload);
        if (res && res.status === "SUCCESS") {
            feedbackEl.className = 'form-text text-success fw-bold mt-1';
            feedbackEl.innerHTML = '<i class="fa-solid fa-circle-check me-1"></i> ¡Documento anexado correctamente!';

            // ACTUALIZACIÓN DIRECTA DE LA SESIÓN LOCAL
            if (res.docUrl) cuentaActiva.Documentacion_URL = res.docUrl;
            if (typeof res.verificado !== 'undefined') cuentaActiva.verificado = res.verificado;
            if (res.perfil) cuentaActiva = { ...cuentaActiva, ...res.perfil };

            window.sesionUsuario = cuentaActiva;
            sessionStorage.setItem('userProfile', JSON.stringify(cuentaActiva));
            localStorage.setItem('userProfile', JSON.stringify(cuentaActiva));

            invalidarCachePerfil();
            cargarHistorialDocumentosFicha();

            // RE-EVALUAR ESTATUS Y PERMISOS EN TIEMPO REAL
            evaluarEstatusYPermisosLocales(cuentaActiva);

        } else {
            feedbackEl.className = 'form-text text-danger fw-bold mt-1';
            feedbackEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i> Error al subir.';
            alert("Error al subir documento: " + (res ? res.message : "Error"));
        }
    } catch (e) {
        console.error("Error de red al subir documento:", e);
        feedbackEl.className = 'form-text text-danger fw-bold mt-1';
        feedbackEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i> Error de red.';
    } finally {
        input.disabled = false;
        setTimeout(() => { if (feedbackEl) feedbackEl.innerHTML = ""; }, 4000);
        input.value = "";
    }
}