// ==========================================================================
// MÓDULO JS: AUTENTICACIÓN Y CONTROL DE ACCESO (NETLIFY / API REST)
// Cadena de Favores Venezuela — Resiliente y Desacoplado
// ==========================================================================

document.addEventListener("DOMContentLoaded", function() {
  const hash = window.location.hash;
  if (hash && hash.includes("access_token")) {
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("access_token");
    const stateJson = params.get("state");

    if (accessToken && stateJson) {
      try {
        const stateObj = JSON.parse(decodeURIComponent(stateJson));
        const emailEsperado = stateObj.email;
        
        window.history.replaceState({}, document.title, window.location.pathname);

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

var temporizadorReenvioInterval = null;
var segundosRestantesReenvio = 60;
var emailOtpActualCache = "";
var datosRegistroTemporalCache = {};

function generarIDVoluntarioWeb() {
  return "WEB-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

function obtenerRolSeleccionado() {
  const radio = document.querySelector('input[name="btnRol"]:checked');
  return radio ? radio.value : "eslabon";
}

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

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Verificando correo...';
  }

  const res = await callBackend('verificarEmail', { email: email, rol: rol });

  if (res && res.status === "EXISTENTE") {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Continuar <i class="fa-solid fa-arrow-right ms-1"></i>';
    }
    document.getElementById('authStep1').classList.add('d-none');
    document.getElementById('authStepGoogle').classList.remove('d-none');
    inicializarBotonGoogleSSO(res.email);
  } else if (res && res.status === "NUEVO") {
    // abrirModalRegistroNuevo maneja el estado de carga y restablecimiento del botón
    abrirModalRegistroNuevo(res.email || email);
  } else {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Continuar <i class="fa-solid fa-arrow-right ms-1"></i>';
    }
    mostrarErrorAuth(res ? res.message : "Error al validar la cuenta con el servidor.");
  }
}


/**
 * Abre el modal de registro para nuevos usuarios inmediatamente y puebla los datos en segundo plano
 */
function abrirModalRegistroNuevo(emailDetectado) {
  emailOtpActualCache = emailDetectado;
  
  // 1. Mostrar estado de carga en el botón 'Continuar' para evitar doble clic
  const btnContinuar = document.getElementById('btnContinuarEmail');
  let htmlOriginalBtn = "";
  if (btnContinuar) {
    btnContinuar.disabled = true;
    htmlOriginalBtn = btnContinuar.innerHTML;
    btnContinuar.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Preparando registro...';
  }

  // 2. Abrir el modal DE INMEDIATO (Experiencia visual rápida)
  const modalElem = document.getElementById('modalRegistroNuevoCompleto');
  if (modalElem) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalElem);
    modal.show();
  } else {
    enviarCodigoSeguridadOTP(emailDetectado);
    return;
  }

  // 3. Restablecer el botón principal tras abrir el modal
  if (btnContinuar) {
    setTimeout(() => {
      btnContinuar.disabled = false;
      btnContinuar.innerHTML = htmlOriginalBtn;
    }, 500);
  }

  // 4. Cargar los catálogos en SEGUNDO PLANO (sin bloquear la interfaz)
  setTimeout(async () => {
    // A. Voluntariado / Grupo (Configuración Maestra)
    if (window.CATALOGOS_RED && typeof poblarSelectSincronizado === 'function') {
      poblarSelectSincronizado('regVoluntariadoGrupo', window.CATALOGOS_RED.gruposVoluntariado, "Seleccione un grupo...");
    }

    // B. Especialidades Técnicas (Consulta BD Asíncrona)
    if (typeof cargarEspecialidadesDinamicas === 'function') {
      await cargarEspecialidadesDinamicas('regEspecialidadTecnica');
    } else if (window.CATALOGOS_RED && typeof poblarSelectSincronizado === 'function') {
      poblarSelectSincronizado('regEspecialidadTecnica', window.CATALOGOS_RED.especialidadesDefault, "Seleccione especialidad...");
    }

    // C. Puntos de Recogida (Consulta BD Asíncrona)
    if (typeof cargarPuntosRecogidaDinamicos === 'function') {
      await cargarPuntosRecogidaDinamicos('regPuntoRecogida', 'Sin Definir');
    } else if (window.CATALOGOS_RED && typeof poblarSelectSincronizado === 'function') {
      poblarSelectSincronizado('regPuntoRecogida', window.CATALOGOS_RED.puntosRecogidaDefault, "Seleccione punto...");
    }
  }, 10);
}

// ==========================================================================
// CAPTURA Y HOMOLOGACIÓN DE DATOS DESDE EL MODAL DE REGISTRO (AUTH.JS)
// ==========================================================================

async function validarFormularioYEnviarOtpModal() {
  const nombre = document.getElementById('regNombreCompleto') ? document.getElementById('regNombreCompleto').value.trim() : "";
  const cedula = document.getElementById('regCedula') ? document.getElementById('regCedula').value.trim() : "";
  const voluntariado = document.getElementById('regVoluntariadoGrupo') ? document.getElementById('regVoluntariadoGrupo').value : "";
  const especialidad = document.getElementById('regEspecialidadTecnica') ? document.getElementById('regEspecialidadTecnica').value : "";
  const telefono = document.getElementById('regTelefonoMovil') ? document.getElementById('regTelefonoMovil').value.trim() : "";
  const puntoRecogida = document.getElementById('regPuntoRecogida') ? document.getElementById('regPuntoRecogida').value : "Sin Definir";
  const direccion = document.getElementById('regDireccionResidencia') ? document.getElementById('regDireccionResidencia').value.trim() : "";
  const checkPoliticas = document.getElementById('regCheckPoliticas');

  if (!nombre || !cedula || !voluntariado || !especialidad || !telefono || !direccion) {
    alert("Por favor, completa todos los campos obligatorios del registro.");
    return;
  }

  if (checkPoliticas && !checkPoliticas.checked) {
    alert("Debes confirmar la lectura y aceptación de las políticas institucionales.");
    return;
  }

  const btnRegistrar = document.getElementById('btnDispararOtpModal');
  if (btnRegistrar) {
    btnRegistrar.disabled = true;
    btnRegistrar.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Enviando código OTP...';
  }

  const rol = obtenerRolSeleccionado();
  const idVoluntarioGenerado = cedula || generarIDVoluntarioWeb();
  const timestampActual = new Date().toISOString();

  // Payload Homologado idéntico al de perfil.js
  datosRegistroTemporalCache = {
    idVoluntario: idVoluntarioGenerado,
    ID_Voluntario: idVoluntarioGenerado,
    id: idVoluntarioGenerado,
    cedula: cedula,
    nombre: nombre,
    Nombre_Completo: nombre,
    email: emailOtpActualCache,
    Correo: emailOtpActualCache,
    correo: emailOtpActualCache,
    voluntariado: voluntariado,
    Voluntariado: voluntariado,
    voluntariadoGrupo: voluntariado,
    especialidad: especialidad,
    Especialidad: especialidad,
    telefono: telefono,
    Telefono: telefono,
    puntoRecogida: puntoRecogida,
    Punto_Recogida_Preferido: puntoRecogida,
    direccion: direccion,
    Direccion: direccion,
    rolActivo: rol,
    nuevoRegistro: true
  };

  window.sesionUsuario = datosRegistroTemporalCache;
  sessionStorage.setItem('userProfile', JSON.stringify(datosRegistroTemporalCache));
  localStorage.setItem('userProfile', JSON.stringify(datosRegistroTemporalCache));

  const res = await callBackend('enviarOTP', { 
    email: emailOtpActualCache,
    idVoluntario: idVoluntarioGenerado,
    rol: rol,
    timestamp: timestampActual,
    perfilData: datosRegistroTemporalCache
  });

  if (res && res.status !== "ERROR") {
    if (btnRegistrar) btnRegistrar.style.display = 'none';
    
    const seccionOtp = document.getElementById('seccionOtpModal');
    if (seccionOtp) seccionOtp.classList.remove('d-none');

    const inputOtp = document.getElementById('inputOtpModal');
    if (inputOtp) inputOtp.focus();

    alert("¡Código de verificación enviado a tu correo electrónico!");
  } else {
    if (btnRegistrar) {
      btnRegistrar.disabled = false;
      btnRegistrar.innerText = "Registrar y Enviar Código";
    }
    alert(res ? res.message : "Error al procesar el envío del código OTP.");
  }
}

async function confirmarOtpYCrearRegistroDefinitivo() {
  const inputOtp = document.getElementById('inputOtpModal');
  const otp = inputOtp ? inputOtp.value.trim() : "";
  const btnValidar = document.getElementById('btnValidarYGuardarModal');

  if (!otp || otp.length < 6) {
    alert("Por favor, ingresa el código de verificación completo de 6 dígitos.");
    return;
  }

  if (btnValidar) {
    btnValidar.disabled = true;
    btnValidar.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Guardando registro...';
  }

  const rol = obtenerRolSeleccionado();

  // 1. Validar OTP en el backend
  const resOtp = await callBackend('validarOTP', {
    email: emailOtpActualCache,
    otp: otp,
    rol: rol
  });

  if (resOtp && (resOtp.status === "SUCCESS" || resOtp.status === "REQUIRES_REGISTRATION" || resOtp.status === "REGISTRO_EXITOSO")) {
    
    // 2. Ejecutar guardado definitivo en la Base de Datos (Google Sheets / Apps Script)
    const resGuardarBD = await callBackend('registrarVoluntario', datosRegistroTemporalCache);

    if (resGuardarBD && resGuardarBD.status === "SUCCESS") {
      const perfilFinal = Object.assign({}, datosRegistroTemporalCache, resGuardarBD.perfil || {});
      
      perfilFinal.id = perfilFinal.id || datosRegistroTemporalCache.id;
      perfilFinal.ID_Voluntario = perfilFinal.ID_Voluntario || datosRegistroTemporalCache.ID_Voluntario;
      perfilFinal.rolActivo = rol;

      window.sesionUsuario = perfilFinal;
      sessionStorage.setItem('userProfile', JSON.stringify(perfilFinal));
      localStorage.setItem('userProfile', JSON.stringify(perfilFinal));

      if (typeof invalidarCachePerfil === 'function') invalidarCachePerfil();

      sincronizarHeaderGlobal();

      const modalElem = document.getElementById('modalRegistroNuevoCompleto');
      if (modalElem) {
        const modal = bootstrap.Modal.getInstance(modalElem);
        if (modal) modal.hide();
      }

      // Redirección directa al perfil tras confirmar la creación
      window.location.href = "../perfil/index.html?nuevo=true";
    } else {
      if (btnValidar) {
        btnValidar.disabled = false;
        btnValidar.innerText = "Finalizar y Acceder";
      }
      alert("Atención: El código es correcto, pero ocurrió un problema al registrar los datos en la base de datos: " + (resGuardarBD ? resGuardarBD.message : "Error desconocido"));
    }

  } else {
    if (btnValidar) {
      btnValidar.disabled = false;
      btnValidar.innerText = "Finalizar y Acceder";
    }
    alert(resOtp ? resOtp.message : "Código de verificación incorrecto.");
  }
}

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
    
    if (rol === "coordinador" || perfilSesion.esCoordinador) {
      perfilSesion.rolActivo = "coordinador";
      perfilSesion.esCoordinador = true;
    } else {
      perfilSesion.rolActivo = "eslabon";
    }
    
    window.sesionUsuario = perfilSesion;
    sessionStorage.setItem('userProfile', JSON.stringify(perfilSesion));
    localStorage.setItem('userProfile', JSON.stringify(perfilSesion));
    
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

async function enviarCodigoSeguridadOTP(email) {
  const errorDiv = document.getElementById('loginErrorMsg');
  if (errorDiv) errorDiv.classList.add('d-none');

  emailOtpActualCache = email;
  const rol = obtenerRolSeleccionado();
  const idVoluntarioGenerado = generarIDVoluntarioWeb();
  const timestampActual = new Date().toISOString();

  const perfilProvisional = {
    id: idVoluntarioGenerado,
    ID_Voluntario: idVoluntarioGenerado,
    email: email,
    rolActivo: rol,
    nuevoRegistro: true
  };
  
  window.sesionUsuario = perfilProvisional;
  sessionStorage.setItem('userProfile', JSON.stringify(perfilProvisional));
  localStorage.setItem('userProfile', JSON.stringify(perfilProvisional));

  const linkSoporte = document.getElementById('linkSoporteAuth');
  if (linkSoporte && typeof obtenerEnlaceWhatsApp === 'function') {
    linkSoporte.href = obtenerEnlaceWhatsApp('soporteAuth');
  }

  const lblEmail = document.getElementById('lblEmailEnmascarado');
  if (lblEmail) lblEmail.innerText = email;

  const res = await callBackend('enviarOTP', { 
    email: email,
    idVoluntario: idVoluntarioGenerado,
    rol: rol,
    timestamp: timestampActual
  });

  if (res && res.status !== "ERROR") {
    document.querySelectorAll('input[name="btnRol"]').forEach(input => input.disabled = true);
    document.getElementById('authStep1').classList.add('d-none');
    
    const stepGoogle = document.getElementById('authStepGoogle');
    if (stepGoogle) stepGoogle.classList.add('d-none'); 

    document.getElementById('authStepOTP').classList.remove('d-none');
    const otpInput = document.getElementById('loginOTP');
    if (otpInput) otpInput.focus();

    iniciarTemporizadorReenvio();
  } else {
    const btn = document.getElementById('btnContinuarEmail');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Continuar <i class="fa-solid fa-arrow-right ms-1"></i>';
    }
    mostrarErrorAuth(res ? res.message : "Error al despachar el código de seguridad.");
  }
}

function iniciarTemporizadorReenvio() {
  segundosRestantesReenvio = 60;
  const linkReenviar = document.getElementById('linkReenviarOTP');
  const btnContinuarEmail = document.getElementById('btnContinuarEmail');
  
  if (btnContinuarEmail) btnContinuarEmail.disabled = true;

  if (!linkReenviar) return;

  linkReenviar.style.pointerEvents = 'none';
  linkReenviar.classList.add('text-muted');
  linkReenviar.classList.remove('text-primary');

  if (temporizadorReenvioInterval) clearInterval(temporizadorReenvioInterval);

  temporizadorReenvioInterval = setInterval(() => {
    segundosRestantesReenvio--;
    const spanTimer = document.getElementById('timerConteo');
    if (spanTimer) spanTimer.innerText = segundosRestantesReenvio;

    if (segundosRestantesReenvio <= 0) {
      clearInterval(temporizadorReenvioInterval);
      linkReenviar.innerHTML = "Reenviar código ahora";
      linkReenviar.style.pointerEvents = 'auto';
      linkReenviar.classList.remove('text-muted');
      linkReenviar.classList.add('text-primary');

      if (btnContinuarEmail) btnContinuarEmail.disabled = false;
    }
  }, 1000);
}

async function reenviarCodigoOTP(event) {
  event.preventDefault();
  if (segundosRestantesReenvio > 0 || !emailOtpActualCache) return;

  const linkReenviar = document.getElementById('linkReenviarOTP');
  if (linkReenviar) linkReenviar.innerText = "Reenviando...";

  const res = await callBackend('enviarOTP', { email: emailOtpActualCache });
  if (res && res.status !== "ERROR") {
    alert("Se ha reenviado un nuevo código de verificación a tu correo.");
    iniciarTemporizadorReenvio();
  } else {
    alert("No se pudo reenviar el código. Intenta de nuevo en unos momentos.");
    if (linkReenviar) linkReenviar.innerHTML = 'Reenviar en <span id="timerConteo">60</span>s';
  }
}

async function validarYAccederOTP() {
  const email = emailOtpActualCache || document.getElementById('loginEmail').value.trim();
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
    btn.innerText = "Continuar";

    const idVoluntarioGenerado = (window.sesionUsuario && window.sesionUsuario.id) ? window.sesionUsuario.id : (res.idVoluntario || generarIDVoluntarioWeb());

    const perfilProvisional = { 
      id: idVoluntarioGenerado,
      ID_Voluntario: idVoluntarioGenerado,
      email: res.email || email, 
      rolActivo: rol, 
      nuevoRegistro: true 
    };

    window.sesionUsuario = perfilProvisional;
    sessionStorage.setItem('userProfile', JSON.stringify(perfilProvisional));
    localStorage.setItem('userProfile', JSON.stringify(perfilProvisional));

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
      cargarVista('perfil');
    } else {
      window.location.href = "../perfil/index.html?nuevo=true";
    }

  } else {
    mostrarErrorAuth(res ? res.message : "Código de verificación incorrecto.");
    btn.disabled = false;
    btn.innerText = "Continuar";
    document.querySelectorAll('input[name="btnRol"]').forEach(input => input.disabled = false);
  }
}

function forzarCambioA_OTP() {
  const email = document.getElementById('loginEmail').value.trim();
  enviarCodigoSeguridadOTP(email);
}

function cerrarSesion() {
  if (!confirm("¿Está seguro de cerrar su sesión en la Red Operativa?")) return;

  sessionStorage.removeItem('userProfile');
  localStorage.removeItem('userProfile');
  window.sesionUsuario = null;

  window.location.href = "../index.html"; 
}

function sincronizarHeaderGlobal() {
  const cuentaActiva = window.sesionUsuario || JSON.parse(sessionStorage.getItem('userProfile') || localStorage.getItem('userProfile') || 'null');
  
  const navAvatarContainer = document.getElementById('navAvatarContainer');
  const navDefaultIcon = document.getElementById('navDefaultIcon');
  const navBtnAuth = document.getElementById('navBtnAuth');
  const navBtnLogout = document.getElementById('navBtnLogout');
  const elementosSesion = document.querySelectorAll('.nav-item-sesion');
  const btnGestion = document.getElementById('navItemGestionVoluntarios');
  const btnCalendario = document.getElementById('navItemCalendario');
  const badgeContainer = document.getElementById('sessionRoleBadgeContainer');

  const segmentos = window.location.pathname
    .split('/')
    .filter(seg => seg.length > 0 && !seg.endsWith('.html'));

  const profundidad = segmentos.length;
  const prefijoRuta = "../".repeat(profundidad);
  const rutaLogoFallback = `${prefijoRuta}assets/logo.png`;

  if (cuentaActiva && cuentaActiva.email && cuentaActiva.email.trim() !== "") {
    if (navBtnAuth) navBtnAuth.classList.add('d-none');
    if (navBtnLogout) navBtnLogout.classList.remove('d-none');
    
    elementosSesion.forEach(el => el.classList.remove('d-none'));

    const esVerificadoReal = Boolean(
      cuentaActiva.verificado === true || 
      cuentaActiva.verificado === "Verificado" || 
      cuentaActiva.verificado === "TRUE"
    );

    const esCoordinadorReal = Boolean(
      cuentaActiva.esCoordinador || 
      cuentaActiva.coordinador === true || 
      cuentaActiva.isCoordinador === true ||
      cuentaActiva.rolActivo === "coordinador" || 
      cuentaActiva.rolActive === "coordinador" ||
      cuentaActiva.role === "coordinador"
    );

    if (btnCalendario) {
      if (esVerificadoReal || esCoordinadorReal) {
        btnCalendario.classList.remove('d-none');
      } else {
        btnCalendario.classList.add('d-none');
      }
    }

    if (btnGestion) {
      if (esCoordinadorReal) {
        btnGestion.classList.remove('d-none');
      } else {
        btnGestion.classList.add('d-none');
      }
    }

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
    if (navBtnAuth) navBtnAuth.classList.remove('d-none');
    if (navBtnLogout) navBtnLogout.classList.add('d-none');
    elementosSesion.forEach(el => el.classList.add('d-none'));
    if (navAvatarContainer) navAvatarContainer.classList.add('d-none');
    if (navDefaultIcon) navDefaultIcon.classList.remove('d-none');
    if (badgeContainer) badgeContainer.classList.add('d-none');
    if (btnCalendario) btnCalendario.classList.add('d-none');
  }
}

document.addEventListener("DOMContentLoaded", () => {
    sincronizarHeaderGlobal();
});

function gestionarRedireccionCalendario(event) {
  event.preventDefault();
  
  const cuentaActiva = window.sesionUsuario || JSON.parse(sessionStorage.getItem('userProfile') || localStorage.getItem('userProfile') || 'null');
  
  const esVerificadoReal = cuentaActiva && (cuentaActiva.verificado === true || cuentaActiva.verificado === "Verificado" || cuentaActiva.verificado === "TRUE");
  const esCoordinadorReal = cuentaActiva && Boolean(
    cuentaActiva.esCoordinador || 
    cuentaActiva.coordinador === true || 
    cuentaActiva.rolActivo === "coordinador"
  );

  if (esVerificadoReal || esCoordinadorReal) {
    window.location.href = "../calendario/index.html";
  } else {
    alert("Para acceder al calendario de guardias, primero debes completar tu perfil y ser verificado por un coordinador.");
    window.location.href = "../auth/index.html";
  }
} 