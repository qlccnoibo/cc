/* Firebase usage dashboard V1.
 * Firebase official usage metrics are NOT available directly via public browser Firebase SDK.
 * Only user-entered official readings are displayed as Firebase usage.
 * The device-cache reading is separate, calculated locally without network requests.
 */
(function () {
  'use strict';
  var KEY = 'chamcong_firebase_usage_manual_v1';
  var SPARK_STORAGE_MB = 1024;
  var SPARK_DOWNLOAD_MB = 10240;
  var $ = function(id){return document.getElementById(id);};
  var fmt = function(value) {return Number(value).toLocaleString('vi-VN', {maximumFractionDigits:2});};
  var numberText = function(value) {return value == null ? 'Chưa có dữ liệu' : fmt(value) + ' MB';};
  function getSaved() {
    try {
      var x=JSON.parse(localStorage.getItem(KEY)||'null');
      if(x && typeof x==='object') return x;
    } catch(e) { console.warn('Không đọc được số liệu Firebase đã nhập:',e); }
    return {storage:null,week:null,month:null,date:null,days:[]};
  }
  function pct(n,max){return n == null ? 0 : Math.min(100,Math.max(0,n/max*100));}
  function isoToday(){
    var d=new Date();
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  }
  function daysFor(end){
    var base=new Date(String(end||isoToday())+'T12:00:00');
    if(!Number.isFinite(base.valueOf()))base=new Date();
    return Array.from({length:7},function(_,i){
      var d=new Date(base);d.setDate(base.getDate()-6+i);
      return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
    });
  }
  function drawChart(days) {
    var root=$('fu-chart');if(!root)return;
    root.replaceChildren();
    var values=days.filter(function(x){return x && x.value!=null && Number.isFinite(x.value);});
    if(!values.length){var empty=document.createElement('p');empty.className='fu-empty';empty.textContent='Chưa có số liệu từng ngày; bạn có thể nhập trong phần “Nhập số liệu”.';root.appendChild(empty);return;}
    var dates=days.map(function(x){return x.date;});
    var max=Math.max(1,...values.map(function(x){return x.value;}));
    var svgNS='http://www.w3.org/2000/svg';
    var svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox','0 0 700 205');svg.setAttribute('role','img');svg.setAttribute('aria-label','Biểu đồ lượt tải xuống từng ngày');
    function node(type,attrs,txt){var n=document.createElementNS(svgNS,type);Object.keys(attrs).forEach(function(k){n.setAttribute(k,attrs[k]);});if(txt!==undefined)n.textContent=txt;svg.appendChild(n);return n;}
    var base=167, top=20, start=45, step=100;
    for(var z=0;z<=3;z++){
      var y=base-z*(base-top)/3;
      node('line',{x1:35,y1:y,x2:685,y2:y,stroke:'#e2e8f0','stroke-width':1});
      node('text',{x:29,y:y+4,'text-anchor':'end',fill:'#64748b','font-size':11},fmt(max*z/3));
    }
    var path='';var previous=false;
    days.forEach(function(d,i){
      var x=start+step*i;
      node('text',{x:x,y:187,'text-anchor':'middle',fill:'#64748b','font-size':11},d.date.slice(8,10)+'/'+d.date.slice(5,7));
      if(d.value==null){previous=false;return;}
      var y=base-(d.value/max)*(base-top);
      path+=(previous?' L ':' M ')+x+' '+y;previous=true;
    });
    node('path',{d:path,stroke:'#2563eb','stroke-width':2.5,fill:'none','stroke-linecap':'round','stroke-linejoin':'round'});
    days.forEach(function(d,i){if(d.value==null)return;var x=start+step*i,y=base-(d.value/max)*(base-top);var dot=node('circle',{cx:x,cy:y,r:4,fill:'#2563eb'});var title=document.createElementNS(svgNS,'title');title.textContent=d.date+': '+fmt(d.value)+' MB';dot.appendChild(title);});
    root.appendChild(svg);
  }
  function render() {
    var v=getSaved();
    $('fu-storage').textContent=numberText(v.storage);
    $('fu-download-7d').textContent=numberText(v.week);
    $('fu-download-month').textContent=numberText(v.month);
    $('fu-storage-bar').style.width=pct(v.storage,SPARK_STORAGE_MB)+'%';
    $('fu-download-bar').style.width=pct(v.month,SPARK_DOWNLOAD_MB)+'%';
    $('fu-storage-caption').textContent='Spark: '+fmt(pct(v.storage,SPARK_STORAGE_MB))+'% của 1 GB lưu trữ';
    $('fu-download-caption').textContent=v.month==null ? 'Spark: 10 GB/tháng — chưa nhập số liệu' : 'Spark: '+fmt(pct(v.month,SPARK_DOWNLOAD_MB))+'% của 10 GB/tháng';
    $('fu-download-7d-caption').textContent='Tổng tải xuống trong 7 ngày, không phải tổng tháng';
    $('fu-updated').textContent=v.date ? 'Nguồn: số liệu bạn nhập từ Firebase Console, ngày '+v.date.split('-').reverse().join('/')+'. Dữ liệu không tự cập nhật; không phải số liệu live.' : 'Chưa nhập số liệu Firebase chính thức. Vào Realtime Database → Usage để lấy số liệu.';
    var times=daysFor(v.date);var mapped=times.map(function(date){
      var found=(v.days||[]).find(function(d){return d.date===date;});return {date:date,value:found?found.value:null};
    });
    drawChart(mapped);
  }
  function setForm() {
    var data=getSaved();$('fu-in-storage').value=data.storage==null?'':data.storage;
    $('fu-in-week').value=data.week==null?'':data.week;
    $('fu-in-month').value=data.month==null?'':data.month;
    $('fu-in-date').value=data.date||isoToday();
    updateDayInputs();
  }
  function updateDayInputs() {
    var d=getSaved();var root=$('fu-days');root.replaceChildren();
    daysFor($('fu-in-date').value).forEach(function(date){
      var row=document.createElement('label');row.textContent=date.slice(8,10)+'/'+date.slice(5,7)+' (MB)';
      var inp=document.createElement('input');inp.type='number';inp.min='0';inp.step='any';inp.inputMode='decimal';inp.dataset.day=date;
      var old=(d.days||[]).find(function(x){return x.date===date;});inp.value=old && old.value!=null ? old.value : '';
      row.appendChild(inp);root.appendChild(row);
    });
  }
  function parseField(id){
    var x=$(id).value.trim();if(x==='')return null;
    var v=Number(x);if(!Number.isFinite(v)||v<0)throw Error('Số liệu phải là số không âm.');return v;
  }
  async function measureLocal() {
    var root=$('fu-local-details'); if(!root)return;
    root.textContent='Đang đo dung lượng trên trình duyệt...';
    try {
      var rows=(typeof _recordsCache!=='undefined'&&Array.isArray(_recordsCache))?_recordsCache:[];
      var bytes=new Blob([JSON.stringify(rows)]).size;
      var est=navigator.storage&&navigator.storage.estimate?await navigator.storage.estimate():null;
      root.textContent=fmt(rows.length)+' bản ghi trong cache · JSON ~'+fmt(bytes/1048576)+' MiB'+(est && est.usage!=null?' · Tổng bộ nhớ origin ~'+fmt(est.usage/1048576)+' MiB':'');
    } catch(e){root.textContent='Không đo được dữ liệu cache trên trình duyệt này.';console.warn(e);}
  }
  function init(){
    if(!$('firebaseUsagePanel'))return;
    var projectId='';
    try { projectId=firebase.app().options.projectId||''; } catch(e){}
    if(projectId && /^[a-z0-9-]+$/i.test(projectId)){
      $('fu-console-link').href='https://console.firebase.google.com/project/'+encodeURIComponent(projectId)+'/database';
    }
    $('fu-edit-btn').addEventListener('click',function(){setForm();$('fu-entry-form').hidden=false;});
    $('fu-cancel').addEventListener('click',function(){$('fu-entry-form').hidden=true;$('fu-error').textContent='';});
    $('fu-in-date').addEventListener('change',updateDayInputs);
    $('fu-local-refresh').addEventListener('click',measureLocal);
    $('fu-entry-form').addEventListener('submit',function(e){
      e.preventDefault();$('fu-error').textContent='';
      try{
        var date=$('fu-in-date').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Ngày đo không hợp lệ.');
        var days=Array.from($('fu-days').querySelectorAll('input')).map(function(el){
          var raw=el.value.trim();var value=raw===''?null:Number(raw);
          if(value!=null&&(!Number.isFinite(value)||value<0))throw Error('Số tải theo ngày không hợp lệ.');
          return {date:el.dataset.day,value:value};
        });
        var result={storage:parseField('fu-in-storage'),week:parseField('fu-in-week'),month:parseField('fu-in-month'),date:date,days:days};
        localStorage.setItem(KEY,JSON.stringify(result));
        $('fu-entry-form').hidden=true;render();
      }catch(err){$('fu-error').textContent=err.message||'Không lưu được số liệu.';}
    });
    render();measureLocal();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
  window.CHAMCONG_FIREBASE_USAGE_VERSION='20261123-usage-v1';
})();
