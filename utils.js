/* ============================================================
   utils.js — CHỈ chứa getLocalDateStr
   app.js đã có sẵn: escHtml, formatDate, removeAccents, 
   cleanEmployeeName → KHÔNG định nghĩa lại để tránh trùng lặp
   ============================================================ */

/**
 * Lấy ngày địa phương dạng YYYY-MM-DD
 * An toàn, KHÔNG override Date.prototype.toISOString
 */
function getLocalDateStr(date) {
  if (!date) date = new Date();
  if (typeof date === 'string') return date.split('T')[0];
  var offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split('T')[0];
}

console.log('✅ utils.js loaded — getLocalDateStr ready');