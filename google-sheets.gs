/*************************************************************
 * Plan de potencias · Equipo Guido  ↔  Google Sheets
 * 1. Pega TODO este código en Extensiones › Apps Script.
 * 2. Cambia la CLAVE de abajo por la que te dio Claude.
 * 3. Implementar › Nueva implementación › Aplicación web
 *    · Ejecutar como: Yo   · Quién tiene acceso: Cualquier usuario
 * 4. Copia la URL que termina en /exec y pégala en la app.
 *************************************************************/
const CLAVE = 'PON_AQUI_LA_CLAVE';
const HOJA = 'Clientes';
const COLS = ['Nombre','Dirección','NAP','# Hilo','Antes ONU (dBm)','Antes OLT (dBm)','Estado','Fecha','Técnico',
              'Después ONU (dBm)','Después OLT (dBm)','Mejora ONU (dB)','Mejora OLT (dB)','Notas','ID app'];
const RESULTADO = ['Estado','Fecha','Técnico','Después ONU (dBm)','Después OLT (dBm)','Mejora ONU (dB)','Mejora OLT (dB)','Notas','ID app'];

function hoja_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(HOJA) || ss.insertSheet(HOJA);
  if (sh.getLastRow() === 0) {
    sh.appendRow(COLS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, COLS.length).setFontWeight('bold').setBackground('#1f1147').setFontColor('#ffffff');
  }
  const h = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
  COLS.forEach(c => { if (h.indexOf(c) < 0) { h.push(c); sh.getRange(1, h.length).setValue(c).setFontWeight('bold'); } });
  return { sh, h };
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function clave_(n, nap) {
  n = String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*?\)/g, ' ')
      .replace(/[_\-–]/g, ' ').replace(/[^a-zñ ]/g, ' ').replace(/\s+/g, ' ').trim();
  return n ? n + '|' + String(nap || '').toUpperCase().replace(/\s/g, '').replace(/^([A-Z]+)0*(\d+)-/, (m, a, b) => a + ('0' + Number(b)).slice(-2) + '-') : '';
}

// La app lee la hoja (clientes nuevos que agregue la secretaria).
function doGet(e) {
  if ((e.parameter.k || '') !== CLAVE) return json_({ error: 'clave incorrecta' });
  const { sh, h } = hoja_();
  const n = sh.getLastRow();
  const v = n > 1 ? sh.getRange(2, 1, n - 1, h.length).getDisplayValues() : [];
  return json_({ ok: true, cols: h, rows: v.map((r, i) => ({ fila: i + 2, datos: r })) });
}

// La app escribe cómo quedó cada cliente y agrega los que falten.
function doPost(e) {
  const b = JSON.parse(e.postData.contents || '{}');
  if (b.k !== CLAVE) return json_({ error: 'clave incorrecta' });
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const { sh, h } = hoja_();
    const ci = c => h.indexOf(c);
    const n = sh.getLastRow();
    const v = n > 1 ? sh.getRange(2, 1, n - 1, h.length).getValues() : [];
    const porId = {}, porClave = {};
    v.forEach((r, i) => {
      const id = String(r[ci('ID app')] || ''); if (id) porId[id] = i + 2;
      const k = clave_(r[ci('Nombre')], r[ci('NAP')]); if (k && !porClave[k]) porClave[k] = i + 2;
    });
    let agregados = 0, actualizados = 0;
    (b.items || []).forEach(it => {
      let fila = porId[it.id];
      if (!fila && it.fila && it.fila >= 2 && it.fila - 2 < v.length && clave_(v[it.fila - 2][ci('Nombre')], '') === clave_(it.nombre, '')) fila = it.fila;
      if (!fila) fila = porClave[clave_(it.nombre, it.nap)];
      const val = { 'Estado': it.estado, 'Fecha': it.fecha, 'Técnico': it.tecnico, 'Después ONU (dBm)': it.dOnu, 'Después OLT (dBm)': it.dOlt,
                    'Mejora ONU (dB)': it.mOnu, 'Mejora OLT (dB)': it.mOlt, 'Notas': it.nota, 'ID app': it.id };
      if (!fila) {
        const row = h.map(() => '');
        Object.assign(val, { 'Nombre': it.nombre, 'Dirección': it.direccion, 'NAP': it.nap, '# Hilo': it.hilo, 'Antes ONU (dBm)': it.onu, 'Antes OLT (dBm)': it.olt });
        for (const k in val) { const c = ci(k); if (c >= 0) row[c] = val[k] == null ? '' : val[k]; }
        sh.appendRow(row); agregados++;
        porId[it.id] = sh.getLastRow();
      } else {
        for (const k of RESULTADO) { const c = ci(k); if (c >= 0) sh.getRange(fila, c + 1).setValue(val[k] == null ? '' : val[k]); }
        actualizados++;
      }
    });
    return json_({ ok: true, agregados, actualizados });
  } finally { lock.releaseLock(); }
}
