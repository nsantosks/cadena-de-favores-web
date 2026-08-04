// ==========================================================================
// MÓDULO JS: ORQUESTADOR PRINCIPAL Y ENRUTADOR VISTAS (NETLIFY / API REST)
// Cadena de Favores Venezuela — Arquitectura Desacoplada
// ==========================================================================

var vistaActual = 'perfil'; // Vista por defecto al ingresar

document.addEventListener("DOMContentLoaded", function() {
  inicializarApp();
});

/**
 * Inicializador principal de la aplicación frontend
 */
async function inicializarApp() {
  if (typeof refrescarSesionLocal === "function") refrescarSesionLocal();

  const authView = document.getElementById('contenedorAuthView');
  const appDashboard = document.getElementById('contenedorAppDashboard');
  const cuentaActiva = window.sesionUsuario || JSON.parse(sessionStorage.getItem('userProfile') || 'null');

  // GUARDIA DE ENRUTAMIENTO: Si no hay sesión válida, mostramos solo la tarjeta de login
  if (!cuentaActiva || !cuentaActiva.email || cuentaActiva.email.trim() === "") {
    if (authView) authView.classList.remove('d-none');
    if (appDashboard) {
      appDashboard.classList.add('d-none');
      appDashboard.classList.remove('d-flex');
    }
    // Detenemos la ejecución aquí para NO intentar cargar ninguna vista interna ni activar perfil.js
    return;
  }

  // SI HAY SESIÓN ACTIVA: Ocultamos la tarjeta de login y mostramos el dashboard interno
  if (authView) authView.classList.add('d-none');
  if (appDashboard) {
    appDashboard.classList.remove('d-none');
    appDashboard.classList.add('d-flex');
  }

  // Ajustar la visibilidad de elementos por rol (Coordinador vs Eslabón)
  verificarPermisosRol();

  // Cargar la vista inicial (Perfil por defecto)
  await cargarVista('perfil');
}

/**
 * Enrutador de Vistas Dinámicas
 * @param {string} nombreVista - 'perfil', 'calendario' o 'voluntarios'
 */
async function cargarVista(nombreVista) {
  vistaActual = nombreVista;
  const container = document.getElementById('vistaDinamicaContainer');
  const spinner = document.getElementById('appGlobalSpinner');

  if (!container) return;

  // Mostrar el spinner de carga global
  if (spinner) spinner.style.display = 'block';
  container.style.display = 'none';

  try {
    switch (nombreVista) {
      case 'perfil':
        container.innerHTML = obtenerTemplatePerfilHTML();
        if (typeof window.inicializarPerfilModulo === "function") {
          await window.inicializarPerfilModulo();
        }
        break;

      case 'calendario':
        container.innerHTML = obtenerTemplateCalendarioHTML();
        if (typeof window.inicializarCalendarioView === "function") {
          window.inicializarCalendarioView();
        } else if (typeof cargarDatos === "function") {
          await cargarDatos();
        }
        break;

      case 'voluntarios':
        // Protección de Ruta por Rol
        if (typeof refrescarSesionLocal === "function") refrescarSesionLocal();
        const rol = window.sesionUsuario ? (window.sesionUsuario.rolActivo || window.sesionUsuario.rolActive || "eslabon") : "eslabon";
        
        if (rol !== "coordinador") {
          alert("Acceso Restringido: Esta sección requiere credenciales de Coordinador.");
          cargarVista('perfil');
          return;
        }

        container.innerHTML = obtenerTemplateVoluntariosHTML();
        if (typeof window.inicializarVoluntariosModulo === "function") {
          await window.inicializarVoluntariosModulo();
        }
        break;

      default:
        console.warn(`Vista no reconocida: ${nombreVista}. Cargando perfil...`);
        container.innerHTML = obtenerTemplatePerfilHTML();
        if (typeof window.inicializarPerfilModulo === "function") {
          await window.inicializarPerfilModulo();
        }
        break;
    }
  } catch (error) {
    console.error(`Error al renderizar la vista '${nombreVista}':`, error);
    container.innerHTML = `
      <div class="col-12 text-center text-danger p-5">
        <i class="fa-solid fa-triangle-exclamation fa-3x mb-3"></i>
        <h5>Fallo al cargar la sección</h5>
        <p class="small text-muted">No se pudo inicializar la interfaz requerida.</p>
        <button class="btn btn-outline-primary btn-sm mt-2" onclick="cargarVista('perfil')">Regresar a Mi Perfil</button>
      </div>`;
  } finally {
    // Oculta el spinner superior y muestra el contenedor dinámico de la vista
    if (spinner) spinner.style.display = 'none';
    if (container) container.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/**
 * Ajusta los elementos del Menú y la Navbar según el rol del usuario logueado
 */
function verificarPermisosRol() {
  if (typeof refrescarSesionLocal === "function") refrescarSesionLocal();
  const btnGestion = document.getElementById('navItemGestionVoluntarios');
  const rol = window.sesionUsuario ? (window.sesionUsuario.rolActivo || window.sesionUsuario.rolActive || "eslabon") : "eslabon";

  if (btnGestion) {
    if (rol === "coordinador") {
      btnGestion.classList.remove('d-none');
    } else {
      btnGestion.classList.add('d-none');
    }
  }

  // Refrescar el badge visual del rol en la barra superior si existe la función
  if (typeof actualizarBadgeRolNavbar === "function") {
    actualizarBadgeRolNavbar();
  }
}

// ==========================================================================
// OBTENCIÓN DE PLANTILLAS DESDE EL DOM O INYECCIÓN DIRECTA
// ==========================================================================

function obtenerTemplatePerfilHTML() {
  const tpl = document.getElementById('template-perfil-view');
  if (tpl) {
    return tpl.innerHTML;
  }
  // Fallback de seguridad si no se encuentra el template
  return `
    <div id="perfilModuloContainer" class="animate__animated animate__fadeIn">
      <div class="text-center p-4 text-muted">Cargando datos del perfil...</div>
    </div>`;
}

function obtenerTemplateCalendarioHTML() {
  return `
    <div class="card shadow-sm border-0 mt-2 animate__animated animate__fadeIn">
      <div class="card-body p-0">
        <div class="d-flex justify-content-between align-items-center p-3 bg-white border-bottom">
          <button class="btn btn-outline-secondary btn-sm" id="btnPrevMonth">
            <i class="fa-solid fa-chevron-left"></i>
          </button>
          <h4 id="monthYearDisplay" class="m-0 fw-bold text-dark">Julio 2026</h4>
          <button class="btn btn-outline-secondary btn-sm" id="btnNextMonth">
            <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
        <div id="calendarGrid" class="calendar-grid"></div>
      </div>
    </div>`;
}

function obtenerTemplateVoluntariosHTML() {
  return `
    <div class="row justify-content-center animate__animated animate__fadeIn">
      <div class="col-12 col-md-10">
        
        <div class="d-flex justify-content-between align-items-center mb-4 bg-white p-3 rounded shadow-sm border-start border-4 border-primary">
          <div>
            <h4 class="mb-0 fw-bold text-dark"><i class="fa-solid fa-users-gear me-2 text-primary"></i>Gestión de Personal Operativo</h4>
            <small class="text-muted">Consola de Traslado y Control de Eslabones</small>
          </div>
          <button type="button" class="btn btn-sm btn-outline-secondary" onclick="cargarVista('perfil')">
            <i class="fa-solid fa-chevron-left me-1"></i> Volver a Mi Perfil
          </button>
        </div>

        <div class="card shadow-sm border-0 mb-4 bg-white">
          <div class="card-body p-3">
            <div class="row g-3 align-items-center">
              <div class="col-12 col-md-6">
                <div class="input-group">
                  <span class="input-group-text bg-light border-end-0"><i class="fa-solid fa-magnifying-glass text-muted"></i></span>
                  <input type="text" id="txtBusquedaVoluntario" class="form-control border-start-0 bg-light" 
                         placeholder="Buscar por nombre, cédula, especialidad o dirección..." onkeyup="ejecutarFiltroAgenda()">
                </div>
              </div>
              <div class="col-12 col-md-6 d-flex justify-content-md-end gap-3 flex-wrap">
                <div class="form-check form-switch pt-1">
                  <input class="form-check-input input-filtro-estado" type="checkbox" id="switchVerificados" checked onchange="ejecutarFiltroAgenda()">
                  <label class="form-check-label small fw-semibold text-secondary" for="switchVerificados">Verificados</label>
                </div>
                <div class="form-check form-switch pt-1">
                  <input class="form-check-input input-filtro-estado" type="checkbox" id="switchPendientes" checked onchange="ejecutarFiltroAgenda()">
                  <label class="form-check-label small fw-semibold text-secondary" for="switchPendientes">Por Verificar</label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="row g-3" id="contenedorAgendaVoluntarios">
          <div class="col-12 text-center p-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="text-muted mt-2">Compilando Directorio del Maestro...</p>
          </div>
        </div>

      </div>
    </div>`;
}