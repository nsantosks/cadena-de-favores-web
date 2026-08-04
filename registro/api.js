// ==========================================================================
// CONECTOR API: voluntariadocdfvzla.org -> Google Apps Script Backend
// ==========================================================================

const APPS_SCRIPT_URL = "https://script.google.com/a/gammalielanalytics.com/macros/s/AKfycbzOk2IqOw_nLcvgNL8v-vSJpC2m5nhJ0RMk1AMOnrbkHRMG-lcMUd_HRF8R4zgXzp8/exec";
const CLIENT_SECRET_KEY = "CDF_Vzla_2026_Secure_Key_#X9"; // Debe coincidir exactamente con la de Apps Script

async function callBackend(action, payload = {}) {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({ 
        clientKey: CLIENT_SECRET_KEY, 
        action: action, 
        payload: payload 
      })
    });

    return await response.json();
  } catch (error) {
    console.error(`[API ERROR] Fallo al ejecutar '${action}':`, error);
    return { status: "ERROR", message: "Error de comunicación con el backend." };
  }
}