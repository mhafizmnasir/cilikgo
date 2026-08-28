import { firebaseConfig, USE_FIREBASE, FUNCTIONS_BASE_URL } from './firebase.js';

let fb = null, firebaseInitError = null, currentProfile = null, activeChild = null, userChildren = [];
const gameKeyToModule={read:'Membaca',write:'Menulis',count:'Mengira'};
if (USE_FIREBASE) {
  try {
    const appMod = await import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js');
    const dbMod = await import('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js');
    const app = appMod.initializeApp(firebaseConfig);
    fb = { auth: authMod.getAuth(app), db: dbMod.getFirestore(app), ...authMod, ...dbMod };
  } catch (error) { firebaseInitError = error; console.error('Firebase gagal dimulakan:', error); }
}

const $ = s => document.querySelector(s);
function setButtonLoading(btn,loading,label='Memproses…'){
  if(!btn)return;
  if(loading){btn.dataset.oldText=btn.textContent;btn.disabled=true;btn.textContent=label;btn.setAttribute('aria-busy','true');}
  else{btn.disabled=false;btn.textContent=btn.dataset.oldText||btn.textContent;btn.removeAttribute('aria-busy');}
}
window.addEventListener('unhandledrejection',e=>{console.error('Unhandled promise:',e.reason);});



const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let toastTimer;
const toast = msg => {
  const t = $('#toast');
  if (!t) return;

  // A modal <dialog> opened with showModal() lives in the browser top layer.
  // A toast left under <body> cannot appear above that backdrop regardless of z-index.
  // Move the toast into the currently-open dialog so it stays sharp and visible.
  const openDialogs = [...document.querySelectorAll('dialog[open]')];
  const activeDialog = openDialogs.at(-1);
  const targetHost = activeDialog || document.body;
  if (t.parentElement !== targetHost) targetHost.appendChild(t);

  t.textContent = msg;
  t.classList.remove('show');
  // Restart animation reliably for consecutive notifications.
  void t.offsetWidth;
  t.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => {
      // Return it to body after hiding so it is ready for non-modal notifications.
      if (t.parentElement !== document.body) document.body.appendChild(t);
    }, 300);
  }, 3000);
};

document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>$('#'+b.dataset.open).showModal());
document.querySelectorAll('dialog .x').forEach(b=>b.onclick=()=>b.closest('dialog').close());
const paymentParams = new URLSearchParams(location.search);
const paymentStatus = paymentParams.get('status_id');
if(paymentParams.has('payment') || paymentStatus){
  if(paymentStatus==='1') toast('Pembayaran diterima. Status langganan akan dikemas kini sebentar lagi.');
  else if(paymentStatus==='2') toast('Pembayaran masih diproses.');
  else if(paymentStatus==='3') toast('Pembayaran tidak berjaya. Anda boleh cuba semula.');
}

const ref = new URLSearchParams(location.search).get('ref');
if(ref){
  const cleanRef=String(ref).trim();
  if(/^CG-[A-Za-z0-9_-]{7,128}$/.test(cleanRef)){
    localStorage.setItem('cilikgo_ref',cleanRef);
    localStorage.setItem('cilikgo_ref_saved_at',String(Date.now()));
    toast('Kod agent telah direkodkan.');
  }
}
$('#agentSignupBtn').onclick=()=>{ $('#regRole').value='agent'; $('#registerModal').showModal(); };

function friendlyError(e){
  return ({'auth/invalid-credential':'E-mel atau kata laluan tidak tepat.','auth/email-already-in-use':'E-mel ini sudah didaftarkan.','auth/weak-password':'Kata laluan terlalu lemah.','auth/too-many-requests':'Terlalu banyak cubaan. Cuba semula sebentar lagi.','auth/user-disabled':'Akaun ini telah dinyahaktifkan.'})[e.code] || e.message || 'Ralat tidak diketahui.';
}

$('#registerBtn').onclick=async()=>{
  const name=$('#regName').value.trim(), email=$('#regEmail').value.trim(), pass=$('#regPassword').value, role=$('#regRole').value;
  if(!name||!email||pass.length<6) return toast('Sila lengkapkan maklumat. Kata laluan minimum 6 aksara.');
  if(!fb) return toast('Firebase tidak dapat disambungkan.');
  try{
    const cred=await fb.createUserWithEmailAndPassword(fb.auth,email,pass);
    const agentCode=role==='agent'?'CG-'+cred.user.uid:null;
    const refSavedAt=Number(localStorage.getItem('cilikgo_ref_saved_at')||0);
    const storedRef=(Date.now()-refSavedAt)<=30*24*60*60*1000?localStorage.getItem('cilikgo_ref'):null;
    const referredByCode=role==='user'?(storedRef||null):null;
    await fb.setDoc(fb.doc(fb.db,'users',cred.user.uid),{name,email,role,agentCode,referredByCode,createdAt:fb.serverTimestamp(),subscriptionStatus:'inactive'});
    $('#registerModal').close(); toast('Akaun berjaya didaftarkan.');
  }catch(e){ console.error(e); toast(friendlyError(e)); }
};

$('#loginBtn').onclick=async()=>{
  const email=$('#loginEmail').value.trim(), password=$('#loginPassword').value;
  if(!email||!password) return toast('Masukkan e-mel dan kata laluan.');
  if(!fb){ console.error(firebaseInitError); return toast('Firebase tidak dapat disambungkan.'); }
  try{ await fb.signInWithEmailAndPassword(fb.auth,email,password); $('#loginModal').close(); toast('Log masuk berjaya.'); }
  catch(e){ console.error(e); toast('Log masuk gagal: '+friendlyError(e)); }
};

$('#forgotBtn').onclick=async()=>{
  const email=$('#loginEmail').value.trim(); if(!email) return toast('Masukkan e-mel terlebih dahulu.');
  try{ await fb.sendPasswordResetEmail(fb.auth,email); toast('E-mel reset kata laluan telah dihantar.'); }catch(e){ toast(friendlyError(e)); }
};
$('#logoutBtn').onclick=async()=>{ await fb.signOut(fb.auth); toast('Anda telah log keluar.'); location.hash='home'; };
$('#dashboardBtn').onclick=()=>$('#portal').scrollIntoView({behavior:'smooth'});

async function getProfile(user){
  const snap=await fb.getDoc(fb.doc(fb.db,'users',user.uid));
  if(snap.exists()) return {uid:user.uid,...snap.data()};
  const fallback={name:user.displayName||user.email?.split('@')[0]||'Pengguna',email:user.email||'',role:'user',agentCode:null,referredByCode:null,subscriptionStatus:'inactive',createdAt:fb.serverTimestamp()};
  await fb.setDoc(fb.doc(fb.db,'users',user.uid),fallback,{merge:true}); return {uid:user.uid,...fallback};
}

async function loadChildren(uid){
  const q=fb.query(fb.collection(fb.db,'children'),fb.where('ownerUid','==',uid));
  userChildren=(await fb.getDocs(q)).docs.map(d=>({id:d.id,...d.data()}));
  const saved=localStorage.getItem('cilikgo_active_child');
  activeChild=userChildren.find(c=>c.id===saved)||userChildren[0]||null;
  return userChildren;
}

async function loadProgress(uid,childId){
  if(!childId) return [];
  try{
    const q=fb.query(fb.collection(fb.db,'progress'),fb.where('ownerUid','==',uid),fb.where('childId','==',childId));
    return (await fb.getDocs(q)).docs.map(d=>({id:d.id,...d.data()}));
  }catch(e){ console.warn('progress',e); return []; }
}

async function loadAllProgress(uid){
  try{
    const q=fb.query(fb.collection(fb.db,'progress'),fb.where('ownerUid','==',uid));
    return (await fb.getDocs(q)).docs.map(d=>({id:d.id,...d.data()}));
  }catch(e){ console.warn('all progress',e); return []; }
}

function formatDate(value){
  if(!value) return '-';
  const d=value?.toDate?value.toDate():new Date(value);
  if(Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ms-MY',{day:'2-digit',month:'short',year:'numeric'});
}

function childProgressSummary(rows){
  const modules=['Membaca','Menulis','Mengira'];
  const byModule={};
  modules.forEach(m=>{
    const r=rows.filter(x=>x.module===m);
    const stars=r.reduce((s,x)=>s+Number(x.stars||0),0);
    const attempts=r.reduce((s,x)=>s+Number(x.attempts||0),0);
    const levels=r.map(x=>Number(x.level||0)).filter(Boolean);
    byModule[m]={rows:r.length,stars,attempts,level:levels.length?Math.max(...levels):1,efficiency:attempts?Math.round(stars/(attempts*3)*100):0};
  });
  return byModule;
}
function parentRecommendation(summary){
  const names=Object.keys(summary);
  const practiced=names.filter(n=>summary[n].rows>0);
  if(!practiced.length) return {title:'Mulakan dengan aktiviti ringkas',text:'Pilih satu modul 3M dan lengkapkan Level 1 bersama anak.',module:'Membaca'};
  const weakest=[...practiced].sort((a,b)=>(summary[a].efficiency||0)-(summary[b].efficiency||0))[0];
  const strongest=[...practiced].sort((a,b)=>(summary[b].efficiency||0)-(summary[a].efficiency||0))[0];
  return {title:`Latih ${weakest} seterusnya`,text:`${strongest} menunjukkan prestasi yang baik. Beri sedikit latihan tambahan pada ${weakest} untuk seimbangkan perkembangan 3M.`,module:weakest,strongest};
}


const SUBSCRIPTION_PLANS={
  starter:{id:'starter',name:'Pakej Permulaan',amount:69,durationMonths:4},
  renewal:{id:'renewal',name:'Renewal Bulanan',amount:15,durationMonths:1}
};
function subscriptionState(p){
  const raw=p?.subscriptionEndsAt?.toDate?.()||p?.subscriptionEndsAt||null;
  const end=raw?new Date(raw):null;
  const active=p?.subscriptionStatus==='active'&&end&&end.getTime()>Date.now();
  const expired=!!end&&end.getTime()<=Date.now();
  return {active,expired,end,status:active?'active':expired?'expired':(p?.subscriptionStatus||'inactive')};
}
function subscriptionDaysLeft(p){
  const s=subscriptionState(p);
  return s.active?Math.max(0,Math.ceil((s.end-Date.now())/86400000)):0;
}
async function createPendingSubscriptionOrder(planId){
  if(!fb?.auth.currentUser) throw new Error('Sila log masuk semula.');
  const plan=SUBSCRIPTION_PLANS[planId];
  if(!plan) throw new Error('Pelan tidak sah.');
  const profile=await loadProfile(fb.auth.currentUser);
  const order={
    userUid:fb.auth.currentUser.uid,
    plan:plan.id,
    planName:plan.name,
    amount:plan.amount,
    durationMonths:plan.durationMonths,
    currency:'MYR',
    status:'pending',
    paymentGateway:'toyyibpay',
    paymentStatus:'not_started',
    agentRef:profile?.referredByCode||null,
    createdAt:fb.serverTimestamp(),
    updatedAt:fb.serverTimestamp()
  };
  const ref=await fb.addDoc(fb.collection(fb.db,'orders'),order);
  return {id:ref.id,...order};
}


function renderParentSubscriptionView(p){
  const sub=subscriptionState(p),days=subscriptionDaysLeft(p);
  const startRaw=p?.subscriptionStartedAt?.toDate?.()||p?.subscriptionStartedAt||null;
  const start=startRaw?new Date(startRaw):null;
  const end=sub.end;
  const active=sub.active,expired=sub.expired;
  const title=active?'Langganan Aktif':expired?'Langganan Tamat':'Belum Melanggan';
  const price=active?'RM15':expired?'RM15':'RM69';
  const period=active?'renewal 1 bulan':expired?'untuk 1 bulan':'untuk 4 bulan pertama';
  const desc=active
    ?`Akses penuh Modul 3M sedang aktif. Anda mempunyai ${days} hari lagi.`
    :expired?'Akses Modul 3M dikunci sehingga langganan diperbaharui.':'Aktifkan akses penuh Membaca, Menulis dan Mengira untuk anak anda.';
  $('#dashboard').innerHTML=`<section class="parent-sub-page container">
    <button class="btn ghost parent-sub-back">← Kembali ke Dashboard</button>
    <div class="parent-sub-hero">
      <span class="badge">${active?'AKTIF':expired?'TAMAT':'PELAN CILIKGO'}</span>
      <h1>${title}</h1><p>${desc}</p>
    </div>
    <div class="parent-sub-card">
      <div>
        <small>Pelan semasa</small>
        <h2>${active?'Akses Penuh CilikGo':expired?'Renewal CilikGo':'Pakej Permulaan'}</h2>
        <div class="sub-detail-grid">
          <div><small>Tarikh mula</small><b>${start?start.toLocaleDateString('ms-MY'):'-'}</b></div>
          <div><small>Tarikh tamat</small><b>${end?end.toLocaleDateString('ms-MY'):'-'}</b></div>
          <div><small>Baki akses</small><b>${active?days+' hari':expired?'0 hari':'-'}</b></div>
          <div><small>Status</small><b>${active?'Aktif':expired?'Tamat':'Belum aktif'}</b></div>
        </div>
      </div>
      <div class="parent-sub-price"><b>${price}</b><span>${period}</span>
        <button class="btn primary" disabled>${active?'Renew RM15':expired?'Renew RM15':'Langgan RM69'}</button>
        <small>ToyyibPay masih KIV</small>
      </div>
    </div>
    <div class="parent-sub-info"><b>${active?'✓ Akses anda sedang aktif':'ℹ Pembayaran belum diaktifkan'}</b><p>${active?'Anda boleh menggunakan semua Modul 3M sehingga tarikh tamat di atas.':'Buat masa ini Admin boleh mengaktifkan langganan secara manual untuk tujuan testing.'}</p></div>
  </section>`;
  $('.parent-sub-back').onclick=()=>renderUser(p);
}


async function renderParentLearningHub(p){
  const root=$('#dashboard');
  if(!activeChild){
    const kids=await loadChildren(p.uid);
    activeChild=kids[0]||null;
  }
  if(!activeChild){
    root.innerHTML=`<section class="container learning-hub-page"><button class="btn ghost hub-back">← Kembali ke Dashboard</button><div class="empty-state"><h2>Tambah profil anak dahulu</h2><p>Pilih Tahun 1 hingga Tahun 6 semasa menambah profil.</p></div></section>`;
    $('.hub-back').onclick=()=>renderUser(p); return;
  }
  const year=Number(activeChild.year||Math.max(1,Number(activeChild.age||7)-6));
  const subjects=[
    {key:'bm',name:'Bahasa Melayu',icon:'🇲🇾',desc:'Pemahaman, tatabahasa, kosa kata dan penulisan.'},
    {key:'bi',name:'Bahasa Inggeris',icon:'🔤',desc:'Reading, vocabulary, grammar and writing.'},
    {key:'math',name:'Matematik',icon:'➗',desc:'Nombor, operasi, wang, masa, ukuran dan penyelesaian masalah.'},
    {key:'science',name:'Sains',icon:'🔬',desc:'Kemahiran saintifik, manusia, haiwan, tumbuhan dan dunia sekeliling.'}
  ];
  const topics={
    bm:['Kemahiran Membaca','Tatabahasa','Kosa Kata','Kemahiran Menulis'],
    bi:['Reading','Vocabulary','Grammar','Writing'],
    math:['Nombor & Operasi','Tambah & Tolak','Wang','Masa & Waktu'],
    science:['Kemahiran Saintifik','Manusia','Haiwan','Tumbuhan']
  };
  root.innerHTML=`<section class="container learning-hub-page">
    <div class="hub-top"><button class="btn ghost hub-back">← Dashboard</button><span class="badge">KSSR Learning Hub</span></div>
    <div class="hub-child"><div class="hub-avatar">${esc(activeChild.avatar||'🧒')}</div><div><small>PROFIL MURID</small><h1>${esc(activeChild.name)}</h1><p>🎒 Tahun ${year} · Latihan berstruktur mengikut subjek dan topik</p></div></div>
    <div class="hub-heading"><div><small>SILIBUS SEKOLAH RENDAH</small><h2>Tahun ${year}</h2></div><p>Pilih subjek untuk melihat topik latihan. Tahun 1 ialah kandungan pilot; Tahun 2–6 disediakan dalam seni bina untuk pengembangan seterusnya.</p></div>
    <div class="kssr-year-strip">${[1,2,3,4,5,6].map(y=>`<span class="${y===year?'active':''}">Tahun ${y}</span>`).join('')}</div>
    <div class="hub-module-grid">${subjects.map(x=>`<article class="hub-module">
      <div class="hub-module-icon">${x.icon}</div><div class="hub-module-title"><div><h3>${x.name}</h3><p>${x.desc}</p></div></div>
      <div class="kssr-topic-list">${topics[x.key].map(t=>`<span>${esc(t)}</span>`).join('')}</div>
      <button class="btn ${year===1?'primary':'ghost'} kssr-subject" data-subject="${x.key}" ${year===1?'':'disabled'}>${year===1?'Lihat Latihan':'Kandungan akan datang'}</button>
    </article>`).join('')}</div>
    <div class="hub-note">📘 <b>Fasa 1:</b> Struktur Tahun → Subjek → Topik telah diaktifkan. Kandungan soalan akan dibina sebagai latihan original CilikGo yang dipetakan kepada kurikulum KPM; bukan menyalin bahan peperiksaan berhak cipta.</div>
  </section>`;
  $('.hub-back').onclick=()=>renderUser(p);
  document.querySelectorAll('.kssr-subject').forEach(b=>b.onclick=()=>{
    const names={bm:'Bahasa Melayu',bi:'Bahasa Inggeris',math:'Matematik',science:'Sains'};
    const key=b.dataset.subject;
    if(year===1&&key==='bm'){ renderBmYear1Hub(p); return; }
    if(year===1&&key==='bi'){ renderBiYear1Hub(p); return; }
    if(year===1&&key==='math'){ renderMathYear1Hub(p); return; }
    root.querySelector('.hub-note').innerHTML=`🚧 <b>${names[key]} Tahun 1:</b> kandungan pilot belum diaktifkan. Bahasa Melayu, Bahasa Inggeris dan Matematik Tahun 1 tersedia untuk diuji sekarang.`;
    root.querySelector('.hub-note').scrollIntoView({behavior:'smooth',block:'center'});
  });
}



async function renderBiYear1Hub(p){
  if(!fb?.auth.currentUser){openAuth('login');return;}
  if(!subscriptionState(p).active){showSubscriptionGate(p,'read');return;}
  if(!activeChild){toast('Pilih profil anak dahulu.');return;}
  const year=Number(activeChild.year||Math.max(1,Number(activeChild.age||7)-6));
  if(year!==1){toast('Pilot Bahasa Inggeris ini untuk murid Tahun 1.');return;}
  const root=$('#dashboard'), rows=await loadProgress(p.uid,activeChild.id);
  const keys=Object.keys(biYear1Bank);
  const bestFor=k=>{
    const vals=rows.filter(r=>r.activity===`kssr_bi_y1_${k}`).map(r=>Number(r.stars||0));
    return vals.length?Math.max(...vals):0;
  };
  const completed=keys.filter(k=>bestFor(k)>=8).length;
  root.innerHTML=`<section class="container learning-hub-page">
    <div class="hub-top"><button class="btn ghost bi-back">← Semua Subjek</button><span class="badge">Bahasa Inggeris Tahun 1 · Pilot</span></div>
    <div class="hub-child"><div class="hub-avatar">${esc(activeChild.avatar||'🧒')}</div><div><small>BAHASA INGGERIS TAHUN 1</small><h1>${esc(activeChild.name)}</h1><p>📚 ${completed}/${keys.length} topik mencapai sekurang-kurangnya ⭐ 8/15</p></div></div>
    <div class="kssr-progress-summary"><div><b>${completed}</b><span>Topik dikuasai</span></div><div><b>${keys.length}</b><span>Topik tersedia</span></div><div><b>${Math.round(completed/keys.length*100)}%</b><span>Kemajuan</span></div></div>
    <div class="hub-heading"><div><small>TOPICAL PRACTICE</small><h2>Choose an English topic</h2></div><p>Each session contains 5 random questions. The best score is used to show topic mastery.</p></div>
    <div class="kssr-topic-grid">${keys.map(k=>{const t=biYear1Bank[k],best=bestFor(k);return `<article class="kssr-topic-card ${best>=8?'passed':''}">
      <div class="topic-icon">${t.icon}</div><div><small>YEAR 1</small><h3>${esc(t.title)}</h3><p>${esc(t.desc)}</p></div>
      <div class="topic-score">${best?`Best score <b>⭐ ${best}/15</b>`:'Not attempted yet'}</div>
      <button class="btn ${best>=8?'success':'primary'} bi-topic-start" data-topic="${k}">${best?'Practise Again':'Start Practice'}</button>
    </article>`}).join('')}</div>
    <div class="hub-note">📘 This is original CilikGo practice content for Year 1 English skills such as reading, vocabulary, grammar, writing and simple communication. It is not copied from examination papers and is not labelled as “official KPM questions”.</div>
  </section>`;
  $('.bi-back').onclick=()=>renderParentLearningHub(p);
  document.querySelectorAll('.bi-topic-start').forEach(b=>b.onclick=()=>startBiYear1Topic(b.dataset.topic));
}

async function startBiYear1Topic(topicKey){
  if(!fb?.auth.currentUser){openAuth('login');return;}
  const p=currentProfile||await getProfile(fb.auth.currentUser);
  if(!subscriptionState(p).active){showSubscriptionGate(p,'read');return;}
  if(!activeChild){toast('Pilih profil anak dahulu.');return;}
  const topic=biYear1Bank[topicKey];
  if(!topic){toast('Topik tidak dijumpai.');return;}
  const questions=[...topic.questions].sort(()=>Math.random()-.5).slice(0,5);
  let index=0,scoreStars=0,totalAttempts=0,correctCount=0;

  const speakEnglish=text=>{
    if(!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    const voices=speechSynthesis.getVoices();
    u.voice=voices.find(v=>/^en-MY/i.test(v.lang))||voices.find(v=>/^en-GB/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang))||null;
    u.lang=u.voice?.lang||'en-GB';
    u.rate=.86; u.pitch=1.02;
    speechSynthesis.speak(u);
  };

  const render=()=>{
    const q=questions[index]; let attempts=0,completed=false;
    const pct=Math.round(index/questions.length*100);
    $('#gameContent').innerHTML=`<div class="kssr-quiz-head"><span class="badge">Bahasa Inggeris Tahun 1</span><h2>${topic.icon} ${esc(topic.title)}</h2><p>${esc(activeChild.avatar||'🧒')} ${esc(activeChild.name)}</p></div>
      <div class="learning-hud"><div><b>Question ${index+1}/${questions.length}</b><small>${pct}% complete</small></div><div class="hud-stars">⭐ ${scoreStars}</div></div>
      <div class="level-progress"><span style="width:${pct}%"></span></div>
      <div class="audio-row"><button class="audio-btn" id="speakQuestion">🔊 Listen</button><span>Read or listen, then choose the best answer.</span></div>
      <div class="game-prompt">${esc(q.prompt)}</div>
      <div class="answers">${q.answers.map(a=>`<button class="answer">${esc(a)}</button>`).join('')}</div>
      <div id="gameMsg"></div>`;
    if(!$('#gameModal').open) $('#gameModal').showModal();
    $('#speakQuestion').onclick=()=>speakEnglish(q.prompt);
    document.querySelectorAll('.answer').forEach(btn=>btn.onclick=()=>{
      if(completed)return;
      attempts++; totalAttempts++;
      if(btn.textContent!==q.correct){
        btn.classList.add('wrong'); setTimeout(()=>btn.classList.remove('wrong'),450);
        $('#gameMsg').innerHTML=`<div class="try-again">💪 Not quite. Try again! <small>Attempt ${attempts}</small></div>`;
        speakEnglish('Try again'); return;
      }
      completed=true; correctCount++;
      const earned=attempts===1?3:attempts===2?2:1;
      scoreStars+=earned;
      btn.classList.add('correct');
      document.querySelectorAll('.answer').forEach(a=>a.disabled=true);
      $('#gameMsg').innerHTML=`<div class="correct-feedback"><b>🎉 Correct!</b><span>${esc(q.success)}</span><strong>${'⭐'.repeat(earned)}</strong></div>`;
      celebrate(); speakEnglish(q.success||'Correct');
      setTimeout(()=>{index++;index<questions.length?render():finish();},1200);
    });
  };

  const finish=async()=>{
    const passed=scoreStars>=8,pct=Math.round(scoreStars/15*100);
    $('#gameContent').innerHTML=`<div class="result-card"><div class="result-emoji">${pct>=85?'🏆':pct>=65?'🌟':'💪'}</div>
      <span class="badge">Bahasa Inggeris Tahun 1</span><h2>${passed?'Well done!':'Keep practising!'}</h2>
      <p>${esc(activeChild.name)} has completed <b>${esc(topic.title)}</b>.</p>
      <div class="result-stars">⭐ ${scoreStars} / 15</div>
      <div class="result-grid"><div><b>${correctCount}/5</b><small>Questions completed</small></div><div><b>${totalAttempts}</b><small>Attempts</small></div><div><b>${pct}%</b><small>Star score</small></div></div>
      <div class="result-actions"><button class="btn primary" id="biAgain">Practise Again</button><button class="btn ghost" id="biTopics">Choose Topic</button></div>
      <p class="result-tip">${passed?'⭐ This topic is marked as mastered based on the best score.':'Aim for at least ⭐ 8/15.'}</p></div>`;
    celebrate(); speakEnglish(passed?'Well done!':'Keep practising');
    try{
      await fb.addDoc(fb.collection(fb.db,'progress'),{
        ownerUid:fb.auth.currentUser.uid,childId:activeChild.id,
        module:'KSSR Bahasa Inggeris Tahun 1',activity:`kssr_bi_y1_${topicKey}`,
        level:1,year:1,subject:'bi',topic:topicKey,questions:5,
        correct:true,correctCount,attempts:totalAttempts,stars:scoreStars,passed,
        createdAt:fb.serverTimestamp()
      });
      toast(`⭐ Rekod ${topic.title} disimpan.`);
    }catch(e){console.error(e);toast('Latihan selesai, tetapi rekod kemajuan gagal disimpan.');}
    $('#biAgain').onclick=()=>startBiYear1Topic(topicKey);
    $('#biTopics').onclick=()=>{$('#gameModal').close();renderBiYear1Hub(p);};
  };
  render();
}

async function renderBmYear1Hub(p){
  if(!fb?.auth.currentUser){openAuth('login');return;}
  if(!subscriptionState(p).active){showSubscriptionGate(p,'read');return;}
  if(!activeChild){toast('Pilih profil anak dahulu.');return;}
  const year=Number(activeChild.year||Math.max(1,Number(activeChild.age||7)-6));
  if(year!==1){toast('Pilot Bahasa Melayu ini untuk murid Tahun 1.');return;}
  const root=$('#dashboard'), rows=await loadProgress(p.uid,activeChild.id);
  const keys=Object.keys(bmYear1Bank);
  const bestFor=k=>{
    const vals=rows.filter(r=>r.activity===`kssr_bm_y1_${k}`).map(r=>Number(r.stars||0));
    return vals.length?Math.max(...vals):0;
  };
  const completed=keys.filter(k=>bestFor(k)>=8).length;
  root.innerHTML=`<section class="container learning-hub-page">
    <div class="hub-top"><button class="btn ghost bm-back">← Semua Subjek</button><span class="badge">Bahasa Melayu Tahun 1 · Pilot</span></div>
    <div class="hub-child"><div class="hub-avatar">${esc(activeChild.avatar||'🧒')}</div><div><small>BAHASA MELAYU TAHUN 1</small><h1>${esc(activeChild.name)}</h1><p>📚 ${completed}/${keys.length} topik mencapai sekurang-kurangnya ⭐ 8/15</p></div></div>
    <div class="kssr-progress-summary"><div><b>${completed}</b><span>Topik dikuasai</span></div><div><b>${keys.length}</b><span>Topik tersedia</span></div><div><b>${Math.round(completed/keys.length*100)}%</b><span>Kemajuan</span></div></div>
    <div class="hub-heading"><div><small>LATIHAN TOPIKAL</small><h2>Pilih topik Bahasa Melayu</h2></div><p>Setiap sesi mengandungi 5 soalan rawak. Gunakan butang 🔊 Dengar untuk membantu kemahiran mendengar dan sebutan.</p></div>
    <div class="kssr-topic-grid">${keys.map(k=>{const t=bmYear1Bank[k],best=bestFor(k);return `<article class="kssr-topic-card ${best>=8?'passed':''}">
      <div class="topic-icon">${t.icon}</div><div><small>TAHUN 1</small><h3>${esc(t.title)}</h3><p>${esc(t.desc)}</p></div>
      <div class="topic-score">${best?`Rekod terbaik <b>⭐ ${best}/15</b>`:'Belum dimainkan'}</div>
      <button class="btn ${best>=8?'success':'primary'} bm-topic-start" data-topic="${k}">${best?'Latih Lagi':'Mula Latihan'}</button>
    </article>`}).join('')}</div>
    <div class="hub-note">📘 Kandungan ini ialah latihan original CilikGo yang disusun berasaskan kemahiran Bahasa Melayu Tahap I seperti membaca, menulis, kosa kata, tatabahasa dan penggunaan bahasa. Ia bukan salinan kertas peperiksaan atau “soalan rasmi KPM”.</div>
  </section>`;
  $('.bm-back').onclick=()=>renderParentLearningHub(p);
  document.querySelectorAll('.bm-topic-start').forEach(b=>b.onclick=()=>startBmYear1Topic(b.dataset.topic));
}

async function startBmYear1Topic(topicKey){
  if(!fb?.auth.currentUser){openAuth('login');return;}
  const p=currentProfile||await getProfile(fb.auth.currentUser);
  if(!subscriptionState(p).active){showSubscriptionGate(p,'read');return;}
  if(!activeChild){toast('Pilih profil anak dahulu.');return;}
  const topic=bmYear1Bank[topicKey];
  if(!topic){toast('Topik tidak dijumpai.');return;}
  const questions=[...topic.questions].sort(()=>Math.random()-.5).slice(0,5);
  let index=0,scoreStars=0,totalAttempts=0,correctCount=0;

  const render=()=>{
    const q=questions[index]; let attempts=0,completed=false;
    const pct=Math.round(index/questions.length*100);
    $('#gameContent').innerHTML=`<div class="kssr-quiz-head"><span class="badge">Bahasa Melayu Tahun 1</span><h2>${topic.icon} ${esc(topic.title)}</h2><p>${esc(activeChild.avatar||'🧒')} ${esc(activeChild.name)}</p></div>
      <div class="learning-hud"><div><b>Soalan ${index+1}/${questions.length}</b><small>${pct}% selesai</small></div><div class="hud-stars">⭐ ${scoreStars}</div></div>
      <div class="level-progress"><span style="width:${pct}%"></span></div>
      <div class="audio-row"><button class="audio-btn" id="speakQuestion">🔊 Dengar</button><span>Baca atau dengar soalan, kemudian pilih jawapan.</span></div>
      <div class="game-prompt">${esc(q.prompt)}</div>
      <div class="answers">${q.answers.map(a=>`<button class="answer">${esc(a)}</button>`).join('')}</div>
      <div id="gameMsg"></div>`;
    if(!$('#gameModal').open) $('#gameModal').showModal();
    $('#speakQuestion').onclick=()=>speakBM(q.prompt);
    document.querySelectorAll('.answer').forEach(btn=>btn.onclick=()=>{
      if(completed)return;
      attempts++; totalAttempts++;
      if(btn.textContent!==q.correct){
        btn.classList.add('wrong'); setTimeout(()=>btn.classList.remove('wrong'),450);
        $('#gameMsg').innerHTML=`<div class="try-again">💪 Belum tepat. Cuba lagi! <small>Percubaan ${attempts}</small></div>`;
        speakBM('Cuba lagi'); return;
      }
      completed=true; correctCount++;
      const earned=attempts===1?3:attempts===2?2:1;
      scoreStars+=earned;
      btn.classList.add('correct');
      document.querySelectorAll('.answer').forEach(a=>a.disabled=true);
      $('#gameMsg').innerHTML=`<div class="correct-feedback"><b>🎉 Betul!</b><span>${esc(q.success)}</span><strong>${'⭐'.repeat(earned)}</strong></div>`;
      celebrate(); speakBM(q.success||'Betul');
      setTimeout(()=>{index++;index<questions.length?render():finish();},1200);
    });
  };

  const finish=async()=>{
    const passed=scoreStars>=8,pct=Math.round(scoreStars/15*100);
    $('#gameContent').innerHTML=`<div class="result-card"><div class="result-emoji">${pct>=85?'🏆':pct>=65?'🌟':'💪'}</div>
      <span class="badge">Bahasa Melayu Tahun 1</span><h2>${passed?'Syabas!':'Teruskan latihan!'}</h2>
      <p>${esc(activeChild.name)} telah menamatkan topik <b>${esc(topic.title)}</b>.</p>
      <div class="result-stars">⭐ ${scoreStars} / 15</div>
      <div class="result-grid"><div><b>${correctCount}/5</b><small>Soalan selesai</small></div><div><b>${totalAttempts}</b><small>Percubaan</small></div><div><b>${pct}%</b><small>Skor bintang</small></div></div>
      <div class="result-actions"><button class="btn primary" id="bmAgain">Latih Lagi</button><button class="btn ghost" id="bmTopics">Pilih Topik</button></div>
      <p class="result-tip">${passed?'⭐ Topik ini ditanda dikuasai berdasarkan rekod terbaik.':'Sasarkan sekurang-kurangnya ⭐ 8/15.'}</p></div>`;
    celebrate(); speakBM(passed?'Syabas, hebat!':'Teruskan latihan');
    try{
      await fb.addDoc(fb.collection(fb.db,'progress'),{
        ownerUid:fb.auth.currentUser.uid,childId:activeChild.id,
        module:'KSSR Bahasa Melayu Tahun 1',activity:`kssr_bm_y1_${topicKey}`,
        level:1,year:1,subject:'bm',topic:topicKey,questions:5,
        correct:true,correctCount,attempts:totalAttempts,stars:scoreStars,passed,
        createdAt:fb.serverTimestamp()
      });
      toast(`⭐ Rekod ${topic.title} disimpan.`);
    }catch(e){console.error(e);toast('Latihan selesai, tetapi rekod kemajuan gagal disimpan.');}
    $('#bmAgain').onclick=()=>startBmYear1Topic(topicKey);
    $('#bmTopics').onclick=()=>{$('#gameModal').close();renderBmYear1Hub(p);};
  };
  render();
}

async function renderMathYear1Hub(p){
  if(!fb?.auth.currentUser){openAuth('login');return;}
  if(!subscriptionState(p).active){showSubscriptionGate(p,'count');return;}
  if(!activeChild){toast('Pilih profil anak dahulu.');return;}
  const year=Number(activeChild.year||Math.max(1,Number(activeChild.age||7)-6));
  if(year!==1){toast('Pilot Matematik ini untuk murid Tahun 1.');return;}
  const root=$('#dashboard'), rows=await loadProgress(p.uid,activeChild.id);
  const keys=Object.keys(mathYear1Bank);
  const bestFor=k=>{
    const vals=rows.filter(r=>r.activity===`kssr_math_y1_${k}`).map(r=>Number(r.stars||0));
    return vals.length?Math.max(...vals):0;
  };
  const completed=keys.filter(k=>bestFor(k)>=8).length;
  root.innerHTML=`<section class="container learning-hub-page">
    <div class="hub-top"><button class="btn ghost math-back">← Semua Subjek</button><span class="badge">Matematik Tahun 1 · Pilot</span></div>
    <div class="hub-child"><div class="hub-avatar">${esc(activeChild.avatar||'🧒')}</div><div><small>MATEMATIK TAHUN 1</small><h1>${esc(activeChild.name)}</h1><p>📚 ${completed}/${keys.length} topik mencapai sekurang-kurangnya ⭐ 8/15</p></div></div>
    <div class="kssr-progress-summary"><div><b>${completed}</b><span>Topik dikuasai</span></div><div><b>${keys.length}</b><span>Topik tersedia</span></div><div><b>${Math.round(completed/keys.length*100)}%</b><span>Kemajuan</span></div></div>
    <div class="hub-heading"><div><small>LATIHAN TOPIKAL</small><h2>Pilih topik latihan</h2></div><p>Setiap sesi mengandungi 5 soalan rawak. Rekod terbaik digunakan untuk menunjukkan penguasaan topik.</p></div>
    <div class="kssr-topic-grid">${keys.map(k=>{const t=mathYear1Bank[k],best=bestFor(k);return `<article class="kssr-topic-card ${best>=8?'passed':''}">
      <div class="topic-icon">${t.icon}</div><div><small>TAHUN 1</small><h3>${esc(t.title)}</h3><p>${esc(t.desc)}</p></div>
      <div class="topic-score">${best?`Rekod terbaik <b>⭐ ${best}/15</b>`:'Belum dimainkan'}</div>
      <button class="btn ${best>=8?'success':'primary'} math-topic-start" data-topic="${k}">${best?'Latih Lagi':'Mula Latihan'}</button>
    </article>`}).join('')}</div>
    <div class="hub-note">📘 Soalan pilot ini ialah kandungan original CilikGo berdasarkan kemahiran Matematik Tahap I. Ia tidak dilabel sebagai soalan rasmi KPM atau salinan kertas peperiksaan.</div>
  </section>`;
  $('.math-back').onclick=()=>renderParentLearningHub(p);
  document.querySelectorAll('.math-topic-start').forEach(b=>b.onclick=()=>startMathYear1Topic(b.dataset.topic));
}

async function startMathYear1Topic(topicKey){
  if(!fb?.auth.currentUser){openAuth('login');return;}
  const p=currentProfile||await getProfile(fb.auth.currentUser);
  if(!subscriptionState(p).active){showSubscriptionGate(p,'count');return;}
  if(!activeChild){toast('Pilih profil anak dahulu.');return;}
  const topic=mathYear1Bank[topicKey];
  if(!topic){toast('Topik tidak dijumpai.');return;}
  const questions=[...topic.questions].sort(()=>Math.random()-.5).slice(0,5);
  let index=0,scoreStars=0,totalAttempts=0,correctCount=0;

  const render=()=>{
    const q=questions[index]; let attempts=0,completed=false;
    const pct=Math.round(index/questions.length*100);
    $('#gameContent').innerHTML=`<div class="kssr-quiz-head"><span class="badge">Matematik Tahun 1</span><h2>${topic.icon} ${esc(topic.title)}</h2><p>${esc(activeChild.avatar||'🧒')} ${esc(activeChild.name)}</p></div>
      <div class="learning-hud"><div><b>Soalan ${index+1}/${questions.length}</b><small>${pct}% selesai</small></div><div class="hud-stars">⭐ ${scoreStars}</div></div>
      <div class="level-progress"><span style="width:${pct}%"></span></div>
      <div class="audio-row"><button class="audio-btn" id="speakQuestion">🔊 Dengar</button><span>Cuba sehingga mendapat jawapan yang betul.</span></div>
      <div class="game-prompt">${esc(q.prompt)}</div>
      <div class="answers">${q.answers.map(a=>`<button class="answer">${esc(a)}</button>`).join('')}</div>
      <div id="gameMsg"></div>`;
    if(!$('#gameModal').open) $('#gameModal').showModal();
    $('#speakQuestion').onclick=()=>speakBM(q.prompt);
    document.querySelectorAll('.answer').forEach(btn=>btn.onclick=()=>{
      if(completed)return;
      attempts++; totalAttempts++;
      if(btn.textContent!==q.correct){
        btn.classList.add('wrong'); setTimeout(()=>btn.classList.remove('wrong'),450);
        $('#gameMsg').innerHTML=`<div class="try-again">💪 Belum tepat. Cuba lagi! <small>Percubaan ${attempts}</small></div>`;
        speakBM('Cuba lagi'); return;
      }
      completed=true; correctCount++;
      const earned=attempts===1?3:attempts===2?2:1;
      scoreStars+=earned;
      btn.classList.add('correct');
      document.querySelectorAll('.answer').forEach(a=>a.disabled=true);
      $('#gameMsg').innerHTML=`<div class="correct-feedback"><b>🎉 Betul!</b><span>${esc(q.success)}</span><strong>${'⭐'.repeat(earned)}</strong></div>`;
      celebrate(); speakBM(q.success||'Betul');
      setTimeout(()=>{index++;index<questions.length?render():finish();},1200);
    });
  };

  const finish=async()=>{
    const passed=scoreStars>=8,pct=Math.round(scoreStars/15*100);
    $('#gameContent').innerHTML=`<div class="result-card"><div class="result-emoji">${pct>=85?'🏆':pct>=65?'🌟':'💪'}</div>
      <span class="badge">Matematik Tahun 1</span><h2>${passed?'Syabas!':'Teruskan latihan!'}</h2>
      <p>${esc(activeChild.name)} telah menamatkan topik <b>${esc(topic.title)}</b>.</p>
      <div class="result-stars">⭐ ${scoreStars} / 15</div>
      <div class="result-grid"><div><b>${correctCount}/5</b><small>Soalan selesai</small></div><div><b>${totalAttempts}</b><small>Percubaan</small></div><div><b>${pct}%</b><small>Skor bintang</small></div></div>
      <div class="result-actions"><button class="btn primary" id="mathAgain">Latih Lagi</button><button class="btn ghost" id="mathTopics">Pilih Topik</button></div>
      <p class="result-tip">${passed?'⭐ Topik ini ditanda dikuasai berdasarkan rekod terbaik.':'Sasarkan sekurang-kurangnya ⭐ 8/15.'}</p></div>`;
    celebrate(); speakBM(passed?'Syabas, hebat!':'Teruskan latihan');
    try{
      await fb.addDoc(fb.collection(fb.db,'progress'),{
        ownerUid:fb.auth.currentUser.uid,childId:activeChild.id,
        module:'KSSR Matematik Tahun 1',activity:`kssr_math_y1_${topicKey}`,
        level:1,year:1,subject:'math',topic:topicKey,questions:5,
        correct:true,correctCount,attempts:totalAttempts,stars:scoreStars,passed,
        createdAt:fb.serverTimestamp()
      });
      toast(`⭐ Rekod ${topic.title} disimpan.`);
    }catch(e){console.error(e);toast('Latihan selesai, tetapi rekod kemajuan gagal disimpan.');}
    $('#mathAgain').onclick=()=>startMathYear1Topic(topicKey);
    $('#mathTopics').onclick=()=>{$('#gameModal').close();renderMathYear1Hub(p);};
  };
  render();
}

async function renderUser(p){
  const kids=await loadChildren(p.uid);
  const progress=await loadAllProgress(p.uid);
  if(!activeChild&&kids.length) activeChild=kids[0];
  const totalStars=progress.reduce((s,x)=>s+Number(x.stars||0),0);
  const sub=subscriptionState(p);
  const active=sub.active;
  const daysLeft=subscriptionDaysLeft(p);
  const selectedRows=activeChild?progress.filter(x=>x.childId===activeChild.id):[];
  const summary=childProgressSummary(selectedRows);
  const rec=parentRecommendation(summary);
  const recent=[...selectedRows].sort((a,b)=>{
    const ad=a.createdAt?.toDate?.()?.getTime?.()||0, bd=b.createdAt?.toDate?.()?.getTime?.()||0;
    return bd-ad;
  }).slice(0,6);
  const moduleIcon={Membaca:'📖',Menulis:'✏️',Mengira:'🧮'};
  const childCards=kids.map(c=>{
    const cp=progress.filter(x=>x.childId===c.id);
    const st=cp.reduce((s,x)=>s+Number(x.stars||0),0);
    return `<button class="child-card ${activeChild?.id===c.id?'selected':''}" data-child="${c.id}"><span>${esc(c.avatar||'🧒')}</span><b>${esc(c.name)}</b><small>Tahun ${esc(c.year||Math.max(1,Number(c.age||7)-6))} · ⭐ ${st}</small></button>`;
  }).join('');

  $('#dashboard').innerHTML=`<div class="dash-shell"><aside class="dash-side"><h3>👨‍👩‍👧 Penjaga</h3><a class="active">Perkembangan</a><a href="#" class="parent-learning-nav">Latihan KSSR</a><a href="#" id="parentSubscriptionLink">Langganan</a><a href="#settings">Settings</a></aside>
  <section class="dash-main"><div class="dash-head"><div><small>Selamat datang</small><h2>${esc(p.name||'Penjaga')} 👋</h2></div><span class="badge ${active?'':'status-inactive'}">${active?'Langganan aktif':'Belum aktif'}</span></div>
  <div class="parent-overview"><div><small>Jumlah profil anak</small><b>${kids.length}</b></div><div><small>Jumlah ⭐ keluarga</small><b>${totalStars}</b></div><div><small>Aktiviti direkod</small><b>${progress.length}</b></div></div>
  <div class="child-selector-head"><div><h3>Profil Anak</h3><p>Pilih anak untuk melihat laporan perkembangannya.</p></div><button class="btn primary" id="addChildBtn">+ Tambah Anak</button></div>
  <div class="child-list">${childCards||'<div class="empty-state">Belum ada profil anak. Tambah anak untuk mula merekod kemajuan pembelajaran.</div>'}</div>

  ${activeChild?`<div class="report-header"><div><span class="report-avatar">${esc(activeChild.avatar||'🧒')}</span><div><small>Laporan perkembangan</small><h2>${esc(activeChild.name)}</h2><p>Tahun ${esc(activeChild.year||Math.max(1,Number(activeChild.age||7)-6))} · Kemajuan berdasarkan latihan yang telah diselesaikan.</p></div></div><span class="report-stars">⭐ ${selectedRows.reduce((s,x)=>s+Number(x.stars||0),0)}</span></div>
  <div class="module-progress-grid">${['Membaca','Menulis','Mengira'].map(m=>{const x=summary[m],pct=Math.min(100,x.rows?Math.max(12,x.efficiency):0);return `<div class="module-report"><div class="module-report-head"><span>${moduleIcon[m]}</span><div><b>${m}</b><small>Level tertinggi ${x.level}</small></div><strong>${x.stars} ⭐</strong></div><div class="parent-progress"><span style="width:${pct}%"></span></div><div class="module-meta"><span>${x.rows} aktiviti</span><span>${x.attempts} percubaan</span><span>${x.rows?x.efficiency+'% ketepatan':'Belum mula'}</span></div></div>`}).join('')}</div>
  <div class="parent-report-grid"><div class="recommend-card"><span class="recommend-icon">💡</span><div><small>Cadangan CilikGo</small><h3>${rec.title}</h3><p>${rec.text}</p><button class="btn primary" id="recommendedActivity">Mulakan ${rec.module}</button></div></div>
  <div class="strength-card"><small>Pemerhatian ringkas</small><h3>${selectedRows.length?'Corak pembelajaran':'Belum cukup data'}</h3><p>${selectedRows.length?(rec.strongest?`${rec.strongest} ialah bahagian yang paling lancar setakat rekod semasa. Teruskan sesi pendek dan konsisten.`:'Teruskan beberapa aktiviti untuk mendapatkan gambaran perkembangan yang lebih jelas.'):'Lengkapkan beberapa aktiviti dahulu supaya CilikGo boleh memberikan cadangan yang lebih berguna.'}</p></div></div>
  <div class="recent-learning"><div class="section-title"><div><h3>Aktiviti Terkini</h3><p>Rekod terbaru ${esc(activeChild.name)}.</p></div></div>${recent.length?`<div class="recent-list">${recent.map(x=>`<div class="recent-item"><span>${moduleIcon[x.module]||'🎯'}</span><div><b>${esc(x.module||'Aktiviti')} · Level ${esc(x.level||'-')}</b><small>${Number(x.attempts||0)} percubaan</small></div><strong>⭐ ${Number(x.stars||0)}</strong></div>`).join('')}</div>`:'<div class="empty-state">Belum ada aktiviti direkod untuk anak ini.</div>'}</div>`:''}

  <div class="subscription-box"><div><small>Status langganan</small><h3>${active?'Aktif hingga '+formatDate(p.subscriptionEndsAt):sub.expired?'Langganan telah tamat':'Belum aktif'}</h3><p>${active?`${daysLeft} hari lagi · Renewal RM15 untuk 1 bulan.`:'Pakej permulaan RM69 memberikan akses selama 4 bulan. ToyyibPay masih KIV.'}</p></div><div class="subscription-actions"><button class="btn primary" id="dashboardSubscribeBtn" disabled>${active?'Renew RM15 / bulan':'Langgan RM69 / 4 bulan'}</button><small>Gateway pembayaran belum diaktifkan</small></div></div>
  </section></div>`;

  $('#addChildBtn').onclick=()=>$('#childModal').showModal();
  document.querySelectorAll('[data-child]').forEach(b=>b.onclick=async()=>{
    const selected=kids.find(c=>c.id===b.dataset.child);
    if(!selected) return;
    activeChild=selected;
    localStorage.setItem('cilikgo_active_child',selected.id);
    await renderUser(p);
  });
  if($('#recommendedActivity')) $('#recommendedActivity').onclick=()=>openLevelPicker(({Membaca:'read',Menulis:'write',Mengira:'count'})[rec.module],true);
}
async function renderAgent(p){
  const safeDocs=async(name)=>{
    try{return (await fb.getDocs(fb.collection(fb.db,name))).docs.map(d=>({id:d.id,...d.data()}));}
    catch(e){console.warn(name,e);return [];}
  };
  const code=p.agentCode||'';
  const loadReferrals=async()=>{
    if(!code) return [];
    try{
      const q=fb.query(fb.collection(fb.db,'users'),fb.where('referredByCode','==',code));
      return (await fb.getDocs(q)).docs.map(d=>({id:d.id,...d.data()})).filter(u=>u.role==='user');
    }catch(e){console.warn('referrals',e);return [];}
  };
  const loadAgentDocs=async(name)=>{
    try{
      const q=fb.query(fb.collection(fb.db,name),fb.where('agentUid','==',p.uid));
      return (await fb.getDocs(q)).docs.map(d=>({id:d.id,...d.data()}));
    }catch(e){console.warn(name,e);return [];}
  };
  const [referrals,myOrders,myCommissions]=await Promise.all([loadReferrals(),loadAgentDocs('orders'),loadAgentDocs('commissions')]);
  const paidOrders=myOrders.filter(o=>o.status==='paid');
  const pending=myCommissions.filter(c=>c.status==='pending').reduce((s,c)=>s+Number(c.amount||0),0);
  const paidCommission=myCommissions.filter(c=>c.status==='paid').reduce((s,c)=>s+Number(c.amount||0),0);
  const totalCommission=myCommissions.reduce((s,c)=>s+Number(c.amount||0),0);
  const sales=paidOrders.reduce((s,o)=>s+Number(o.amount||0),0);
  const conversion=referrals.length?Math.round((paidOrders.length/referrals.length)*100):0;
  const refUrl=`${location.origin}${location.pathname}?ref=${encodeURIComponent(code)}`;

  const status=s=>`<span class="badge ${['failed','inactive'].includes(s)?'status-inactive':''}">${esc(s||'-')}</span>`;
  const referralRows=referrals.length?`<div class="table-wrap"><table class="table"><tr><th>Penjaga</th><th>E-mel</th><th>Langganan</th><th>Jualan</th></tr>${referrals.map(u=>{
    const uo=myOrders.filter(o=>o.userUid===u.id);
    return `<tr><td>${esc(u.name||'-')}</td><td>${esc(u.email||'-')}</td><td>${status(u.subscriptionStatus||'inactive')}</td><td>${uo.filter(o=>o.status==='paid').length}</td></tr>`;
  }).join('')}</table></div>`:'<div class="empty-state">Belum ada Penjaga mendaftar melalui link anda.</div>';

  const commissionRows=myCommissions.length?`<div class="table-wrap"><table class="table"><tr><th>Order</th><th>Jualan</th><th>Kadar</th><th>Komisen</th><th>Status</th></tr>${[...myCommissions].reverse().map(c=>`<tr><td><code>${esc(c.orderId||c.id)}</code></td><td>RM${Number(c.saleAmount||0).toFixed(2)}</td><td>${Number(c.ratePercent||0)}%</td><td><b>RM${Number(c.amount||0).toFixed(2)}</b></td><td>${status(c.status)}</td></tr>`).join('')}</table></div>`:'<div class="empty-state">Belum ada rekod komisen. Rekod akan muncul selepas transaksi pembayaran sebenar tersedia.</div>';

  $('#dashboard').innerHTML=`<div class="dash-shell agent-shell"><aside class="dash-side"><h3>🤝 Agent</h3>
    <a class="agent-nav active" data-view="overview">Overview</a><a class="agent-nav" data-view="referrals">Referral</a><a class="agent-nav" data-view="sales">Jualan</a><a class="agent-nav" data-view="commission">Komisen</a><a href="#settings">Settings</a>
    </aside><section class="dash-main">
    <div id="agentView"></div>
  </section></div>`;

  const views={
    overview:()=>`<div class="dash-head"><div><small>Selamat datang, Agent</small><h2>${esc(p.name||p.email)} 👋</h2></div><span class="badge">Agent</span></div>
      <div class="agent-link-card"><div><small>Link referral unik anda</small><h3>Kongsi CilikGo dan bina rangkaian anda</h3><div class="copy-row"><input id="agentRefUrl" readonly value="${esc(refUrl)}"><button class="btn primary" id="copyAgentLink">Salin Link</button></div><p>Kod Agent: <b>${esc(code||'-')}</b></p></div><span class="agent-link-icon">🔗</span></div>
      <div class="agent-stat-grid"><div class="stat"><small>Pendaftaran referral</small><b>${referrals.length}</b></div><div class="stat"><small>Pembelian berjaya</small><b>${paidOrders.length}</b></div><div class="stat"><small>Conversion</small><b>${conversion}%</b></div><div class="stat"><small>Nilai jualan</small><b>RM${sales.toFixed(2)}</b></div><div class="stat"><small>Komisen pending</small><b>RM${pending.toFixed(2)}</b></div><div class="stat"><small>Komisen dibayar</small><b>RM${paidCommission.toFixed(2)}</b></div></div>
      <div class="agent-info-grid"><div class="recommend-card"><span class="recommend-icon">📣</span><div><small>Cara guna</small><h3>Kongsi link referral anda</h3><p>Apabila Penjaga membuka link anda dan mendaftar, kod Agent akan direkodkan pada akaun tersebut.</p></div></div><div class="strength-card"><small>Status pembayaran</small><h3>ToyyibPay masih KIV</h3><p>Pendaftaran referral sudah boleh direkod. Statistik jualan dan komisen sebenar akan mula bertambah selepas payment gateway diaktifkan.</p></div></div>`,
    referrals:()=>`<div class="dash-head"><div><small>Affiliate network</small><h2>Senarai Referral</h2></div><span class="badge">${referrals.length} Penjaga</span></div><div class="agent-toolbar"><input id="agentSearch" placeholder="Cari nama atau e-mel…"><span>${referrals.length} pendaftaran</span></div><div id="referralTable">${referralRows}</div>`,
    sales:()=>`<div class="dash-head"><div><small>Prestasi jualan</small><h2>Jualan Referral</h2></div><span class="badge">RM${sales.toFixed(2)}</span></div><div class="agent-stat-grid compact"><div class="stat"><small>Jumlah order</small><b>${myOrders.length}</b></div><div class="stat"><small>Berjaya</small><b>${paidOrders.length}</b></div><div class="stat"><small>Conversion</small><b>${conversion}%</b></div></div>${myOrders.length?`<div class="table-wrap"><table class="table"><tr><th>Order</th><th>Pelan</th><th>Nilai</th><th>Status</th></tr>${[...myOrders].reverse().map(o=>`<tr><td><code>${esc(o.id)}</code></td><td>${esc(o.plan||'-')}</td><td>RM${Number(o.amount||0).toFixed(2)}</td><td>${status(o.status)}</td></tr>`).join('')}</table></div>`:'<div class="empty-state">Belum ada jualan. ToyyibPay masih KIV.</div>'}`,
    commission:()=>`<div class="dash-head"><div><small>Pendapatan affiliate</small><h2>Komisen</h2></div><span class="badge">RM${totalCommission.toFixed(2)}</span></div><div class="agent-stat-grid compact"><div class="stat"><small>Jumlah komisen</small><b>RM${totalCommission.toFixed(2)}</b></div><div class="stat"><small>Pending</small><b>RM${pending.toFixed(2)}</b></div><div class="stat"><small>Dibayar</small><b>RM${paidCommission.toFixed(2)}</b></div></div>${commissionRows}`
  };

  const mount=view=>{
    $('#agentView').innerHTML=views[view]();
    document.querySelectorAll('.agent-nav').forEach(a=>a.classList.toggle('active',a.dataset.view===view));
    if($('#copyAgentLink')) $('#copyAgentLink').onclick=async()=>{
      try{await navigator.clipboard.writeText(refUrl);toast('Link referral berjaya disalin.');}
      catch(e){$('#agentRefUrl').select();document.execCommand('copy');toast('Link referral berjaya disalin.');}
    };
    if($('#agentSearch')) $('#agentSearch').oninput=()=>{
      const q=$('#agentSearch').value.toLowerCase();
      const list=referrals.filter(u=>(u.name||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q));
      $('#referralTable').innerHTML=list.length?`<div class="table-wrap"><table class="table"><tr><th>Penjaga</th><th>E-mel</th><th>Langganan</th></tr>${list.map(u=>`<tr><td>${esc(u.name||'-')}</td><td>${esc(u.email||'-')}</td><td>${status(u.subscriptionStatus||'inactive')}</td></tr>`).join('')}</table></div>`:'<div class="empty-state">Tiada referral sepadan.</div>';
    };
  };
  document.querySelectorAll('.agent-nav').forEach(a=>a.onclick=()=>mount(a.dataset.view));
  mount('overview');
}

async function renderAdminSubscriptions(){
  const root=$('.dash-main');
  root.innerHTML=`<div class="dash-head"><div><small>Pengurusan akses Penjaga</small><h2>Langganan</h2></div><span class="badge">Admin</span></div><div class="loading-skeleton" style="height:90px"></div>`;
  try{
    const [usersSnap,ordersSnap]=await Promise.all([
      fb.getDocs(fb.collection(fb.db,'users')),
      fb.getDocs(fb.collection(fb.db,'orders'))
    ]);
    const users=usersSnap.docs.map(d=>({id:d.id,...d.data()})).filter(u=>u.role==='user');
    const orders=ordersSnap.docs.map(d=>({id:d.id,...d.data()}));
    const now=Date.now();
    const rows=users.map(u=>{
      const raw=u.subscriptionEndsAt?.toDate?.()||u.subscriptionEndsAt||null;
      const end=raw?new Date(raw):null;
      const active=u.subscriptionStatus==='active'&&end&&end.getTime()>now;
      const expired=!!end&&end.getTime()<=now;
      const state=active?'active':expired?'expired':(u.subscriptionStatus||'inactive');
      const days=active?Math.max(0,Math.ceil((end-now)/86400000)):0;
      const userOrders=orders.filter(o=>o.userUid===u.id);
      return {...u,_end:end,_state:state,_days:days,_orders:userOrders};
    });
    const activeCount=rows.filter(x=>x._state==='active').length;
    const expiredCount=rows.filter(x=>x._state==='expired').length;
    const inactiveCount=rows.length-activeCount-expiredCount;
    const table=(list)=>list.length?`<div class="table-wrap"><table class="table admin-sub-table"><tr><th>Penjaga</th><th>Status</th><th>Tamat</th><th>Baki</th><th>Transaksi</th><th>Tindakan</th></tr>${list.map(u=>`<tr>
      <td><b>${esc(u.name||'-')}</b><small>${esc(u.email||'-')}</small></td>
      <td><span class="badge ${u._state==='active'?'':'status-inactive'}">${esc(u._state)}</span></td>
      <td>${u._end?u._end.toLocaleDateString('ms-MY'):'-'}</td>
      <td>${u._state==='active'?u._days+' hari':'-'}</td>
      <td>${u._orders.length}</td>
      <td><div class="admin-sub-actions"><button class="btn ghost sub-manage" data-uid="${u.id}" data-action="starter">+4 bulan</button><button class="btn ghost sub-manage" data-uid="${u.id}" data-action="renewal">+1 bulan</button><button class="btn ghost danger sub-manage" data-uid="${u.id}" data-action="expire">Tamatkan</button></div></td>
    </tr>`).join('')}</table></div>`:'<div class="empty-state">Tiada Penjaga sepadan.</div>';
    root.innerHTML=`<div class="dash-head"><div><small>Pengurusan akses Penjaga</small><h2>Langganan</h2></div><span class="badge">${rows.length} Penjaga</span></div>
      <div class="admin-stat-grid"><div class="stat"><small>Aktif</small><b>${activeCount}</b></div><div class="stat"><small>Tamat</small><b>${expiredCount}</b></div><div class="stat"><small>Belum aktif</small><b>${inactiveCount}</b></div></div>
      <div class="admin-sub-note">🛠️ <b>Mode Admin / Testing.</b> Perubahan manual direkodkan dalam audit log. ToyyibPay masih KIV.</div>
      <div class="agent-toolbar"><input id="subSearch" placeholder="Cari nama atau e-mel…"><select id="subFilter"><option value="all">Semua status</option><option value="active">Aktif</option><option value="expired">Tamat</option><option value="inactive">Belum aktif</option></select></div>
      <div id="subTable">${table(rows)}</div>`;
    const bind=()=>{
      document.querySelectorAll('.sub-manage').forEach(btn=>btn.onclick=async()=>{
        const u=rows.find(x=>x.id===btn.dataset.uid); if(!u)return;
        const action=btn.dataset.action;
        const label=action==='starter'?'tambah 4 bulan':action==='renewal'?'tambah 1 bulan':'tamatkan langganan';
        if(!confirm(`Sahkan ${label} untuk ${u.name||u.email}?`))return;
        setButtonLoading(btn,true,'Simpan…');
        try{
          const nowDate=new Date(), current=u._end&&u._end>nowDate?u._end:nowDate;
          let newEnd=null, update={updatedAt:fb.serverTimestamp()};
          if(action==='expire'){
            newEnd=nowDate;
            update={...update,subscriptionStatus:'expired',subscriptionEndsAt:fb.Timestamp.fromDate(nowDate)};
          }else{
            const months=action==='starter'?4:1;
            newEnd=new Date(current);
            const day=newEnd.getDate(); newEnd.setDate(1); newEnd.setMonth(newEnd.getMonth()+months);
            const last=new Date(newEnd.getFullYear(),newEnd.getMonth()+1,0).getDate(); newEnd.setDate(Math.min(day,last));
            update={...update,subscriptionStatus:'active',subscriptionEndsAt:fb.Timestamp.fromDate(newEnd)};
            if(!u.subscriptionStartedAt) update.subscriptionStartedAt=fb.serverTimestamp();
          }
          await fb.updateDoc(fb.doc(fb.db,'users',u.id),update);
          await fb.addDoc(fb.collection(fb.db,'subscriptionAudit'),{
            userUid:u.id,userEmail:u.email||null,action,
            previousStatus:u._state,previousEndsAt:u._end?fb.Timestamp.fromDate(u._end):null,
            newStatus:action==='expire'?'expired':'active',newEndsAt:newEnd?fb.Timestamp.fromDate(newEnd):null,
            source:'admin_manual',adminUid:fb.auth.currentUser.uid,createdAt:fb.serverTimestamp()
          });
          toast('Langganan berjaya dikemas kini.');
          await renderAdminSubscriptions();
        }catch(e){console.error(e);toast('Gagal mengemas kini langganan: '+(e.message||e));setButtonLoading(btn,false);}
      });
    };
    const refresh=()=>{
      const q=($('#subSearch')?.value||'').toLowerCase(),f=$('#subFilter')?.value||'all';
      const list=rows.filter(u=>(f==='all'||u._state===f)&&((u.name||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q)));
      $('#subTable').innerHTML=table(list);bind();
    };
    $('#subSearch').oninput=refresh; $('#subFilter').onchange=refresh; bind();
  }catch(e){console.error(e);root.innerHTML=`<div class="empty-state">Gagal memuatkan langganan: ${esc(e.message||e)}</div>`;}
}

async function renderAdmin(p){
  const safeDocs=async(name)=>{
    try{return (await fb.getDocs(fb.collection(fb.db,name))).docs.map(d=>({id:d.id,...d.data()}));}
    catch(e){console.warn(name,e);return [];}
  };
  const [users,children,progress,orders,commissions,modules,questionsCms]=await Promise.all([
    safeDocs('users'),safeDocs('children'),safeDocs('progress'),safeDocs('orders'),safeDocs('commissions'),safeDocs('modules'),safeDocs('questions')
  ]);
  const agents=users.filter(u=>u.role==='agent'), customers=users.filter(u=>u.role==='user');
  const activeSubs=customers.filter(u=>u.subscriptionStatus==='active');
  const paidOrders=orders.filter(o=>o.status==='paid');
  const sales=paidOrders.reduce((s,o)=>s+Number(o.amount||0),0);
  const commissionTotal=commissions.reduce((s,c)=>s+Number(c.amount||0),0);
  const totalStars=progress.reduce((s,x)=>s+Number(x.stars||0),0);

  const shell=(view,body)=>`<div class="dash-shell admin-shell"><aside class="dash-side"><h3>🛡️ Admin</h3>
    ${[['overview','Overview'],['users','User / Penjaga'],['agents','Agent'],['children','Profil Anak'],['learning','Prestasi 3M'],['subscriptions','Langganan'],['transactions','Transaksi'],['commissions','Komisen'],['modules','CMS Modul 3M'],['settings','Settings']].map(([k,l])=>`<a class="admin-nav ${view===k?'active':''}" data-view="${k}">${l}</a>`).join('')}
    </aside><section class="dash-main">${body}</section></div>`;

  const head=(title,sub='CilikGo Control Center')=>`<div class="dash-head"><div><small>${sub}</small><h2>${title}</h2></div><span class="badge">Admin</span></div>`;
  const empty=t=>`<div class="empty-state">${t}</div>`;
  const statusBadge=s=>`<span class="badge ${s==='inactive'||s==='failed'?'status-inactive':''}">${esc(s||'-')}</span>`;

  const views={
    overview:()=>`${head('Overview')}<div class="admin-stat-grid">
      <div class="stat"><small>Penjaga</small><b>${customers.length}</b></div><div class="stat"><small>Agent</small><b>${agents.length}</b></div>
      <div class="stat"><small>Profil anak</small><b>${children.length}</b></div><div class="stat"><small>Langganan aktif</small><b>${activeSubs.length}</b></div>
      <div class="stat"><small>Jualan dibayar</small><b>RM${sales.toFixed(2)}</b></div><div class="stat"><small>⭐ Dikumpul</small><b>${totalStars}</b></div>
      </div><div class="admin-two-col"><div><h3>Akaun terkini</h3>${users.length?`<div class="table-wrap"><table class="table"><tr><th>Nama</th><th>Role</th><th>Status</th></tr>${users.slice(-8).reverse().map(u=>`<tr><td>${esc(u.name||u.email||'-')}</td><td>${statusBadge(u.role)}</td><td>${statusBadge(u.subscriptionStatus||'n/a')}</td></tr>`).join('')}</table></div>`:empty('Tiada akaun.')}</div>
      <div><h3>Ringkasan sistem</h3><div class="admin-summary"><p><b>${orders.length}</b> rekod transaksi</p><p><b>${commissions.length}</b> rekod komisen</p><p><b>RM${commissionTotal.toFixed(2)}</b> jumlah komisen</p><p><b>${progress.length}</b> rekod aktiviti 3M</p></div></div></div>`,

    users:()=>`${head('User / Penjaga','Pengurusan akaun')}<div class="admin-toolbar"><input id="adminSearch" placeholder="Cari nama atau e-mel…"><span>${customers.length} akaun</span></div><div id="adminUserTable">${renderUserRows(customers)}</div>`,

    agents:()=>`${head('Agent','Pengurusan affiliate')}<div class="admin-toolbar"><input id="adminSearch" placeholder="Cari agent atau kod…"><span>${agents.length} agent</span></div>${agents.length?`<div class="table-wrap"><table class="table"><tr><th>Nama</th><th>E-mel</th><th>Kod</th><th>Jualan</th><th>Komisen</th></tr>${agents.map(a=>{const ao=orders.filter(o=>o.agentUid===a.id), ac=commissions.filter(c=>c.agentUid===a.id);return `<tr><td>${esc(a.name||'-')}</td><td>${esc(a.email||'-')}</td><td><code>${esc(a.agentCode||'-')}</code></td><td>${ao.length}</td><td>RM${ac.reduce((s,c)=>s+Number(c.amount||0),0).toFixed(2)}</td></tr>`}).join('')}</table></div>`:empty('Belum ada Agent.')}`,

    children:()=>`${head('Profil Anak','Pemantauan profil pembelajaran')}<div class="stat-grid"><div class="stat"><small>Jumlah profil</small><b>${children.length}</b></div><div class="stat"><small>Umur 4</small><b>${children.filter(c=>Number(c.age)===4).length}</b></div><div class="stat"><small>Umur 5–6</small><b>${children.filter(c=>Number(c.age)>=5).length}</b></div></div>${children.length?`<div class="table-wrap"><table class="table"><tr><th>Anak</th><th>Umur</th><th>Penjaga</th><th>⭐</th></tr>${children.map(c=>{const owner=users.find(u=>u.id===c.ownerUid);const stars=progress.filter(x=>x.childId===c.id).reduce((s,x)=>s+Number(x.stars||0),0);return `<tr><td>${esc(c.avatar||'🧒')} ${esc(c.name||'-')}</td><td>${esc(c.age||'-')}</td><td>${esc(owner?.name||owner?.email||'-')}</td><td>${stars}</td></tr>`}).join('')}</table></div>`:empty('Belum ada profil anak.')}`,

    learning:()=>`${head('Prestasi 3M','Analitik pembelajaran')}<div class="admin-stat-grid">${['Membaca','Menulis','Mengira'].map(m=>{const rows=progress.filter(x=>x.module===m);return `<div class="stat"><small>${m}</small><b>${rows.reduce((s,x)=>s+Number(x.stars||0),0)} ⭐</b><span>${rows.length} aktiviti</span></div>`}).join('')}</div>${progress.length?`<div class="table-wrap"><table class="table"><tr><th>Modul</th><th>Level</th><th>⭐</th><th>Percubaan</th></tr>${progress.slice(-20).reverse().map(x=>`<tr><td>${esc(x.module||'-')}</td><td>${esc(x.level||'-')}</td><td>${Number(x.stars||0)}</td><td>${Number(x.attempts||0)}</td></tr>`).join('')}</table></div>`:empty('Belum ada rekod pembelajaran.')}`,

    subscriptions:()=>`${head('Langganan','Status akses Penjaga')}<div class="stat-grid"><div class="stat"><small>Aktif</small><b>${activeSubs.length}</b></div><div class="stat"><small>Tidak aktif</small><b>${customers.length-activeSubs.length}</b></div><div class="stat"><small>Jumlah Penjaga</small><b>${customers.length}</b></div></div>${customers.length?`<div class="table-wrap"><table class="table"><tr><th>Penjaga</th><th>Status</th><th>Tamat</th></tr>${customers.map(u=>`<tr><td>${esc(u.name||u.email||'-')}</td><td>${statusBadge(u.subscriptionStatus||'inactive')}</td><td>${formatDate(u.subscriptionEndsAt)}</td></tr>`).join('')}</table></div>`:empty('Tiada Penjaga.')}`,

    transactions:()=>`${head('Transaksi','ToyyibPay KIV — rekod sedia ada sahaja')}<div class="stat-grid"><div class="stat"><small>Jumlah rekod</small><b>${orders.length}</b></div><div class="stat"><small>Dibayar</small><b>${paidOrders.length}</b></div><div class="stat"><small>Nilai dibayar</small><b>RM${sales.toFixed(2)}</b></div></div>${orders.length?`<div class="table-wrap"><table class="table"><tr><th>ID</th><th>Pelan</th><th>Nilai</th><th>Status</th></tr>${orders.slice(-30).reverse().map(o=>`<tr><td><code>${esc(o.id)}</code></td><td>${esc(o.plan||'-')}</td><td>RM${Number(o.amount||0).toFixed(2)}</td><td>${statusBadge(o.status)}</td></tr>`).join('')}</table></div>`:empty('Belum ada transaksi. ToyyibPay sedang KIV.')}`,

    commissions:()=>`${head('Komisen','Rekod affiliate')}<div class="stat-grid"><div class="stat"><small>Rekod</small><b>${commissions.length}</b></div><div class="stat"><small>Jumlah</small><b>RM${commissionTotal.toFixed(2)}</b></div><div class="stat"><small>Pending</small><b>${commissions.filter(c=>c.status==='pending').length}</b></div></div>${commissions.length?`<div class="table-wrap"><table class="table"><tr><th>Agent</th><th>Jualan</th><th>Kadar</th><th>Komisen</th><th>Status</th></tr>${commissions.map(c=>{const a=users.find(u=>u.id===c.agentUid);return `<tr><td>${esc(a?.name||c.agentUid||'-')}</td><td>RM${Number(c.saleAmount||0).toFixed(2)}</td><td>${Number(c.ratePercent||0)}%</td><td>RM${Number(c.amount||0).toFixed(2)}</td><td>${statusBadge(c.status)}</td></tr>`}).join('')}</table></div>`:empty('Belum ada komisen.')}`,

    modules:()=>`${head('CMS Bank Soalan 3M','Urus soalan tanpa mengubah kod')}<div class="dash-note">Soalan aktif dalam CMS akan digunakan oleh permainan. Jika sesuatu Modul + Level belum mempunyai soalan CMS aktif, CilikGo akan menggunakan bank soalan terbina dalam sebagai fallback.</div>
      <form id="questionForm" class="question-form">
        <input type="hidden" id="cmsQuestionId">
        <label>Modul<select id="cmsModule"><option>Membaca</option><option>Menulis</option><option>Mengira</option></select></label>
        <label>Level<select id="cmsLevel"><option value="1">Level 1</option><option value="2">Level 2</option><option value="3">Level 3</option></select></label>
        <label class="wide">Soalan / Paparan<input id="cmsPrompt" required placeholder="Contoh: BA + ? atau 🍎 🍎 🍎"></label>
        <label>Pilihan A<input id="cmsA" required placeholder="JU"></label>
        <label>Pilihan B<input id="cmsB" required placeholder="KU"></label>
        <label>Pilihan C<input id="cmsC" required placeholder="TU"></label>
        <label>Jawapan betul<select id="cmsCorrect"><option value="0">Pilihan A</option><option value="1">Pilihan B</option><option value="2">Pilihan C</option></select></label>
        <label class="wide">Maklum balas apabila betul<input id="cmsFeedback" required placeholder="Contoh: BA + JU = BAJU 🎉"></label>
        <label>Susunan<input id="cmsOrder" type="number" min="1" value="1"></label>
        <label class="cms-check"><input id="cmsActive" type="checkbox" checked> Aktif</label>
        <div class="cms-actions"><button class="btn primary" id="cmsSaveBtn">Simpan Soalan</button><button type="button" class="btn ghost hidden" id="cmsCancelEdit">Batal Edit</button></div>
      </form>
      <div class="admin-toolbar"><input id="questionSearch" placeholder="Cari soalan…"><span>${questionsCms.length} soalan CMS</span></div>
      <div id="questionTable">${renderQuestionRows(questionsCms)}</div>`,

    settings:()=>`${head('Settings','Konfigurasi sistem')}<div class="settings-grid"><div class="setting-card"><b>Harga permulaan</b><strong>RM69</strong><small>4 bulan</small></div><div class="setting-card"><b>Pembaharuan</b><strong>RM15</strong><small>1 bulan · KIV pembayaran</small></div><div class="setting-card"><b>Komisen contoh</b><strong>15%</strong><small>Ubah sebelum production jika perlu</small></div></div><div class="dash-note">Tetapan kewangan sensitif dan secret ToyyibPay tidak disimpan atau diedit dari frontend Admin.</div>`
  };

  function renderQuestionRows(list){
    const sorted=[...list].sort((a,b)=>(a.module||'').localeCompare(b.module||'')||Number(a.level||0)-Number(b.level||0)||Number(a.order||0)-Number(b.order||0));
    return sorted.length?`<div class="table-wrap"><table class="table"><tr><th>Modul</th><th>Level</th><th>Soalan</th><th>Jawapan</th><th>Status</th><th>Tindakan</th></tr>${sorted.map(q=>`<tr><td>${esc(q.module||'-')}</td><td>${esc(q.level||'-')}</td><td>${esc(q.prompt||'-')}</td><td><b>${esc(q.correct||'-')}</b></td><td>${statusBadge(q.active===false?'inactive':'active')}</td><td><div class="row-actions"><button class="btn ghost admin-edit-question" data-id="${esc(q.id)}">Edit</button><button class="btn ghost admin-delete-question" data-id="${esc(q.id)}">Padam</button></div></td></tr>`).join('')}</table></div>`:empty('Belum ada soalan CMS. Permainan masih menggunakan bank soalan terbina dalam.');
  }

  function renderUserRows(list){
    return list.length?`<div class="table-wrap"><table class="table"><tr><th>Nama</th><th>E-mel</th><th>Langganan</th><th>Daftar melalui</th></tr>${list.map(u=>`<tr><td>${esc(u.name||'-')}</td><td>${esc(u.email||'-')}</td><td>${statusBadge(u.subscriptionStatus||'inactive')}</td><td>${esc(u.referredByCode||'Direct')}</td></tr>`).join('')}</table></div>`:empty('Tiada pengguna ditemui.');
  }

  let currentView='overview';
  const mount=async(view)=>{
    currentView=view;
    $('#dashboard').innerHTML=shell(view,view==='subscriptions'?'':views[view]());
    if(view==='subscriptions') await renderAdminSubscriptions();
    document.querySelectorAll('.admin-nav').forEach(a=>a.onclick=()=>mount(a.dataset.view));
    const search=$('#adminSearch');
    if(search&&view==='users') search.oninput=()=>{const q=search.value.toLowerCase();$('#adminUserTable').innerHTML=renderUserRows(customers.filter(u=>(u.name||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q)));};
    if(search&&view==='agents') search.oninput=()=>{ /* jadual agent kekal ringkas; carian disediakan pada fasa seterusnya */ };
    if(view==='modules'){
      const resetForm=()=>{
        $('#questionForm').reset(); $('#cmsQuestionId').value=''; $('#cmsOrder').value='1'; $('#cmsActive').checked=true;
        $('#cmsSaveBtn').textContent='Simpan Soalan'; $('#cmsCancelEdit').classList.add('hidden');
      };
      const bindQuestionActions=()=>{
        document.querySelectorAll('.admin-edit-question').forEach(b=>b.onclick=()=>{
          const q=questionsCms.find(x=>x.id===b.dataset.id); if(!q)return;
          $('#cmsQuestionId').value=q.id; $('#cmsModule').value=q.module; $('#cmsLevel').value=String(q.level);
          $('#cmsPrompt').value=q.prompt||''; const ans=q.answers||['','',''];
          $('#cmsA').value=ans[0]||''; $('#cmsB').value=ans[1]||''; $('#cmsC').value=ans[2]||'';
          $('#cmsCorrect').value=String(Math.max(0,ans.indexOf(q.correct))); $('#cmsFeedback').value=q.success||'';
          $('#cmsOrder').value=Number(q.order||1); $('#cmsActive').checked=q.active!==false;
          $('#cmsSaveBtn').textContent='Simpan Perubahan'; $('#cmsCancelEdit').classList.remove('hidden');
          $('#questionForm').scrollIntoView({behavior:'smooth',block:'start'});
        });
        document.querySelectorAll('.admin-delete-question').forEach(b=>b.onclick=async()=>{
          if(!confirm('Padam soalan ini?'))return;
          try{await fb.deleteDoc(fb.doc(fb.db,'questions',b.dataset.id));toast('Soalan dipadam.');await renderAdmin(p);}
          catch(err){toast('Gagal padam: '+friendlyError(err));}
        });
      };
      bindQuestionActions();
      $('#cmsCancelEdit').onclick=resetForm;
      $('#questionSearch').oninput=()=>{
        const q=$('#questionSearch').value.toLowerCase();
        $('#questionTable').innerHTML=renderQuestionRows(questionsCms.filter(x=>(x.prompt||'').toLowerCase().includes(q)||(x.module||'').toLowerCase().includes(q)||(x.correct||'').toLowerCase().includes(q)));
        bindQuestionActions();
      };
      $('#questionForm').onsubmit=async e=>{
        e.preventDefault();
        const answers=[$('#cmsA').value.trim(),$('#cmsB').value.trim(),$('#cmsC').value.trim()];
        const data={module:$('#cmsModule').value,level:Number($('#cmsLevel').value),prompt:$('#cmsPrompt').value.trim(),answers,correct:answers[Number($('#cmsCorrect').value)],success:$('#cmsFeedback').value.trim(),order:Number($('#cmsOrder').value||1),active:$('#cmsActive').checked,updatedAt:fb.serverTimestamp()};
        try{
          const id=$('#cmsQuestionId').value;
          if(id) await fb.setDoc(fb.doc(fb.db,'questions',id),data,{merge:true});
          else await fb.addDoc(fb.collection(fb.db,'questions'),{...data,createdBy:p.uid,createdAt:fb.serverTimestamp()});
          toast(id?'Soalan berjaya dikemas kini.':'Soalan berjaya ditambah.'); await renderAdmin(p);
        }catch(err){toast('Gagal simpan: '+friendlyError(err));}
      };
    }
  };
  await mount('overview');
}

async function renderPortal(p){
  $('#portalTitle').textContent=p.role==='admin'?'Dashboard Admin':p.role==='agent'?'Dashboard Agent':'Dashboard Penjaga';
  $('#portalSubtitle').textContent='Paparan ini menggunakan akaun dan role sebenar daripada Firebase.';
  if(p.role==='admin') await renderAdmin(p); else if(p.role==='agent') await renderAgent(p); else await renderUser(p);
}

if(fb) fb.onAuthStateChanged(fb.auth, async user=>{
  if(!user){ currentProfile=null; $('#guestActions').classList.remove('hidden'); $('#memberActions').classList.add('hidden'); $('#portalTitle').textContent='Dashboard anda.'; $('#portalSubtitle').textContent='Log masuk untuk membuka dashboard mengikut peranan akaun anda.'; $('#dashboard').innerHTML='<div class="portal-locked"><div class="lock-icon">🔐</div><h3>Portal dilindungi</h3><p>Log masuk sebagai User/Penjaga, Agent atau Admin untuk melihat paparan anda.</p><button class="btn primary" id="lockedLogin">Log Masuk</button></div>'; $('#lockedLogin').onclick=()=>$('#loginModal').showModal(); return; }
  try{ currentProfile=await getProfile(user); $('#guestActions').classList.add('hidden'); $('#memberActions').classList.remove('hidden'); $('#memberName').textContent=currentProfile.name||user.email; await renderPortal(currentProfile); }
  catch(e){ console.error(e); toast('Gagal membaca profil Firestore: '+e.message); }
});

async function startPayment(plan='starter'){
  if(!fb?.auth.currentUser) return toast('Sila log masuk dahulu.');
  if(currentProfile?.role!=='user') return toast('Langganan adalah untuk akaun Penjaga.');
  try{
    toast('Menyediakan pembayaran selamat…');
    const token=await fb.auth.currentUser.getIdToken();
    const res=await fetch(`${FUNCTIONS_BASE_URL}/createBill`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({plan})
    });
    const data=await res.json();
    if(!res.ok) throw new Error(data.error||'Gagal cipta bil');
    if(!data.paymentUrl) throw new Error('URL pembayaran tidak diterima.');
    location.href=data.paymentUrl;
  }catch(e){
    console.error(e);
    toast('Pembayaran belum aktif. Deploy Firebase Functions dan tetapkan ToyyibPay terlebih dahulu.');
  }
}
$('#buyBtn').onclick=()=>startPayment(currentProfile?.subscriptionStatus==='active'?'renewal':'starter');

$('#saveChildBtn').onclick=async()=>{
  if(!fb?.auth.currentUser||currentProfile?.role!=='user') return toast('Fungsi ini untuk akaun Penjaga.');
  const name=$('#childName').value.trim(), year=Number($('#childYear').value), age=year+6, avatar=$('#childAvatar').value;
  if(!name) return toast('Masukkan nama panggilan anak.');
  try{ const ref=await fb.addDoc(fb.collection(fb.db,'children'),{ownerUid:fb.auth.currentUser.uid,name,age,year,avatar,createdAt:fb.serverTimestamp()}); localStorage.setItem('cilikgo_active_child',ref.id); $('#childName').value=''; $('#childModal').close(); toast('Profil anak berjaya ditambah.'); await renderUser(currentProfile); }
  catch(e){ console.error(e); toast('Gagal simpan profil: '+friendlyError(e)); }
};

const kssrArchitecture={
  years:[1,2,3,4,5,6],
  subjects:{
    bm:{name:'Bahasa Melayu',icon:'🇲🇾'},
    bi:{name:'Bahasa Inggeris',icon:'🔤'},
    math:{name:'Matematik',icon:'➗'},
    science:{name:'Sains',icon:'🔬'},
    sejarah:{name:'Sejarah',icon:'🏛️'}
  },
  questionSchema:['year','subject','topic','contentStandard','learningStandard','difficulty','questionType','prompt','answers','correct','explanation','sourceType']
};

const biYear1Bank={
  alphabet:{
    title:'Letters & Sounds',icon:'🔤',
    desc:'Recognise letters, beginning sounds and simple letter patterns.',
    questions:[
      {prompt:'Which letter comes after A?',answers:['B','C','D'],correct:'B',success:'Correct! B comes after A.'},
      {prompt:'Which letter comes before D?',answers:['B','C','E'],correct:'C',success:'Correct! C comes before D.'},
      {prompt:'Which word starts with B?',answers:['ball','cat','fish'],correct:'ball',success:'Correct! Ball starts with B.'},
      {prompt:'Which word starts with C?',answers:['dog','cat','sun'],correct:'cat',success:'Correct! Cat starts with C.'},
      {prompt:'Choose the small letter for M.',answers:['m','n','w'],correct:'m',success:'Correct! The small letter for M is m.'},
      {prompt:'Choose the capital letter for a.',answers:['A','E','O'],correct:'A',success:'Correct! The capital letter for a is A.'},
      {prompt:'Which word ends with T?',answers:['cat','dog','sun'],correct:'cat',success:'Correct! Cat ends with T.'},
      {prompt:'Which word begins with the sound /s/?',answers:['sun','ball','fish'],correct:'sun',success:'Correct! Sun begins with the /s/ sound.'},
      {prompt:'Complete the pattern: A, B, C, __',answers:['D','E','F'],correct:'D',success:'Correct! D comes next.'},
      {prompt:'Which pair matches?',answers:['G - g','G - q','G - c'],correct:'G - g',success:'Correct! G matches with g.'}
    ]
  },
  vocabulary:{
    title:'Everyday Vocabulary',icon:'🧠',
    desc:'Learn common words about people, objects, animals and places.',
    questions:[
      {prompt:'Which one is an animal?',answers:['cat','chair','book'],correct:'cat',success:'Correct! A cat is an animal.'},
      {prompt:'Which one do we use for writing?',answers:['pencil','plate','shoe'],correct:'pencil',success:'Correct! We use a pencil for writing.'},
      {prompt:'Where do pupils learn?',answers:['school','market','park'],correct:'school',success:'Correct! Pupils learn at school.'},
      {prompt:'Which one is a fruit?',answers:['apple','table','shirt'],correct:'apple',success:'Correct! An apple is a fruit.'},
      {prompt:'Which one is a colour?',answers:['blue','run','book'],correct:'blue',success:'Correct! Blue is a colour.'},
      {prompt:'Which body part do we use to see?',answers:['eyes','ears','feet'],correct:'eyes',success:'Correct! We use our eyes to see.'},
      {prompt:'Which one can fly?',answers:['bird','fish','cat'],correct:'bird',success:'Correct! A bird can fly.'},
      {prompt:'Which room is used for cooking?',answers:['kitchen','bedroom','garden'],correct:'kitchen',success:'Correct! We cook in the kitchen.'},
      {prompt:'Which word means the opposite of big?',answers:['small','long','fast'],correct:'small',success:'Correct! Small is the opposite of big.'},
      {prompt:'Which word means the opposite of hot?',answers:['cold','sweet','soft'],correct:'cold',success:'Correct! Cold is the opposite of hot.'}
    ]
  },
  grammar:{
    title:'Basic Grammar',icon:'🧩',
    desc:'Use simple nouns, verbs, adjectives and basic sentence patterns.',
    questions:[
      {prompt:'Choose the noun.',answers:['book','run','happy'],correct:'book',success:'Correct! Book is a noun.'},
      {prompt:'Choose the verb.',answers:['jump','table','red'],correct:'jump',success:'Correct! Jump is a verb.'},
      {prompt:'Choose the adjective.',answers:['happy','cat','eat'],correct:'happy',success:'Correct! Happy is an adjective.'},
      {prompt:'I ___ milk.',answers:['drink','blue','chair'],correct:'drink',success:'Correct! I drink milk.'},
      {prompt:'She ___ a book.',answers:['reads','yellow','school'],correct:'reads',success:'Correct! She reads a book.'},
      {prompt:'The ball is ___.',answers:['round','run','table'],correct:'round',success:'Correct! Round describes the ball.'},
      {prompt:'Choose the correct sentence.',answers:['I am Ali.','I Ali am.','Am I Ali.'],correct:'I am Ali.',success:'Correct! “I am Ali.” is correct.'},
      {prompt:'Choose the correct word: This is ___ cat.',answers:['a','an','two'],correct:'a',success:'Correct! We say “a cat”.'},
      {prompt:'Choose the correct word: This is ___ apple.',answers:['a','an','the two'],correct:'an',success:'Correct! We say “an apple”.'},
      {prompt:'They ___ happy.',answers:['are','is','am'],correct:'are',success:'Correct! We say “They are happy.”'}
    ]
  },
  reading:{
    title:'Reading Comprehension',icon:'📖',
    desc:'Read short sentences and answer simple questions.',
    questions:[
      {prompt:'“Ali has a red ball.” What colour is the ball?',answers:['red','blue','green'],correct:'red',success:'Correct! The ball is red.'},
      {prompt:'“Mia has two cats.” How many cats does Mia have?',answers:['one','two','three'],correct:'two',success:'Correct! Mia has two cats.'},
      {prompt:'“The boy eats rice.” What does the boy eat?',answers:['rice','bread','cake'],correct:'rice',success:'Correct! The boy eats rice.'},
      {prompt:'“Sara goes to school in the morning.” When does Sara go to school?',answers:['morning','evening','night'],correct:'morning',success:'Correct! Sara goes in the morning.'},
      {prompt:'“The bird is in the tree.” Where is the bird?',answers:['in the tree','under the table','in the car'],correct:'in the tree',success:'Correct! The bird is in the tree.'},
      {prompt:'“Dad drives a car.” What does Dad drive?',answers:['car','bus','bike'],correct:'car',success:'Correct! Dad drives a car.'},
      {prompt:'“The fish swims in water.” What does the fish do?',answers:['swims','runs','flies'],correct:'swims',success:'Correct! The fish swims.'},
      {prompt:'“Lina likes bananas.” What fruit does Lina like?',answers:['bananas','apples','oranges'],correct:'bananas',success:'Correct! Lina likes bananas.'},
      {prompt:'“The book is on the table.” Where is the book?',answers:['on the table','under the bed','in the bag'],correct:'on the table',success:'Correct! The book is on the table.'},
      {prompt:'“Ben is seven years old.” How old is Ben?',answers:['six','seven','eight'],correct:'seven',success:'Correct! Ben is seven years old.'}
    ]
  },
  writing:{
    title:'Writing Basics',icon:'✏️',
    desc:'Spell common words and build simple sentences.',
    questions:[
      {prompt:'Choose the correct spelling.',answers:['school','scool','schol'],correct:'school',success:'Correct! School is spelt S-C-H-O-O-L.'},
      {prompt:'Choose the correct spelling.',answers:['apple','aple','appel'],correct:'apple',success:'Correct! Apple is the correct spelling.'},
      {prompt:'Choose the correct spelling.',answers:['house','hous','howse'],correct:'house',success:'Correct! House is the correct spelling.'},
      {prompt:'Complete the word: c _ t',answers:['a','e','i'],correct:'a',success:'Correct! C-A-T spells cat.'},
      {prompt:'Complete the word: d _ g',answers:['o','a','u'],correct:'o',success:'Correct! D-O-G spells dog.'},
      {prompt:'Choose the sentence with a capital letter.',answers:['My name is Ben.','my name is Ben.','MY name is Ben.'],correct:'My name is Ben.',success:'Correct! A sentence starts with a capital letter.'},
      {prompt:'Choose the sentence with a full stop.',answers:['I like milk.','I like milk?','I like milk'],correct:'I like milk.',success:'Correct! The sentence ends with a full stop.'},
      {prompt:'Put the words in the correct order.',answers:['I like cats.','Like I cats.','Cats I like.'],correct:'I like cats.',success:'Correct! “I like cats.” is the correct order.'},
      {prompt:'Complete the sentence: This is my ___.',answers:['book','run','blue'],correct:'book',success:'Correct! “This is my book.”'},
      {prompt:'Complete the sentence: I can ___.',answers:['jump','green','table'],correct:'jump',success:'Correct! “I can jump.”'}
    ]
  },
  communication:{
    title:'Simple Communication',icon:'💬',
    desc:'Use greetings, polite expressions and everyday classroom language.',
    questions:[
      {prompt:'What do you say when you meet someone in the morning?',answers:['Good morning','Good night','Goodbye'],correct:'Good morning',success:'Correct! We say “Good morning”.'},
      {prompt:'What do you say when someone helps you?',answers:['Thank you','Sorry','Good night'],correct:'Thank you',success:'Correct! We say “Thank you”.'},
      {prompt:'What do you say when you make a mistake?',answers:['Sorry','Welcome','Hello'],correct:'Sorry',success:'Correct! We say “Sorry”.'},
      {prompt:'Choose the polite request.',answers:['Please give me the pencil.','Give me the pencil!','Pencil now!'],correct:'Please give me the pencil.',success:'Correct! That is a polite request.'},
      {prompt:'What can you say before leaving?',answers:['Goodbye','Good morning','Thank you'],correct:'Goodbye',success:'Correct! We say “Goodbye”.'},
      {prompt:'Choose the correct reply to “How are you?”',answers:['I am fine, thank you.','My name is Ali.','Good night.'],correct:'I am fine, thank you.',success:'Correct! That is a suitable reply.'},
      {prompt:'Choose the correct reply to “What is your name?”',answers:['My name is Sara.','I am seven years old.','I like apples.'],correct:'My name is Sara.',success:'Correct! That answers the question.'},
      {prompt:'What do you say when asking permission?',answers:['May I come in?','Come in now!','I am coming in.'],correct:'May I come in?',success:'Correct! “May I come in?” is polite.'},
      {prompt:'Choose the classroom instruction.',answers:['Open your book.','The book is blue.','I like books.'],correct:'Open your book.',success:'Correct! “Open your book.” is an instruction.'},
      {prompt:'Choose the polite expression.',answers:['Excuse me','Move!','Go away!'],correct:'Excuse me',success:'Correct! “Excuse me” is polite.'}
    ]
  }
};

const bmYear1Bank={
  huruf:{
    title:'Huruf, Suku Kata & Perkataan',icon:'🔤',
    desc:'Kenal huruf, gabung suku kata dan baca perkataan mudah.',
    questions:[
      {prompt:'Huruf pertama bagi perkataan “buku” ialah…',answers:['B','D','P'],correct:'B',success:'Betul! Buku bermula dengan huruf B.'},
      {prompt:'Huruf terakhir bagi perkataan “mata” ialah…',answers:['M','T','A'],correct:'A',success:'Betul! Mata berakhir dengan huruf A.'},
      {prompt:'Gabungkan suku kata: BA + JU',answers:['BAJU','BUJU','BAJI'],correct:'BAJU',success:'Betul! BA + JU menjadi BAJU.'},
      {prompt:'Gabungkan suku kata: BO + LA',answers:['BOLA','BALA','BULA'],correct:'BOLA',success:'Hebat! BO + LA menjadi BOLA.'},
      {prompt:'Pilih suku kata awal bagi “kuda”.',answers:['KU','DA','KA'],correct:'KU',success:'Betul! Kuda bermula dengan suku kata KU.'},
      {prompt:'Pilih suku kata akhir bagi “roti”.',answers:['RO','TI','RI'],correct:'TI',success:'Betul! Roti berakhir dengan suku kata TI.'},
      {prompt:'Perkataan manakah bermula dengan huruf M?',answers:['mata','baju','susu'],correct:'mata',success:'Betul! Mata bermula dengan M.'},
      {prompt:'Perkataan manakah mempunyai dua suku kata?',answers:['buku','sekolah','permainan'],correct:'buku',success:'Betul! BU-KU mempunyai dua suku kata.'},
      {prompt:'Lengkapkan perkataan: B _ L A',answers:['O','U','E'],correct:'O',success:'Betul! BOLA dieja B-O-L-A.'},
      {prompt:'Lengkapkan perkataan: S U S _',answers:['A','I','U'],correct:'U',success:'Betul! SUSU berakhir dengan huruf U.'}
    ]
  },
  kosa:{
    title:'Kosa Kata',icon:'🧠',
    desc:'Kenal makna perkataan dan penggunaan kosa kata harian.',
    questions:[
      {prompt:'Haiwan yang berbunyi “meow” ialah…',answers:['kucing','ayam','ikan'],correct:'kucing',success:'Betul! Kucing berbunyi meow.'},
      {prompt:'Kita menggunakan pensel untuk…',answers:['menulis','minum','tidur'],correct:'menulis',success:'Betul! Pensel digunakan untuk menulis.'},
      {prompt:'Tempat murid belajar ialah…',answers:['sekolah','pasar','hospital'],correct:'sekolah',success:'Betul! Murid belajar di sekolah.'},
      {prompt:'Lawan perkataan “besar” ialah…',answers:['kecil','tinggi','panjang'],correct:'kecil',success:'Betul! Lawan besar ialah kecil.'},
      {prompt:'Lawan perkataan “panas” ialah…',answers:['sejuk','manis','keras'],correct:'sejuk',success:'Betul! Lawan panas ialah sejuk.'},
      {prompt:'Buah yang berwarna kuning dan panjang ialah…',answers:['pisang','epal','anggur'],correct:'pisang',success:'Betul! Pisang biasanya berwarna kuning.'},
      {prompt:'Kita memakai kasut pada…',answers:['kaki','tangan','kepala'],correct:'kaki',success:'Betul! Kasut dipakai pada kaki.'},
      {prompt:'Benda yang digunakan ketika hujan ialah…',answers:['payung','bantal','sudu'],correct:'payung',success:'Betul! Payung digunakan ketika hujan.'},
      {prompt:'Perkataan yang sesuai untuk sesuatu yang sedap dimakan ialah…',answers:['lazat','bising','gelap'],correct:'lazat',success:'Betul! Lazat bermaksud sedap.'},
      {prompt:'Kita minum apabila berasa…',answers:['dahaga','mengantuk','marah'],correct:'dahaga',success:'Betul! Kita minum apabila dahaga.'}
    ]
  },
  tatabahasa:{
    title:'Tatabahasa Asas',icon:'🧩',
    desc:'Kata nama, kata kerja, kata adjektif dan penggunaan perkataan mudah.',
    questions:[
      {prompt:'Pilih kata nama.',answers:['bola','lari','cantik'],correct:'bola',success:'Betul! Bola ialah kata nama.'},
      {prompt:'Pilih kata kerja.',answers:['makan','meja','merah'],correct:'makan',success:'Betul! Makan ialah kata kerja.'},
      {prompt:'Pilih kata adjektif.',answers:['cantik','buku','duduk'],correct:'cantik',success:'Betul! Cantik menerangkan sifat.'},
      {prompt:'Ali ___ nasi.',answers:['makan','biru','kerusi'],correct:'makan',success:'Betul! Ali makan nasi.'},
      {prompt:'Bunga itu sangat ___.',answers:['cantik','minum','sekolah'],correct:'cantik',success:'Betul! Cantik menerangkan bunga.'},
      {prompt:'___ itu sedang tidur.',answers:['Kucing','Makan','Merah'],correct:'Kucing',success:'Betul! Kucing ialah kata nama.'},
      {prompt:'Pilih perkataan yang menunjukkan perbuatan.',answers:['berlari','rumah','besar'],correct:'berlari',success:'Betul! Berlari ialah perbuatan.'},
      {prompt:'Pilih perkataan yang menunjukkan warna.',answers:['merah','meja','makan'],correct:'merah',success:'Betul! Merah ialah warna.'},
      {prompt:'Saya ___ air.',answers:['minum','tinggi','buku'],correct:'minum',success:'Betul! Saya minum air.'},
      {prompt:'Ayah memandu ___.',answers:['kereta','tidur','manis'],correct:'kereta',success:'Betul! Ayah memandu kereta.'}
    ]
  },
  faham:{
    title:'Pemahaman Ayat',icon:'📖',
    desc:'Baca ayat mudah dan pilih jawapan berdasarkan maklumat.',
    questions:[
      {prompt:'“Ali ada seekor kucing.” Siapakah yang mempunyai kucing?',answers:['Ali','Siti','Ibu'],correct:'Ali',success:'Betul! Ali mempunyai seekor kucing.'},
      {prompt:'“Siti makan nasi.” Apakah yang Siti makan?',answers:['nasi','roti','buah'],correct:'nasi',success:'Betul! Siti makan nasi.'},
      {prompt:'“Bola Amir berwarna biru.” Apakah warna bola Amir?',answers:['merah','biru','hijau'],correct:'biru',success:'Betul! Bola Amir berwarna biru.'},
      {prompt:'“Ibu membeli tiga biji epal.” Berapa biji epal dibeli?',answers:['dua','tiga','empat'],correct:'tiga',success:'Betul! Ibu membeli tiga biji epal.'},
      {prompt:'“Aina pergi ke sekolah pada waktu pagi.” Bilakah Aina pergi ke sekolah?',answers:['pagi','petang','malam'],correct:'pagi',success:'Betul! Aina pergi pada waktu pagi.'},
      {prompt:'“Ayah membaca surat khabar.” Apakah yang dibaca oleh ayah?',answers:['surat khabar','buku cerita','majalah'],correct:'surat khabar',success:'Betul! Ayah membaca surat khabar.'},
      {prompt:'“Adik tidur di dalam bilik.” Di manakah adik tidur?',answers:['bilik','dapur','taman'],correct:'bilik',success:'Betul! Adik tidur di dalam bilik.'},
      {prompt:'“Rina menyiram pokok bunga.” Apakah yang Rina siram?',answers:['pokok bunga','kereta','meja'],correct:'pokok bunga',success:'Betul! Rina menyiram pokok bunga.'},
      {prompt:'“Kamal menaiki bas ke sekolah.” Kamal pergi ke sekolah dengan…',answers:['bas','kapal','basikal'],correct:'bas',success:'Betul! Kamal menaiki bas.'},
      {prompt:'“Burung itu terbang tinggi.” Apakah yang dilakukan oleh burung?',answers:['terbang','berenang','tidur'],correct:'terbang',success:'Betul! Burung itu terbang.'}
    ]
  },
  menulis:{
    title:'Penulisan Asas',icon:'✏️',
    desc:'Ejaan, susunan perkataan, huruf besar dan tanda baca.',
    questions:[
      {prompt:'Pilih ejaan yang betul.',answers:['sekolah','sakolah','sekulah'],correct:'sekolah',success:'Betul! Ejaan yang betul ialah sekolah.'},
      {prompt:'Pilih ejaan yang betul.',answers:['kereta','kareta','kerita'],correct:'kereta',success:'Betul! Ejaan yang betul ialah kereta.'},
      {prompt:'Pilih ayat dengan huruf besar yang betul.',answers:['Ali makan nasi.','ali makan nasi.','ALI makan nasi.'],correct:'Ali makan nasi.',success:'Betul! Nama khas bermula dengan huruf besar.'},
      {prompt:'Pilih ayat yang mempunyai tanda noktah.',answers:['Ini buku saya.','Ini buku saya?','Ini buku saya'],correct:'Ini buku saya.',success:'Betul! Ayat penyata berakhir dengan noktah.'},
      {prompt:'Susun perkataan menjadi ayat yang betul.',answers:['Saya suka membaca.','Suka saya membaca.','Membaca suka saya.'],correct:'Saya suka membaca.',success:'Betul! Ayatnya ialah “Saya suka membaca.”'},
      {prompt:'Susun perkataan menjadi ayat yang betul.',answers:['Ibu memasak nasi.','Nasi ibu memasak.','Memasak ibu nasi.'],correct:'Ibu memasak nasi.',success:'Betul! Ayatnya ialah “Ibu memasak nasi.”'},
      {prompt:'Lengkapkan ayat: Ini ___ saya.',answers:['buku','makan','lari'],correct:'buku',success:'Betul! “Ini buku saya.”'},
      {prompt:'Lengkapkan ayat: Adik bermain ___.',answers:['bola','tidur','merah'],correct:'bola',success:'Betul! “Adik bermain bola.”'},
      {prompt:'Pilih ayat soalan.',answers:['Siapa nama kamu?','Nama saya Amin.','Saya suka membaca.'],correct:'Siapa nama kamu?',success:'Betul! Ayat itu ialah ayat soalan.'},
      {prompt:'Pilih ejaan nama yang betul.',answers:['Amin','amin','aMin'],correct:'Amin',success:'Betul! Nama orang bermula dengan huruf besar.'}
    ]
  },
  santun:{
    title:'Bahasa Santun & Seni Bahasa',icon:'💬',
    desc:'Ungkapan sopan, peribahasa mudah, rima dan penggunaan bahasa yang baik.',
    questions:[
      {prompt:'Apakah yang kita ucap apabila menerima bantuan?',answers:['Terima kasih','Selamat malam','Tahniah'],correct:'Terima kasih',success:'Betul! Kita mengucapkan terima kasih.'},
      {prompt:'Apakah yang kita ucap apabila melakukan kesalahan?',answers:['Maaf','Silakan','Jumpa lagi'],correct:'Maaf',success:'Betul! Kita meminta maaf.'},
      {prompt:'Ucapan yang sesuai apabila bertemu guru pada waktu pagi ialah…',answers:['Selamat pagi','Selamat malam','Selamat tinggal'],correct:'Selamat pagi',success:'Betul! Kita mengucapkan selamat pagi.'},
      {prompt:'Pilih ayat yang lebih sopan.',answers:['Tolong berikan saya pensel.','Beri pensel!','Aku mahu pensel.'],correct:'Tolong berikan saya pensel.',success:'Betul! Ayat itu lebih sopan.'},
      {prompt:'Perkataan yang berima dengan “batu” ialah…',answers:['satu','bola','buku'],correct:'satu',success:'Betul! Batu dan satu mempunyai bunyi akhir yang hampir sama.'},
      {prompt:'Perkataan yang berima dengan “mata” ialah…',answers:['kata','buku','susu'],correct:'kata',success:'Betul! Mata dan kata berima.'},
      {prompt:'Pilih ungkapan yang sesuai untuk memberi izin.',answers:['Silakan','Maaf','Tahniah'],correct:'Silakan',success:'Betul! “Silakan” digunakan untuk memberi izin.'},
      {prompt:'Apakah ucapan sesuai apabila kawan menang pertandingan?',answers:['Tahniah','Maaf','Tolong'],correct:'Tahniah',success:'Betul! Kita mengucapkan tahniah.'},
      {prompt:'Pilih ayat yang menunjukkan permintaan.',answers:['Boleh saya pinjam buku?','Saya ada buku.','Buku itu biru.'],correct:'Boleh saya pinjam buku?',success:'Betul! Ayat itu meminta izin dengan sopan.'},
      {prompt:'Pilih pasangan perkataan yang berima.',answers:['baju - maju','buku - bola','mata - meja'],correct:'baju - maju',success:'Betul! Baju dan maju berima.'}
    ]
  }
};

const mathYear1Bank={
  numbers:{
    title:'Nombor hingga 100',icon:'🔢',
    desc:'Kenal, susun, banding dan nilai tempat nombor.',
    questions:[
      {prompt:'Nombor selepas 29 ialah…',answers:['28','30','31'],correct:'30',success:'Betul! Selepas 29 ialah 30.'},
      {prompt:'Nombor sebelum 50 ialah…',answers:['48','49','51'],correct:'49',success:'Betul! Sebelum 50 ialah 49.'},
      {prompt:'Pilih nombor paling besar.',answers:['37','73','27'],correct:'73',success:'Hebat! 73 ialah nombor paling besar.'},
      {prompt:'Pilih nombor paling kecil.',answers:['46','16','61'],correct:'16',success:'Betul! 16 ialah nombor paling kecil.'},
      {prompt:'Lengkapkan turutan: 12, 13, 14, __',answers:['15','16','17'],correct:'15',success:'Bagus! Selepas 14 ialah 15.'},
      {prompt:'Lengkapkan turutan: 40, 50, 60, __',answers:['65','70','80'],correct:'70',success:'Tepat! Turutan bertambah 10.'},
      {prompt:'Dalam nombor 42, digit puluh ialah…',answers:['2','4','6'],correct:'4',success:'Betul! 42 mempunyai 4 puluh.'},
      {prompt:'Dalam nombor 68, digit sa ialah…',answers:['6','8','14'],correct:'8',success:'Betul! Digit sa bagi 68 ialah 8.'},
      {prompt:'3 puluh dan 5 sa menjadi…',answers:['30','35','53'],correct:'35',success:'Hebat! 3 puluh dan 5 sa ialah 35.'},
      {prompt:'Manakah sama dengan 80?',answers:['8 puluh','8 sa','18 puluh'],correct:'8 puluh',success:'Betul! 8 puluh bersamaan 80.'}
    ]
  },
  addsub:{
    title:'Tambah & Tolak',icon:'➕',
    desc:'Operasi tambah dan tolak asas dalam lingkungan 100.',
    questions:[
      {prompt:'7 + 5 = ?',answers:['11','12','13'],correct:'12',success:'Betul! 7 tambah 5 ialah 12.'},
      {prompt:'14 + 3 = ?',answers:['16','17','18'],correct:'17',success:'Betul! 14 tambah 3 ialah 17.'},
      {prompt:'20 + 6 = ?',answers:['24','26','28'],correct:'26',success:'Hebat! 20 tambah 6 ialah 26.'},
      {prompt:'32 + 10 = ?',answers:['40','42','52'],correct:'42',success:'Betul! 32 tambah 10 ialah 42.'},
      {prompt:'15 - 4 = ?',answers:['9','11','12'],correct:'11',success:'Betul! 15 tolak 4 ialah 11.'},
      {prompt:'28 - 8 = ?',answers:['18','20','22'],correct:'20',success:'Tepat! 28 tolak 8 ialah 20.'},
      {prompt:'40 - 10 = ?',answers:['20','30','50'],correct:'30',success:'Bagus! 40 tolak 10 ialah 30.'},
      {prompt:'Ali ada 6 guli. Dia mendapat 3 lagi. Jumlah guli?',answers:['8','9','10'],correct:'9',success:'Betul! 6 tambah 3 ialah 9 guli.'},
      {prompt:'Siti ada 12 epal. Dia beri 2 epal. Tinggal?',answers:['9','10','14'],correct:'10',success:'Betul! 12 tolak 2 tinggal 10.'},
      {prompt:'Manakah ayat matematik yang jawapannya 15?',answers:['10 + 5','10 + 4','10 - 5'],correct:'10 + 5',success:'Hebat! 10 tambah 5 ialah 15.'}
    ]
  },
  money:{
    title:'Wang',icon:'💰',
    desc:'Kenal duit Malaysia dan kira nilai wang mudah.',
    questions:[
      {prompt:'Syiling manakah bernilai paling besar?',answers:['10 sen','20 sen','50 sen'],correct:'50 sen',success:'Betul! 50 sen paling besar.'},
      {prompt:'RM1 bersamaan berapa sen?',answers:['10 sen','50 sen','100 sen'],correct:'100 sen',success:'Betul! RM1 bersamaan 100 sen.'},
      {prompt:'20 sen + 20 sen = ?',answers:['30 sen','40 sen','50 sen'],correct:'40 sen',success:'Tepat! Jumlahnya 40 sen.'},
      {prompt:'50 sen + 50 sen = ?',answers:['RM1','RM2','RM5'],correct:'RM1',success:'Betul! 50 sen tambah 50 sen ialah RM1.'},
      {prompt:'RM2 + RM3 = ?',answers:['RM4','RM5','RM6'],correct:'RM5',success:'Hebat! RM2 tambah RM3 ialah RM5.'},
      {prompt:'Harga pensel RM1. Ali bayar RM2. Baki ialah…',answers:['RM1','RM2','RM3'],correct:'RM1',success:'Betul! Bakinya RM1.'},
      {prompt:'Harga buku RM4. Duit Siti RM5. Adakah duitnya cukup?',answers:['Ya','Tidak','Tidak pasti'],correct:'Ya',success:'Betul! RM5 cukup untuk membeli buku RM4.'},
      {prompt:'Pilih jumlah yang lebih banyak.',answers:['RM2','RM5','RM1'],correct:'RM5',success:'Betul! RM5 paling banyak.'},
      {prompt:'Dua keping RM1 bernilai…',answers:['RM1','RM2','RM10'],correct:'RM2',success:'Betul! Dua keping RM1 ialah RM2.'},
      {prompt:'10 sen + 20 sen + 20 sen = ?',answers:['40 sen','50 sen','60 sen'],correct:'50 sen',success:'Bagus! Jumlahnya 50 sen.'}
    ]
  },
  time:{
    title:'Masa & Waktu',icon:'🕒',
    desc:'Jam, hari dan urutan aktiviti harian.',
    questions:[
      {prompt:'Jika jarum pendek pada 3 dan jarum panjang pada 12, waktunya…',answers:['2:00','3:00','3:30'],correct:'3:00',success:'Betul! Waktunya pukul 3.'},
      {prompt:'1 jam mempunyai berapa minit?',answers:['30','60','100'],correct:'60',success:'Betul! 1 jam mempunyai 60 minit.'},
      {prompt:'Hari selepas Isnin ialah…',answers:['Ahad','Selasa','Rabu'],correct:'Selasa',success:'Betul! Selepas Isnin ialah Selasa.'},
      {prompt:'Hari sebelum Jumaat ialah…',answers:['Rabu','Khamis','Sabtu'],correct:'Khamis',success:'Betul! Sebelum Jumaat ialah Khamis.'},
      {prompt:'Biasanya kita sarapan pada waktu…',answers:['pagi','petang','malam'],correct:'pagi',success:'Betul! Sarapan biasanya pada waktu pagi.'},
      {prompt:'Biasanya kita tidur pada waktu…',answers:['pagi','tengah hari','malam'],correct:'malam',success:'Betul! Kita biasanya tidur pada waktu malam.'},
      {prompt:'Pukul 7:00 dibaca sebagai…',answers:['pukul tujuh','pukul lapan','pukul tujuh setengah'],correct:'pukul tujuh',success:'Betul! 7:00 ialah pukul tujuh.'},
      {prompt:'Jika sekarang pukul 2:00, satu jam kemudian ialah…',answers:['1:00','3:00','4:00'],correct:'3:00',success:'Betul! Satu jam selepas 2:00 ialah 3:00.'},
      {prompt:'Antara berikut, manakah lebih lama?',answers:['1 minit','1 jam','10 minit'],correct:'1 jam',success:'Betul! 1 jam lebih lama.'},
      {prompt:'Susunan hari yang betul ialah…',answers:['Isnin, Selasa, Rabu','Isnin, Rabu, Selasa','Selasa, Isnin, Rabu'],correct:'Isnin, Selasa, Rabu',success:'Betul! Itu susunan hari yang betul.'}
    ]
  },
  measure:{
    title:'Ukuran & Sukatan',icon:'📏',
    desc:'Banding panjang, jisim dan isi padu secara asas.',
    questions:[
      {prompt:'Pensel 15 cm dan pemadam 5 cm. Yang lebih panjang ialah…',answers:['pensel','pemadam','sama panjang'],correct:'pensel',success:'Betul! Pensel lebih panjang.'},
      {prompt:'Gajah dan kucing. Yang lebih berat ialah…',answers:['kucing','gajah','sama berat'],correct:'gajah',success:'Betul! Gajah lebih berat.'},
      {prompt:'Baldi dan cawan. Yang boleh mengisi lebih banyak air ialah…',answers:['cawan','baldi','sama banyak'],correct:'baldi',success:'Betul! Baldi mempunyai kapasiti lebih besar.'},
      {prompt:'Unit yang sesuai untuk mengukur panjang buku ialah…',answers:['sentimeter','ringgit','jam'],correct:'sentimeter',success:'Betul! Sentimeter sesuai untuk panjang buku.'},
      {prompt:'Antara 9 cm dan 12 cm, yang lebih panjang ialah…',answers:['9 cm','12 cm','sama'],correct:'12 cm',success:'Tepat! 12 cm lebih panjang.'},
      {prompt:'Beg berisi 5 buku dan beg berisi 1 buku. Yang biasanya lebih berat ialah…',answers:['beg 5 buku','beg 1 buku','sama'],correct:'beg 5 buku',success:'Betul! Beg dengan 5 buku biasanya lebih berat.'},
      {prompt:'Botol penuh dan botol separuh penuh. Yang mempunyai lebih banyak air ialah…',answers:['botol penuh','botol separuh','sama'],correct:'botol penuh',success:'Betul! Botol penuh mempunyai lebih banyak air.'},
      {prompt:'Pilih objek yang biasanya paling pendek.',answers:['pemadam','pintu','meja'],correct:'pemadam',success:'Betul! Pemadam biasanya paling pendek.'},
      {prompt:'Pilih objek yang biasanya paling ringan.',answers:['bulu','kerusi','peti ais'],correct:'bulu',success:'Betul! Bulu biasanya paling ringan.'},
      {prompt:'Bekas A muat 2 cawan air. Bekas B muat 5 cawan. Yang lebih besar kapasitinya ialah…',answers:['Bekas A','Bekas B','sama'],correct:'Bekas B',success:'Betul! Bekas B mempunyai kapasiti lebih besar.'}
    ]
  },
  shapes:{
    title:'Bentuk & Data',icon:'🔷',
    desc:'Kenal bentuk asas dan baca maklumat mudah.',
    questions:[
      {prompt:'Bentuk yang mempunyai 3 sisi ialah…',answers:['bulatan','segi tiga','segi empat sama'],correct:'segi tiga',success:'Betul! Segi tiga mempunyai 3 sisi.'},
      {prompt:'Bentuk yang mempunyai 4 sisi sama panjang ialah…',answers:['segi empat sama','bulatan','segi tiga'],correct:'segi empat sama',success:'Betul! Segi empat sama mempunyai 4 sisi sama panjang.'},
      {prompt:'Bentuk yang tiada sisi lurus ialah…',answers:['bulatan','segi tiga','segi empat tepat'],correct:'bulatan',success:'Betul! Bulatan tiada sisi lurus.'},
      {prompt:'Objek manakah menyerupai sfera?',answers:['bola','buku','pintu'],correct:'bola',success:'Betul! Bola menyerupai sfera.'},
      {prompt:'Objek manakah menyerupai kubus?',answers:['dadu','pinggan','pensel'],correct:'dadu',success:'Betul! Dadu menyerupai kubus.'},
      {prompt:'Data buah: Epal 4, Oren 2, Pisang 3. Buah paling banyak ialah…',answers:['Epal','Oren','Pisang'],correct:'Epal',success:'Betul! Epal paling banyak.'},
      {prompt:'Data buku: Ali 2, Siti 5. Siapa mempunyai lebih banyak buku?',answers:['Ali','Siti','Sama'],correct:'Siti',success:'Betul! Siti mempunyai lebih banyak buku.'},
      {prompt:'Ada 3 bulatan dan 1 segi tiga. Bentuk paling banyak ialah…',answers:['bulatan','segi tiga','sama'],correct:'bulatan',success:'Betul! Bulatan paling banyak.'},
      {prompt:'Segi empat tepat mempunyai berapa sisi?',answers:['3','4','5'],correct:'4',success:'Betul! Segi empat tepat mempunyai 4 sisi.'},
      {prompt:'Antara berikut, yang manakah bentuk 3D?',answers:['kubus','segi tiga','bulatan'],correct:'kubus',success:'Betul! Kubus ialah bentuk tiga dimensi.'}
    ]
  }
};

const curriculum={
  read:{
    title:'📖 Membaca',
    levels:[
      {level:1,name:'Suku Kata Asas',unlockStars:0,questions:[
        {prompt:"BA + ?",answers:["JU", "KU", "TU"],correct:"JU",success:"BA + JU = BAJU 🎉"},
        {prompt:"BU + ?",answers:["KU", "KA", "KI"],correct:"KU",success:"BU + KU = BUKU 📚"},
        {prompt:"BO + ?",answers:["LA", "LI", "LU"],correct:"LA",success:"BO + LA = BOLA ⚽"},
        {prompt:"MA + ?",answers:["TA", "TI", "TU"],correct:"TA",success:"MA + TA = MATA 👀"},
        {prompt:"SU + ?",answers:["SU", "SA", "SI"],correct:"SU",success:"SU + SU = SUSU 🥛"},
        {prompt:"BA + ?",answers:["TU", "TI", "TA"],correct:"TU",success:"BA + TU = BATU 🪨"},
        {prompt:"BI + ?",answers:["RU", "RA", "RI"],correct:"RU",success:"BI + RU = BIRU 🔵"},
        {prompt:"SA + ?",answers:["PU", "PI", "PA"],correct:"PU",success:"SA + PU = SAPU 🧹"},
        {prompt:"ME + ?",answers:["JA", "JI", "JU"],correct:"JA",success:"ME + JA = MEJA"},
        {prompt:"BO + ?",answers:["NE", "NA", "NI"],correct:"NE",success:"BO + NE = BONEKA 🧸"},
        {prompt:"GI + ?",answers:["GI", "GA", "GU"],correct:"GI",success:"GI + GI = GIGI 😁"},
        {prompt:"I + ?",answers:["BU", "BA", "BI"],correct:"BU",success:"I + BU = IBU ❤️"}]},
      {level:2,name:'Bina Perkataan',unlockStars:8,questions:[
        {prompt:"KU + ?",answers:["DA", "DI", "DU"],correct:"DA",success:"KU + DA = KUDA 🐴"},
        {prompt:"RO + ?",answers:["TI", "TA", "TU"],correct:"TI",success:"RO + TI = ROTI 🍞"},
        {prompt:"NA + ?",answers:["SI", "SA", "SU"],correct:"SI",success:"NA + SI = NASI 🍚"},
        {prompt:"TO + ?",answers:["PI", "PA", "PU"],correct:"PI",success:"TO + PI = TOPI 🧢"},
        {prompt:"KA + ?",answers:["KI", "KU", "KO"],correct:"KI",success:"KA + KI = KAKI 🦶"},
        {prompt:"BA + ?",answers:["JU", "JI", "JO"],correct:"JU",success:"BA + JU = BAJU 👕"},
        {prompt:"BO + ?",answers:["LA", "LI", "LU"],correct:"LA",success:"BO + LA = BOLA ⚽"},
        {prompt:"ME + ?",answers:["JA", "JI", "JU"],correct:"JA",success:"ME + JA = MEJA"},
        {prompt:"SA + ?",answers:["YA", "YU", "YO"],correct:"YA",success:"SA + YA = SAYA"},
        {prompt:"BU + ?",answers:["KU", "KO", "KA"],correct:"KU",success:"BU + KU = BUKU 📚"},
        {prompt:"SU + ?",answers:["SU", "SI", "SA"],correct:"SU",success:"SU + SU = SUSU 🥛"},
        {prompt:"MA + ?",answers:["TA", "TI", "TU"],correct:"TA",success:"MA + TA = MATA 👀"}]},
      {level:3,name:'Perkataan Lebih Panjang',unlockStars:18,questions:[
        {prompt:"KE + RE + ?",answers:["TA", "TI", "TU"],correct:"TA",success:"KE + RE + TA = KERETA 🚗"},
        {prompt:"SE + KO + ?",answers:["LAH", "LIH", "LUH"],correct:"LAH",success:"SE + KO + LAH = SEKOLAH 🏫"},
        {prompt:"KE + PA + ?",answers:["LA", "LI", "LU"],correct:"LA",success:"KE + PA + LA = KEPALA 🙂"},
        {prompt:"BI + NA + ?",answers:["TANG", "TING", "TUNG"],correct:"TANG",success:"BI + NA + TANG = BINATANG 🐯"},
        {prompt:"KE + LU + ?",answers:["AR", "IR", "UR"],correct:"AR",success:"KE + LU + AR = KELUAR"},
        {prompt:"PE + LA + ?",answers:["JAR", "JIR", "JUR"],correct:"JAR",success:"PE + LA + JAR = PELAJAR"},
        {prompt:"MA + KA + ?",answers:["NAN", "NIN", "NUN"],correct:"NAN",success:"MA + KA + NAN = MAKANAN 🍽️"},
        {prompt:"MI + NU + ?",answers:["MAN", "MIN", "MUN"],correct:"MAN",success:"MI + NU + MAN = MINUMAN 🥤"},
        {prompt:"HA + RI + ?",answers:["MAU", "MIU", "MUU"],correct:"MAU",success:"HA + RI + MAU = HARIMAU 🐯"},
        {prompt:"BA + SI + ?",answers:["KAL", "KIL", "KUL"],correct:"KAL",success:"BA + SI + KAL = BASIKAL 🚲"},
        {prompt:"TE + LE + ?",answers:["FON", "FIN", "FUN"],correct:"FON",success:"TE + LE + FON = TELEFON 📱"},
        {prompt:"CE + RE + ?",answers:["KA", "KI", "KU"],correct:"KA",success:"CE + RE + KA = CEREKA 📖"}]}
    ]},
  write:{
    title:'✏️ Menulis',
    levels:[
      {level:1,name:'Pilih Ejaan',unlockStars:0,questions:[
        {prompt:"🐱",answers:["KUCIN", "KUCING", "KUSING"],correct:"KUCING",success:"Ejaan betul ialah KUCING 🐱"},
        {prompt:"🐟",answers:["IKAN", "EKAN", "IKON"],correct:"IKAN",success:"Ejaan betul ialah IKAN 🐟"},
        {prompt:"🌸",answers:["BUNGA", "BONGA", "BUNGO"],correct:"BUNGA",success:"Ejaan betul ialah BUNGA 🌸"},
        {prompt:"👁️",answers:["MATA", "META", "MITA"],correct:"MATA",success:"Ejaan betul ialah MATA 👁️"},
        {prompt:"📚",answers:["BUKU", "BOKU", "BUKO"],correct:"BUKU",success:"Ejaan betul ialah BUKU 📚"},
        {prompt:"⚽",answers:["BOLA", "BULA", "BELA"],correct:"BOLA",success:"Ejaan betul ialah BOLA ⚽"},
        {prompt:"🍚",answers:["NASI", "NASE", "NESI"],correct:"NASI",success:"Ejaan betul ialah NASI 🍚"},
        {prompt:"🧢",answers:["TOPI", "TUPI", "TOPE"],correct:"TOPI",success:"Ejaan betul ialah TOPI 🧢"},
        {prompt:"🐴",answers:["KUDA", "KODA", "KUDE"],correct:"KUDA",success:"Ejaan betul ialah KUDA 🐴"},
        {prompt:"🥛",answers:["SUSU", "SOSU", "SUSO"],correct:"SUSU",success:"Ejaan betul ialah SUSU 🥛"},
        {prompt:"🦶",answers:["KAKI", "KEKI", "KAKU"],correct:"KAKI",success:"Ejaan betul ialah KAKI 🦶"},
        {prompt:"👕",answers:["BAJU", "BEJU", "BAJO"],correct:"BAJU",success:"Ejaan betul ialah BAJU 👕"}]},
      {level:2,name:'Lengkapkan Perkataan',unlockStars:8,questions:[
        {prompt:"B _ L A",answers:["O", "U", "A"],correct:"O",success:"B + O + LA = BOLA ⚽"},
        {prompt:"R _ T I",answers:["O", "A", "U"],correct:"O",success:"R + O + TI = ROTI 🍞"},
        {prompt:"K _ D A",answers:["U", "O", "A"],correct:"U",success:"K + U + DA = KUDA 🐴"},
        {prompt:"N _ S I",answers:["A", "E", "O"],correct:"A",success:"N + A + SI = NASI 🍚"},
        {prompt:"T _ P I",answers:["O", "U", "A"],correct:"O",success:"T + O + PI = TOPI 🧢"},
        {prompt:"B _ K U",answers:["U", "O", "A"],correct:"U",success:"B + U + KU = BUKU 📚"},
        {prompt:"M _ T A",answers:["A", "I", "U"],correct:"A",success:"M + A + TA = MATA 👀"},
        {prompt:"S _ S U",answers:["U", "A", "I"],correct:"U",success:"S + U + SU = SUSU 🥛"},
        {prompt:"B _ J U",answers:["A", "I", "O"],correct:"A",success:"B + A + JU = BAJU 👕"},
        {prompt:"M _ J A",answers:["E", "A", "I"],correct:"E",success:"M + E + JA = MEJA"},
        {prompt:"K _ K I",answers:["A", "E", "U"],correct:"A",success:"K + A + KI = KAKI 🦶"},
        {prompt:"S _ P U",answers:["A", "I", "U"],correct:"A",success:"S + A + PU = SAPU 🧹"}]},
      {level:3,name:'Ejaan Lebih Panjang',unlockStars:18,questions:[
        {prompt:"🚗",answers:["KERETA", "KARETA", "KERITA"],correct:"KERETA",success:"Ejaan betul ialah KERETA 🚗"},
        {prompt:"🏫",answers:["SEKOLAH", "SIKOLAH", "SEKULAH"],correct:"SEKOLAH",success:"Ejaan betul ialah SEKOLAH 🏫"},
        {prompt:"🦋",answers:["RAMA-RAMA", "REMA-REMA", "RAMA-ROMA"],correct:"RAMA-RAMA",success:"Ejaan betul ialah RAMA-RAMA 🦋"},
        {prompt:"🚲",answers:["BASIKAL", "BESIKAL", "BASIKEL"],correct:"BASIKAL",success:"Ejaan betul ialah BASIKAL 🚲"},
        {prompt:"🐯",answers:["HARIMAU", "HERIMAU", "HARIMOU"],correct:"HARIMAU",success:"Ejaan betul ialah HARIMAU 🐯"},
        {prompt:"📱",answers:["TELEFON", "TALIFON", "TELEPON"],correct:"TELEFON",success:"Ejaan betul ialah TELEFON 📱"},
        {prompt:"🍽️",answers:["MAKANAN", "MAKENAN", "MAKANEN"],correct:"MAKANAN",success:"Ejaan betul ialah MAKANAN 🍽️"},
        {prompt:"🥤",answers:["MINUMAN", "MENUMAN", "MINOMAN"],correct:"MINUMAN",success:"Ejaan betul ialah MINUMAN 🥤"},
        {prompt:"👨\u200d🎓",answers:["PELAJAR", "PELEJAR", "PELAJER"],correct:"PELAJAR",success:"Ejaan betul ialah PELAJAR"},
        {prompt:"🙂",answers:["KEPALA", "KAPALA", "KEPELA"],correct:"KEPALA",success:"Ejaan betul ialah KEPALA 🙂"},
        {prompt:"🐘",answers:["GAJAH", "GEJAH", "GAJEH"],correct:"GAJAH",success:"Ejaan betul ialah GAJAH 🐘"},
        {prompt:"🌴",answers:["KELAPA", "KALAPA", "KELEPA"],correct:"KELAPA",success:"Ejaan betul ialah KELAPA 🌴"}]}
    ]},
  count:{
    title:'🧮 Mengira',
    levels:[
      {level:1,name:'Nombor 1–5',unlockStars:0,questions:[
        {prompt:"🍎 🍎 🍎",answers:["2", "3", "4"],correct:"3",success:"Tepat! Ada 3 biji epal 🍎"},
        {prompt:"⭐ ⭐",answers:["1", "2", "3"],correct:"2",success:"Tepat! Ada 2 bintang ⭐"},
        {prompt:"🐟 🐟 🐟 🐟",answers:["3", "4", "5"],correct:"4",success:"Tepat! Ada 4 ekor ikan 🐟"},
        {prompt:"🌼",answers:["1", "2", "3"],correct:"1",success:"Tepat! Ada 1 bunga 🌼"},
        {prompt:"⚽ ⚽ ⚽ ⚽ ⚽",answers:["4", "5", "6"],correct:"5",success:"Tepat! Ada 5 bola ⚽"},
        {prompt:"🍌 🍌",answers:["1", "2", "3"],correct:"2",success:"Tepat! Ada 2 pisang 🍌"},
        {prompt:"🐱 🐱 🐱",answers:["2", "3", "4"],correct:"3",success:"Tepat! Ada 3 kucing 🐱"},
        {prompt:"🚗 🚗 🚗 🚗",answers:["3", "4", "5"],correct:"4",success:"Tepat! Ada 4 kereta 🚗"},
        {prompt:"🧸 🧸 🧸 🧸 🧸",answers:["4", "5", "6"],correct:"5",success:"Tepat! Ada 5 patung 🧸"},
        {prompt:"🥕",answers:["1", "2", "3"],correct:"1",success:"Tepat! Ada 1 lobak 🥕"},
        {prompt:"🍊 🍊 🍊",answers:["2", "3", "4"],correct:"3",success:"Tepat! Ada 3 oren 🍊"},
        {prompt:"🐥 🐥",answers:["1", "2", "3"],correct:"2",success:"Tepat! Ada 2 anak ayam 🐥"}]},
      {level:2,name:'Nombor 6–10',unlockStars:8,questions:[
        {prompt:"🍓 🍓 🍓 🍓 🍓 🍓",answers:["5", "6", "7"],correct:"6",success:"Bagus! Ada 6 strawberi 🍓"},
        {prompt:"🐥 🐥 🐥 🐥 🐥 🐥 🐥",answers:["6", "7", "8"],correct:"7",success:"Bagus! Ada 7 anak ayam 🐥"},
        {prompt:"🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟",answers:["7", "8", "9"],correct:"8",success:"Bagus! Ada 8 bintang 🌟"},
        {prompt:"🍊 🍊 🍊 🍊 🍊 🍊 🍊 🍊 🍊",answers:["8", "9", "10"],correct:"9",success:"Bagus! Ada 9 oren 🍊"},
        {prompt:"🔵 🔵 🔵 🔵 🔵 🔵 🔵 🔵 🔵 🔵",answers:["8", "9", "10"],correct:"10",success:"Bagus! Ada 10 bulatan 🔵"},
        {prompt:"6 + 1 = ?",answers:["6", "7", "8"],correct:"7",success:"Betul! 6 + 1 = 7"},
        {prompt:"8 - 1 = ?",answers:["6", "7", "8"],correct:"7",success:"Betul! 8 - 1 = 7"},
        {prompt:"7 + 2 = ?",answers:["8", "9", "10"],correct:"9",success:"Betul! 7 + 2 = 9"},
        {prompt:"10 - 2 = ?",answers:["7", "8", "9"],correct:"8",success:"Betul! 10 - 2 = 8"},
        {prompt:"5 + 3 = ?",answers:["7", "8", "9"],correct:"8",success:"Betul! 5 + 3 = 8"},
        {prompt:"9 - 3 = ?",answers:["5", "6", "7"],correct:"6",success:"Betul! 9 - 3 = 6"},
        {prompt:"6 + 4 = ?",answers:["9", "10", "11"],correct:"10",success:"Betul! 6 + 4 = 10"}]},
      {level:3,name:'Tambah Mudah',unlockStars:18,questions:[
        {prompt:"2 + 1 = ?",answers:["2", "3", "4"],correct:"3",success:"Betul! 2 + 1 = 3 🎉"},
        {prompt:"3 + 2 = ?",answers:["4", "5", "6"],correct:"5",success:"Betul! 3 + 2 = 5 🎉"},
        {prompt:"4 + 2 = ?",answers:["5", "6", "7"],correct:"6",success:"Betul! 4 + 2 = 6 🎉"},
        {prompt:"5 + 3 = ?",answers:["7", "8", "9"],correct:"8",success:"Betul! 5 + 3 = 8 🎉"},
        {prompt:"6 + 4 = ?",answers:["9", "10", "11"],correct:"10",success:"Betul! 6 + 4 = 10 🎉"},
        {prompt:"10 + 5 = ?",answers:["14", "15", "16"],correct:"15",success:"Betul! 10 + 5 = 15 🎉"},
        {prompt:"12 - 4 = ?",answers:["7", "8", "9"],correct:"8",success:"Betul! 12 - 4 = 8 🎉"},
        {prompt:"7 + 8 = ?",answers:["14", "15", "16"],correct:"15",success:"Betul! 7 + 8 = 15 🎉"},
        {prompt:"15 - 6 = ?",answers:["8", "9", "10"],correct:"9",success:"Betul! 15 - 6 = 9 🎉"},
        {prompt:"9 + 9 = ?",answers:["17", "18", "19"],correct:"18",success:"Betul! 9 + 9 = 18 🎉"},
        {prompt:"20 - 5 = ?",answers:["14", "15", "16"],correct:"15",success:"Betul! 20 - 5 = 15 🎉"},
        {prompt:"11 + 6 = ?",answers:["16", "17", "18"],correct:"17",success:"Betul! 11 + 6 = 17 🎉"}]}
    ]}
};

let preferredMalayVoice=null;
function chooseMalayVoice(){
  const voices=speechSynthesis.getVoices();
  if(!voices.length) return null;
  const score=v=>{
    const lang=(v.lang||'').toLowerCase(), name=(v.name||'').toLowerCase();
    let s=0;
    if(lang==='ms-my') s+=100;
    else if(lang.startsWith('ms')) s+=70;
    else if(lang==='id-id') s+=20;
    if(name.includes('malaysia')||name.includes('malay')) s+=25;
    if(v.localService) s+=3;
    return s;
  };
  return [...voices].sort((a,b)=>score(b)-score(a))[0]||null;
}
function refreshMalayVoice(){ preferredMalayVoice=chooseMalayVoice(); }
if('speechSynthesis' in window){
  refreshMalayVoice();
  speechSynthesis.addEventListener?.('voiceschanged',refreshMalayVoice);
}
function speakBM(text){
  if(!('speechSynthesis' in window)) return toast('Audio tidak disokong oleh browser ini.');
  const clean=String(text||'').replace(/[^\p{L}\p{N}\s+\-=?]/gu,' ').trim();
  if(!clean)return;
  speechSynthesis.cancel();
  if(!preferredMalayVoice) refreshMalayVoice();
  const u=new SpeechSynthesisUtterance(clean);
  if(preferredMalayVoice){u.voice=preferredMalayVoice;u.lang=preferredMalayVoice.lang||'ms-MY';}
  else u.lang='ms-MY';
  u.rate=.65; u.pitch=1.0; u.volume=1.0;
  speechSynthesis.speak(u);
}
function celebrate(){
  const layer=document.createElement('div'); layer.className='celebration';
  layer.innerHTML=Array.from({length:18},(_,i)=>`<i style="--i:${i}">${['⭐','🎉','✨','🌟'][i%4]}</i>`).join('');
  document.body.appendChild(layer); setTimeout(()=>layer.remove(),1300);
}
function awardBadge(moduleName,level,stars){
  if(!activeChild||stars<8)return null;
  const key=`badge_${activeChild.id}_${moduleName}_${level}`;
  if(localStorage.getItem(key))return null;
  localStorage.setItem(key,'1');
  return stars>=13?'🏆 Juara 3M':stars>=10?'🥇 Bintang Hebat':'🏅 Berani Mencuba';
}

async function loadCmsQuestions(key,levelNo){
  if(!fb) return [];
  try{
    const snap=await fb.getDocs(fb.collection(fb.db,'questions'));
    return snap.docs.map(d=>({id:d.id,...d.data()}))
      .filter(q=>q.active!==false&&q.module===gameKeyToModule[key]&&Number(q.level)===Number(levelNo)&&Array.isArray(q.answers)&&q.answers.length>=2&&q.correct)
      .sort((a,b)=>Number(a.order||0)-Number(b.order||0));
  }catch(e){console.warn('CMS questions fallback:',e);return [];}
}

function bestLevelScores(progress,module){
  const best={};
  progress.filter(x=>x.module===module&&x.correct===true).forEach(x=>{
    const level=Number(x.level||0),stars=Number(x.stars||0);
    if(level) best[level]=Math.max(best[level]||0,stars);
  });
  return best;
}
const moduleStars=(progress,module)=>Object.values(bestLevelScores(progress,module)).reduce((n,x)=>n+Number(x||0),0);
function unlockedLevel(progress,key){
  const levels=curriculum[key].levels, best=bestLevelScores(progress,gameKeyToModule[key]);
  let unlocked=1;
  for(let i=1;i<levels.length;i++){
    const prev=levels[i-1];
    if((best[prev.level]||0)>=8) unlocked=levels[i].level;
    else break;
  }
  return unlocked;
}
function levelBest(progress,key,levelNo){return bestLevelScores(progress,gameKeyToModule[key])[levelNo]||0;}
function learningRank(stars){
  if(stars>=24)return {icon:'👑',name:'Juara 3M'};
  if(stars>=16)return {icon:'🏆',name:'Bintang Hebat'};
  if(stars>=8)return {icon:'🌟',name:'Pelajar Ceria'};
  return {icon:'🌱',name:'Mula Belajar'};
}
function showSubscriptionGate(profile,key){
  const sub=subscriptionState(profile),c=curriculum[key],expired=sub.expired;
  $('#gameContent').innerHTML=`<div class="subscription-gate"><div class="gate-icon">🔒</div><small>Akses Premium CilikGo</small>
  <h2>${expired?'Langganan telah tamat':'Langganan diperlukan'}</h2>
  <p>${expired?`Untuk teruskan ${c?.title||'modul 3M'}, perbaharui langganan RM15 untuk 1 bulan.`:`Akses penuh ${c?.title||'modul 3M'} tersedia dengan Pakej Permulaan RM69 untuk 4 bulan.`}</p>
  <div class="gate-plan"><span>${expired?'Renewal':'Pakej Permulaan'}</span><b>${expired?'RM15':'RM69'}</b><small>${expired?'1 bulan':'4 bulan'}</small></div>
  <div class="gate-actions"><button class="btn primary" disabled>${expired?'Renew RM15':'Langgan RM69'}</button><button class="btn ghost" id="gateBack">Kembali</button></div>
  <p class="gate-note">ToyyibPay masih KIV.</p></div>`;
  if(!$('#gameModal').open) $('#gameModal').showModal();
  $('#gateBack').onclick=()=>$('#gameModal').close();
}

function openLevelPicker(key,track=false){
  const c=curriculum[key];
  const render=async()=>{
    if(track){
      if(!fb?.auth.currentUser){openAuth('login');return;}
      const profile=currentProfile||await getProfile(fb.auth.currentUser);
      if(!subscriptionState(profile).active){showSubscriptionGate(profile,key);return;}
      if(!activeChild){toast('Pilih profil anak dahulu.');return;}
    }
    const progress=track&&activeChild&&currentProfile?await loadProgress(currentProfile.uid,activeChild.id):[];
    const stars=moduleStars(progress,gameKeyToModule[key]), max=track?unlockedLevel(progress,key):3,rank=learningRank(stars);
    $('#gameContent').innerHTML=`<div class="learning-picker"><h2>${c.title}</h2>${track&&activeChild?`<p class="game-child">${esc(activeChild.avatar||'🧒')} ${esc(activeChild.name)} · ${rank.icon} ${rank.name}</p>`:''}
      <div class="learning-summary"><div><small>Bintang terbaik</small><b>⭐ ${stars}/45</b></div><div><small>Level terbuka</small><b>${max}/3</b></div></div>
      <p>Pilih tahap pembelajaran:</p><div class="level-grid">${c.levels.map(l=>{const best=levelBest(progress,key,l.level),locked=l.level>max;return `<button class="level-card ${best>=8?'level-passed':''}" data-level="${l.level}" ${locked?'disabled':''}><b>Level ${l.level}</b><span>${esc(l.name)}</span><small>${locked?'🔒 Selesaikan level sebelumnya':best?`Rekod terbaik ⭐ ${best}/15`:'Terbuka · Belum dimainkan'}</small>${best>=8?'<em>✓ Lulus</em>':''}</button>`}).join('')}</div>
      ${track?`<p class="level-total">Selesaikan setiap level dengan sekurang-kurangnya ⭐ 8/15 untuk membuka level seterusnya.</p>`:''}</div>`;
    if(!$('#gameModal').open) $('#gameModal').showModal();
    document.querySelectorAll('.level-card:not(:disabled)').forEach(b=>b.onclick=()=>startLevel(key,Number(b.dataset.level),track));
  }; render();
}
async function startLevel(key,levelNo,track=false){
  if(track){
    if(!fb?.auth.currentUser){openAuth('login');return;}
    const profile=currentProfile||await getProfile(fb.auth.currentUser);
    if(!subscriptionState(profile).active){showSubscriptionGate(profile,key);return;}
    if(!activeChild){toast('Pilih profil anak dahulu.');return;}
    const progress=await loadProgress(profile.uid,activeChild.id);
    if(levelNo>unlockedLevel(progress,key)){toast('Level ini belum terbuka. Selesaikan level sebelumnya dahulu.');openLevelPicker(key,true);return;}
  }
  const c=curriculum[key], level=c.levels.find(x=>x.level===levelNo);
  const cmsQuestions=await loadCmsQuestions(key,levelNo);
  const sourceQuestions=cmsQuestions.length?cmsQuestions:level.questions;
  const questions=[...sourceQuestions].sort(()=>Math.random()-.5).slice(0,5);
  let index=0,scoreStars=0,totalAttempts=0;

  const renderQuestion=()=>{
    const q=questions[index]; let attempts=0,completed=false;
    const pct=Math.round((index/questions.length)*100);
    $('#gameContent').innerHTML=`<h2>${c.title} · Level ${levelNo}</h2>
      ${track&&activeChild?`<p class="game-child">${esc(activeChild.avatar||'🧒')} ${esc(activeChild.name)} · ${esc(level.name)}</p>`:''}
      <div class="learning-hud"><div><b>Soalan ${index+1}/${questions.length}</b><small>${pct}% selesai</small></div><div class="hud-stars">⭐ ${scoreStars}</div></div>
      <div class="level-progress"><span style="width:${pct}%"></span></div>
      <div class="audio-row"><button class="audio-btn" id="speakQuestion">🔊 Dengar</button><span>Tak apa kalau tersalah. Cuba lagi 💜</span></div>
      <div class="game-prompt">${esc(q.prompt)}</div>
      <div class="answers">${q.answers.map(a=>`<button class="answer">${esc(a)}</button>`).join('')}</div>
      <div id="gameMsg"></div>`;
    $('#speakQuestion').onclick=()=>speakBM(q.prompt);
    document.querySelectorAll('.answer').forEach(x=>x.onclick=()=>{
      if(completed)return; attempts++; totalAttempts++;
      if(x.textContent!==q.correct){
        x.classList.add('wrong'); setTimeout(()=>x.classList.remove('wrong'),450);
        $('#gameMsg').innerHTML=`<div class="try-again">💪 Belum tepat. Cuba lagi! <small>Percubaan ${attempts}</small></div>`;
        speakBM('Cuba lagi'); return;
      }
      completed=true; const stars=attempts===1?3:attempts===2?2:1; scoreStars+=stars;
      x.classList.add('correct'); document.querySelectorAll('.answer').forEach(a=>a.disabled=true);
      $('#gameMsg').innerHTML=`<div class="correct-feedback"><b>🎉 Hebat!</b><span>${esc(q.success)}</span><strong>${'⭐'.repeat(stars)}</strong></div>`;
      celebrate(); speakBM(q.success||'Hebat');
      setTimeout(()=>{index++;index<questions.length?renderQuestion():finishLevel();},1200);
    });
  };

  const finishLevel=async()=>{
    const passed=scoreStars>=8,maxStars=questions.length*3,pct=Math.round(scoreStars/maxStars*100);
    const badge=awardBadge(gameKeyToModule[key],levelNo,scoreStars);
    $('#gameContent').innerHTML=`<div class="result-card"><div class="result-emoji">${pct>=85?'🏆':pct>=65?'🌟':'💪'}</div>
      <h2>${pct>=85?'Cemerlang!':pct>=65?'Syabas!':'Bagus kerana mencuba!'}</h2>
      <p>${esc(activeChild?.name||'Adik')} sudah tamat ${esc(level.name)}.</p>
      <div class="result-stars">⭐ ${scoreStars} / ${maxStars}</div>
      <div class="result-grid"><div><b>${scoreStars}</b><small>Bintang</small></div><div><b>${totalAttempts}</b><small>Percubaan</small></div><div><b>${pct}%</b><small>Pencapaian</small></div></div>
      ${badge?`<div class="badge-earned"><span>${badge.split(' ')[0]}</span><b>${badge.substring(badge.indexOf(' ')+1)}</b><small>Badge baharu!</small></div>`:''}
      <div class="result-actions"><button class="btn primary" id="playAgain">${passed?'Main Lagi':'Cuba Lagi'}</button>${passed&&levelNo<3?'<button class="btn success" id="nextLevel">Level Seterusnya →</button>':''}<button class="btn ghost" id="backLevels">Pilih Level</button></div>
      <p class="result-tip">${passed?'⭐ Level seterusnya kini boleh dibuka. Rekod terbaik digunakan untuk kemajuan.':'Dapatkan sekurang-kurangnya ⭐ 8 untuk membuka level seterusnya.'}</p></div>`;
    celebrate(); speakBM(passed?'Syabas, hebat!':'Bagus kerana mencuba');
    if(track&&activeChild&&fb?.auth.currentUser){
      try{
        await fb.addDoc(fb.collection(fb.db,'progress'),{ownerUid:fb.auth.currentUser.uid,childId:activeChild.id,module:gameKeyToModule[key],activity:key,level:levelNo,questions:questions.length,correct:true,attempts:totalAttempts,stars:scoreStars,passed,createdAt:fb.serverTimestamp()});
        toast(`⭐ ${scoreStars} bintang ${activeChild.name} direkodkan!`);
      }catch(e){console.error(e);toast('Level selesai, tetapi rekod kemajuan gagal disimpan.');}
    }
    $('#playAgain').onclick=()=>startLevel(key,levelNo,track);
    if($('#nextLevel')) $('#nextLevel').onclick=()=>startLevel(key,levelNo+1,track);
    $('#backLevels').onclick=()=>openLevelPicker(key,track);
  };
  renderQuestion();
}
function openGame(key,track=false){ openLevelPicker(key,track); }
document.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>openGame(b.dataset.game,false));


document.addEventListener('click',e=>{
  const a=e.target.closest?.('.parent-subscription-nav,#parentSubscriptionLink');
  if(a && currentProfile?.role==='user'){e.preventDefault();renderParentSubscriptionView(currentProfile);}
});


document.addEventListener('click',e=>{
  const a=e.target.closest?.('.parent-learning-nav');
  if(a && currentProfile?.role==='user'){
    e.preventDefault();
    renderParentLearningHub(currentProfile);
  }
});
