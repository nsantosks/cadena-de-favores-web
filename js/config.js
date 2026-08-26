// ==========================================================================
// MÓDULO JS: CONFIGURACIÓN Y CONECTOR ASÍNCRONO DE RED OPERATIVA
// Cadena de Favores Venezuela — Módulo Unificado (Netlify -> GAS Backend)
// ==========================================================================

/**
 * Configuración Global del Entorno
 */
const CONFIG = Object.freeze({
  // Endpoint Web App oficial de Google Apps Script
  API_BASE_URL: "https://script.google.com/a/voluntariadocdfvzla.org/macros/s/AKfycbz1YYs7llAN2HL3H6XxbRkmztsc-paY5tR4InZ_Dx8ucew5NmAFNdIu5KUp9hxTld6A/exec",

  // Clave alineada para persistencia de sesión local
  SESSION_KEY: "userProfile",

  // Tiempo límite razonable de red en frontend (30 segundos)
  TIMEOUT_MS: 300000
});

/**
 * Almacén global de sesión del usuario en tiempo de ejecución
 */
window.sesionUsuario = null;

/**
 * Inicializador de Sesión Local
 */
function refrescarSesionLocal() {
  try {
    const dataGuardada = localStorage.getItem(CONFIG.SESSION_KEY) || sessionStorage.getItem(CONFIG.SESSION_KEY);
    window.sesionUsuario = dataGuardada ? JSON.parse(dataGuardada) : null;
  } catch (err) {
    console.error("Error al leer la sesión local:", err);
    window.sesionUsuario = null;
  }
}

function guardarSesionLocal(datosUsuario, recordar = false) {
  window.sesionUsuario = datosUsuario;
  const jsonStr = JSON.stringify(datosUsuario);
  if (recordar) {
    localStorage.setItem(CONFIG.SESSION_KEY, jsonStr);
  } else {
    sessionStorage.setItem(CONFIG.SESSION_KEY, jsonStr);
  }
}

function limpiarSesionLocal() {
  window.sesionUsuario = null;
  localStorage.removeItem(CONFIG.SESSION_KEY);
  sessionStorage.removeItem(CONFIG.SESSION_KEY);
}

/**
 * CONECTOR UNIFICADO REST / APPS SCRIPT
 */
async function callBackend(action, payload = {}, intentoActual = 1) {
  if (typeof refrescarSesionLocal === "function") {
    refrescarSesionLocal();
  }
  
  // Extraer token verificado de la sesión activa
  const userToken = window.sesionUsuario && window.sesionUsuario.token ? window.sesionUsuario.token : null;
  const userEmail = window.sesionUsuario && window.sesionUsuario.email ? window.sesionUsuario.email : null;
  
  const bodyData = {
    action: action,
    payload: payload,
    auth: {
      email: userEmail,
      token: userToken
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

    if (!response.ok) {
      throw new Error(`Error HTTP de red (${response.status}): Servidor no disponible.`);
    }

    const textoRespuesta = await response.text();
    let data;
    try {
      data = JSON.parse(textoRespuesta);
    } catch (parseError) {
      console.error("[API ERROR] Respuesta no es JSON válido:", textoRespuesta);
      throw new Error("El servidor respondió con un formato no válido.");
    }

    return data;

  } catch (error) {
    clearTimeout(timeoutId);
    console.warn(`[API WARNING] Intento ${intentoActual} fallido para '${action}':`, error.message);

    if (error.name === 'AbortError') {
      return {
        status: "ERROR",
        message: "La solicitud excedió el tiempo límite. Por favor, intente nuevamente."
      };
    }

    const esErrorRedTransitorio = error.message.includes('Failed to fetch') || error.message.includes('NetworkError');

    if (esErrorRedTransitorio && intentoActual < 2) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return callBackend(action, payload, intentoActual + 1);
    }

    return { 
      status: "ERROR", 
      message: "Error de comunicación: " + error.message 
    };
  }
}

refrescarSesionLocal();

/**
 * Configuración Centralizada de Canales de WhatsApp
 */
const WHATSAPP_CONFIG = Object.freeze({
  numero: "584244626652",
  soporteTecnicoNumero: "584128672845",
  alcances: {
    flotante: "Hola,%20necesito%20asistencia%20básica%20o%20soporte%20rápido%20con%20la%20Red%20Operativa.",
    footer: "Estimado%20equipo%20de%20Cadena%20de%20Favores%20Venezuela,%20les%20escribo%20con%20motivo%20de%20una%20consulta%20institucional.",
    voluntariado: "Hola,%20quiero%20más%20información%20detallada%20sobre%20los%20procesos%20de%20inscripción%20para%20voluntarios.",
    soporteAuth: "Hola,%20necesito%20asistencia%20técnica%20para%20iniciar%20sesión%20o%20registrarme%20en%20el%20portal%20del%20Voluntariado."
  }
});

function obtenerEnlaceWhatsApp(alcance = 'flotante') {
  const isSoporte = alcance === 'soporteAuth' || alcance === 'soporte';
  const num = isSoporte ? WHATSAPP_CONFIG.soporteTecnicoNumero : WHATSAPP_CONFIG.numero;
  const msg = WHATSAPP_CONFIG.alcances[alcance] || WHATSAPP_CONFIG.alcances.flotante;
  return `https://wa.me/${num}?text=${msg}`;
}

document.addEventListener("DOMContentLoaded", function() {
  const pathActual = window.location.pathname;

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

(function limpiarURL() {
  const urlActual = window.location.href;
  if (urlActual.includes('///') || urlActual.includes('//perfil')) {
    const urlLimpia = urlActual.replace(/([^:]\/)\/+/g, "$1");
    window.history.replaceState(null, null, urlLimpia);
  }
})();

function obtenerUrlWebApp() {
  return CONFIG.API_BASE_URL;
}

window.obtenerUrlWebApp = obtenerUrlWebApp;

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

function poblarSelectSincronizado(selectId, opciones, placeholder = "-- Seleccione una opción --") {
  const selectElem = document.getElementById(selectId);
  if (!selectElem) return;

  const valorPrevio = selectElem.value;
  selectElem.innerHTML = "";

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