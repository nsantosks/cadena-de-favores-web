// ==========================================================================
// MÓDULO JS: CONFIGURACIÓN Y CONECTOR ASÍNCRONO DE RED OPERATIVA
// Cadena de Favores Venezuela — Módulo Unificado (Netlify -> GAS Backend)
// ==========================================================================

/**
 * Configuración Global del Entorno
 */
const CONFIG = {
  // Endpoint Web App oficial de Google Apps Script
  API_BASE_URL: "https://script.google.com/a/gammalielanalytics.com/macros/s/AKfycbxLp5SqFq6No0-tSvquViL_i-hxCkePtM5f2Bsvt6-rDdxxWB85QAsY-mSkftzXRps/exec",
  
  // Clave secreta institucional para validación en servidor
  CLIENT_SECRET_KEY: "CDF_Vzla_2026_Secure_Key_#X9",

  // CORREGIDO: Clave alineada exactamente con la usada en auth.js y perfil.js
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
      // CORREGIDO: Si no hay datos, DEBE ser null obligatoriamente.
      // Esto permite que app.js y perfil.js expulsen al usuario hacia el login.
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
 * @param {boolean} recordar - Si se debe persistir en localStorage (permanente) o sessionStorage (temporal)
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
  
  // Estructura del Body compatible con la API de Google Apps Script y Auth local
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
        "Content-Type": "text/plain;charset=utf-8" // Garantiza compatibilidad CORS con GAS
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