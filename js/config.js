// ==========================================================================
// MÓDULO JS: CONFIGURACIÓN Y CONECTOR ASÍNCRONO DE RED OPERATIVA
// Cadena de Favores Venezuela — Módulo Unificado (Netlify -> GAS Backend)
// ==========================================================================

/**
 * Configuración Global del Entorno
 */
const CONFIG = {
  // Endpoint Web App oficial de Google Apps Script
  API_BASE_URL: "https://script.google.com/a/gammalielanalytics.com/macros/s/AKfycbw1Jp8qHewaxNsneLZGH9311bVK1W1PHtzzyQB9nSHq_gO3AKouEh60LlfK7pTDHHY/exec",
  
  // Clave secreta institucional para validación en servidor
  CLIENT_SECRET_KEY: "CDF_Vzla_2026_Secure_Key_#X9",

  // Clave alineada exactamente con la usada en auth.js y perfil.js
  SESSION_KEY: "userProfile",

  // Tiempo límite de espera para la solicitud (ms)
  TIMEOUT_MS: 18000
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
 * CONECTOR UNIFICADO REST / APPS SCRIPT
 * Ejecuta peticiones POST asíncronas seguras hacia el backend.
 * 
 * @param {string} action - Nombre de la función/acción a ejecutar en el servidor
 * @param {Object} payload - Objeto con los parámetros requeridos
 * @returns {Promise<Object>} Respuesta estructurada del servidor
 */
async function callBackend(action, payload = {}) {
  refrescarSesionLocal();
  
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

    if (!response.ok) {
      throw new Error(`Error HTTP de red: ${response.status}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[API ERROR] Excepción ejecutando '${action}':`, error);

    if (error.name === 'AbortError') {
      return {
        status: "ERROR",
        message: "La solicitud de red tardó demasiado tiempo en responder (Timeout)."
      };
    }

    return { 
      status: "ERROR", 
      message: "Error de comunicación con la Red Operativa: " + error.message 
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
  alcances: {
    flotante: "Hola,%20necesito%20asistencia%20básica%20o%20soporte%20rápido%20con%20la%20Red%20Operativa.",
    footer: "Estimado%20equipo%20de%20Cadena%20de%20Favores%20Venezuela,%20les%20escribo%20con%20motivo%20de%20una%20consulta%20institucional.",
    voluntariado: "Hola,%20quiero%20más%20información%20detallada%20sobre%20los%20procesos%20de%20inscripción%20para%20voluntarios."
  }
};

/**
 * Genera el enlace de WhatsApp según el alcance solicitado
 */
function obtenerEnlaceWhatsApp(alcance = 'flotante') {
  const num = WHATSAPP_CONFIG.numero;
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