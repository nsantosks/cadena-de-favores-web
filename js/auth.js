// ==========================================================================
// MÓDULO JS: AUTENTICACIÓN Y CONTROL DE ACCESO (NETLIFY / API REST)
// Cadena de Favores Venezuela — Resiliente y Desacoplado
// ==========================================================================

// Capturar y procesar el Token de Google que viene en la URL al retornar del popup
document.addEventListener("DOMContentLoaded", function() {
  const hash = window.location.hash;
  if (hash && hash.includes("access_token")) {
    const params = new URLSearchParams(hash.substring(1)); // Remueve el '#'
    const accessToken = params.get("access_token");
    const stateJson = params.get("state");

    if (accessToken && stateJson) {
      try {
        const stateObj = JSON.parse(decodeURIComponent(stateJson));
        const emailEsperado = stateObj.email;
        
        // Limpiar la URL del navegador para que no quede el token expuesto
        window.history.replaceState({}, document.title, window.location.pathname);

        // Disparar la validación oficial con tu backend de Apps Script
        if (typeof validarTokenDeGoogleServidor === "function") {
          validarTokenDeGoogleServidor(accessToken, emailEsperado);
        }
      } catch (e) {
        console.error("Error al procesar el estado de Google OAuth:", e);
      }
    }
  }
});

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

  const res = await callBackend('verificarEmail', { email: email, rol: rol });

  btn.disabled = false;
  btn.innerText = "Continuar";

  if (res && res.status === "EXISTENTE") {
    document.getElementById('authStep1').classList.add('d-none');
    document.getElementById('authStepGoogle').classList.remove('d-none');
    inicializarBotonGoogleSSO(res.email);
  } else if (res && res.status === "NUEVO") {
    enviarCodigoSeguridadOTP(res.email);
  } else {
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
    const perfilSesion = res.perfil || {};
    
    // Asignación estricta de roles
    if (rol === "coordinador" || perfilSesion.esCoordinador) {
      perfilSesion.rolActivo = "coordinador";
      perfilSesion.esCoordinador = true;
    } else {
      perfilSesion.rolActivo = "eslabon";
    }
    
    window.sesionUsuario = perfilSesion;
    sessionStorage.setItem('userProfile', JSON.stringify(perfilSesion));
    localStorage.setItem('userProfile', JSON.stringify(perfilSesion));
    
    // Forzar la visualización inmediata del dashboard y carga de perfil
    const authView = document.getElementById('contenedorAuthView');
    const appDashboard = document.getElementById('contenedorAppDashboard');
    if (authView) authView.classList.add('d-none');
    if (appDashboard) {
      appDashboard.classList.remove('d-none');
      appDashboard.classList.add('d-flex');
    }

    sincronizarHeaderGlobal();

    if (typeof verificarPermisosRol === 'function') verificarPermisosRol();
    if (typeof cargarVista === 'function') {
      cargarVista('perfil');
    } else {
      window.location.reload();
    }
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
 * Valida el código OTP enviado al correo y gestiona el flujo de acceso o registro
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
    const perfilSesion = res.perfil || {};
    
    // Asignación estricta de roles
    if (rol === "coordinador" || perfilSesion.esCoordinador) {
      perfilSesion.rolActivo = "coordinador";
      perfilSesion.esCoordinador = true;
    } else {
      perfilSesion.rolActivo = "eslabon";
    }
    
    window.sesionUsuario = perfilSesion;
    sessionStorage.setItem('userProfile', JSON.stringify(perfilSesion));
    localStorage.setItem('userProfile', JSON.stringify(perfilSesion));
    
    sincronizarHeaderGlobal();

    if (typeof inicializarApp === 'function') {
      inicializarApp();
    } else {
      window.location.reload();
    }

  } else if (res && res.status === "REQUIRES_REGISTRATION") {
    btn.disabled = false;
    btn.innerText = "Confirmar Identidad y Acceder";

    const perfilProvisional = { email: res.email || email, rolActivo: rol, nuevoRegistro: true };
    window.sesionUsuario = perfilProvisional;
    sessionStorage.setItem('userProfile', JSON.stringify(perfilProvisional));

    // Si existe la función de cargar el formulario dinámico, se invoca directamente SIN recargar la página
    if (typeof cargarFormularioNuevoVoluntario === 'function') {
      cargarFormularioNuevoVoluntario(res.email || email, null);
      
      const modalElem = document.getElementById('modalGuardia') || document.getElementById('modalRegistroVoluntario');
      if (modalElem) {
        modalElem.setAttribute('data-bs-backdrop', 'static');
        modalElem.setAttribute('data-bs-keyboard', 'false');
        const closeBtn = modalElem.querySelector('.btn-close');
        if (closeBtn) closeBtn.style.display = 'none';

        const modal = bootstrap.Modal.getOrCreateInstance(modalElem);
        modal.show();
      }
    } else if (typeof cargarVista === 'function') {
      // Si estamos en la SPA de perfil, cargamos la vista de perfil
      cargarVista('perfil');
    } else {
      // Redireccionamos a la vista de perfil para que complete el registro
      window.location.href = "../perfil/index.html?nuevo=true";
    }

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
function cerrarSesion() {
  if (!confirm("¿Está seguro de cerrar su sesión en la Red Operativa?")) return;

  sessionStorage.removeItem('userProfile');
  localStorage.removeItem('userProfile');
  window.sesionUsuario = null;

  window.location.href = "../index.html"; 
}

/**
 * Sincroniza los elementos visuales del Header, Avatar y Badge de Rol
 */
function sincronizarHeaderGlobal() {
  const cuentaActiva = window.sesionUsuario || JSON.parse(sessionStorage.getItem('userProfile') || localStorage.getItem('userProfile') || 'null');
  
  const navAvatarContainer = document.getElementById('navAvatarContainer');
  const navDefaultIcon = document.getElementById('navDefaultIcon');
  const navBtnAuth = document.getElementById('navBtnAuth');
  const navBtnLogout = document.getElementById('navBtnLogout');
  const elementosSesion = document.querySelectorAll('.nav-item-sesion');
  const btnGestion = document.getElementById('navItemGestionVoluntarios');
  const btnCalendario = document.getElementById('navItemCalendario'); // <-- NUEVA REFERENCIA
  const badgeContainer = document.getElementById('sessionRoleBadgeContainer');

  // Detectar la profundidad de ruta para el fallback del logo
  const esSubcarpeta = window.location.pathname.includes('/trabajo/') || 
                       window.location.pathname.includes('/jornadas/') || 
                       window.location.pathname.includes('/perfil/') || 
                       window.location.pathname.includes('/calendario/') || 
                       window.location.pathname.includes('/voluntarios/') || 
                       window.location.pathname.includes('/auth/');

  const rutaLogoFallback = esSubcarpeta ? "../assets/logo.png" : "assets/logo.png";

  if (cuentaActiva && cuentaActiva.email && cuentaActiva.email.trim() !== "") {
    // --- USUARIO LOGUEADO ---
    if (navBtnAuth) navBtnAuth.classList.add('d-none');
    if (navBtnLogout) navBtnLogout.classList.remove('d-none');
    
    elementosSesion.forEach(el => el.classList.remove('d-none'));

    // 1. Validar estatus de verificación
    const esVerificadoReal = Boolean(
      cuentaActiva.verificado === true || 
      cuentaActiva.verificado === "Verificado" || 
      cuentaActiva.verificado === "TRUE"
    );

    // 2. Validar rol de coordinador
    const esCoordinadorReal = Boolean(
      cuentaActiva.esCoordinador || 
      cuentaActiva.coordinador === true || 
      cuentaActiva.isCoordinador === true ||
      cuentaActiva.rolActivo === "coordinador" || 
      cuentaActiva.rolActive === "coordinador" ||
      cuentaActiva.role === "coordinador"
    );

    // 3. Control de visibilidad del Calendario (Solo Verificados o Coordinadores)
    if (btnCalendario) {
      if (esVerificadoReal || esCoordinadorReal) {
        btnCalendario.classList.remove('d-none');
      } else {
        btnCalendario.classList.add('d-none');
      }
    }

    // 4. Actualización del botón de gestión personal (Solo Coordinadores)
    if (btnGestion) {
      if (esCoordinadorReal) {
        btnGestion.classList.remove('d-none');
      } else {
        btnGestion.classList.add('d-none');
      }
    }

    // Actualización visual del Badge de Rol en el Header
    if (badgeContainer) {
      if (esCoordinadorReal) {
        badgeContainer.innerHTML = `
          <span class="badge bg-danger border border-light text-white px-3 py-2 rounded-pill shadow-sm">
            <i class="fa-solid fa-user-shield me-1"></i> Rol: Coordinador
          </span>
        `;
      } else {
        badgeContainer.innerHTML = `
          <span class="badge bg-secondary border border-light text-white px-3 py-2 rounded-pill shadow-sm">
            <i class="fa-solid fa-link me-1"></i> Rol: Eslabón
          </span>
        `;
      }
      badgeContainer.classList.remove('d-none');
    }

    // --- MANEJO DEL AVATAR / FOTO DE PERFIL ---
    if (navAvatarContainer && navDefaultIcon) {
      let urlFoto = cuentaActiva.picture || cuentaActiva.imagen_profile || cuentaActiva.imagenProfile || cuentaActiva.foto;

      navDefaultIcon.classList.add('d-none');
      navAvatarContainer.classList.remove('d-none');

      if (urlFoto && (urlFoto.startsWith("http") || urlFoto.startsWith("data:image"))) {
        navAvatarContainer.innerHTML = `
          <img src="${urlFoto}" 
               alt="Avatar" 
               class="rounded-circle border border-2 border-warning shadow-sm" 
               style="width: 34px; height: 34px; object-fit: cover;"
               onerror="this.onerror=null; this.src='${rutaLogoFallback}';">
        `;
      } else {
        const inicial = (cuentaActiva.nombre || cuentaActiva.Nombre_Completo || "U").charAt(0).toUpperCase();
        navAvatarContainer.innerHTML = `
          <div class="rounded-circle bg-warning text-dark fw-bold d-flex align-items-center justify-content-center shadow-sm" 
               style="width: 34px; height: 34px; font-size: 0.85rem;">
            ${inicial}
          </div>
        `;
      }
    }
  } else {
    // --- SIN SESIÓN ---
    if (navBtnAuth) navBtnAuth.classList.remove('d-none');
    if (navBtnLogout) navBtnLogout.classList.add('d-none');
    elementosSesion.forEach(el => el.classList.add('d-none'));
    if (navAvatarContainer) navAvatarContainer.classList.add('d-none');
    if (navDefaultIcon) navDefaultIcon.classList.remove('d-none');
    if (badgeContainer) badgeContainer.classList.add('d-none');
    if (btnCalendario) btnCalendario.classList.add('d-none');
  }
}

// Ejecutar sincronización al cargar cualquier página
document.addEventListener("DOMContentLoaded", () => {
    sincronizarHeaderGlobal();
});

/**
 * Manejador dinámico para botones que requieren verificación
 */
function gestionarRedireccionCalendario(event) {
  event.preventDefault(); // Previene la navegación por defecto
  
  const cuentaActiva = window.sesionUsuario || JSON.parse(sessionStorage.getItem('userProfile') || localStorage.getItem('userProfile') || 'null');
  
  // Mismos criterios de verificación que usamos en el Header
  const esVerificadoReal = cuentaActiva && (cuentaActiva.verificado === true || cuentaActiva.verificado === "Verificado" || cuentaActiva.verificado === "TRUE");
  const esCoordinadorReal = cuentaActiva && Boolean(
    cuentaActiva.esCoordinador || 
    cuentaActiva.coordinador === true || 
    cuentaActiva.rolActivo === "coordinador"
  );

  if (esVerificadoReal || esCoordinadorReal) {
    // Si está verificado o es coordinador, enviar al calendario
    window.location.href = "../calendario/index.html";
  } else {
    // Si no, enviar al Auth para que se registre/valide
    // Opcionalmente, podrías mostrar un alert o modal antes
    alert("Para acceder al calendario de guardias, primero debes completar tu perfil y ser verificado por un coordinador.");
    window.location.href = "../auth/index.html";
  }
}
