// ==========================================================================
// MÓDULO JS: CONFIGURACIÓN Y CONECTOR ASÍNCRONO DE RED OPERATIVA
// Cadena de Favores Venezuela — Módulo Unificado (Netlify -> GAS Backend)
// ==========================================================================

/**
 * Configuración Global del Entorno
 */
const CONFIG = {
  // Endpoint Web App oficial de Google Apps Script
  API_BASE_URL: "https://script.google.com/a/voluntariadocdfvzla.org/macros/s/AKfycbz1YYs7llAN2HL3H6XxbRkmztsc-paY5tR4InZ_Dx8ucew5NmAFNdIu5KUp9hxTld6A/exec",

  // Clave secreta institucional para validación en servidor
  CLIENT_SECRET_KEY: "CDF_Vzla_2026_Secure_Key_#X9",

  // Clave alineada exactamente con la usada en auth.js y perfil.js
  SESSION_KEY: "userProfile",

  // Tiempo límite de espera ampliado para operativas pesadas de Apps Script (ms)
  TIMEOUT_MS: 90000
};

/**
 * Almacén global de sesión del usuario en tiempo de ejecución
 */
window.sesionUsuario = null;

/**
 * Inicializador de Sesión Local
 * Carga el estado guardado en localStorage o sessionStorage al iniciar la app.
 */
function refrescarSesionLocal() {
  try {
    const dataGuardada = localStorage.getItem(CONFIG.SESSION_KEY) || sessionStorage.getItem(CONFIG.SESSION_KEY);
    if (dataGuardada) {
      window.sesionUsuario = JSON.parse(dataGuardada);
    } else {
      window.sesionUsuario = null;
    }
  } catch (err) {
    console.error("Error al leer la sesión local:", err);
    window.sesionUsuario = null;
  }
}

/**
 * Guarda la sesión del usuario localmente
 * @param {Object} datosUsuario - Datos del perfil e identidad
 * @param {boolean} recordar - Si se debe persistir en localStorage o sessionStorage
 */
function guardarSesionLocal(datosUsuario, recordar = false) {
  window.sesionUsuario = datosUsuario;
  const jsonStr = JSON.stringify(datosUsuario);
  if (recordar) {
    localStorage.setItem(CONFIG.SESSION_KEY, jsonStr);
  } else {
    sessionStorage.setItem(CONFIG.SESSION_KEY, jsonStr);
  }
}

/**
 * Limpia la sesión local del navegador de forma segura
 */
function limpiarSesionLocal() {
  window.sesionUsuario = null;
  localStorage.removeItem(CONFIG.SESSION_KEY);
  sessionStorage.removeItem(CONFIG.SESSION_KEY);
}

/**
 * CONECTOR UNIFICADO REST / APPS SCRIPT (Resiliente sin Reintentos de Timeout Duplicados)
 * Ejecuta peticiones POST asíncronas seguras hacia el backend.
 * 
 * @param {string} action - Nombre de la función/acción a ejecutar en el servidor
 * @param {Object} payload - Objeto con los parámetros requeridos
 * @param {number} intentoActual - Control interno para los reintentos automáticos
 * @returns {Promise<Object>} Respuesta estructurada del servidor
 */
async function callBackend(action, payload = {}, intentoActual = 1) {
  if (typeof refrescarSesionLocal === "function") {
    refrescarSesionLocal();
  }
  
  const token = window.sesionUsuario ? (window.sesionUsuario.token || window.sesionUsuario.email) : null;
  
  const bodyData = {
    clientKey: CONFIG.CLIENT_SECRET_KEY,
    action: action,
    payload: payload,
    auth: {
      email: window.sesionUsuario ? window.sesionUsuario.email : null,
      token: token
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

  try {
    const response = await fetch(CONFIG.API_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(bodyData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Validación estricta de errores HTTP (ej. 404 Not Found)
    if (!response.ok) {
      throw new Error(`Error HTTP de red (${response.status}): La ruta o el servidor no están disponibles.`);
    }

    // Asegurar que la respuesta sea JSON válido y no una página HTML de error de Google
    const textoRespuesta = await response.text();
    let data;
    try {
      data = JSON.parse(textoRespuesta);
    } catch (parseError) {
      console.error("[API ERROR] La respuesta del servidor no tiene formato JSON válido:", textoRespuesta);
      throw new Error("El servidor respondió con un formato no válido. Es posible que la infraestructura requiera sincronización. Si el problema persiste, contacte al soporte técnico: soporte@voluntariadocdfvzla.org");
    }

    return data;

  } catch (error) {
    clearTimeout(timeoutId);
    console.warn(`[API WARNING] Intento ${intentoActual} fallido ejecutando '${action}':`, error.message);

    // Si fue un TIMEOUT/ABORT, NO reintentar automáticamente para evitar duplicar solicitudes pesadas en GAS
    if (error.name === 'AbortError') {
      return {
        status: "ERROR",
        message: "La solicitud tardó demasiado tiempo en responder (Límite de tiempo alcanzado). Por favor, verifique su conexión o reintente la operación."
      };
    }

    // Definición de errores estrictamente de RED que ameritan un reintento automático transitorio
    const esErrorRedTransitorio = error.message.includes('Failed to fetch') || 
                                 error.message.includes('NetworkError');

    // Lógica de Reintento Silencioso (máximo 1 reintento tras 2 segundos solo por caída instantánea de red)
    if (esErrorRedTransitorio && intentoActual < 2) {
      console.info(`[API INFO] Reintentando conexión silenciosa por falla de red para '${action}' (Intento 2)...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return callBackend(action, payload, intentoActual + 1);
    }

    if (error.message.includes('404')) {
      return {
        status: "ERROR",
        message: "Error de infraestructura (404): La Red Operativa se ha actualizado. Por favor, recargue la página para sincronizar. Si el problema persiste, contacte al soporte técnico: soporte@voluntariadocdfvzla.org"
      };
    }

    return { 
      status: "ERROR", 
      message: "Error de comunicación: " + error.message 
    };
  }
}

// Inicialización automática al instanciar el script
refrescarSesionLocal();

/**
 * Configuración Centralizada de Canales de WhatsApp
 */
const WHATSAPP_CONFIG = {
  numero: "584244626652",
  soporteTecnicoNumero: "584128672845", // Número editable de Soporte Técnico
  alcances: {
    flotante: "Hola,%20necesito%20asistencia%20básica%20o%20soporte%20rápido%20con%20la%20Red%20Operativa.",
    footer: "Estimado%20equipo%20de%20Cadena%20de%20Favores%20Venezuela,%20les%20escribo%20con%20motivo%20de%20una%20consulta%20institucional.",
    voluntariado: "Hola,%20quiero%20más%20información%20detallada%20sobre%20los%20procesos%20de%20inscripción%20para%20voluntarios.",
    soporteAuth: "Hola,%20necesito%20asistencia%20técnica%20para%20iniciar%20sesión%20o%20registrarme%20en%20el%20portal%20del%20Voluntariado."
  }
};

/**
 * Genera el enlace de WhatsApp según el alcance solicitado
 */
function obtenerEnlaceWhatsApp(alcance = 'flotante') {
  const isSoporte = alcance === 'soporteAuth' || alcance === 'soporte';
  const num = isSoporte ? WHATSAPP_CONFIG.soporteTecnicoNumero : WHATSAPP_CONFIG.numero;
  const msg = WHATSAPP_CONFIG.alcances[alcance] || WHATSAPP_CONFIG.alcances.flotante;
  return `https://wa.me/${num}?text=${msg}`;
}

document.addEventListener("DOMContentLoaded", function() {
  const pathActual = window.location.pathname;

  // ILUMINAR AUTOMÁTICAMENTE LA PESTAÑA ACTIVA SEGÚN LA URL
  const todosLosLinks = document.querySelectorAll('.navbar-nav .nav-link');
  todosLosLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    
    if (
      (pathActual.endsWith('/') && href.endsWith('index.html')) ||
      (pathActual.includes('index.html') && href.includes('index.html')) ||
      (pathActual.includes('trabajo') && href.includes('trabajo')) ||
      (pathActual.includes('jornadas') && href.includes('jornadas')) ||
      (pathActual.includes('perfil') && href.includes('perfil')) ||
      (pathActual.includes('calendario') && href.includes('calendario')) ||
      (pathActual.includes('voluntarios') && href.includes('voluntarios'))
    ) {
      link.classList.add('active', 'fw-semibold');
    } else {
      if (!link.id.includes('navBtnAuth')) {
        link.classList.remove('active');
      }
    }
  });
});

// SANITIZADOR DE URL: Elimina de forma invisible barras múltiples en la barra de direcciones
(function limpiarURL() {
    const urlActual = window.location.href;
    if (urlActual.includes('///') || urlActual.includes('//perfil')) {
        const urlLimpia = urlActual.replace(/([^:]\/)\/+/g, "$1");
        window.history.replaceState(null, null, urlLimpia);
    }
})();

// ==========================================================================
// CONFIGURACIÓN GLOBAL DE ENDPOINTS (NETLIFY / APPS SCRIPT)
// Cadena de Favores Venezuela
// ==========================================================================

/**
 * Devuelve la URL activa del servidor Apps Script evaluando múltiples orígenes.
 * @returns {string} URL del ejecutable webapp (/exec)
 */
function obtenerUrlWebApp() {
    // A. Evaluar constante declarada en el ámbito global
    if (typeof CONFIG.API_BASE_URL !== 'undefined' && CONFIG.API_BASE_URL && CONFIG.API_BASE_URL.trim() !== "") {
        return CONFIG.API_BASE_URL.trim();
    }

    // B. Evaluar propiedad adjunta al objeto window
    if (window.API_BASE_URL && window.API_BASE_URL.trim() !== "") {
        return window.API_BASE_URL.trim();
    }

    // C. Evaluar alias alternativos de API en window
    if (window.API_URL && window.API_URL.trim() !== "") {
        return window.API_URL.trim();
    }

    // D. Búsqueda en almacenamiento local del navegador (si se guarda dinámicamente)
    const urlStorage = localStorage.getItem('cdf_url_webapp') || sessionStorage.getItem('cdf_url_webapp');
    if (urlStorage && urlStorage.trim() !== "") {
        return urlStorage.trim();
    }

    console.error("CRÍTICO: No se ha configurado 'URL_BASE_WEBAPP' en config.js.");
    return "";
}

// Inyección opcional en el objeto global window para entornos SPA / Netlify
window.obtenerUrlWebApp = obtenerUrlWebApp;

// ==========================================================================
// CATÁLOGOS Y CARGA DINÁMICA DE BASE DE DATOS (NETLIFY / APPS SCRIPT)
// ==========================================================================
window.CATALOGOS_RED = window.CATALOGOS_RED || {
  gruposVoluntariado: [
    "Sector Salud",
    "Rescatistas | Socorristas",
    "Apoyo Logístico",
    "Transporte"
  ],
  puntosRecogidaDefault: [
    { id: "Sin Definir", nombre: "Sin Definir" }
  ],
  especialidadesDefault: [
    "Médico General",
    "Enfermería",
    "Paramédico",
    "Logística",
    "Transporte",
    "Atención Comunitaria"
  ]
};

/**
 * Limpia y puebla de forma atómica cualquier <select> del DOM
 */
function poblarSelectSincronizado(selectId, opciones, placeholder = "-- Seleccione una opción --") {
  const selectElem = document.getElementById(selectId);
  if (!selectElem) return;

  const valorPrevio = selectElem.value;
  selectElem.innerHTML = ""; // Vaciado estricto para eliminar opciones quemadas en HTML

  const defaultOpt = document.createElement('option');
  defaultOpt.value = "";
  defaultOpt.disabled = true;
  defaultOpt.innerText = placeholder;
  if (!valorPrevio) defaultOpt.selected = true;
  selectElem.appendChild(defaultOpt);

  opciones.forEach(item => {
    const option = document.createElement('option');
    const val = typeof item === 'object' ? (item.id || item.nombre) : item;
    const txt = typeof item === 'object' ? item.nombre : item;
    
    option.value = val;
    option.innerText = txt;
    if (valorPrevio && (valorPrevio === val || valorPrevio === txt)) {
      option.selected = true;
    }
    selectElem.appendChild(option);
  });

  if (valorPrevio) selectElem.value = valorPrevio;
}

/**
 * Carga Especialidades desde la BD en un <select> desplegable tradicional
 */
async function cargarEspecialidadesDinamicas(selectId, valorDefecto = "") {
  const selectElem = document.getElementById(selectId);
  if (!selectElem) return;

  let espLista = null;
  try {
    const resEsp = await callBackend('obtenerEspecialidades', {});
    if (resEsp && resEsp.especialidades && resEsp.especialidades.length > 0) {
      espLista = resEsp.especialidades;
    } else {
      espLista = window.CATALOGOS_RED.especialidadesDefault;
    }
  } catch(err) {
    console.warn("Error al cargar especialidades de la BD, usando catálogo local.", err);
    espLista = window.CATALOGOS_RED.especialidadesDefault;
  }

  poblarSelectSincronizado(selectId, espLista, "Seleccione especialidad...");
  if (valorDefecto) selectElem.value = valorDefecto;
}

/**
 * Carga Puntos de Recogida desde la BD en un <select>
 */
async function cargarPuntosRecogidaDinamicos(selectId, valorDefecto = "") {
  const selectElem = document.getElementById(selectId);
  if (!selectElem) return;

  let puntosCache = sessionStorage.getItem('cdf_puntos_cache');
  let puntosLista = puntosCache ? JSON.parse(puntosCache) : null;

  if (!puntosLista) {
    try {
      const resPuntos = await callBackend('obtenerPuntosRecogida', {});
      if (resPuntos && resPuntos.puntos && resPuntos.puntos.length > 0) {
        puntosLista = resPuntos.puntos;
        sessionStorage.setItem('cdf_puntos_cache', JSON.stringify(puntosLista));
      } else {
        puntosLista = window.CATALOGOS_RED.puntosRecogidaDefault;
      }
    } catch(err) {
      console.warn("Error al cargar puntos de recogida de la BD, usando catálogo local.", err);
      puntosLista = window.CATALOGOS_RED.puntosRecogidaDefault;
    }
  }

  poblarSelectSincronizado(selectId, puntosLista, "Seleccione punto de recogida...");
  if (valorDefecto) selectElem.value = valorDefecto;
}