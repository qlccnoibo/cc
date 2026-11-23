/* Tổng công nhân viên - công/nghỉ giống tab Cá nhân; chỉ đọc */
(function () {
  'use strict';
  function getRecordsSafe() {
    return typeof L === 'function' ? L(REC_KEY, []) : [];
  }
  function formatWork(n) {
    return (Math.round(n * 100) / 100).toLocaleString('vi-VN', {maximumFractionDigits:2});
  }
  function employeeKey(s) {
    // Giữ nguyên mã nhân viên trong ngoặc để không gộp nhầm người trùng tên.
    return String(s || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN');
  }
  function nameLabel(s) {
    return typeof cleanEmployeeName === 'function' ? cleanEmployeeName(s) : String(s || '');
  }
  function normalizedShift(s) {
    return String(s || '').split('(')[0].trim().toLocaleLowerCase('vi-VN');
  }
  function htmlText(s) {
    return typeof escHtml === 'function' ? escHtml(String(s)) : String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function monthValue() {
    const input = document.getElementById('workdaysMonth');
    if (!input) return '';
    if (!input.value) {
      const d = new Date();
      input.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }
    return input.value;
  }
  function calculate(rows, month, all) {
    const grouped = new Map();
    const allEmployees = Array.isArray(emp) ? emp : [];
    const hidden = !isAdmin && typeof getHiddenEmployees === 'function' ? getHiddenEmployees() : [];
    const hiddenNames = new Set(allEmployees.filter(x => hidden.includes(x.id)).map(x => employeeKey(x.name)));
    // Người trong danh mục cũng hiển thị với 0 công (khi xem theo tháng).
    for (const person of allEmployees) {
      if (!person || !person.name || (!isAdmin && hidden.includes(person.id))) continue;
      const k = employeeKey(person.name);
      if (!grouped.has(k)) grouped.set(k, {name: person.name, hours:0, leave:0});
    }
    for (const r of rows) {
      if (!r || r.deleted || !r.employee || !/^\d{4}-\d{2}-\d{2}$/.test(String(r.date))) continue;
      if (!all && !String(r.date).startsWith(month)) continue;
      const k = employeeKey(r.employee);
      if (!isAdmin && hiddenNames.has(k)) continue;
      if (!grouped.has(k)) grouped.set(k, {name:r.employee,hours:0,leave:0});
      const item = grouped.get(k);
      const sh = normalizedShift(r.shift);
      if (!sh) continue;
      // Thống nhất với tab Cá nhân: cộng giờ của TẤT CẢ các bản ghi
      // theo getShiftHours(), không loại trùng chỉ vì cùng ngày/cùng ca.
      // Hai bản ghi 1/2 Ca hợp lệ trong cùng ngày = 8 giờ = 1 công.
      let hours = typeof getShiftHours === 'function' ? Number(getShiftHours(r.shift)) : 0;
      if (!Number.isFinite(hours) || hours < 0) hours = 0;
      item.hours += hours;
      // Tab Cá nhân đếm một lượt Nghỉ cho mỗi bản ghi trong phân bố ca.
      if (sh.includes('nghỉ') || sh.includes('off')) item.leave++;
    }
    return Array.from(grouped.values()).map(x => ({
      name:x.name, work:Math.round(x.hours/8*100)/100,
      hours:x.hours, leave:x.leave
    })).sort((a,b) => b.work-a.work || a.name.localeCompare(b.name,'vi'));
  }
  let lastExport = [];
  window.renderEmployeeWorkdays = function () {
    const result = document.getElementById('workdaysTable');
    const summary = document.getElementById('workdaysSummary');
    if (!result || !summary) return;
    const month = monthValue();
    const period = document.getElementById('workdaysPeriod').value;
    const all = period === 'all';
    const monthInput = document.getElementById('workdaysMonth');
    monthInput.disabled = all;
    const text = (document.getElementById('workdaysSearch').value || '').trim().toLocaleLowerCase('vi-VN');
    const strip = s => typeof removeAccents==='function' ? removeAccents(s) : s;
    const rows = calculate(getRecordsSafe(), month, all);
    const filtered = rows.filter(r => strip(r.name.toLocaleLowerCase('vi-VN')).includes(strip(text)));
    lastExport = filtered;
    const work = filtered.reduce((sum,r)=>sum+r.work,0);
    summary.textContent = `${filtered.length} nhân viên · ${formatWork(work)} công · ${all?'Toàn bộ dữ liệu đã tải':('Tháng '+month)}. Số liệu dựa trên dữ liệu đã đồng bộ trong thiết bị.`;
    let html = '<table class="workdays-table"><thead><tr><th>STT</th><th>Nhân viên</th><th class="workdays-number">Tổng công</th><th class="workdays-number">Ngày nghỉ</th></tr></thead><tbody>';
    filtered.forEach((r,i) => { html += `<tr><td>${i+1}</td><td>${htmlText(nameLabel(r.name))}</td><td class="workdays-number workdays-total">${formatWork(r.work)}</td><td class="workdays-number">${r.leave}</td></tr>`; });
    result.innerHTML = html + (filtered.length ? '</tbody></table>' : '<tr><td colspan="4" style="text-align:center">Không có nhân viên phù hợp</td></tr></tbody></table>');
  };
  window.refreshEmployeeWorkdaysMonth = async function () {
    const month = monthValue();
    const button = document.querySelector('#subTabEmployeeWorkdays button[onclick="refreshEmployeeWorkdaysMonth()"]');
    if (document.getElementById('workdaysPeriod').value === 'all') {
      if (typeof showAlert==='function') await showAlert('Chọn “Theo tháng” để tải và đối chiếu tháng cụ thể.');
      return;
    }
    if (button) button.disabled = true;
    try {
      if (typeof _fetchFirebaseMonth !== 'function') throw new Error('Hàm tải tháng chưa sẵn sàng');
      await _fetchFirebaseMonth(month, true);
      window.renderEmployeeWorkdays();
      if (typeof showAlert==='function') await showAlert('Đã đối chiếu dữ liệu tháng '+month+' từ Firebase.');
    } catch(e) {
      console.error('Lỗi tải tổng công:',e);
      if (typeof showAlert==='function') await showAlert('Chưa thể cập nhật Firebase: '+e.message);
    } finally { if (button) button.disabled = false; }
  };
  window.exportEmployeeWorkdaysCSV = function () {
    const lines = [['STT','Nhân viên','Tổng công','Ngày nghỉ']];
    lastExport.forEach((r,i)=>lines.push([i+1,r.name,r.work,r.leave]));
    const content = '\ufeff'+lines.map(cols=>cols.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const blob = new Blob([content], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href=url; a.download='tong_cong_nhan_vien_'+(monthValue() || 'all')+'.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  window.CHAMCONG_EMPLOYEE_WORKDAYS_VERSION='20261123-workdays-personal-v2';
})();
