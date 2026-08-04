// ==========================================================================
// MÓDULO JS: LOGÍSTICA, CALENDARIO Y DESPACHO OPERATIVO
// ==========================================================================

let currentDate = new Date(); // Inicia automáticamente en el mes y año real (Agosto 2026)
let guardiasData = [];                  // Almacén en memoria
let catalogoChoferes = null;           // Cache de choferes
let catalogoPuntos = null;             // Cache de puntos
let cacheEspecialidadesGuardia = null; // Cache especialidades

document.addEventListener("DOMContentLoaded", function() {
  if (document.getElementById('calendarGrid')) {
    initCalendar();
    cargarDatos();
  }
});

/**
 * Inicializador global expuesto para ser invocado por app.js
 */
window.inicializarCalendarioView = function() {
  initCalendar();
  cargarDatos();
};

/**
 * Consulta de Guardias mediante API REST
 */
async function cargarDatos() {
  const grid = document.getElementById('calendarGrid');
  if (!grid) return;
  
  grid.innerHTML = `
    <div class="p-5 text-center" style="grid-column: 1 / -1;">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-2 text-muted fw-semibold">Sincronizando Calendario Operativo...</p>
    </div>`;
  
  const response = await callBackend('obtenerCalendario', {});
  
  if (response && (response.status === 'success' || response.status === 'SUCCESS' || Array.isArray(response))) {
    guardiasData = Array.isArray(response) ? response : (response.data || response.guardias || []);
    renderCalendar(currentDate);
    actualizarBadgeRolNavbar();
  } else {
    console.error("Error del servidor:", response ? response.message : 'Sin respuesta');
    grid.innerHTML = `
      <div class="p-4 text-center text-danger" style="grid-column: 1 / -1;">
        <i class="fa-solid fa-triangle-exclamation fa-2x mb-2"></i>
        <p class="mb-0">No se pudieron sincronizar las guardias del mes.</p>
      </div>`;
  }
}

function determinarColorGuardia(fechaStr, inscritos, requeridos) {
  const hoy = new Date();
  hoy.setHours(0,0,0,0);
  
  const partes = fechaStr.split('-');
  const fechaG = new Date(partes[0], partes[1] - 1, partes[2]);
  fechaG.setHours(0,0,0,0);

  if (fechaG < hoy) return 'guardia-gris';
  if (!requeridos || requeridos <= 0) return 'guardia-rojo';

  const porcentaje = (inscritos / requeridos) * 100;

  if (inscritos >= requeridos) return 'guardia-azul';    
  if (porcentaje >= 60) return 'guardia-verde';        
  if (porcentaje < 10) return 'guardia-rojo';          
  return 'guardia-ambar';                              
}

function renderCalendar(date) {
  if (typeof refrescarSesionLocal === "function") refrescarSesionLocal();
  
  const grid = document.getElementById('calendarGrid');
  const monthYear = document.getElementById('monthYearDisplay');
  if (!grid || !monthYear) return;
  
  grid.innerHTML = ''; 

  const year = date.getFullYear();
  const month = date.getMonth();

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  monthYear.innerText = `${monthNames[month]} ${year}`;

  // Encabezados de Días (Lunes a Domingo)
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  days.forEach(day => {
    const dayHeader = document.createElement('div');
    dayHeader.className = 'calendar-header-day';
    dayHeader.innerText = day;
    grid.appendChild(dayHeader);
  });

  // Cálculo corregido del primer día de la semana (0 = Lunes, 6 = Domingo)
  const firstDayRaw = new Date(year, month, 1).getDay();
  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1; 
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Relleno de casillas vacías al inicio del mes
  for (let i = 0; i < firstDay; i++) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'calendar-day empty';
    grid.appendChild(emptyDiv);
  }

  const emailLogueado = (window.sesionUsuario && window.sesionUsuario.email) 
    ? window.sesionUsuario.email.toLowerCase().trim() 
    : "";

  // Iteración de días del mes
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day position-relative';
    dayDiv.setAttribute('data-fecha', dateStr);
    
    const dayNum = document.createElement('div');
    dayNum.className = 'day-number';
    dayNum.innerText = day;
    dayDiv.appendChild(dayNum);

    const guardiaDelDia = guardiasData.find(g => g.fechaStr && g.fechaStr.startsWith(dateStr));

    if (guardiaDelDia) {
        const colorClass = determinarColorGuardia(guardiaDelDia.fechaStr, guardiaDelDia.voluntariosInscritos, guardiaDelDia.requerimientoTotal);
        
        const estaInscrito = guardiaDelDia.correosInscritos && guardiaDelDia.correosInscritos.some(cadenaTripulante => {
            return cadenaTripulante.toLowerCase().includes(emailLogueado);
        });

        if (estaInscrito && emailLogueado !== "") {
            const checkBadge = document.createElement('span');
            checkBadge.className = 'position-absolute top-0 end-0 badge rounded-pill bg-success m-1 animate__animated animate__bounceIn';
            checkBadge.innerHTML = '<i class="fa-solid fa-user-check"></i>';
            dayDiv.appendChild(checkBadge);
            dayDiv.classList.add('border-success-custom'); 
        }

        const indicador = document.createElement('div');
        indicador.className = `guardia-indicador ${colorClass}`;
        
        const busIcon = document.createElement('i');
        busIcon.className = `fa-solid fa-bus bus-icon ${guardiaDelDia.tieneTransporte ? 'bus-ok' : 'bus-no'}`;
        
        const txtInfo = document.createElement('span');
        txtInfo.innerHTML = `<span class="voluntarios-count">${guardiaDelDia.voluntariosInscritos || 0}</span> / ${guardiaDelDia.requerimientoTotal || 0}`;
        
        indicador.appendChild(busIcon);
        indicador.appendChild(txtInfo);
        dayDiv.appendChild(indicador);
    } else {
        const txtNull = document.createElement('div');
        txtNull.className = "text-muted small mt-2 opacity-50";
        txtNull.style.fontSize = "0.7rem";
        txtNull.innerText = "Sin registro";
        dayDiv.appendChild(txtNull);
    }

    grid.appendChild(dayDiv);
  }

  // Delegación de clics en las casillas
  grid.onclick = function(event) {
    const targetDay = event.target.closest('.calendar-day');
    if (!targetDay || targetDay.classList.contains('empty')) return;
    
    const fechaClick = targetDay.getAttribute('data-fecha');
    const guardiaSeleccionada = guardiasData.find(g => g.fechaStr && g.fechaStr.startsWith(fechaClick));
    
    if (typeof refrescarSesionLocal === "function") refrescarSesionLocal();
    const rol = window.sesionUsuario ? (window.sesionUsuario.rolActivo || window.sesionUsuario.rolActive || "eslabon") : "eslabon";

    if (guardiaSeleccionada) {
      const indicadorElem = targetDay.querySelector('.guardia-indicador');
      const colorClass = indicadorElem ? indicadorElem.classList[1] : '';
      abrirModalGuardia(guardiaSeleccionada, colorClass);
    } else {
      if (rol === "coordinador") {
        abrirModalGuardia({ fechaStr: fechaClick, id: null }, '');
      } else {
        alert(`No hay un requerimiento programado para el día ${fechaClick}.`);
      }
    }
  };
}

function initCalendar() {
  const btnPrev = document.getElementById('btnPrevMonth');
  const btnNext = document.getElementById('btnNextMonth');
  if(!btnPrev || !btnNext) return;

  btnPrev.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar(currentDate);
  };
  btnNext.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar(currentDate);
  };
}

function actualizarBadgeRolNavbar() {
  if (typeof refrescarSesionLocal === "function") refrescarSesionLocal();
  const container = document.getElementById('sessionRoleBadgeContainer');
  if (!container) return;
  
  const rol = window.sesionUsuario ? (window.sesionUsuario.rolActivo || window.sesionUsuario.rolActive) : null;
  if (rol) {
    if (rol === "coordinador") {
      container.innerHTML = `<span class="badge bg-danger px-3 py-2 animate__animated animate__fadeInDown"><i class="fa-solid fa-user-shield me-1"></i> Panel Coordinador</span>`;
    } else {
      container.innerHTML = `<span class="badge bg-secondary px-3 py-2 animate__animated animate__fadeInDown"><i class="fa-solid fa-link me-1"></i> Rol: Eslabón</span>`;
    }
  } else {
    container.innerHTML = '';
  }
}

function abrirModalGuardia(guardia, colorClass) {
   if (typeof refrescarSesionLocal === "function") refrescarSesionLocal();
   const rol = window.sesionUsuario ? (window.sesionUsuario.rolActivo || window.sesionUsuario.rolActive || "eslabon") : "eslabon";
   
   if (rol === "coordinador") {
     construirModalCoordinador(guardia);
   } else {
     construirModalEslabon(guardia, colorClass);
   }
}

function construirModalCoordinador(guardia) {
  const modalElem = document.getElementById('modalGuardia');
  if (!modalElem) return;
  const modal = bootstrap.Modal.getOrCreateInstance(modalElem);
  const body = document.getElementById('modalGuardiaBody');
  const btnInscribir = document.getElementById('btnInscribirse');
  
  const footer = document.getElementById('modalGuardiaFooter');
  if (footer) footer.style.display = 'none';
  if (btnInscribir) btnInscribir.style.display = "none"; 
  
  if (!guardia.id) {
     body.innerHTML = `
        <datalist id="listaEspGuardia"></datalist>
        <div class="p-2">
          <h5 class="text-primary border-bottom pb-2 mb-3"><i class="fa-solid fa-folder-plus me-2"></i>Aperturar Turno Operativo</h5>
          <p class="small text-muted">Defina las necesidades logísticas de la misión para el día <strong>${guardia.fechaStr}</strong>.</p>
          
          <div class="mb-3">
            <label class="form-label fw-bold small">Destino de la Misión</label>
            <select id="newGuaDestino" class="form-select">
                <option value="" disabled selected>-- Seleccione un Destino Maestro --</option>
            </select>
          </div>
          
          <h6 class="fw-bold small mb-2 text-secondary">Definir Requerimientos de Personal</h6>
          <div id="contenedorCamposReq">
            <div class="row g-2 mb-2 alignment-row">
              <div class="col-7">
                <input type="text" class="form-control form-control-sm req-esp" list="listaEspGuardia" placeholder="Escriba o seleccione">
              </div>
              <div class="col-3">
                <input type="number" class="form-control form-control-sm req-cant" placeholder="Cant" min="1">
              </div>
              <div class="col-2">
                <button class="btn btn-outline-danger btn-sm w-100" onclick="this.closest('.alignment-row').remove()"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          </div>
          <button class="btn btn-outline-secondary btn-sm mb-3 w-100" onclick="agregarFilaRequerimiento()"><i class="fa-solid fa-plus me-1"></i>Añadir Especialidad Vacante</button>
          
          <button class="btn btn-success w-100 py-2 fw-bold shadow-sm" onclick="ejecutarCreacionGuardia('${guardia.fechaStr}', this)">
            <i class="fa-solid fa-floppy-disk me-1"></i> Publicar Guardia en Calendario
          </button>
        </div>
     `;
     modal.show();
     cargarListasAsincronasCoordinador(guardia);
     return;
  }

  body.innerHTML = `
    <datalist id="listaEspGuardia"></datalist>
    <div class="p-1">
      <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
        <h5 class="text-dark m-0"><i class="fa-solid fa-sliders me-2 text-primary"></i>Rol de Guardia: <strong>${guardia.fechaStr}</strong></h5>
        <span class="badge bg-primary font-monospace">${guardia.id}</span>
      </div>

      <div class="card bg-light border-0 mb-3 shadow-sm">
        <div class="card-body p-3">
          <label class="form-label fw-bold small text-primary"><i class="fa-solid fa-bus me-1"></i> Asignación de Unidad / Chofer</label>
          <div class="d-flex gap-2 mb-2">
            <select class="form-select form-select-sm" id="selectChoferMision"><option value="">-- Sin Unidad Asignada --</option></select>
            <button class="btn btn-sm btn-primary px-3" id="btnAsignarTransporte" onclick="confirmarAsignacionTransporte('${guardia.id}')">Asignar</button>
          </div>
          <div id="subFormNuevoTransportista" class="p-2 border rounded bg-white d-none animate__animated animate__fadeIn mt-2">
            <p class="fw-bold text-dark mb-2" style="font-size: 0.75rem;"><i class="fa-solid fa-square-plus text-success me-1"></i>REGISTRO RÁPIDO</p>
            <div class="row g-2">
              <div class="col-6"><input type="text" id="fastTraNombre" class="form-control form-control-sm" placeholder="Nombre / Empresa"></div>
              <div class="col-6"><input type="text" id="fastTraTelefono" class="form-control form-control-sm" placeholder="Teléfono"></div>
            </div>
            <div class="d-flex justify-content-end gap-2 mt-2">
              <button class="btn btn-xs btn-link text-muted p-0 border-0 text-decoration-none small" style="font-size:0.8rem;" onclick="cancelarRegistroChoferRapido()">Cancelar</button>
              <button class="btn btn-success btn-sm px-2 py-0 fw-bold" style="font-size:0.8rem;" onclick="guardarChoferRapido('${guardia.id}')">Guardar y Seleccionar</button>
            </div>
          </div>
        </div>
      </div>

      <h6 class="fw-bold small text-secondary mb-2"><i class="fa-solid fa-users me-1"></i> Tripulación Inscrita (${guardia.voluntariosInscritos || 0} Especialistas)</h6>
      <div id="listaTripulantesDespacho" class="list-group mb-3 custom-scroll-list" style="max-height: 180px; overflow-y: auto;">
        <div class="text-center p-3 text-muted small">Cargando tripulantes autorizados...</div>
      </div>

      <h6 class="fw-bold small text-secondary mb-2"><i class="fa-solid fa-clipboard-list me-1"></i> Modificar Requerimientos Operativos</h6>
      <div id="contenedorReqEdicion" class="mb-2"></div>
      <button class="btn btn-outline-secondary btn-sm mb-3 w-100" onclick="agregarFilaRequerimientoEdicion()"><i class="fa-solid fa-plus me-1"></i>Añadir Nueva Vacante</button>
      <button class="btn btn-sm btn-outline-primary w-100 mb-4" id="btnSincronizarReq" onclick="guardarRequerimientosEditados('${guardia.id}', this)">Sincronizar Requerimientos</button>

      <div class="border-top pt-3">
        <button class="btn btn-sm btn-primary w-100 py-2 fw-bold shadow-sm mb-2" style="background-color: #6366f1; border-color: #6366f1;" id="btnEnviarConvocatoria" onclick="lanzarConvocatoriaMasiva('${guardia.id}')">
           <i class="fa-solid fa-paper-plane me-1"></i> Enviar Convocatoria Masiva
        </button>
      </div>

      <div class="row g-2 pt-1">
        <div class="col-6">
          <button class="btn btn-success w-100 py-2 fw-bold shadow-sm btn-sm" onclick="descargarManifiestoPdf('${guardia.id}')">
            <i class="fa-solid fa-file-pdf me-1"></i> Manifiesto (Control)
          </button>
        </div>
        <div class="col-6">
          <button class="btn btn-danger w-100 py-2 fw-bold shadow-sm btn-sm" onclick="ejecutarPurgaGuardia('${guardia.id}', '${guardia.fechaStr}')">
            <i class="fa-solid fa-triangle-exclamation me-1"></i> Eliminar Guardia
          </button>
        </div>
      </div>
    </div>
  `;

  modal.show();
  cargarListasAsincronasCoordinador(guardia);
}

async function cargarListasAsincronasCoordinador(guardia) {
  if (catalogoChoferes) {
    renderizarSelectChoferes(catalogoChoferes, guardia.idTransportista || guardia.idTransporte);
  } else {
    const resChoferes = await callBackend('obtenerTransportistas', {});
    catalogoChoferes = resChoferes.transportistas || [];
    renderizarSelectChoferes(catalogoChoferes, guardia.idTransportista || guardia.idTransporte);
  }

  poblarEspecialidadesGuardia();

  const contenedorTrip = document.getElementById('listaTripulantesDespacho');
  if (contenedorTrip) {
      if (guardia.correosInscritos && guardia.correosInscritos.length > 0) {
         contenedorTrip.innerHTML = '';
         guardia.correosInscritos.forEach(stringCadena => {
            const partes = stringCadena.split('|');
            const emailLimpio = partes[2] ? partes[2].trim() : stringCadena.trim();
            const textoVisual = stringCadena;
            
            const item = document.createElement('div');
            item.className = "list-group-item d-flex justify-content-between align-items-center py-2 px-2 small animate__animated animate__fadeIn list-group-item-action";
            item.style.cursor = "pointer";
            item.setAttribute("onclick", `abrirFichaDesdeGuardia('${emailLimpio}')`);
            
            item.innerHTML = `
              <span class="text-truncate" style="max-width:80%; pointer-events:none;">
                  <i class="fa-solid fa-user-check text-success me-2"></i><strong>${escapeHTML(textoVisual)}</strong>
              </span>
              <button class="btn btn-outline-danger btn-sm p-1 border-0" title="Remover de Guardia" onclick="event.stopPropagation(); expulsarVoluntarioFuerza('${emailLimpio}', '${guardia.id}', this)">
                <i class="fa-solid fa-user-minus"></i>
              </button>
            `;
            contenedorTrip.appendChild(item);
         });
      } else {
         contenedorTrip.innerHTML = '<div class="text-center p-3 text-muted small">No hay especialistas apuntados.</div>';
      }
  }

  const contenedorReq = document.getElementById('contenedorReqEdicion');
  if (contenedorReq) contenedorReq.innerHTML = '';

  if(guardia.detallesRequeridos && guardia.detallesRequeridos.length > 0) {
     guardia.detallesRequeridos.forEach(req => {
        agregarFilaRequerimientoEdicion(req.especialidad, req.cantidad);
     });
  }

  const selectDestino = document.getElementById('newGuaDestino');
  if (selectDestino) {
    const renderizar = (puntos) => {
      const valActual = selectDestino.value;
      selectDestino.innerHTML = '<option value="" disabled selected>-- Seleccione un Destino Maestro --</option>';
      puntos.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.innerText = p.nombre;
        if(valActual === p.id) opt.selected = true;
        selectDestino.appendChild(opt);
      });
    };

    if (catalogoPuntos) {
      renderizar(catalogoPuntos);
    } else {
      const resPuntos = await callBackend('obtenerPuntosRecogida', {});
      catalogoPuntos = resPuntos.puntos || [];
      renderizar(catalogoPuntos);
    }
  }
}

function agregarFilaRequerimiento() {
  const div = document.createElement('div');
  div.className = 'row g-2 mb-2 alignment-row';
  div.innerHTML = `
    <div class="col-7"><input type="text" class="form-control form-control-sm req-esp" list="listaEspGuardia" placeholder="Escriba o seleccione"></div>
    <div class="col-3"><input type="number" class="form-control form-control-sm req-cant" placeholder="Cant" min="1"></div>
    <div class="col-2"><button class="btn btn-outline-danger btn-sm w-100" onclick="this.closest('.alignment-row').remove()"><i class="fa-solid fa-trash"></i></button></div>
  `;
  const parent = document.getElementById('contenedorCamposReq');
  if (parent) parent.appendChild(div);
}

function agregarFilaRequerimientoEdicion(esp = "", cant = "") {
  const div = document.createElement('div');
  div.className = 'row g-2 mb-2 alignment-row-edit';
  div.innerHTML = `
    <div class="col-7"><input type="text" class="form-control form-control-sm edit-esp" list="listaEspGuardia" value="${esp}" placeholder="Escriba o seleccione"></div>
    <div class="col-3"><input type="number" class="form-control form-control-sm edit-cant" value="${cant}" placeholder="Cant" min="1"></div>
    <div class="col-2"><button class="btn btn-outline-danger btn-sm w-100" onclick="this.closest('.alignment-row-edit').remove()"><i class="fa-solid fa-trash"></i></button></div>
  `;
  const parent = document.getElementById('contenedorReqEdicion');
  if (parent) parent.appendChild(div);
}

function renderizarSelectChoferes(listaChoferes, idTransportistaAsignado) {
  const select = document.getElementById('selectChoferMision');
  if(!select) return;
  
  select.innerHTML = '<option value="">-- Sin Unidad Asignada --</option>';
  listaChoferes.forEach(chofer => {
     const option = document.createElement('option');
     option.value = chofer.id;
     option.innerText = chofer.nombre;
     
     if (idTransportistaAsignado && idTransportistaAsignado == chofer.id) {
        option.selected = true;
     }
     select.appendChild(option);
  });

  const optNuevo = document.createElement('option');
  optNuevo.value = "__NUEVO__";
  optNuevo.innerText = "➕ Agregar Nuevo...";
  optNuevo.style.fontWeight = "bold";
  optNuevo.style.color = "#198754";
  select.appendChild(optNuevo);

  select.onchange = function() {
    const contenedorForm = document.getElementById('subFormNuevoTransportista');
    if (this.value === "__NUEVO__") {
      if (contenedorForm) contenedorForm.classList.remove('d-none');
    } else {
      if (contenedorForm) contenedorForm.classList.add('d-none');
    }
  };
}

async function ejecutarCreacionGuardia(fechaStr, btn) {
  const destinoInput = document.getElementById('newGuaDestino');
  if(!destinoInput || !destinoInput.value.trim()) { 
      if (destinoInput) {
        destinoInput.classList.add('border-danger');
        setTimeout(() => destinoInput.classList.remove('border-danger'), 2000);
      }
      return; 
  }

  const destino = destinoInput.value.trim();
  let reqs = [];
  document.querySelectorAll('.alignment-row').forEach(row => {
     const esp = row.querySelector('.req-esp').value.trim();
     const cant = row.querySelector('.req-cant').value;
     if(esp && cant) { reqs.push({ especialidad: esp, cantidad: cant }); }
  });

  let emailCoord = window.sesionUsuario ? window.sesionUsuario.email : "";

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Publicando...';

  const res = await callBackend('crearNuevaGuardia', {
    fechaStr: fechaStr,
    datosGuardia: { destino: destino, requerimientos: reqs },
    emailCoordinador: emailCoord
  });

  if(res && res.status === "SUCCESS") {
    const body = document.getElementById('modalGuardiaBody');
    body.innerHTML = `
       <div class="p-5 text-center animate__animated animate__zoomIn">
         <i class="fa-solid fa-circle-check text-success fa-5x mb-3"></i>
         <h4 class="text-dark fw-bold mb-1">¡Guardia Publicada!</h4>
         <p class="text-muted small">El turno ha sido agendado exitosamente en el calendario logístico.</p>
       </div>`;
    
    setTimeout(() => {
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('modalGuardia'));
        if (modalInstance) modalInstance.hide();
        cargarDatos();
    }, 1500);

  } else {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-1"></i> Error al publicar`;
    btn.classList.replace('btn-success', 'btn-danger');
    
    setTimeout(() => {
       btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Publicar Guardia en Calendario';
       btn.classList.replace('btn-danger', 'btn-success');
    }, 3000);
  }
}

async function expulsarVoluntarioFuerza(email, idGuardia, btn) {
   if(!confirm(`¿Confirma la desincorporación forzada del correo ${email} de este turno operativo?`)) return;
   btn.disabled = true;
   
   const res = await callBackend('removerGuardia', { email: email, idGuardia: idGuardia });
   if(res && res.status === "SUCCESS") {
      let itemRow = btn.closest('.list-group-item');
      if (itemRow) {
        itemRow.className += " animate__animated animate__fadeOutRight";
        setTimeout(() => itemRow.remove(), 500);
      }
      cargarDatos(); 
   } else {
      alert(res ? res.message : "Error al remover voluntario.");
      btn.disabled = false;
   }
}

async function guardarRequerimientosEditados(idGuardia, btn) {
   let reqs = [];
   document.querySelectorAll('.alignment-row-edit').forEach(row => {
      const espInput = row.querySelector('.edit-esp');
      const cantInput = row.querySelector('.edit-cant');
      if (espInput && cantInput) {
         const esp = espInput.value.trim();
         const cant = cantInput.value;
         if(esp && cant) { reqs.push({ especialidad: esp, cantidad: parseInt(cant) }); }
      }
   });

   btn.disabled = true;
   const textoOriginal = "Sincronizar Requerimientos";
   btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Sincronizando...';

   const res = await callBackend('actualizarRequerimientosGuardia', {
     idGuardia: idGuardia,
     requerimientosNuevos: reqs
   });

   if(res && (res.status === "SUCCESS" || res.status === "success")) {
      const body = document.getElementById('modalGuardiaBody');
      body.innerHTML = `
       <div class="p-5 text-center animate__animated animate__zoomIn">
           <div class="text-primary mb-3">
               <i class="fa-solid fa-clipboard-check fa-5x"></i>
           </div>
           <h4 class="text-dark fw-bold">Demanda Actualizada</h4>
           <p class="text-muted small">Los requerimientos técnicos de la guardia han sido modificados y guardados en el registro maestro.</p>
       </div>`;

      setTimeout(() => {
          const modalInstance = bootstrap.Modal.getInstance(document.getElementById('modalGuardia'));
          if (modalInstance) modalInstance.hide();
          cargarDatos();
      }, 1800);

   } else {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i> Error al Sincronizar';
      btn.classList.replace('btn-outline-primary', 'btn-danger');
      setTimeout(() => {
          btn.innerHTML = textoOriginal;
          btn.classList.replace('btn-danger', 'btn-outline-primary');
      }, 3000);
   }
}

function ejecutarPurgaGuardia(idGuardia, fechaStr) {
   const body = document.getElementById('modalGuardiaBody');
   body.innerHTML = `
     <div class="text-center p-4 animate__animated animate__fadeIn">
       <div class="text-danger mb-3">
         <i class="fa-solid fa-triangle-exclamation fa-4x animate__animated animate__flash animate__infinite animate__slower"></i>
       </div>
       <h4 class="fw-bold text-dark mb-2">Advertencia Crítica</h4>
       <p class="text-muted small mb-3">¿Está absolutamente seguro de eliminar la guardia del día <strong class="fs-6">${fechaStr}</strong>?</p>
       
       <div class="alert alert-danger text-start small border-0 bg-danger-subtle mb-4">
          <i class="fa-solid fa-circle-info me-1"></i> Esta acción eliminará de forma completa y en cascada todos los requerimientos y desvinculará a todos los voluntarios inscritos de forma <strong>irreversible</strong>.
       </div>
       
       <div class="d-flex justify-content-center gap-2">
        <button type="button" class="btn btn-light border w-50 fw-bold shadow-sm" onclick="construirModalCoordinador(guardiasData.find(g => g.id === '${idGuardia}'))">Cancelar</button>
        <button type="button" class="btn btn-danger w-50 fw-bold shadow-sm" onclick="confirmarEliminacionGuardiaFinal('${idGuardia}')">Sí, Eliminar</button>
       </div>
     </div>
   `;
}

async function confirmarEliminacionGuardiaFinal(idGuardia) {
   const body = document.getElementById('modalGuardiaBody');
   body.innerHTML = `
      <div class="p-5 text-center animate__animated animate__fadeIn">
          <div class="spinner-border text-danger mb-3" style="width: 3rem; height: 3rem;" role="status"></div>
          <h5 class="fw-bold text-danger">Purgando registros...</h5>
          <p class="small text-muted">Eliminando dependencias en cascada.</p>
      </div>`;

   const res = await callBackend('eliminarGuardia', { idGuardia: idGuardia });

   if(res && res.status === "SUCCESS") {
      body.innerHTML = `
        <div class="p-5 text-center animate__animated animate__zoomIn">
          <i class="fa-solid fa-circle-check text-success fa-4x mb-3"></i>
          <h4 class="text-dark fw-bold">Guardia Eliminada</h4>
          <p class="text-muted small">El registro ha sido purgado del sistema.</p>
        </div>`;
      
      setTimeout(() => {
          const modalInstance = bootstrap.Modal.getInstance(document.getElementById('modalGuardia'));
          if (modalInstance) modalInstance.hide();
          cargarDatos();
      }, 1500);

   } else {
      alert("Error al purgar registro: " + (res ? res.message : "Fallo de comunicación"));
      cargarDatos();
   }
}

function escapeHTML(str) {
  return str ? str.toString().replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  ) : '';
}

async function descargarManifiestoPdf(idGuardia) {
  if (!idGuardia) return;
  
  const res = await callBackend('descargarManifiestoPDF', { idGuardia: idGuardia });
  if (res && res.status === "SUCCESS" && res.base64) {
    const link = document.createElement('a');
    link.href = 'data:application/pdf;base64,' + res.base64;
    link.download = res.fileName || `ManifiestoCF_${idGuardia}.pdf`;
    link.click();
  } else {
    alert("No se pudo generar el documento PDF: " + (res ? res.message : "Error de red"));
  }
}

function construirModalEslabon(guardia, colorClass) {
   const modalElem = document.getElementById('modalGuardia');
   if (!modalElem) return;
   const modal = bootstrap.Modal.getOrCreateInstance(modalElem);
   const body = document.getElementById('modalGuardiaBody');
   let btnInscribir = document.getElementById('btnInscribirse');
   
   const footer = document.getElementById('modalGuardiaFooter');
   if (footer) footer.style.display = 'flex';
   
   if (btnInscribir) {
      const nuevoBtn = btnInscribir.cloneNode(true);
      if (btnInscribir.parentNode) {
        btnInscribir.parentNode.replaceChild(nuevoBtn, btnInscribir);
      }
      btnInscribir = nuevoBtn;
      btnInscribir.style.display = "block"; 
   }
   
   const esLleno = (colorClass === 'guardia-azul');
   const esPasado = (colorClass === 'guardia-gris');
   const emailLogueado = window.sesionUsuario ? window.sesionUsuario.email.toLowerCase().trim() : "";
   
   const yaInscrito = guardia.correosInscritos && guardia.correosInscritos.some(str => str.toLowerCase().includes(emailLogueado));

   let html = `
       <h5 class="text-center mb-3">Guardia Programada: <strong>${guardia.fechaStr}</strong></h5>
       <div class="alert ${guardia.tieneTransporte ? 'alert-success' : 'alert-warning'} text-center py-2">
           <i class="fa-solid fa-bus me-2"></i>Estatus de Transporte: <strong>${guardia.tieneTransporte ? 'Confirmado' : 'Sin unidad asignada'}</strong>
       </div>
       <h6 class="mt-3 border-bottom pb-2">Desglose de Especialidades Requeridas</h6>
       <p class="small text-muted mb-2">Cobertura actual: ${guardia.voluntariosInscritos || 0} inscritos.</p>
       <ul class="list-group list-group-flush mb-3">
   `;
   
   if(guardia.detallesRequeridos && guardia.detallesRequeridos.length > 0) {
      guardia.detallesRequeridos.forEach(req => {
          html += `<li class="list-group-item d-flex justify-content-between align-items-center px-0">
                      <span><i class="fa-solid fa-user-doctor text-secondary me-2"></i>${req.especialidad}</span>
                      <span class="badge bg-secondary rounded-pill">${req.cantidad} vacantes</span>
                   </li>`;
      });
   } else {
      html += `<li class="list-group-item text-muted px-0">Sin especificaciones técnicas detalladas.</li>`;
   }
   html += `</ul>`;
   
   if (esPasado) {
       html += `<div class="alert alert-secondary text-center mt-3 mb-0 small"><i class="fa-solid fa-clock-rotate-left me-1"></i> Este turno operativo ya finalizó.</div>`;
       if(btnInscribir) {
          btnInscribir.disabled = true;
          btnInscribir.className = "btn btn-secondary w-100";
          btnInscribir.innerText = "Guardia Finalizada";
       }
   } else if (yaInscrito) {
       html += `<div class="alert alert-success text-center mt-3 mb-0 animate__animated animate__pulse animate__infinite animate__slower"><i class="fa-solid fa-circle-check me-1"></i> Usted ya se encuentra postulado.</div>`;
       if(btnInscribir) {
          btnInscribir.disabled = false;
          btnInscribir.className = "btn btn-danger w-100 shadow-sm";
          btnInscribir.innerHTML = '<i class="fa-solid fa-user-minus me-1"></i> Darme de baja en esta guardia';
          btnInscribir.onclick = () => procesarRetiroDirecto(emailLogueado, guardia.id, btnInscribir, modal);
       }
   } else if (esLleno) {
       html += `<div class="alert alert-info text-center mt-3 mb-0"><i class="fa-solid fa-lock me-1"></i> El cupo operativo se encuentra al 100%.</div>`;
       if(btnInscribir) {
          btnInscribir.disabled = true;
          btnInscribir.className = "btn btn-secondary w-100";
          btnInscribir.innerText = "Cupo Completo";
       }
   } else {
       if(btnInscribir) {
          btnInscribir.disabled = false;
          btnInscribir.className = "btn btn-primary w-100 shadow-sm";
          btnInscribir.innerHTML = '<i class="fa-solid fa-user-plus me-1"></i> Inscribirme como Voluntario';
          btnInscribir.onclick = () => procesarInscripcionDirecta(emailLogueado, guardia.id, btnInscribir, modal);
       }
   }

   body.innerHTML = html;
   modal.show();
}

async function procesarInscripcionDirecta(email, idGuardia, btn, modal) {
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Registrando...';
  
  const res = await callBackend('asignarGuardia', { email: email, idGuardia: idGuardia });

  if (res && res.status === "SUCCESS") {
      const body = document.getElementById('modalGuardiaBody');
      body.innerHTML = `
          <div class="p-5 text-center animate__animated animate__zoomIn">
              <i class="fa-solid fa-circle-check text-success fa-5x mb-3"></i>
              <h4 class="text-dark fw-bold">¡Postulación Exitosa!</h4>
              <p class="text-muted small">Tu nombre ha sido agregado a la tripulación del día.</p>
          </div>`;
      
      setTimeout(() => {
          modal.hide();
          cargarDatos();
      }, 1800);
  } else {
      alert("Error: " + (res ? res.message : "Fallo de conexión"));
      btn.disabled = false;
      btn.innerText = "Reintentar inscripción";
  }
}

async function confirmarAsignacionTransporte(idGuardia) {
  const select = document.getElementById('selectChoferMision');
  const btn = document.getElementById('btnAsignarTransporte');
  if (!select || !btn) return;
  
  const idTransportista = select.value;

  if (idTransportista === "__NUEVO__" || idTransportista === "") {
     select.classList.add('is-invalid', 'border-danger');
     setTimeout(() => select.classList.remove('is-invalid', 'border-danger'), 2000);
     return;
  }
  
  btn.disabled = true;
  const textoOriginal = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
  
  const response = await callBackend('actualizarTransporteGuardia', {
    idGuardia: idGuardia,
    idTransportista: idTransportista
  });

  if (response && response.status === "SUCCESS") {
      btn.classList.replace('btn-primary', 'btn-success');
      btn.innerHTML = '<i class="fa-solid fa-check me-1"></i> ¡Asignado!';
      
      if (typeof cargarDatos === "function") cargarDatos(); 

      setTimeout(() => {
          btn.disabled = false;
          btn.classList.replace('btn-success', 'btn-primary');
          btn.innerHTML = textoOriginal;
      }, 2500);
  } else {
      btn.classList.replace('btn-primary', 'btn-danger');
      btn.innerHTML = '<i class="fa-solid fa-xmark me-1"></i> Error';
      setTimeout(() => {
          btn.disabled = false;
          btn.classList.replace('btn-danger', 'btn-primary');
          btn.innerHTML = textoOriginal;
      }, 3000);
  }
}

function procesarRetiroDirecto(email, idGuardia, btn, modal) {
  const body = document.getElementById('modalGuardiaBody');
  const guardiaActual = guardiasData.find(g => g.id === idGuardia);

  body.innerHTML = `
    <div class="text-center p-4 animate__animated animate__fadeIn">
      <div class="text-warning mb-3">
        <i class="fa-solid fa-user-minus fa-4x animate__animated animate__pulse animate__infinite"></i>
      </div>
      <h4 class="fw-bold text-dark">¿Retirar Postulación?</h4>
      <p class="text-muted small mb-4">Está a punto de desvincularse de la guardia del día <strong>${guardiaActual ? guardiaActual.fechaStr : idGuardia}</strong>. Su cupo quedará disponible para otro voluntario.</p>
      
      <div class="d-flex justify-content-center gap-2">
        <button type="button" class="btn btn-light border w-50 fw-bold shadow-sm" onclick="abrirModalGuardia(guardiasData.find(g => g.id === '${idGuardia}'), 'guardia-verde')">Cancelar</button>
        <button type="button" class="btn btn-danger w-50 fw-bold shadow-sm" onclick="ejecutarBajaDefinitiva('${email}', '${idGuardia}')">Sí, Retirarme</button>
      </div>
    </div>
  `;
}

async function ejecutarBajaDefinitiva(email, idGuardia) {
  const body = document.getElementById('modalGuardiaBody');
  body.innerHTML = `
    <div class="p-5 text-center animate__animated animate__fadeIn">
        <div class="spinner-border text-danger mb-3" style="width: 3rem; height: 3rem;" role="status"></div>
        <h5 class="fw-bold text-danger">Procesando baja...</h5>
        <p class="small text-muted">Sincronizando con la Red Operativa.</p>
    </div>`;

  const res = await callBackend('removerGuardia', { email: email, idGuardia: idGuardia });

  if (res && res.status === "SUCCESS") {
      body.innerHTML = `
          <div class="p-5 text-center animate__animated animate__zoomIn">
              <i class="fa-solid fa-circle-check text-success fa-5x mb-3"></i>
              <h4 class="text-dark fw-bold">Baja Confirmada</h4>
              <p class="text-muted small">Tu cupo ha sido liberado exitosamente.</p>
          </div>`;
      
      setTimeout(() => {
          const modalInstance = bootstrap.Modal.getInstance(document.getElementById('modalGuardia'));
          if (modalInstance) modalInstance.hide();
          cargarDatos(); 
      }, 1800);
  } else {
      alert("Error al procesar el retiro: " + (res ? res.message : "Error de red"));
      cargarDatos();
  }
}

function cancelarRegistroChoferRapido() {
  const select = document.getElementById('selectChoferMision');
  const contenedorForm = document.getElementById('subFormNuevoTransportista');
  if(select) select.value = "";
  if(contenedorForm) contenedorForm.classList.add('d-none');
}

async function guardarChoferRapido(idGuardia) {
  const nombreInput = document.getElementById('fastTraNombre');
  const telfInput = document.getElementById('fastTraTelefono');
  const contenedorForm = document.getElementById('subFormNuevoTransportista');
  
  if(!nombreInput || !nombreInput.value.trim()) {
    nombreInput.classList.add('is-invalid', 'border-danger');
    setTimeout(() => nombreInput.classList.remove('is-invalid', 'border-danger'), 2000);
    return;
  }

  const nombre = nombreInput.value.trim();
  const telefono = telfInput ? telfInput.value.trim() : "";

  const btnGuardar = contenedorForm ? contenedorForm.querySelector('.btn-success') : null;
  const textoOriginalBtn = btnGuardar ? btnGuardar.innerHTML : "";

  nombreInput.disabled = true;
  if(telfInput) telfInput.disabled = true;
  if(btnGuardar) {
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
  }

  const res = await callBackend('registrarTransportistaRapido', {
    nombreEmpresa: nombre,
    telefono: telefono
  });

  if(res && res.status === "SUCCESS") {
     if(btnGuardar) btnGuardar.innerHTML = '<i class="fa-solid fa-check-double me-1"></i> ¡Registrado!';
     
     if (catalogoChoferes) {
       catalogoChoferes.push(res.nuevoTransportista);
     }
     renderizarSelectChoferes(catalogoChoferes || [res.nuevoTransportista], res.nuevoTransportista.id);
     
     setTimeout(() => {
         if(contenedorForm) contenedorForm.classList.add('d-none');
         nombreInput.value = "";
         if(telfInput) telfInput.value = "";
         nombreInput.disabled = false;
         if(telfInput) telfInput.disabled = false;
         if(btnGuardar) {
           btnGuardar.disabled = false;
           btnGuardar.innerHTML = textoOriginalBtn;
         }
     }, 1500);

  } else {
     if(btnGuardar) {
       btnGuardar.classList.replace('btn-success', 'btn-danger');
       btnGuardar.innerHTML = '<i class="fa-solid fa-xmark me-1"></i> Error';
     }
     setTimeout(() => {
         if(btnGuardar) {
           btnGuardar.disabled = false;
           btnGuardar.classList.replace('btn-danger', 'btn-success');
           btnGuardar.innerHTML = textoOriginalBtn;
         }
         nombreInput.disabled = false;
         if(telfInput) telfInput.disabled = false;
     }, 3000);
  }
}

async function poblarEspecialidadesGuardia() {
  const dl = document.getElementById('listaEspGuardia');
  if (!dl) return;
  
  if (cacheEspecialidadesGuardia) {
      dl.innerHTML = cacheEspecialidadesGuardia.map(e => `<option value="${e}">`).join('');
  } else {
      const res = await callBackend('obtenerEspecialidades', {});
      cacheEspecialidadesGuardia = res.especialidades || [];
      const dlTarget = document.getElementById('listaEspGuardia');
      if (dlTarget) {
          dlTarget.innerHTML = cacheEspecialidadesGuardia.map(e => `<option value="${e}">`).join('');
      }
  }
}

function abrirFichaDesdeGuardia(email) {
  if (typeof poolVoluntarios === 'undefined' || poolVoluntarios.length === 0) {
      alert("El directorio se está sincronizando en segundo plano. Por favor, intente en unos segundos.");
      return;
  }
  
  const vol = poolVoluntarios.find(v => v.email && v.email.toLowerCase() === email.toLowerCase());
  
  if (vol && typeof abrirFichaVoluntario === 'function') {
      abrirFichaVoluntario(vol.id);
  } else {
      alert("No se encontró el perfil detallado de este voluntario.");
  }
}

function lanzarConvocatoriaMasiva(idGuardia) {
   const body = document.getElementById('modalGuardiaBody');
   if (!body) return;
   
   body.innerHTML = `
     <div class="text-center p-4 animate__animated animate__fadeIn">
       <div class="text-primary mb-3">
         <i class="fa-solid fa-paper-plane fa-4x animate__animated animate__pulse animate__infinite" style="color: #6366f1;"></i>
       </div>
       <h4 class="fw-bold text-dark">Convocatoria Logística Masiva</h4>
       <p class="text-muted small mb-3">¿Desea enviar una invitación por correo a todos los eslabones aptos y verificados?</p>
       
       <div class="alert alert-info text-start small border-0 bg-light mb-4" style="border-left: 4px solid #6366f1 !important;">
          <i class="fa-solid fa-circle-info me-1" style="color: #6366f1;"></i> El sistema filtrará automáticamente a los voluntarios que no tengan envíos en las últimas 48 horas.
       </div>
       
       <div class="d-flex justify-content-center gap-2">
        <button type="button" class="btn btn-light border w-50 fw-bold shadow-sm" onclick="construirModalCoordinador(guardiasData.find(g => g.id === '${idGuardia}'))">Cancelar</button>
        <button type="button" class="btn btn-primary w-50 fw-bold shadow-sm" style="background-color: #6366f1; border-color: #6366f1;" onclick="ejecutarDespachoMasivoFinal('${idGuardia}')">Sí, Despachar</button>
       </div>
     </div>
   `;
}

async function ejecutarDespachoMasivoFinal(idGuardia) {
   const body = document.getElementById('modalGuardiaBody');
   if (!body) return;
   
   body.innerHTML = `
      <div class="p-5 text-center animate__animated animate__fadeIn">
          <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem; color: #6366f1 !important;" role="status"></div>
          <h5 class="fw-bold text-dark">Despachando Correos...</h5>
          <p class="small text-muted">Procesando y registrando marcas de envío.</p>
      </div>`;

   const res = await callBackend('enviarConvocatoriaMasiva', { idGuardia: idGuardia });

   if (res && res.status === "SUCCESS") {
       body.innerHTML = `
           <div class="p-5 text-center animate__animated animate__zoomIn">
               <i class="fa-solid fa-paper-plane text-primary fa-5x mb-3 animate__animated animate__bounceIn"></i>
               <h4 class="text-dark fw-bold">Convocatoria Despachada</h4>
               <p class="text-muted small">${res.message || 'Correos enviados exitosamente'}</p>
               <button class="btn btn-secondary btn-sm mt-3 px-4" data-bs-dismiss="modal">Entendido y Cerrar</button>
           </div>`;

       // INYECCIÓN RECUPERADA: Sincronizar cuota visual en el perfil del coordinador
       if (typeof sincronizarCuotaDeEnvios === "function") {
           sincronizarCuotaDeEnvios();
       }

       setTimeout(() => {
           const modalInstance = bootstrap.Modal.getInstance(document.getElementById('modalGuardia'));
           if (modalInstance) modalInstance.hide();
           cargarDatos(); 
       }, 3000);
       
   } else {
       body.innerHTML = `
           <div class="p-5 text-center animate__animated animate__headShake">
               <div class="text-danger mb-3">
                   <i class="fa-solid fa-lock-open fa-4x animate__animated animate__swing animate__infinite animate__slower"></i>
               </div>
               <h4 class="text-danger fw-bold">Límite de Envíos Alcanzado</h4>
               <p class="text-muted small mb-4">${res ? res.message : 'Google ha restringido los envíos automáticos por hoy.'}</p>
               <div class="d-flex justify-content-center gap-2">
                  <button class="btn btn-light border w-50 small" onclick="construirModalCoordinador(guardiasData.find(g => g.id === '${idGuardia}'))">Regresar</button>
                  <button class="btn btn-danger w-50 small shadow-sm" data-bs-dismiss="modal">Cerrar Consola</button>
               </div>
           </div>`;
   }
}

async function abrirInformeConvocadosHoy(btn) {
    let originalText = "";
    if (btn) {
        btn.disabled = true;
        originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Generando...';
    }

    try {
        // Llamada al backend para obtener los convocados del día
        const res = await callBackend('obtenerConvocadosHoy', {});
        
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }

        if (res && res.status === "SUCCESS") {
            // Aquí puedes inyectar los datos en el modal de guardia o mostrar una alerta/tabla
            alert("Reporte generado con éxito. Total convocados hoy: " + (res.total || 0));
        } else {
            alert("Información: " + (res ? res.message : "No hay convocados registrados para el día de hoy."));
        }
    } catch (e) {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
        console.error("Error al obtener reporte de convocados:", e);
        alert("No se pudo conectar con el servidor para generar el reporte.");
    }
}