const VER='1.0';
const MODE=window.ORIENT_MODE==='public'?'public':'admin';
const SRC=(()=>{try{return(new URLSearchParams(location.search).get('src')||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,30)}catch(e){return''}})();
const REGIONS=['North America','Latin America','Europe','Africa','Middle East','India / South Asia','South-East Asia','East Asia','Australia & Oceania'];
const REG_EXTRA=['Somewhere specific','Not sure'];
const EAST=new Set(['South-East Asia','East Asia']);
const ATTN_ANSWER='Australia & Oceania';
const CUES=['Colour','Motif / imagery','Font','Text / content','Writing in another language','Materials & textures','Something else'];
const AGES=['18–24','25–34','35–44','45–54','55+'];
const DESIGN=['No','I study design','I work in design'];
const MEDIA=['Never','Sometimes','Weekly','Daily'];
const YN=['Yes','No'];
const STATES=['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman & Nicobar','Chandigarh','Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'];
const GROUPS={trad:'Traditional',min:'Minimal',filler:'Filler',decoy:'Decoy',realea:'Real East Asia',outside:'Outside India',reverse:'Reverse decoy',none:'No group'};
const GKEYS=Object.keys(GROUPS);
const DEF_CODES=`C-RED Red
C-GOLD Gold / yellow
C-BLK Black lacquer
C-PAST Pastels
C-WHT White / neutral minimal
M-DRAG Dragon
M-LANT Lantern
M-PAGO Pagoda / curved roof
M-WAVE Wave / cloud pattern
M-BLOS Cherry blossom
M-BAMB Bamboo
M-MASC Cute mascot / character
M-FOOD Chopsticks / bowls / noodles
F-BRUSH Brush lettering
F-WONT Wonton / chop-suey type
F-GEOS Geometric sans wordmark
T-NAME East Asian-sounding name
T-MENU Dish words
W-HAN Chinese characters
W-KANA Japanese kana
W-HANG Hangul
X-WOOD Light wood
X-LACQ Lacquer / gloss
X-PAPR Paper / rice-paper screens
X-NEON Neon
META-CHAIN Chain or franchise (not shown to participants)
META-LUXE Upscale pan-Asian dining
META-EACORP East Asian company, not East Asian-coded
META-OTHERFOREIGN Other foreign theme (Arabian, Mexican, Italian…)
META-NE Northeast-themed name or ownership`;
const MAXTAPS=3;
const app=document.getElementById('app'),modalEl=document.getElementById('modal');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=()=>new Date().toISOString();
const now=()=>performance.now();
const ms=v=>v==null?'':Math.round(v);

/* ---------- storage (IndexedDB on this device) ---------- */
let dbp;
function idb(){if(dbp)return dbp;dbp=new Promise((res,rej)=>{let r;try{r=indexedDB.open('orient-field',3)}catch(e){rej(e);return}
r.onupgradeneeded=()=>{const d=r.result;['images','participants','trials','meta'].forEach(n=>{if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:'id'})});
  if(!d.objectStoreNames.contains('log'))d.createObjectStore('log',{keyPath:'seq',autoIncrement:true});
  if(!d.objectStoreNames.contains('outbox'))d.createObjectStore('outbox',{keyPath:'k',autoIncrement:true});
  if(!d.objectStoreNames.contains('contacts'))d.createObjectStore('contacts',{keyPath:'k',autoIncrement:true})};
r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});return dbp}
async function tx(st,mode,fn){const d=await idb();return new Promise((res,rej)=>{const t=d.transaction(st,mode);let out;const r=fn(t.objectStore(st));if(r)r.onsuccess=()=>{out=r.result};t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})}
let MEM=null,memK=1;
async function ready(){if(MEM)return;try{await idb()}catch(e){MEM={}}}
const memS=st=>(MEM[st]=MEM[st]||new Map());
const memKey=(st,v)=>{const kp=st==='log'?'seq':(st==='outbox'||st==='contacts')?'k':'id';if(v[kp]==null)v[kp]=memK++;return v[kp]};
const put=async(st,v)=>{await ready();if(MEM){memS(st).set(memKey(st,v),v);return}return tx(st,'readwrite',s=>s.put(v))};
const get=async(st,k)=>{await ready();if(MEM)return memS(st).get(k);return tx(st,'readonly',s=>s.get(k))};
const all=async st=>{await ready();if(MEM)return[...memS(st).values()];return tx(st,'readonly',s=>s.getAll())};
const del=async(st,k)=>{await ready();if(MEM){memS(st).delete(k);return}return tx(st,'readwrite',s=>s.delete(k))};
const clearSt=async st=>{await ready();if(MEM){memS(st).clear();return}return tx(st,'readwrite',s=>s.clear())};
async function logA(action,detail){try{await put('log',{ts:iso(),pid:S?S.pid:'',action,detail:detail||''})}catch(e){}}

let SET={id:'settings',mode:'online',nMain:20,nBonus:10,bonus:true,order:'random',attn:true,recog:'recognise',endpoint:'',contact:'',inst:'',codes:DEF_CODES,lastExport:''};
let IMGS=[];const URLS={};
let S=null;   // active session
let T=null;   // current trial
const codeList=()=>SET.codes.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const m=/^(\S+)\s*(.*)$/.exec(l);return{code:m[1],label:m[2]||m[1]}});
const recogLabel=()=>SET.recog==='been'?'I\'ve been to this place':'I recognise this place';
async function loadImgs(){IMGS=(await all('images')).sort((a,b)=>a.idx-b.idx);
  for(const i of IMGS){let ch=false;if(i.set==='core'){i.set='main';ch=true}if(!i.group){i.group=i.filler?'filler':'none';ch=true}if(!i.tags){i.tags=[];ch=true}if(ch)await put('images',i);
    if(!URLS[i.id])URLS[i.id]=URL.createObjectURL(i.blob)}}
const vis=round=>IMGS.filter(i=>i.set===round&&!i.hidden);

/* ---------- sampling: pairs count once, one version per person; stratified by group ---------- */
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
// A unit is one "place": photos sharing a place name, or a redaction pair, count once and a person sees at most one of them.
const unitKey=i=>(i.place||'').trim()?'pl:'+i.place.trim().toLowerCase():(i.pair||i.id);
function allUnits(){const m=new Map();for(const i of IMGS.filter(x=>!x.hidden)){const k=unitKey(i);if(!m.has(k))m.set(k,{key:k,group:i.group||'none',items:[]});m.get(k).items.push(i)}
  return[...m.values()].map(u=>({...u,bonusOnly:u.items.every(i=>i.set==='bonus'),complex:u.items.some(i=>i.complex)}))}
function units(round){return allUnits().filter(u=>round==='bonus'?u.bonusOnly:!u.bonusOnly)}
// Weighted sampling without replacement (Efraimidis & Spirakis 2006): each unit gets key u^(1/w), take the largest.
const wpick=(list,n,wf)=>list.map(u=>({u,k:Math.pow(Math.random(),1/wf(u))})).sort((a,b)=>b.k-a.k).slice(0,n).map(x=>x.u);
const W_MAIN=u=>u.complex?0.5:1, W_BONUS=u=>(u.complex||u.bonusOnly)?2:1;
function sampleMain(n){let us=units('main');
  if(SET.order==='fixed')return us;
  if(n<us.length){const by={};us.forEach(u=>(by[u.group]=by[u.group]||[]).push(u));
    const ex=Object.keys(by).map(k=>{const q=n*by[k].length/us.length;return{k,f:Math.floor(q),r:q-Math.floor(q)}});
    let left=n-ex.reduce((s,e)=>s+e.f,0);ex.sort((a,b)=>b.r-a.r||Math.random()-.5).forEach(e=>{if(left>0){e.f++;left--}});
    us=[];ex.forEach(e=>us.push(...wpick(by[e.k],e.f,W_MAIN)))}
  return shuffle(us)}
function sampleBonus(n,usedKeys){if(SET.order==='fixed')return units('bonus');const pool=allUnits().filter(u=>!usedKeys.has(u.key));return shuffle(wpick(pool,n,W_BONUS))}
if(MODE==='admin')window.__orient={sampleMain:n=>sampleMain(n),sampleBonus:(n,k)=>sampleBonus(n,k),allUnits:()=>allUnits()};
const pickItem=u=>u.items[Math.floor(Math.random()*u.items.length)].id;
const prog=(i,n)=>n?Math.pow(Math.min(i,n)/n,.6):0; // fast early, slower late
const ATTN={id:'ATTN',attn:true,group:'attention',pair:'',ver:'',tags:[]};
function pickAttnImg(used){const pool=IMGS.filter(i=>!i.hidden&&!used.includes(i.id));const src=pool.length?pool:IMGS.filter(i=>!i.hidden);return src.length?src[Math.floor(Math.random()*src.length)].id:''}

/* ---------- modal ---------- */
function modal(html){modalEl.innerHTML=`<div class="dlg">${html}</div>`;modalEl.hidden=false}
function closeModal(){modalEl.hidden=true;modalEl.innerHTML=''}
function ask(title,body,okLabel,cancelLabel){return new Promise(res=>{modal(`<h3>${esc(title)}</h3>${body?`<p>${body}</p>`:''}<div class="row"><button class="btn" data-r="0">${esc(cancelLabel||'Cancel')}</button><button class="btn pri" data-r="1">${esc(okLabel||'OK')}</button></div>`);
  modalEl.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{closeModal();res(b.dataset.r==='1')})})}
function note(title,body){return ask(title,body,'OK','Close')}
function picker(title,opts,cur,cb){modal(`<h3>${esc(title)}</h3><input id="pq" type="text" placeholder="Type to search" autocomplete="off" aria-label="Search"><div class="plist" id="pl"></div><div class="row"><button class="btn" data-x>Cancel</button></div>`);
  const pl=document.getElementById('pl'),pq=document.getElementById('pq');
  const draw=()=>{const q=pq.value.trim().toLowerCase();const a=opts.filter(o=>o.toLowerCase().startsWith(q)),b=q?opts.filter(o=>!o.toLowerCase().startsWith(q)&&o.toLowerCase().includes(q)):[];
    pl.innerHTML=[...a,...b].map(o=>`<button class="pitem${o===cur?' on':''}" data-p="${esc(o)}">${esc(o)}</button>`).join('')||'<p style="padding:8px 12px">No match.</p>'};
  pq.oninput=draw;draw();
  pl.onclick=e=>{const t=e.target.closest('[data-p]');if(!t)return;closeModal();cb(t.dataset.p)};
  pq.onkeydown=e=>{if(e.key==='Enter'){const f=pl.querySelector('[data-p]');if(f){closeModal();cb(f.dataset.p)}}};
  modalEl.querySelector('[data-x]').onclick=closeModal;
  try{pq.focus()}catch(e){}}
function hold(el,cb){if(MODE==='public'||!el)return;let t=null;const stop=()=>{clearTimeout(t);t=null};el.addEventListener('pointerdown',()=>{stop();t=setTimeout(()=>{t=null;cb()},2000)});['pointerup','pointerleave','pointercancel'].forEach(ev=>el.addEventListener(ev,stop))}

/* ---------- rows (same shape for CSV and for online sending) ---------- */
function trialRow(t,p){const r={participant:t.pid,mode:p.mode||'',source:p.source||'',age:p.age,design_background:p.design,ea_media:p.media,been_to_ea:p.beenEA,country:p.country||'',state:p.state,
  round:t.phase==='core'?'main':t.phase,position:t.pos,image:t.image,group:t.group||(t.filler?'filler':''),place:t.place||'',complex:t.complex?'yes':'',pair:t.pair,version:t.version,elements:(t.tags||[]).join(' '),
  shown_at:t.shownAt,region:t.region,region_other:t.other,rt_region_first_ms:ms(t.rtRegionFirst),rt_region_final_ms:ms(t.rtRegionFinal),region_changes:t.regionChanges,n_taps:(t.taps||[]).length};
  for(let k=0;k<MAXTAPS;k++){const x=(t.taps||[])[k];r[`tap${k+1}_x`]=x?x.x.toFixed(4):'';r[`tap${k+1}_y`]=x?x.y.toFixed(4):'';r[`tap${k+1}_cue`]=x?x.cue:'';r[`tap${k+1}_rt_ms`]=x?ms(x.rt):'';r[`tap${k+1}_cue_rt_ms`]=x?ms(x.cueRt):''}
  Object.assign(r,{tap_cancels:t.tapCancels,taps_removed:t.tapRemovals||0,taps_discarded:t.tapsDiscarded,recognise:t.recog??t.know??'',recognise_changed:t.recogChanged?'yes':'',rt_recognise_ms:ms(t.rtRecog),
    rt_next_ms:ms(t.rtNext),help_opens:t.helps,skipped:t.skipped?'yes':'',attention_pass:t.attnPass||'',note:t.note,saved_at:t.savedAt,app_version:t.app});return r}
function partRow(p){return{participant:p.id,mode:p.mode||'',source:p.source||'',age:p.age,design_background:p.design,ea_media:p.media,been_to_ea:p.beenEA,country:p.country||'',state:p.state,consent:p.consent?'yes':'',audio_consent:p.audio||'',
  researcher_note:p.rnote||'',started:p.startedAt,ended:p.endedAt,status:p.status,bonus_choice:p.bonusChoice,attention_pass:p.attnPass||'',main_order:(p.mainOrder||p.coreOrder||[]).join(' '),bonus_order:(p.bonusOrder||[]).join(' '),app_version:p.app}}

/* ---------- online sending: queue on device, send when there is an endpoint ---------- */
let flushing=false;
const getPin=()=>{try{return sessionStorage.getItem('orient-pin')||''}catch(e){return''}};
const setPin=v=>{try{v?sessionStorage.setItem('orient-pin',v):sessionStorage.removeItem('orient-pin')}catch(e){}};
async function sheetGet(what,pin){const u=`${SET.endpoint}${SET.endpoint.includes('?')?'&':'?'}key=${encodeURIComponent(pin||getPin())}&what=${what}`;const r=await fetch(u,{cache:'no-store'});return r.json()}
async function queue(kind,row){try{await put('outbox',{kind,row,ts:iso()})}catch(e){}flush()}
async function flush(){if(!SET.endpoint||flushing)return;flushing=true;
  try{for(const it of await all('outbox')){try{await fetch(SET.endpoint,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({kind:it.kind,row:it.row})});await del('outbox',it.k)}catch(e){break}}}
  finally{flushing=false}}
window.addEventListener('online',flush);

/* ---------- export ---------- */
let DL=null;
(async()=>{try{if(window.claude&&window.claude.use)DL=await window.claude.use('downloads')}catch(e){DL=null}})();
async function saveFile(name,text,type){
  if(DL){try{await DL.save({filename:name,data:text});return markExport()}catch(e){}}
  const blob=new Blob([text],{type});
  try{const f=new File([blob],name,{type});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});return markExport()}}catch(e){if(e&&e.name==='AbortError')return}
  try{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove()}catch(e){}
  modal(`<h3>${esc(name)}</h3><p>If no file appeared, copy the data instead and paste it into a note or email to yourself.</p><textarea readonly style="min-height:160px;font-size:12px">${esc(text.slice(0,200000))}</textarea><div class="row"><button class="btn" data-x>Close</button><button class="btn pri" data-c>Copy</button></div>`);
  modalEl.querySelector('[data-x]').onclick=closeModal;
  modalEl.querySelector('[data-c]').onclick=async e=>{try{await navigator.clipboard.writeText(text);e.target.textContent='Copied';markExport()}catch(_){modalEl.querySelector('textarea').select()}}}
async function markExport(){SET.lastExport=iso();await put('meta',SET)}
const csvCell=v=>{v=v==null?'':String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const objCSV=rows=>{if(!rows.length)return'';const h=Object.keys(rows[0]);return[h,...rows.map(r=>h.map(k=>r[k]))].map(r=>r.map(csvCell).join(',')).join('\n')};
const stamp=()=>new Date().toISOString().slice(0,16).replace(/[:T]/g,'-');
async function exportAnswers(){const ps={};(await all('participants')).forEach(p=>ps[p.id]=p);
  const tr=(await all('trials')).sort((a,b)=>a.pid.localeCompare(b.pid)||(a.phase===b.phase?a.pos-b.pos:a.phase==='bonus'?1:-1));
  saveFile(`answers_${stamp()}.csv`,objCSV(tr.length?tr.map(t=>trialRow(t,ps[t.pid]||{})):[trialRow({},{})]),'text/csv')}
async function exportParticipants(){const ps=(await all('participants')).sort((a,b)=>a.id.localeCompare(b.id));saveFile(`participants_${stamp()}.csv`,objCSV(ps.length?ps.map(partRow):[partRow({})]),'text/csv')}
function exportImages(){saveFile(`images_${stamp()}.csv`,objCSV(IMGS.map((i,k)=>({number:k+1,image:i.id,file:i.name,round:i.set,group:i.group,place:i.place||'',complex:i.complex?'yes':'',pair:i.pair,version:i.ver,elements:(i.tags||[]).join(' '),hidden:i.hidden?'yes':'',width:i.w,height:i.h}))),'text/csv')}
async function exportLog(){const l=await all('log');saveFile(`log_${stamp()}.csv`,objCSV(l.map(x=>({seq:x.seq,time:x.ts,participant:x.pid,action:x.action,detail:x.detail}))),'text/csv')}
async function exportBackup(){const b={app:VER,exportedAt:iso(),settings:SET,participants:await all('participants'),trials:await all('trials'),log:await all('log'),
  images:IMGS.map(i=>({id:i.id,name:i.name,set:i.set,group:i.group,tags:i.tags,pair:i.pair,ver:i.ver,hidden:i.hidden,idx:i.idx,w:i.w,h:i.h}))};
  saveFile(`backup_${stamp()}.json`,JSON.stringify(b),'application/json')}

/* ---------- images ---------- */
function parseName(fn){const base=fn.replace(/\.[^.]+$/,'');
  const nm=/^0*(\d{1,4})\s*([rt])?$/i.exec(base.trim());
  if(nm){const num=String(+nm[1]).padStart(3,'0'),suf=(nm[2]||'').toLowerCase();return{id:num+suf,set:'main',pair:suf?num:'',ver:suf==='r'?'redacted':suf==='t'?'text':''}}
  const m=/^([cb])0*(\d{1,3})([rt])?/i.exec(base);
  if(!m)return{id:base.replace(/[^\w-]/g,'_').slice(0,30),set:'main',pair:'',ver:''};
  const pre=m[1].toUpperCase(),num=String(+m[2]).padStart(2,'0'),suf=(m[3]||'').toLowerCase();
  return{id:pre+num+suf,set:pre==='C'?'main':'bonus',pair:suf?pre+num:'',ver:suf==='r'?'redacted':suf==='t'?'text':''}}
function loadEl(file){return new Promise((res,rej)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=u})}
async function shrink(file){let src;try{src=await createImageBitmap(file)}catch(e){src=await loadEl(file)}
  const w=src.width||src.naturalWidth,h=src.height||src.naturalHeight,s=Math.min(1,1600/Math.max(w,h));
  const c=document.createElement('canvas');c.width=Math.round(w*s);c.height=Math.round(h*s);c.getContext('2d').drawImage(src,0,0,c.width,c.height);
  const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.88));return{blob,w,h}}
async function addFiles(files){files=[...files].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));let n=IMGS.length?Math.max(...IMGS.map(i=>i.idx))+1:0,added=0,replaced=0;
  if(IMGS.some(i=>i.demo)){for(const i of IMGS.filter(i=>i.demo))await del('images',i.id);await loadImgs();await logA('demo images removed')}
  for(const f of files){const p=parseName(f.name);const{blob,w,h}=await shrink(f);const ex=IMGS.find(i=>i.id===p.id);
    await put('images',{...p,name:f.name,blob,w,h,idx:ex?ex.idx:n++,group:ex?ex.group:(SET.newGroup||'none'),tags:ex?ex.tags:[],place:ex?ex.place||'':'',complex:ex?!!ex.complex:false,hidden:ex?ex.hidden:false});if(URLS[p.id]){URL.revokeObjectURL(URLS[p.id]);delete URLS[p.id]}ex?replaced++:added++}
  await loadImgs();await logA('images uploaded',`${added} added, ${replaced} replaced`)}
async function demoSet(){const mk=(id,label,hue)=>new Promise(r=>{const c=document.createElement('canvas');c.width=c.height=900;const g=c.getContext('2d');
  g.fillStyle=`hsl(${hue},8%,${28+(hue%3)*6}%)`;g.fillRect(0,0,900,900);g.strokeStyle='rgba(255,255,255,.08)';for(let k=0;k<900;k+=60){g.beginPath();g.moveTo(k,0);g.lineTo(k,900);g.stroke();g.beginPath();g.moveTo(0,k);g.lineTo(900,k);g.stroke()}
  g.fillStyle='rgba(236,229,216,.9)';g.font='700 150px -apple-system,system-ui,sans-serif';g.textAlign='center';g.fillText(id,450,450);g.font='400 44px -apple-system,system-ui,sans-serif';g.fillText(label,450,540);c.toBlob(b=>r(b),'image/jpeg',.85)});
  const plan=[['trad',9,3],['min',7,3],['filler',8,0],['decoy',6,0],['realea',4,0]];const cl=codeList().map(c=>c.code);let num=1,idx=0;const list=[];
  for(const[g,singles,pairs]of plan){for(let k=0;k<singles;k++)list.push({id:'C'+String(num++).padStart(2,'0'),g});for(let k=0;k<pairs;k++){const b='C'+String(num++).padStart(2,'0');list.push({id:b+'r',g},{id:b+'t',g})}}
  for(let k=1;k<=10;k++)list.push({id:'B'+String(k).padStart(2,'0'),g:k<5?'trad':k<8?'min':'decoy'});
  for(const it of list){const p=parseName(it.id);const tags=it.g==='filler'?[]:shuffle(cl.slice()).slice(0,2+Math.floor(Math.random()*2));
    const blob=await mk(it.id,`demo · ${GROUPS[it.g].toLowerCase()}${p.ver==='redacted'?' · no text':p.ver==='text'?' · with text':''}`,idx*37);
    await put('images',{...p,name:it.id+'.jpg',blob,w:900,h:900,idx:idx++,group:it.g,tags,hidden:false,demo:true})}
  await loadImgs();await logA('demo images loaded')}

/* ---------- session ---------- */
const curList=()=>S.phase==='main'?S.order:S.bonusOrder;
const curImg=()=>{const id=curList()[S.i];return id==='ATTN'?ATTN:IMGS.find(i=>i.id===id)};
async function saveSession(){if(S)await put('meta',{id:'session',...S});else await del('meta','session')}
const newId=()=>'P'+Date.now().toString(36).slice(-4).toUpperCase()+Math.random().toString(36).slice(2,5).toUpperCase();
async function startSession(scr){const pid=newId();
  const mu=sampleMain(SET.nMain),bu=SET.bonus?sampleBonus(SET.nBonus,new Set(mu.map(u=>u.key))):[];
  const main=mu.map(pickItem),bonus=bu.map(pickItem);
  const attnImg=SET.attn?pickAttnImg(main.concat(bonus)):'';
  if(SET.attn&&main.length>=4)main.splice(Math.floor(main.length*(.4+Math.random()*.3)),0,'ATTN');
  await put('participants',{id:pid,mode:SET.mode,source:MODE==='public'?(SRC||'direct'):'admin',...scr,startedAt:iso(),endedAt:'',status:'in progress',mainOrder:main,bonusOrder:bonus,bonusChoice:'',attnPass:'',app:VER});
  S={id:'session',pid,phase:'main',order:main,bonusOrder:bonus,attnImg,i:0,stage:'intro'};await saveSession();await logA('session started',`${main.length} main, ${bonus.length} bonus`);render()}
async function setPart(patch){const p=await get('participants',S.pid);if(p)await put('participants',{...p,...patch})}
async function finish(status){await setPart({endedAt:iso(),status});await logA('session '+status);const p=await get('participants',S.pid);if(p)queue('participants',partRow(p));
  if(SET.mode==='online')await put('meta',{id:'done',at:iso()});S.stage='thanks';await saveSession();render()}

/* ---------- trial ---------- */
function newTrial(){const im=curImg();T={img:im,shownAt:'',t0:null,region:'',other:'',rtRegionFirst:null,rtRegionFinal:null,regionChanges:0,taps:[],pending:null,tapCancels:0,tapsDiscarded:0,tapRemovals:0,recog:'No',recogChanged:false,rtRecog:null,helps:0,note:''}}
const el=()=>T&&T.t0!=null?now()-T.t0:null;
const tappable=()=>T&&!T.img.attn&&(EAST.has(T.region)||(T.region==='Somewhere specific'&&T.other.trim()!==''));
function rTrial(){if(!curImg()){logA('missing image skipped',curList()[S.i]||'');return advance()}newTrial();const im=T.img;
  app.innerHTML=`<div class="trial"><header class="top"><button class="glass" data-act="help" aria-label="How this works">?</button><div class="bar" id="bar">${barHTML()}</div>${S.phase==='bonus'?'<button class="glass txt" data-act="bonusStop">I\'m done</button>':''}</header>
  <aside class="side" id="side"></aside><main class="stage"><div class="photo" id="photo"><img id="pic" alt="" draggable="false">${im.attn?`<div class="attn"><div>Quick check: to show you're reading, choose “${ATTN_ANSWER}” for this one.</div></div>`:''}<div id="rings"></div></div></main></div>`;
  const pic=document.getElementById('pic');const src=im.attn?URLS[S.attnImg]:URLS[im.id];if(src){pic.onload=()=>{T.t0=now();T.shownAt=iso()};pic.onerror=()=>{T.t0=now();T.shownAt=iso();T.note='image failed to load'};pic.src=src}else{pic.remove();T.t0=now();T.shownAt=iso()}
  {const nx=curList()[S.i+1];const nu=nx&&(nx==='ATTN'?URLS[S.attnImg]:URLS[nx]);if(nu){const pre=new Image();pre.src=nu}}
  hold(document.getElementById('bar'),async()=>{if(await ask('Enter researcher mode?','The answers so far on this photo are kept.','Enter','Cancel'))researcherMenu()});
  wirePhoto();rSide()}
function barHTML(){const n1=S.order.length,n2=S.bonusOrder.length;
  if(S.phase==='main')return`<div class="track"><div class="fill" style="width:${prog(S.i,n1)*100}%"></div></div>`;
  return`<div class="track"><div class="fill done" style="width:100%"></div><div class="fill b" style="width:${prog(S.i,n2)*100}%"></div></div>`}
function opt(kind,v,on){return`<button class="opt${on?' on':''}" data-act="${kind}" data-v="${esc(v)}"><i></i><span>${esc(v)}</span></button>`}
function rSide(){const tap=tappable(),pend=!!T.pending,side=document.getElementById('side');let h='';
  if(pend){h+=`<section class="sec dim"><div class="hd">Where does this place's style feel like it's from?</div>${opt('noop',T.region+(T.other.trim()?': '+T.other.trim():''),true)}</section>`}
  else{h+=`<section class="sec"><div class="hd">Where does this place's style feel like it's from?</div><div class="grid">${REGIONS.map(r=>opt('region',r,T.region===r)).join('')}</div><div class="grid">${REG_EXTRA.map(r=>opt('region',r,T.region===r)).join('')}</div>
    ${T.region==='Somewhere specific'?`<input class="other" id="other" type="text" placeholder="Where? (optional, any place)" value="${esc(T.other)}" autocomplete="off">`:''}</section>`}
  if(tap){h+=`<section class="sec"><div class="hd">What gave it away?</div>`;
    if(pend)h+=`<div class="hint">What is it that you tapped?</div><div>${CUES.map(c=>opt('cue',c,false)).join('')}</div><button class="cancel" data-act="cancelTap">Cancel this point</button>`;
    else{h+=T.taps.map((t,k)=>`<div class="picked"><span class="num">${k+1}</span><span class="lab">${esc(t.cue)}</span><button class="x" data-act="rmTap" data-k="${k}" aria-label="Remove point ${k+1}">×</button></div>`).join('');
      h+=`<div class="hint">${!T.taps.length?'Tap the one thing in the photo that gives it away.':T.taps.length<MAXTAPS?'Tap the photo again only if you\'re sure something else gives it away too.':'That\'s the most you can mark.'}</div>`}
    h+='</section>'}
  const ready=T.region&&!pend&&(!tap||T.taps.length);
  if(ready){if(!T.img.attn)h+=`<section class="sec"><button class="sw${T.recog==='Yes'?' on':''}" data-act="recog" role="switch" aria-checked="${T.recog==='Yes'}"><span>${esc(recogLabel())}</span><span class="tg"></span></button></section>`;
    h+=`<button class="next" data-act="next">Next</button>`}
  side.innerHTML=h;
  const o=document.getElementById('other');if(o)o.oninput=()=>{const was=tappable();T.other=o.value;if(was!==tappable()){if(!tappable()&&(T.taps.length||T.pending)){T.tapsDiscarded+=T.taps.length;T.taps=[];T.pending=null}
    const pos=o.selectionStart;rSide();const n=document.getElementById('other');if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(e){}}}};
  document.getElementById('photo').classList.toggle('live',tap&&(pend||T.taps.length<MAXTAPS));rRings()}
function rRings(){document.getElementById('rings').innerHTML=T.taps.map((t,k)=>`<span class="ring" style="left:${t.x*100}%;top:${t.y*100}%"><b>${k+1}</b></span>`).join('')+(T.pending?`<span class="ring pend" style="left:${T.pending.x*100}%;top:${T.pending.y*100}%"></span>`:'')}
function wirePhoto(){const ph=document.getElementById('photo');ph.addEventListener('pointerdown',e=>{if(!tappable())return;if(!T.pending&&T.taps.length>=MAXTAPS)return;
  const r=ph.getBoundingClientRect(),x=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),y=Math.min(1,Math.max(0,(e.clientY-r.top)/r.height));
  if(T.pending){T.pending.x=x;T.pending.y=y;T.pending.moves++}else T.pending={x,y,rt:el(),moves:0};rSide()})}
async function saveTrial(skipped){const im=T.img;
  const rec={id:S.pid+'_'+S.phase+'_'+im.id,pid:S.pid,phase:S.phase,pos:S.i+1,image:im.attn?'ATTN:'+(S.attnImg||''):im.id,group:im.group,pair:im.pair,version:im.ver,place:im.place||'',complex:!!im.complex,tags:(im.tags||[]).slice(),shownAt:T.shownAt,
    region:T.region,other:T.other.trim(),rtRegionFirst:T.rtRegionFirst,rtRegionFinal:T.rtRegionFinal,regionChanges:T.regionChanges,
    taps:T.taps.map(t=>({x:t.x,y:t.y,cue:t.cue,rt:t.rt,cueRt:t.cueRt,moves:t.moves})),tapCancels:T.tapCancels,tapRemovals:T.tapRemovals,tapsDiscarded:T.tapsDiscarded,
    recog:im.attn?'':T.recog,recogChanged:T.recogChanged,rtRecog:T.rtRecog,rtNext:el(),helps:T.helps,skipped:!!skipped,
    attnPass:im.attn&&!skipped?(T.region===ATTN_ANSWER?'yes':'no'):'',note:T.note,savedAt:iso(),app:VER};
  await put('trials',rec);if(rec.attnPass)await setPart({attnPass:rec.attnPass});
  const p=await get('participants',S.pid)||{};queue('answers',trialRow(rec,p))}
async function advance(){S.i++;if(S.i>=curList().length){if(S.phase==='main'){if(S.bonusOrder.length){S.stage='bonusOffer';await saveSession();return render()}return finish('complete')}return finish('complete')}
  await saveSession();rTrial()}

/* ---------- researcher menu (during a session) ---------- */
function researcherMenu(){const im=T&&T.img;
  modal(`<h3>Researcher mode</h3><p>${esc(S.pid)} · ${S.phase} · photo ${S.i+1} of ${curList().length}${im?' · '+esc(im.id):''}</p><div class="menu">
  <button class="btn pri" data-m="resume">Resume</button>
  <button class="btn" data-m="note">Add a note to this photo${T&&T.note?' (has note)':''}</button>
  <button class="btn" data-m="skip">Skip this photo</button>
  <button class="btn" data-m="back" ${S.i>0?'':'disabled'}>Go back one photo (re-answer it)</button>
  <button class="btn" data-m="end">End session now</button>
  <button class="btn" data-m="home">Pause and go to researcher home</button></div>`);
  modalEl.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>menuAct(b.dataset.m))}
async function menuAct(m){closeModal();
  if(m==='note'){modal(`<h3>Note on ${esc(T.img.id)}</h3><textarea id="nt">${esc(T.note)}</textarea><div class="row"><button class="btn" data-x>Cancel</button><button class="btn pri" data-s>Save</button></div>`);
    modalEl.querySelector('[data-x]').onclick=closeModal;modalEl.querySelector('[data-s]').onclick=()=>{T.note=document.getElementById('nt').value;closeModal()}}
  if(m==='skip'&&await ask('Skip this photo?','It is saved as skipped.','Skip')){await logA('photo skipped',T.img.id);await saveTrial(true);advance()}
  if(m==='back'&&await ask('Go back one photo?','The previous answer is deleted on this device and answered again. If it was already sent online, the new answer arrives as a later row.','Go back')){S.i--;const id=curList()[S.i];await del('trials',S.pid+'_'+S.phase+'_'+id);await logA('went back',id);await saveSession();rTrial()}
  if(m==='end'&&await ask('End this session now?','Answers so far are kept. The participant is marked as ended early.','End session'))finish('ended early');
  if(m==='home'){await logA('session paused');S.stage='trial';await saveSession();S=null;rHome()}}

/* ---------- participant screens ---------- */
function render(){closeModal();if(!S)return MODE==='public'?rWelcome():rHome();
  if(S.stage==='intro')return rIntro();if(S.stage==='trial')return rTrial();if(S.stage==='bonusOffer')return rBonus();if(S.stage==='thanks')return rThanks()}
const nShown=()=>Math.min(SET.nMain,units('main').length);
const HOWTO=()=>`<ol class="steps"><li>Look at the photo and pick which part of the world its look and style bring to mind. You're not guessing where the photo was taken. Go with your first instinct.</li>
<li>If you pick East Asia or South-East Asia, or type a place under “Somewhere specific”, tap the one thing in the photo that gave it away, then say what it is. Add a second or third only if you're sure. Tap × to remove a point.</li>
<li>Switch on “${esc(recogLabel())}” if that's true. Otherwise leave it off.</li></ol>
<p>There are no right or wrong answers.</p>`;
const COUNTRIES=['Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Cape Verde','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czechia','Democratic Republic of the Congo','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hong Kong','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Ivory Coast','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Macau','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'];
const matchCountry=v=>COUNTRIES.find(c=>c.toLowerCase()===String(v||'').trim().toLowerCase())||'';
const contactLine=()=>SET.contact?`<p class="contact">Questions about the study? Email <b>${esc(SET.contact)}</b></p>`:'';
async function rWelcome(){S=null;closeModal();const done=await get('meta','done');
  if(done&&SET.mode==='online'){OPTIN={sent:!!done.optin};return rThanks()}
  const n=nShown(),mins=Math.max(3,Math.round(n*.3));
  app.innerHTML=`<div class="center"><div class="box"><h1 id="ttl">Where does it feel from?</h1><p>A short study about how shops and restaurants look. You'll see about ${n} photos and say which part of the world each place's style feels like it's from (not where it actually is). It takes about ${mins} minutes.</p>
  <p class="small">This is part of an academic design research project${SET.inst?' '+esc(SET.inst):''}. Your answers are used only for this research. They won't be sold, shared with companies, or used to train AI.</p>
  <p class="small">It's anonymous: we don't ask for your name, and nothing you answer identifies you. You can stop at any time by closing the page; answers you've already given are kept.</p>
  <p class="small">You need to be 18 or older. That's a standard research-ethics rule for studies with adults, not a content warning: the photos are just shops and restaurants.</p>
  <label class="chk cons"><input type="checkbox" id="ok18"> I'm 18 or older and I agree to take part</label>
  <button class="btn pri big" id="go" data-act="toAbout" disabled>Start</button>${contactLine()}</div></div>`;
  document.getElementById('ok18').onchange=e=>{document.getElementById('go').disabled=!e.target.checked};
  hold(document.getElementById('ttl'),rHome)}
let SCR={};
const aboutOk=()=>{const c=matchCountry(SCR.country);return!!(SCR.age&&SCR.design&&SCR.media&&SCR.beenEA&&c&&(c!=='India'||SCR.state)&&(SET.mode!=='inperson'||SCR.audio))};
function rAbout(){const ch=(k,opts)=>`<div class="chips">${opts.map(o=>`<button class="chip${SCR[k]===o?' on':''}" data-act="scr" data-k="${k}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
  const inP=SET.mode==='inperson',india=matchCountry(SCR.country)==='India';
  app.innerHTML=`<div class="page"><div class="wrap about" style="max-width:680px"><h1>A bit about you</h1><p class="sub">This helps make sense of the answers. Nothing here identifies you.</p>
  <div class="field"><span class="lbl">Your age</span>${ch('age',AGES)}</div>
  <div class="field"><span class="lbl">Do you study or work in design?</span>${ch('design',DESIGN)}</div>
  <div class="field"><span class="lbl">How often do you watch or read East Asian media (K-dramas, anime, C-dramas, manga…)?</span>${ch('media',MEDIA)}</div>
  <div class="field"><span class="lbl">Have you ever been to East Asia (China, Japan, Korea, Taiwan…)?</span>${ch('beenEA',YN)}</div>
  <div class="field"><span class="lbl" id="ctl">Which country do you live in?</span><button class="pick${SCR.country?'':' ph'}" data-act="pickCountry" aria-labelledby="ctl">${esc(SCR.country||'Choose your country')}<span aria-hidden="true">▾</span></button></div>
  ${india?`<div class="field"><span class="lbl" id="stl">State or union territory</span><button class="pick${SCR.state?'':' ph'}" data-act="pickState" aria-labelledby="stl">${esc(SCR.state||'Choose your state')}<span aria-hidden="true">▾</span></button></div>`:''}
  ${inP?`<div class="field"><span class="lbl">Is it OK to record audio while you do this?</span>${ch('audio',YN)}</div>`:''}
  <button class="btn pri big" data-act="startP" id="cont" ${aboutOk()?'':'disabled'}>Continue</button></div></div>`;
}
function rIntro(){app.innerHTML=`<div class="center"><div class="box"><h1>How it works</h1>${HOWTO()}<button class="btn pri big" data-act="begin">Start</button></div></div>`}
function rBonus(){app.innerHTML=`<div class="center"><div class="box"><h1>That's the main part done</h1><p>There are ${S.bonusOrder.length} more photos, about ${Math.max(2,Math.round(S.bonusOrder.length*.35))} minutes. These are a bit trickier. They're optional, and you can stop any time.</p><div class="row" style="justify-content:center;margin-top:28px"><button class="btn big" data-act="bonusNo">I'm done</button><button class="btn pri big" data-act="bonusYes">Keep going</button></div></div></div>`}
let OPTIN={sent:false};
function rThanks(){const inP=SET.mode==='inperson';
  app.innerHTML=`<div class="center"><div class="box"><h1 id="ttl">Thank you</h1><p>${inP?'That\'s everything.':'That\'s everything. Your answers are in. If you know someone who might take part, please send them the link.'}</p>
  <div class="optin">${OPTIN.sent?'<h3>Noted, thank you</h3><p>We\'ll only use your email for what you ticked.</p>':`<h3>Want to hear more? <span style="color:var(--dim);font-weight:400">(optional)</span></h3>
   <p>Only if you'd like to. Your email is kept separately from your answers, and it's used only for what you tick below. You can skip this.</p>
   <div class="field" style="margin-bottom:10px"><label for="em">Email</label><input id="em" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com"></div>
   <label class="chk"><input type="checkbox" id="oF" checked> Send me the findings</label>
   <label class="chk"><input type="checkbox" id="oA"> I'm happy to take part in future rounds</label>
   <div class="row" style="margin-top:10px"><button class="btn pri" data-act="optin" id="oS" disabled>Send</button><span class="warn" id="oE"></span></div>`}</div>
  ${contactLine()}
  ${inP?'<button class="btn big" style="margin-top:22px" data-act="handBack">Hand back</button>':'<p class="small" style="margin-top:18px">You can close this tab now.</p>'}</div></div>`;
  hold(document.getElementById('ttl'),rHome);
  const em=document.getElementById('em');if(em){const chk=()=>{document.getElementById('oS').disabled=!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value.trim())&&(document.getElementById('oF').checked||document.getElementById('oA').checked))};em.oninput=chk;['oF','oA'].forEach(i=>document.getElementById(i).onchange=chk)}}
async function sendOptin(){const em=document.getElementById('em').value.trim();const row={email:em,send_findings:document.getElementById('oF').checked?'yes':'',future_rounds:document.getElementById('oA').checked?'yes':'',submitted_at:iso()};
  try{await put('contacts',row)}catch(e){}queue('contacts',row);OPTIN.sent=true;if(SET.mode==='online'){const d=await get('meta','done');if(d)await put('meta',{...d,optin:true})}rThanks()}

/* ---------- researcher screens ---------- */
async function rHome(){closeModal();S=null;const sess=await get('meta','session');const ps=await all('participants');const trs=await all('trials');const out=await all('outbox');const done=await get('meta','done');
  const mu=units('main'),bu=units('bonus'),demo=IMGS.some(i=>i.demo);
  const since=SET.lastExport?new Date(SET.lastExport).toLocaleString():'never';
  app.innerHTML=`<div class="page"><div class="wrap"><h1>Field study</h1><p class="sub">Researcher screen · v${VER} · mode: ${SET.mode==='online'?'online':'in person'} · ${SET.endpoint?`sending to sheet${out.length?` · <span class="warn">${out.length} waiting to send</span>`:''}`:'not sending online (saved on this device only)'}</p>
  ${sess&&sess.stage!=='thanks'?`<div class="card" style="margin-bottom:14px"><h3>${esc(sess.pid)} is paused</h3><p>${sess.stage==='trial'?`${sess.phase} photo ${sess.i+1} of ${(sess.phase==='main'?sess.order:sess.bonusOrder).length}`:sess.stage}</p><div class="row"><button class="btn pri" data-act="resume">Resume ${esc(sess.pid)}</button><button class="btn" data-act="abandon">End it</button></div></div>`:''}
  <div class="row" style="margin:6px 0 10px"><button class="btn pri big" data-act="toWelcome" ${mu.length?'':'disabled'}>Open participant view</button>${!mu.length?'<span class="warn">Add images first (or load demo placeholders).</span>':''}${done?'<button class="btn" data-act="undone">Allow another go on this device</button>':''}</div>
  <p class="sub" style="font-size:15px">To get back here from the participant view, hold the title or the progress bar for 2 seconds. ${SET.endpoint?(getPin()?'<button class="btn mini" data-act="lock">Lock (forget PIN)</button>':''):'<span class="warn">No sheet address yet: set it in Settings.</span>'}</p>
  <div class="cards">
   <div class="card"><h3>Images</h3><p>${mu.length} main places · ${bu.length} bonus-only places · each person sees ${Math.min(SET.nMain,mu.length)} + ${SET.bonus?Math.min(SET.nBonus,bu.length):0}${demo?'<br><span class="warn">Demo placeholders loaded</span>':''}</p><button class="btn" data-act="images">Manage images</button></div>
   <div class="card"><h3>Live heatmaps</h3><p>Where people tap on each photo, updating from the sheet every 30 s. For the jury screen.</p><button class="btn pri" data-act="heat" ${SET.endpoint?'':'disabled'}>Open live heatmaps</button></div>
   <div class="card"><h3>Data</h3><p>${ps.length} participants · ${trs.length} answers on this device<br>Last export: ${esc(since)}</p><button class="btn" data-act="data">Export and manage</button></div>
   <div class="card"><h3>Settings</h3><p>${SET.order==='random'?'Random, stratified':'Fixed (all, list order)'} · attention check ${SET.attn?'on':'off'} · bonus ${SET.bonus?'on':'off'}</p><button class="btn" data-act="settings">Change</button></div>
   <div class="card"><h3>Website</h3><p>Export photos, groups, tags and settings as a zip for the repo's photos folder, or pull in what's live now.</p><div class="row"><button class="btn" data-act="exSite" ${mu.length?'':'disabled'}>Export for website</button><button class="btn" data-act="loadSite">Load from live site</button></div></div>
   <div class="card"><h3>Change log</h3><p>Every edit, skip and session event, with times.</p><button class="btn" data-act="log">View log</button></div>
  </div></div></div>`}

function imgIssues(){const out=[];const mu=units('main');const by={};mu.forEach(u=>by[u.group]=(by[u.group]||0)+1);
  const byPair={};IMGS.filter(i=>i.pair&&!i.hidden).forEach(i=>(byPair[i.pair]=byPair[i.pair]||[]).push(i));
  for(const p in byPair){const v=byPair[p].map(i=>i.ver).sort().join();if(v!=='redacted,text')out.push(`${p}: needs one “r” and one “t” photo`);
    if(new Set(byPair[p].map(i=>i.set)).size>1)out.push(`${p}: both photos must be in the same round`);if(new Set(byPair[p].map(i=>i.group)).size>1)out.push(`${p}: both photos must be in the same group`)}
  const ng=IMGS.filter(i=>!i.hidden&&(i.group||'none')==='none').length;if(ng)out.push(`${ng} photo(s) have no group`);
  const nt=IMGS.filter(i=>!i.hidden&&i.group!=='filler'&&!(i.tags||[]).length).length;if(nt)out.push(`${nt} non-filler photo(s) have no elements tagged`);
  const ns=IMGS.filter(i=>i.w&&i.h&&Math.abs(i.w-i.h)>4).length;if(ns)out.push(`${ns} photo(s) are not square`);
  if(mu.length){const fs=(by.filler||0)/mu.length;if(fs<.15)out.push(`Fillers are ${Math.round(fs*100)}% of main units (aim for 15–20%)`)}
  if(mu.length&&SET.nMain>mu.length)out.push(`Only ${mu.length} main units, so everyone sees all of them (setting asks for ${SET.nMain})`);
  return{out,by,mu}}
function rImages(){const{out,by,mu}=imgIssues();
  const rows=IMGS.map((i,k)=>`<tr><td class="n" style="color:var(--dim)">${k+1}</td><td><img class="thumbimg" src="${URLS[i.id]}" alt=""></td><td><b>${esc(i.id)}</b><br><span style="color:var(--dim);font-size:13px">${esc(i.name)}${i.w&&i.h&&Math.abs(i.w-i.h)>4?' · <span class="warn">not square</span>':''}</span></td>
  <td><select data-ch="set" data-id="${esc(i.id)}" aria-label="Round"><option value="main"${i.set==='main'?' selected':''}>Main or bonus</option><option value="bonus"${i.set==='bonus'?' selected':''}>Bonus only</option></select><label class="chk" style="min-height:32px;font-size:14px"><input type="checkbox" data-ch="complex" data-id="${esc(i.id)}" ${i.complex?'checked':''}>Complex</label></td>
  <td><select data-ch="group" data-id="${esc(i.id)}" aria-label="Group">${GKEYS.map(g=>`<option value="${g}"${(i.group||'none')===g?' selected':''}>${GROUPS[g]}</option>`).join('')}</select></td>
  <td><input type="text" list="places" data-ch="place" data-id="${esc(i.id)}" value="${esc(i.place||'')}" placeholder="Place" aria-label="Place" style="width:150px;padding:6px 8px;font-size:15px;border-radius:8px">${i.pair?`<div class="tags">pair ${esc(i.pair)} · ${i.ver==='redacted'?'no text':'with text'}</div>`:''}</td>
  <td><button class="btn mini" data-act="tags" data-id="${esc(i.id)}">Elements (${(i.tags||[]).length})</button><div class="tags">${esc((i.tags||[]).join(' '))}</div></td>
  <td><label class="chk"><input type="checkbox" data-ch="hidden" data-id="${esc(i.id)}" ${i.hidden?'checked':''}>Hide</label></td>
  <td><div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn mini" data-act="mv" data-d="-1" data-id="${esc(i.id)}" ${k?'':'disabled'} aria-label="Move up">↑</button><button class="btn mini" data-act="mv" data-d="1" data-id="${esc(i.id)}" ${k<IMGS.length-1?'':'disabled'} aria-label="Move down">↓</button><button class="btn mini danger" data-act="rmImg" data-id="${esc(i.id)}">Remove</button></div></td></tr>`).join('');
  app.innerHTML=`<div class="page"><div class="wrap"><button class="btn mini" data-act="home">‹ Back</button><h1>Images</h1>
  <p class="sub">Any file names work; numbered files (1.jpg, 2.jpg…) keep their numbers. For a redaction pair use one number with r and t, e.g. 7r (text removed) and 7t (with text). Photos with the same <b>place</b> name count as one place: each person sees at most one of them. <b>Complex</b> photos are less likely to be picked for the main round and more likely for the bonus (sampling weight ½ in main, 2 in bonus). <b>Bonus only</b> photos never appear in the main round. Uploading a file with an existing name replaces it.</p>
  <div class="row" style="margin-bottom:12px"><label for="ng" style="font-size:15px;color:var(--dim)">New photos go into</label><select id="ng" style="width:auto">${GKEYS.map(g=>`<option value="${g}"${(SET.newGroup||'none')===g?' selected':''}>${GROUPS[g]}</option>`).join('')}</select><label class="btn pri" for="up">Add photos</label><input id="up" type="file" accept="image/*" multiple hidden><button class="btn" data-act="demo">Load demo placeholders</button><button class="btn danger" data-act="rmAll" ${IMGS.length?'':'disabled'}>Remove all</button></div>
  <datalist id="places">${[...new Set(IMGS.map(i=>(i.place||'').trim()).filter(Boolean))].sort().map(p=>`<option value="${esc(p)}">`).join('')}</datalist><p class="sub">Main pool: ${mu.length} places (pairs and same-place photos count once) · ${IMGS.filter(i=>i.complex&&!i.hidden).length} marked complex · ${GKEYS.filter(g=>by[g]).map(g=>`${GROUPS[g]} ${by[g]} (${Math.round(by[g]/mu.length*100)}%)`).join(' · ')||'empty'}</p>
  ${out.length?`<p class="warn">${out.map(esc).join('<br>')}</p>`:IMGS.length?'<p class="sub">No problems found.</p>':''}
  <div style="overflow-x:auto"><table><thead><tr><th class="n">#</th><th></th><th>Photo</th><th>Round</th><th>Group</th><th>Place</th><th>Elements</th><th></th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="9" style="color:var(--dim)">No photos yet.</td></tr>'}</tbody></table></div></div></div>`;
  document.getElementById('ng').onchange=async e=>{SET.newGroup=e.target.value;await put('meta',SET)};
  document.getElementById('up').onchange=async e=>{const f=[...e.target.files];if(!f.length)return;modal('<h3>Adding photos…</h3><p>Resizing and saving on this device.</p>');try{await addFiles(f)}catch(err){await note('Some photos failed',esc(err&&err.message||err))}closeModal();rImages()};
  app.querySelectorAll('[data-ch]').forEach(c=>c.onchange=async()=>{const im=IMGS.find(i=>i.id===c.dataset.id);const k=c.dataset.ch;const v=c.type==='checkbox'?c.checked:c.value;
    const v2=k==='place'?String(v).trim():v;const sib=['group','set','place','complex'].includes(k)&&im.pair?IMGS.filter(i=>i.pair===im.pair):[im];for(const x of sib){x[k]=v2;await put('images',x)}await logA('image edited',`${im.id} ${k}=${v}`);rImages()})}
function tagModal(id){const im=IMGS.find(i=>i.id===id);const sel=new Set(im.tags||[]);
  const draw=()=>{modal(`<h3>Elements in ${esc(im.id)}</h3><p>Tick every coded element visible in this photo.${im.pair?' Applies to both photos in the pair.':''}</p><div class="chips">${codeList().map(c=>`<button class="chip sm${sel.has(c.code)?' on':''}" data-t="${esc(c.code)}">${esc(c.code)} · ${esc(c.label)}</button>`).join('')}</div><div class="row"><button class="btn" data-x>Cancel</button><button class="btn pri" data-s>Save</button></div>`);
    modalEl.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{const t=b.dataset.t;sel.has(t)?sel.delete(t):sel.add(t);draw()});
    modalEl.querySelector('[data-x]').onclick=closeModal;
    modalEl.querySelector('[data-s]').onclick=async()=>{const tags=codeList().map(c=>c.code).filter(c=>sel.has(c));const sib=im.pair?IMGS.filter(i=>i.pair===im.pair):[im];for(const x of sib){x.tags=tags.slice();await put('images',x)}await logA('elements tagged',`${im.id}: ${tags.join(' ')}`);closeModal();rImages()}};
  draw()}

async function rData(){const ps=(await all('participants')).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));const trs=await all('trials');const out=await all('outbox');const cnt={};trs.forEach(t=>cnt[t.pid]=(cnt[t.pid]||0)+1);
  const per={};trs.filter(t=>!String(t.image).startsWith('ATTN')&&!t.skipped).forEach(t=>{const p=per[t.image]=per[t.image]||{n:0,e:0,r:0,taps:0,group:t.group};p.n++;if(EAST.has(t.region))p.e++;if((t.recog||t.know)==='Yes')p.r++;p.taps+=(t.taps||[]).length});
  const pct=(a,b)=>b?Math.round(a/b*100)+'%':'—';
  app.innerHTML=`<div class="page"><div class="wrap"><button class="btn mini" data-act="home">‹ Back</button><h1>Data</h1><p class="sub">This screen shows answers saved on this device. ${SET.endpoint?`Online answers go to your sheet${out.length?`; <span class="warn">${out.length} still waiting to send</span> <button class="btn mini" data-act="flush">Send now</button>`:'; nothing waiting'}.`:'Online sending is off (no sheet address in Settings).'}</p>
  <h2>Live, from the sheet</h2><div id="live"><p class="sub">${SET.endpoint?'Loading…':'Add the sheet address in Settings to see live data.'}</p></div>
  <h2>On this device</h2>
  <div class="row" style="margin-bottom:8px"><button class="btn pri" data-act="exA">Answers (CSV)</button><button class="btn" data-act="exP">Participants (CSV)</button><button class="btn" data-act="exI">Images and elements (CSV)</button><button class="btn" data-act="exC">Opt-in emails (CSV)</button><button class="btn" data-act="exL">Change log (CSV)</button><button class="btn" data-act="exB">Full backup (JSON)</button><label class="btn" for="rs">Restore backup</label><input id="rs" type="file" accept="application/json,.json" hidden></div>
  <h3 style="margin:18px 0 8px">Per photo (this device)</h3><div style="overflow-x:auto"><table><thead><tr><th>Photo</th><th>Group</th><th class="n">Shown</th><th class="n">East / SE Asia</th><th class="n">Recognised</th><th class="n">Taps per view</th></tr></thead><tbody>
  ${Object.keys(per).sort().map(k=>{const p=per[k];return`<tr><td><b>${esc(k)}</b></td><td>${esc(GROUPS[p.group]||p.group||'')}</td><td class="n">${p.n}</td><td class="n">${pct(p.e,p.n)}</td><td class="n">${pct(p.r,p.n)}</td><td class="n">${(p.taps/p.n).toFixed(1)}</td></tr>`}).join('')||'<tr><td colspan="6" style="color:var(--dim)">No answers yet.</td></tr>'}</tbody></table></div>
  <h3 style="margin:18px 0 8px">Participants (this device)</h3><div style="overflow-x:auto"><table><thead><tr><th>ID</th><th>Started</th><th>Status</th><th>Check</th><th>Bonus</th><th class="n">Answers</th><th></th></tr></thead><tbody>
  ${ps.map(p=>`<tr><td><b>${esc(p.id)}</b></td><td>${esc(new Date(p.startedAt).toLocaleString())}</td><td>${esc(p.status)}</td><td>${p.attnPass==='yes'?'passed':p.attnPass==='no'?'<span class="warn">failed</span>':'—'}</td><td>${esc(p.bonusChoice||'—')}</td><td class="n">${cnt[p.id]||0}</td><td><button class="btn mini danger" data-act="rmP" data-id="${esc(p.id)}">Delete</button></td></tr>`).join('')||'<tr><td colspan="7" style="color:var(--dim)">No participants yet.</td></tr>'}</tbody></table></div>
  <h2>Danger zone</h2><button class="btn danger" data-act="wipe">Erase all participants and answers on this device</button></div></div>`;
  if(SET.endpoint)loadLive();
  document.getElementById('rs').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const b=JSON.parse(await f.text());
    if(!await ask('Restore this backup?',`${(b.participants||[]).length} participants and ${(b.trials||[]).length} answers will be added. Existing records with the same IDs are overwritten.`,'Restore'))return;
    for(const p of b.participants||[])await put('participants',p);for(const t of b.trials||[])await put('trials',t);await logA('backup restored',f.name);rData()}catch(err){note('Could not read that file',esc(err.message))}}}

function rSettings(){const chip=(k,v,label)=>`<button class="chip${String(SET[k])===String(v)?' on':''}" data-act="set" data-k="${k}" data-v="${v}">${esc(label)}</button>`;
  app.innerHTML=`<div class="page"><div class="wrap" style="max-width:760px"><button class="btn mini" data-act="home">‹ Back</button><h1>Settings</h1>
  <div class="field"><span class="lbl">Mode</span><div class="chips">${chip('mode','online','Online (people on their own devices)')}${chip('mode','inperson','In person (hand over this device)')}</div></div>
  <div class="field"><span class="lbl">Main photos per person</span><div class="chips">${[12,16,20,24,30].map(n=>chip('nMain',n,n)).join('')}</div></div>
  <div class="field"><span class="lbl">Bonus round</span><div class="chips">${chip('bonus',true,'Offer it')}${chip('bonus',false,'Off')}${[6,8,10,12].map(n=>chip('nBonus',n,n+' photos')).join('')}</div></div>
  <div class="field"><span class="lbl">Photo selection</span><div class="chips">${chip('order','random','Random sample, balanced by group')}${chip('order','fixed','All photos, list order (testing)')}</div></div>
  <div class="field"><span class="lbl">Attention check (one screen in the main round)</span><div class="chips">${chip('attn',true,'On')}${chip('attn',false,'Off')}</div></div>
  <div class="field"><span class="lbl">Recognition switch wording</span><div class="chips">${chip('recog','recognise','I recognise this place')}${chip('recog','been','I\'ve been to this place')}</div></div>
  <div class="field"><label for="ct2">Your contact email (shown on the start and end screens)</label><input id="ct2" type="email" value="${esc(SET.contact)}" placeholder="you@college.ac.in" autocomplete="off"></div>
  <div class="field"><label for="in2">Institution line, completes “an academic design research project …” (e.g. “at IIT Hyderabad”). Leave empty to leave it out.</label><input id="in2" type="text" value="${esc(SET.inst)}" autocomplete="off"></div>
  <div class="field"><label for="ep">Sheet address (Apps Script web app URL). Leave empty to keep answers on this device only.</label><input id="ep" type="url" value="${esc(SET.endpoint)}" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></div>
  <div class="field"><label for="cd">Element codes, one per line: code, then a short label. Changing a code does not change photos already tagged.</label><textarea id="cd" style="min-height:260px;font-size:14px">${esc(SET.codes)}</textarea><div class="row" style="margin-top:8px"><button class="btn" data-act="saveCodes">Save codes</button><button class="btn" data-act="resetCodes">Reset to default list</button></div></div>
  <p class="sub">Changes apply to the next participant and are logged.</p></div></div>`;
  document.getElementById('ct2').onchange=async e=>{SET.contact=e.target.value.trim();await put('meta',SET);await logA('setting changed','contact')};
  document.getElementById('in2').onchange=async e=>{SET.inst=e.target.value.trim();await put('meta',SET);await logA('setting changed','institution')};
  document.getElementById('ep').onchange=async e=>{SET.endpoint=e.target.value.trim();await put('meta',SET);await logA('setting changed','endpoint');flush()}}
async function rLog(){const l=(await all('log')).reverse();app.innerHTML=`<div class="page"><div class="wrap"><button class="btn mini" data-act="home">‹ Back</button><h1>Change log</h1><div class="logbox"><table><tbody>${l.map(x=>`<tr><td>${esc(new Date(x.ts).toLocaleString())}</td><td>${esc(x.pid)}</td><td>${esc(x.action)}</td><td>${esc(x.detail)}</td></tr>`).join('')||'<tr><td style="color:var(--dim)">Nothing yet.</td></tr>'}</tbody></table></div></div></div>`}

/* ---------- live data (admin) ---------- */
let LIVE=null,liveTimer=null;
// Google Sheets turns text like "008" into the number 8; map it back to the photo's real ID.
const normId=x=>{const v=String(x??'');if(URLS[v]||IMGS.some(i=>i.id===v))return v;if(/^\d+$/.test(v)){const p=v.padStart(3,'0');if(URLS[p]||IMGS.some(i=>i.id===p))return p}return v};
const perPhoto=rows=>{const per={};rows.filter(t=>!String(t.image).startsWith('ATTN')&&t.skipped!=='yes').forEach(t=>{const id=normId(t.image);const p=per[id]=per[id]||{n:0,e:0,r:0,taps:0,group:t.group};p.n++;if(EAST.has(t.region))p.e++;if(t.recognise==='Yes')p.r++;p.taps+=+t.n_taps||0});return per};
async function loadLive(){const box=document.getElementById('live');if(!box)return;
  try{const d=await sheetGet('all');if(!document.getElementById('live'))return;if(!d.ok){box.innerHTML='<p class="warn">The sheet refused the PIN.</p>';return}LIVE=d;drawLive()}
  catch(e){box.innerHTML=`<p class="warn">Couldn't reach the sheet. ${esc(e.message||'')}</p>`}
  clearTimeout(liveTimer);liveTimer=setTimeout(()=>{if(document.getElementById('live'))loadLive()},30000)}
function drawLive(){const box=document.getElementById('live');if(!box||!LIVE)return;const A=LIVE.answers||[],P=LIVE.participants||[],C=LIVE.contacts||[];
  const started=new Set(A.map(r=>r.participant)).size,done=P.filter(p=>p.status==='complete').length,fail=P.filter(p=>p.attention_pass==='no').length;
  const per=perPhoto(A);const pct=(a,b)=>b?Math.round(a/b*100)+'%':'—';
  box.innerHTML=`<p class="sub">${started} people started · ${done} finished · ${fail} failed the check · ${A.length} answers · ${C.length} opt-in emails · updated ${new Date().toLocaleTimeString()} (refreshes every 30 s)</p>
  <div class="row" style="margin-bottom:8px"><button class="btn" data-act="liveRefresh">Refresh now</button><button class="btn" data-act="liveA">Answers (CSV)</button><button class="btn" data-act="liveP">Participants (CSV)</button><button class="btn" data-act="liveC">Emails (CSV)</button></div>
  <div style="overflow-x:auto"><table><thead><tr><th>Photo</th><th>Group</th><th class="n">Shown</th><th class="n">East / SE Asia</th><th class="n">Recognised</th><th class="n">Taps per view</th></tr></thead><tbody>
  ${Object.keys(per).sort().map(k=>{const p=per[k];return`<tr><td><b>${esc(k)}</b></td><td>${esc(GROUPS[p.group]||p.group||'')}</td><td class="n">${p.n}</td><td class="n">${pct(p.e,p.n)}</td><td class="n">${pct(p.r,p.n)}</td><td class="n">${(p.taps/p.n).toFixed(1)}</td></tr>`}).join('')||'<tr><td colspan="6" style="color:var(--dim)">No answers yet.</td></tr>'}</tbody></table></div>`}
function saveBlob(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000)}
function loadScript(src){return new Promise((res,rej)=>{const sc=document.createElement('script');sc.src=src;sc.onload=res;sc.onerror=rej;document.head.appendChild(sc)})}
const SITE_KEYS=['nMain','nBonus','bonus','attn','recog','order','endpoint','contact','inst'];
async function exportSite(){const{out}=imgIssues();if(out.length&&!await ask('Export anyway?',out.map(esc).join('<br>'),'Export'))return;
  modal('<h3>Building the zip…</h3>');
  try{if(!window.JSZip)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    const z=new JSZip(),f=z.folder('photos');const list=IMGS.filter(i=>!i.hidden);
    const man={app:VER,exported_at:iso(),settings:Object.fromEntries(SITE_KEYS.map(k=>[k,SET[k]])),images:list.map(i=>({id:i.id,file:i.id+'.jpg',set:i.set,group:i.group,tags:i.tags||[],pair:i.pair,ver:i.ver,place:i.place||'',complex:!!i.complex}))};
    f.file('manifest.json',JSON.stringify(man,null,1));for(const i of list)f.file(i.id+'.jpg',i.blob);
    f.file('images.csv',objCSV(list.map((i,k)=>({number:k+1,image:i.id,original_file:i.name,round:i.set,group:i.group,place:i.place||'',complex:i.complex?'yes':'',pair:i.pair,version:i.ver,elements:(i.tags||[]).join(' ')}))));
    const blob=await z.generateAsync({type:'blob'});closeModal();saveBlob(`photos_${stamp()}.zip`,blob);await logA('website export',`${list.length} photos`)}
  catch(e){closeModal();note('Export failed',esc(e.message||e))}}
async function loadSite(){if(!await ask('Load from the live site?','Photos, groups, tags and settings from the site replace what is on this device. Answers on this device are kept.','Load'))return;
  modal('<h3>Loading…</h3>');
  try{const r=await fetch('photos/manifest.json',{cache:'no-store'});if(!r.ok)throw new Error('No photos/manifest.json on the site yet');const man=await r.json();
    for(const i of IMGS)await del('images',i.id);let idx=0;
    for(const m of man.images||[]){const b=await (await fetch('photos/'+encodeURIComponent(m.file),{cache:'no-store'})).blob();
      const dim=await new Promise(res=>{const u=URL.createObjectURL(b),im=new Image();im.onload=()=>{res([im.naturalWidth,im.naturalHeight]);URL.revokeObjectURL(u)};im.onerror=()=>res([0,0]);im.src=u});
      await put('images',{id:m.id,name:m.file,set:m.set,group:m.group,tags:m.tags||[],pair:m.pair||'',ver:m.ver||'',place:m.place||'',complex:!!m.complex,hidden:false,idx:idx++,blob:b,w:dim[0],h:dim[1]})}
    for(const k of SITE_KEYS)if(man.settings&&k in man.settings)SET[k]=man.settings[k];await put('meta',SET);
    Object.keys(URLS).forEach(k=>{URL.revokeObjectURL(URLS[k]);delete URLS[k]});await loadImgs();await logA('loaded from site',`${IMGS.length} photos`);closeModal();rHome()}
  catch(e){closeModal();note('Could not load',esc(e.message||e))}}
function rPin(msg){app.innerHTML=`<div class="center"><div class="box" style="max-width:420px"><h1>Researcher access</h1><p>Enter the PIN you set in the sheet's script.</p>
  <input id="pin" type="password" autocomplete="current-password" style="text-align:center;font-size:22px;margin-top:8px"><p class="warn" id="pe">${esc(msg||'')}</p><button class="btn pri big" data-act="pinGo">Unlock</button></div></div>`;
  const i=document.getElementById('pin');i.focus();i.onkeydown=e=>{if(e.key==='Enter')document.querySelector('[data-act=pinGo]').click()}}

/* ---------- live heatmaps (admin) ---------- */
let HEAT={cue:'All',norec:false,timer:null};
function tapsByImage(rows){const m={};for(const r of rows){if(String(r.image).startsWith('ATTN')||r.skipped==='yes')continue;if(HEAT.norec&&r.recognise==='Yes')continue;
  const id=normId(r.image);const o=m[id]=m[id]||{views:0,ea:0,taps:[],group:r.group};o.views++;if(EAST.has(r.region))o.ea++;
  for(let k=1;k<=MAXTAPS;k++){const x=parseFloat(r[`tap${k}_x`]),y=parseFloat(r[`tap${k}_y`]),c=r[`tap${k}_cue`];if(isNaN(x)||isNaN(y))continue;if(HEAT.cue!=='All'&&c!==HEAT.cue)continue;o.taps.push([x,y])}}return m}
const HEAT_RAMP=[[0,[60,40,120,0]],[.25,[90,60,200,140]],[.5,[166,142,230,190]],[.75,[236,200,120,215]],[1,[255,250,235,235]]];
function rampAt(t){for(let i=1;i<HEAT_RAMP.length;i++){const[a,ca]=HEAT_RAMP[i-1],[b,cb]=HEAT_RAMP[i];if(t<=b){const f=(t-a)/(b-a);return ca.map((v,j)=>v+(cb[j]-v)*f)}}return HEAT_RAMP[HEAT_RAMP.length-1][1]}
function drawHeat(cv,id,taps){const S2=cv.width,g=cv.getContext('2d');g.fillStyle='#111';g.fillRect(0,0,S2,S2);
  const fin=()=>{if(!taps.length)return;const off=document.createElement('canvas');off.width=off.height=S2;const o=off.getContext('2d');const r=S2*.09;
    for(const[x,y]of taps){const gr=o.createRadialGradient(x*S2,y*S2,0,x*S2,y*S2,r);gr.addColorStop(0,'rgba(0,0,0,0.35)');gr.addColorStop(1,'rgba(0,0,0,0)');o.fillStyle=gr;o.fillRect(x*S2-r,y*S2-r,2*r,2*r)}
    const d=o.getImageData(0,0,S2,S2),px=d.data;let mx=0;for(let i=3;i<px.length;i+=4)if(px[i]>mx)mx=px[i];if(!mx)return;
    for(let i=0;i<px.length;i+=4){const t=px[i+3]/mx;if(t<.02){px[i+3]=0;continue}const c=rampAt(t);px[i]=c[0];px[i+1]=c[1];px[i+2]=c[2];px[i+3]=c[3]}
    o.putImageData(d,0,0);g.drawImage(off,0,0)};
  const src=URLS[id];if(!src){fin();return}const im=new Image();im.onload=()=>{const s=Math.min(im.naturalWidth,im.naturalHeight);g.drawImage(im,(im.naturalWidth-s)/2,(im.naturalHeight-s)/2,s,s,0,0,S2,S2);g.fillStyle='rgba(0,0,0,.35)';g.fillRect(0,0,S2,S2);fin()};im.onerror=fin;im.src=src}
async function rHeat(){clearTimeout(HEAT.timer);
  app.innerHTML=`<div class="page"><div class="wrap" style="max-width:1240px"><button class="btn mini" data-act="home">‹ Back</button><h1>Where people tap</h1><p class="sub" id="hs">Loading from the sheet…</p>
  <div class="chips" style="margin-bottom:10px">${['All',...CUES].map(c=>`<button class="chip sm${HEAT.cue===c?' on':''}" data-act="heatCue" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  <label class="chk" style="margin-bottom:14px"><input type="checkbox" id="norec" ${HEAT.norec?'checked':''}> Leave out answers where the person recognised the place</label>
  <div id="hg" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px"></div></div></div>`;
  document.getElementById('norec').onchange=e=>{HEAT.norec=e.target.checked;drawHeatGrid()};
  await refreshHeat()}
async function refreshHeat(){try{const d=await sheetGet('all');if(!document.getElementById('hg'))return;if(d.ok){LIVE=d;drawHeatGrid()}else document.getElementById('hs').innerHTML='<span class="warn">The sheet refused the PIN.</span>'}
  catch(e){const h=document.getElementById('hs');if(h)h.innerHTML='<span class="warn">Couldn\'t reach the sheet. Retrying in 30 s.</span>'}
  clearTimeout(HEAT.timer);HEAT.timer=setTimeout(()=>{if(document.getElementById('hg'))refreshHeat()},30000)}
function drawHeatGrid(){const hg=document.getElementById('hg');if(!hg||!LIVE)return;const A=LIVE.answers||[],m=tapsByImage(A);const people=new Set(A.map(r=>r.participant)).size;
  const total=Object.values(m).reduce((s,o)=>s+o.taps.length,0);
  document.getElementById('hs').textContent=`${people} people · ${A.length} answers · ${total} taps shown · updated ${new Date().toLocaleTimeString()} · refreshes every 30 s`;
  const ids=Object.keys(m).sort((a,b)=>m[b].taps.length-m[a].taps.length);
  hg.innerHTML=ids.map(id=>`<button class="card" data-act="heatBig" data-id="${esc(id)}" style="padding:10px;text-align:left"><canvas width="460" height="460" data-h="${esc(id)}" style="width:100%;border-radius:8px;display:block"></canvas><div style="margin-top:8px;font-size:14px"><b>${esc(id)}</b> · ${esc(GROUPS[m[id].group]||m[id].group||'')}<br><span style="color:var(--dim)">${m[id].views} view${m[id].views===1?'':'s'} · ${m[id].views?Math.round(m[id].ea/m[id].views*100):0}% East / SE Asia · ${m[id].taps.length} tap${m[id].taps.length===1?'':'s'}</span></div></button>`).join('')||'<p class="sub">No answers yet.</p>';
  hg.querySelectorAll('canvas[data-h]').forEach(cv=>drawHeat(cv,cv.dataset.h,m[cv.dataset.h].taps))}
function heatBig(id){const m=tapsByImage((LIVE&&LIVE.answers)||[])[id];if(!m)return;modal(`<h3>${esc(id)} · ${m.taps.length} taps · ${m.views} views</h3><canvas id="hb" width="900" height="900" style="width:100%;border-radius:10px"></canvas><div class="row"><button class="btn pri" data-x>Close</button></div>`);
  modalEl.querySelector('.dlg').style.width='min(86vh,96vw)';drawHeat(document.getElementById('hb'),id,m.taps);modalEl.querySelector('[data-x]').onclick=closeModal}

/* ---------- actions ---------- */
app.addEventListener('click',async e=>{const b=e.target.closest('[data-act]');if(!b||b.disabled)return;const a=b.dataset.act,v=b.dataset.v;
  switch(a){
  case 'region':{if(T.region===v)return;const t=el();if(T.rtRegionFirst==null)T.rtRegionFirst=t;else T.regionChanges++;T.rtRegionFinal=t;
    T.region=v;if(v!=='Somewhere specific')T.other='';if(!tappable()&&(T.taps.length||T.pending)){T.tapsDiscarded+=T.taps.length;T.taps=[];T.pending=null}rSide();break}
  case 'cue':T.taps.push({...T.pending,cue:v,cueRt:el()});T.pending=null;rSide();break;
  case 'rmTap':T.taps.splice(+b.dataset.k,1);T.tapRemovals++;rSide();break;
  case 'cancelTap':T.pending=null;T.tapCancels++;rSide();break;
  case 'recog':T.recog=T.recog==='Yes'?'No':'Yes';T.recogChanged=true;T.rtRecog=el();rSide();break;
  case 'next':b.disabled=true;await saveTrial(false);advance();break;
  case 'help':T.helps++;modal(`<h3>How this works</h3>${HOWTO()}<div class="row"><button class="btn pri" data-x>Got it</button></div>`);modalEl.querySelector('[data-x]').onclick=closeModal;break;
  case 'bonusStop':if(await ask('Stop here?','Your answers so far are saved.','Stop','Keep going')){await setPart({bonusChoice:'yes, stopped after '+S.i});finish('complete')}break;
  case 'toWelcome':rWelcome();break;
  case 'toAbout':SCR={};rAbout();break;
  case 'scr':SCR[b.dataset.k]=v;rAbout();break;
  case 'pickCountry':picker('Which country do you live in?',['India',...COUNTRIES.filter(c=>c!=='India')],SCR.country,c=>{if(c!==SCR.country){SCR.country=c;if(c!=='India')SCR.state=''}rAbout()});break;
  case 'pickState':picker('State or union territory',STATES,SCR.state,c=>{SCR.state=c;rAbout()});break;
  case 'optin':b.disabled=true;sendOptin();break;
  case 'startP':if(!aboutOk())return;OPTIN={sent:false};startSession({age:SCR.age,design:SCR.design,media:SCR.media,beenEA:SCR.beenEA,country:matchCountry(SCR.country),state:matchCountry(SCR.country)==='India'?SCR.state:'',audio:SET.mode==='inperson'?SCR.audio:'',consent:true,rnote:''});break;
  case 'begin':S.stage='trial';await saveSession();await logA('participant started');rTrial();break;
  case 'bonusYes':S.phase='bonus';S.i=0;S.stage='trial';await setPart({bonusChoice:'yes'});await saveSession();await logA('bonus accepted');rTrial();break;
  case 'bonusNo':await setPart({bonusChoice:'no'});await logA('bonus declined');finish('complete');break;
  case 'handBack':if(await ask('Back to the start screen?','','Yes','No')){S=null;await saveSession();rWelcome()}break;
  case 'home':rHome();break;
  case 'undone':await del('meta','done');{const ss=await get('meta','session');if(ss&&ss.stage==='thanks')await del('meta','session')}await logA('device reset for another go');rHome();break;
  case 'resume':S=await get('meta','session');await logA('session resumed');render();break;
  case 'abandon':{const s=await get('meta','session');if(await ask(`End ${s.pid}'s session?`,'Answers so far are kept and the participant is marked as ended early.','End it')){S=s;await setPart({endedAt:iso(),status:'ended early'});await logA('session ended early');S=null;await saveSession();rHome()}break}
  case 'images':rImages();break;
  case 'tags':tagModal(b.dataset.id);break;
  case 'demo':if(IMGS.length&&!await ask('Load demo placeholders?','They are added alongside your photos and removed automatically when you add real ones.','Load'))return;modal('<h3>Making placeholders…</h3>');await demoSet();closeModal();rImages();break;
  case 'rmAll':if(await ask('Remove all photos?','Answers already collected are kept.','Remove all')){for(const i of IMGS)await del('images',i.id);await loadImgs();await logA('all images removed');rImages()}break;
  case 'rmImg':if(await ask(`Remove ${b.dataset.id}?`,'','Remove')){await del('images',b.dataset.id);await loadImgs();await logA('image removed',b.dataset.id);rImages()}break;
  case 'mv':{const k=IMGS.findIndex(i=>i.id===b.dataset.id),j=k+(+b.dataset.d);[IMGS[k].idx,IMGS[j].idx]=[IMGS[j].idx,IMGS[k].idx];await put('images',IMGS[k]);await put('images',IMGS[j]);await loadImgs();await logA('image moved',b.dataset.id);rImages();break}
  case 'data':rData();break;
  case 'flush':await flush();rData();break;
  case 'exA':exportAnswers();break;case 'exP':exportParticipants();break;case 'exI':exportImages();break;
  case 'exSite':exportSite();break;case 'loadSite':loadSite();break;
  case 'lock':setPin('');rPin();break;
  case 'pinGo':{const v=document.getElementById('pin').value;b.disabled=true;try{const d=await sheetGet('ping',v);if(d.ok){setPin(v);await logA('unlocked');rHome()}else rPin('That PIN is wrong.')}catch(e){rPin("Couldn't reach the sheet. Check the address and your connection.")}break}
  case 'liveRefresh':loadLive();break;
  case 'heat':rHeat();break;
  case 'heatCue':HEAT.cue=v;document.querySelectorAll('[data-act=heatCue]').forEach(x=>x.classList.toggle('on',x.dataset.v===v));drawHeatGrid();break;
  case 'heatBig':heatBig(b.dataset.id);break;
  case 'liveA':if(LIVE)saveFile(`sheet_answers_${stamp()}.csv`,objCSV(LIVE.answers||[]),'text/csv');break;
  case 'liveP':if(LIVE)saveFile(`sheet_participants_${stamp()}.csv`,objCSV(LIVE.participants||[]),'text/csv');break;
  case 'liveC':if(LIVE)saveFile(`sheet_emails_${stamp()}.csv`,objCSV(LIVE.contacts||[]),'text/csv');break;case 'exC':{const c=await all('contacts');saveFile(`emails_${stamp()}.csv`,objCSV(c.length?c.map(({k,...r})=>r):[{email:'',send_findings:'',future_rounds:'',submitted_at:''}]),'text/csv');break}case 'exL':exportLog();break;case 'exB':exportBackup();break;
  case 'rmP':if(await ask(`Delete ${b.dataset.id}?`,'Their answers on this device are deleted for good. Rows already sent to the sheet are not affected.','Delete')){const id=b.dataset.id;for(const t of (await all('trials')).filter(t=>t.pid===id))await del('trials',t.id);await del('participants',id);await logA('participant deleted',id);rData()}break;
  case 'wipe':if(await ask('Erase all participants and answers on this device?','This cannot be undone. Export a backup first. Photos and settings are kept.','Erase everything')){await clearSt('trials');await clearSt('participants');await clearSt('outbox');await del('meta','session');await logA('all data erased');rData()}break;
  case 'settings':rSettings();break;
  case 'set':{const k=b.dataset.k;SET[k]=(k==='nMain'||k==='nBonus')?+v:(k==='bonus'||k==='attn')?v==='true':v;await put('meta',SET);await logA('setting changed',`${k}=${SET[k]}`);rSettings();break}
  case 'saveCodes':SET.codes=document.getElementById('cd').value;await put('meta',SET);await logA('element codes changed');rSettings();break;
  case 'resetCodes':if(await ask('Reset the code list?','Photos keep the tags they already have.','Reset')){SET.codes=DEF_CODES;await put('meta',SET);await logA('element codes reset');rSettings()}break;
  case 'log':rLog();break;
  }});
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('gesturestart',e=>e.preventDefault());

async function bootPublic(){let man=null;
  try{const r=await fetch('photos/manifest.json',{cache:'no-store'});if(r.ok)man=await r.json()}catch(e){}
  if(!man||!(man.images||[]).length){app.innerHTML='<div class="center"><div class="box"><h1>Not open yet</h1><p>This study isn\'t taking answers yet. Please check back soon.</p></div></div>';return}
  for(const k of SITE_KEYS)if(man.settings&&k in man.settings)SET[k]=man.settings[k];SET.mode='online';
  IMGS=man.images.map((i,k)=>({...i,idx:k,hidden:false,tags:i.tags||[]}));IMGS.forEach(i=>URLS[i.id]='photos/'+encodeURIComponent(i.file));
  await ready();flush();
  const sess=await get('meta','session');if(sess&&sess.stage&&sess.stage!=='thanks'){S=sess;return render()}
  rWelcome()}
async function bootAdmin(){await ready();const s=await get('meta','settings');if(s)SET={...SET,...s};if(SET.mode!=='online'&&SET.mode!=='inperson')SET.mode='online';await loadImgs();
  try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}flush();
  if(SET.endpoint&&!getPin())return rPin();
  rHome()}
(MODE==='public'?bootPublic():bootAdmin()).catch(e=>{app.innerHTML=`<div class="center"><div class="box"><h1>Something went wrong</h1><p>${esc(e&&e.message||e)}</p></div></div>`});
