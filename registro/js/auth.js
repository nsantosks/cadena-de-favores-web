// ==========================================================================
// MÓDULO JS: AUTENTICACIÓN Y CONTROL DE ACCESO (NETLIFY / API REST)
// Cadena de Favores Venezuela
// ==========================================================================

var googleClientIdCache = window.googleClientIdCache || null;
var webAppUrlCache = window.webAppUrlCache || null;
var emailBuscadoCache = window.emailBuscadoCache || "";

/**
 * Obtiene el rol seleccionado en la interfaz (eslabon / coordinador)
 */
function obtenerRolSeleccionado() {
  const radio = document.querySelector('input[name="btnRol"]:checked');
  return radio ? radio.value : "eslabon";
}

/**
 * Despliega un mensaje visual de alerta en la tarjeta de login
 */
function mostrarErrorAuth(mensaje) {
  const errorDiv = document.getElementById('loginErrorMsg');
  if (errorDiv) {
    errorDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-1"></i> ${mensaje}`;
    errorDiv.classList.remove('d-none');
    errorDiv.classList.remove('animate__headShake');
    void errorDiv.offsetWidth; 
    errorDiv.classList.add('animate__headShake');
  } else {
    alert(mensaje);
  }
}

/**
 * PASO 1: Envía el correo y el ROL seleccionado a la API REST de Apps Script
 */
async function procesarVerificacionInicial() {
  const emailInput = document.getElementById('loginEmail');
  if (!emailInput) return;
  const email = emailInput.value.trim();
  const btn = document.getElementById('btnContinuarEmail');
  const errorDiv = document.getElementById('loginErrorMsg');
  const rol = obtenerRolSeleccionado();
  
  if (errorDiv) errorDiv.classList.add('d-none');
  if (!email) { 
    mostrarErrorAuth("El correo electrónico es obligatorio."); 
    return; 
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Buscando cuenta...';

  // Llamada homologada al backend
  const res = await callBackend('verificarEmail', { email: email, rol: rol });

  btn.disabled = false;
  btn.innerText = "Continuar";

  if (res && res.status === "EXISTENTE") {
    // CASO A: Existe -> SSO con Google
    document.getElementById('authStep1').classList.add('d-none');
    document.getElementById('authStepGoogle').classList.remove('d-none');
    inicializarBotonGoogleSSO(res.email);

  } else if (res && res.status === "NUEVO") {
    // CASO B: Usuario Nuevo -> Enviar OTP directo
    enviarCodigoSeguridadOTP(res.email);

  } else {
    // CASO C: Rechazo
    mostrarErrorAuth(res ? res.message : "Error al validar la cuenta con el servidor.");
  }
}

/**
 * INYECTOR GOOGLE: Recupera el Client ID desde la API REST
 */
async function inicializarBotonGoogleSSO(emailEsperado) {
  emailBuscadoCache = emailEsperado;
  
  const res = await callBackend('obtenerGoogleClientId', {});
  if (res && res.status === "SUCCESS") {
    googleClientIdCache = res.clientId;
    webAppUrlCache = window.location.origin + window.location.pathname; 
  } else {
    mostrarErrorAuth("Fallo de configuración de seguridad: " + (res ? res.message : "ID no encontrado."));
  }
}

/**
 * Redirige a Google Identity Services
 */
function lanzarPopupAutenticacionGoogle() {
  if (!googleClientIdCache) {
    mostrarErrorAuth("Sincronizando llaves de seguridad de Google. Por favor, intente en unos segundos.");
    return;
  }

  const scope = "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";
  const redirectUri = window.location.origin + window.location.pathname;
  
  const estadoObjeto = { email: emailBuscadoCache, rol: obtenerRolSeleccionado() };
  const estadoCodificado = JSON.stringify(estadoObjeto);

  const authUrl = "https://accounts.google.com/o/oauth2/v2/auth" +
                  "?client_id=" + googleClientIdCache +
                  "&redirect_uri=" + encodeURIComponent(redirectUri) +
                  "&response_type=token" +
                  "&scope=" + encodeURIComponent(scope) +
                  "&state=" + encodeURIComponent(estadoCodificado) +
                  "&prompt=select_account";
  
  window.location.href = authUrl;
}

/**
 * Envía el Access Token obtenido de Google a la API backend para firmar sesión
 */
async function validarTokenDeGoogleServidor(accessToken, emailEsperado) {
  const errorDiv = document.getElementById('loginErrorMsg');
  if (errorDiv) errorDiv.classList.add('d-none');

  const btnContainer = document.getElementById('googleSignInButtonDiv');
  const btn = btnContainer ? btnContainer.querySelector('button') : null;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Validando acceso...';
  }

  const rol = obtenerRolSeleccionado();

  const res = await callBackend('verificarTokenGoogle', {
    accessToken: accessToken,
    email: emailEsperado,
    rol: rol
  });

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-brands fa-google text-danger fs-5"></i> Iniciar sesión con Google';
  }
  
  if (res && res.status === "SUCCESS") {
    const perfilSesion = res.perfil;
    perfilSesion.rolActivo = rol; 
    
    // GUARDAR EN AMBOS ESPACIOS DE MEMORIA (GLOBAL Y SESSIONSTORAGE)
    window.sesionUsuario = perfilSesion;
    sessionStorage.setItem('userProfile', JSON.stringify(perfilSesion));
    
    if (typeof cargarVista === 'function') cargarVista('perfil');
  } else {
    mostrarErrorAuth(res ? res.message : "Fallo al verificar identidad.");
  }
}

/**
 * Dispara el envío tradicional del correo con código OTP
 */
async function enviarCodigoSeguridadOTP(email) {
  const errorDiv = document.getElementById('loginErrorMsg');
  if (errorDiv) errorDiv.classList.add('d-none');

  const res = await callBackend('enviarOTP', { email: email });

  if (res && res.status !== "ERROR") {
    document.querySelectorAll('input[name="btnRol"]').forEach(input => input.disabled = true);
    document.getElementById('authStep1').classList.add('d-none');
    document.getElementById('authStepGoogle').classList.add('d-none'); 
    document.getElementById('authStepOTP').classList.remove('d-none');
    const otpInput = document.getElementById('loginOTP');
    if (otpInput) otpInput.focus();
  } else {
    mostrarErrorAuth(res ? res.message : "Error al despachar el código de seguridad.");
  }
}

/**
 * Valida el código OTP enviado al correo
 */
async function validarYAccederOTP() {
  const email = document.getElementById('loginEmail').value.trim();
  const otp = document.getElementById('loginOTP').value.trim();
  const btn = document.getElementById('btnConfirmOTP');
  const rol = obtenerRolSeleccionado(); 
  
  const errorDiv = document.getElementById('loginErrorMsg');
  if (errorDiv) errorDiv.classList.add('d-none');

  if (!otp || otp.length < 6) {
    mostrarErrorAuth("Por favor, ingrese el código de verificación completo de 6 dígitos.");
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Validando...';
  
  const res = await callBackend('validarOTP', {
    email: email,
    otp: otp,
    rol: rol
  });

  if (res && res.status === "SUCCESS") {
    const perfilSesion = res.perfil;
    perfilSesion.rolActivo = rol; 
    
    // GUARDAR EN AMBOS ESPACIOS DE MEMORIA
    window.sesionUsuario = perfilSesion;
    sessionStorage.setItem('userProfile', JSON.stringify(perfilSesion));
    
    if (typeof cargarVista === 'function') cargarVista('perfil');

  } else if (res && res.status === "REQUIRES_REGISTRATION") {
    // CREAR PERFIL TEMPORAL PARA PERMITIR EL FLUJO DE REGISTRO SIN EXPULSAR
    const perfilProvisional = { email: res.email || email, rolActivo: rol, nuevoRegistro: true };
    window.sesionUsuario = perfilProvisional;
    sessionStorage.setItem('userProfile', JSON.stringify(perfilProvisional));

    if (typeof cargarVista === 'function') cargarVista('perfil'); 
    
    setTimeout(() => {
      const modalElem = document.getElementById('modalGuardia');
      if (!modalElem) return;

      modalElem.setAttribute('data-bs-backdrop', 'static');
      modalElem.setAttribute('data-bs-keyboard', 'false');
      const closeBtn = modalElem.querySelector('.btn-close');
      if (closeBtn) closeBtn.style.display = 'none';

      const modal = bootstrap.Modal.getOrCreateInstance(modalElem);
      if (typeof cargarFormularioNuevoVoluntario === 'function') {
        cargarFormularioNuevoVoluntario(res.email || email, null);
        modal.show();
      }
    }, 800); 

  } else {
    mostrarErrorAuth(res ? res.message : "Código de verificación incorrecto.");
    btn.disabled = false;
    btn.innerText = "Confirmar Identidad y Acceder";
    document.querySelectorAll('input[name="btnRol"]').forEach(input => input.disabled = false);
  }
}

/**
 * Forzar desvío a OTP si el usuario no tiene cuenta de Google
 */
function forzarCambioA_OTP() {
  const email = document.getElementById('loginEmail').value.trim();
  enviarCodigoSeguridadOTP(email);
}

/**
 * Cierra la sesión activa y redirige al autenticador
 */
/**
 * Cierra la sesión activa y redirige al autenticador
 */
function cerrarSesion() {
  // Validación de seguridad para evitar cierres accidentales
  if (!confirm("¿Está seguro de cerrar su sesión en la Red Operativa?")) return;

  // 1. Limpiar datos de sesión local y almacenamiento del navegador
  sessionStorage.removeItem('userProfile');
  localStorage.removeItem('userProfile');
  window.sesionUsuario = null;

  // 2. Redirigir al usuario al portal principal / autenticador
  window.location.href = "../index.html"; 
}