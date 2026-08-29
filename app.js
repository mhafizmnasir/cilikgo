import { firebaseConfig, USE_FIREBASE, FUNCTIONS_BASE_URL } from './firebase.js';

let fb = null, firebaseInitError = null, currentProfile = null, activeChild = null, userChildren = [];
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


/* ===== CilikGo cheerful background music (Web Audio, no external file) ===== */
let cgAudioCtx=null,cgMusicTimer=null,cgMusicOn=localStorage.getItem('cilikgo_music')==='on';
const cgMusicNotes=[261.63,329.63,392.00,523.25,392.00,329.63,293.66,349.23,440.00,523.25,440.00,349.23];
function cgTone(freq,start,duration=.28,gain=.018){
  if(!cgAudioCtx)return;
  const osc=cgAudioCtx.createOscillator(),g=cgAudioCtx.createGain();
  osc.type='triangle'; osc.frequency.value=freq;
  g.gain.setValueAtTime(0,start);
  g.gain.linearRampToValueAtTime(gain,start+.025);
  g.gain.exponentialRampToValueAtTime(.0001,start+duration);
  osc.connect(g).connect(cgAudioCtx.destination);
  osc.start(start);osc.stop(start+duration+.04);
}
function scheduleCgMusic(){
  if(!cgMusicOn||!cgAudioCtx)return;
  const now=cgAudioCtx.currentTime+.05;
  cgMusicNotes.forEach((n,i)=>{
    cgTone(n,now+i*.34,.24,i%4===0?.021:.015);
    if(i%4===0) cgTone(n/2,now+i*.34,.46,.008);
  });
  clearTimeout(cgMusicTimer);
  cgMusicTimer=setTimeout(scheduleCgMusic,cgMusicNotes.length*340+280);
}
async function startCgMusic(){
  try{
    cgAudioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
    await cgAudioCtx.resume();
    if(!cgMusicTimer)scheduleCgMusic();
  }catch(e){console.warn('Background music unavailable',e);}
}
function stopCgMusic(){
  clearTimeout(cgMusicTimer);cgMusicTimer=null;
  if(cgAudioCtx?.state==='running') cgAudioCtx.suspend().catch(()=>{});
}
function updateMusicButton(){
  const b=$('#musicToggle'); if(!b)return;
  b.classList.toggle('playing',cgMusicOn);
  b.setAttribute('aria-label',cgMusicOn?'Matikan muzik latar':'Hidupkan muzik latar');
  b.querySelector('.music-label').textContent=cgMusicOn?'Muzik On':'Muzik';
}
$('#musicToggle')?.addEventListener('click',async()=>{
  cgMusicOn=!cgMusicOn;
  localStorage.setItem('cilikgo_music',cgMusicOn?'on':'off');
  updateMusicButton();
  if(cgMusicOn) await startCgMusic(); else stopCgMusic();
});
updateMusicButton();

/* Browsers require a user gesture before sound can start. */
document.addEventListener('pointerdown',()=>{
  if(cgMusicOn&&(!cgAudioCtx||cgAudioCtx.state!=='running')) startCgMusic();
},{once:true});

function animateIn(scope=document){
  scope.querySelectorAll('.year-portal-card,.student-subject-card,.subject-topic-card,.stat,.quick-stat,.parent-subject-mini,.content-subject-card').forEach((el,i)=>{
    el.style.setProperty('--delay',`${Math.min(i,12)*45}ms`);
    el.classList.add('cg-pop-in');
  });
}

document.querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>showAuthPage(b.dataset.auth||'login'));

const mobileMenuBtn=$('#mobileMenuBtn'), mobileNavDrawer=$('#mobileNavDrawer'), mobileNavBackdrop=$('#mobileNavBackdrop');
function setMobileNav(open){
  if(!mobileNavDrawer)return;
  document.body.classList.toggle('mobile-nav-open',!!open);
  mobileNavDrawer.classList.toggle('open',!!open);
  mobileNavBackdrop?.classList.toggle('show',!!open);
  mobileNavDrawer.setAttribute('aria-hidden',open?'false':'true');
  mobileMenuBtn?.setAttribute('aria-expanded',open?'true':'false');
}
mobileMenuBtn?.addEventListener('click',()=>setMobileNav(!mobileNavDrawer.classList.contains('open')));
$('#mobileNavClose')?.addEventListener('click',()=>setMobileNav(false));
mobileNavBackdrop?.addEventListener('click',()=>setMobileNav(false));
document.querySelectorAll('.mobile-nav-links a,.mobile-nav-actions [data-auth]').forEach(el=>el.addEventListener('click',()=>setMobileNav(false)));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){setMobileNav(false);setAppMobileMenu(false);setRoleNav(false);}});
window.addEventListener('resize',()=>{if(window.innerWidth>1024){setMobileNav(false);setRoleNav(false);}if(window.innerWidth>760)setAppMobileMenu(false);});

function setRoleNav(open){
  const drawer=document.querySelector('#dashboard .role-drawer');
  const btn=$('#roleMenuBtn'),backdrop=$('#roleNavBackdrop');
  const shouldOpen=!!open&&!!drawer;

  // Sentiasa reset overlay/body walaupun drawer lama telah diganti oleh render baharu.
  document.body.classList.toggle('role-nav-open',shouldOpen);
  backdrop?.classList.toggle('show',shouldOpen);
  btn?.setAttribute('aria-expanded',shouldOpen?'true':'false');

  if(drawer) drawer.classList.toggle('role-drawer-open',shouldOpen);
}
$('#roleMenuBtn')?.addEventListener('click',e=>{
  e.stopPropagation();
  setAppMobileMenu(false);
  setRoleNav(!document.body.classList.contains('role-nav-open'));
});
$('#roleNavBackdrop')?.addEventListener('click',()=>setRoleNav(false));
document.addEventListener('click',e=>{
  if(e.target.closest('.role-nav-close')){ setRoleNav(false); return; }
  if(e.target.closest('#dashboard .role-drawer a')) setRoleNav(false);
});

function setAppMobileMenu(open){
  const menu=$('#appMobileMenu'),btn=$('#appMenuBtn');
  if(!menu)return;
  menu.classList.toggle('open',!!open);
  btn?.setAttribute('aria-expanded',open?'true':'false');
}
$('#appMenuBtn')?.addEventListener('click',e=>{e.stopPropagation();setAppMobileMenu(!$('#appMobileMenu')?.classList.contains('open'));});
document.addEventListener('click',e=>{
  const menu=$('#appMobileMenu'),btn=$('#appMenuBtn');
  if(menu?.classList.contains('open')&&!menu.contains(e.target)&&!btn?.contains(e.target))setAppMobileMenu(false);
});


function setAuthRole(role='user'){
  const value=role==='agent'?'agent':'user';
  const input=$('#regRole');
  if(input) input.value=value;
  document.querySelectorAll('.role-choice').forEach(b=>b.classList.toggle('active',b.dataset.roleChoice===value));
}
function showAuthPage(mode='login',role='user'){
  setMobileNav(false); setAppMobileMenu(false);
  document.body.classList.remove('app-mode','student-mode');
  document.body.classList.add('auth-mode');
  $('#authScreen')?.classList.remove('hidden');
  $('#authLoginPanel')?.classList.toggle('hidden',mode!=='login');
  $('#authRegisterPanel')?.classList.toggle('hidden',mode!=='register');
  if(mode==='register') setAuthRole(role);
  const next=mode==='register'?'register':'login';
  if(location.hash!==`#${next}`) history.pushState(null,'',`#${next}`);
  setTimeout(()=>$(mode==='login'?'#loginEmail':'#regName')?.focus(),40);
}
function openAuth(mode='login'){ showAuthPage(mode); }
function showPublicPage(){
  document.body.classList.remove('auth-mode','app-mode','student-mode');
  $('#authScreen')?.classList.add('hidden');
}
function showDashboardPage(){
  setMobileNav(false); setAppMobileMenu(false); setRoleNav(false);
  document.body.classList.remove('auth-mode','student-mode');
  document.body.classList.add('app-mode');
  $('#authScreen')?.classList.add('hidden');
  if(location.hash!=='#dashboard') history.pushState(null,'','#dashboard');
}
function showStudentPage(){
  setRoleNav(false); setAppMobileMenu(false);
  document.body.classList.remove('auth-mode');
  document.body.classList.add('app-mode','student-mode');
  $('#authScreen')?.classList.add('hidden');
  if(location.hash!=='#student') history.pushState(null,'','#student');
}

$('#showRegisterBtn').onclick=()=>showAuthPage('register','user');
$('#showLoginBtn').onclick=()=>showAuthPage('login');
$('#authBackHome').onclick=()=>{history.pushState(null,'','#home');showPublicPage();window.scrollTo({top:0,behavior:'smooth'});};
document.querySelectorAll('.role-choice').forEach(b=>b.onclick=()=>setAuthRole(b.dataset.roleChoice));

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
$('#agentSignupBtn').onclick=()=>showAuthPage('register','agent');

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
    toast('Akaun berjaya didaftarkan.');
  }catch(e){ console.error(e); toast(friendlyError(e)); }
};

$('#loginBtn').onclick=async()=>{
  const email=$('#loginEmail').value.trim(), password=$('#loginPassword').value;
  if(!email||!password) return toast('Masukkan e-mel dan kata laluan.');
  if(!fb){ console.error(firebaseInitError); return toast('Firebase tidak dapat disambungkan.'); }
  try{ await fb.signInWithEmailAndPassword(fb.auth,email,password); toast('Log masuk berjaya.'); }
  catch(e){ console.error(e); toast('Log masuk gagal: '+friendlyError(e)); }
};

$('#forgotBtn').onclick=async()=>{
  const email=$('#loginEmail').value.trim(); if(!email) return toast('Masukkan e-mel terlebih dahulu.');
  try{ await fb.sendPasswordResetEmail(fb.auth,email); toast('E-mel reset kata laluan telah dihantar.'); }catch(e){ toast(friendlyError(e)); }
};
async function logoutCilikGo(){
  if(fb?.auth) await fb.signOut(fb.auth);
  toast('Anda telah log keluar.');
  history.pushState(null,'','#home');
  showPublicPage();
  window.scrollTo({top:0,behavior:'smooth'});
}
$('#logoutBtn').onclick=logoutCilikGo;
$('#mobileLogoutBtn').onclick=logoutCilikGo;
$('#appLogoutBtn').onclick=logoutCilikGo;
$('#appMobileLogoutBtn').onclick=logoutCilikGo;
$('#dashboardBtn').onclick=async()=>{ if(!currentProfile)return showAuthPage('login'); setMobileNav(false); showDashboardPage(); await renderPortal(currentProfile); };
$('#mobileDashboardBtn').onclick=async()=>{ if(!currentProfile)return showAuthPage('login'); setMobileNav(false); showDashboardPage(); await renderPortal(currentProfile); };
const goPublicHome=()=>{ setAppMobileMenu(false); history.pushState(null,'','#home'); showPublicPage(); window.scrollTo({top:0,behavior:'smooth'}); };
$('#appHomeBtn').onclick=goPublicHome;
$('#appMobileHomeBtn').onclick=goPublicHome;

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
    ?`Akses penuh latihan CilikGo sedang aktif. Anda mempunyai ${days} hari lagi.`
    :expired?'Akses latihan CilikGo dikunci sehingga langganan diperbaharui.':'Aktifkan akses penuh latihan Tahun 1–6 untuk anak anda.';
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
    <div class="parent-sub-info"><b>${active?'✓ Akses anda sedang aktif':'ℹ Pembayaran belum diaktifkan'}</b><p>${active?'Anda boleh menggunakan semua latihan CilikGo sehingga tarikh tamat di atas.':'Buat masa ini Admin boleh mengaktifkan langganan secara manual untuk tujuan testing.'}</p></div>
  </section>`;
  $('.parent-sub-back').onclick=()=>renderUser(p);
}


async function renderParentLearningHub(p){ return renderStudentPortal(p); }

async function renderStudentPortal(p){
  if(!fb?.auth.currentUser){showAuthPage('login');return;}
  if(p.role!=='user'){toast('Ruang Pelajar hanya melalui akaun Penjaga.');return;}
  if(!subscriptionState(p).active){showDashboardPage();showSubscriptionGate(p,'count');return;}
  const kids=await loadChildren(p.uid);
  if(!activeChild&&kids.length) activeChild=kids[0];
  if(!activeChild){
    showDashboardPage();
    toast('Tambah profil anak dahulu.');
    await renderUser(p);
    return;
  }

  showStudentPage();
  const root=$('#dashboard');
  const year=Number(activeChild.year||Math.max(1,Number(activeChild.age||7)-6));
  const allRows=await loadProgress(p.uid,activeChild.id);
  const rows=allRows.filter(r=>Number(r.year)===year&&r.subject);

  const subjects=[
    {key:'bm',name:'Bahasa Melayu',icon:'🇲🇾',emoji:'📖',desc:'Membaca, kosa kata, tatabahasa dan penulisan.',activity:`kssr_bm_y${year}_`,className:'subject-bm'},
    {key:'bi',name:'Bahasa Inggeris',icon:'🔤',emoji:'💬',desc:'Reading, vocabulary, grammar and writing.',activity:`kssr_bi_y${year}_`,className:'subject-bi'},
    {key:'math',name:'Matematik',icon:'➗',emoji:'🧮',desc:'Nombor, operasi, wang, masa, ukuran dan bentuk.',activity:`kssr_math_y${year}_`,className:'subject-math'},
    {key:'science',name:'Sains',icon:'🔬',emoji:'🧪',desc:'Manusia, hidupan, bahan, bumi dan kemahiran sains.',activity:`kssr_science_y${year}_`,className:'subject-science'}
  ];

  const subjectStats=s=>{
    const sr=rows.filter(r=>String(r.activity||'').startsWith(s.activity));
    const topics=new Map();
    sr.forEach(r=>topics.set(r.topic,Math.max(topics.get(r.topic)||0,Number(r.stars||0))));
    const vals=[...topics.values()];
    const mastered=vals.filter(v=>v>=8).length;
    const best=vals.length?Math.max(...vals):0;
    return {mastered,attempts:sr.length,best,stars:sr.reduce((n,r)=>n+Number(r.stars||0),0)};
  };

  const rowDate=r=>{
    try{return r?.createdAt?.toDate?.()||new Date(r?.createdAt||0);}
    catch(e){return new Date(0);}
  };
  const dayKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayKey=dayKey(new Date());
  const todayRows=rows.filter(r=>dayKey(rowDate(r))===todayKey);
  const activeDays=new Set(rows.map(r=>dayKey(rowDate(r))).filter(x=>x!=='1970-01-01'));
  let streak=0, cursor=new Date();
  while(activeDays.has(dayKey(cursor))){
    streak++;
    cursor.setDate(cursor.getDate()-1);
  }

  const sortedRows=[...rows].sort((a,b)=>rowDate(b)-rowDate(a));
  const last=sortedRows[0]||null;
  const lastSubject=subjects.find(s=>s.key===last?.subject)||subjects.find(s=>subjectStats(s).attempts===0)||subjects[0];

  const totalStars=rows.reduce((n,r)=>n+Number(r.stars||0),0);
  const xp=totalStars*10;
  const level=Math.floor(xp/100)+1;
  const xpInLevel=xp%100;
  const xpPct=Math.min(100,xpInLevel);
  const dailyGoal=3;
  const dailyDone=Math.min(dailyGoal,todayRows.length);
  const dailyPct=Math.round(dailyDone/dailyGoal*100);

  const isSubjectAvailable=s=>year===1||(year===2&&s.key==='bm');
  const availableSubjects=subjects.filter(isSubjectAvailable);
  const masteryTotal=availableSubjects.reduce((n,s)=>n+subjectStats(s).mastered,0);
  const masteryGoal=Math.max(6,availableSubjects.length*6);
  const achievement=totalStars>=150
    ?{icon:'🏆',name:'Juara Cilik',text:'Hebat! Banyak latihan sudah diselesaikan.'}
    :totalStars>=75
      ?{icon:'🌟',name:'Bintang Hebat',text:'Prestasi makin mantap. Teruskan!'}
      :totalStars>=15
        ?{icon:'🚀',name:'Mula Meluncur',text:'Permulaan yang baik. Terus kumpul bintang!'}
        :{icon:'🌱',name:'Langkah Pertama',text:'Mulakan satu latihan untuk kumpul bintang pertama.'};

  root.innerHTML=`<section class="student-portal interactive-student">
    <div class="student-bg-orb orb-one"></div><div class="student-bg-orb orb-two"></div><div class="student-bg-orb orb-three"></div>
    <header class="student-header interactive-header">
      <button class="student-back" id="studentBackParent">← Penjaga</button>
      <div class="student-brand"><span class="brand-badge">CG</span><b>CilikGo Pelajar</b></div>
      <div class="student-profile-wrap">
        <div class="student-streak">🔥 <b>${streak}</b><small>hari</small></div>
        <div class="student-profile">${esc(activeChild.avatar||'🧒')} <span>${esc(activeChild.name)}</span><b>Tahun ${year}</b></div>
      </div>
    </header>

    <main class="student-main interactive-main">
      <section class="student-hero-panel">
        <div class="student-hero-copy">
          <span class="student-kicker">RUANG BELAJAR SAYA</span>
          <h1>Hai, ${esc(activeChild.name)}! 👋</h1>
          <p>${todayRows.length?'Bagus! Kamu sudah belajar hari ini. Jom sambung satu lagi latihan.':'Jom mula misi belajar hari ini dan kumpul lebih banyak bintang!'}</p>
          <div class="student-hero-actions">
            <button class="student-continue-btn" id="continueLearning"><span>${lastSubject.emoji}</span><div><small>${last?'SAMBUNG BELAJAR':'MULA BELAJAR'}</small><b>${lastSubject.name}</b></div><strong>→</strong></button>
            <div class="student-level-card"><div class="level-badge">LV ${level}</div><div><small>XP PELAJAR</small><b>${xpInLevel}/100 XP</b><div class="xp-bar"><span style="width:${xpPct}%"></span></div></div></div>
          </div>
        </div>
        <div class="student-mission-card">
          <div class="mission-top"><div><small>MISI HARI INI</small><h3>Lengkapkan ${dailyGoal} latihan</h3></div><div class="mission-ring" style="--progress:${dailyPct}"><span>${dailyDone}/${dailyGoal}</span></div></div>
          <div class="mission-steps">${[1,2,3].map((n,i)=>`<div class="mission-step ${dailyDone>=n?'done':''}"><span>${dailyDone>=n?'✓':n}</span><p>${i===0?'Pemanas badan':i===1?'Tambah keyakinan':'Tamatkan misi'}</p></div>`).join('')}</div>
          <div class="mission-reward"><span>🎁</span><div><small>GANJARAN MISI</small><b>+30 XP apabila lengkap</b></div></div>
        </div>
      </section>

      <section class="student-year-focus" aria-label="Tahun pembelajaran aktif">
        <div class="student-year-focus-icon">🎒</div>
        <div><small>TAHUN PEMBELAJARAN SAYA</small><h3>Tahun ${year}</h3><p>${year===1?'Semua subjek Tahun 1 yang tersedia dipaparkan di bawah.':year===2?'Bahasa Melayu Tahun 2 kini tersedia. Subjek lain akan dibuka secara berperingkat.':`Kandungan Tahun ${year} akan dibuka apabila bank latihan tersedia.`}</p></div>
        <span class="student-year-focus-badge">${year===1?'Aktif':year===2?'BM tersedia':'Akan datang'}</span>
      </section>

      <section class="student-section">
        <div class="student-section-head">
          <div><span class="student-kicker">PILIH SUBJEK</span><h2>Apa yang kamu mahu belajar?</h2></div>
          <div class="mastery-chip">🏅 ${masteryTotal}/${masteryGoal} topik dikuasai</div>
        </div>

        <div class="student-subject-grid interactive-grid">${subjects.map(s=>{
          const st=subjectStats(s),available=isSubjectAvailable(s);
          const masteryPct=Math.round(Math.min(6,st.mastered)/6*100);
          return `<button class="student-subject-card interactive-card ${s.className} ${available?'':'locked'}" data-student-subject="${s.key}" ${available?'':'disabled'}>
            <div class="subject-card-top">
              <span class="student-subject-icon">${s.icon}</span>
              <span class="subject-status-pill">${st.attempts?`${st.mastered}/6 dikuasai`:'Baru'}</span>
            </div>
            <div class="student-subject-copy">
              <small>${available?`TAHUN ${year}`:'AKAN DATANG'}</small>
              <strong>${s.name}</strong>
              <em>${s.desc}</em>
            </div>
            <div class="subject-progress-wrap">
              <div class="subject-progress-meta"><span>${st.attempts?`${st.attempts} sesi`:'Belum mula'}</span><b>${st.best?`⭐ ${st.best}/15`:'Mula belajar'}</b></div>
              <div class="subject-progress-bar"><span style="width:${masteryPct}%"></span></div>
            </div>
            <span class="student-go">→</span>
          </button>`;
        }).join('')}</div>
      </section>

      <section class="student-achievement-row">
        <div class="achievement-card">
          <span class="achievement-icon">${achievement.icon}</span>
          <div><small>PENCAPAIAN SAYA</small><h3>${achievement.name}</h3><p>${achievement.text}</p></div>
        </div>
        <div class="achievement-card compact-achievement"><span>⭐</span><div><small>JUMLAH BINTANG</small><h3>${totalStars}</h3></div></div>
        <div class="achievement-card compact-achievement"><span>📚</span><div><small>SESI DISELESAIKAN</small><h3>${rows.length}</h3></div></div>
        <div class="achievement-card compact-achievement"><span>🔥</span><div><small>STREAK BELAJAR</small><h3>${streak} hari</h3></div></div>
      </section>

      <section class="student-tip-card">
        <span>💡</span>
        <div><small>TIP CILIKGO</small><p>Belajar 10–15 minit setiap sesi lebih mudah untuk kekal fokus. Pilih satu subjek dahulu dan cuba capai sekurang-kurangnya ⭐ 8/15.</p></div>
      </section>
    </main>
  </section>`;

  $('#studentBackParent').onclick=()=>{
    document.body.classList.remove('student-mode');
    showDashboardPage();
    renderUser(p);
  };

  const openSubject=k=>{
    if(year===1){
      if(k==='bm')renderBmYear1Hub(p);
      if(k==='bi')renderBiYear1Hub(p);
      if(k==='math')renderMathYear1Hub(p);
      if(k==='science')renderScienceYear1Hub(p);
      return;
    }
    if(year===2&&k==='bm'){renderBmYear2Hub(p);return;}
    toast(`Subjek ini untuk Tahun ${year} sedang disediakan.`);
  };

  $('#continueLearning').onclick=()=>openSubject(lastSubject.key);
  document.querySelectorAll('[data-student-subject]').forEach(b=>b.onclick=()=>openSubject(b.dataset.studentSubject));
  animateIn(root);
}


/* =========================================================
   CilikGo Full-Screen Quiz Engine
   Tahun 1: BM / BI / Matematik / Sains
   ========================================================= */
let cgSpeechVoices=[];
function refreshCgSpeechVoices(){
  if('speechSynthesis' in window) cgSpeechVoices=window.speechSynthesis.getVoices()||[];
}
refreshCgSpeechVoices();
if('speechSynthesis' in window){
  window.speechSynthesis.addEventListener?.('voiceschanged',refreshCgSpeechVoices);
}

function pickCgVoice(lang){
  refreshCgSpeechVoices();
  const target=String(lang||'ms-MY').toLowerCase();
  if(target.startsWith('ms')){
    return cgSpeechVoices.find(v=>String(v.lang).toLowerCase()==='ms-my')
      ||cgSpeechVoices.find(v=>String(v.lang).toLowerCase().startsWith('ms-'))
      ||cgSpeechVoices.find(v=>/malay|malaysia/i.test(`${v.name} ${v.lang}`))
      ||null;
  }
  return cgSpeechVoices.find(v=>String(v.lang).toLowerCase()==='en-my')
    ||cgSpeechVoices.find(v=>String(v.lang).toLowerCase()==='en-gb')
    ||cgSpeechVoices.find(v=>String(v.lang).toLowerCase().startsWith('en-'))
    ||null;
}

function speakCilikGo(text,lang='ms-MY',button=null){
  if(!('speechSynthesis' in window)||!window.SpeechSynthesisUtterance){
    toast('Fungsi suara tidak disokong oleh browser ini.');
    return;
  }
  const synth=window.speechSynthesis;
  synth.cancel();

  const utterance=new SpeechSynthesisUtterance(String(text||''));
  const voice=pickCgVoice(lang);
  if(voice) utterance.voice=voice;
  utterance.lang=lang;
  utterance.rate=1;
  utterance.pitch=1;
  utterance.volume=1;

  let resumeMusic=false;
  if(typeof cgMusicOn!=='undefined'&&cgMusicOn&&typeof cgAudioCtx!=='undefined'&&cgAudioCtx?.state==='running'){
    resumeMusic=true;
    cgAudioCtx.suspend().catch(()=>{});
  }

  const original=button?.innerHTML||'';
  if(button){
    button.disabled=true;
    button.innerHTML=lang.startsWith('en')?'🔊 Playing…':'🔊 Sedang membaca…';
    button.classList.add('speaking');
  }
  const cleanup=()=>{
    if(button){
      button.disabled=false;
      button.innerHTML=original;
      button.classList.remove('speaking');
    }
    if(resumeMusic&&typeof cgMusicOn!=='undefined'&&cgMusicOn&&cgAudioCtx?.state==='suspended'){
      cgAudioCtx.resume().catch(()=>{});
    }
  };
  utterance.onend=cleanup;
  utterance.onerror=e=>{
    console.warn('speech synthesis',e);
    cleanup();
    toast(lang.startsWith('en')?'Audio could not be played.':'Audio tidak dapat dimainkan. Cuba tekan Dengar sekali lagi.');
  };

  // Chrome/mobile lebih stabil selepas cancel() diberi sedikit masa.
  setTimeout(()=>{
    try{
      synth.resume();
      synth.speak(utterance);
    }catch(e){
      console.error(e);
      cleanup();
      toast('Audio tidak dapat dimainkan pada browser ini.');
    }
  },60);
}

function celebrate(){
  const shell=$('#gameContent .quiz-fullscreen-shell');
  if(!shell)return;
  const burst=document.createElement('div');
  burst.className='quiz-celebrate-burst';
  burst.innerHTML='<i>⭐</i><i>✨</i><i>🌟</i><i>✨</i><i>⭐</i>';
  shell.appendChild(burst);
  setTimeout(()=>burst.remove(),900);
}

function quizScreenEffect(type){
  const stage=$('#gameContent .quiz-fullscreen-shell');
  if(!stage)return;
  stage.classList.remove('quiz-effect-wrong','quiz-effect-correct');
  void stage.offsetWidth;
  const cls=type==='correct'?'quiz-effect-correct':'quiz-effect-wrong';
  stage.classList.add(cls);
  if(navigator.vibrate){
    navigator.vibrate(type==='correct'?[35]:[70,40,70]);
  }
  setTimeout(()=>stage.classList.remove(cls),650);
}

function quizChoiceShape(value){
  const s=String(value??'').trim();
  if(/^-?\d+(?:\.\d+)?$/.test(s))return 'number';
  if(s.length===1&&/^[A-Za-z]$/.test(s))return 'letter';
  if(!/\s/.test(s)&&s.length<=14)return 'word';
  return 'phrase';
}

function generatedQuizDistractors(correct,prompt=''){
  const value=String(correct??'').trim();
  const out=[];
  if(/^-?\d+(?:\.\d+)?$/.test(value)){
    const n=Number(value);
    [n-1,n+1,n+2,n-2,n+10].forEach(x=>out.push(String(x)));
    return out;
  }
  if(value.length===1&&/^[A-Za-z]$/.test(value)){
    const code=value.toUpperCase().charCodeAt(0);
    [-2,-1,1,2,3].forEach(d=>{
      const c=code+d;
      if(c>=65&&c<=90)out.push(String.fromCharCode(c));
    });
    return out;
  }
  if(/^[A-Za-zÀ-ÿ-]+$/.test(value)&&value.length>=2){
    const vowels=/[aeiouAEIOU]/;
    const swaps=['A','I','U','E','O'];
    const chars=[...value];
    const pos=chars.findIndex(ch=>vowels.test(ch));
    if(pos>=0){
      swaps.forEach(v=>{
        const next=[...chars];
        next[pos]=chars[pos]===chars[pos].toUpperCase()?v:v.toLowerCase();
        out.push(next.join(''));
      });
    }
    if(chars.length>2){
      const next=[...chars];
      [next[next.length-1],next[next.length-2]]=[next[next.length-2],next[next.length-1]];
      out.push(next.join(''));
    }
  }
  return out;
}

function fourQuizChoices(question,topic){
  const correct=String(question.correct??'').trim();
  const choices=[];
  const add=value=>{
    const s=String(value??'').trim();
    if(s&&!choices.includes(s))choices.push(s);
  };

  (question.answers||[]).forEach(add);
  if(!choices.includes(correct))choices.unshift(correct);

  if(choices.length!==4){
    console.error('Bank soalan tidak sah: setiap soalan mesti mempunyai tepat 4 pilihan.',question);
    toast('Soalan ini sedang diselenggara. Sila pilih topik lain.');
    return choices.slice(0,4);
  }

  // Fisher-Yates: hanya mengacak empat pilihan yang telah diaudit.
  for(let i=choices.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [choices[i],choices[j]]=[choices[j],choices[i]];
  }
  return choices;
}

function questionNatureScene(subjectKey,topicKey,question){
  const map={
    bm:{
      huruf:['🦉','🐰','🔤','Rimba Huruf'],
      kosa:['🦊','🐿️','🌼','Rimba Kosa Kata'],
      tatabahasa:['🦉','📚','🍃','Rimba Bahasa'],
      faham:['🐿️','📖','🌳','Sudut Membaca'],
      menulis:['🐰','✏️','🌻','Taman Menulis'],
      santun:['🦜','🦊','💬','Taman Bahasa Santun']
    },
    bi:{
      alphabet:['🦉','🐰','🔤','Forest Letters'],
      vocabulary:['🦊','🐿️','🌼','Forest Words'],
      grammar:['🦉','📚','🍃','Grammar Garden'],
      reading:['🐿️','📖','🌳','Reading Forest'],
      writing:['🐰','✏️','🌻','Writing Garden'],
      communication:['🦜','🦊','💬','Friendly Forest']
    },
    math:{
      numbers:['🐰','🔢','🍎','Rimba Nombor'],
      addsub:['🐿️','➕','🍎','Rimba Operasi'],
      money:['🦊','🪙','🍓','Pasar Rimba'],
      time:['🦉','🕒','🌙','Rimba Masa'],
      measure:['🦒','📏','🌿','Rimba Ukuran'],
      shapes:['🐢','🔷','🌼','Taman Bentuk'],
      data:['🦜','📊','🌳','Rimba Data']
    },
    science:{
      skills:['🦉','🔍','🍃','Makmal Rimba'],
      living:['🐰','🌱','🐞','Rimba Hidupan'],
      human:['🐵','👀','🌼','Rimba Deria'],
      organisms:['🦋','🌳','🐿️','Rimba Haiwan & Tumbuhan'],
      materials:['🦊','🧲','💧','Rimba Bahan'],
      earthdesign:['🐢','🌍','🌱','Rimba Bumi']
    }
  };
  const scene=map?.[subjectKey]?.[topicKey]||['🦉','🐰','🌿','Rimba CilikGo'];
  return {left:scene[0],right:scene[1],accent:scene[2],label:scene[3]};
}

function quizAnswerEmoji(answer){
  const key=String(answer||'').trim().toLowerCase();
  const exact={
    'baju':'👕','bola':'⚽','buku':'📚','kucing':'🐱','ayam':'🐔','ikan':'🐟',
    'sekolah':'🏫','pasar':'🛒','hospital':'🏥','pisang':'🍌','epal':'🍎','anggur':'🍇',
    'kaki':'🦶','tangan':'✋','kepala':'🙂','payung':'☂️','bantal':'🛏️','sudu':'🥄',
    'kereta':'🚗','bas':'🚌','basikal':'🚲','pokok bunga':'🌼','bunga':'🌼',
    'burung':'🐦','bird':'🐦','cat':'🐱','dog':'🐶','fish':'🐟','apple':'🍎',
    'school':'🏫','pencil':'✏️','book':'📘','house':'🏠','ball':'⚽','sun':'☀️',
    'eyes':'👀','ears':'👂','feet':'🦶','kitchen':'🍳','blue':'🔵','red':'🔴',
    'green':'🟢','mata':'👀','hidung':'👃','telinga':'👂','lidah':'👅','kulit':'✋',
    'air':'💧','water':'💧','akar':'🌱','daun':'🍃','buah':'🍎','sayap':'🪽',
    'sirip':'🐟','magnet':'🧲','plastik':'🥤','kain':'🧵','span':'🧽',
    'sungai':'🏞️','bukit':'⛰️','laut':'🌊','tasik':'🏞️','batu':'🪨'
  };
  if(exact[key])return exact[key];
  if(/^\d+$/.test(key))return '🔢';
  if(key.length===1&&/[a-z]/i.test(key))return '🔤';
  return '';
}


function animalMascotSvg(type='owl'){
  const common='viewBox="0 0 180 180" role="img" aria-hidden="true"';
  if(type==='rabbit')return `<svg ${common} class="cartoon-animal-svg">
    <ellipse cx="72" cy="43" rx="18" ry="45" fill="#f0e6df" stroke="#9f8d85" stroke-width="5" transform="rotate(-12 72 43)"/>
    <ellipse cx="111" cy="42" rx="18" ry="45" fill="#f0e6df" stroke="#9f8d85" stroke-width="5" transform="rotate(12 111 42)"/>
    <ellipse cx="72" cy="42" rx="8" ry="30" fill="#ffb9bd" opacity=".85" transform="rotate(-12 72 42)"/>
    <ellipse cx="111" cy="41" rx="8" ry="30" fill="#ffb9bd" opacity=".85" transform="rotate(12 111 41)"/>
    <circle cx="91" cy="93" r="55" fill="#eee5de" stroke="#9f8d85" stroke-width="5"/>
    <ellipse cx="70" cy="88" rx="8" ry="11" fill="#29262b"/><ellipse cx="112" cy="88" rx="8" ry="11" fill="#29262b"/>
    <circle cx="67" cy="84" r="3" fill="#fff"/><circle cx="109" cy="84" r="3" fill="#fff"/>
    <ellipse cx="91" cy="104" rx="9" ry="7" fill="#ff8f91"/>
    <path d="M91 111 C84 118 77 119 72 116 M91 111 C98 118 105 119 110 116" fill="none" stroke="#5d4e4a" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="56" cy="108" rx="12" ry="7" fill="#ffb9bd" opacity=".45"/><ellipse cx="126" cy="108" rx="12" ry="7" fill="#ffb9bd" opacity=".45"/>
    <path d="M54 142 C65 124 118 124 130 142 L137 172 H44 Z" fill="#fff4dc" stroke="#9f8d85" stroke-width="5"/>
    <path d="M54 144 Q91 127 128 144" fill="none" stroke="#64bdf0" stroke-width="5"/>
  </svg>`;
  if(type==='squirrel')return `<svg ${common} class="cartoon-animal-svg">
    <path d="M45 121 C6 107 8 52 51 55 C73 56 79 84 66 99 C53 114 34 106 28 89 C30 115 49 128 65 131" fill="#e98a36" stroke="#9a5324" stroke-width="5"/>
    <circle cx="102" cy="79" r="43" fill="#e98a36" stroke="#9a5324" stroke-width="5"/>
    <path d="M75 53 L69 28 L91 45 Z M123 48 L142 31 L139 58 Z" fill="#e98a36" stroke="#9a5324" stroke-width="5" stroke-linejoin="round"/>
    <ellipse cx="87" cy="78" rx="7" ry="9" fill="#222"/><ellipse cx="119" cy="78" rx="7" ry="9" fill="#222"/>
    <circle cx="84" cy="75" r="2.5" fill="#fff"/><circle cx="116" cy="75" r="2.5" fill="#fff"/>
    <ellipse cx="103" cy="94" rx="8" ry="6" fill="#6d381e"/>
    <path d="M103 101 C96 108 89 108 85 104 M103 101 C110 108 117 108 121 104" fill="none" stroke="#6d381e" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="77" cy="98" rx="11" ry="6" fill="#ffbd91" opacity=".55"/><ellipse cx="129" cy="98" rx="11" ry="6" fill="#ffbd91" opacity=".55"/>
    <path d="M70 129 Q101 113 132 131 L137 171 H64 Z" fill="#6fc46a" stroke="#458e48" stroke-width="5"/>
    <path d="M81 141 L96 153 L115 135" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
  </svg>`;
  if(type==='bird')return `<svg ${common} class="cartoon-animal-svg">
    <ellipse cx="94" cy="100" rx="50" ry="43" fill="#51bde7" stroke="#237ca7" stroke-width="5"/>
    <circle cx="91" cy="67" r="38" fill="#60c7ef" stroke="#237ca7" stroke-width="5"/>
    <path d="M71 35 Q91 12 111 35" fill="#2d9dd0"/>
    <ellipse cx="77" cy="67" rx="7" ry="9" fill="#222"/><ellipse cx="104" cy="67" rx="7" ry="9" fill="#222"/>
    <circle cx="75" cy="64" r="2.5" fill="#fff"/><circle cx="102" cy="64" r="2.5" fill="#fff"/>
    <path d="M88 78 L103 83 L88 88 Z" fill="#ffb12f" stroke="#d57e13" stroke-width="3"/>
    <path d="M51 100 Q19 82 21 124 Q45 132 61 119" fill="#3aa6d5" stroke="#237ca7" stroke-width="5"/>
    <path d="M137 99 Q164 78 166 119 Q147 130 130 119" fill="#3aa6d5" stroke="#237ca7" stroke-width="5"/>
    <path d="M77 138 L70 164 M109 138 L116 164" stroke="#d57e13" stroke-width="5" stroke-linecap="round"/>
  </svg>`;
  return `<svg ${common} class="cartoon-animal-svg">
    <path d="M54 54 L39 24 L73 39 Z M126 54 L141 24 L107 39 Z" fill="#9d663c" stroke="#704528" stroke-width="5"/>
    <circle cx="90" cy="91" r="58" fill="#a96d40" stroke="#704528" stroke-width="5"/>
    <ellipse cx="66" cy="87" rx="22" ry="28" fill="#f1d59c"/><ellipse cx="114" cy="87" rx="22" ry="28" fill="#f1d59c"/>
    <circle cx="67" cy="85" r="8" fill="#202027"/><circle cx="113" cy="85" r="8" fill="#202027"/>
    <circle cx="64" cy="82" r="3" fill="#fff"/><circle cx="110" cy="82" r="3" fill="#fff"/>
    <path d="M83 103 L90 112 L97 103 Z" fill="#f5a623" stroke="#c46f0e" stroke-width="3"/>
    <path d="M90 112 L90 122" stroke="#704528" stroke-width="4"/>
    <path d="M61 42 Q90 21 119 42" fill="#253f86"/>
    <rect x="54" y="38" width="72" height="12" rx="5" fill="#253f86"/>
    <path d="M124 43 L142 60 L126 62" fill="#f4c443"/>
    <path d="M52 133 Q90 116 128 133 L138 174 H42 Z" fill="#77c96a" stroke="#4c9347" stroke-width="5"/>
  </svg>`;
}

function quizSceneAnimals(subjectKey,topicKey){
  const scenes={
    bm:{huruf:['owl','rabbit','bird'],kosa:['squirrel','rabbit','bird'],tatabahasa:['owl','squirrel','bird'],faham:['squirrel','owl','bird'],menulis:['rabbit','owl','bird'],santun:['bird','squirrel','rabbit'],kata_nama:['owl','rabbit','bird'],kata_kerja:['squirrel','rabbit','bird'],ayat:['owl','squirrel','bird'],pemahaman:['rabbit','owl','bird']},
    bi:{alphabet:['owl','rabbit','bird'],vocabulary:['squirrel','rabbit','bird'],grammar:['owl','squirrel','bird'],reading:['rabbit','owl','bird'],writing:['squirrel','rabbit','bird'],communication:['bird','rabbit','squirrel']},
    math:{numbers:['squirrel','rabbit','bird'],addsub:['squirrel','owl','bird'],money:['rabbit','squirrel','bird'],time:['owl','rabbit','bird'],measure:['squirrel','rabbit','bird'],shapes:['rabbit','owl','bird'],data:['bird','squirrel','rabbit']},
    science:{skills:['owl','rabbit','bird'],living:['rabbit','squirrel','bird'],human:['squirrel','rabbit','bird'],organisms:['bird','rabbit','squirrel'],materials:['owl','squirrel','bird'],earthdesign:['rabbit','owl','bird']}
  };
  return scenes?.[subjectKey]?.[topicKey]||['owl','rabbit','bird'];
}

function formatQuizBoardPrompt(prompt){
  const text=String(prompt||'').trim();
  const colon=text.indexOf(':');
  if(colon>0&&colon<text.length-1){
    const first=esc(text.slice(0,colon+1));
    const second=esc(text.slice(colon+1).trim());
    return `<span class="board-prompt-lead">${first}</span><strong class="board-prompt-focus">${second}</strong>`;
  }
  const quoted=text.match(/^(.*?)[“"]([^”"]+)[”"](.*)$/);
  if(quoted){
    return `<span class="board-prompt-lead">${esc((quoted[1]+quoted[3]).trim())}</span><strong class="board-prompt-focus">${esc(quoted[2])}</strong>`;
  }
  return `<strong class="board-prompt-single">${esc(text)}</strong>`;
}

function year1QuizRuntimeConfig(subjectKey){
  const configs={
    bm:{
      key:'bm',name:'Bahasa Melayu',icon:'🇲🇾',bank:bmYear1Bank,
      module:'KSSR Bahasa Melayu Tahun 1',activity:'kssr_bm_y1_',lang:'ms-MY',
      question:'Soalan',complete:'selesai',listen:'Dengar',
      hint:'Dengar soalan atau baca sendiri, kemudian pilih jawapan A, B, C atau D.',
      wrong:'Belum tepat. Cuba lagi!',correct:'Betul!',next:'Seterusnya',
      done:'Syabas!',keep:'Teruskan latihan!',again:'Latih Lagi',topics:'Pilih Topik',
      questionsDone:'Soalan selesai',attempts:'Percubaan',score:'Skor bintang',
      hub:renderBmYear1Hub
    },
    bi:{
      key:'bi',name:'Bahasa Inggeris',icon:'🔤',bank:biYear1Bank,
      module:'KSSR Bahasa Inggeris Tahun 1',activity:'kssr_bi_y1_',lang:'en-GB',
      question:'Question',complete:'complete',listen:'Listen',
      hint:'Listen or read the question, then choose answer A, B, C or D.',
      wrong:'Not quite. Try again!',correct:'Correct!',next:'Next',
      done:'Well done!',keep:'Keep practising!',again:'Practise Again',topics:'Choose Topic',
      questionsDone:'Questions completed',attempts:'Attempts',score:'Star score',
      hub:renderBiYear1Hub
    },
    math:{
      key:'math',name:'Matematik',icon:'➗',bank:mathYear1Bank,
      module:'KSSR Matematik Tahun 1',activity:'kssr_math_y1_',lang:'ms-MY',
      question:'Soalan',complete:'selesai',listen:'Dengar',
      hint:'Dengar soalan atau baca sendiri, kemudian pilih jawapan A, B, C atau D.',
      wrong:'Belum tepat. Cuba lagi!',correct:'Betul!',next:'Seterusnya',
      done:'Syabas!',keep:'Teruskan latihan!',again:'Latih Lagi',topics:'Pilih Topik',
      questionsDone:'Soalan selesai',attempts:'Percubaan',score:'Skor bintang',
      hub:renderMathYear1Hub
    },
    science:{
      key:'science',name:'Sains',icon:'🔬',bank:scienceYear1Bank,
      module:'KSSR Sains Tahun 1',activity:'kssr_science_y1_',lang:'ms-MY',
      question:'Soalan',complete:'selesai',listen:'Dengar',
      hint:'Dengar soalan atau baca sendiri, kemudian pilih jawapan A, B, C atau D.',
      wrong:'Belum tepat. Cuba lagi!',correct:'Betul!',next:'Seterusnya',
      done:'Syabas!',keep:'Teruskan latihan!',again:'Latih Lagi',topics:'Pilih Topik',
      questionsDone:'Soalan selesai',attempts:'Percubaan',score:'Skor bintang',
      hub:renderScienceYear1Hub
    }
  };
  return configs[subjectKey];
}

async function startYear1FullscreenQuiz(subjectKey,topicKey){
  if(!fb?.auth.currentUser){showAuthPage('login');return;}
  const p=currentProfile||await getProfile(fb.auth.currentUser);
  if(!subscriptionState(p).active){showSubscriptionGate(p,'latihan');return;}
  if(!activeChild){toast('Pilih profil pelajar dahulu.');return;}

  const cfg=year1QuizRuntimeConfig(subjectKey);
  const topic=cfg?.bank?.[topicKey];
  if(!cfg||!topic){toast('Topik tidak dijumpai.');return;}

  const childYear=Number(activeChild.year||Math.max(1,Number(activeChild.age||7)-6));
  if(childYear!==1){toast(`Latihan ini untuk Tahun 1. Profil ini ialah Tahun ${childYear}.`);return;}

  const questions=[...topic.questions].sort(()=>Math.random()-.5).slice(0,5);
  let index=0,scoreStars=0,totalAttempts=0,correctCount=0;

  const renderQuestion=()=>{
    const q=questions[index];
    let attemptsThisQuestion=0;
    let answeredCorrectly=false;
    const pct=Math.round(index/questions.length*100);
    const isEnglish=cfg.lang.startsWith('en');
    const choices=fourQuizChoices(q,topic);
    const scene=questionNatureScene(subjectKey,topicKey,q);
    const letters=['A','B','C','D'];

    const animals=quizSceneAnimals(subjectKey,topicKey);
    $('#gameContent').innerHTML=`<section class="quiz-fullscreen-shell reference-quiz subject-${cfg.key}">
      <div class="forest-canopy" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="forest-floor" aria-hidden="true"><span>🌼</span><span>🌸</span><span>🍄</span><span>🌻</span><span>🌺</span></div>

      <header class="quiz-ref-header">
        <div class="quiz-ref-brand"><span class="brand-badge">CG</span><div><b>CilikGo Pelajar</b><small>${cfg.name} · Tahun 1</small></div></div>
        <div class="quiz-child-pill">${esc(activeChild.avatar||'🧒')} <span>${esc(activeChild.name)}</span></div>
      </header>

      <main class="quiz-ref-main">
        <div class="quiz-ref-progress">
          <div class="quiz-ref-progress-count"><b>${cfg.question} ${index+1} / ${questions.length}</b></div>
          <div class="quiz-ref-progress-track"><span style="width:${Math.round(index/questions.length*100)}%"></span></div>
          <div class="quiz-score-box"><span>⭐</span><b>${scoreStars}</b></div>
        </div>

        <section class="quiz-ref-card">
          <div class="quiz-ref-card-head">
            <div class="quiz-ref-topic"><span class="quiz-ref-topic-icon">${topic.icon}</span><b>${esc(topic.title)}</b></div>
            <span class="quiz-ref-subject-pill">${cfg.name} · Tahun 1</span>
          </div>

          <div class="quiz-listen-wrap">
            <button class="quiz-listen-btn" id="speakQuestion"><span>🔊</span>${cfg.listen}</button>
            <span class="listen-music-notes" aria-hidden="true">♫ ♪</span>
          </div>
          <p class="quiz-audio-hint">${cfg.hint}</p>

          <div class="quiz-reference-scene">
            <div class="scene-sky-cloud cloud-a"></div><div class="scene-sky-cloud cloud-b"></div>
            <div class="scene-bush bush-left"></div><div class="scene-bush bush-right"></div>
            <div class="scene-tree tree-left">🌳</div><div class="scene-tree tree-right">🌳</div>
            <div class="scene-animal teacher-animal">${animalMascotSvg(animals[0])}</div>
            <div class="scene-animal learner-animal">${animalMascotSvg(animals[1])}</div>
            <div class="scene-bird">${animalMascotSvg(animals[2])}</div>

            <div class="quiz-wood-board">
              <div class="wood-board-inner">
                ${formatQuizBoardPrompt(q.prompt)}
              </div>
              <span class="wood-board-leg left-leg"></span><span class="wood-board-leg right-leg"></span>
            </div>

            <div class="scene-learning-blocks" aria-hidden="true">
              <span>${cfg.key==='math'?'1':'A'}</span><span>${cfg.key==='science'?'🌱':cfg.key==='bi'?'B':'JU'}</span>
            </div>
          </div>

          <div class="quiz-answer-grid colorful-answer-grid ref-answer-grid">
            ${choices.map((answer,i)=>{const icon=quizAnswerEmoji(answer);return `<button class="quiz-answer" data-answer="${esc(answer)}">
              <span class="quiz-answer-letter">${letters[i]}</span>
              <span class="quiz-answer-text">${esc(answer)}</span>
              ${icon?`<span class="quiz-answer-visual">${icon}</span>`:''}
            </button>`}).join('')}
          </div>

          <div class="quiz-feedback" id="gameMsg" aria-live="polite"></div>

          <div class="quiz-next-row ref-next-row">
            <button class="quiz-next-btn locked" id="quizNextBtn" type="button" aria-disabled="true">${cfg.next}<span>→</span></button>
          </div>
        </section>
      </main>
    </section>`;

    if(!$('#gameModal').open) $('#gameModal').showModal();

    const speakBtn=$('#speakQuestion');
    speakBtn.onclick=()=>speakCilikGo(q.prompt,cfg.lang,speakBtn);

    const nextBtn=$('#quizNextBtn');
    document.querySelectorAll('.quiz-answer').forEach(btn=>btn.onclick=()=>{
      if(answeredCorrectly)return;
      attemptsThisQuestion++;
      totalAttempts++;

      const answer=btn.dataset.answer;
      if(answer!==String(q.correct)){
        btn.classList.remove('answer-correct');
        btn.classList.add('answer-wrong');
        setTimeout(()=>btn.classList.remove('answer-wrong'),650);
        $('#gameMsg').innerHTML=`<div class="quiz-feedback-box wrong"><b>✕ ${cfg.wrong}</b><span>${isEnglish?`Attempt ${attemptsThisQuestion}`:`Percubaan ${attemptsThisQuestion}`}</span></div>`;
        quizScreenEffect('wrong');
        return;
      }

      answeredCorrectly=true;
      correctCount++;
      const earned=attemptsThisQuestion===1?3:attemptsThisQuestion===2?2:1;
      scoreStars+=earned;

      btn.classList.add('answer-correct');
      document.querySelectorAll('.quiz-answer').forEach(a=>{
        a.disabled=true;
        if(a.dataset.answer===String(q.correct))a.classList.add('answer-correct');
      });

      $('#gameMsg').innerHTML=`<div class="quiz-feedback-box correct"><b>✓ ${cfg.correct}</b><span>${esc(q.success||cfg.correct)}</span><strong>+${earned} ⭐</strong></div>`;
      const scoreEl=$('.quiz-score-box b');
      if(scoreEl) scoreEl.textContent=scoreStars;

      // Aktifkan Seterusnya dahulu supaya apa-apa isu visual lain tidak boleh
      // menyebabkan butang kekal kelabu selepas jawapan betul.
      nextBtn.disabled=false;
      nextBtn.removeAttribute('disabled');
      nextBtn.classList.remove('locked');
      nextBtn.classList.add('ready');
      nextBtn.setAttribute('aria-disabled','false');

      const progressEl=$('.quiz-ref-progress-track span')||$('.quiz-progress-track span');
      if(progressEl) progressEl.style.width=`${Math.round((index+1)/questions.length*100)}%`;

      quizScreenEffect('correct');
      celebrate();
      setTimeout(()=>nextBtn.scrollIntoView({behavior:'smooth',block:'nearest'}),120);
    });

    nextBtn.onclick=e=>{
      e.preventDefault();
      if(!answeredCorrectly){
        nextBtn.classList.add('locked-nudge');
        setTimeout(()=>nextBtn.classList.remove('locked-nudge'),280);
        return;
      }
      nextBtn.classList.add('advancing');
      index++;
      if(index<questions.length)renderQuestion();
      else finishQuiz();
    };
  };

  const finishQuiz=async()=>{
    const passed=scoreStars>=8,pct=Math.round(scoreStars/15*100),isEnglish=cfg.lang.startsWith('en');
    const animals=quizSceneAnimals(subjectKey,topicKey);
    const completionCopy=passed
      ?(isEnglish?'Amazing work! Keep exploring more topics.':'Hebat! Teruskan belajar topik yang lain.')
      :(isEnglish?'Great effort! Try again to collect more stars.':'Usaha yang baik! Cuba lagi untuk kumpul lebih banyak bintang.');
    const masteryTip=passed
      ?(isEnglish?'⭐ This topic is marked as mastered based on your best score.':'⭐ Topik ini ditanda dikuasai berdasarkan rekod terbaik anda.')
      :(isEnglish?'Aim for at least ⭐ 8/15 to master this topic.':'Sasarkan sekurang-kurangnya ⭐ 8/15 untuk kuasai topik ini.');

    $('#gameContent').innerHTML=`<section class="quiz-fullscreen-shell reference-quiz quiz-result-reference subject-${cfg.key}">
      <div class="forest-canopy" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="forest-floor" aria-hidden="true"><span>🌼</span><span>🌸</span><span>🍄</span><span>🌻</span><span>🌺</span></div>

      <header class="quiz-ref-header">
        <div class="quiz-ref-brand"><span class="brand-badge">CG</span><div><b>CilikGo Pelajar</b><small>${cfg.name} · Tahun 1</small></div></div>
        <div class="quiz-child-pill">${esc(activeChild.avatar||'🧒')} <span>${esc(activeChild.name)}</span></div>
      </header>

      <main class="quiz-ref-main quiz-result-ref-main">
        <div class="quiz-ref-progress quiz-result-progress">
          <div class="quiz-ref-progress-count"><b>${cfg.question} ${questions.length} / ${questions.length}</b></div>
          <div class="quiz-ref-progress-track completed"><span style="width:100%"></span></div>
          <div class="quiz-score-box"><span>⭐</span><b>${scoreStars}</b></div>
        </div>

        <section class="quiz-ref-card quiz-result-ref-card">
          <div class="quiz-ref-card-head">
            <div class="quiz-ref-topic"><span class="quiz-ref-topic-icon">${topic.icon}</span><b>${esc(topic.title)}</b></div>
            <span class="quiz-ref-subject-pill">${cfg.name} · Tahun 1</span>
          </div>

          <div class="quiz-result-celebrate">
            <div class="quiz-result-banner">${pct>=85?'🏆':pct>=65?'🌟':'💪'} <span>${passed?cfg.done:cfg.keep}</span></div>
            <p class="quiz-result-subcopy">${esc(activeChild.name)} ${isEnglish?'has completed':'telah menamatkan'} <b>${esc(topic.title)}</b>. ${completionCopy}</p>
          </div>

          <div class="quiz-reference-scene quiz-result-scene">
            <div class="scene-sky-cloud cloud-a"></div><div class="scene-sky-cloud cloud-b"></div>
            <div class="scene-bush bush-left"></div><div class="scene-bush bush-right"></div>
            <div class="scene-tree tree-left">🌳</div><div class="scene-tree tree-right">🌳</div>
            <div class="scene-animal teacher-animal">${animalMascotSvg(animals[0])}</div>
            <div class="scene-animal learner-animal">${animalMascotSvg(animals[1])}</div>
            <div class="scene-bird">${animalMascotSvg(animals[2])}</div>

            <div class="quiz-wood-board quiz-result-board">
              <div class="wood-board-inner">
                <span class="board-prompt-lead">${passed?(isEnglish?'Well done!':'Syabas!'):(isEnglish?'Keep trying!':'Teruskan latihan!')}</span>
                <strong class="board-prompt-focus">${scoreStars} / 15</strong>
                <span class="board-prompt-lead">${correctCount}/5 ${cfg.questionsDone.toLowerCase()}</span>
              </div>
              <span class="wood-board-leg left-leg"></span><span class="wood-board-leg right-leg"></span>
            </div>

            <div class="scene-learning-blocks quiz-result-blocks" aria-hidden="true">
              <span>${correctCount}</span><span>⭐</span>
            </div>
          </div>

          <div class="quiz-result-stats">
            <div class="quiz-result-stat">
              <span class="stat-icon">✅</span>
              <b>${correctCount}/5</b>
              <small>${cfg.questionsDone}</small>
            </div>
            <div class="quiz-result-stat">
              <span class="stat-icon">🎯</span>
              <b>${totalAttempts}</b>
              <small>${cfg.attempts}</small>
            </div>
            <div class="quiz-result-stat">
              <span class="stat-icon">⭐</span>
              <b>${pct}%</b>
              <small>${cfg.score}</small>
            </div>
          </div>

          <div class="quiz-result-tip-box">${masteryTip}</div>

          <div class="quiz-next-row ref-next-row quiz-result-actions">
            <button class="quiz-next-btn ready" id="quizAgain" type="button" aria-disabled="false">${cfg.again}<span>↺</span></button>
            <button class="quiz-next-btn secondary" id="quizTopics" type="button" aria-disabled="false">${cfg.topics}<span>☰</span></button>
          </div>
        </section>
      </main>
    </section>`;
    celebrate();

    try{
      await fb.addDoc(fb.collection(fb.db,'progress'),{
        ownerUid:fb.auth.currentUser.uid,
        childId:activeChild.id,
        module:cfg.module,
        activity:`${cfg.activity}${topicKey}`,
        level:1,year:1,subject:cfg.key,topic:topicKey,questions:5,
        correct:true,correctCount,attempts:totalAttempts,stars:scoreStars,passed,
        createdAt:fb.serverTimestamp()
      });
      toast(`⭐ Rekod ${topic.title} disimpan.`);
    }catch(e){
      console.error(e);
      toast('Latihan selesai, tetapi rekod kemajuan gagal disimpan.');
    }

    $('#quizAgain').onclick=()=>startYear1FullscreenQuiz(subjectKey,topicKey);
    $('#quizTopics').onclick=()=>{
      $('#gameModal').close();
      cfg.hub(p);
    };
  };

  renderQuestion();
}


function year2BmQuizRuntimeConfig(){
  return {key:'bm',name:'Bahasa Melayu',icon:'🇲🇾',bank:bmYear2Bank,module:'KSSR Bahasa Melayu Tahun 2',activity:'kssr_bm_y2_',lang:'ms-MY',question:'Soalan',complete:'selesai',listen:'Dengar',hint:'Dengar soalan atau baca sendiri, kemudian pilih jawapan A, B, C atau D.',wrong:'Belum tepat. Cuba lagi!',correct:'Betul!',next:'Seterusnya',done:'Syabas!',keep:'Teruskan latihan!',again:'Latih Lagi',topics:'Pilih Topik',questionsDone:'Soalan selesai',attempts:'Percubaan',score:'Skor bintang',hub:renderBmYear2Hub};
}

async function startYear2BmFullscreenQuiz(topicKey){
  const subjectKey='bm';
  if(!fb?.auth.currentUser){showAuthPage('login');return;}
  const p=currentProfile||await getProfile(fb.auth.currentUser);
  if(!subscriptionState(p).active){showSubscriptionGate(p,'latihan');return;}
  if(!activeChild){toast('Pilih profil pelajar dahulu.');return;}

  const cfg=year2BmQuizRuntimeConfig();
  const topic=cfg?.bank?.[topicKey];
  if(!cfg||!topic){toast('Topik tidak dijumpai.');return;}

  const childYear=Number(activeChild.year||Math.max(1,Number(activeChild.age||7)-6));
  if(childYear!==2){toast(`Latihan ini untuk Tahun 2. Profil ini ialah Tahun ${childYear}.`);return;}

  const questions=[...topic.questions].sort(()=>Math.random()-.5).slice(0,5);
  let index=0,scoreStars=0,totalAttempts=0,correctCount=0;

  const renderQuestion=()=>{
    const q=questions[index];
    let attemptsThisQuestion=0;
    let answeredCorrectly=false;
    const pct=Math.round(index/questions.length*100);
    const isEnglish=cfg.lang.startsWith('en');
    const choices=fourQuizChoices(q,topic);
    const scene=questionNatureScene(subjectKey,topicKey,q);
    const letters=['A','B','C','D'];

    const animals=quizSceneAnimals(subjectKey,topicKey);
    $('#gameContent').innerHTML=`<section class="quiz-fullscreen-shell reference-quiz subject-${cfg.key}">
      <div class="forest-canopy" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="forest-floor" aria-hidden="true"><span>🌼</span><span>🌸</span><span>🍄</span><span>🌻</span><span>🌺</span></div>

      <header class="quiz-ref-header">
        <div class="quiz-ref-brand"><span class="brand-badge">CG</span><div><b>CilikGo Pelajar</b><small>${cfg.name} · Tahun 2</small></div></div>
        <div class="quiz-child-pill">${esc(activeChild.avatar||'🧒')} <span>${esc(activeChild.name)}</span></div>
      </header>

      <main class="quiz-ref-main">
        <div class="quiz-ref-progress">
          <div class="quiz-ref-progress-count"><b>${cfg.question} ${index+1} / ${questions.length}</b></div>
          <div class="quiz-ref-progress-track"><span style="width:${Math.round(index/questions.length*100)}%"></span></div>
          <div class="quiz-score-box"><span>⭐</span><b>${scoreStars}</b></div>
        </div>

        <section class="quiz-ref-card">
          <div class="quiz-ref-card-head">
            <div class="quiz-ref-topic"><span class="quiz-ref-topic-icon">${topic.icon}</span><b>${esc(topic.title)}</b></div>
            <span class="quiz-ref-subject-pill">${cfg.name} · Tahun 2</span>
          </div>

          <div class="quiz-listen-wrap">
            <button class="quiz-listen-btn" id="speakQuestion"><span>🔊</span>${cfg.listen}</button>
            <span class="listen-music-notes" aria-hidden="true">♫ ♪</span>
          </div>
          <p class="quiz-audio-hint">${cfg.hint}</p>

          <div class="quiz-reference-scene">
            <div class="scene-sky-cloud cloud-a"></div><div class="scene-sky-cloud cloud-b"></div>
            <div class="scene-bush bush-left"></div><div class="scene-bush bush-right"></div>
            <div class="scene-tree tree-left">🌳</div><div class="scene-tree tree-right">🌳</div>
            <div class="scene-animal teacher-animal">${animalMascotSvg(animals[0])}</div>
            <div class="scene-animal learner-animal">${animalMascotSvg(animals[1])}</div>
            <div class="scene-bird">${animalMascotSvg(animals[2])}</div>

            <div class="quiz-wood-board">
              <div class="wood-board-inner">
                ${formatQuizBoardPrompt(q.prompt)}
              </div>
              <span class="wood-board-leg left-leg"></span><span class="wood-board-leg right-leg"></span>
            </div>

            <div class="scene-learning-blocks" aria-hidden="true">
              <span>${cfg.key==='math'?'1':'A'}</span><span>${cfg.key==='science'?'🌱':cfg.key==='bi'?'B':'JU'}</span>
            </div>
          </div>

          <div class="quiz-answer-grid colorful-answer-grid ref-answer-grid">
            ${choices.map((answer,i)=>{const icon=quizAnswerEmoji(answer);return `<button class="quiz-answer" data-answer="${esc(answer)}">
              <span class="quiz-answer-letter">${letters[i]}</span>
              <span class="quiz-answer-text">${esc(answer)}</span>
              ${icon?`<span class="quiz-answer-visual">${icon}</span>`:''}
            </button>`}).join('')}
          </div>

          <div class="quiz-feedback" id="gameMsg" aria-live="polite"></div>

          <div class="quiz-next-row ref-next-row">
            <button class="quiz-next-btn locked" id="quizNextBtn" type="button" aria-disabled="true">${cfg.next}<span>→</span></button>
          </div>
        </section>
      </main>
    </section>`;

    if(!$('#gameModal').open) $('#gameModal').showModal();

    const speakBtn=$('#speakQuestion');
    speakBtn.onclick=()=>speakCilikGo(q.prompt,cfg.lang,speakBtn);

    const nextBtn=$('#quizNextBtn');
    document.querySelectorAll('.quiz-answer').forEach(btn=>btn.onclick=()=>{
      if(answeredCorrectly)return;
      attemptsThisQuestion++;
      totalAttempts++;

      const answer=btn.dataset.answer;
      if(answer!==String(q.correct)){
        btn.classList.remove('answer-correct');
        btn.classList.add('answer-wrong');
        setTimeout(()=>btn.classList.remove('answer-wrong'),650);
        $('#gameMsg').innerHTML=`<div class="quiz-feedback-box wrong"><b>✕ ${cfg.wrong}</b><span>${isEnglish?`Attempt ${attemptsThisQuestion}`:`Percubaan ${attemptsThisQuestion}`}</span></div>`;
        quizScreenEffect('wrong');
        return;
      }

      answeredCorrectly=true;
      correctCount++;
      const earned=attemptsThisQuestion===1?3:attemptsThisQuestion===2?2:1;
      scoreStars+=earned;

      btn.classList.add('answer-correct');
      document.querySelectorAll('.quiz-answer').forEach(a=>{
        a.disabled=true;
        if(a.dataset.answer===String(q.correct))a.classList.add('answer-correct');
      });

      $('#gameMsg').innerHTML=`<div class="quiz-feedback-box correct"><b>✓ ${cfg.correct}</b><span>${esc(q.success||cfg.correct)}</span><strong>+${earned} ⭐</strong></div>`;
      const scoreEl=$('.quiz-score-box b');
      if(scoreEl) scoreEl.textContent=scoreStars;

      // Aktifkan Seterusnya dahulu supaya apa-apa isu visual lain tidak boleh
      // menyebabkan butang kekal kelabu selepas jawapan betul.
      nextBtn.disabled=false;
      nextBtn.removeAttribute('disabled');
      nextBtn.classList.remove('locked');
      nextBtn.classList.add('ready');
      nextBtn.setAttribute('aria-disabled','false');

      const progressEl=$('.quiz-ref-progress-track span')||$('.quiz-progress-track span');
      if(progressEl) progressEl.style.width=`${Math.round((index+1)/questions.length*100)}%`;

      quizScreenEffect('correct');
      celebrate();
      setTimeout(()=>nextBtn.scrollIntoView({behavior:'smooth',block:'nearest'}),120);
    });

    nextBtn.onclick=e=>{
      e.preventDefault();
      if(!answeredCorrectly){
        nextBtn.classList.add('locked-nudge');
        setTimeout(()=>nextBtn.classList.remove('locked-nudge'),280);
        return;
      }
      nextBtn.classList.add('advancing');
      index++;
      if(index<questions.length)renderQuestion();
      else finishQuiz();
    };
  };

  const finishQuiz=async()=>{
    const passed=scoreStars>=8,pct=Math.round(scoreStars/15*100),isEnglish=cfg.lang.startsWith('en');
    const animals=quizSceneAnimals(subjectKey,topicKey);
    const completionCopy=passed
      ?(isEnglish?'Amazing work! Keep exploring more topics.':'Hebat! Teruskan belajar topik yang lain.')
      :(isEnglish?'Great effort! Try again to collect more stars.':'Usaha yang baik! Cuba lagi untuk kumpul lebih banyak bintang.');
    const masteryTip=passed
      ?(isEnglish?'⭐ This topic is marked as mastered based on your best score.':'⭐ Topik ini ditanda dikuasai berdasarkan rekod terbaik anda.')
      :(isEnglish?'Aim for at least ⭐ 8/15 to master this topic.':'Sasarkan sekurang-kurangnya ⭐ 8/15 untuk kuasai topik ini.');

    $('#gameContent').innerHTML=`<section class="quiz-fullscreen-shell reference-quiz quiz-result-reference subject-${cfg.key}">
      <div class="forest-canopy" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="forest-floor" aria-hidden="true"><span>🌼</span><span>🌸</span><span>🍄</span><span>🌻</span><span>🌺</span></div>

      <header class="quiz-ref-header">
        <div class="quiz-ref-brand"><span class="brand-badge">CG</span><div><b>CilikGo Pelajar</b><small>${cfg.name} · Tahun 2</small></div></div>
        <div class="quiz-child-pill">${esc(activeChild.avatar||'🧒')} <span>${esc(activeChild.name)}</span></div>
      </header>

      <main class="quiz-ref-main quiz-result-ref-main">
        <div class="quiz-ref-progress quiz-result-progress">
          <div class="quiz-ref-progress-count"><b>${cfg.question} ${questions.length} / ${questions.length}</b></div>
          <div class="quiz-ref-progress-track completed"><span style="width:100%"></span></div>
          <div class="quiz-score-box"><span>⭐</span><b>${scoreStars}</b></div>
        </div>

        <section class="quiz-ref-card quiz-result-ref-card">
          <div class="quiz-ref-card-head">
            <div class="quiz-ref-topic"><span class="quiz-ref-topic-icon">${topic.icon}</span><b>${esc(topic.title)}</b></div>
            <span class="quiz-ref-subject-pill">${cfg.name} · Tahun 2</span>
          </div>

          <div class="quiz-result-celebrate">
            <div class="quiz-result-banner">${pct>=85?'🏆':pct>=65?'🌟':'💪'} <span>${passed?cfg.done:cfg.keep}</span></div>
            <p class="quiz-result-subcopy">${esc(activeChild.name)} ${isEnglish?'has completed':'telah menamatkan'} <b>${esc(topic.title)}</b>. ${completionCopy}</p>
          </div>

          <div class="quiz-reference-scene quiz-result-scene">
            <div class="scene-sky-cloud cloud-a"></div><div class="scene-sky-cloud cloud-b"></div>
            <div class="scene-bush bush-left"></div><div class="scene-bush bush-right"></div>
            <div class="scene-tree tree-left">🌳</div><div class="scene-tree tree-right">🌳</div>
            <div class="scene-animal teacher-animal">${animalMascotSvg(animals[0])}</div>
            <div class="scene-animal learner-animal">${animalMascotSvg(animals[1])}</div>
            <div class="scene-bird">${animalMascotSvg(animals[2])}</div>

            <div class="quiz-wood-board quiz-result-board">
              <div class="wood-board-inner">
                <span class="board-prompt-lead">${passed?(isEnglish?'Well done!':'Syabas!'):(isEnglish?'Keep trying!':'Teruskan latihan!')}</span>
                <strong class="board-prompt-focus">${scoreStars} / 15</strong>
                <span class="board-prompt-lead">${correctCount}/5 ${cfg.questionsDone.toLowerCase()}</span>
              </div>
              <span class="wood-board-leg left-leg"></span><span class="wood-board-leg right-leg"></span>
            </div>

            <div class="scene-learning-blocks quiz-result-blocks" aria-hidden="true">
              <span>${correctCount}</span><span>⭐</span>
            </div>
          </div>

          <div class="quiz-result-stats">
            <div class="quiz-result-stat">
              <span class="stat-icon">✅</span>
              <b>${correctCount}/5</b>
              <small>${cfg.questionsDone}</small>
            </div>
            <div class="quiz-result-stat">
              <span class="stat-icon">🎯</span>
              <b>${totalAttempts}</b>
              <small>${cfg.attempts}</small>
            </div>
            <div class="quiz-result-stat">
              <span class="stat-icon">⭐</span>
              <b>${pct}%</b>
              <small>${cfg.score}</small>
            </div>
          </div>

          <div class="quiz-result-tip-box">${masteryTip}</div>

          <div class="quiz-next-row ref-next-row quiz-result-actions">
            <button class="quiz-next-btn ready" id="quizAgain" type="button" aria-disabled="false">${cfg.again}<span>↺</span></button>
            <button class="quiz-next-btn secondary" id="quizTopics" type="button" aria-disabled="false">${cfg.topics}<span>☰</span></button>
          </div>
        </section>
      </main>
    </section>`;
    celebrate();

    try{
      await fb.addDoc(fb.collection(fb.db,'progress'),{
        ownerUid:fb.auth.currentUser.uid,
        childId:activeChild.id,
        module:cfg.module,
        activity:`${cfg.activity}${topicKey}`,
        level:1,year:2,subject:cfg.key,topic:topicKey,questions:5,
        correct:true,correctCount,attempts:totalAttempts,stars:scoreStars,passed,
        createdAt:fb.serverTimestamp()
      });
      toast(`⭐ Rekod ${topic.title} disimpan.`);
    }catch(e){
      console.error(e);
      toast('Latihan selesai, tetapi rekod kemajuan gagal disimpan.');
    }

    $('#quizAgain').onclick=()=>startYear2BmFullscreenQuiz(topicKey);
    $('#quizTopics').onclick=()=>{
      $('#gameModal').close();
      cfg.hub(p);
    };
  };

  renderQuestion();
}


function year1SubjectConfig(key){
  return {
    bm:{name:'Bahasa Melayu',short:'BM',icon:'🇲🇾',theme:'bm',bank:bmYear1Bank,activity:'kssr_bm_y1_',start:startBmYear1Topic,back:'Semua Subjek',kicker:'BAHASA MELAYU TAHUN 1',heading:'Pilih topik Bahasa Melayu',intro:'Pilih satu topik dan lengkapkan 5 soalan. Rekod terbaik digunakan untuk menunjukkan penguasaan.',startLabel:'Mula Latihan',againLabel:'Latih Lagi',notStarted:'Belum dimainkan',bestLabel:'Rekod terbaik'},
    bi:{name:'Bahasa Inggeris',short:'BI',icon:'🔤',theme:'bi',bank:biYear1Bank,activity:'kssr_bi_y1_',start:startBiYear1Topic,back:'Semua Subjek',kicker:'ENGLISH YEAR 1',heading:'Choose an English topic',intro:'Choose one topic and complete 5 questions. Your best score is used to show topic mastery.',startLabel:'Start Practice',againLabel:'Practise Again',notStarted:'Not attempted yet',bestLabel:'Best score'},
    math:{name:'Matematik',short:'MT',icon:'➗',theme:'math',bank:mathYear1Bank,activity:'kssr_math_y1_',start:startMathYear1Topic,back:'Semua Subjek',kicker:'MATEMATIK TAHUN 1',heading:'Pilih topik Matematik',intro:'Pilih satu topik dan lengkapkan 5 soalan. Rekod terbaik digunakan untuk menunjukkan penguasaan.',startLabel:'Mula Latihan',againLabel:'Latih Lagi',notStarted:'Belum dimainkan',bestLabel:'Rekod terbaik'},
    science:{name:'Sains',short:'SN',icon:'🔬',theme:'science',bank:scienceYear1Bank,activity:'kssr_science_y1_',start:startScienceYear1Topic,back:'Semua Subjek',kicker:'SAINS TAHUN 1',heading:'Pilih topik Sains',intro:'Pilih satu topik dan lengkapkan 5 soalan. Rekod terbaik digunakan untuk menunjukkan penguasaan.',startLabel:'Mula Latihan',againLabel:'Latih Lagi',notStarted:'Belum dimainkan',bestLabel:'Rekod terbaik'}
  }[key];
}

async function renderYear1SubjectHub(p,key){
  if(!fb?.auth.currentUser){showAuthPage('login');return;}
  if(p.role!=='user'){toast('Ruang pembelajaran hanya melalui akaun Penjaga.');return;}
  if(!subscriptionState(p).active){showDashboardPage();showSubscriptionGate(p,'count');return;}
  if(!activeChild){toast('Pilih profil anak dahulu.');return;}
  const year=Number(activeChild.year||Math.max(1,Number(activeChild.age||7)-6));
  if(year!==1){toast('Kandungan ini tersedia untuk murid Tahun 1.');return;}
  const cfg=year1SubjectConfig(key);
  if(!cfg)return;

  showStudentPage();
  const root=$('#dashboard'),rows=await loadProgress(p.uid,activeChild.id);
  const keys=Object.keys(cfg.bank);
  const bestFor=k=>{
    const vals=rows.filter(r=>r.activity===`${cfg.activity}${k}`).map(r=>Number(r.stars||0));
    return vals.length?Math.max(...vals):0;
  };
  const playedFor=k=>rows.filter(r=>r.activity===`${cfg.activity}${k}`).length;
  const completed=keys.filter(k=>bestFor(k)>=8).length;
  const totalBest=keys.reduce((n,k)=>n+bestFor(k),0);
  const progressPct=Math.round(completed/keys.length*100);

  root.innerHTML=`<section class="subject-hub-shell subject-${cfg.theme}">
    <header class="student-header interactive-header subject-app-header">
      <button class="student-back subject-back">← ${cfg.back}</button>
      <div class="student-brand"><span class="brand-badge">CG</span><b>CilikGo Pelajar</b></div>
      <div class="student-profile-wrap">
        <div class="subject-header-chip">${cfg.icon} ${esc(cfg.name)}</div>
        <div class="student-profile">${esc(activeChild.avatar||'🧒')} <span>${esc(activeChild.name)}</span><b>Tahun 1</b></div>
      </div>
    </header>

    <main class="subject-hub-main">
      <section class="subject-hero">
        <div class="subject-hero-icon">${cfg.icon}</div>
        <div class="subject-hero-copy">
          <span class="student-kicker">${cfg.kicker}</span>
          <h1>${esc(cfg.name)}</h1>
          <p>${cfg.intro}</p>
        </div>
        <div class="subject-hero-progress">
          <div class="subject-progress-ring" style="--subject-progress:${progressPct}"><span>${progressPct}%</span></div>
          <small>KEMAJUAN</small>
        </div>
      </section>

      <section class="subject-stat-row">
        <div class="subject-stat"><span>🏅</span><div><b>${completed}/${keys.length}</b><small>Topik dikuasai</small></div></div>
        <div class="subject-stat"><span>⭐</span><div><b>${totalBest}</b><small>Jumlah skor terbaik</small></div></div>
        <div class="subject-stat"><span>📝</span><div><b>${keys.reduce((n,k)=>n+playedFor(k),0)}</b><small>Sesi latihan</small></div></div>
      </section>

      <section class="subject-topic-section">
        <div class="subject-section-head">
          <div><span class="student-kicker">LATIHAN TOPIKAL</span><h2>${cfg.heading}</h2><p>${cfg.intro}</p></div>
          <div class="mastery-chip">⭐ Sasaran penguasaan 8/15</div>
        </div>
        <div class="subject-topic-grid">${keys.map((k,i)=>{
          const t=cfg.bank[k],best=bestFor(k),played=playedFor(k),mastered=best>=8;
          const pct=Math.round(best/15*100);
          return `<article class="subject-topic-card ${mastered?'mastered':''}">
            <div class="topic-card-head">
              <span class="topic-card-number">${String(i+1).padStart(2,'0')}</span>
              <span class="topic-card-icon">${t.icon}</span>
              <span class="topic-card-state ${mastered?'done':''}">${mastered?'✓ Dikuasai':played?'Sedang belajar':'Belum mula'}</span>
            </div>
            <div class="topic-card-copy"><small>TOPIK ${i+1}</small><h3>${esc(t.title)}</h3><p>${esc(t.desc)}</p></div>
            <div class="topic-card-progress">
              <div><span>${played?`${cfg.bestLabel}:`:'Status:'}</span><b>${played?`⭐ ${best}/15`:cfg.notStarted}</b></div>
              <div class="subject-progress-bar"><span style="width:${pct}%"></span></div>
            </div>
            <button class="subject-topic-btn" data-subject-topic="${k}">${played?cfg.againLabel:cfg.startLabel}<span>→</span></button>
          </article>`;
        }).join('')}</div>
      </section>

      <section class="subject-footer-note"><span>💡</span><p><b>Tip:</b> Buat satu topik pada satu masa. Pelajar boleh mencuba semula sehingga mendapat jawapan yang betul.</p></section>
    </main>
  </section>`;

  $('.subject-back').onclick=()=>renderStudentPortal(p);
  document.querySelectorAll('[data-subject-topic]').forEach(b=>b.onclick=()=>cfg.start(b.dataset.subjectTopic));
  animateIn(root);
}


function year2BmSubjectConfig(){
  return {name:'Bahasa Melayu',short:'BM',icon:'🇲🇾',theme:'bm',bank:bmYear2Bank,activity:'kssr_bm_y2_',start:startBmYear2Topic,back:'Semua Subjek',kicker:'BAHASA MELAYU TAHUN 2',heading:'Pilih topik Bahasa Melayu Tahun 2',intro:'Latihan Tahun 2 disusun mengikut kemahiran bahasa. Lengkapkan 5 soalan bagi setiap sesi.',startLabel:'Mula Latihan',againLabel:'Latih Lagi',notStarted:'Belum dimainkan',bestLabel:'Rekod terbaik'};
}

async function renderBmYear2Hub(p){
  if(!fb?.auth.currentUser){showAuthPage('login');return;}
  if(p.role!=='user'){toast('Ruang pembelajaran hanya melalui akaun Penjaga.');return;}
  if(!subscriptionState(p).active){showDashboardPage();showSubscriptionGate(p,'count');return;}
  if(!activeChild){toast('Pilih profil anak dahulu.');return;}
  const year=Number(activeChild.year||Math.max(1,Number(activeChild.age||7)-6));
  if(year!==2){toast('Kandungan ini tersedia untuk murid Tahun 2.');return;}
  const cfg=year2BmSubjectConfig();
  if(!cfg)return;

  showStudentPage();
  const root=$('#dashboard'),rows=await loadProgress(p.uid,activeChild.id);
  const keys=Object.keys(cfg.bank);
  const bestFor=k=>{
    const vals=rows.filter(r=>r.activity===`${cfg.activity}${k}`).map(r=>Number(r.stars||0));
    return vals.length?Math.max(...vals):0;
  };
  const playedFor=k=>rows.filter(r=>r.activity===`${cfg.activity}${k}`).length;
  const completed=keys.filter(k=>bestFor(k)>=8).length;
  const totalBest=keys.reduce((n,k)=>n+bestFor(k),0);
  const progressPct=Math.round(completed/keys.length*100);

  root.innerHTML=`<section class="subject-hub-shell subject-${cfg.theme}">
    <header class="student-header interactive-header subject-app-header">
      <button class="student-back subject-back">← ${cfg.back}</button>
      <div class="student-brand"><span class="brand-badge">CG</span><b>CilikGo Pelajar</b></div>
      <div class="student-profile-wrap">
        <div class="subject-header-chip">${cfg.icon} ${esc(cfg.name)}</div>
        <div class="student-profile">${esc(activeChild.avatar||'🧒')} <span>${esc(activeChild.name)}</span><b>Tahun 2</b></div>
      </div>
    </header>

    <main class="subject-hub-main">
      <section class="subject-hero">
        <div class="subject-hero-icon">${cfg.icon}</div>
        <div class="subject-hero-copy">
          <span class="student-kicker">${cfg.kicker}</span>
          <h1>${esc(cfg.name)}</h1>
          <p>${cfg.intro}</p>
        </div>
        <div class="subject-hero-progress">
          <div class="subject-progress-ring" style="--subject-progress:${progressPct}"><span>${progressPct}%</span></div>
          <small>KEMAJUAN</small>
        </div>
      </section>

      <section class="subject-stat-row">
        <div class="subject-stat"><span>🏅</span><div><b>${completed}/${keys.length}</b><small>Topik dikuasai</small></div></div>
        <div class="subject-stat"><span>⭐</span><div><b>${totalBest}</b><small>Jumlah skor terbaik</small></div></div>
        <div class="subject-stat"><span>📝</span><div><b>${keys.reduce((n,k)=>n+playedFor(k),0)}</b><small>Sesi latihan</small></div></div>
      </section>

      <section class="subject-topic-section">
        <div class="subject-section-head">
          <div><span class="student-kicker">LATIHAN TOPIKAL</span><h2>${cfg.heading}</h2><p>${cfg.intro}</p></div>
          <div class="mastery-chip">⭐ Sasaran penguasaan 8/15</div>
        </div>
        <div class="subject-topic-grid">${keys.map((k,i)=>{
          const t=cfg.bank[k],best=bestFor(k),played=playedFor(k),mastered=best>=8;
          const pct=Math.round(best/15*100);
          return `<article class="subject-topic-card ${mastered?'mastered':''}">
            <div class="topic-card-head">
              <span class="topic-card-number">${String(i+1).padStart(2,'0')}</span>
              <span class="topic-card-icon">${t.icon}</span>
              <span class="topic-card-state ${mastered?'done':''}">${mastered?'✓ Dikuasai':played?'Sedang belajar':'Belum mula'}</span>
            </div>
            <div class="topic-card-copy"><small>TOPIK ${i+1}</small><h3>${esc(t.title)}</h3><p>${esc(t.desc)}</p></div>
            <div class="topic-card-progress">
              <div><span>${played?`${cfg.bestLabel}:`:'Status:'}</span><b>${played?`⭐ ${best}/15`:cfg.notStarted}</b></div>
              <div class="subject-progress-bar"><span style="width:${pct}%"></span></div>
            </div>
            <button class="subject-topic-btn" data-subject-topic="${k}">${played?cfg.againLabel:cfg.startLabel}<span>→</span></button>
          </article>`;
        }).join('')}</div>
      </section>

      <section class="subject-footer-note"><span>💡</span><p><b>Tip:</b> Buat satu topik pada satu masa. Pelajar boleh mencuba semula sehingga mendapat jawapan yang betul.</p></section>
    </main>
  </section>`;

  $('.subject-back').onclick=()=>renderStudentPortal(p);
  document.querySelectorAll('[data-subject-topic]').forEach(b=>b.onclick=()=>cfg.start(b.dataset.subjectTopic));
  animateIn(root);
}


async function startBmYear2Topic(topicKey){ return startYear2BmFullscreenQuiz(topicKey); }

async function renderScienceYear1Hub(p){ return renderYear1SubjectHub(p,'science'); }

async function startScienceYear1Topic(topicKey){ return startYear1FullscreenQuiz('science',topicKey); }

async function renderBiYear1Hub(p){ return renderYear1SubjectHub(p,'bi'); }

async function startBiYear1Topic(topicKey){ return startYear1FullscreenQuiz('bi',topicKey); }

async function renderBmYear1Hub(p){ return renderYear1SubjectHub(p,'bm'); }

async function startBmYear1Topic(topicKey){ return startYear1FullscreenQuiz('bm',topicKey); }

async function renderMathYear1Hub(p){ return renderYear1SubjectHub(p,'math'); }

async function startMathYear1Topic(topicKey){ return startYear1FullscreenQuiz('math',topicKey); }

async function renderUser(p){
  setRoleNav(false);
  document.body.classList.remove('student-mode');
  showDashboardPage();
  const kids=await loadChildren(p.uid);
  const allProgress=await loadAllProgress(p.uid);
  const progress=allProgress.filter(r=>Number(r.year)>=1&&r.subject);
  if(!activeChild&&kids.length) activeChild=kids[0];
  const sub=subscriptionState(p), active=sub.active, daysLeft=subscriptionDaysLeft(p);
  const selected=activeChild?progress.filter(x=>x.childId===activeChild.id):[];
  const totalStars=selected.reduce((s,x)=>s+Number(x.stars||0),0);
  const subjectMeta=[
    ['bm','Bahasa Melayu','🇲🇾'],['bi','Bahasa Inggeris','🔤'],['math','Matematik','➗'],['science','Sains','🔬']
  ];
  const subjectCard=([key,name,icon])=>{
    const rows=selected.filter(r=>r.subject===key);
    const byTopic={};
    rows.forEach(r=>byTopic[r.topic]=Math.max(byTopic[r.topic]||0,Number(r.stars||0)));
    const mastered=Object.values(byTopic).filter(v=>v>=8).length;
    return `<div class="parent-subject-mini"><span>${icon}</span><div><b>${name}</b><small>${rows.length?`${mastered}/6 topik dikuasai`:'Belum mula'}</small></div><strong>${rows.length?`⭐ ${Math.max(...rows.map(r=>Number(r.stars||0)))}/15`:'—'}</strong></div>`;
  };
  const childCards=kids.map(c=>{
    const cp=progress.filter(x=>x.childId===c.id);
    const st=cp.reduce((n,x)=>n+Number(x.stars||0),0);
    const year=esc(c.year||Math.max(1,Number(c.age||7)-6));
    const genderLabel=c.gender==='female'?'Perempuan':c.gender==='male'?'Lelaki':'';
    return `<button class="child-card compact ${activeChild?.id===c.id?'selected':''}" data-child="${c.id}">
      <span>${esc(c.avatar||'🧒')}</span><b>${esc(c.name)}</b><small>Tahun ${year}${genderLabel?` · ${genderLabel}`:''} · ⭐ ${st}</small>
    </button>`;
  }).join('');

  $('#dashboard').innerHTML=`<div class="dash-shell parent-shell clean-shell">
    <aside class="dash-side clean-side role-drawer">
      <button class="role-nav-close" type="button" aria-label="Tutup menu">×</button>
      <div class="side-role"><span>👨‍👩‍👧</span><div><small>PORTAL</small><h3>Penjaga</h3></div></div>
      <nav class="parent-role-menu">
        <a class="active" data-parent-view="overview">⌂ <span>Utama</span></a>
        <a href="#report-card" id="parentReportCardLink">📊 <span>Report Kad</span></a>
        <a href="#" id="enterStudentNav">🎒 <span>Ruang Pelajar</span></a>
        <a href="#" id="parentSubscriptionLink">💳 <span>Langganan</span></a>
        <a href="#settings" id="parentSettingsLink">⚙️ <span>Tetapan</span></a>
      </nav>
      <div class="side-foot"><small>Akaun</small><b>${esc(p.name||p.email||'Penjaga')}</b></div>
    </aside>
    <section class="dash-main clean-main">
      <div class="clean-dash-head"><div><span class="dash-kicker">DASHBOARD PENJAGA</span><h1>Selamat datang, ${esc(p.name||'Penjaga')} 👋</h1><p>Pilih profil anak dan masuk terus ke Ruang Pelajar.</p></div><span class="subscription-chip ${active?'active':''}">${active?`✓ Aktif · ${daysLeft} hari`:'Langganan belum aktif'}</span></div>
      <div class="clean-section-head"><div><h2>Profil Pelajar</h2><p>Pilih anak yang ingin menggunakan CilikGo.</p></div><button class="btn ghost small" id="addChildBtn">+ Tambah Anak</button></div>
      <div class="child-list compact-list">${childCards||'<div class="empty-state compact-empty">Belum ada profil anak. Tambah profil untuk bermula.</div>'}</div>
      ${activeChild?`<div class="parent-focus-card">
        <div class="focus-profile"><span class="focus-avatar">${esc(activeChild.avatar||'🧒')}</span><div><small>PELAJAR DIPILIH</small><h2>${esc(activeChild.name)}</h2><p>Tahun ${esc(activeChild.year||Math.max(1,Number(activeChild.age||7)-6))}${activeChild.gender?` · ${activeChild.gender==='female'?'Perempuan':'Lelaki'}`:''}</p></div></div>
        <button class="student-launch" id="enterStudentBtn"><span>🎒</span><div><small>BUKA PAPARAN PELAJAR</small><b>Masuk Ruang Belajar</b></div><strong>→</strong></button>
      </div>
      <div class="parent-subject-row">${subjectMeta.map(subjectCard).join('')}</div>`:
      `<div class="parent-focus-card empty-focus"><div><h2>Tambah profil anak dahulu</h2><p>Selepas profil ditambah, butang Ruang Pelajar akan muncul di sini.</p></div><button class="btn primary" id="emptyAddChild">Tambah Profil</button></div>`}
    </section>
  </div>`;

  const openChild=()=>{setRoleNav(false);prepareChildModal(null);};
  $('#addChildBtn')?.addEventListener('click',openChild);
  $('#emptyAddChild')?.addEventListener('click',openChild);
  const enterStudent=async e=>{
    e?.preventDefault();
    setRoleNav(false);
    if(!activeChild)return toast('Pilih profil anak dahulu.');
    if(!active)return showSubscriptionGate(p,'count');
    await renderStudentPortal(p);
  };
  $('#enterStudentBtn')?.addEventListener('click',enterStudent);
  $('#enterStudentNav')?.addEventListener('click',enterStudent);
  $('#parentReportCardLink')?.addEventListener('click',e=>{e.preventDefault();setRoleNav(false);history.pushState(null,'','#report-card');renderParentReportCard(p);});
  $('#parentSettingsLink')?.addEventListener('click',e=>{e.preventDefault();setRoleNav(false);history.pushState(null,'','#settings');renderParentSettingsView(p);});
  document.querySelector('[data-parent-view="overview"]')?.addEventListener('click',e=>{e.preventDefault();setRoleNav(false);});
  animateIn($('#dashboard'));
  document.querySelectorAll('[data-child]').forEach(b=>b.onclick=async()=>{
    const selectedChild=kids.find(c=>c.id===b.dataset.child);
    if(!selectedChild)return;
    activeChild=selectedChild;
    localStorage.setItem('cilikgo_active_child',selectedChild.id);
    await renderUser(p);
  });

}


async function renderParentReportCard(p){
  setRoleNav(false);
  document.body.classList.remove('student-mode');
  showDashboardPage();

  const kids=await loadChildren(p.uid);
  const allProgress=await loadAllProgress(p.uid);
  const progress=allProgress.filter(r=>Number(r.year)>=1&&r.subject);
  if(!activeChild&&kids.length) activeChild=kids[0];

  const selected=activeChild?progress.filter(r=>r.childId===activeChild.id):[];
  const totalStars=selected.reduce((n,r)=>n+Number(r.stars||0),0);
  const subjectMeta=[
    ['bm','Bahasa Melayu','🇲🇾'],
    ['bi','Bahasa Inggeris','🔤'],
    ['math','Matematik','➗'],
    ['science','Sains','🔬']
  ];

  const subjectRows=subjectMeta.map(([key,name,icon])=>{
    const rows=selected.filter(r=>r.subject===key);
    const bestByTopic={};
    rows.forEach(r=>{
      const topic=r.topic||'topik';
      bestByTopic[topic]=Math.max(bestByTopic[topic]||0,Number(r.stars||0));
    });
    const mastered=Object.values(bestByTopic).filter(v=>v>=8).length;
    const best=rows.length?Math.max(...rows.map(r=>Number(r.stars||0))):0;
    const stars=rows.reduce((n,r)=>n+Number(r.stars||0),0);
    return `<article class="report-subject-card">
      <span class="report-subject-icon">${icon}</span>
      <div><small>SUBJEK</small><h3>${name}</h3><p>${rows.length?`${rows.length} sesi · ${mastered}/6 topik dikuasai`:'Belum ada latihan direkodkan'}</p></div>
      <div class="report-subject-score"><b>${best?`⭐ ${best}/15`:'—'}</b><small>${stars} jumlah bintang</small></div>
    </article>`;
  }).join('');

  const childSelector=kids.map(c=>{
    const year=Number(c.year||Math.max(1,Number(c.age||7)-6));
    return `<button class="report-child-chip ${activeChild?.id===c.id?'active':''}" data-report-child="${c.id}">
      <span>${esc(c.avatar||'🧒')}</span><div><b>${esc(c.name||'-')}</b><small>Tahun ${year}</small></div>
    </button>`;
  }).join('');

  $('#dashboard').innerHTML=`<div class="dash-shell parent-shell clean-shell">
    <aside class="dash-side clean-side role-drawer">
      <button class="role-nav-close" type="button" aria-label="Tutup menu">×</button>
      <div class="side-role"><span>👨‍👩‍👧</span><div><small>PORTAL</small><h3>Penjaga</h3></div></div>
      <nav class="parent-role-menu">
        <a href="#dashboard" id="reportOverviewLink">⌂ <span>Utama</span></a>
        <a class="active" href="#report-card">📊 <span>Report Kad</span></a>
        <a href="#student" id="reportStudentLink">🎒 <span>Ruang Pelajar</span></a>
        <a href="#" id="reportSubscriptionLink">💳 <span>Langganan</span></a>
        <a href="#settings" id="reportSettingsLink">⚙️ <span>Tetapan</span></a>
      </nav>
      <div class="side-foot"><small>Akaun</small><b>${esc(p.name||p.email||'Penjaga')}</b></div>
    </aside>

    <section class="dash-main clean-main">
      <div class="clean-dash-head report-page-head">
        <div><span class="dash-kicker">REPORT KAD</span><h1>Prestasi Pelajar</h1><p>Lihat ringkasan penggunaan dan prestasi pembelajaran pelajar yang dipilih.</p></div>
      </div>

      ${kids.length?`
        <div class="report-child-selector">${childSelector}</div>

        <div class="report-student-hero">
          <div class="report-student-profile"><span>${esc(activeChild?.avatar||'🧒')}</span><div><small>PELAJAR DIPILIH</small><h2>${esc(activeChild?.name||'-')}</h2><p>Tahun ${Number(activeChild?.year||Math.max(1,Number(activeChild?.age||7)-6))}${activeChild?.gender?` · ${activeChild.gender==='female'?'Perempuan':'Lelaki'}`:''}</p></div></div>
          <span class="report-status-badge">${selected.length?'Aktif belajar':'Belum mula'}</span>
        </div>

        <div class="parent-quick-grid report-quick-grid">
          <div class="quick-stat"><span>👧</span><div><b>${kids.length}</b><small>Profil pelajar</small></div></div>
          <div class="quick-stat"><span>⭐</span><div><b>${totalStars}</b><small>Bintang anak dipilih</small></div></div>
          <div class="quick-stat"><span>📝</span><div><b>${selected.length}</b><small>Sesi direkodkan</small></div></div>
        </div>

        <div class="report-section-head"><div><small>PRESTASI SUBJEK</small><h2>Ringkasan mengikut subjek</h2></div></div>
        <div class="report-subject-grid">${subjectRows}</div>
      `:`<div class="empty-state settings-empty"><h3>Belum ada profil pelajar</h3><p>Tambah profil terlebih dahulu untuk melihat Report Kad.</p><button class="btn primary" id="reportAddProfile">Tambah Profil</button></div>`}
    </section>
  </div>`;

  $('#reportOverviewLink')?.addEventListener('click',e=>{e.preventDefault();history.pushState(null,'','#dashboard');renderUser(p);});
  $('#reportStudentLink')?.addEventListener('click',e=>{e.preventDefault();renderStudentPortal(p);});
  $('#reportSubscriptionLink')?.addEventListener('click',e=>{e.preventDefault();renderParentSubscriptionView(p);});
  $('#reportSettingsLink')?.addEventListener('click',e=>{e.preventDefault();history.pushState(null,'','#settings');renderParentSettingsView(p);});
  $('#reportAddProfile')?.addEventListener('click',()=>prepareChildModal(null));

  document.querySelectorAll('[data-report-child]').forEach(btn=>btn.onclick=async()=>{
    const child=kids.find(c=>c.id===btn.dataset.reportChild);
    if(!child)return;
    activeChild=child;
    localStorage.setItem('cilikgo_active_child',child.id);
    await renderParentReportCard(p);
  });

  animateIn($('#dashboard'));
}

async function renderParentSettingsView(p){
  setRoleNav(false);
  document.body.classList.remove('student-mode');
  showDashboardPage();

  const kids=await loadChildren(p.uid);
  const allProgress=await loadAllProgress(p.uid);
  const progress=allProgress.filter(r=>Number(r.year)>=1&&r.subject);

  const profileRows=kids.map(c=>{
    const rows=progress.filter(r=>r.childId===c.id);
    const stars=rows.reduce((n,r)=>n+Number(r.stars||0),0);
    const year=Number(c.year||Math.max(1,Number(c.age||7)-6));
    const gender=c.gender==='female'?'Perempuan':c.gender==='male'?'Lelaki':'Belum ditetapkan';
    return `<article class="settings-profile-card">
      <div class="settings-profile-avatar">${esc(c.avatar||'🧒')}</div>
      <div class="settings-profile-copy"><small>PROFIL PELAJAR</small><h3>${esc(c.name||'-')}</h3><p>Tahun ${year} · ${gender} · ⭐ ${stars}</p></div>
      <div class="settings-profile-actions">
        <button class="btn ghost small edit-profile-btn" data-edit-child="${c.id}">✏️ Edit</button>
        <button class="btn danger small settings-delete-btn" data-delete-child="${c.id}">🗑️ Padam</button>
      </div>
    </article>`;
  }).join('');

  $('#dashboard').innerHTML=`<div class="dash-shell parent-shell clean-shell">
    <aside class="dash-side clean-side role-drawer">
      <button class="role-nav-close" type="button" aria-label="Tutup menu">×</button>
      <div class="side-role"><span>👨‍👩‍👧</span><div><small>PORTAL</small><h3>Penjaga</h3></div></div>
      <nav class="parent-role-menu">
        <a href="#dashboard" id="settingsOverviewLink">⌂ <span>Utama</span></a>
        <a href="#report-card" id="settingsReportCardLink">📊 <span>Report Kad</span></a>
        <a href="#student" id="settingsStudentLink">🎒 <span>Ruang Pelajar</span></a>
        <a href="#" id="settingsSubscriptionLink">💳 <span>Langganan</span></a>
        <a class="active" href="#settings">⚙️ <span>Tetapan</span></a>
      </nav>
      <div class="side-foot"><small>Akaun</small><b>${esc(p.name||p.email||'Penjaga')}</b></div>
    </aside>
    <section class="dash-main clean-main">
      <div class="clean-dash-head settings-page-head">
        <div><span class="dash-kicker">TETAPAN PENJAGA</span><h1>Urus Profil Pelajar</h1><p>Edit maklumat atau padam profil pelajar dari satu tempat.</p></div>
        <button class="btn primary small" id="settingsAddProfile">+ Tambah Profil</button>
      </div>
      <div class="settings-info-card"><span>⚙️</span><div><b>Pengurusan profil</b><p>Perubahan nama, jantina, tahun dan avatar boleh dibuat di sini. Memadam profil akan turut memadam rekod latihan profil tersebut.</p></div></div>
      <div class="settings-profile-list">${profileRows||`<div class="empty-state settings-empty"><h3>Belum ada profil pelajar</h3><p>Tambah profil pertama untuk membuka Ruang Pelajar.</p><button class="btn primary" id="settingsEmptyAdd">Tambah Profil</button></div>`}</div>
    </section>
  </div>`;

  $('#settingsOverviewLink')?.addEventListener('click',e=>{e.preventDefault();history.pushState(null,'','#dashboard');renderUser(p);});
  $('#settingsReportCardLink')?.addEventListener('click',e=>{e.preventDefault();history.pushState(null,'','#report-card');renderParentReportCard(p);});
  $('#settingsStudentLink')?.addEventListener('click',e=>{e.preventDefault();renderStudentPortal(p);});
  $('#settingsSubscriptionLink')?.addEventListener('click',e=>{e.preventDefault();renderParentSubscriptionView(p);});
  $('#settingsAddProfile')?.addEventListener('click',()=>prepareChildModal(null));
  $('#settingsEmptyAdd')?.addEventListener('click',()=>prepareChildModal(null));

  document.querySelectorAll('[data-edit-child]').forEach(btn=>btn.onclick=()=>{
    const child=kids.find(c=>c.id===btn.dataset.editChild);
    if(child) prepareChildModal(child);
  });
  document.querySelectorAll('[data-delete-child]').forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.deleteChild;
    setButtonLoading(btn,true,'Memadam…');
    const ok=await deleteStudentProfile(p,id);
    if(ok) await renderParentSettingsView(p);
    else setButtonLoading(btn,false);
  });
  animateIn($('#dashboard'));
}

async function renderAgent(p){
  setRoleNav(false);
  document.body.classList.remove('student-mode'); showDashboardPage();
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

  const agentNav=[
    ['overview','⌂','Ringkasan'],
    ['referrals','👥','Referral'],
    ['sales','🧾','Jualan'],
    ['commission','💰','Komisen'],
    ['settings','⚙️','Tetapan']
  ];
  $('#dashboard').innerHTML=`<div class="dash-shell agent-shell portal-shell">
    <aside class="dash-side portal-side role-drawer">
      <button class="role-nav-close" type="button" aria-label="Tutup menu">×</button>
      <div class="portal-role"><span>🤝</span><div><small>PORTAL</small><h3>Agent</h3></div></div>
      <nav class="portal-menu">${agentNav.map(([k,i,l])=>`<a class="agent-nav ${k==='overview'?'active':''}" data-view="${k}"><span class="portal-menu-icon">${i}</span><span class="portal-menu-label">${l}</span></a>`).join('')}</nav>
      <div class="portal-side-foot"><small>Kod Agent</small><b>${esc(code||'-')}</b></div>
    </aside>
    <section class="dash-main portal-main"><div id="agentView"></div></section>
  </div>`;

  const views={
    overview:()=>`<div class="dash-head portal-page-head"><div><small>Selamat datang, Agent</small><h2>${esc(p.name||p.email)} 👋</h2></div><span class="badge">Agent</span></div>
      <div class="agent-link-card"><div><small>Link referral unik anda</small><h3>Kongsi CilikGo dan bina rangkaian anda</h3><div class="copy-row"><input id="agentRefUrl" readonly value="${esc(refUrl)}"><button class="btn primary" id="copyAgentLink">Salin Link</button></div><p>Kod Agent: <b>${esc(code||'-')}</b></p></div><span class="agent-link-icon">🔗</span></div>
      <div class="agent-stat-grid"><div class="stat"><small>Pendaftaran referral</small><b>${referrals.length}</b></div><div class="stat"><small>Pembelian berjaya</small><b>${paidOrders.length}</b></div><div class="stat"><small>Conversion</small><b>${conversion}%</b></div><div class="stat"><small>Nilai jualan</small><b>RM${sales.toFixed(2)}</b></div><div class="stat"><small>Komisen pending</small><b>RM${pending.toFixed(2)}</b></div><div class="stat"><small>Komisen dibayar</small><b>RM${paidCommission.toFixed(2)}</b></div></div>
      <div class="agent-info-grid"><div class="recommend-card"><span class="recommend-icon">📣</span><div><small>Cara guna</small><h3>Kongsi link referral anda</h3><p>Apabila Penjaga membuka link anda dan mendaftar, kod Agent akan direkodkan pada akaun tersebut.</p></div></div><div class="strength-card"><small>Status pembayaran</small><h3>ToyyibPay masih KIV</h3><p>Pendaftaran referral sudah boleh direkod. Statistik jualan dan komisen sebenar akan mula bertambah selepas payment gateway diaktifkan.</p></div></div>`,
    referrals:()=>`<div class="dash-head portal-page-head"><div><small>Affiliate network</small><h2>Senarai Referral</h2></div><span class="badge">${referrals.length} Penjaga</span></div><div class="agent-toolbar"><input id="agentSearch" placeholder="Cari nama atau e-mel…"><span>${referrals.length} pendaftaran</span></div><div id="referralTable">${referralRows}</div>`,
    sales:()=>`<div class="dash-head portal-page-head"><div><small>Prestasi jualan</small><h2>Jualan Referral</h2></div><span class="badge">RM${sales.toFixed(2)}</span></div><div class="agent-stat-grid compact"><div class="stat"><small>Jumlah order</small><b>${myOrders.length}</b></div><div class="stat"><small>Berjaya</small><b>${paidOrders.length}</b></div><div class="stat"><small>Conversion</small><b>${conversion}%</b></div></div>${myOrders.length?`<div class="table-wrap"><table class="table"><tr><th>Order</th><th>Pelan</th><th>Nilai</th><th>Status</th></tr>${[...myOrders].reverse().map(o=>`<tr><td><code>${esc(o.id)}</code></td><td>${esc(o.plan||'-')}</td><td>RM${Number(o.amount||0).toFixed(2)}</td><td>${status(o.status)}</td></tr>`).join('')}</table></div>`:'<div class="empty-state">Belum ada jualan. ToyyibPay masih KIV.</div>'}`,
    commission:()=>`<div class="dash-head portal-page-head"><div><small>Pendapatan affiliate</small><h2>Komisen</h2><p>Pantau jumlah komisen daripada jualan referral anda.</p></div><span class="badge">RM${totalCommission.toFixed(2)}</span></div><div class="agent-stat-grid compact"><div class="stat"><small>Jumlah komisen</small><b>RM${totalCommission.toFixed(2)}</b></div><div class="stat"><small>Pending</small><b>RM${pending.toFixed(2)}</b></div><div class="stat"><small>Dibayar</small><b>RM${paidCommission.toFixed(2)}</b></div></div>${commissionRows}`,
    settings:()=>`<div class="dash-head portal-page-head"><div><small>Akaun Agent</small><h2>Tetapan</h2><p>Maklumat asas akaun dan pautan referral anda.</p></div><span class="badge">Agent</span></div>
      <div class="portal-settings-grid">
        <div class="portal-setting-card"><span>👤</span><div><small>NAMA AGENT</small><b>${esc(p.name||'-')}</b><p>${esc(p.email||'-')}</p></div></div>
        <div class="portal-setting-card"><span>🔑</span><div><small>KOD AGENT</small><b>${esc(code||'-')}</b><p>Kod ini digunakan untuk merekod referral.</p></div></div>
        <div class="portal-setting-card wide"><span>🔗</span><div><small>PAUTAN REFERRAL</small><b class="break-text">${esc(refUrl)}</b><p>Kongsi pautan ini kepada Penjaga yang ingin mendaftar CilikGo.</p><button class="btn primary small" id="copyAgentSettingsLink">Salin Pautan</button></div></div>
      </div>
      <div class="dash-note">🔒 Kata laluan dan keselamatan akaun diurus melalui Firebase Authentication. Maklumat sensitif tidak dipaparkan di dashboard.</div>`
  };

  const copyReferral=async()=>{
    try{await navigator.clipboard.writeText(refUrl);toast('Link referral berjaya disalin.');}
    catch(e){
      const input=$('#agentRefUrl');
      if(input){input.select();document.execCommand('copy');toast('Link referral berjaya disalin.');}
      else toast('Salin pautan secara manual: '+refUrl);
    }
  };
  const mount=view=>{
    const selected=views[view]?view:'overview';
    $('#agentView').innerHTML=views[selected]();
    document.querySelectorAll('.agent-nav').forEach(a=>a.classList.toggle('active',a.dataset.view===selected));
    const main=$('.agent-shell .portal-main'); if(main) main.scrollTop=0;
    animateIn($('#agentView'));
    if($('#copyAgentLink')) $('#copyAgentLink').onclick=copyReferral;
    if($('#copyAgentSettingsLink')) $('#copyAgentSettingsLink').onclick=copyReferral;
    if($('#agentSearch')) $('#agentSearch').oninput=()=>{
      const q=$('#agentSearch').value.toLowerCase();
      const list=referrals.filter(u=>(u.name||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q));
      $('#referralTable').innerHTML=list.length?`<div class="table-wrap"><table class="table"><tr><th>Penjaga</th><th>E-mel</th><th>Langganan</th></tr>${list.map(u=>`<tr><td>${esc(u.name||'-')}</td><td>${esc(u.email||'-')}</td><td>${status(u.subscriptionStatus||'inactive')}</td></tr>`).join('')}</table></div>`:'<div class="empty-state">Tiada referral sepadan.</div>';
    };
  };
  document.querySelectorAll('.agent-nav').forEach(a=>a.onclick=()=>{setRoleNav(false);mount(a.dataset.view);});
  mount('overview');
}

async function renderAdminSubscriptions(){
  const root=$('#adminContent')||$('.admin-shell .portal-main');
  root.innerHTML=`<div class="dash-head portal-page-head"><div><small>Pengurusan akses Penjaga</small><h2>Langganan</h2></div><span class="badge">Admin</span></div><div class="loading-skeleton" style="height:90px"></div>`;
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
    root.innerHTML=`<div class="dash-head portal-page-head"><div><small>Pengurusan akses Penjaga</small><h2>Langganan</h2></div><span class="badge">${rows.length} Penjaga</span></div>
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
  setRoleNav(false);
  document.body.classList.remove('student-mode'); showDashboardPage();
  const safeDocs=async(name)=>{
    try{return (await fb.getDocs(fb.collection(fb.db,name))).docs.map(d=>({id:d.id,...d.data()}));}
    catch(e){console.warn(name,e);return [];}
  };
  const [users,children,allProgress,orders,commissions]=await Promise.all([
    safeDocs('users'),safeDocs('children'),safeDocs('progress'),safeDocs('orders'),safeDocs('commissions')
  ]);
  const progress=allProgress.filter(r=>Number(r.year)>=1&&r.subject);
  const agents=users.filter(u=>u.role==='agent'), customers=users.filter(u=>u.role==='user');
  const activeSubs=customers.filter(u=>u.subscriptionStatus==='active');
  const paidOrders=orders.filter(o=>o.status==='paid');
  const sales=paidOrders.reduce((s,o)=>s+Number(o.amount||0),0);
  const commissionTotal=commissions.reduce((s,c)=>s+Number(c.amount||0),0);
  const totalStars=progress.reduce((s,x)=>s+Number(x.stars||0),0);

  const adminNav=[
    ['overview','⌂','Ringkasan'],
    ['users','👨‍👩‍👧','Penjaga'],
    ['agents','🤝','Agent'],
    ['children','🎒','Pelajar'],
    ['learning','📊','Pembelajaran'],
    ['subscriptions','💳','Langganan'],
    ['transactions','🧾','Transaksi'],
    ['commissions','💰','Komisen'],
    ['content','🗂️','Kandungan'],
    ['settings','⚙️','Tetapan']
  ];
  const shell=(view,body)=>`<div class="dash-shell admin-shell portal-shell">
    <aside class="dash-side portal-side role-drawer">
      <button class="role-nav-close" type="button" aria-label="Tutup menu">×</button>
      <div class="portal-role"><span>🛡️</span><div><small>CONTROL CENTER</small><h3>Admin</h3></div></div>
      <nav class="portal-menu">${adminNav.map(([k,i,l])=>`<a class="admin-nav ${view===k?'active':''}" data-view="${k}"><span class="portal-menu-icon">${i}</span><span class="portal-menu-label">${l}</span></a>`).join('')}</nav>
      <div class="portal-side-foot"><small>Sistem</small><b>CilikGo Admin</b></div>
    </aside>
    <section class="dash-main portal-main"><div id="adminContent">${body}</div></section>
  </div>`;

  const head=(title,sub='CilikGo Control Center')=>`<div class="dash-head portal-page-head"><div><small>${sub}</small><h2>${title}</h2></div><span class="badge">Admin</span></div>`;
  const empty=t=>`<div class="empty-state">${t}</div>`;
  const statusBadge=s=>`<span class="badge ${s==='inactive'||s==='failed'?'status-inactive':''}">${esc(s||'-')}</span>`;

  const views={
    overview:()=>`${head('Overview')}<div class="admin-stat-grid">
      <div class="stat"><small>Penjaga</small><b>${customers.length}</b></div><div class="stat"><small>Agent</small><b>${agents.length}</b></div>
      <div class="stat"><small>Profil pelajar</small><b>${children.length}</b></div><div class="stat"><small>Langganan aktif</small><b>${activeSubs.length}</b></div>
      <div class="stat"><small>Jualan dibayar</small><b>RM${sales.toFixed(2)}</b></div><div class="stat"><small>⭐ Dikumpul</small><b>${totalStars}</b></div>
      </div><div class="admin-two-col"><div><h3>Akaun terkini</h3>${users.length?`<div class="table-wrap"><table class="table"><tr><th>Nama</th><th>Role</th><th>Status</th></tr>${users.slice(-8).reverse().map(u=>`<tr><td>${esc(u.name||u.email||'-')}</td><td>${statusBadge(u.role)}</td><td>${statusBadge(u.subscriptionStatus||'n/a')}</td></tr>`).join('')}</table></div>`:empty('Tiada akaun.')}</div>
      <div><h3>Ringkasan sistem</h3><div class="admin-summary"><p><b>${orders.length}</b> rekod transaksi</p><p><b>${commissions.length}</b> rekod komisen</p><p><b>RM${commissionTotal.toFixed(2)}</b> jumlah komisen</p><p><b>${progress.length}</b> rekod pembelajaran</p></div></div></div>`,

    users:()=>`${head('User / Penjaga','Pengurusan akaun')}<div class="admin-toolbar"><input id="adminSearch" placeholder="Cari nama atau e-mel…"><span>${customers.length} akaun</span></div><div id="adminUserTable">${renderUserRows(customers)}</div>`,

    agents:()=>`${head('Agent','Pengurusan affiliate')}<div class="admin-toolbar"><input id="adminSearch" placeholder="Cari nama, e-mel atau kod…"><span>${agents.length} agent</span></div><div id="adminAgentTable">${renderAgentRows(agents)}</div>`,

    children:()=>`${head('Profil Pelajar','Pemantauan profil pembelajaran')}<div class="stat-grid"><div class="stat"><small>Jumlah profil</small><b>${children.length}</b></div><div class="stat"><small>Tahun 1</small><b>${children.filter(c=>Number(c.year||Math.max(1,Number(c.age||7)-6))===1).length}</b></div><div class="stat"><small>Tahun 2–6</small><b>${children.filter(c=>Number(c.year||Math.max(1,Number(c.age||7)-6))>=2).length}</b></div></div>${children.length?`<div class="table-wrap"><table class="table"><tr><th>Pelajar</th><th>Tahun</th><th>Penjaga</th><th>⭐</th></tr>${children.map(c=>{const owner=users.find(u=>u.id===c.ownerUid);const stars=progress.filter(x=>x.childId===c.id).reduce((s,x)=>s+Number(x.stars||0),0);const year=Number(c.year||Math.max(1,Number(c.age||7)-6));return `<tr><td>${esc(c.avatar||'🧒')} ${esc(c.name||'-')}</td><td>Tahun ${year}</td><td>${esc(owner?.name||owner?.email||'-')}</td><td>${stars}</td></tr>`}).join('')}</table></div>`:empty('Belum ada profil pelajar.')}`,

    learning:()=>{
      const subjectDefs=[['bm','Bahasa Melayu','🇲🇾'],['bi','Bahasa Inggeris','🔤'],['math','Matematik','➗'],['science','Sains','🔬']];
      const cards=subjectDefs.map(([k,n,i])=>{const r=progress.filter(x=>x.subject===k);return `<div class="stat"><small>${i} ${n}</small><b>${r.reduce((s,x)=>s+Number(x.stars||0),0)} ⭐</b><span>${r.length} sesi</span></div>`}).join('');
      return `${head('Prestasi Pembelajaran','Analitik Tahun 1–2 dan rekod pembelajaran')}<div class="admin-stat-grid subject-admin-stats">${cards}</div>${progress.length?`<div class="table-wrap"><table class="table"><tr><th>Pelajar</th><th>Subjek</th><th>Topik</th><th>⭐</th><th>Percubaan</th></tr>${progress.slice(-30).reverse().map(x=>{const child=children.find(c=>c.id===x.childId);return `<tr><td>${esc(child?.name||'-')}</td><td>${esc(({bm:'Bahasa Melayu',bi:'Bahasa Inggeris',math:'Matematik',science:'Sains'})[x.subject]||x.subject||'-')}</td><td>${esc(x.topic||'-')}</td><td>${Number(x.stars||0)}</td><td>${Number(x.attempts||0)}</td></tr>`}).join('')}</table></div>`:empty('Belum ada rekod pembelajaran.')}`;
    },

    subscriptions:()=>`${head('Langganan','Status akses Penjaga')}<div class="stat-grid"><div class="stat"><small>Aktif</small><b>${activeSubs.length}</b></div><div class="stat"><small>Tidak aktif</small><b>${customers.length-activeSubs.length}</b></div><div class="stat"><small>Jumlah Penjaga</small><b>${customers.length}</b></div></div>${customers.length?`<div class="table-wrap"><table class="table"><tr><th>Penjaga</th><th>Status</th><th>Tamat</th></tr>${customers.map(u=>`<tr><td>${esc(u.name||u.email||'-')}</td><td>${statusBadge(u.subscriptionStatus||'inactive')}</td><td>${formatDate(u.subscriptionEndsAt)}</td></tr>`).join('')}</table></div>`:empty('Tiada Penjaga.')}`,

    transactions:()=>`${head('Transaksi','ToyyibPay KIV — rekod sedia ada sahaja')}<div class="stat-grid"><div class="stat"><small>Jumlah rekod</small><b>${orders.length}</b></div><div class="stat"><small>Dibayar</small><b>${paidOrders.length}</b></div><div class="stat"><small>Nilai dibayar</small><b>RM${sales.toFixed(2)}</b></div></div>${orders.length?`<div class="table-wrap"><table class="table"><tr><th>ID</th><th>Pelan</th><th>Nilai</th><th>Status</th></tr>${orders.slice(-30).reverse().map(o=>`<tr><td><code>${esc(o.id)}</code></td><td>${esc(o.plan||'-')}</td><td>RM${Number(o.amount||0).toFixed(2)}</td><td>${statusBadge(o.status)}</td></tr>`).join('')}</table></div>`:empty('Belum ada transaksi. ToyyibPay sedang KIV.')}`,

    commissions:()=>`${head('Komisen','Rekod affiliate')}<div class="stat-grid"><div class="stat"><small>Rekod</small><b>${commissions.length}</b></div><div class="stat"><small>Jumlah</small><b>RM${commissionTotal.toFixed(2)}</b></div><div class="stat"><small>Pending</small><b>${commissions.filter(c=>c.status==='pending').length}</b></div></div>${commissions.length?`<div class="table-wrap"><table class="table"><tr><th>Agent</th><th>Jualan</th><th>Kadar</th><th>Komisen</th><th>Status</th></tr>${commissions.map(c=>{const a=users.find(u=>u.id===c.agentUid);return `<tr><td>${esc(a?.name||c.agentUid||'-')}</td><td>RM${Number(c.saleAmount||0).toFixed(2)}</td><td>${Number(c.ratePercent||0)}%</td><td>RM${Number(c.amount||0).toFixed(2)}</td><td>${statusBadge(c.status)}</td></tr>`}).join('')}</table></div>`:empty('Belum ada komisen.')}`,

    content:()=>{
      const subjects=[
        [1,'bm','🇲🇾','Bahasa Melayu',Object.values(bmYear1Bank).reduce((n,t)=>n+t.questions.length,0),Object.keys(bmYear1Bank).length],
        [1,'bi','🔤','Bahasa Inggeris',Object.values(biYear1Bank).reduce((n,t)=>n+t.questions.length,0),Object.keys(biYear1Bank).length],
        [1,'math','➗','Matematik',Object.values(mathYear1Bank).reduce((n,t)=>n+t.questions.length,0),Object.keys(mathYear1Bank).length],
        [1,'science','🔬','Sains',Object.values(scienceYear1Bank).reduce((n,t)=>n+t.questions.length,0),Object.keys(scienceYear1Bank).length],
        [2,'bm','🇲🇾','Bahasa Melayu',Object.values(bmYear2Bank).reduce((n,t)=>n+t.questions.length,0),Object.keys(bmYear2Bank).length]
      ];
      const yearCards=[1,2,3,4,5,6].map(y=>`<article class="admin-year-card ${y<=2?'ready':''}"><span>Tahun ${y}</span><b>${y<=2?'Aktif':'Belum diisi'}</b><small>${y===1?'4 subjek utama tersedia':y===2?'Bahasa Melayu tersedia':'Struktur portal tersedia'}</small></article>`).join('');
      return `${head('Kandungan Tahun 1–6','Peta kandungan portal sekolah rendah')}
        <div class="dash-note">📚 CilikGo menggunakan struktur <b>Tahun → Subjek → Topik → Latihan</b>. Kandungan lama tidak lagi digunakan dalam portal.</div>
        <div class="admin-year-grid">${yearCards}</div>
        <div class="content-subject-grid">${subjects.map(([y,k,i,n,q,t])=>`<article class="content-subject-card"><span>${i}</span><div><small>TAHUN ${y}</small><h3>${n}</h3><p>${t} topik · ${q} soalan terbina dalam</p></div><b>Aktif</b></article>`).join('')}</div>
        <div class="dash-note">Tahun 2 kini bermula dengan Bahasa Melayu. Bahasa Inggeris, Matematik dan Sains Tahun 2 akan ditambah secara berperingkat.</div>`;
    },

    settings:()=>`${head('Settings','Konfigurasi sistem')}<div class="settings-grid"><div class="setting-card"><b>Harga permulaan</b><strong>RM69</strong><small>4 bulan</small></div><div class="setting-card"><b>Pembaharuan</b><strong>RM15</strong><small>1 bulan · KIV pembayaran</small></div><div class="setting-card"><b>Komisen contoh</b><strong>15%</strong><small>Ubah sebelum production jika perlu</small></div></div><div class="dash-note">Tetapan kewangan sensitif dan secret ToyyibPay tidak disimpan atau diedit dari frontend Admin.</div>`
  };

  function renderAgentRows(list){
    return list.length?`<div class="table-wrap"><table class="table"><tr><th>Nama</th><th>E-mel</th><th>Kod</th><th>Jualan</th><th>Komisen</th></tr>${list.map(a=>{const ao=orders.filter(o=>o.agentUid===a.id),ac=commissions.filter(c=>c.agentUid===a.id);return `<tr><td>${esc(a.name||'-')}</td><td>${esc(a.email||'-')}</td><td><code>${esc(a.agentCode||'-')}</code></td><td>${ao.length}</td><td>RM${ac.reduce((s,c)=>s+Number(c.amount||0),0).toFixed(2)}</td></tr>`}).join('')}</table></div>`:empty('Tiada Agent ditemui.');
  }

  function renderUserRows(list){
    return list.length?`<div class="table-wrap"><table class="table"><tr><th>Nama</th><th>E-mel</th><th>Langganan</th><th>Daftar melalui</th></tr>${list.map(u=>`<tr><td>${esc(u.name||'-')}</td><td>${esc(u.email||'-')}</td><td>${statusBadge(u.subscriptionStatus||'inactive')}</td><td>${esc(u.referredByCode||'Direct')}</td></tr>`).join('')}</table></div>`:empty('Tiada pengguna ditemui.');
  }

  let currentView='overview';
  const mount=async(view)=>{
    currentView=view;
    $('#dashboard').innerHTML=shell(view,view==='subscriptions'?'':views[view]());
    if(view==='subscriptions') await renderAdminSubscriptions();
    document.querySelectorAll('.admin-nav').forEach(a=>a.onclick=()=>{setRoleNav(false);mount(a.dataset.view);});
    const main=$('.admin-shell .portal-main'); if(main) main.scrollTop=0;
    animateIn($('#adminContent'));
    const search=$('#adminSearch');
    if(search&&view==='users') search.oninput=()=>{const q=search.value.toLowerCase();$('#adminUserTable').innerHTML=renderUserRows(customers.filter(u=>(u.name||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q)));};
    if(search&&view==='agents') search.oninput=()=>{const q=search.value.toLowerCase();$('#adminAgentTable').innerHTML=renderAgentRows(agents.filter(a=>(a.name||'').toLowerCase().includes(q)||(a.email||'').toLowerCase().includes(q)||(a.agentCode||'').toLowerCase().includes(q)));};
  };
  await mount('overview');
}

async function renderPortal(p){
  showDashboardPage();
  $('#portalTitle').textContent=p.role==='admin'?'Dashboard Admin':p.role==='agent'?'Dashboard Agent':'Dashboard Penjaga';
  $('#portalSubtitle').textContent='Paparan ini menggunakan akaun dan role sebenar daripada Firebase.';
  $('#appMemberName').textContent=p.name||p.email||'Akaun';
  if(p.role==='admin') await renderAdmin(p); else if(p.role==='agent') await renderAgent(p); else await renderUser(p);
}

if(fb) fb.onAuthStateChanged(fb.auth, async user=>{
  if(!user){
    currentProfile=null;
    $('#guestActions').classList.remove('hidden');
    $('#memberActions').classList.add('hidden');
    $('#mobileGuestActions')?.classList.remove('hidden');
    $('#mobileMemberActions')?.classList.add('hidden');
    $('#portalTitle').textContent='Dashboard anda.';
    $('#portalSubtitle').textContent='Log masuk untuk membuka dashboard mengikut peranan akaun anda.';
    $('#dashboard').innerHTML='<div class="portal-locked"><div class="lock-icon">🔐</div><h3>Portal dilindungi</h3><p>Log masuk untuk membuka dashboard.</p><button class="btn primary" id="lockedLogin">Log Masuk</button></div>';
    $('#lockedLogin').onclick=()=>showAuthPage('login');
    if(location.hash==='#login')showAuthPage('login');
    else if(location.hash==='#register')showAuthPage('register');
    else showPublicPage();
    return;
  }
  try{
    currentProfile=await getProfile(user);
    $('#guestActions').classList.add('hidden');
    $('#memberActions').classList.remove('hidden');
    $('#mobileGuestActions')?.classList.add('hidden');
    $('#mobileMemberActions')?.classList.remove('hidden');
    const displayName=currentProfile.name||user.email;
    $('#memberName').textContent=displayName;
    $('#mobileMemberName').textContent=displayName;
    $('#appMemberName').textContent=displayName;
    $('#appMobileMemberName').textContent=displayName;
    await renderPortal(currentProfile);
  }catch(e){
    console.error(e);
    toast('Gagal membaca profil Firestore: '+e.message);
  }
});

window.addEventListener('hashchange',async()=>{
  const hash=location.hash;
  if(!fb?.auth.currentUser){
    if(hash==='#login')showAuthPage('login');
    else if(hash==='#register')showAuthPage('register');
    else showPublicPage();
    return;
  }
  if(!currentProfile)return;
  if(hash==='#student'&&currentProfile.role==='user'){await renderStudentPortal(currentProfile);return;}
  if(hash==='#report-card'&&currentProfile.role==='user'){await renderParentReportCard(currentProfile);return;}
  if(hash==='#settings'&&currentProfile.role==='user'){await renderParentSettingsView(currentProfile);return;}
  if(hash==='#dashboard'){await renderPortal(currentProfile);return;}
  if(hash==='#home')showPublicPage();
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

function syncAvatarPreview(){
  const sel=$('#childAvatar'),preview=$('#avatarPreview'),text=$('#avatarPreviewText');
  if(!sel||!preview||!text)return;
  preview.textContent=sel.value||'🧒';
  text.textContent=sel.options[sel.selectedIndex]?.text?.replace(/^\S+\s*/,'')||'Avatar';
}
$('#childAvatar')?.addEventListener('change',syncAvatarPreview);
$('#childGender')?.addEventListener('change',()=>{
  const gender=$('#childGender').value, avatar=$('#childAvatar');
  if(!avatar)return;
  avatar.value=gender==='female'?'👧':'👦';
  syncAvatarPreview();
});
syncAvatarPreview();

function prepareChildModal(child=null){
  const isEdit=!!child;
  const saveBtn=$('#saveChildBtn');
  if(saveBtn){
    saveBtn.disabled=false;
    saveBtn.removeAttribute('aria-busy');
    delete saveBtn.dataset.oldText;
  }
  $('#childEditId').value=child?.id||'';
  $('#childModalTitle').textContent=isEdit?'Edit Profil Pelajar':'Tambah Profil Pelajar';
  $('#childModalDesc').textContent=isEdit?'Kemaskini maklumat profil pelajar.':'Maklumat ini membantu CilikGo memaparkan ruang belajar yang sesuai.';
  $('#saveChildBtn').textContent=isEdit?'Simpan Perubahan':'Simpan Profil';
  $('#childName').value=child?.name||'';
  $('#childGender').value=child?.gender||((child?.avatar==='👧'||child?.avatar==='👩‍🎓'||child?.avatar==='👩‍🚀'||child?.avatar==='👩‍🔬'||child?.avatar==='🦸‍♀️')?'female':'male');
  $('#childYear').value=String(child?.year||Math.max(1,Number(child?.age||7)-6)||1);
  const available=[...$('#childAvatar').options].some(o=>o.value===(child?.avatar||''));
  $('#childAvatar').value=available?(child?.avatar||'👦'):($('#childGender').value==='female'?'👧':'👦');
  syncAvatarPreview();
  $('#childModal').showModal();
  setTimeout(()=>$('#childName')?.focus(),50);
}
function resetChildModal(){
  const saveBtn=$('#saveChildBtn');
  if(saveBtn){
    saveBtn.disabled=false;
    saveBtn.removeAttribute('aria-busy');
    delete saveBtn.dataset.oldText;
  }
  $('#childEditId').value='';
  $('#childModalTitle').textContent='Tambah Profil Pelajar';
  $('#childModalDesc').textContent='Maklumat ini membantu CilikGo memaparkan ruang belajar yang sesuai.';
  $('#saveChildBtn').textContent='Simpan Profil';
  $('#childName').value='';
  $('#childGender').value='male';
  $('#childYear').value='1';
  $('#childAvatar').value='👦';
  syncAvatarPreview();
}

$('#saveChildBtn').onclick=async()=>{
  if(!fb?.auth.currentUser||currentProfile?.role!=='user') return toast('Fungsi ini untuk akaun Penjaga.');
  const editId=$('#childEditId').value.trim(),
        name=$('#childName').value.trim(),
        gender=$('#childGender').value,
        year=Number($('#childYear').value),
        age=year+6,
        avatar=$('#childAvatar').value;
  if(!name) return toast('Masukkan nama panggilan pelajar.');
  if(!['male','female'].includes(gender)) return toast('Pilih jantina pelajar.');

  const btn=$('#saveChildBtn');
  setButtonLoading(btn,true,editId?'Menyimpan…':'Menambah…');
  try{
    if(editId){
      const existing=userChildren.find(c=>c.id===editId);
      if(!existing||existing.ownerUid!==fb.auth.currentUser.uid) throw new Error('Profil pelajar tidak ditemui.');
      await fb.setDoc(fb.doc(fb.db,'children',editId),{
        name,gender,age,year,avatar,updatedAt:fb.serverTimestamp()
      },{merge:true});
      if(activeChild?.id===editId) activeChild={...activeChild,name,gender,age,year,avatar};
      toast('Profil pelajar berjaya dikemaskini.');
    }else{
      const ref=await fb.addDoc(fb.collection(fb.db,'children'),{
        ownerUid:fb.auth.currentUser.uid,name,gender,age,year,avatar,createdAt:fb.serverTimestamp()
      });
      localStorage.setItem('cilikgo_active_child',ref.id);
      toast('Profil pelajar berjaya ditambah.');
    }
    $('#childModal').close();
    resetChildModal();
    await loadChildren(currentProfile.uid);
    if(location.hash==='#settings') await renderParentSettingsView(currentProfile);
    else await renderUser(currentProfile);
  }catch(e){
    console.error(e);
    toast('Gagal simpan profil: '+friendlyError(e));
    setButtonLoading(btn,false);
  }
};

async function deleteStudentProfile(p,id){
  const kids=await loadChildren(p.uid);
  const child=kids.find(c=>c.id===id);
  if(!child)return toast('Profil pelajar tidak ditemui.');
  const ok=window.confirm(`Padam profil ${child.name}?\n\nSemua rekod latihan untuk profil ini juga akan dipadam. Tindakan ini tidak boleh dibuat asal.`);
  if(!ok)return false;
  try{
    const q=fb.query(
      fb.collection(fb.db,'progress'),
      fb.where('ownerUid','==',p.uid),
      fb.where('childId','==',id)
    );
    const snap=await fb.getDocs(q);
    await Promise.all(snap.docs.map(d=>fb.deleteDoc(fb.doc(fb.db,'progress',d.id))));
    await fb.deleteDoc(fb.doc(fb.db,'children',id));
    if(localStorage.getItem('cilikgo_active_child')===id) localStorage.removeItem('cilikgo_active_child');
    if(activeChild?.id===id) activeChild=null;
    toast(`Profil ${child.name} berjaya dipadam.`);
    await loadChildren(p.uid);
    return true;
  }catch(err){
    console.error('delete child',err);
    toast('Gagal padam profil: '+friendlyError(err));
    return false;
  }
}

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

const scienceYear1Bank={"skills":{"title":"Kemahiran Sains & Keselamatan","icon":"🔍","desc":"Memerhati, membanding, mengelas dan mengamalkan peraturan keselamatan.","questions":[{"prompt":"Apakah deria utama yang digunakan untuk melihat warna bunga?","answers":["mata","telinga","hidung","kulit"],"correct":"mata","success":"Betul! Mata digunakan untuk melihat."},{"prompt":"Apakah alat yang sesuai untuk melihat objek kecil dengan lebih jelas?","answers":["kanta pembesar","pembaris","sudu","termometer"],"correct":"kanta pembesar","success":"Betul! Kanta pembesar membantu melihat objek kecil."},{"prompt":"Kita mengumpulkan daun mengikut warna. Kemahiran ini disebut…","answers":["mengelas","menjerit","melompat","mengukur"],"correct":"mengelas","success":"Betul! Mengumpulkan mengikut ciri ialah mengelas."},{"prompt":"Dua objek dibandingkan dari segi panjang. Apakah yang kita lakukan?","answers":["membanding","memasak","melukis","mengelas"],"correct":"membanding","success":"Betul! Kita sedang membandingkan objek."},{"prompt":"Sebelum menjalankan aktiviti sains, kita perlu…","answers":["mendengar arahan guru","berlari di bilik sains","bermain dengan alat","bercakap kuat"],"correct":"mendengar arahan guru","success":"Betul! Keselamatan bermula dengan mematuhi arahan."},{"prompt":"Jika air tertumpah di lantai bilik sains, kita perlu…","answers":["beritahu guru","biarkan sahaja","berlari melaluinya","duduk diam"],"correct":"beritahu guru","success":"Betul! Maklumkan kepada guru supaya keadaan selamat."},{"prompt":"Apakah tindakan yang selamat dengan bahan yang tidak dikenali?","answers":["jangan rasa atau hidu sesuka hati","rasa sedikit","bawa pulang","pegang tanpa arahan"],"correct":"jangan rasa atau hidu sesuka hati","success":"Betul! Jangan rasa atau hidu bahan yang tidak dikenali."},{"prompt":"Apabila selesai menggunakan alat, kita perlu…","answers":["simpan dengan kemas","tinggalkan di lantai","campak ke dalam kotak","bawa pulang"],"correct":"simpan dengan kemas","success":"Betul! Alat perlu disimpan dengan kemas."},{"prompt":"Kita mencatat bilangan biji benih yang tumbuh. Ini membantu kita…","answers":["merekod pemerhatian","bermain","meneka tanpa melihat","melukis tanpa melihat"],"correct":"merekod pemerhatian","success":"Betul! Rekod membantu menyimpan hasil pemerhatian."},{"prompt":"Yang manakah contoh pemerhatian?","answers":["Daun itu berwarna hijau.","Saya rasa daun itu suka hujan.","Daun itu pasti gembira.","Daun itu boleh bercakap."],"correct":"Daun itu berwarna hijau.","success":"Betul! Warna hijau boleh diperhatikan secara langsung."}]},"living":{"title":"Benda Hidup & Bukan Hidup","icon":"🌱","desc":"Kenal ciri benda hidup dan keperluan asas untuk hidup.","questions":[{"prompt":"Yang manakah benda hidup?","answers":["kucing","batu","meja","pensel"],"correct":"kucing","success":"Betul! Kucing ialah benda hidup."},{"prompt":"Yang manakah benda bukan hidup?","answers":["pokok","ikan","kerusi","bunga"],"correct":"kerusi","success":"Betul! Kerusi ialah benda bukan hidup."},{"prompt":"Benda hidup memerlukan ___ untuk terus hidup.","answers":["air","plastik","cat","besi"],"correct":"air","success":"Betul! Air ialah salah satu keperluan asas benda hidup."},{"prompt":"Haiwan memerlukan makanan untuk…","answers":["mendapat tenaga","menjadi batu","bertukar menjadi meja","menjadi kaca"],"correct":"mendapat tenaga","success":"Betul! Makanan membekalkan tenaga."},{"prompt":"Tumbuhan memerlukan cahaya untuk membantu…","answers":["tumbuh","menjadi mainan","berbunyi","berlari"],"correct":"tumbuh","success":"Betul! Cahaya membantu tumbuhan hidup dan tumbuh."},{"prompt":"Antara berikut, yang manakah boleh membesar?","answers":["anak ayam","pensel","cawan","batu"],"correct":"anak ayam","success":"Betul! Anak ayam ialah benda hidup dan boleh membesar."},{"prompt":"Benda hidup boleh…","answers":["membiak","menjadi plastik","tidak berubah langsung","menjadi kaca"],"correct":"membiak","success":"Betul! Membiak ialah salah satu ciri benda hidup."},{"prompt":"Pokok layu kerana tidak disiram. Apakah yang kurang?","answers":["air","batu","kertas","plastik"],"correct":"air","success":"Betul! Tumbuhan memerlukan air."},{"prompt":"Ikan biasanya hidup di…","answers":["air","pasir kering","atas meja","atas pokok"],"correct":"air","success":"Betul! Ikan hidup di dalam air."},{"prompt":"Mengapakah manusia perlu bernafas?","answers":["untuk hidup","untuk menjadi lebih tinggi serta-merta","untuk bertukar warna","untuk menjadi batu"],"correct":"untuk hidup","success":"Betul! Bernafas ialah keperluan asas manusia."}]},"human":{"title":"Manusia & Deria","icon":"👀","desc":"Kenal anggota badan, deria dan cara menjaga diri.","questions":[{"prompt":"Kita melihat menggunakan…","answers":["mata","hidung","lidah","telinga"],"correct":"mata","success":"Betul! Mata ialah organ deria penglihatan."},{"prompt":"Kita mendengar menggunakan…","answers":["telinga","mata","kulit","kaki"],"correct":"telinga","success":"Betul! Telinga digunakan untuk mendengar."},{"prompt":"Kita menghidu bau menggunakan…","answers":["hidung","tangan","kaki","mata"],"correct":"hidung","success":"Betul! Hidung digunakan untuk menghidu."},{"prompt":"Kita merasa rasa makanan menggunakan…","answers":["lidah","rambut","kuku","hidung"],"correct":"lidah","success":"Betul! Lidah digunakan untuk merasa."},{"prompt":"Kita merasa sentuhan menggunakan…","answers":["kulit","gigi","rambut","lidah"],"correct":"kulit","success":"Betul! Kulit membantu kita merasa sentuhan."},{"prompt":"Bunyi loceng dikesan oleh deria…","answers":["pendengaran","penglihatan","rasa","bau"],"correct":"pendengaran","success":"Betul! Bunyi dikesan melalui pendengaran."},{"prompt":"Warna merah dikesan oleh deria…","answers":["penglihatan","bau","rasa","sentuhan"],"correct":"penglihatan","success":"Betul! Warna dilihat menggunakan mata."},{"prompt":"Ais terasa sejuk apabila disentuh. Deria yang digunakan ialah…","answers":["sentuhan","bau","pendengaran","penglihatan"],"correct":"sentuhan","success":"Betul! Kulit membantu merasa sejuk."},{"prompt":"Cara yang baik menjaga mata ialah…","answers":["membaca dengan cahaya yang cukup","melihat skrin terlalu dekat","menggosok mata dengan tangan kotor","membaca dalam gelap"],"correct":"membaca dengan cahaya yang cukup","success":"Betul! Cahaya yang cukup membantu menjaga mata."},{"prompt":"Cara menjaga kebersihan badan ialah…","answers":["mandi setiap hari","tidak membasuh tangan","memakai pakaian kotor","tidak mandi"],"correct":"mandi setiap hari","success":"Betul! Mandi membantu menjaga kebersihan badan."}]},"organisms":{"title":"Haiwan & Tumbuhan","icon":"🐾","desc":"Kenal bahagian, ciri dan keperluan haiwan serta tumbuhan.","questions":[{"prompt":"Burung menggunakan ___ untuk terbang.","answers":["sayap","sirip","akar","kaki"],"correct":"sayap","success":"Betul! Burung menggunakan sayap untuk terbang."},{"prompt":"Ikan bergerak di dalam air menggunakan…","answers":["sirip","sayap","akar","kaki"],"correct":"sirip","success":"Betul! Sirip membantu ikan berenang."},{"prompt":"Bahagian tumbuhan yang menyerap air dari tanah ialah…","answers":["akar","bunga","buah","batang"],"correct":"akar","success":"Betul! Akar menyerap air dari tanah."},{"prompt":"Bahagian tumbuhan yang biasanya berwarna hijau ialah…","answers":["daun","akar","tanah","batu"],"correct":"daun","success":"Betul! Daun biasanya berwarna hijau."},{"prompt":"Bunga boleh berkembang menjadi…","answers":["buah","batu","kertas","daun"],"correct":"buah","success":"Betul! Bunga boleh berkembang menjadi buah."},{"prompt":"Yang manakah haiwan berkaki empat?","answers":["kucing","ikan","ular","burung"],"correct":"kucing","success":"Betul! Kucing mempunyai empat kaki."},{"prompt":"Yang manakah haiwan yang hidup di air?","answers":["ikan","ayam","kucing","kambing"],"correct":"ikan","success":"Betul! Ikan hidup di air."},{"prompt":"Tumbuhan yang tidak mendapat air mencukupi boleh…","answers":["layu","menjadi besi","berbunyi","menjadi plastik"],"correct":"layu","success":"Betul! Kekurangan air boleh menyebabkan tumbuhan layu."},{"prompt":"Apakah persamaan ayam dan kucing?","answers":["kedua-duanya haiwan","kedua-duanya tumbuhan","kedua-duanya benda bukan hidup","kedua-duanya hidup di air"],"correct":"kedua-duanya haiwan","success":"Betul! Ayam dan kucing ialah haiwan."},{"prompt":"Apakah yang diperlukan oleh haiwan dan tumbuhan?","answers":["air","plastik","kaca","tanah"],"correct":"air","success":"Betul! Haiwan dan tumbuhan memerlukan air."}]},"materials":{"title":"Magnet & Penyerapan","icon":"🧲","desc":"Kenal tarikan magnet dan bahan yang menyerap atau tidak menyerap air.","questions":[{"prompt":"Magnet boleh menarik objek yang diperbuat daripada…","answers":["besi","kertas","kain","kayu"],"correct":"besi","success":"Betul! Magnet boleh menarik banyak objek besi."},{"prompt":"Yang manakah biasanya boleh ditarik oleh magnet?","answers":["klip kertas besi","pemadam","kertas","kapas"],"correct":"klip kertas besi","success":"Betul! Klip kertas besi boleh ditarik magnet."},{"prompt":"Dua kutub magnet yang sama akan…","answers":["menolak","melekat kuat","hilang","berpusing"],"correct":"menolak","success":"Betul! Kutub yang sama saling menolak."},{"prompt":"Dua kutub magnet yang berlainan akan…","answers":["menarik","menolak","mencair","hilang"],"correct":"menarik","success":"Betul! Kutub berlainan saling menarik."},{"prompt":"Bahan manakah mudah menyerap air?","answers":["span","plastik","kaca","besi"],"correct":"span","success":"Betul! Span mudah menyerap air."},{"prompt":"Bahan manakah tidak mudah menyerap air?","answers":["plastik","tisu","kain","span"],"correct":"plastik","success":"Betul! Plastik tidak mudah menyerap air."},{"prompt":"Tisu terkena air akan…","answers":["menyerap air","menolak air sepenuhnya","menjadi magnet","bercahaya"],"correct":"menyerap air","success":"Betul! Tisu menyerap air."},{"prompt":"Payung sesuai dibuat daripada bahan yang…","answers":["tidak mudah menyerap air","sangat mudah menyerap air","mudah koyak apabila basah","berat sangat"],"correct":"tidak mudah menyerap air","success":"Betul! Bahan payung perlu menghalang air."},{"prompt":"Jika magnet didekatkan kepada sudu plastik, biasanya sudu itu…","answers":["tidak ditarik","ditarik kuat","berubah warna","bercahaya"],"correct":"tidak ditarik","success":"Betul! Plastik biasanya tidak ditarik magnet."},{"prompt":"Kain dan plastik diuji dengan air. Yang biasanya lebih menyerap air ialah…","answers":["kain","plastik","kedua-duanya sama sahaja","tidak dapat ditentukan"],"correct":"kain","success":"Betul! Kain biasanya lebih menyerap air."}]},"earthdesign":{"title":"Bumi & Reka Bentuk Asas","icon":"🌍","desc":"Kenal permukaan bumi, sumber semula jadi dan binaan ringkas yang kukuh.","questions":[{"prompt":"Permukaan bumi mempunyai kawasan daratan dan…","answers":["air","api","plastik","udara"],"correct":"air","success":"Betul! Bumi mempunyai daratan dan kawasan air."},{"prompt":"Yang manakah contoh kawasan air?","answers":["sungai","jalan raya","padang","bukit"],"correct":"sungai","success":"Betul! Sungai ialah kawasan air."},{"prompt":"Yang manakah contoh daratan?","answers":["bukit","laut","tasik","sungai"],"correct":"bukit","success":"Betul! Bukit ialah kawasan daratan."},{"prompt":"Batu dan tanah ialah bahan yang boleh ditemui secara…","answers":["semula jadi","hanya di kilang","hanya dalam komputer","buatan manusia"],"correct":"semula jadi","success":"Betul! Batu dan tanah terdapat secara semula jadi."},{"prompt":"Untuk membina menara blok yang stabil, tapaknya perlu…","answers":["kukuh dan seimbang","sangat kecil","senget","tinggi sahaja"],"correct":"kukuh dan seimbang","success":"Betul! Tapak yang kukuh membantu binaan stabil."},{"prompt":"Menara blok sering tumbang kerana…","answers":["tidak seimbang","terlalu kemas","tapaknya lebar","warnanya cerah"],"correct":"tidak seimbang","success":"Betul! Binaan yang tidak seimbang mudah tumbang."},{"prompt":"Bentuk manakah sesuai dijadikan tapak binaan yang stabil?","answers":["permukaan rata","permukaan sangat senget","permukaan bergerak","permukaan berlubang"],"correct":"permukaan rata","success":"Betul! Permukaan rata membantu kestabilan."},{"prompt":"Apabila binaan gagal, tindakan saintifik yang baik ialah…","answers":["cuba baiki dan uji semula","terus buang semua bahan","tidak mahu mencuba lagi","salahkan kawan"],"correct":"cuba baiki dan uji semula","success":"Betul! Kita boleh membaiki reka bentuk dan menguji semula."},{"prompt":"Yang manakah sumber semula jadi?","answers":["air","botol plastik","komputer","televisyen"],"correct":"air","success":"Betul! Air ialah sumber semula jadi."},{"prompt":"Kita perlu menggunakan air dengan…","answers":["berhemah","membazir","membiarkan paip terbuka","sesuka hati"],"correct":"berhemah","success":"Betul! Air perlu digunakan dengan berhemah."}]}};

const biYear1Bank={"alphabet":{"title":"Letters & Sounds","icon":"🔤","desc":"Recognise letters, beginning sounds and simple letter patterns.","questions":[{"prompt":"Which letter comes after A?","answers":["B","C","D","E"],"correct":"B","success":"Correct! B comes after A."},{"prompt":"Which letter comes before D?","answers":["B","C","E","A"],"correct":"C","success":"Correct! C comes before D."},{"prompt":"Which word starts with B?","answers":["ball","cat","fish","dog"],"correct":"ball","success":"Correct! Ball starts with B."},{"prompt":"Which word starts with C?","answers":["dog","cat","sun","ball"],"correct":"cat","success":"Correct! Cat starts with C."},{"prompt":"Choose the small letter for M.","answers":["m","n","w","p"],"correct":"m","success":"Correct! The small letter for M is m."},{"prompt":"Choose the capital letter for a.","answers":["A","E","O","I"],"correct":"A","success":"Correct! The capital letter for a is A."},{"prompt":"Which word ends with T?","answers":["cat","dog","sun","fish"],"correct":"cat","success":"Correct! Cat ends with T."},{"prompt":"Which word begins with the sound /s/?","answers":["sun","ball","fish","cat"],"correct":"sun","success":"Correct! Sun begins with the /s/ sound."},{"prompt":"Complete the pattern: A, B, C, __","answers":["D","E","F","G"],"correct":"D","success":"Correct! D comes next."},{"prompt":"Which pair matches?","answers":["G - g","G - q","G - c","H - n"],"correct":"G - g","success":"Correct! G matches with g."}]},"vocabulary":{"title":"Everyday Vocabulary","icon":"🧠","desc":"Learn common words about people, objects, animals and places.","questions":[{"prompt":"Which one is an animal?","answers":["cat","chair","book","table"],"correct":"cat","success":"Correct! A cat is an animal."},{"prompt":"Which one do we use for writing?","answers":["pencil","plate","shoe","cup"],"correct":"pencil","success":"Correct! We use a pencil for writing."},{"prompt":"Where do pupils learn?","answers":["school","market","park","kitchen"],"correct":"school","success":"Correct! Pupils learn at school."},{"prompt":"Which one is a fruit?","answers":["apple","table","shirt","chair"],"correct":"apple","success":"Correct! An apple is a fruit."},{"prompt":"Which one is a colour?","answers":["blue","run","book","jump"],"correct":"blue","success":"Correct! Blue is a colour."},{"prompt":"Which body part do we use to see?","answers":["eyes","ears","feet","hands"],"correct":"eyes","success":"Correct! We use our eyes to see."},{"prompt":"Which one can fly?","answers":["bird","fish","cat","dog"],"correct":"bird","success":"Correct! A bird can fly."},{"prompt":"Which room is used for cooking?","answers":["kitchen","bedroom","garden","bathroom"],"correct":"kitchen","success":"Correct! We cook in the kitchen."},{"prompt":"Which word means the opposite of big?","answers":["small","long","fast","short"],"correct":"small","success":"Correct! Small is the opposite of big."},{"prompt":"Which word means the opposite of hot?","answers":["cold","sweet","soft","hard"],"correct":"cold","success":"Correct! Cold is the opposite of hot."}]},"grammar":{"title":"Basic Grammar","icon":"🧩","desc":"Use simple nouns, verbs, adjectives and basic sentence patterns.","questions":[{"prompt":"Choose the noun.","answers":["book","run","happy","quickly"],"correct":"book","success":"Correct! Book is a noun."},{"prompt":"Choose the verb.","answers":["jump","table","red","blue"],"correct":"jump","success":"Correct! Jump is a verb."},{"prompt":"Choose the adjective.","answers":["happy","cat","eat","quickly"],"correct":"happy","success":"Correct! Happy is an adjective."},{"prompt":"I ___ milk.","answers":["drink","blue","chair","happy"],"correct":"drink","success":"Correct! I drink milk."},{"prompt":"She ___ a book.","answers":["reads","yellow","school","green"],"correct":"reads","success":"Correct! She reads a book."},{"prompt":"The ball is ___.","answers":["round","run","table","eat"],"correct":"round","success":"Correct! Round describes the ball."},{"prompt":"Choose the correct sentence.","answers":["I am Ali.","I Ali am.","Am I Ali.","Ali I am."],"correct":"I am Ali.","success":"Correct! “I am Ali.” is correct."},{"prompt":"Choose the correct word: This is ___ cat.","answers":["a","an","two","many"],"correct":"a","success":"Correct! We say “a cat”."},{"prompt":"Choose the correct word: This is ___ apple.","answers":["a","an","two","many"],"correct":"an","success":"Correct! We say “an apple”."},{"prompt":"They ___ happy.","answers":["are","is","am","be"],"correct":"are","success":"Correct! We say “They are happy.”"}]},"reading":{"title":"Reading Comprehension","icon":"📖","desc":"Read short sentences and answer simple questions.","questions":[{"prompt":"“Ali has a red ball.” What colour is the ball?","answers":["red","blue","green","Sara"],"correct":"red","success":"Correct! The ball is red."},{"prompt":"“Mia has two cats.” How many cats does Mia have?","answers":["one","two","three","yellow"],"correct":"two","success":"Correct! Mia has two cats."},{"prompt":"“The boy eats rice.” What does the boy eat?","answers":["rice","bread","cake","milk"],"correct":"rice","success":"Correct! The boy eats rice."},{"prompt":"“Sara goes to school in the morning.” When does Sara go to school?","answers":["morning","evening","night","afternoon"],"correct":"morning","success":"Correct! Sara goes in the morning."},{"prompt":"“The bird is in the tree.” Where is the bird?","answers":["in the tree","under the table","in the car","in the bag"],"correct":"in the tree","success":"Correct! The bird is in the tree."},{"prompt":"“Dad drives a car.” What does Dad drive?","answers":["car","bus","bike","train"],"correct":"car","success":"Correct! Dad drives a car."},{"prompt":"“The fish swims in water.” What does the fish do?","answers":["swims","runs","flies","sleeps"],"correct":"swims","success":"Correct! The fish swims."},{"prompt":"“Lina likes bananas.” What fruit does Lina like?","answers":["bananas","apples","oranges","grapes"],"correct":"bananas","success":"Correct! Lina likes bananas."},{"prompt":"“The book is on the table.” Where is the book?","answers":["on the table","under the bed","in the bag","on the chair"],"correct":"on the table","success":"Correct! The book is on the table."},{"prompt":"“Ben is seven years old.” How old is Ben?","answers":["six","seven","eight","nine"],"correct":"seven","success":"Correct! Ben is seven years old."}]},"writing":{"title":"Writing Basics","icon":"✏️","desc":"Spell common words and build simple sentences.","questions":[{"prompt":"Choose the correct spelling.","answers":["school","scool","schol","shcool"],"correct":"school","success":"Correct! School is spelt S-C-H-O-O-L."},{"prompt":"Choose the correct spelling.","answers":["apple","aple","appel","appelx"],"correct":"apple","success":"Correct! Apple is the correct spelling."},{"prompt":"Choose the correct spelling.","answers":["house","hous","howse","hause"],"correct":"house","success":"Correct! House is the correct spelling."},{"prompt":"Complete the word: c _ t","answers":["a","e","i","o"],"correct":"a","success":"Correct! C-A-T spells cat."},{"prompt":"Complete the word: d _ g","answers":["o","a","u","e"],"correct":"o","success":"Correct! D-O-G spells dog."},{"prompt":"Choose the sentence with a capital letter.","answers":["My name is Ben.","my name is Ben.","MY name is Ben.","MY Name is Ben."],"correct":"My name is Ben.","success":"Correct! A sentence starts with a capital letter."},{"prompt":"Choose the sentence with a full stop.","answers":["I like milk.","I like milk?","I like milk","I like milk!"],"correct":"I like milk.","success":"Correct! The sentence ends with a full stop."},{"prompt":"Put the words in the correct order.","answers":["I like cats.","Like I cats.","Cats I like.","I cats like."],"correct":"I like cats.","success":"Correct! “I like cats.” is the correct order."},{"prompt":"Complete the sentence: This is my ___.","answers":["book","run","blue","chair"],"correct":"book","success":"Correct! “This is my book.”"},{"prompt":"Complete the sentence: I can ___.","answers":["jump","green","table","happy"],"correct":"jump","success":"Correct! “I can jump.”"}]},"communication":{"title":"Simple Communication","icon":"💬","desc":"Use greetings, polite expressions and everyday classroom language.","questions":[{"prompt":"What do you say when you meet someone in the morning?","answers":["Good morning","Good night","Goodbye","Good afternoon"],"correct":"Good morning","success":"Correct! We say “Good morning”."},{"prompt":"What do you say when someone helps you?","answers":["Thank you","Sorry","Good night","Please"],"correct":"Thank you","success":"Correct! We say “Thank you”."},{"prompt":"What do you say when you make a mistake?","answers":["Sorry","Welcome","Hello","Thank you"],"correct":"Sorry","success":"Correct! We say “Sorry”."},{"prompt":"Choose the polite request.","answers":["Please give me the pencil.","Give me the pencil!","Pencil now!","The pencil is blue."],"correct":"Please give me the pencil.","success":"Correct! That is a polite request."},{"prompt":"What can you say before leaving?","answers":["Goodbye","Good morning","Thank you","Hello"],"correct":"Goodbye","success":"Correct! We say “Goodbye”."},{"prompt":"Choose the correct reply to “How are you?”","answers":["I am fine, thank you.","My name is Ali.","Good night.","I am seven."],"correct":"I am fine, thank you.","success":"Correct! That is a suitable reply."},{"prompt":"Choose the correct reply to “What is your name?”","answers":["My name is Sara.","I am seven years old.","I like apples.","I like red."],"correct":"My name is Sara.","success":"Correct! That answers the question."},{"prompt":"What do you say when asking permission?","answers":["May I come in?","Come in now!","I am coming in.","Thank you."],"correct":"May I come in?","success":"Correct! “May I come in?” is polite."},{"prompt":"Choose the classroom instruction.","answers":["Open your book.","The book is blue.","I like books.","Close the door?"],"correct":"Open your book.","success":"Correct! “Open your book.” is an instruction."},{"prompt":"Choose the polite expression.","answers":["Excuse me","Move!","Go away!","Run away!"],"correct":"Excuse me","success":"Correct! “Excuse me” is polite."}]}};

const bmYear2Bank={"kosa":{"title":"Kosa Kata & Makna","icon":"🧠","desc":"Makna perkataan, kata seerti, kata berlawan dan penggunaan kosa kata.","questions":[{"prompt":"Lawan perkataan “tinggi” ialah…","answers":["rendah","besar","jauh","laju"],"correct":"rendah","success":"Betul! Lawan tinggi ialah rendah."},{"prompt":"Kata seerti bagi “gembira” ialah…","answers":["ceria","sedih","marah","penat"],"correct":"ceria","success":"Betul! Ceria mempunyai maksud yang hampir sama dengan gembira."},{"prompt":"Kata seerti bagi “cantik” ialah…","answers":["indah","kasar","sempit","gelap"],"correct":"indah","success":"Betul! Indah bermaksud cantik."},{"prompt":"Lawan perkataan “rajin” ialah…","answers":["malas","pandai","cekap","aktif"],"correct":"malas","success":"Betul! Lawan rajin ialah malas."},{"prompt":"Pilih perkataan yang bermaksud tempat membeli barang.","answers":["kedai","kelas","padang","klinik"],"correct":"kedai","success":"Betul! Kedai ialah tempat membeli barang."},{"prompt":"Pilih perkataan yang sesuai: Air sungai itu sangat ___.","answers":["jernih","bising","tajam","pahit"],"correct":"jernih","success":"Betul! Air boleh digambarkan sebagai jernih."},{"prompt":"Pilih perkataan yang sesuai: Harimau ialah haiwan yang ___.","answers":["garang","lembut","perlahan","senyap"],"correct":"garang","success":"Betul! Harimau boleh digambarkan sebagai garang."},{"prompt":"Lawan perkataan “awal” ialah…","answers":["lewat","cepat","dekat","muda"],"correct":"lewat","success":"Betul! Lawan awal ialah lewat."},{"prompt":"Kata seerti bagi “pandai” ialah…","answers":["bijak","malas","bising","nakal"],"correct":"bijak","success":"Betul! Bijak ialah kata seerti bagi pandai."},{"prompt":"Pilih perkataan yang sesuai: Kakak menyusun buku dengan ___.","answers":["kemas","masin","tinggi","gelap"],"correct":"kemas","success":"Betul! Buku boleh disusun dengan kemas."}]},"kata_nama":{"title":"Kata Nama & Kata Ganti Nama","icon":"🏷️","desc":"Kata nama am, kata nama khas dan kata ganti nama diri mudah.","questions":[{"prompt":"Pilih kata nama am.","answers":["sekolah","Aiman","Malaysia","Isnin"],"correct":"sekolah","success":"Betul! Sekolah ialah kata nama am."},{"prompt":"Pilih kata nama khas.","answers":["Melaka","negeri","bandar","kampung"],"correct":"Melaka","success":"Betul! Melaka ialah kata nama khas."},{"prompt":"Pilih kata nama khas bagi nama orang.","answers":["Sofia","murid","guru","adik"],"correct":"Sofia","success":"Betul! Sofia ialah nama khas orang."},{"prompt":"___ sedang membaca buku. Kata ganti nama yang sesuai ialah…","answers":["Dia","Kami","Mereka","Kita"],"correct":"Dia","success":"Betul! “Dia” sesuai untuk seorang."},{"prompt":"Aina dan Siti pergi ke perpustakaan. ___ membaca buku bersama-sama.","answers":["Mereka","Dia","Saya","Kamu"],"correct":"Mereka","success":"Betul! “Mereka” digunakan untuk lebih daripada seorang."},{"prompt":"Pilih kata nama am bagi haiwan.","answers":["kucing","Comel","Malaysia","Ahad"],"correct":"kucing","success":"Betul! Kucing ialah kata nama am."},{"prompt":"Pilih ejaan kata nama khas yang betul.","answers":["Sekolah Kebangsaan Murni","sekolah Kebangsaan Murni","Sekolah kebangsaan murni","sekolah kebangsaan murni"],"correct":"Sekolah Kebangsaan Murni","success":"Betul! Kata nama khas bermula dengan huruf besar."},{"prompt":"Ayah membawa Amir ke klinik. ___ menunggu giliran.","answers":["Mereka","Kita","Kami","Saya"],"correct":"Mereka","success":"Betul! Ayah dan Amir boleh dirujuk sebagai mereka."},{"prompt":"Pilih kata nama khas bagi hari.","answers":["Jumaat","hari","minggu","pagi"],"correct":"Jumaat","success":"Betul! Jumaat ialah nama khas hari."},{"prompt":"“Saya” merujuk kepada…","answers":["orang yang bercakap","orang yang mendengar","ramai orang","orang yang tiada"],"correct":"orang yang bercakap","success":"Betul! “Saya” digunakan oleh orang yang bercakap."}]},"kata_kerja":{"title":"Kata Kerja & Kata Adjektif","icon":"🏃","desc":"Kenal perbuatan dan perkataan yang menerangkan sifat atau keadaan.","questions":[{"prompt":"Pilih kata kerja.","answers":["menyapu","cantik","meja","merah"],"correct":"menyapu","success":"Betul! Menyapu ialah perbuatan."},{"prompt":"Pilih kata adjektif.","answers":["manis","berlari","kerusi","sekolah"],"correct":"manis","success":"Betul! Manis menerangkan rasa."},{"prompt":"Ibu sedang ___ sayur di dapur.","answers":["memotong","hijau","besar","pinggan"],"correct":"memotong","success":"Betul! Memotong ialah perbuatan."},{"prompt":"Baju baharu Ali sangat ___.","answers":["cantik","menulis","makan","berjalan"],"correct":"cantik","success":"Betul! Cantik menerangkan rupa baju."},{"prompt":"Pilih kata kerja yang sesuai: Burung ___ di udara.","answers":["terbang","tinggi","biru","halus"],"correct":"terbang","success":"Betul! Burung terbang di udara."},{"prompt":"Pilih kata adjektif yang sesuai: Sup itu masih ___.","answers":["panas","minum","mangkuk","memasak"],"correct":"panas","success":"Betul! Panas menerangkan keadaan sup."},{"prompt":"Adik ___ bola di padang.","answers":["menendang","bulat","merah","besar"],"correct":"menendang","success":"Betul! Menendang ialah perbuatan."},{"prompt":"Pilih perkataan yang menerangkan saiz.","answers":["kecil","tidur","membaca","pasar"],"correct":"kecil","success":"Betul! Kecil menerangkan saiz."},{"prompt":"Kucing itu berbulu sangat ___.","answers":["lembut","melompat","minum","rumah"],"correct":"lembut","success":"Betul! Lembut menerangkan tekstur bulu."},{"prompt":"Pilih kata kerja yang menunjukkan pergerakan.","answers":["berjalan","wangi","panjang","kuning"],"correct":"berjalan","success":"Betul! Berjalan ialah pergerakan."}]},"ayat":{"title":"Ayat, Ejaan & Tanda Baca","icon":"✏️","desc":"Susunan ayat, huruf besar, ejaan dan tanda baca yang betul.","questions":[{"prompt":"Pilih ayat yang betul.","answers":["Ibu memasak nasi di dapur.","Ibu nasi memasak di dapur.","Memasak ibu nasi dapur.","Di dapur nasi ibu."],"correct":"Ibu memasak nasi di dapur.","success":"Betul! Susunan ayat itu lengkap dan betul."},{"prompt":"Pilih ayat tanya yang betul.","answers":["Di manakah kamu tinggal?","Di manakah kamu tinggal.","Di manakah kamu tinggal!","Di manakah kamu tinggal,"],"correct":"Di manakah kamu tinggal?","success":"Betul! Ayat tanya berakhir dengan tanda soal."},{"prompt":"Pilih ejaan yang betul.","answers":["perpustakaan","perpustakan","perpustakaann","perpustakaanh"],"correct":"perpustakaan","success":"Betul! Ejaan yang betul ialah perpustakaan."},{"prompt":"Pilih penggunaan huruf besar yang betul.","answers":["Saya tinggal di Johor.","saya tinggal di Johor.","Saya tinggal di johor.","saya tinggal di johor."],"correct":"Saya tinggal di Johor.","success":"Betul! Awal ayat dan nama khas menggunakan huruf besar."},{"prompt":"Lengkapkan ayat: Kakak ___ bunga di taman.","answers":["menyiram","menyiram?","Menyiram","menyiram!"],"correct":"menyiram","success":"Betul! Perkataan yang sesuai ialah menyiram."},{"prompt":"Pilih ayat seruan yang sesuai.","answers":["Wah, cantiknya bunga itu!","Wah, cantiknya bunga itu.","Wah cantiknya bunga itu?","wah, cantiknya bunga itu!"],"correct":"Wah, cantiknya bunga itu!","success":"Betul! Ayat seruan menggunakan tanda seru."},{"prompt":"Pilih ejaan yang betul.","answers":["keluarga","keluwarga","keluaga","keluargga"],"correct":"keluarga","success":"Betul! Ejaan yang betul ialah keluarga."},{"prompt":"Susun menjadi ayat yang betul.","answers":["Murid-murid bermain di padang.","Di murid-murid bermain padang.","Bermain padang murid-murid di.","Padang bermain di murid-murid."],"correct":"Murid-murid bermain di padang.","success":"Betul! Ayat itu tersusun dengan baik."},{"prompt":"Pilih ayat penyata.","answers":["Amin membaca buku.","Siapakah nama kamu?","Wah, besarnya rumah itu!","Tolong tutup pintu."],"correct":"Amin membaca buku.","success":"Betul! Ayat penyata memberikan maklumat."},{"prompt":"Pilih tanda baca yang betul: “Selamat pagi, cikgu___”","answers":[".","?",",",";"],"correct":".","success":"Betul! Ucapan itu boleh diakhiri dengan noktah."}]},"pemahaman":{"title":"Pemahaman Petikan","icon":"📖","desc":"Baca maklumat ringkas dan jawab soalan berdasarkan petikan.","questions":[{"prompt":"“Hana membawa bekal nasi goreng ke sekolah.” Apakah bekal Hana?","answers":["nasi goreng","roti","mi goreng","buah"],"correct":"nasi goreng","success":"Betul! Hana membawa nasi goreng."},{"prompt":"“Pada hari Ahad, keluarga Imran berkelah di tepi sungai.” Bilakah mereka berkelah?","answers":["Ahad","Isnin","Jumaat","Sabtu"],"correct":"Ahad","success":"Betul! Mereka berkelah pada hari Ahad."},{"prompt":"“Farid menyiram pokok bunga setiap petang.” Apakah yang dilakukan Farid?","answers":["menyiram pokok bunga","membaca buku","bermain bola","menonton televisyen"],"correct":"menyiram pokok bunga","success":"Betul! Farid menyiram pokok bunga."},{"prompt":"“Kucing Mimi tidur di bawah meja.” Di manakah Mimi tidur?","answers":["di bawah meja","di atas meja","di dalam almari","di luar rumah"],"correct":"di bawah meja","success":"Betul! Mimi tidur di bawah meja."},{"prompt":"“Nadia membeli dua batang pensel dan sebuah buku.” Berapakah batang pensel yang dibeli?","answers":["dua","satu","tiga","empat"],"correct":"dua","success":"Betul! Nadia membeli dua batang pensel."},{"prompt":"“Ravi memakai baju hujan kerana hujan lebat.” Mengapakah Ravi memakai baju hujan?","answers":["kerana hujan lebat","kerana cuaca panas","kerana hendak tidur","kerana bermain bola"],"correct":"kerana hujan lebat","success":"Betul! Dia memakai baju hujan kerana hujan lebat."},{"prompt":"“Cikgu Laila membawa murid ke perpustakaan untuk membaca.” Ke manakah murid dibawa?","answers":["perpustakaan","kantin","padang","makmal"],"correct":"perpustakaan","success":"Betul! Murid dibawa ke perpustakaan."},{"prompt":"“Aiman bangun pada pukul enam pagi lalu menggosok gigi.” Apakah yang dilakukan selepas bangun?","answers":["menggosok gigi","sarapan","bermain","tidur semula"],"correct":"menggosok gigi","success":"Betul! Aiman menggosok gigi selepas bangun."},{"prompt":"“Siti memberi makanan kepada ikan di kolam.” Siapakah yang memberi makanan?","answers":["Siti","ikan","ibu","guru"],"correct":"Siti","success":"Betul! Siti yang memberi makanan."},{"prompt":"“Bas sekolah tiba pada pukul tujuh pagi.” Pukul berapakah bas tiba?","answers":["tujuh pagi","lapan pagi","tujuh malam","enam pagi"],"correct":"tujuh pagi","success":"Betul! Bas tiba pada pukul tujuh pagi."}]},"santun":{"title":"Bahasa Santun & Seni Bahasa","icon":"💬","desc":"Ungkapan sopan, dialog harian, rima dan penggunaan bahasa yang baik.","questions":[{"prompt":"Apakah ucapan sesuai apabila menerima hadiah?","answers":["Terima kasih","Maaf","Tolong","Selamat tinggal"],"correct":"Terima kasih","success":"Betul! Kita mengucapkan terima kasih."},{"prompt":"Pilih ayat permintaan yang paling sopan.","answers":["Boleh saya pinjam pembaris awak?","Beri saya pembaris.","Aku mahu pembaris itu.","Pembaris itu saya punya."],"correct":"Boleh saya pinjam pembaris awak?","success":"Betul! Ayat itu meminta dengan sopan."},{"prompt":"Apakah ucapan sesuai apabila terlanggar rakan?","answers":["Maaf","Tahniah","Selamat datang","Sama-sama"],"correct":"Maaf","success":"Betul! Kita meminta maaf."},{"prompt":"Kawan membantu kamu membawa buku. Apakah jawapan yang sesuai?","answers":["Terima kasih","Jangan","Cepatlah","Diam"],"correct":"Terima kasih","success":"Betul! Ucapkan terima kasih."},{"prompt":"Pilih pasangan perkataan yang berima.","answers":["bunga - mangga","buku - meja","bola - nasi","kaki - susu"],"correct":"bunga - mangga","success":"Betul! Bunga dan mangga mempunyai bunyi akhir yang hampir sama."},{"prompt":"Pilih ungkapan untuk menjemput seseorang masuk.","answers":["Silakan masuk","Jangan masuk","Pergi sana","Tunggu luar"],"correct":"Silakan masuk","success":"Betul! “Silakan masuk” ialah ungkapan sopan."},{"prompt":"Apakah ucapan sesuai apabila rakan berjaya?","answers":["Tahniah","Maaf","Tolong","Selamat malam"],"correct":"Tahniah","success":"Betul! Kita mengucapkan tahniah."},{"prompt":"Pilih ayat yang menunjukkan larangan dengan sopan.","answers":["Jangan berlari di koridor, ya.","Hei, berhenti!","Kamu jangan buat begitu!","Diam sekarang!"],"correct":"Jangan berlari di koridor, ya.","success":"Betul! Ayat itu menyampaikan larangan dengan lebih sopan."},{"prompt":"Pilih kata sapaan yang sesuai untuk guru perempuan.","answers":["Cikgu","Adik","Kawan","Abang"],"correct":"Cikgu","success":"Betul! Kita menyapa guru dengan panggilan Cikgu."},{"prompt":"Apakah jawapan sesuai apabila seseorang mengucapkan “Terima kasih”?","answers":["Sama-sama","Maaf","Tahniah","Selamat pagi"],"correct":"Sama-sama","success":"Betul! “Sama-sama” ialah jawapan yang sesuai."}]}};
const bmYear1Bank={"huruf":{"title":"Huruf, Suku Kata & Perkataan","icon":"🔤","desc":"Kenal huruf, gabung suku kata dan baca perkataan mudah.","questions":[{"prompt":"Huruf pertama bagi perkataan “buku” ialah…","answers":["B","D","P","C"],"correct":"B","success":"Betul! Buku bermula dengan huruf B."},{"prompt":"Huruf terakhir bagi perkataan “mata” ialah…","answers":["M","T","A","K"],"correct":"A","success":"Betul! Mata berakhir dengan huruf A."},{"prompt":"Gabungkan suku kata: BA + JU","answers":["BAJU","BUJU","BAJI","BAJO"],"correct":"BAJU","success":"Betul! BA + JU menjadi BAJU."},{"prompt":"Gabungkan suku kata: BO + LA","answers":["BOLA","BALA","BULA","BELA"],"correct":"BOLA","success":"Hebat! BO + LA menjadi BOLA."},{"prompt":"Pilih suku kata awal bagi “kuda”.","answers":["KU","DA","KA","KI"],"correct":"KU","success":"Betul! Kuda bermula dengan suku kata KU."},{"prompt":"Pilih suku kata akhir bagi “roti”.","answers":["RO","TI","RI","TO"],"correct":"TI","success":"Betul! Roti berakhir dengan suku kata TI."},{"prompt":"Perkataan manakah bermula dengan huruf M?","answers":["mata","baju","susu","roti"],"correct":"mata","success":"Betul! Mata bermula dengan M."},{"prompt":"Perkataan manakah mempunyai dua suku kata?","answers":["buku","sekolah","permainan","keluarga"],"correct":"buku","success":"Betul! BU-KU mempunyai dua suku kata."},{"prompt":"Lengkapkan perkataan: B _ L A","answers":["O","U","E","A"],"correct":"O","success":"Betul! BOLA dieja B-O-L-A."},{"prompt":"Lengkapkan perkataan: S U S _","answers":["A","I","U","O"],"correct":"U","success":"Betul! SUSU berakhir dengan huruf U."}]},"kosa":{"title":"Kosa Kata","icon":"🧠","desc":"Kenal makna perkataan dan penggunaan kosa kata harian.","questions":[{"prompt":"Haiwan yang berbunyi “meow” ialah…","answers":["kucing","ayam","ikan","arnab"],"correct":"kucing","success":"Betul! Kucing berbunyi meow."},{"prompt":"Kita menggunakan pensel untuk…","answers":["menulis","minum","tidur","mandi"],"correct":"menulis","success":"Betul! Pensel digunakan untuk menulis."},{"prompt":"Tempat murid belajar ialah…","answers":["sekolah","pasar","hospital","dapur"],"correct":"sekolah","success":"Betul! Murid belajar di sekolah."},{"prompt":"Lawan perkataan “besar” ialah…","answers":["kecil","tinggi","panjang","sempit"],"correct":"kecil","success":"Betul! Lawan besar ialah kecil."},{"prompt":"Lawan perkataan “panas” ialah…","answers":["sejuk","manis","keras","tinggi"],"correct":"sejuk","success":"Betul! Lawan panas ialah sejuk."},{"prompt":"Buah yang berwarna kuning dan panjang ialah…","answers":["pisang","epal","anggur","oren"],"correct":"pisang","success":"Betul! Pisang biasanya berwarna kuning."},{"prompt":"Kita memakai kasut pada…","answers":["kaki","tangan","kepala","telinga"],"correct":"kaki","success":"Betul! Kasut dipakai pada kaki."},{"prompt":"Benda yang digunakan ketika hujan ialah…","answers":["payung","bantal","sudu","pinggan"],"correct":"payung","success":"Betul! Payung digunakan ketika hujan."},{"prompt":"Perkataan yang sesuai untuk sesuatu yang sedap dimakan ialah…","answers":["lazat","bising","gelap","licin"],"correct":"lazat","success":"Betul! Lazat bermaksud sedap."},{"prompt":"Kita minum apabila berasa…","answers":["dahaga","mengantuk","marah","gembira"],"correct":"dahaga","success":"Betul! Kita minum apabila dahaga."}]},"tatabahasa":{"title":"Tatabahasa Asas","icon":"🧩","desc":"Kata nama, kata kerja, kata adjektif dan penggunaan perkataan mudah.","questions":[{"prompt":"Pilih kata nama.","answers":["bola","lari","cantik","menari"],"correct":"bola","success":"Betul! Bola ialah kata nama."},{"prompt":"Pilih kata kerja.","answers":["makan","meja","merah","cantik"],"correct":"makan","success":"Betul! Makan ialah kata kerja."},{"prompt":"Pilih kata adjektif.","answers":["cantik","buku","duduk","menulis"],"correct":"cantik","success":"Betul! Cantik menerangkan sifat."},{"prompt":"Ali ___ nasi.","answers":["makan","biru","kerusi","cepat"],"correct":"makan","success":"Betul! Ali makan nasi."},{"prompt":"Bunga itu sangat ___.","answers":["cantik","minum","sekolah","tidur"],"correct":"cantik","success":"Betul! Cantik menerangkan bunga."},{"prompt":"___ itu sedang tidur.","answers":["Kucing","Makan","Merah","Berlari"],"correct":"Kucing","success":"Betul! Kucing ialah kata nama."},{"prompt":"Pilih perkataan yang menunjukkan perbuatan.","answers":["berlari","rumah","besar","biru"],"correct":"berlari","success":"Betul! Berlari ialah perbuatan."},{"prompt":"Pilih perkataan yang menunjukkan warna.","answers":["merah","meja","makan","kerusi"],"correct":"merah","success":"Betul! Merah ialah warna."},{"prompt":"Saya ___ air.","answers":["minum","tinggi","buku","makan"],"correct":"minum","success":"Betul! Saya minum air."},{"prompt":"Ayah memandu ___.","answers":["kereta","tidur","manis","nasi"],"correct":"kereta","success":"Betul! Ayah memandu kereta."}]},"faham":{"title":"Pemahaman Ayat","icon":"📖","desc":"Baca ayat mudah dan pilih jawapan berdasarkan maklumat.","questions":[{"prompt":"“Ali ada seekor kucing.” Siapakah yang mempunyai kucing?","answers":["Ali","Siti","Ibu","Abu"],"correct":"Ali","success":"Betul! Ali mempunyai seekor kucing."},{"prompt":"“Siti makan nasi.” Apakah yang Siti makan?","answers":["nasi","roti","buah","mi"],"correct":"nasi","success":"Betul! Siti makan nasi."},{"prompt":"“Bola Amir berwarna biru.” Apakah warna bola Amir?","answers":["merah","biru","hijau","kuning"],"correct":"biru","success":"Betul! Bola Amir berwarna biru."},{"prompt":"“Ibu membeli tiga biji epal.” Berapa biji epal dibeli?","answers":["dua","tiga","empat","lima"],"correct":"tiga","success":"Betul! Ibu membeli tiga biji epal."},{"prompt":"“Aina pergi ke sekolah pada waktu pagi.” Bilakah Aina pergi ke sekolah?","answers":["pagi","petang","malam","tengah hari"],"correct":"pagi","success":"Betul! Aina pergi pada waktu pagi."},{"prompt":"“Ayah membaca surat khabar.” Apakah yang dibaca oleh ayah?","answers":["surat khabar","buku cerita","majalah","surat"],"correct":"surat khabar","success":"Betul! Ayah membaca surat khabar."},{"prompt":"“Adik tidur di dalam bilik.” Di manakah adik tidur?","answers":["bilik","dapur","taman","ruang tamu"],"correct":"bilik","success":"Betul! Adik tidur di dalam bilik."},{"prompt":"“Rina menyiram pokok bunga.” Apakah yang Rina siram?","answers":["pokok bunga","kereta","meja","jalan"],"correct":"pokok bunga","success":"Betul! Rina menyiram pokok bunga."},{"prompt":"“Kamal menaiki bas ke sekolah.” Kamal pergi ke sekolah dengan…","answers":["bas","kapal","basikal","van"],"correct":"bas","success":"Betul! Kamal menaiki bas."},{"prompt":"“Burung itu terbang tinggi.” Apakah yang dilakukan oleh burung?","answers":["terbang","berenang","tidur","menyanyi"],"correct":"terbang","success":"Betul! Burung itu terbang."}]},"menulis":{"title":"Penulisan Asas","icon":"✏️","desc":"Ejaan, susunan perkataan, huruf besar dan tanda baca.","questions":[{"prompt":"Pilih ejaan yang betul.","answers":["sekolah","sakolah","sekulah","sekola"],"correct":"sekolah","success":"Betul! Ejaan yang betul ialah sekolah."},{"prompt":"Pilih ejaan yang betul.","answers":["kereta","kareta","kerita","kreta"],"correct":"kereta","success":"Betul! Ejaan yang betul ialah kereta."},{"prompt":"Pilih ayat dengan huruf besar yang betul.","answers":["Ali makan nasi.","ali makan nasi.","ALI makan nasi.","Ali Makan Nasi."],"correct":"Ali makan nasi.","success":"Betul! Nama khas bermula dengan huruf besar."},{"prompt":"Pilih ayat yang mempunyai tanda noktah.","answers":["Ini buku saya.","Ini buku saya?","Ini buku saya","Ini buku saya!"],"correct":"Ini buku saya.","success":"Betul! Ayat penyata berakhir dengan noktah."},{"prompt":"Susun perkataan menjadi ayat yang betul.","answers":["Saya suka membaca.","Suka saya membaca.","Membaca suka saya.","Saya membaca suka."],"correct":"Saya suka membaca.","success":"Betul! Ayatnya ialah “Saya suka membaca.”"},{"prompt":"Susun perkataan menjadi ayat yang betul.","answers":["Ibu memasak nasi.","Nasi ibu memasak.","Memasak ibu nasi.","Ibu nasi memasak."],"correct":"Ibu memasak nasi.","success":"Betul! Ayatnya ialah “Ibu memasak nasi.”"},{"prompt":"Lengkapkan ayat: Ini ___ saya.","answers":["buku","makan","lari","berlari"],"correct":"buku","success":"Betul! “Ini buku saya.”"},{"prompt":"Lengkapkan ayat: Adik bermain ___.","answers":["bola","tidur","merah","cepat"],"correct":"bola","success":"Betul! “Adik bermain bola.”"},{"prompt":"Pilih ayat soalan.","answers":["Siapa nama kamu?","Nama saya Amin.","Saya suka membaca.","Nama kamu Ali."],"correct":"Siapa nama kamu?","success":"Betul! Ayat itu ialah ayat soalan."},{"prompt":"Pilih ejaan nama yang betul.","answers":["Amin","amin","aMin","AMin"],"correct":"Amin","success":"Betul! Nama orang bermula dengan huruf besar."}]},"santun":{"title":"Bahasa Santun & Seni Bahasa","icon":"💬","desc":"Ungkapan sopan, peribahasa mudah, rima dan penggunaan bahasa yang baik.","questions":[{"prompt":"Apakah yang kita ucap apabila menerima bantuan?","answers":["Terima kasih","Selamat malam","Tahniah","Sama-sama"],"correct":"Terima kasih","success":"Betul! Kita mengucapkan terima kasih."},{"prompt":"Apakah yang kita ucap apabila melakukan kesalahan?","answers":["Maaf","Silakan","Jumpa lagi","Terima kasih"],"correct":"Maaf","success":"Betul! Kita meminta maaf."},{"prompt":"Ucapan yang sesuai apabila bertemu guru pada waktu pagi ialah…","answers":["Selamat pagi","Selamat malam","Selamat tinggal","Selamat petang"],"correct":"Selamat pagi","success":"Betul! Kita mengucapkan selamat pagi."},{"prompt":"Pilih ayat yang lebih sopan.","answers":["Tolong berikan saya pensel.","Beri pensel!","Aku mahu pensel.","Pensel itu saya."],"correct":"Tolong berikan saya pensel.","success":"Betul! Ayat itu lebih sopan."},{"prompt":"Perkataan yang berima dengan “batu” ialah…","answers":["satu","bola","buku","meja"],"correct":"satu","success":"Betul! Batu dan satu mempunyai bunyi akhir yang hampir sama."},{"prompt":"Perkataan yang berima dengan “mata” ialah…","answers":["kata","buku","susu","roti"],"correct":"kata","success":"Betul! Mata dan kata berima."},{"prompt":"Pilih ungkapan yang sesuai untuk memberi izin.","answers":["Silakan","Maaf","Tahniah","Terima kasih"],"correct":"Silakan","success":"Betul! “Silakan” digunakan untuk memberi izin."},{"prompt":"Apakah ucapan sesuai apabila kawan menang pertandingan?","answers":["Tahniah","Maaf","Tolong","Selamat pagi"],"correct":"Tahniah","success":"Betul! Kita mengucapkan tahniah."},{"prompt":"Pilih ayat yang menunjukkan permintaan.","answers":["Boleh saya pinjam buku?","Saya ada buku.","Buku itu biru.","Buku saya di meja."],"correct":"Boleh saya pinjam buku?","success":"Betul! Ayat itu meminta izin dengan sopan."},{"prompt":"Pilih pasangan perkataan yang berima.","answers":["baju - maju","buku - bola","mata - meja","susu - meja"],"correct":"baju - maju","success":"Betul! Baju dan maju berima."}]}};

const mathYear1Bank={"numbers":{"title":"Nombor hingga 100","icon":"🔢","desc":"Kenal, susun, banding dan nilai tempat nombor.","questions":[{"prompt":"Nombor selepas 29 ialah…","answers":["28","30","31","32"],"correct":"30","success":"Betul! Selepas 29 ialah 30."},{"prompt":"Nombor sebelum 50 ialah…","answers":["48","49","51","47"],"correct":"49","success":"Betul! Sebelum 50 ialah 49."},{"prompt":"Pilih nombor paling besar.","answers":["37","73","27","67"],"correct":"73","success":"Hebat! 73 ialah nombor paling besar."},{"prompt":"Pilih nombor paling kecil.","answers":["46","16","61","26"],"correct":"16","success":"Betul! 16 ialah nombor paling kecil."},{"prompt":"Lengkapkan turutan: 12, 13, 14, __","answers":["15","16","17","13"],"correct":"15","success":"Bagus! Selepas 14 ialah 15."},{"prompt":"Lengkapkan turutan: 40, 50, 60, __","answers":["65","70","80","90"],"correct":"70","success":"Tepat! Turutan bertambah 10."},{"prompt":"Dalam nombor 42, digit puluh ialah…","answers":["2","4","6","8"],"correct":"4","success":"Betul! 42 mempunyai 4 puluh."},{"prompt":"Dalam nombor 68, digit sa ialah…","answers":["6","8","14","9"],"correct":"8","success":"Betul! Digit sa bagi 68 ialah 8."},{"prompt":"3 puluh dan 5 sa menjadi…","answers":["30","35","53","25"],"correct":"35","success":"Hebat! 3 puluh dan 5 sa ialah 35."},{"prompt":"Manakah sama dengan 80?","answers":["8 puluh","8 sa","18 puluh","80 puluh"],"correct":"8 puluh","success":"Betul! 8 puluh bersamaan 80."}]},"addsub":{"title":"Tambah & Tolak","icon":"➕","desc":"Operasi tambah dan tolak asas dalam lingkungan 100.","questions":[{"prompt":"7 + 5 = ?","answers":["11","12","13","14"],"correct":"12","success":"Betul! 7 tambah 5 ialah 12."},{"prompt":"14 + 3 = ?","answers":["16","17","18","15"],"correct":"17","success":"Betul! 14 tambah 3 ialah 17."},{"prompt":"20 + 6 = ?","answers":["24","26","28","25"],"correct":"26","success":"Hebat! 20 tambah 6 ialah 26."},{"prompt":"32 + 10 = ?","answers":["40","42","52","44"],"correct":"42","success":"Betul! 32 tambah 10 ialah 42."},{"prompt":"15 - 4 = ?","answers":["9","11","12","10"],"correct":"11","success":"Betul! 15 tolak 4 ialah 11."},{"prompt":"28 - 8 = ?","answers":["18","20","22","19"],"correct":"20","success":"Tepat! 28 tolak 8 ialah 20."},{"prompt":"40 - 10 = ?","answers":["20","30","50","25"],"correct":"30","success":"Bagus! 40 tolak 10 ialah 30."},{"prompt":"Ali ada 6 guli. Dia mendapat 3 lagi. Jumlah guli?","answers":["8","9","10","12"],"correct":"9","success":"Betul! 6 tambah 3 ialah 9 guli."},{"prompt":"Siti ada 12 epal. Dia beri 2 epal. Tinggal?","answers":["9","10","14","11"],"correct":"10","success":"Betul! 12 tolak 2 tinggal 10."},{"prompt":"Manakah ayat matematik yang jawapannya 15?","answers":["10 + 5","10 + 4","10 - 5","8 + 5"],"correct":"10 + 5","success":"Hebat! 10 tambah 5 ialah 15."}]},"money":{"title":"Wang","icon":"💰","desc":"Kenal duit Malaysia dan kira nilai wang mudah.","questions":[{"prompt":"Syiling manakah bernilai paling besar?","answers":["10 sen","20 sen","50 sen","5 sen"],"correct":"50 sen","success":"Betul! 50 sen paling besar."},{"prompt":"RM1 bersamaan berapa sen?","answers":["10 sen","50 sen","100 sen","20 sen"],"correct":"100 sen","success":"Betul! RM1 bersamaan 100 sen."},{"prompt":"20 sen + 20 sen = ?","answers":["30 sen","40 sen","50 sen","60 sen"],"correct":"40 sen","success":"Tepat! Jumlahnya 40 sen."},{"prompt":"50 sen + 50 sen = ?","answers":["RM1","RM2","RM5","90 sen"],"correct":"RM1","success":"Betul! 50 sen tambah 50 sen ialah RM1."},{"prompt":"RM2 + RM3 = ?","answers":["RM4","RM5","RM6","RM7"],"correct":"RM5","success":"Hebat! RM2 tambah RM3 ialah RM5."},{"prompt":"Harga pensel RM1. Ali bayar RM2. Baki ialah…","answers":["RM1","RM2","RM3","50 sen"],"correct":"RM1","success":"Betul! Bakinya RM1."},{"prompt":"Harga buku RM4. Duit Siti RM5. Adakah duitnya cukup?","answers":["Ya","Tidak","Kurang RM1","Kurang RM2"],"correct":"Ya","success":"Betul! RM5 cukup untuk membeli buku RM4."},{"prompt":"Pilih jumlah yang lebih banyak.","answers":["RM2","RM5","RM1","RM4"],"correct":"RM5","success":"Betul! RM5 paling banyak."},{"prompt":"Dua keping RM1 bernilai…","answers":["RM1","RM2","RM10","RM3"],"correct":"RM2","success":"Betul! Dua keping RM1 ialah RM2."},{"prompt":"10 sen + 20 sen + 20 sen = ?","answers":["40 sen","50 sen","60 sen","70 sen"],"correct":"50 sen","success":"Bagus! Jumlahnya 50 sen."}]},"time":{"title":"Masa & Waktu","icon":"🕒","desc":"Jam, hari dan urutan aktiviti harian.","questions":[{"prompt":"Jika jarum pendek pada 3 dan jarum panjang pada 12, waktunya…","answers":["2:00","3:00","3:30","4:00"],"correct":"3:00","success":"Betul! Waktunya pukul 3."},{"prompt":"1 jam mempunyai berapa minit?","answers":["30","60","100","120"],"correct":"60","success":"Betul! 1 jam mempunyai 60 minit."},{"prompt":"Hari selepas Isnin ialah…","answers":["Ahad","Selasa","Rabu","Jumaat"],"correct":"Selasa","success":"Betul! Selepas Isnin ialah Selasa."},{"prompt":"Hari sebelum Jumaat ialah…","answers":["Rabu","Khamis","Sabtu","Ahad"],"correct":"Khamis","success":"Betul! Sebelum Jumaat ialah Khamis."},{"prompt":"Biasanya kita sarapan pada waktu…","answers":["pagi","petang","malam","tengah hari"],"correct":"pagi","success":"Betul! Sarapan biasanya pada waktu pagi."},{"prompt":"Biasanya kita tidur pada waktu…","answers":["pagi","tengah hari","malam","petang"],"correct":"malam","success":"Betul! Kita biasanya tidur pada waktu malam."},{"prompt":"Pukul 7:00 dibaca sebagai…","answers":["pukul tujuh","pukul lapan","pukul tujuh setengah","pukul enam"],"correct":"pukul tujuh","success":"Betul! 7:00 ialah pukul tujuh."},{"prompt":"Jika sekarang pukul 2:00, satu jam kemudian ialah…","answers":["1:00","3:00","4:00","2:30"],"correct":"3:00","success":"Betul! Satu jam selepas 2:00 ialah 3:00."},{"prompt":"Antara berikut, manakah lebih lama?","answers":["1 minit","1 jam","10 minit","30 minit"],"correct":"1 jam","success":"Betul! 1 jam lebih lama."},{"prompt":"Susunan hari yang betul ialah…","answers":["Isnin, Selasa, Rabu","Isnin, Rabu, Selasa","Selasa, Isnin, Rabu","Isnin, Selasa, Khamis"],"correct":"Isnin, Selasa, Rabu","success":"Betul! Itu susunan hari yang betul."}]},"measure":{"title":"Ukuran & Sukatan","icon":"📏","desc":"Banding panjang, jisim dan isi padu secara asas.","questions":[{"prompt":"Pensel 15 cm dan pemadam 5 cm. Yang lebih panjang ialah…","answers":["pensel","pemadam","sama panjang","tidak dapat ditentukan"],"correct":"pensel","success":"Betul! Pensel lebih panjang."},{"prompt":"Gajah dan kucing. Yang lebih berat ialah…","answers":["kucing","gajah","sama berat","tidak dapat ditentukan"],"correct":"gajah","success":"Betul! Gajah lebih berat."},{"prompt":"Baldi dan cawan. Yang boleh mengisi lebih banyak air ialah…","answers":["cawan","baldi","sama banyak","tidak dapat ditentukan"],"correct":"baldi","success":"Betul! Baldi mempunyai kapasiti lebih besar."},{"prompt":"Unit yang sesuai untuk mengukur panjang buku ialah…","answers":["sentimeter","ringgit","jam","kilogram"],"correct":"sentimeter","success":"Betul! Sentimeter sesuai untuk panjang buku."},{"prompt":"Antara 9 cm dan 12 cm, yang lebih panjang ialah…","answers":["9 cm","12 cm","sama","10 cm"],"correct":"12 cm","success":"Tepat! 12 cm lebih panjang."},{"prompt":"Beg berisi 5 buku dan beg berisi 1 buku. Yang biasanya lebih berat ialah…","answers":["beg 5 buku","beg 1 buku","sama","tidak dapat ditentukan"],"correct":"beg 5 buku","success":"Betul! Beg dengan 5 buku biasanya lebih berat."},{"prompt":"Botol penuh dan botol separuh penuh. Yang mempunyai lebih banyak air ialah…","answers":["botol penuh","botol separuh","sama","kedua-duanya kosong"],"correct":"botol penuh","success":"Betul! Botol penuh mempunyai lebih banyak air."},{"prompt":"Pilih objek yang biasanya paling pendek.","answers":["pemadam","pintu","meja","almari"],"correct":"pemadam","success":"Betul! Pemadam biasanya paling pendek."},{"prompt":"Pilih objek yang biasanya paling ringan.","answers":["bulu","kerusi","peti ais","meja"],"correct":"bulu","success":"Betul! Bulu biasanya paling ringan."},{"prompt":"Bekas A muat 2 cawan air. Bekas B muat 5 cawan. Yang lebih besar kapasitinya ialah…","answers":["Bekas A","Bekas B","sama","tidak dapat ditentukan"],"correct":"Bekas B","success":"Betul! Bekas B mempunyai kapasiti lebih besar."}]},"shapes":{"title":"Bentuk & Data","icon":"🔷","desc":"Kenal bentuk asas dan baca maklumat mudah.","questions":[{"prompt":"Bentuk yang mempunyai 3 sisi ialah…","answers":["bulatan","segi tiga","segi empat sama","segi lima"],"correct":"segi tiga","success":"Betul! Segi tiga mempunyai 3 sisi."},{"prompt":"Bentuk yang mempunyai 4 sisi sama panjang ialah…","answers":["segi empat sama","bulatan","segi tiga","segi empat tepat"],"correct":"segi empat sama","success":"Betul! Segi empat sama mempunyai 4 sisi sama panjang."},{"prompt":"Bentuk yang tiada sisi lurus ialah…","answers":["bulatan","segi tiga","segi empat tepat","segi lima"],"correct":"bulatan","success":"Betul! Bulatan tiada sisi lurus."},{"prompt":"Objek manakah menyerupai sfera?","answers":["bola","buku","pintu","kotak"],"correct":"bola","success":"Betul! Bola menyerupai sfera."},{"prompt":"Objek manakah menyerupai kubus?","answers":["dadu","pinggan","pensel","botol"],"correct":"dadu","success":"Betul! Dadu menyerupai kubus."},{"prompt":"Data buah: Epal 4, Oren 2, Pisang 3. Buah paling banyak ialah…","answers":["Epal","Oren","Pisang","Epal dan Pisang sama banyak"],"correct":"Epal","success":"Betul! Epal paling banyak."},{"prompt":"Data buku: Ali 2, Siti 5. Siapa mempunyai lebih banyak buku?","answers":["Ali","Siti","Sama","Ali dan Siti sama banyak"],"correct":"Siti","success":"Betul! Siti mempunyai lebih banyak buku."},{"prompt":"Ada 3 bulatan dan 1 segi tiga. Bentuk paling banyak ialah…","answers":["bulatan","segi tiga","sama","bulatan dan segi tiga sama banyak"],"correct":"bulatan","success":"Betul! Bulatan paling banyak."},{"prompt":"Segi empat tepat mempunyai berapa sisi?","answers":["3","4","5","6"],"correct":"4","success":"Betul! Segi empat tepat mempunyai 4 sisi."},{"prompt":"Antara berikut, yang manakah bentuk 3D?","answers":["kubus","segi tiga","bulatan","segi empat sama"],"correct":"kubus","success":"Betul! Kubus ialah bentuk tiga dimensi."}]}};

function showSubscriptionGate(profile,context='latihan'){
  const sub=subscriptionState(profile),expired=sub.expired;
  $('#gameContent').innerHTML=`<div class="subscription-gate"><div class="gate-icon">🔒</div><small>Akses Premium CilikGo</small>
    <h2>${expired?'Langganan telah tamat':'Langganan diperlukan'}</h2>
    <p>${expired?'Perbaharui langganan untuk meneruskan latihan Tahun 1–6.':'Aktifkan langganan untuk membuka Ruang Pelajar dan latihan mengikut tahun, subjek serta topik.'}</p>
    <div class="gate-plan"><span>${expired?'Pembaharuan':'Pakej Permulaan'}</span><b>${expired?'RM15':'RM69'}</b><small>${expired?'1 bulan':'4 bulan'}</small></div>
    <div class="gate-actions"><button class="btn primary" disabled>${expired?'Renew RM15':'Langgan RM69'}</button><button class="btn ghost" id="gateBack">Kembali</button></div>
    <p class="gate-note">ToyyibPay masih KIV.</p></div>`;
  if(!$('#gameModal').open) $('#gameModal').showModal();
  $('#gateBack').onclick=()=>$('#gameModal').close();
}



document.addEventListener('click',e=>{
  const a=e.target.closest?.('.parent-subscription-nav,#parentSubscriptionLink');
  if(a && currentProfile?.role==='user'){e.preventDefault();setRoleNav(false);renderParentSubscriptionView(currentProfile);}
});


document.addEventListener('click',e=>{
  const a=e.target.closest?.('.parent-learning-nav');
  if(a && currentProfile?.role==='user'){
    e.preventDefault();
    renderParentLearningHub(currentProfile);
  }
});
