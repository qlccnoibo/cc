/* Workdays mobile month/year picker V5.
   Does not modify attendance data; the existing input#workdaysMonth is
   authoritative and its change event drives the original statistics function. */
(function () {
  'use strict';
  var MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

  function initPicker() {
    var input = document.getElementById('workdaysMonth');
    if (!input || input.dataset.mobilePickerReady === 'yes') return;
    var parent = input.parentElement;
    if (!parent) return;
    input.dataset.mobilePickerReady = 'yes';

    var today = new Date();
    var currentMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.value)) input.value = currentMonth;

    var picker = document.createElement('span');
    picker.className = 'workdays-month-mobile';
    var month = document.createElement('select');
    month.setAttribute('aria-label','Chọn tháng thống kê');
    var year = document.createElement('select');
    year.setAttribute('aria-label','Chọn năm thống kê');
    MONTHS.forEach(function (name, i) {
      var op = document.createElement('option');
      op.value = String(i + 1).padStart(2, '0');
      op.textContent = name;
      month.appendChild(op);
    });
    picker.appendChild(month);
    picker.appendChild(year);
    parent.appendChild(picker);

    function addYear(y) {
      if (Array.prototype.some.call(year.options, function (o) {return o.value === String(y);})) return;
      var op = document.createElement('option');
      op.value = String(y);
      op.textContent = 'Năm ' + y;
      year.appendChild(op);
    }
    for (var y = today.getFullYear() - 15; y <= today.getFullYear() + 2; y++) addYear(y);
    function syncFromNative() {
      var m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(input.value);
      if (!m) return;
      addYear(Number(m[1]));
      month.value = m[2];
      year.value = m[1];
      syncDisabled();
    }
    function syncDisabled() {
      month.disabled = year.disabled = input.disabled ||
        (document.getElementById('workdaysPeriod') || {}).value === 'all';
    }
    function updateMonth() {
      if (month.disabled || year.disabled) return;
      var next = year.value + '-' + month.value;
      if (input.value !== next) {
        input.value = next;
        input.dispatchEvent(new Event('change', {bubbles: true}));
      }
    }
    month.addEventListener('change', updateMonth);
    year.addEventListener('change', updateMonth);
    input.addEventListener('change', syncFromNative);
    var period = document.getElementById('workdaysPeriod');
    if (period) period.addEventListener('change', function () {setTimeout(syncDisabled, 0);});
    syncFromNative();
  }

  // The Statistics tab is built dynamically each time it is rendered.
  // Observe for the specific input and attach each instance only once.
  function start() {
    initPicker();
    var root = document.getElementById('statsContent') || document.body;
    new MutationObserver(function () {initPicker();}).observe(root, {childList:true,subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  window.CHAMCONG_WORKDAYS_MONTH_UI_VERSION = '20261123-mobile-month-v5';
})();
