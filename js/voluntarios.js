// ==========================================================================
// MÓDULO JS: GESTIÓN DE PERSONAL OPERATIVO Y DIRECTORIO (NETLIFY / API REST)
// Cadena de Favores Venezuela — Resiliente y Optimizado
// ==========================================================================

var poolVoluntariosModulo = []; // Buffer local en memoria

// ==========================================================================
// CONFIGURACIÓN DE CACHÉ LOCAL (TTL: 5 MINUTOS)
// ==========================================================================
const VOLUNTEERS_CACHE_KEY = 'cdf_voluntarios_cache';
const VOLUNTEERS_CACHE_TIME_KEY = 'cdf_voluntarios_cache_time';
const VOLUNTEERS_CACHE_TTL_MS = 5 * 60 * 1000;// 5 minutos

/**
 * Invalida la caché del directorio de voluntarios para forzar la consulta a Apps Script
 */
function invalidarCacheVoluntarios() {
  sessionStorage.removeItem(VOLUNTEERS_CACHE_KEY);
  sessionStorage.removeItem(VOLUNTEERS_CACHE_TIME_KEY);
}

/**
 * Inicializador del ciclo de vida del módulo de Voluntarios
 */
window.inicializarVoluntariosModulo = async function(forzarRecarga = false) {
  await cargarVoluntariosServidor(forzarRecarga);
};

/**
 * Consulta el listado completo de voluntarios desde el backend API REST con soporte de Caché
 * @param {boolean} forzarRecarga - Si es true, ignora la caché y consulta al servidor
 */
async function cargarVoluntariosServidor(forzarRecarga = false) {
  const contenedor = document.getElementById('contenedorAgendaVoluntarios');
  
  const now = new Date().getTime();
  const cacheGuardado = sessionStorage.getItem(VOLUNTEERS_CACHE_KEY);
  const cacheTiempo = sessionStorage.getItem(VOLUNTEERS_CACHE_TIME_KEY);

  // 1. VERIFICAR CACHÉ VÁLIDA (Menos de 5 min y sin forzado)
  if (!forzarRecarga && cacheGuardado && cacheTiempo && (now - parseInt(cacheTiempo, 10) < VOLUNTEERS_CACHE_TTL_MS)) {
    try {
      poolVoluntariosModulo = JSON.parse(cacheGuardado);
      ejecutarFiltroAgenda();
      return; // Carga instantánea desde memoria local
    } catch (e) {
      console.warn("Caché de voluntarios corrupta, reconsultando servidor...", e);
      invalidarCacheVoluntarios();
    }
  }

  // 2. CONSULTAR AL BACKEND (Si la caché expiró o se invocó un cambio de estado)
  if (contenedor) {
    contenedor.innerHTML = `
      <div class="col-12 text-center p-5">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="text-muted mt-2 fw-semibold">Sincronizando Directorio de Personal Operativo...</p>
      </div>`;
  }

  const res = await callBackend('obtenerTodosLosVoluntarios', {});

  if (res && res.status === "SUCCESS" && Array.isArray(res.voluntarios)) {
    poolVoluntariosModulo = res.voluntarios;
  } else if (Array.isArray(res)) {
    poolVoluntariosModulo = res;
  } else {
    if (contenedor) {
      contenedor.innerHTML = `
        <div class="col-12 text-center text-danger p-4">
          <i class="fa-solid fa-triangle-exclamation fs-2"></i>
          <p class="mt-2">Error de comunicación con el maestro de datos: ${res ? res.message : 'Fallo de red'}</p>
        </div>`;
    }
    return;
  }

  // SINCRONIZACIÓN GLOBAL ASEGURADA
  window.poolVoluntarios = poolVoluntariosModulo;

  // Guardar en la caché local
  sessionStorage.setItem(VOLUNTEERS_CACHE_KEY, JSON.stringify(poolVoluntariosModulo));
  sessionStorage.setItem(VOLUNTEERS_CACHE_TIME_KEY, now.toString());

  ejecutarFiltroAgenda();
}

/**
 * Renderiza el listado en formato agenda tipo tarjetas
 */
function renderizarAgendaTarjetas(lista) {
  const contenedor = document.getElementById('contenedorAgendaVoluntarios');
  if (!contenedor) return;
  contenedor.innerHTML = '';

  if (!lista || lista.length === 0) {
    contenedor.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="fa-solid fa-folder-open text-muted fs-1 mb-2"></i>
        <p class="text-muted small">No coinciden especialistas bajo los filtros seleccionados.</p>
      </div>`;
    return;
  }

  lista.forEach(vol => {
    const avatarSrc = (vol.imagen_profile && vol.imagen_profile.trim() !== "") 
      ? vol.imagen_profile 
      : "https://ui-avatars.com/api/?name=" + encodeURIComponent(vol.nombre || "V") + "&background=f1f5f9&color=1e3a8a";

    const badgeVerificacion = vol.verificado 
      ? `<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 small rounded-pill"><i class="fa-solid fa-circle-check me-1"></i>Verificado</span>`
      : `<span class="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1 small rounded-pill"><i class="fa-solid fa-clock me-1"></i>Pendiente</span>`;

    const card = document.createElement('div');
    card.className = "col-12 col-sm-6 col-lg-4 animate__animated animate__fadeInUp";
    card.innerHTML = `
      <div class="card border-0 shadow-sm h-100 bg-white" style="cursor: pointer;" onclick="abrirFichaVoluntario('${vol.id}')" title="Hacer clic para ver ficha detallada">
        <div class="card-body p-3 d-flex flex-column justify-content-between">
          <div class="d-flex align-items-start gap-3">
            <img src="${avatarSrc}" class="rounded-circle border border-2 border-light shadow-sm" 
                style="width: 60px; height: 60px; object-fit: cover; flex-shrink: 0;"
                onerror="this.onerror=null; this.src='../assets/logo.png';">
            
            <div style="min-width: 0;">
              <h6 class="mb-0 fw-bold text-truncate ${vol.banned ? 'text-danger' : 'text-dark'}" title="${escapeHTML(vol.nombre)}">
                  ${vol.banned ? '<i class="fa-solid fa-user-slash me-1"></i>' : ''} ${escapeHTML(vol.nombre || 'Sin Nombre')}
              </h6>
              <div class="text-muted small font-monospace mb-1" style="font-size:0.75rem;">${escapeHTML(vol.cedula || 'Cédula N/D')}</div>
              <div class="small fw-semibold text-primary text-truncate mb-1"><i class="fa-solid fa-user-doctor me-1"></i>${escapeHTML(vol.especialidad || 'N/D')}</div>
              <div class="text-muted text-truncate" style="font-size:0.75rem;"><i class="fa-solid fa-location-dot me-1 text-secondary"></i>${escapeHTML(vol.direccion || 'Sin dirección')}</div>
              <div class="text-muted text-truncate" style="font-size:0.75rem;"><i class="fa-solid fa-envelope me-1"></i>${escapeHTML(vol.email || vol.Correo || '')}</div>
            </div>
          </div>
          
          <div class="border-top pt-2 mt-3" onclick="event.stopPropagation()">
            <div class="d-flex justify-content-between align-items-center mb-2">
              ${badgeVerificacion}
              <div class="form-check form-switch m-0">
                  <input class="form-check-input" type="checkbox" id="switchVol-${vol.id}" ${vol.verificado ? 'checked' : ''} onchange="conmutarVerificacionServidor('${vol.id}', this)">
                  <label class="form-check-label text-muted small" for="switchVol-${vol.id}">Validar</label>
              </div>
            </div>
            
            <div class="d-flex justify-content-between align-items-center p-2 rounded ${vol.banned ? 'bg-danger-subtle' : 'bg-light'}">
              <span class="small fw-bold ${vol.banned ? 'text-danger' : 'text-muted'}">Acceso al Sistema</span>
              <div class="form-check form-switch m-0">
                  <input class="form-check-input" type="checkbox" id="switchBan-${vol.id}" ${vol.banned ? 'checked' : ''} onchange="conmutarBaneoServidor('${vol.id}', this)">
                  <label class="form-check-label small ${vol.banned ? 'text-danger fw-bold' : 'text-muted'}" for="switchBan-${vol.id}">
                      ${vol.banned ? 'Baneado' : 'Activo'}
                  </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    contenedor.appendChild(card);
  });
}

/**
 * Motor de búsqueda y filtrado de la agenda
 */
/**
 * Motor de búsqueda y filtrado de la agenda (Optimizado y Robustecido)
 */
function ejecutarFiltroAgenda() {
  const inputQuery = document.getElementById('txtBusquedaVoluntario');
  const query = inputQuery ? inputQuery.value.toLowerCase().trim() : "";
  
  // Switches de estado con fallback defensivo
  const verifCheck = document.getElementById('switchVerificados') ? document.getElementById('switchVerificados').checked : true;
  const pendCheck = document.getElementById('switchPendientes') ? document.getElementById('switchPendientes').checked : true;

  if (!Array.isArray(poolVoluntariosModulo)) {
    console.warn("poolVoluntariosModulo no es un Array válido.");
    return;
  }

  const listaFiltrada = poolVoluntariosModulo.filter(vol => {
    // Normalización de estado verificado (soporta booleanos y strings "Verificado")
    const esVerificado = (vol.verificado === true || vol.verificado === "Verificado" || vol.verificado === "TRUE");

    // 1. Filtrado por Switches de Estatus
    if (esVerificado && !verifCheck) return false;
    if (!esVerificado && !pendCheck) return false;

    // Si no hay texto en el buscador, pasa el filtro de switches
    if (query === "") return true;

    // 2. Búsqueda Multi-campo Normalizada (Nombre, Cédula, Especialidad, Dirección, Email)
    const matchNombre = (vol.nombre || "").toString().toLowerCase().includes(query);
    const matchCedula = (vol.cedula || "").toString().toLowerCase().includes(query);
    const matchEsp = (vol.especialidad || "").toString().toLowerCase().includes(query);
    const matchDir = (vol.direccion || "").toString().toLowerCase().includes(query);
    const matchEmail = (vol.email || vol.Correo || "").toString().toLowerCase().includes(query);

    return (matchNombre || matchCedula || matchEsp || matchDir || matchEmail);
  });

  renderizarAgendaTarjetas(listaFiltrada);
}

/**
 * Despacha el cambio atómico de estatus de verificación a la API REST
 */
async function conmutarVerificacionServidor(idVoluntario, switchElem) {
  const proximoEstatus = switchElem.checked ? "Verificado" : "No Verificado";
  switchElem.disabled = true;

  const res = await callBackend('cambiarEstatusVerificacion', {
    idVoluntario: idVoluntario,
    estatus: proximoEstatus,
    verificado: switchElem.checked
  });

  switchElem.disabled = false;

  if (res && res.status === "SUCCESS") {
    const idx = poolVoluntariosModulo.findIndex(v => v.id === idVoluntario);
    if (idx !== -1) {
      poolVoluntariosModulo[idx].verificado = switchElem.checked;
    }
    invalidarCacheVoluntarios();
    ejecutarFiltroAgenda();
  } else {
    alert("Error al conmutar credenciales: " + (res ? res.message : "Fallo de comunicación"));
    switchElem.checked = !switchElem.checked;
  }
}

/**
 * Despacha la instrucción de baneo/bloqueo a la API REST
 */
async function conmutarBaneoServidor(idVoluntario, switchElem) {
  const esBaneado = switchElem.checked;
  switchElem.disabled = true;

  const res = await callBackend('cambiarEstatusBaneo', {
    idVoluntario: idVoluntario,
    banned: esBaneado
  });

  switchElem.disabled = false;

  if (res && res.status === "SUCCESS") {
    const idx = poolVoluntariosModulo.findIndex(v => v.id === idVoluntario);
    if (idx !== -1) {
      poolVoluntariosModulo[idx].banned = esBaneado;
    }
    invalidarCacheVoluntarios();
    ejecutarFiltroAgenda();
  } else {
    alert("Error al procesar bloqueo: " + (res ? res.message : "Fallo de comunicación"));
    switchElem.checked = !switchElem.checked;
  }
}

/**
 * Función auxiliar para escapar caracteres HTML especiales
 */
function escapeHTML(str) {
  return str ? str.toString().replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  ) : '';
}

// Auto-ejecución al montar el módulo
setTimeout(() => {
  if (typeof window.inicializarVoluntariosModulo === "function") {
    window.inicializarVoluntariosModulo();
  }
}, 50);