/* OCR Smart Memory v2: reviewed aliases only; local IndexedDB, explicit Firebase sync. */
(function () {
  'use strict';
  var root = document.getElementById('employeeOcrPanel');
  if (!root) return;
  var file = document.getElementById('ocrEmployeeImage');
  var textBox = document.getElementById('ocrEmployeeText');
  var results = document.getElementById('ocrEmployeeResults');
  var status = document.getElementById('ocrEmployeeStatus');
  var scanBtn = document.getElementById('ocrEmployeeScan');
  var analyzeBtn = document.getElementById('ocrEmployeeAnalyze');
  var addBtn = document.getElementById('ocrEmployeeAdd');
  var preview = document.getElementById('ocrEmployeePreview');
  var candidates = [];
  var aliasMap = new Map();
  var memoryStore = (typeof localforage !== 'undefined') ? localforage.createInstance({
    name: 'ChamCongApp', storeName: 'ocr_alias_memory'
  }) : null;
  var memoryPanel = document.getElementById('ocrMemoryPanel');
  var memoryList = document.getElementById('ocrMemoryList');
  var memoryStatus = document.getElementById('ocrMemoryStatus');
  var pullBtn = document.getElementById('ocrMemoryPull');
  var pushBtn = document.getElementById('ocrMemoryPush');
  var memoryReady = false;
  var MAX_ALIASES = 2000;
  var syncPath = 'chamcong/ocr_aliases';
  function memorySay(message) { if (memoryStatus) memoryStatus.textContent = message; }
  function aliasKey(text) { return flat(text); }
  function memoryValid(a) {
    return !!a && typeof a === 'object' && typeof a.token === 'string' &&
      a.token.length >= 3 && a.token.length <= 120 &&
      typeof a.employeeId === 'string' && a.employeeId.length <= 120;
  }
  function stableKey(token) {
    // Safe RTDB path key, two 32-bit hashes to lower collision probability.
    var h1=2166136261, h2=5381;
    for (var i=0;i<token.length;i++) {
      h1=Math.imul(h1 ^ token.charCodeAt(i),16777619)>>>0;
      h2=(Math.imul(h2,33)^token.charCodeAt(i))>>>0;
    }
    return 'a'+h1.toString(16).padStart(8,'0')+h2.toString(16).padStart(8,'0');
  }
  function renderMemory() {
    if (!memoryList) return;
    memoryList.replaceChildren();
    var persons=new Map(roster().map(p=>[p.id,p]));
    var all=[...aliasMap.values()].sort((a,b)=>a.token.localeCompare(b.token));
    all.forEach(function(a) {
      var row=document.createElement('div');row.className='ocr-memory-item';
      var label=document.createElement('span');
      label.textContent=a.source+' → '+(persons.get(a.employeeId)?.name||'ID '+a.employeeId);
      var btn=document.createElement('button');btn.type='button';btn.className='btn btn-xs';
      btn.textContent='Xóa';btn.title='Chỉ xóa quy tắc trên thiết bị này';
      btn.addEventListener('click',async function() {
        if(!isAdmin) return;
        await memoryStore.removeItem(a.token);
        aliasMap.delete(a.token);renderMemory();
        memorySay('Đã xóa quy tắc trên thiết bị. Nếu đã đồng bộ lên Firebase, cần xử lý bản trên Firebase riêng.');
      });
      row.append(label,btn);memoryList.appendChild(row);
    });
    if(!all.length)memoryList.textContent='Chưa có quy tắc nào.';
    var n=document.getElementById('ocrMemoryCount');if(n)n.textContent=all.length+' quy tắc';
  }
  async function loadMemory() {
    if(!memoryStore){memorySay('Không có IndexedDB/localForage, không thể bật tính năng ghi nhớ.');return;}
    try {
      await memoryStore.iterate(function(value,key) {
        if(memoryValid(value) && key===value.token)aliasMap.set(key,value);
      });
      memoryReady=true;renderMemory();memorySay('Đã tải '+aliasMap.size+' quy tắc từ thiết bị.');
    } catch(e){console.warn('OCR memory init',e);memorySay('Không đọc được bộ nhớ OCR: '+e.message);}
  }
  function validForRoster(a) {
    var person=roster().find(p=>p.id===a.employeeId);
    return person||null;
  }
  async function remember(source,employeeId) {
    if(!memoryReady || !isAdmin)return false;
    var token=aliasKey(source);
    if(token.length<3||token.length>120)return false;
    if(!roster().some(p=>p.id===employeeId))return false;
    if(!aliasMap.has(token) && aliasMap.size>=MAX_ALIASES)throw new Error('Đã đạt giới hạn quy tắc ghi nhớ');
    var old=aliasMap.get(token);
    var a={source:source.trim().slice(0,120),token:token,employeeId:employeeId,
      count:(old&&old.employeeId===employeeId?Number(old.count||0):0)+1,
      updatedAt:Date.now()};
    await memoryStore.setItem(token,a);
    aliasMap.set(token,a);
    renderMemory();return true;
  }
  function requireFirebaseAdmin() {
    if(typeof isAdmin==='undefined'||!isAdmin)throw Error('Chỉ Admin được đồng bộ bộ nhớ OCR');
    if(typeof db==='undefined'||!db)throw Error('Chưa kết nối Firebase');
  }
  async function getRemoteMemory() {
    requireFirebaseAdmin();
    if(typeof firebaseAuthReady!=='undefined')await firebaseAuthReady;
    var snap=await db.ref(syncPath).once('value'), remote=new Map();
    snap.forEach(function(c){var a=c.val();if(memoryValid(a)&&stableKey(a.token)===c.key)remote.set(a.token,a);});
    return remote;
  }
  async function pullMemory() {
    if(!memoryReady)throw Error('Bộ nhớ OCR chưa sẵn sàng');
    var remote=await getRemoteMemory(), imported=0,conflicts=0;
    for(var a of remote.values()){
      if(!validForRoster(a))continue;
      var prev=aliasMap.get(a.token);
      if(prev && prev.employeeId!==a.employeeId){conflicts++;continue;}
      if(!prev && aliasMap.size>=MAX_ALIASES)break;
      if(!prev){await memoryStore.setItem(a.token,a);aliasMap.set(a.token,a);imported++;}
    }
    renderMemory();memorySay('Đã nhận '+imported+' quy tắc mới; '+conflicts+' xung đột được giữ nguyên để tránh chọn nhầm.');
    return {imported,conflicts};
  }
  async function pushMemory() {
    if(!memoryReady)throw Error('Bộ nhớ OCR chưa sẵn sàng');
    var remote=await getRemoteMemory(), updates={},newCount=0,conflicts=0;
    for(var a of aliasMap.values()) {
      if(!validForRoster(a))continue;
      var other=remote.get(a.token);
      if(other && other.employeeId!==a.employeeId){conflicts++;continue;}
      if(!other){updates[stableKey(a.token)]=a;newCount++;}
    }
    if(newCount)await db.ref(syncPath).update(updates);
    memorySay('Đã gửi '+newCount+' quy tắc mới; '+conflicts+' xung đột không bị ghi đè.');
    return {newCount,conflicts};
  }
  if(pullBtn)pullBtn.addEventListener('click',async function(){pullBtn.disabled=true;try{await pullMemory();evaluate();}catch(e){memorySay('Tải bộ nhớ thất bại: '+e.message);}finally{pullBtn.disabled=false;}});
  if(pushBtn)pushBtn.addEventListener('click',async function(){pushBtn.disabled=true;try{await pushMemory();}catch(e){memorySay('Gửi bộ nhớ thất bại: '+e.message);}finally{pushBtn.disabled=false;}});
  loadMemory();
  function say(t) { status.textContent = t; }
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
      .replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9.\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function flat(s) { return norm(s).replace(/\./g,'').replace(/\s/g,''); }
  function levenshtein(a, b) {
    var prev = Array.from({length:b.length+1},(_,i)=>i), curr;
    for (var i=1;i<=a.length;i++) {
      curr=[i];
      for(var j=1;j<=b.length;j++) curr[j]=Math.min(curr[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      prev=curr;
    }
    return prev[b.length];
  }
  function similarity(a,b) {
    var x=flat(a), y=flat(b);
    if (!x || !y) return 0;
    if (x===y) return 1;
    var base=1-levenshtein(x,y)/Math.max(x.length,y.length);
    var wa=norm(a).split(' '),wb=norm(b).split(' ');
    var initials=(parts)=>parts.map(p=>p[0]||'').join('');
    if (initials(wa)===initials(wb) && wa.length>1 && wb.length>1) base=Math.max(base,.78);
    return base;
  }
  function roster() {
    if (typeof emp === 'undefined' || !Array.isArray(emp)) return [];
    return emp.filter(e=>e&&e.name).map(e=>({id:String(e.id),name:String(e.name),label:typeof cleanEmployeeName==='function'?cleanEmployeeName(e.name):e.name}));
  }
  function linesFromRaw(raw) {
    var pieces=String(raw||'').split(/\r?\n|[,;|\t]+/).map(s=>s.trim()).filter(Boolean);
    var res=[];
    pieces.forEach(function(p){
      // Try full line plus windows of 2-5 tokens, for screenshots with adjacent columns.
      var words=p.split(/\s+/).filter(Boolean);
      if (words.length>1 && words.length<=8) res.push(p);
      if (words.length>2) for(var size=2;size<=Math.min(5,words.length);size++)
        for(var i=0;i+size<=words.length;i++) res.push(words.slice(i,i+size).join(' '));
      if (words.length===1 && words[0].length>=4) res.push(p);
    });
    return [...new Set(res)].slice(0,700);
  }
  function evaluate() {
    var people=roster();
    candidates=[];
    var source=linesFromRaw(textBox.value);
    var byId=new Map();
    source.forEach(function(chunk){
      var normalized=norm(chunk);
      if (normalized.length<3 || /^\d+$/.test(normalized)) return;
      var learned=aliasMap.get(aliasKey(chunk));
      var learnedPerson=learned&&people.find(p=>p.id===learned.employeeId);
      var ranked=people.map(p=>({person:p,score:similarity(chunk,p.label),learned:!!(learnedPerson&&p.id===learnedPerson.id)}))
        .sort((a,b)=>Number(b.learned)-Number(a.learned)||b.score-a.score).slice(0,3);
      if (!ranked.length || (!ranked[0].learned && ranked[0].score<.72)) return;
      var best=ranked[0];
      var old=byId.get(best.person.id);
      if (old && old.bestScore>=best.score && !ranked[0].learned) return;
      // Learned aliases are suggestions, not irrevocable decisions.
      byId.set(best.person.id,{chunk:chunk,bestScore:best.score,options:ranked,learned:!!ranked[0].learned});
    });
    candidates=[...byId.values()].sort((a,b)=>b.bestScore-a.bestScore).slice(0,150);
    results.replaceChildren();
    candidates.forEach(function(c,idx){
      var row=document.createElement('div');row.className='ocr-person-row';
      var check=document.createElement('input');check.type='checkbox';check.className='ocr-person-check';
      check.setAttribute('aria-label','Chọn tên OCR '+c.chunk);
      var content=document.createElement('div');content.className='ocr-person-info';
      var src=document.createElement('small');src.textContent='Ảnh: '+c.chunk;
      var sel=document.createElement('select');sel.className='ocr-person-select';
      c.options.forEach(function(opt){
        var option=document.createElement('option');option.value=opt.person.id;
        option.textContent=opt.person.label+(opt.learned?' ★ đã ghi nhớ':' — '+Math.round(opt.score*100)+'%');sel.appendChild(option);
      });
      var score=c.options[0].score;
      var margin=c.options.length>1?score-c.options[1].score:1;
      if (c.learned) src.textContent+=' • Có gợi ý đã ghi nhớ (cần kiểm tra)';
      if (score >= .94 && margin>=.15 && !c.learned) check.checked=true;
      else if (margin<.08 && !c.learned) src.textContent+=' • Trùng/gần giống: hãy kiểm tra';
      var rememberLabel=document.createElement('label');rememberLabel.className='ocr-remember-choice';
      var rememberCheck=document.createElement('input');rememberCheck.type='checkbox';rememberCheck.className='ocr-remember-check';
      rememberLabel.append(rememberCheck,document.createTextNode(' Ghi nhớ tên ảnh → nhân viên đã xác nhận'));
      content.append(src,sel,rememberLabel);row.append(check,content);results.appendChild(row);
    });
    say('Tìm thấy '+candidates.length+' tên có khả năng khớp. Kiểm tra từng tên và ô tích trước khi thêm.');
    addBtn.disabled=!candidates.length;
  }
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    if (window.__employeeTesseractPromise) return window.__employeeTesseractPromise;
    window.__employeeTesseractPromise=new Promise(function(resolve,reject){
      var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload=resolve;s.onerror=()=>reject(new Error('Không tải được thư viện OCR. Kiểm tra mạng hoặc CDN.'));
      document.head.appendChild(s);
    });
    return window.__employeeTesseractPromise;
  }
  var blobUrl='';
  file.addEventListener('change',function(){
    if(blobUrl) URL.revokeObjectURL(blobUrl);
    textBox.value='';results.replaceChildren();candidates=[];addBtn.disabled=true;
    var img=file.files&&file.files[0];
    if(!img){preview.removeAttribute('src');preview.hidden=true;return;}
    if(!img.type.startsWith('image/') || img.size>12*1024*1024){
      say('Chỉ chọn ảnh JPG/PNG/HEIC được trình duyệt hỗ trợ, tối đa 12 MB.');file.value='';return;
    }
    blobUrl=URL.createObjectURL(img);preview.src=blobUrl;preview.hidden=false;
    say('Đã chọn ảnh. Nhấn “Nhận diện chữ” để bắt đầu.');
  });
  scanBtn.addEventListener('click',async function(){
    var f=file.files&&file.files[0];
    if(!f){say('Hãy chọn ảnh danh sách nhân viên trước.');return;}
    scanBtn.disabled=true;analyzeBtn.disabled=true;addBtn.disabled=true;
    var worker;
    try {
      say('Đang tải bộ nhận diện tiếng Việt và tiếng Anh. Lần đầu cần kết nối mạng...');
      await loadTesseract();
      worker=await Tesseract.createWorker('vie+eng');
      say('Đang đọc chữ từ ảnh...');
      var out=await worker.recognize(f);
      textBox.value=out.data.text||'';
      evaluate();
      if(!textBox.value.trim())say('Không đọc được chữ. Thử ảnh rõ hơn hoặc nhập tên vào ô văn bản.');
    } catch(e) {
      console.error('OCR error',e);say('Không thể nhận diện ảnh: '+(e.message||e));
    } finally {
      if(worker)try{await worker.terminate();}catch(_){}
      scanBtn.disabled=false;analyzeBtn.disabled=false;
    }
  });
  analyzeBtn.addEventListener('click',evaluate);
  addBtn.addEventListener('click',async function(){
    if(typeof isAdmin!=='undefined' && !isAdmin){say('Chỉ Admin được chọn nhân viên để chấm công.');return;}
    var people=roster(); var map=new Map(people.map(p=>[p.id,p]));
    var chosen=[];var toLearn=[];results.querySelectorAll('.ocr-person-row').forEach(function(row,index){
      if(!row.querySelector('.ocr-person-check').checked)return;
      var p=map.get(row.querySelector('.ocr-person-select').value);
      if(p && !chosen.some(item=>item.id===p.id)) chosen.push(p);
      if(p && row.querySelector('.ocr-remember-check').checked && candidates[index])
        toLearn.push({source:candidates[index].chunk,id:p.id});
    });
    if(!chosen.length){say('Chưa tích tên nào để thêm.');return;}
    var existing=new Set((typeof selectedEmployees!=='undefined'?selectedEmployees:[]).map(n=>norm(n)));
    var n=0;
    chosen.forEach(function(p){if(!existing.has(norm(p.name))){selectedEmployees.push(p.name);existing.add(norm(p.name));n++;}});
    if(typeof _bulkMissingDate!=='undefined')_bulkMissingDate='';
    if(typeof renderSelectedEmployees==='function')renderSelectedEmployees();
    var learnedCount=0;
    for(var pair of toLearn) {
      try { if(await remember(pair.source,pair.id))learnedCount++; }
      catch(e){console.warn('Không lưu được quy tắc OCR',e);}
    }
    say('Đã thêm '+n+' nhân viên ('+(chosen.length-n)+' đã có); đã ghi nhớ '+learnedCount+' lựa chọn được tích. Kiểm tra danh sách trước khi lưu.');
    var box=document.getElementById('selectedEmployees');if(box)box.scrollIntoView({behavior:'smooth',block:'center'});
  });
  window.CHAMCONG_EMPLOYEE_OCR_VERSION='20261123-ocr-smart-memory-v2';
  window.CHAMCONG_OCR_MEMORY_DIAGNOSTICS=function(){return {ready:memoryReady,rules:aliasMap.size,storage:'IndexedDB',firebaseSync:'manual'};};
})();
