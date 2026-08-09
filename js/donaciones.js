/* ==========================================================================
   MÓDULO DE DONACIONES E INTERACTIVIDAD
   Cadena de Favores Venezuela
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function() {
  // Inicialización de componentes globales si aplica en esta vista
  if (typeof sincronizarHeaderGlobal === 'function') {
    sincronizarHeaderGlobal();
  }
});

/**
 * Función para formatear y copiar los datos de pago móvil al portapapeles
 * Formato requerido por las apps bancarias:
 * Banco: 0102 - Venezuela
 * Teléfono.: 04244499538
 * Cédula: 17903919
 */
function copiarPagoMovil(idContenedor, btnElement) {
  const contenedor = document.getElementById(idContenedor);
  if (!contenedor) return;

  const bancoTexto = contenedor.querySelector('.val-banco')?.innerText.trim() || "";
  const telfTexto = contenedor.querySelector('.val-telf')?.innerText.trim() || "";
  const cedulaTexto = contenedor.querySelector('.val-cedula')?.innerText.trim() || "";

  // Extraer el código del banco entre paréntesis (ej: "0102" de "Banco de Venezuela (0102)")
  const matchBanco = bancoTexto.match(/\((\d+)\)/);
  const codigoBanco = matchBanco ? matchBanco[1] : "";
  const nombreBancoSimple = bancoTexto.split('(')[0].trim();
  const bancoFormateado = `${codigoBanco} - ${nombreBancoSimple}`;

  // Limpiar caracteres no numéricos para el portapapeles bancario
  const telfLimpio = telfTexto.replace(/[^0-9]/g, '');
  const cedulaLimpiada = cedulaTexto.replace(/[^0-9]/g, '');

  const textoCopiar = `Banco: ${bancoFormateado}\nTeléfono: ${telfLimpio}\nCédula: ${cedulaLimpiada}`;

  navigator.clipboard.writeText(textoCopiar).then(() => {
    const originalHTML = btnElement.innerHTML;
    btnElement.innerHTML = `<i class="fa-solid fa-check me-1"></i> ¡Copiado al Portapapeles!`;
    btnElement.classList.remove('btn-outline-primary', 'btn-outline-success');
    btnElement.classList.add('btn-dark');
    
    setTimeout(() => {
      btnElement.innerHTML = originalHTML;
      btnElement.classList.remove('btn-dark');
      if (idContenedor.toLowerCase().includes('bdv')) {
        btnElement.classList.add('btn-outline-primary');
      } else {
        btnElement.classList.add('btn-outline-success');
      }
    }, 2000);
  }).catch(err => {
    console.error('Error al copiar al portapapeles: ', err);
  });
}

/**
 * Función para copiado simple de textos independientes (Zelle, PayPal, etc.)
 */
function copiarTextoSimple(texto, btnElement) {
  navigator.clipboard.writeText(texto).then(() => {
    const originalHTML = btnElement.innerHTML;
    btnElement.innerHTML = `<i class="fa-solid fa-check text-success"></i>`;
    setTimeout(() => {
      btnElement.innerHTML = originalHTML;
    }, 2000);
  }).catch(err => {
    console.error('Error al copiar texto simple: ', err);
  });
}