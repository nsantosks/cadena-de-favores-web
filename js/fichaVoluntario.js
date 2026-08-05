// ==========================================================================
// MÓDULO JS: FICHA DETALLADA DE PERSONAL / OFFCANVAS (NETLIFY / API REST)
// ==========================================================================

/**
 * Abre la ficha lateral cargando la foto de perfil en Base64 y su historial de documentos
 */
async function abrirFichaVoluntario(idVoluntario) {
  // Búsqueda en el buffer local (soporta poolVoluntariosModulo o poolVoluntarios)
  const pool = (typeof poolVoluntariosModulo !== "undefined" && poolVoluntariosModulo.length > 0) 
    ? poolVoluntariosModulo 
    : ((typeof poolVoluntarios !== "undefined") ? poolVoluntarios : []);

  const vol = pool.find(v => (v.id === idVoluntario || v.Correo === idVoluntario || v.email === idVoluntario));
  if (!vol) {
    alert("No se encontró la información del voluntario seleccionado.");
    return;
  }

  const body = document.getElementById('modalDetalleBody');
  if (!body) return;
  
  // Placeholder inicial (mientras carga la imagen de Drive/URL)
  const avatarFallback = "https://ui-avatars.com/api/?name=" + encodeURIComponent(vol.nombre || "V") + "&background=f1f5f9&color=1e3a8a&size=120";
  const estatusStr = vol.verificado 
    ? '<span class="text-success"><i class="fa-solid fa-circle-check"></i> Verificado</span>' 
    : '<span class="text-warning"><i class="fa-solid fa-clock"></i> Pendiente</span>';

  // Estructura del panel
  body.innerHTML = `
      <div class="position-relative d-inline-block mb-3 mt-2">
        <div id="spinnerFicha_${vol.id}" class="position-absolute top-50 start-50 translate-middle" style="z-index: 5; ${!vol.imagen_profile ? 'display:none;' : ''}">
          <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
        </div>
        
        <img id="imgFicha_${vol.id}" src="${avatarFallback}" class="rounded-circle border border-3 ${vol.verificado ? 'border-success' : 'border-warning'} shadow-sm" style="width: 110px; height: 110px; object-fit: cover; opacity: ${vol.imagen_profile ? '0.5' : '1'}; transition: opacity 0.3s;">
        
        <span id="modalIconoStatus" class="position-absolute bottom-0 end-0 p-1 bg-white border border-light rounded-circle shadow-sm" title="Estatus">
            ${vol.verificado ? '<i class="fa-solid fa-check text-success"></i>' : '<i class="fa-solid fa-hourglass-half text-warning"></i>'}
        </span>
      </div>
      
      <h5 class="fw-bold text-dark mb-0">${escapeHTML(vol.nombre || 'Sin Nombre')}</h5>
      <p class="text-muted font-monospace mb-2 small">${escapeHTML(vol.cedula || 'N/D')}</p>
      <div class="badge bg-primary px-3 py-2 mb-3 shadow-sm" style="font-size:0.85rem;">
         ${escapeHTML(vol.especialidad || 'Sin Especialidad')} <small class="fw-normal">(${escapeHTML(vol.voluntariado || 'General')})</small>
      </div>

      <ul class="list-group list-group-flush text-start small border rounded">
          <li class="list-group-item py-2"><i class="fa-solid fa-phone text-secondary me-2 w-15px"></i> <strong>Teléfono:</strong> ${escapeHTML(vol.telefono || 'N/D')}</li>
          <li class="list-group-item py-2"><i class="fa-solid fa-envelope text-secondary me-2 w-15px"></i> <strong>Correo:</strong> ${escapeHTML(vol.email || vol.Correo || 'N/D')}</li>
          <li class="list-group-item py-2"><i class="fa-solid fa-location-dot text-secondary me-2 w-15px"></i> <strong>Dirección:</strong> ${escapeHTML(vol.direccion || 'N/D')}</li>
          <li class="list-group-item py-2"><i class="fa-solid fa-map-pin text-secondary me-2 w-15px"></i> <strong>Recogida:</strong> ${escapeHTML(vol.puntoRecogida || 'N/D')}</li>
          <li class="list-group-item py-2 bg-light"><i class="fa-solid fa-calendar-check text-secondary me-2 w-15px"></i> <strong>Fecha Registro:</strong> ${escapeHTML(vol.fechaRegistro || 'N/D')}</li>
          <li class="list-group-item py-2 bg-light"><i class="fa-solid fa-shield-halved text-secondary me-2 w-15px"></i> <strong>Estatus:</strong> <span id="modalTextoStatus">${estatusStr}</span></li>
      </ul>
      
      <!-- Controles de Validación y Baneo -->
      <div class="row g-2 mt-3">
        <div class="col-6">
           <div id="modalBoxV" class="p-2 border rounded ${vol.verificado ? 'bg-success-subtle' : 'bg-light'} d-flex justify-content-between align-items-center">
              <span class="small fw-bold text-dark">Verificar</span>
              <div class="form-check form-switch m-0">
                 <input class="form-check-input" type="checkbox" ${vol.verificado ? 'checked' : ''} onchange="actualizarVerificacionEnLínea('${vol.id}', this)">
              </div>
           </div>
        </div>
        <div class="col-6">
           <div id="modalBoxB" class="p-2 border rounded ${vol.banned ? 'bg-danger-subtle' : 'bg-light'} d-flex justify-content-between align-items-center">
              <span id="modalTextoBaneo" class="small fw-bold ${vol.banned ? 'text-danger' : 'text-dark'}">${vol.banned ? 'Bloqueado' : 'Bloquear'}</span>
              <div class="form-check form-switch m-0">
                 <input class="form-check-input" type="checkbox" ${vol.banned ? 'checked' : ''} onchange="actualizarBaneoEnLínea('${vol.id}', this)">
              </div>
           </div>
        </div>
      </div>

      <!-- Historial de Credenciales Guardadas -->
      <div id="modalDocsHistorial" class="mt-3 border rounded bg-white p-2">
         <h6 class="small fw-bold text-secondary border-bottom pb-2 mb-2 text-start">
             <i class="fa-solid fa-folder-open text-primary me-2"></i>Historial de Credenciales Guardadas
         </h6>
         <div class="custom-scroll-list" style="max-height: 120px; overflow-y: auto;">
            <table class="table table-sm table-hover small mb-0 align-middle">
               <tbody id="modalDocsTableBody">
                  <tr><td class="text-center py-2 text-muted"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando historial...</td></tr>
               </tbody>
            </table>
         </div>
      </div>
  `;

  // Despliegue del Offcanvas de Bootstrap
  const modalElem = document.getElementById('modalDetalleVoluntario');
  if (modalElem) {
    const panelLateral = bootstrap.Offcanvas.getOrCreateInstance(modalElem);
    panelLateral.show();
  }

  // Carga asíncrona de los documentos anexos desde la API
  cargarDocumentosFichaAsincrono(vol.id);

  // Carga asíncrona de la imagen de perfil
  if (vol.imagen_profile && vol.imagen_profile.trim() !== "") {
    cargarImagenFichaAsincrono(vol.id, vol.imagen_profile);
  }
}

/**
 * Consulta la lista de documentos de un voluntario mediante callBackend
 */
async function cargarDocumentosFichaAsincrono(idVoluntario) {
  const modalTableBody = document.getElementById('modalDocsTableBody');
  const modalDocsHistorial = document.getElementById('modalDocsHistorial');

  const res = await callBackend('obtenerDocumentosVoluntario', { idVoluntario: idVoluntario });

  if (res && res.status === "SUCCESS" && Array.isArray(res.documentos) && res.documentos.length > 0) {
    if (modalDocsHistorial) modalDocsHistorial.classList.remove('d-none');
    if (modalTableBody) {
      modalTableBody.innerHTML = "";
      res.documentos.forEach(doc => {
        modalTableBody.innerHTML += `
          <tr>
            <td class="text-truncate text-start align-middle" style="max-width: 200px; font-size:0.75rem;" title="${escapeHTML(doc.nombre)}">
               <i class="fa-solid fa-file-pdf text-danger me-2"></i><strong>${escapeHTML(doc.nombre)}</strong>
            </td>
            <td class="text-end align-middle">
               <a href="${doc.url}" target="_blank" class="btn btn-sm btn-outline-primary p-0 px-2 border-0" title="Ver archivo"><i class="fa-solid fa-eye fs-6"></i></a>
               <button type="button" class="btn btn-sm btn-outline-danger p-0 px-2 border-0 ms-1" title="Eliminar de Drive" onclick="eliminarCredencialDesdeFichaCoordinador('${doc.id}', '${idVoluntario}')"><i class="fa-solid fa-trash fs-6"></i></button>
            </td>
          </tr>
        `;
      });
    }
  } else {
    if (modalTableBody) {
      modalTableBody.innerHTML = `<tr><td class="text-center py-2 text-muted small"><i class="fa-solid fa-file-circle-xmark me-1"></i> No posee documentos anexos</td></tr>`;
    }
  }
}

/**
 * Carga de forma asíncrona la imagen en Base64 o URL directa
 */
async function cargarImagenFichaAsincrono(idVoluntario, imgUrlOrId) {
  const imgElem = document.getElementById(`imgFicha_${idVoluntario}`);
  const spinner = document.getElementById(`spinnerFicha_${idVoluntario}`);

  // Si ya viene como URL directa o Data URI
  if (imgUrlOrId.startsWith("http") || imgUrlOrId.startsWith("data:")) {
    if (imgElem) {
      imgElem.src = imgUrlOrId;
      imgElem.style.opacity = '1';
    }
    if (spinner) spinner.style.display = 'none';
    return;
  }

  // Si requiere resolverse a Base64 mediante el backend
  const res = await callBackend('obtenerImagenBase64', { idFile: imgUrlOrId });

  if (res && (res.base64 || res.status === "SUCCESS")) {
    if (imgElem) {
      imgElem.src = res.base64 || res.url;
      imgElem.style.opacity = '1';
    }
  } else {
    if (imgElem) imgElem.style.opacity = '1';
  }

  if (spinner) spinner.style.display = 'none';
}

/**
 * Elimina una credencial directamente desde la ficha lateral
 */
async function eliminarCredencialDesdeFichaCoordinador(fileId, idVoluntario) {
  if (!confirm("ADVERTENCIA DE COORDINACIÓN:\n\n¿Está seguro de eliminar este documento de las credenciales del voluntario?\n\nEsta acción moverá el archivo a la papelera en Drive de forma permanente e irreversible.")) return;
  
  const tbody = document.getElementById('modalDocsTableBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="2" class="text-center py-2 text-muted small"><div class="spinner-border spinner-border-sm text-danger me-1"></div> Removiendo de Drive...</td></tr>`;

  const res = await callBackend('eliminarDocumentoDrive', { fileId: fileId, idVoluntario: idVoluntario });

  if (res && res.status === "SUCCESS") {
    alert("¡Documento removido con éxito!");
    
    if (typeof cargarVoluntariosServidor === "function") {
      cargarVoluntariosServidor();
    }
    
    abrirFichaVoluntario(idVoluntario);
  } else {
    alert("Error al eliminar: " + (res ? res.message : "Fallo de comunicación"));
    abrirFichaVoluntario(idVoluntario);
  }
}

/**
 * Refresca la vista o grilla activa en pantalla
 */
function refrescarFiltroDirectorioActivo() {
  if (typeof ejecutarFiltroAgenda === "function") {
    ejecutarFiltroAgenda(); 
  } else if (typeof ejecutarFiltroAgendaLocal === "function") {
    ejecutarFiltroAgendaLocal();
  }
}

/**
 * Conecta con el servidor para verificar/desverificar al voluntario en vivo
 */
async function actualizarVerificacionEnLínea(idVoluntario, toggle) {
  const proximoEstatus = toggle.checked ? "Verificado" : "No Verificado";
  toggle.disabled = true;

  const res = await callBackend('cambiarEstatusVerificacion', {
    idVoluntario: idVoluntario,
    estatus: proximoEstatus,
    verificado: toggle.checked
  });

  toggle.disabled = false;

  if (res && res.status === "SUCCESS") {
    const pool = (typeof poolVoluntariosModulo !== "undefined") ? poolVoluntariosModulo : ((typeof poolVoluntarios !== "undefined") ? poolVoluntarios : []);
    const idx = pool.findIndex(v => v.id === idVoluntario);
    if (idx !== -1) pool[idx].verificado = toggle.checked;
    
    refrescarFiltroDirectorioActivo();

    // Actualiza el Offcanvas en tiempo real
    const modalTexto = document.getElementById('modalTextoStatus');
    const modalIcono = document.getElementById('modalIconoStatus');
    const modalBoxV = document.getElementById('modalBoxV');
    const imgFicha = document.getElementById(`imgFicha_${idVoluntario}`);
    
    if (modalTexto) modalTexto.innerHTML = toggle.checked ? '<span class="text-success"><i class="fa-solid fa-circle-check"></i> Verificado</span>' : '<span class="text-warning"><i class="fa-solid fa-clock"></i> Pendiente</span>';
    if (modalIcono) modalIcono.innerHTML = toggle.checked ? '<i class="fa-solid fa-check text-success"></i>' : '<i class="fa-solid fa-hourglass-half text-warning"></i>';
    if (modalBoxV) modalBoxV.className = `p-2 border rounded ${toggle.checked ? 'bg-success-subtle' : 'bg-light'} d-flex justify-content-between align-items-center`;
    if (imgFicha) imgFicha.className = `rounded-circle border border-3 ${toggle.checked ? 'border-success' : 'border-warning'} shadow-sm`;

  } else {
    alert("Error de persistencia: " + (res ? res.message : "Fallo de red"));
    toggle.checked = !toggle.checked;
  }
}

/**
 * Conecta con el servidor para bloquear/desbloquear al voluntario en vivo
 */
async function actualizarBaneoEnLínea(idVoluntario, toggle) {
  const esBaneado = toggle.checked;
  toggle.disabled = true;

  const res = await callBackend('cambiarEstatusBaneo', {
    idVoluntario: idVoluntario,
    banned: esBaneado
  });

  toggle.disabled = false;

  if (res && res.status === "SUCCESS") {
    const pool = (typeof poolVoluntariosModulo !== "undefined") ? poolVoluntariosModulo : ((typeof poolVoluntarios !== "undefined") ? poolVoluntarios : []);
    const idx = pool.findIndex(v => v.id === idVoluntario);
    if (idx !== -1) pool[idx].banned = esBaneado;
    
    refrescarFiltroDirectorioActivo();

    // Actualiza el Offcanvas en tiempo real
    const modalBoxB = document.getElementById('modalBoxB');
    const modalTextoBaneo = document.getElementById('modalTextoBaneo');
    if (modalBoxB) modalBoxB.className = `p-2 border rounded ${esBaneado ? 'bg-danger-subtle' : 'bg-light'} d-flex justify-content-between align-items-center`;
    if (modalTextoBaneo) {
      modalTextoBaneo.className = `small fw-bold ${esBaneado ? 'text-danger' : 'text-dark'}`;
      modalTextoBaneo.innerText = esBaneado ? "Bloqueado" : "Bloquear";
    }

  } else {
    alert("Error: " + (res ? res.message : "Fallo de comunicación"));
    toggle.checked = !toggle.checked;
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