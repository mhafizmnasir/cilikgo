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



const QUIZ_QUESTIONS_PER_SESSION=10;
const QUIZ_MAX_STARS=QUIZ_QUESTIONS_PER_SESSION*3;
const QUIZ_MASTERY_STARS=16;

function normalizedQuizStars(row){
  const stars=Math.max(0,Number(row?.stars||0));
  const questions=Math.max(1,Number(row?.questions||5));
  if(questions===QUIZ_QUESTIONS_PER_SESSION)return Math.min(QUIZ_MAX_STARS,stars);
  return Math.min(QUIZ_MAX_STARS,Math.round(stars*(QUIZ_QUESTIONS_PER_SESSION/questions)));
}

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


/* ===== CilikGo sound mode (background music removed by request) ===== */
let cgAudioCtx=null,cgMusicTimer=null,cgMusicOn=false;
function scheduleCgMusic(){}
async function startCgMusic(){
  try{
    cgAudioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
    await cgAudioCtx.resume();
  }catch(e){console.warn('Audio unavailable',e);}
}
function stopCgMusic(){
  clearTimeout(cgMusicTimer);cgMusicTimer=null;
  if(cgAudioCtx?.state==='running') cgAudioCtx.suspend().catch(()=>{});
}
function updateMusicButton(){}


function animateIn(scope=document){
  const coarse=window.matchMedia?.('(pointer: coarse)').matches;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  scope.querySelectorAll('.year-portal-card,.student-subject-card,.subject-topic-card,.stat,.quick-stat,.parent-subject-mini,.content-subject-card').forEach((el,i)=>{
    const step=reduced?0:(coarse?18:35);
    el.style.setProperty('--delay',`${Math.min(i,8)*step}ms`);
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
$('#authBackHomeMobile')?.addEventListener('click',()=>{history.pushState(null,'','#home');showPublicPage();window.scrollTo({top:0,behavior:'smooth'});});
document.querySelectorAll('.role-choice').forEach(b=>b.onclick=()=>setAuthRole(b.dataset.roleChoice));

const REFERRAL_TTL_MS=30*24*60*60*1000;
let pendingRegistrationProfile=null;
function normalizeReferralCode(value){
  const clean=String(value||'').trim();
  return /^CG-[A-Za-z0-9_-]{7,128}$/.test(clean)?clean:null;
}
function getStoredReferralCode(){
  const savedAt=Number(localStorage.getItem('cilikgo_ref_saved_at')||0);
  if(!savedAt||Date.now()-savedAt>REFERRAL_TTL_MS){
    localStorage.removeItem('cilikgo_ref');
    localStorage.removeItem('cilikgo_ref_saved_at');
    return null;
  }
  const code=normalizeReferralCode(localStorage.getItem('cilikgo_ref'));
  if(!code){
    localStorage.removeItem('cilikgo_ref');
    localStorage.removeItem('cilikgo_ref_saved_at');
  }
  return code;
}
function saveReferralCode(value){
  const code=normalizeReferralCode(value);
  if(!code)return null;
  localStorage.setItem('cilikgo_ref',code);
  localStorage.setItem('cilikgo_ref_saved_at',String(Date.now()));
  return code;
}
async function claimReferralForCurrentUser(profile){
  const code=getStoredReferralCode();
  if(!code||!fb?.auth?.currentUser||profile?.role!=='user')return profile;
  if(profile?.referredByCode||profile?.referredByAgentUid)return profile;
  try{
    const token=await fb.auth.currentUser.getIdToken();
    const res=await fetch(`${FUNCTIONS_BASE_URL}/claimReferral`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({referralCode:code})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok){
      if(!['REFERRAL_ALREADY_CLAIMED','PAID_CUSTOMER_CANNOT_CLAIM'].includes(data.code||''))console.warn('claimReferral',data.error||res.status);
      return profile;
    }
    return {...profile,referredByCode:data.referredByCode||code,referredByAgentUid:data.agentUid||profile.referredByAgentUid||null};
  }catch(e){
    console.warn('claimReferral',e);
    return profile;
  }
}

const ref = new URLSearchParams(location.search).get('ref');
if(ref&&saveReferralCode(ref)) toast('Kod agent telah direkodkan.');
$('#agentSignupBtn').onclick=()=>showAuthPage('register','agent');

function friendlyError(e){
  return ({'auth/invalid-credential':'E-mel atau kata laluan tidak tepat.','auth/email-already-in-use':'E-mel ini sudah didaftarkan.','auth/weak-password':'Kata laluan terlalu lemah.','auth/too-many-requests':'Terlalu banyak cubaan. Cuba semula sebentar lagi.','auth/user-disabled':'Akaun ini telah dinyahaktifkan.'})[e.code] || e.message || 'Ralat tidak diketahui.';
}

$('#registerBtn').onclick=async()=>{
  const name=$('#regName').value.trim(), email=$('#regEmail').value.trim(), pass=$('#regPassword').value, role=$('#regRole').value;
  if(!name||!email||pass.length<6) return toast('Sila lengkapkan maklumat. Kata laluan minimum 6 aksara.');
  if(!fb) return toast('Firebase tidak dapat disambungkan.');
  const referredByCode=role==='user'?getStoredReferralCode():null;
  pendingRegistrationProfile={name,email,role,referredByCode};
  try{
    const cred=await fb.createUserWithEmailAndPassword(fb.auth,email,pass);
    const agentCode=role==='agent'?'CG-'+cred.user.uid:null;
    const profileData={name,email,role,agentCode,referredByCode,createdAt:fb.serverTimestamp(),subscriptionStatus:'inactive'};
    await fb.setDoc(fb.doc(fb.db,'users',cred.user.uid),profileData,{merge:true});
    pendingRegistrationProfile=null;
    toast('Akaun berjaya didaftarkan.');
  }catch(e){
    console.error(e);
    pendingRegistrationProfile=null;
    toast(friendlyError(e));
  }
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
  const ref=fb.doc(fb.db,'users',user.uid);
  const snap=await fb.getDoc(ref);
  if(snap.exists()) return {uid:user.uid,...snap.data()};

  const pending=pendingRegistrationProfile&&String(pendingRegistrationProfile.email||'').toLowerCase()===String(user.email||'').toLowerCase()
    ? pendingRegistrationProfile:null;
  const role=pending?.role||'user';
  const fallback={
    name:pending?.name||user.displayName||user.email?.split('@')[0]||'Pengguna',
    email:user.email||pending?.email||'',
    role,
    agentCode:role==='agent'?'CG-'+user.uid:null,
    referredByCode:role==='user'?(pending?.referredByCode||getStoredReferralCode()||null):null,
    subscriptionStatus:'inactive',
    createdAt:fb.serverTimestamp()
  };
  await fb.setDoc(ref,fallback,{merge:true});
  return {uid:user.uid,...fallback};
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

function formatMoney(value){
  return `RM${Number(value||0).toFixed(2)}`;
}

function nextSaturdayDate(base=new Date()){
  const d=new Date(base);
  d.setHours(0,0,0,0);
  const diff=(6-d.getDay()+7)%7;
  d.setDate(d.getDate()+diff);
  return d;
}

function nextSaturdayLabel(base=new Date()){
  return nextSaturdayDate(base).toLocaleDateString('ms-MY',{
    weekday:'long',day:'2-digit',month:'short',year:'numeric'
  });
}

function agentBankReady(profile){
  return !!(
    String(profile?.payoutBankName||'').trim()
    && String(profile?.payoutAccountName||'').trim()
    && String(profile?.payoutAccountNumber||'').trim()
  );
}

function agentBankSummary(profile){
  if(!agentBankReady(profile)) return 'Belum lengkap';
  return `${String(profile.payoutBankName).trim()} · ${String(profile.payoutAccountNumber).trim()}`;
}



const SUBSCRIPTION_PLANS={
  lifetime:{id:'lifetime',name:'Akses Lifetime',amount:45,durationMonths:null},
  starter3:{id:'starter3',name:'Akses 3 Bulan',amount:45,durationMonths:3},
  renewal:{id:'renewal',name:'Pembaharuan Bulanan',amount:15,durationMonths:1}
};
const SUBSCRIPTION_BUSINESS={
  lifetimePrice:45,
  starterPrice:45,
  starterMonths:3,
  renewalPrice:15,
  renewalMonths:1,
  newSubscriberCommission:30,
  renewalCommission:10
};
const DEFAULT_MANUAL_PAYMENT_SETTINGS={
  lifetimePromoActive:true,
  bankName:'',
  accountName:'',
  accountNumber:'',
  adminWhatsapp:''
};
let cachedManualPaymentSettings=null;

function subscriptionState(p){
  const lifetime=p?.subscriptionLifetime===true||p?.subscriptionType==='lifetime';
  const raw=p?.subscriptionEndsAt?.toDate?.()||p?.subscriptionEndsAt||null;
  const end=raw?new Date(raw):null;
  const active=p?.subscriptionStatus==='active'&&(lifetime||!!(end&&end.getTime()>Date.now()));
  const expired=!lifetime&&!!end&&end.getTime()<=Date.now();
  return {active,expired,lifetime,end,status:active?'active':expired?'expired':(p?.subscriptionStatus||'inactive')};
}
function subscriptionDaysLeft(p){
  const state=subscriptionState(p);
  if(state.lifetime&&state.active)return null;
  return state.active&&state.end?Math.max(0,Math.ceil((state.end-Date.now())/86400000)):0;
}
function hasPaidSubscriptionBefore(p){
  return p?.customerPaidOnce===true||!!p?.subscriptionStartedAt||!!p?.lastPaymentOrderId||!!p?.subscriptionEndsAt;
}
async function loadManualPaymentSettings(force=false){
  if(cachedManualPaymentSettings&&!force)return cachedManualPaymentSettings;
  const settings={...DEFAULT_MANUAL_PAYMENT_SETTINGS};
  if(!fb?.db){cachedManualPaymentSettings=settings;return settings;}
  try{
    const snap=await fb.getDoc(fb.doc(fb.db,'settings','manualPayment'));
    if(snap.exists())Object.assign(settings,snap.data()||{});
  }catch(e){console.warn('manual payment settings',e);}
  settings.lifetimePromoActive=settings.lifetimePromoActive!==false;
  cachedManualPaymentSettings=settings;
  return settings;
}
function applyPublicBusinessConfig(settings){
  const promo=settings?.lifetimePromoActive!==false;
  const tag=$('#publicPricingTag'),title=$('#publicPricingTitle'),desc=$('#publicPricingDesc');
  const amount=$('#publicPricingAmount'),period=$('#publicPricingPeriod'),after=$('#publicPricingAfter');
  if(tag)tag.textContent=promo?'Promosi Lifetime':'Pelan Pengguna Baharu';
  if(title)title.textContent=promo?'Akses Lifetime CilikGo':'3 Bulan Akses CilikGo';
  if(desc)desc.textContent=promo
    ?'Bayar sekali dan nikmati akses pembelajaran CilikGo tanpa bayaran bulanan sepanjang promosi.'
    :'Pengguna baharu mendapat 3 bulan akses. Selepas tempoh tersebut, pembaharuan ialah RM15 sebulan.';
  if(amount)amount.textContent='RM45';
  if(period)period.textContent=promo?'sekali bayar · akses Lifetime':'untuk 3 bulan pertama';
  if(after)after.innerHTML=promo?'<b>Promosi terhad</b> untuk pengguna baharu.':'Selepas itu <b>RM15/bulan</b>.';
}
function normalizeWhatsapp(value){return String(value||'').replace(/\D/g,'');}
function manualWhatsappUrl(settings,p,planText){
  const phone=normalizeWhatsapp(settings?.adminWhatsapp);
  if(!phone)return '';
  const text=`Assalamualaikum Admin CilikGo. Saya ${p?.name||p?.email||'pengguna CilikGo'} telah membuat pembayaran ${planText}. Saya ingin menghantar bukti pembayaran untuk pengaktifan akaun.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
function manualBankReady(settings){
  return !!(settings?.bankName&&settings?.accountName&&settings?.accountNumber&&normalizeWhatsapp(settings?.adminWhatsapp));
}
function addMonthsClient(date,months){
  const d=new Date(date);
  const day=d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth()+months);
  const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  d.setDate(Math.min(day,last));
  return d;
}
async function resolveAgentClient(profile,buyerUid,overrideCode=null){
  if(profile?.referredByAgentUid&&profile.referredByAgentUid!==buyerUid){
    const snap=await fb.getDoc(fb.doc(fb.db,'users',profile.referredByAgentUid));
    const data=snap.exists()?snap.data():{};
    if(data.role==='agent')return {agentUid:snap.id,agentRef:data.agentCode||profile.referredByCode||null};
  }
  const code=normalizeReferralCode(profile?.referredByCode)||normalizeReferralCode(overrideCode);
  if(!code)return {agentUid:null,agentRef:null};
  const q=fb.query(fb.collection(fb.db,'users'),fb.where('agentCode','==',code),fb.limit(5));
  const snap=await fb.getDocs(q);
  const doc=snap.docs.find(d=>d.id!==buyerUid&&(d.data()||{}).role==='agent');
  return doc?{agentUid:doc.id,agentRef:code}:{agentUid:null,agentRef:null};
}
function backendUnavailableStatus(status){
  return [404,408,429,500,502,503,504].includes(Number(status));
}
async function adminSubscriptionFirestoreFallback(targetUid,action,requestId,agentCodeOverride=null){
  if(currentProfile?.role!=='admin')throw new Error('Akses Admin diperlukan.');
  const settings=await loadManualPaymentSettings(true);
  const userRef=fb.doc(fb.db,'users',targetUid);
  const initialSnap=await fb.getDoc(userRef);
  if(!initialSnap.exists())throw new Error('Akaun Penjaga tidak ditemui.');
  const initial=initialSnap.data()||{};
  if(initial.role!=='user')throw new Error('Hanya akaun Penjaga boleh dilanggan.');
  const referral=await resolveAgentClient(initial,targetUid,agentCodeOverride);
  const operationId=`MAN-${requestId}`;
  const auditRef=fb.doc(fb.db,'subscriptionAudit',operationId);
  const orderRef=fb.doc(fb.db,'orders',operationId);
  const commissionRef=fb.doc(fb.db,'commissions',operationId);
  const mailRef=fb.doc(fb.db,'mailQueue',operationId);

  return fb.runTransaction(fb.db,async tx=>{
    const [auditSnap,userSnap]=await Promise.all([tx.get(auditRef),tx.get(userRef)]);
    if(auditSnap.exists()){
      const existing=auditSnap.data()||{};
      return {alreadyProcessed:true,action:existing.action||action,emailQueued:existing.emailQueued===true,fallback:true};
    }
    if(!userSnap.exists())throw new Error('Akaun Penjaga tidak ditemui.');
    const profile=userSnap.data()||{};
    const now=new Date();
    const currentEnd=profile.subscriptionEndsAt?.toDate?.()||null;
    const lifetime=profile.subscriptionLifetime===true||profile.subscriptionType==='lifetime';
    const paidBefore=profile.customerPaidOnce===true||!!profile.subscriptionStartedAt||!!profile.lastPaymentOrderId;

    let amount=0,months=0,endDate=null,planLabel='',commissionAmount=0,commissionType=null;
    let userUpdate={updatedAt:fb.serverTimestamp()};
    if(action!=='expire'&&referral.agentUid&&!profile.referredByAgentUid&&!profile.referredByCode){
      userUpdate.referredByCode=referral.agentRef;
      userUpdate.referredByAgentUid=referral.agentUid;
      userUpdate.referralClaimedAt=fb.serverTimestamp();
      userUpdate.referralClaimSource=agentCodeOverride?'admin_activation_override':'stored_referral';
    }

    if(action==='expire'){
      userUpdate={...userUpdate,subscriptionStatus:'expired',subscriptionLifetime:false,subscriptionType:'expired',subscriptionEndsAt:fb.Timestamp.fromDate(now)};
    }else if(action==='lifetime'){
      if(settings.lifetimePromoActive===false)throw new Error('Promosi Lifetime telah tamat.');
      if(paidBefore||lifetime)throw new Error('Lifetime hanya untuk pelanggan baharu yang belum pernah melanggan.');
      amount=45; planLabel='Akses Lifetime CilikGo';
      commissionAmount=referral.agentUid?30:0;
      commissionType=commissionAmount?'new_subscriber':null;
      userUpdate={...userUpdate,subscriptionStatus:'active',subscriptionLifetime:true,subscriptionType:'lifetime',
        subscriptionEndsAt:fb.deleteField(),subscriptionStartedAt:profile.subscriptionStartedAt||fb.serverTimestamp(),
        customerPaidOnce:true,firstPaidAt:profile.firstPaidAt||fb.serverTimestamp(),lastPaymentOrderId:operationId};
    }else if(action==='starter3'){
      if(settings.lifetimePromoActive!==false)throw new Error('Pelan 3 bulan bermula selepas promosi Lifetime tamat.');
      if(paidBefore)throw new Error('Pelan permulaan 3 bulan hanya untuk pelanggan baharu.');
      amount=45; months=3; endDate=addMonthsClient(now,months); planLabel='Akses CilikGo 3 Bulan';
      commissionAmount=referral.agentUid?30:0;
      commissionType=commissionAmount?'new_subscriber':null;
      userUpdate={...userUpdate,subscriptionStatus:'active',subscriptionLifetime:false,subscriptionType:'time_limited',
        subscriptionStartedAt:profile.subscriptionStartedAt||fb.serverTimestamp(),subscriptionEndsAt:fb.Timestamp.fromDate(endDate),
        customerPaidOnce:true,firstPaidAt:profile.firstPaidAt||fb.serverTimestamp(),lastPaymentOrderId:operationId};
    }else if(action==='renewal'){
      if(lifetime)throw new Error('Akaun Lifetime tidak memerlukan pembaharuan.');
      if(!paidBefore)throw new Error('Aktifkan pelan pelanggan baharu terlebih dahulu.');
      amount=15; months=1; endDate=addMonthsClient(currentEnd&&currentEnd>now?currentEnd:now,months); planLabel='Pembaharuan CilikGo 1 Bulan';
      commissionAmount=referral.agentUid?10:0;
      commissionType=commissionAmount?'monthly_renewal':null;
      userUpdate={...userUpdate,subscriptionStatus:'active',subscriptionLifetime:false,subscriptionType:'time_limited',
        subscriptionStartedAt:profile.subscriptionStartedAt||fb.serverTimestamp(),subscriptionEndsAt:fb.Timestamp.fromDate(endDate),
        customerPaidOnce:true,lastPaymentOrderId:operationId};
    }else{
      throw new Error('Tindakan langganan tidak sah.');
    }

    tx.set(userRef,userUpdate,{merge:true});

    if(action!=='expire'){
      tx.set(orderRef,{
        userUid:targetUid,userEmail:profile.email||'',agentUid:referral.agentUid,agentRef:referral.agentRef,agentCode:referral.agentRef,
        plan:action,planName:planLabel,amount,months:months||null,currency:'MYR',status:'paid',
        paymentStatus:'manual_verified',paymentMethod:'bank_transfer_manual',verificationMethod:'whatsapp_proof',
        adminUid:fb.auth.currentUser.uid,paidAt:fb.serverTimestamp(),createdAt:fb.serverTimestamp(),updatedAt:fb.serverTimestamp()
      });
      if(commissionAmount>0&&referral.agentUid){
        tx.set(commissionRef,{
          agentUid:referral.agentUid,agentCode:referral.agentRef,userUid:targetUid,orderId:operationId,plan:action,
          saleAmount:amount,commissionType,rateType:'fixed',
          rateLabel:commissionType==='new_subscriber'?'RM30 pelanggan baharu':'RM10 pembaharuan bulanan',
          amount:commissionAmount,status:'pending',createdAt:fb.serverTimestamp()
        });
      }
      if(profile.email){
        tx.set(mailRef,{
          to:profile.email,name:profile.name||'Pengguna CilikGo',plan:action,planLabel,
          lifetime:action==='lifetime',endsAt:endDate?fb.Timestamp.fromDate(endDate):null,
          appUrl:`${location.origin}${location.pathname.replace(/\/[^/]*$/,'/') }#dashboard`,
          status:'queued',userUid:targetUid,orderId:operationId,createdAt:fb.serverTimestamp()
        });
      }
    }

    tx.set(auditRef,{
      userUid:targetUid,userEmail:profile.email||null,action,previousStatus:profile.subscriptionStatus||'inactive',
      previousLifetime:lifetime,previousEndsAt:currentEnd?fb.Timestamp.fromDate(currentEnd):null,
      newStatus:action==='expire'?'expired':'active',newLifetime:action==='lifetime',
      newEndsAt:endDate?fb.Timestamp.fromDate(endDate):null,source:'admin_manual_bank_transfer_browser_fallback',
      adminUid:fb.auth.currentUser.uid,orderId:action==='expire'?null:operationId,commissionAmount,
      emailQueued:action!=='expire'&&!!profile.email,createdAt:fb.serverTimestamp()
    });

    return {alreadyProcessed:false,action,orderId:action==='expire'?null:operationId,
      endDate:endDate?endDate.toISOString():null,lifetime:action==='lifetime',
      commissionAmount,emailQueued:action!=='expire'&&!!profile.email,fallback:true};
  });
}
async function adminRepairCommissionFirestoreFallback(targetUid,agentCode){
  if(currentProfile?.role!=='admin')throw new Error('Akses Admin diperlukan.');
  const code=normalizeReferralCode(agentCode);
  if(!code)throw new Error('Pilih Agent yang sah dahulu.');
  const userRef=fb.doc(fb.db,'users',targetUid);
  const userSnap=await fb.getDoc(userRef);
  if(!userSnap.exists())throw new Error('Akaun Penjaga tidak ditemui.');
  const profile=userSnap.data()||{};
  const referral=await resolveAgentClient({},targetUid,code);
  if(!referral.agentUid)throw new Error('Kod Agent tidak sah.');
  if(profile.referredByAgentUid&&profile.referredByAgentUid!==referral.agentUid)throw new Error('Akaun ini sudah dikaitkan dengan Agent lain.');
  if(profile.referredByCode&&profile.referredByCode!==referral.agentRef)throw new Error('Akaun ini sudah dikaitkan dengan Agent lain.');

  const ordersSnap=await fb.getDocs(fb.query(fb.collection(fb.db,'orders'),fb.where('userUid','==',targetUid)));
  const paidOrders=ordersSnap.docs.map(d=>({id:d.id,ref:d.ref,...d.data()}))
    .filter(o=>o.status==='paid')
    .sort((a,b)=>(b.paidAt?.toMillis?.()||b.createdAt?.toMillis?.()||0)-(a.paidAt?.toMillis?.()||a.createdAt?.toMillis?.()||0));
  const order=paidOrders.find(o=>!o.agentUid)||paidOrders[0];
  if(!order)throw new Error('Tiada transaksi berbayar untuk dibaiki.');

  const orderRef=fb.doc(fb.db,'orders',order.id);
  const commissionRef=fb.doc(fb.db,'commissions',order.id);
  const auditRef=fb.doc(fb.db,'subscriptionAudit',`REPAIR-${order.id}`);
  const commissionAmount=order.plan==='renewal'?10:30;
  const commissionType=order.plan==='renewal'?'monthly_renewal':'new_subscriber';

  return fb.runTransaction(fb.db,async tx=>{
    const [freshOrder,existingCommission]=await Promise.all([tx.get(orderRef),tx.get(commissionRef)]);
    if(!freshOrder.exists())throw new Error('Tiada transaksi berbayar untuk dibaiki.');
    if(existingCommission.exists()){
      const c=existingCommission.data()||{};
      return {alreadyProcessed:true,orderId:order.id,commissionAmount:Number(c.amount||commissionAmount),agentUid:c.agentUid||referral.agentUid,fallback:true};
    }
    const fresh=freshOrder.data()||{};
    if(fresh.agentUid&&fresh.agentUid!==referral.agentUid)throw new Error('Transaksi ini sudah dikaitkan dengan Agent lain.');

    tx.set(userRef,{referredByCode:referral.agentRef,referredByAgentUid:referral.agentUid,
      referralClaimedAt:profile.referralClaimedAt||fb.serverTimestamp(),referralClaimSource:'admin_repair',
      updatedAt:fb.serverTimestamp()},{merge:true});
    tx.set(orderRef,{agentUid:referral.agentUid,agentRef:referral.agentRef,agentCode:referral.agentRef,
      updatedAt:fb.serverTimestamp()},{merge:true});
    tx.set(commissionRef,{agentUid:referral.agentUid,agentCode:referral.agentRef,userUid:targetUid,
      orderId:order.id,plan:fresh.plan||order.plan||'lifetime',saleAmount:Number(fresh.amount||order.amount||45),
      commissionType,rateType:'fixed',rateLabel:commissionType==='new_subscriber'?'RM30 pelanggan baharu':'RM10 pembaharuan bulanan',
      amount:commissionAmount,status:'pending',createdAt:fb.serverTimestamp()});
    tx.set(auditRef,{userUid:targetUid,action:'repair_referral_commission',source:'admin_browser_fallback',
      adminUid:fb.auth.currentUser.uid,orderId:order.id,agentUid:referral.agentUid,agentCode:referral.agentRef,
      commissionAmount,createdAt:fb.serverTimestamp()});
    return {alreadyProcessed:false,orderId:order.id,commissionAmount,agentUid:referral.agentUid,fallback:true};
  });
}
async function callAdminSubscriptionAction(targetUid,action,agentCodeOverride=null){
  if(!fb?.auth.currentUser)throw new Error('Sila log masuk semula.');
  const token=await fb.auth.currentUser.getIdToken();
  const requestId=(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g,'');
  const payload={targetUid,action,requestId,agentCodeOverride:normalizeReferralCode(agentCodeOverride)};
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{
    const res=await fetch(`${FUNCTIONS_BASE_URL}/adminManageSubscription`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify(payload),
      signal:controller.signal
    });
    const contentType=res.headers.get('content-type')||'';
    const data=contentType.includes('application/json')?await res.json().catch(()=>({})):{};
    if(res.ok)return data;
    if(!backendUnavailableStatus(res.status))throw new Error(data.error||`Backend mengembalikan ralat ${res.status}.`);
    console.warn('Backend subscription tidak tersedia, guna fallback Firestore.',res.status);
  }catch(e){
    if(!(e?.name==='AbortError'||e instanceof TypeError))throw e;
    console.warn('Backend subscription gagal dicapai, guna fallback Firestore.',e);
  }finally{
    clearTimeout(timeout);
  }
  const result=await adminSubscriptionFirestoreFallback(targetUid,action,requestId,agentCodeOverride);
  toast('Backend Firebase Functions tidak dapat dicapai. Pengaktifan diproses melalui fallback Admin.');
  return result;
}
async function callAdminRepairCommission(targetUid,agentCode){
  if(!fb?.auth.currentUser)throw new Error('Sila log masuk semula.');
  const code=normalizeReferralCode(agentCode);
  if(!code)throw new Error('Pilih Agent yang sah dahulu.');
  const token=await fb.auth.currentUser.getIdToken();
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{
    const res=await fetch(`${FUNCTIONS_BASE_URL}/adminRepairReferralCommission`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({targetUid,agentCode:code}),
      signal:controller.signal
    });
    const contentType=res.headers.get('content-type')||'';
    const data=contentType.includes('application/json')?await res.json().catch(()=>({})):{};
    if(res.ok)return data;
    if(!backendUnavailableStatus(res.status))throw new Error(data.error||`Backend mengembalikan ralat ${res.status}.`);
    console.warn('Backend repair commission tidak tersedia, guna fallback Firestore.',res.status);
  }catch(e){
    if(!(e?.name==='AbortError'||e instanceof TypeError))throw e;
    console.warn('Backend repair commission gagal dicapai, guna fallback Firestore.',e);
  }finally{
    clearTimeout(timeout);
  }
  const result=await adminRepairCommissionFirestoreFallback(targetUid,code);
  toast('Backend Firebase Functions tidak dapat dicapai. Pembaikan komisen diproses melalui fallback Admin.');
  return result;
}


function renderParentRightNav(p,active='overview'){
  const items=[
    ['overview','⌂','Utama','#dashboard'],
    ['report','📊','Report Kad','#report-card'],
    ['student','🎒','Ruang Pelajar','#student'],
    ['subscription','💳','Langganan','#subscription'],
    ['settings','⚙️','Tetapan','#settings']
  ];
  return `<aside class="dash-side clean-side role-drawer parent-unified-nav">
    <button class="role-nav-close" type="button" aria-label="Tutup menu">×</button>
    <div class="side-role"><span>👨‍👩‍👧</span><div><small>PORTAL</small><h3>Penjaga</h3></div></div>
    <nav class="parent-role-menu">${items.map(([key,icon,label,href])=>`<a href="${href}" data-parent-route="${key}" class="${active===key?'active':''}">${icon} <span>${label}</span></a>`).join('')}</nav>
    <div class="side-foot"><small>Akaun</small><b>${esc(p.name||p.email||'Penjaga')}</b><button class="side-logout-btn" data-parent-route="logout">↪ Log Keluar</button></div>
  </aside>`;
}

function wireParentRightNav(p){
  document.querySelectorAll('#dashboard [data-parent-route]').forEach(el=>{
    el.onclick=async e=>{
      e.preventDefault();
      const route=el.dataset.parentRoute;
      setRoleNav(false);
      if(route==='logout'){await logoutCilikGo();return;}
      if(route==='overview'){history.pushState(null,'','#dashboard');await renderUser(p);return;}
      if(route==='report'){history.pushState(null,'','#report-card');await renderParentReportCard(p);return;}
      if(route==='student'){history.pushState(null,'','#student');await renderStudentPortal(p);return;}
      if(route==='subscription'){history.pushState(null,'','#subscription');await renderParentSubscriptionView(p);return;}
      if(route==='settings'){history.pushState(null,'','#settings');await renderParentSettingsView(p);return;}
    };
  });
}

async function renderParentSubscriptionView(p){
  if(fb?.auth.currentUser?.uid===p?.uid){p=await getProfile(fb.auth.currentUser);currentProfile=p;}
  setRoleNav(false);
  document.body.classList.remove('student-mode');
  showDashboardPage();
  if(location.hash!=='#subscription') history.pushState(null,'','#subscription');
  const settings=await loadManualPaymentSettings();
  applyPublicBusinessConfig(settings);
  const sub=subscriptionState(p),days=subscriptionDaysLeft(p);
  const startRaw=p?.subscriptionStartedAt?.toDate?.()||p?.subscriptionStartedAt||null;
  const start=startRaw?new Date(startRaw):null;
  const end=sub.end;
  const active=sub.active,expired=sub.expired,lifetime=sub.lifetime;
  const paidBefore=hasPaidSubscriptionBefore(p);
  const promo=settings.lifetimePromoActive!==false;

  const title=lifetime&&active?'Akses Lifetime Aktif':active?'Langganan Aktif':expired?'Langganan Tamat':'Belum Melanggan';
  const desc=lifetime&&active
    ?'Akaun anda mempunyai akses Lifetime CilikGo. Tiada bayaran bulanan diperlukan.'
    :active
      ?`Akses penuh latihan CilikGo sedang aktif. Anda mempunyai ${days} hari lagi.`
      :expired
        ?'Akses latihan CilikGo dikunci sehingga pembaharuan RM15 disahkan oleh Admin.'
        :'Pembayaran dibuat secara pindahan bank. Selepas bukti dihantar melalui WhatsApp, Admin akan mengaktifkan akaun secara manual.';

  let paymentAmount=15,paymentPlan='Pembaharuan 1 bulan',paymentAction='renewal';
  if(!paidBefore&&!active&&!expired){
    paymentAmount=45;
    paymentPlan=promo?'Promosi Lifetime':'Akses 3 bulan';
    paymentAction=promo?'lifetime':'starter3';
  }
  const whatsappUrl=manualWhatsappUrl(settings,p,`${paymentPlan} RM${paymentAmount}`);
  const bankReady=manualBankReady(settings);

  $('#dashboard').innerHTML=`<div class="dash-shell parent-shell clean-shell parent-sub-shell">
    ${renderParentRightNav(p,'subscription')}
    <section class="dash-main clean-main parent-sub-main">
      <section class="parent-sub-page manual-sub-page">
        <div class="parent-sub-hero">
          <span class="badge">${lifetime&&active?'LIFETIME':active?'AKTIF':expired?'TAMAT':promo?'PROMOSI LIFETIME':'PELAN CILIKGO'}</span>
          <h1>${title}</h1><p>${desc}</p>
        </div>
        <div class="parent-sub-card manual-sub-status-card">
          <div>
            <small>Pelan semasa</small>
            <h2>${lifetime&&active?'Akses Lifetime CilikGo':active?'Akses Penuh CilikGo':expired?'Perlu Pembaharuan':'Belum aktif'}</h2>
            <div class="sub-detail-grid">
              <div><small>Tarikh mula</small><b>${start?start.toLocaleDateString('ms-MY'):'-'}</b></div>
              <div><small>Tarikh tamat</small><b>${lifetime&&active?'Lifetime':end?end.toLocaleDateString('ms-MY'):'-'}</b></div>
              <div><small>Baki akses</small><b>${lifetime&&active?'∞ Lifetime':active?days+' hari':expired?'0 hari':'-'}</b></div>
              <div><small>Status</small><b>${lifetime&&active?'Lifetime Aktif':active?'Aktif':expired?'Tamat':'Belum aktif'}</b></div>
            </div>
          </div>
          <div class="parent-sub-price ${lifetime&&active?'lifetime-active':''}">
            ${lifetime&&active?`<span class="manual-plan-icon">♾️</span><b>Lifetime</b><span>Tiada pembaharuan diperlukan</span><small>Akses kekal aktif selagi akaun mematuhi terma CilikGo.</small>`:`<b>RM${paymentAmount}</b><span>${esc(paymentPlan)}</span><small>Pembayaran manual melalui pindahan bank</small>`}
          </div>
        </div>
        ${lifetime&&active?'':`<section class="manual-payment-card">
          <div class="manual-payment-head"><div><small>CARA PEMBAYARAN</small><h2>Transfer bank → WhatsApp Admin</h2></div><span class="manual-payment-badge">RM${paymentAmount}</span></div>
          ${bankReady?`<div class="manual-bank-grid">
            <div><small>Bank</small><b>${esc(settings.bankName)}</b></div>
            <div><small>Nama akaun</small><b>${esc(settings.accountName)}</b></div>
            <div class="wide"><small>Nombor akaun</small><b class="manual-account-number">${esc(settings.accountNumber)}</b><button class="btn ghost small" id="copyBankAccount">Salin</button></div>
          </div>`:`<div class="manual-payment-warning">⚠️ Maklumat bank/WhatsApp belum ditetapkan. Admin perlu lengkapkan <b>Admin → Tetapan → Pembayaran Manual</b> terlebih dahulu.</div>`}
          <ol class="manual-payment-steps"><li><span>1</span><div><b>Transfer RM${paymentAmount}</b><small>Buat pindahan ke akaun bank CilikGo yang dipaparkan di atas.</small></div></li><li><span>2</span><div><b>Hantar bukti melalui WhatsApp</b><small>Hantar screenshot/resit pembayaran kepada Admin CilikGo.</small></div></li><li><span>3</span><div><b>Admin aktifkan akaun</b><small>Selepas disahkan, Admin akan mengaktifkan akses secara manual.</small></div></li><li><span>4</span><div><b>Terima e-mel pengesahan</b><small>CilikGo akan menghantar e-mel apabila akses anda sudah aktif.</small></div></li></ol>
          <div class="manual-payment-actions"><a class="btn primary ${whatsappUrl?'':'disabled'}" id="manualWhatsappBtn" ${whatsappUrl?`href="${esc(whatsappUrl)}" target="_blank" rel="noopener"`:'aria-disabled="true"'}>📲 WhatsApp Bukti Pembayaran</a></div>
          ${promo&&!paidBefore?'<p class="manual-promo-note">🎉 <b>Promosi Lifetime RM45:</b> bayar sekali untuk akses Lifetime. Selepas promosi tamat, pengguna baharu mendapat 3 bulan akses pada RM45 dan pembaharuan seterusnya RM15/bulan.</p>':''}
        </section>`}
        <div class="parent-sub-info"><b>${active?'✓ Akses anda sedang aktif':'ℹ Pengaktifan dibuat secara manual'}</b><p>${active?(lifetime?'Akaun Lifetime anda tidak mempunyai tarikh tamat.':'Anda boleh menggunakan semua latihan CilikGo sehingga tarikh tamat di atas.'):'Tiada payment gateway digunakan. Admin hanya mengaktifkan akaun selepas bukti pindahan bank diterima melalui WhatsApp.'}</p></div>
      </section>
    </section>
  </div>`;
  wireParentRightNav(p);
  $('#copyBankAccount')?.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(settings.accountNumber||'');toast('Nombor akaun disalin.');}catch{toast('Sila salin nombor akaun secara manual.');}
  });
  if(!whatsappUrl)$('#manualWhatsappBtn')?.addEventListener('click',e=>{e.preventDefault();toast('Nombor WhatsApp Admin belum ditetapkan.');});
  animateIn($('#dashboard'));
}


async function renderParentLearningHub(p){ return renderStudentPortal(p); }

async function renderStudentPortal(p){
  if(!fb?.auth.currentUser){showAuthPage('login');return;}
  if(fb.auth.currentUser.uid===p?.uid){p=await getProfile(fb.auth.currentUser);currentProfile=p;}
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

  showDashboardPage();
  if(location.hash!=='#student') history.pushState(null,'','#student');
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
    sr.forEach(r=>topics.set(r.topic,Math.max(topics.get(r.topic)||0,normalizedQuizStars(r))));
    const vals=[...topics.values()];
    const mastered=vals.filter(v=>v>=QUIZ_MASTERY_STARS).length;
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

  root.innerHTML=`<div class="dash-shell parent-shell clean-shell parent-learning-shell">${renderParentRightNav(p,'student')}<section class="dash-main clean-main student-parent-main"><section class="student-portal interactive-student embedded-student">
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

      <button type="button" class="student-year-focus student-year-toggle" id="studentYearToggle" aria-expanded="false" aria-controls="studentExpandedContent" aria-label="Buka kandungan Tahun ${year}">
        <div class="student-year-focus-icon">🎒</div>
        <div><small>TAHUN PEMBELAJARAN SAYA</small><h3>Tahun ${year}</h3><p>${year===1?'Tekan untuk lihat semua subjek Tahun 1.':year===2?'Tekan untuk buka Bahasa Melayu Tahun 2 dan lihat subjek lain.':`Kandungan Tahun ${year} akan dibuka apabila bank latihan tersedia.`}</p></div>
        <span class="student-year-focus-badge"><b>${year===1?'Aktif':year===2?'BM tersedia':'Akan datang'}</b><em>Buka ↓</em></span>
      </button>

      <div class="student-expanded-content" id="studentExpandedContent" hidden>
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
              <div class="subject-progress-meta"><span>${st.attempts?`${st.attempts} sesi`:'Belum mula'}</span><b>${st.best?`⭐ ${st.best}/${QUIZ_MAX_STARS}`:'Mula belajar'}</b></div>
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
        <div><small>TIP CILIKGO</small><p>Belajar 10–15 minit setiap sesi lebih mudah untuk kekal fokus. Pilih satu subjek dahulu dan cuba capai sekurang-kurangnya ⭐ 16/30.</p></div>
      </section>
      </div>
    </main>
  </section></section></div>`;

  wireParentRightNav(p);

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

  const yearToggle=$('#studentYearToggle');
  const expandedContent=$('#studentExpandedContent');
  yearToggle?.addEventListener('click',()=>{
    if(!expandedContent)return;
    const willOpen=expandedContent.hidden;
    expandedContent.hidden=!willOpen;
    yearToggle.setAttribute('aria-expanded',willOpen?'true':'false');
    yearToggle.classList.toggle('expanded',willOpen);
    const action=yearToggle.querySelector('.student-year-focus-badge em');
    if(action) action.textContent=willOpen?'Tutup ↑':'Buka ↓';
  });

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
  const host=$('#gameMsg');
  const box=host?.querySelector('.quiz-feedback-box.correct');
  if(!host||!box)return;

  host.querySelectorAll('.quiz-feedback-badge,.quiz-feedback-sparkles').forEach(n=>n.remove());
  box.classList.remove('quiz-feedback-celebrate');
  void box.offsetWidth;
  box.classList.add('quiz-feedback-celebrate');

  const badge=document.createElement('div');
  badge.className='quiz-feedback-badge';
  badge.innerHTML='<span>🎉</span><b>Hebat!</b><span>✨</span>';

  const sparks=document.createElement('div');
  sparks.className='quiz-feedback-sparkles';
  const icons=['🎉','✨','⭐','🌟','🎊','💫','✨','⭐'];
  sparks.innerHTML=icons.map((icon,i)=>{
    const x=8 + i*12;
    const y=(i%2===0?0:8);
    const drift=(i%2===0?-24:24);
    const rise=22 + (i%3)*8;
    const delay=(i*0.04).toFixed(2);
    const size=16 + (i%3)*3;
    return `<i class="quiz-feedback-spark" style="--x:${x}%;--y:${y}px;--drift:${drift}px;--rise:${rise}px;--delay:${delay}s;--size:${size}px">${icon}</i>`;
  }).join('');

  host.appendChild(badge);
  host.appendChild(sparks);

  setTimeout(()=>{
    badge.remove();
    sparks.remove();
    box.classList.remove('quiz-feedback-celebrate');
  },1350);
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


let cgUiSfxCtx=null;
let cgLastUiClickAt=0;

function getCgUiSfxContext(){
  try{
    if(typeof cgAudioCtx!=='undefined'&&cgAudioCtx){
      if(cgAudioCtx.state==='suspended') cgAudioCtx.resume().catch(()=>{});
      return cgAudioCtx;
    }
    cgUiSfxCtx ||= new (window.AudioContext||window.webkitAudioContext)();
    if(cgUiSfxCtx.state==='suspended') cgUiSfxCtx.resume().catch(()=>{});
    return cgUiSfxCtx;
  }catch(e){
    return null;
  }
}

function playCgUiSfx(kind='tap'){
  const ctx=getCgUiSfxContext();
  if(!ctx)return;
  const now=Date.now();
  if(kind==='tap'&&now-cgLastUiClickAt<45)return;
  if(kind==='tap') cgLastUiClickAt=now;

  const toneMap={
    tap:{from:640,to:520,duration:.07,gain:.028,type:'sine'},
    success:{from:720,to:980,duration:.16,gain:.055,type:'triangle'},
    error:{from:240,to:170,duration:.18,gain:.05,type:'square'}
  };
  const cfg=toneMap[kind]||toneMap.tap;
  const osc=ctx.createOscillator();
  const gain=ctx.createGain();
  const t=ctx.currentTime+.006;
  osc.type=cfg.type;
  osc.frequency.setValueAtTime(cfg.from,t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(cfg.to,1),t+cfg.duration);
  gain.gain.setValueAtTime(.0001,t);
  gain.gain.exponentialRampToValueAtTime(cfg.gain,t+.01);
  gain.gain.exponentialRampToValueAtTime(.0001,t+cfg.duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t+cfg.duration+.02);
}

function installCgUiClickSfx(){
  document.addEventListener('click',e=>{
    const el=e.target.closest('button,a,[role="button"],.quiz-answer,[data-open],[data-auth]');
    if(!el)return;
    if(el.disabled||el.getAttribute?.('disabled')!==null||el.getAttribute?.('aria-disabled')==='true')return;
    playCgUiSfx('tap');
  },true);
}
installCgUiClickSfx();

function cleanQuizFeedbackText(message,isEnglish=false){
  const raw=String(message||'').trim();
  const withoutIcon=raw.replace(/^[✓✔]\s*/,'');
  const withoutLead=withoutIcon.replace(/^(Betul!|Correct!)\s*/i,'').trim();
  if(withoutLead)return withoutLead;
  return isEnglish?'Great job!':'Tahniah!';
}

function buildQuizFeedback(type,{title='',body='',meta='',reward=''}={}){
  const safeTitle=esc(title||'');
  const safeBody=esc(body||'');
  const safeMeta=esc(meta||'');
  const safeReward=esc(reward||'');
  const icon=type==='correct'?'✓':'✕';
  return `<div class="quiz-feedback-box ${type}">
    <div class="quiz-feedback-icon" aria-hidden="true">${icon}</div>
    <div class="quiz-feedback-copy"><b>${safeTitle}</b><span>${safeBody}</span></div>
    <div class="quiz-feedback-side">${safeReward?`<strong class="quiz-feedback-reward">${safeReward}</strong>`:''}${safeMeta?`<small class="quiz-feedback-meta">${safeMeta}</small>`:''}</div>
  </div>`;
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

  const questions=[...topic.questions].sort(()=>Math.random()-.5).slice(0,QUIZ_QUESTIONS_PER_SESSION);
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

          <div class="quiz-reference-scene clean-reference-scene">
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
        $('#gameMsg').innerHTML=buildQuizFeedback('wrong',{title:cfg.wrong,body:isEnglish?'Try another answer.':'Cuba pilihan lain.',meta:isEnglish?`Attempt ${attemptsThisQuestion}`:`Percubaan ${attemptsThisQuestion}`});
        quizScreenEffect('wrong');
        playCgUiSfx('error');
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

      $('#gameMsg').innerHTML=buildQuizFeedback('correct',{title:cfg.correct,body:cleanQuizFeedbackText(q.success||cfg.correct,isEnglish),reward:`+${earned} ⭐`});
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
      playCgUiSfx('success');
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
    const passed=scoreStars>=QUIZ_MASTERY_STARS,pct=Math.round(scoreStars/QUIZ_MAX_STARS*100),isEnglish=cfg.lang.startsWith('en');
    const animals=quizSceneAnimals(subjectKey,topicKey);
    const completionCopy=passed
      ?(isEnglish?'Amazing work! Keep exploring more topics.':'Hebat! Teruskan belajar topik yang lain.')
      :(isEnglish?'Great effort! Try again to collect more stars.':'Usaha yang baik! Cuba lagi untuk kumpul lebih banyak bintang.');
    const masteryTip=passed
      ?(isEnglish?'⭐ This topic is marked as mastered based on your best score.':'⭐ Topik ini ditanda dikuasai berdasarkan rekod terbaik anda.')
      :(isEnglish?'Aim for at least ⭐ 16/30 to master this topic.':'Sasarkan sekurang-kurangnya ⭐ 16/30 untuk kuasai topik ini.');

    $('#gameContent').innerHTML=`<section class="quiz-fullscreen-shell reference-quiz quiz-result-reference subject-${cfg.key}">
      <div class="forest-canopy" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="forest-floor" aria-hidden="true"><span>🌼</span><span>🌸</span><span>🍄</span><span>🌻</span><span>🌺</span></div>

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
                <strong class="board-prompt-focus">${scoreStars} / ${QUIZ_MAX_STARS}</strong>
                <span class="board-prompt-lead">${correctCount}/${questions.length} ${cfg.questionsDone.toLowerCase()}</span>
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
              <b>${correctCount}/${questions.length}</b>
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
        level:1,year:1,subject:cfg.key,topic:topicKey,questions:questions.length,
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

  const questions=[...topic.questions].sort(()=>Math.random()-.5).slice(0,QUIZ_QUESTIONS_PER_SESSION);
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

          <div class="quiz-reference-scene clean-reference-scene">
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
        $('#gameMsg').innerHTML=buildQuizFeedback('wrong',{title:cfg.wrong,body:isEnglish?'Try another answer.':'Cuba pilihan lain.',meta:isEnglish?`Attempt ${attemptsThisQuestion}`:`Percubaan ${attemptsThisQuestion}`});
        quizScreenEffect('wrong');
        playCgUiSfx('error');
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

      $('#gameMsg').innerHTML=buildQuizFeedback('correct',{title:cfg.correct,body:cleanQuizFeedbackText(q.success||cfg.correct,isEnglish),reward:`+${earned} ⭐`});
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
      playCgUiSfx('success');
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
    const passed=scoreStars>=QUIZ_MASTERY_STARS,pct=Math.round(scoreStars/QUIZ_MAX_STARS*100),isEnglish=cfg.lang.startsWith('en');
    const animals=quizSceneAnimals(subjectKey,topicKey);
    const completionCopy=passed
      ?(isEnglish?'Amazing work! Keep exploring more topics.':'Hebat! Teruskan belajar topik yang lain.')
      :(isEnglish?'Great effort! Try again to collect more stars.':'Usaha yang baik! Cuba lagi untuk kumpul lebih banyak bintang.');
    const masteryTip=passed
      ?(isEnglish?'⭐ This topic is marked as mastered based on your best score.':'⭐ Topik ini ditanda dikuasai berdasarkan rekod terbaik anda.')
      :(isEnglish?'Aim for at least ⭐ 16/30 to master this topic.':'Sasarkan sekurang-kurangnya ⭐ 16/30 untuk kuasai topik ini.');

    $('#gameContent').innerHTML=`<section class="quiz-fullscreen-shell reference-quiz quiz-result-reference subject-${cfg.key}">
      <div class="forest-canopy" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="forest-floor" aria-hidden="true"><span>🌼</span><span>🌸</span><span>🍄</span><span>🌻</span><span>🌺</span></div>

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
                <strong class="board-prompt-focus">${scoreStars} / ${QUIZ_MAX_STARS}</strong>
                <span class="board-prompt-lead">${correctCount}/${questions.length} ${cfg.questionsDone.toLowerCase()}</span>
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
              <b>${correctCount}/${questions.length}</b>
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
        level:1,year:2,subject:cfg.key,topic:topicKey,questions:questions.length,
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
    bm:{name:'Bahasa Melayu',short:'BM',icon:'🇲🇾',theme:'bm',bank:bmYear1Bank,activity:'kssr_bm_y1_',start:startBmYear1Topic,back:'Semua Subjek',kicker:'BAHASA MELAYU TAHUN 1',heading:'Pilih topik Bahasa Melayu',intro:'Pilih satu topik dan lengkapkan 10 soalan. Rekod terbaik digunakan untuk menunjukkan penguasaan.',startLabel:'Mula Latihan',againLabel:'Latih Lagi',notStarted:'Belum dimainkan',bestLabel:'Rekod terbaik'},
    bi:{name:'Bahasa Inggeris',short:'BI',icon:'🔤',theme:'bi',bank:biYear1Bank,activity:'kssr_bi_y1_',start:startBiYear1Topic,back:'Semua Subjek',kicker:'ENGLISH YEAR 1',heading:'Choose an English topic',intro:'Choose one topic and complete 10 questions. Your best score is used to show topic mastery.',startLabel:'Start Practice',againLabel:'Practise Again',notStarted:'Not attempted yet',bestLabel:'Best score'},
    math:{name:'Matematik',short:'MT',icon:'➗',theme:'math',bank:mathYear1Bank,activity:'kssr_math_y1_',start:startMathYear1Topic,back:'Semua Subjek',kicker:'MATEMATIK TAHUN 1',heading:'Pilih topik Matematik',intro:'Pilih satu topik dan lengkapkan 10 soalan. Rekod terbaik digunakan untuk menunjukkan penguasaan.',startLabel:'Mula Latihan',againLabel:'Latih Lagi',notStarted:'Belum dimainkan',bestLabel:'Rekod terbaik'},
    science:{name:'Sains',short:'SN',icon:'🔬',theme:'science',bank:scienceYear1Bank,activity:'kssr_science_y1_',start:startScienceYear1Topic,back:'Semua Subjek',kicker:'SAINS TAHUN 1',heading:'Pilih topik Sains',intro:'Pilih satu topik dan lengkapkan 10 soalan. Rekod terbaik digunakan untuk menunjukkan penguasaan.',startLabel:'Mula Latihan',againLabel:'Latih Lagi',notStarted:'Belum dimainkan',bestLabel:'Rekod terbaik'}
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

  showDashboardPage();
  if(location.hash!=='#student') history.pushState(null,'','#student');
  const root=$('#dashboard'),rows=await loadProgress(p.uid,activeChild.id);
  const keys=Object.keys(cfg.bank);
  const bestFor=k=>{
    const vals=rows.filter(r=>r.activity===`${cfg.activity}${k}`).map(normalizedQuizStars);
    return vals.length?Math.max(...vals):0;
  };
  const playedFor=k=>rows.filter(r=>r.activity===`${cfg.activity}${k}`).length;
  const completed=keys.filter(k=>bestFor(k)>=QUIZ_MASTERY_STARS).length;
  const totalBest=keys.reduce((n,k)=>n+bestFor(k),0);
  const progressPct=Math.round(completed/keys.length*100);

  root.innerHTML=`<div class="dash-shell parent-shell clean-shell parent-learning-shell">${renderParentRightNav(p,'student')}<section class="dash-main clean-main student-parent-main"><section class="subject-hub-shell subject-${cfg.theme}">
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
          <div class="mastery-chip">⭐ Sasaran penguasaan 16/30</div>
        </div>
        <div class="subject-topic-grid">${keys.map((k,i)=>{
          const t=cfg.bank[k],best=bestFor(k),played=playedFor(k),mastered=best>=QUIZ_MASTERY_STARS;
          const pct=Math.round(best/QUIZ_MAX_STARS*100);
          return `<article class="subject-topic-card ${mastered?'mastered':''}">
            <div class="topic-card-head">
              <span class="topic-card-number">${String(i+1).padStart(2,'0')}</span>
              <span class="topic-card-icon">${t.icon}</span>
              <span class="topic-card-state ${mastered?'done':''}">${mastered?'✓ Dikuasai':played?'Sedang belajar':'Belum mula'}</span>
            </div>
            <div class="topic-card-copy"><small>TOPIK ${i+1}</small><h3>${esc(t.title)}</h3><p>${esc(t.desc)}</p></div>
            <div class="topic-card-progress">
              <div><span>${played?`${cfg.bestLabel}:`:'Status:'}</span><b>${played?`⭐ ${best}/${QUIZ_MAX_STARS}`:cfg.notStarted}</b></div>
              <div class="subject-progress-bar"><span style="width:${pct}%"></span></div>
            </div>
            <button class="subject-topic-btn" data-subject-topic="${k}">${played?cfg.againLabel:cfg.startLabel}<span>→</span></button>
          </article>`;
        }).join('')}</div>
      </section>

      <section class="subject-footer-note"><span>💡</span><p><b>Tip:</b> Buat satu topik pada satu masa. Pelajar boleh mencuba semula sehingga mendapat jawapan yang betul.</p></section>
    </main>
  </section></section></div>`;

  wireParentRightNav(p);
  $('.subject-back').onclick=()=>renderStudentPortal(p);
  document.querySelectorAll('[data-subject-topic]').forEach(b=>b.onclick=()=>cfg.start(b.dataset.subjectTopic));
  animateIn(root);
}


function year2BmSubjectConfig(){
  return {name:'Bahasa Melayu',short:'BM',icon:'🇲🇾',theme:'bm',bank:bmYear2Bank,activity:'kssr_bm_y2_',start:startBmYear2Topic,back:'Semua Subjek',kicker:'BAHASA MELAYU TAHUN 2',heading:'Pilih topik Bahasa Melayu Tahun 2',intro:'Latihan Tahun 2 disusun mengikut kemahiran bahasa. Lengkapkan 10 soalan bagi setiap sesi.',startLabel:'Mula Latihan',againLabel:'Latih Lagi',notStarted:'Belum dimainkan',bestLabel:'Rekod terbaik'};
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

  showDashboardPage();
  if(location.hash!=='#student') history.pushState(null,'','#student');
  const root=$('#dashboard'),rows=await loadProgress(p.uid,activeChild.id);
  const keys=Object.keys(cfg.bank);
  const bestFor=k=>{
    const vals=rows.filter(r=>r.activity===`${cfg.activity}${k}`).map(normalizedQuizStars);
    return vals.length?Math.max(...vals):0;
  };
  const playedFor=k=>rows.filter(r=>r.activity===`${cfg.activity}${k}`).length;
  const completed=keys.filter(k=>bestFor(k)>=QUIZ_MASTERY_STARS).length;
  const totalBest=keys.reduce((n,k)=>n+bestFor(k),0);
  const progressPct=Math.round(completed/keys.length*100);

  root.innerHTML=`<div class="dash-shell parent-shell clean-shell parent-learning-shell">${renderParentRightNav(p,'student')}<section class="dash-main clean-main student-parent-main"><section class="subject-hub-shell subject-${cfg.theme}">
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
          <div class="mastery-chip">⭐ Sasaran penguasaan 16/30</div>
        </div>
        <div class="subject-topic-grid">${keys.map((k,i)=>{
          const t=cfg.bank[k],best=bestFor(k),played=playedFor(k),mastered=best>=QUIZ_MASTERY_STARS;
          const pct=Math.round(best/QUIZ_MAX_STARS*100);
          return `<article class="subject-topic-card ${mastered?'mastered':''}">
            <div class="topic-card-head">
              <span class="topic-card-number">${String(i+1).padStart(2,'0')}</span>
              <span class="topic-card-icon">${t.icon}</span>
              <span class="topic-card-state ${mastered?'done':''}">${mastered?'✓ Dikuasai':played?'Sedang belajar':'Belum mula'}</span>
            </div>
            <div class="topic-card-copy"><small>TOPIK ${i+1}</small><h3>${esc(t.title)}</h3><p>${esc(t.desc)}</p></div>
            <div class="topic-card-progress">
              <div><span>${played?`${cfg.bestLabel}:`:'Status:'}</span><b>${played?`⭐ ${best}/${QUIZ_MAX_STARS}`:cfg.notStarted}</b></div>
              <div class="subject-progress-bar"><span style="width:${pct}%"></span></div>
            </div>
            <button class="subject-topic-btn" data-subject-topic="${k}">${played?cfg.againLabel:cfg.startLabel}<span>→</span></button>
          </article>`;
        }).join('')}</div>
      </section>

      <section class="subject-footer-note"><span>💡</span><p><b>Tip:</b> Buat satu topik pada satu masa. Pelajar boleh mencuba semula sehingga mendapat jawapan yang betul.</p></section>
    </main>
  </section></section></div>`;

  wireParentRightNav(p);
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


function renderMetricPalette(items,extraClass=''){
  return `<div class="metric-palette-grid ${extraClass}">${(items||[]).map(item=>`<article class="metric-card tone-${item.tone||'purple'}"><div class="metric-card-top"><span class="metric-icon">${item.icon||'📊'}</span><span class="metric-label">${esc(item.label||'')}</span></div><b>${esc(String(item.value??'—'))}</b><small>${esc(item.meta||'')}</small></article>`).join('')}</div>`;
}
function renderRoleHero(role='parent',{kicker='',title='',description='',pills=[]}={}){
  const palettes={
    parent:{accent:'#a897ff',accent2:'#d8d0ff',icon:'🎒',label:'Ruang belajar teratur'},
    agent:{accent:'#7fb0ff',accent2:'#d9e8ff',icon:'🤝',label:'Rangkaian referral anda'},
    admin:{accent:'#70d0a7',accent2:'#d8f6e8',icon:'🛡️',label:'Pusat kawalan sistem'}
  };
  const cfg=palettes[role]||palettes.parent;
  const art=`<svg class="role-art-svg" viewBox="0 0 360 210" aria-hidden="true">
    <circle cx="278" cy="44" r="34" fill="${cfg.accent2}" opacity=".38"/>
    <circle cx="66" cy="172" r="24" fill="${cfg.accent2}" opacity=".28"/>
    <rect x="80" y="48" width="202" height="118" rx="30" fill="rgba(255,255,255,.17)" stroke="rgba(255,255,255,.22)"/>
    <rect x="108" y="76" width="146" height="62" rx="18" fill="rgba(255,255,255,.92)"/>
    <rect x="128" y="94" width="78" height="10" rx="5" fill="${cfg.accent}" opacity=".7"/>
    <rect x="128" y="113" width="102" height="8" rx="4" fill="#dfe3ed"/>
    <circle cx="92" cy="74" r="26" fill="rgba(255,255,255,.94)"/><text x="92" y="84" text-anchor="middle" font-size="30">${cfg.icon}</text>
    <g class="role-art-float"><circle cx="285" cy="142" r="27" fill="rgba(255,255,255,.92)"/><text x="285" y="151" text-anchor="middle" font-size="28">⭐</text></g>
    <g class="role-art-float role-art-float-2"><rect x="39" y="95" width="56" height="56" rx="18" fill="rgba(255,255,255,.9)"/><text x="67" y="132" text-anchor="middle" font-size="28">📊</text></g>
  </svg>`;
  return `<section class="role-hero-banner role-${role}"><div class="role-hero-copy"><span class="dash-kicker">${esc(kicker)}</span><h1>${esc(title)}</h1><p>${esc(description)}</p><div class="role-hero-pills">${(pills||[]).map(text=>`<span>${esc(text)}</span>`).join('')}</div></div><div class="role-hero-scene role-hero-art-v18" aria-hidden="true">${art}<div class="scene-label">${esc(cfg.label)}</div></div></section>`;
}

async function renderUser(p,options={}){
  const showDashboardDetails=options.showDetails===true;
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
    rows.forEach(r=>byTopic[r.topic]=Math.max(byTopic[r.topic]||0,normalizedQuizStars(r)));
    const mastered=Object.values(byTopic).filter(v=>v>=QUIZ_MASTERY_STARS).length;
    return `<div class="parent-subject-mini"><span>${icon}</span><div><b>${name}</b><small>${rows.length?`${mastered}/6 topik dikuasai`:'Belum mula'}</small></div><strong>${rows.length?`⭐ ${Math.max(...rows.map(normalizedQuizStars))}/${QUIZ_MAX_STARS}`:'—'}</strong></div>`;
  };
  const revealedChild=showDashboardDetails?activeChild:null;
  const allStars=progress.reduce((s,x)=>s+Number(x.stars||0),0);
  const activeSubjectCount=selected.length?new Set(selected.map(x=>x.subject)).size:subjectMeta.length;
  const parentMetrics=renderMetricPalette([
    {tone:'purple',icon:'👨‍👩‍👧',label:'Profil pelajar',value:kids.length,meta:kids.length?'Urus semua anak dalam satu akaun':'Tambah profil untuk bermula'},
    {tone:'blue',icon:'🎯',label:'Fokus hari ini',value:revealedChild?revealedChild.name:'Belum dipilih',meta:revealedChild?`Tahun ${revealedChild.year||Math.max(1,Number(revealedChild.age||7)-6)}`:'Pilih profil anak untuk melihat perincian'},
    {tone:'green',icon:'⭐',label:'Jumlah bintang',value:allStars,meta:'Terkumpul daripada semua rekod latihan'},
    {tone:'orange',icon:'📘',label:'Subjek aktif',value:activeSubjectCount,meta:active?'Langganan aktif dan sedia digunakan':'Langganan diperlukan untuk akses penuh'}
  ],'parent-metric-grid');
  const childCards=kids.map(c=>{
    const cp=progress.filter(x=>x.childId===c.id);
    const st=cp.reduce((n,x)=>n+Number(x.stars||0),0);
    const year=esc(c.year||Math.max(1,Number(c.age||7)-6));
    const genderLabel=c.gender==='female'?'Perempuan':c.gender==='male'?'Lelaki':'';
    return `<button class="child-card compact parent-profile-card ${revealedChild?.id===c.id?'selected':''}" data-child="${c.id}">
      <span class="profile-card-avatar">${esc(c.avatar||'🧒')}</span>
      <div class="profile-card-copy"><b>${esc(c.name)}</b><small>Tahun ${year}${genderLabel?` · ${genderLabel}`:''}</small></div>
      <span class="profile-card-pill">⭐ ${st}</span>
    </button>`;
  }).join('');

  $('#dashboard').innerHTML=`<div class="dash-shell parent-shell clean-shell">
    ${renderParentRightNav(p,'overview')}
    <section class="dash-main clean-main">
      ${renderRoleHero('parent',{kicker:'Dashboard Penjaga',title:`Hai, ${p.name||'Penjaga'}!`,description:'Pilih profil anak untuk melihat kemajuan, subjek aktif dan akses pembelajaran dengan lebih teratur.',pills:['🎒 Profil anak','⭐ Rekod kemajuan','📚 Subjek ikut tahun']})}
      ${parentMetrics}
      <section class="profile-picker-panel">
        <div class="profile-picker-head"><div><span class="dash-kicker">PROFIL PELAJAR</span><h2>Pilih Profil Anak</h2><p>Pilih satu profil untuk melihat maklumat pembelajaran dengan lebih teratur.</p></div><button class="btn ghost small" id="addChildBtn">+ Tambah Anak</button></div>
        <div class="child-list compact-list profile-picker-list">${childCards||'<div class="empty-state compact-empty">Belum ada profil anak. Tambah profil untuk bermula.</div>'}</div>
      </section>
      ${showDashboardDetails&&activeChild?`<div class="parent-selected-details" data-parent-details>
        <div class="parent-focus-card">
          <div class="focus-profile"><span class="focus-avatar">${esc(activeChild.avatar||'🧒')}</span><div><small>PELAJAR DIPILIH</small><h2>${esc(activeChild.name)}</h2><p>Tahun ${esc(activeChild.year||Math.max(1,Number(activeChild.age||7)-6))}${activeChild.gender?` · ${activeChild.gender==='female'?'Perempuan':'Lelaki'}`:''}</p></div></div>
          <button class="student-launch" id="enterStudentBtn"><span>🎒</span><div><small>BUKA PAPARAN PELAJAR</small><b>Masuk Ruang Belajar</b></div><strong>→</strong></button>
        </div>
        <div class="parent-subject-row">${subjectMeta.map(subjectCard).join('')}</div>
      </div>`:''}
    </section>
  </div>`;

  wireParentRightNav(p);
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
  $('#parentLogoutNav')?.addEventListener('click',e=>{e.preventDefault();setRoleNav(false);logoutCilikGo();});
  document.querySelector('[data-parent-view="overview"]')?.addEventListener('click',e=>{e.preventDefault();setRoleNav(false);});
  animateIn($('#dashboard'));
  document.querySelectorAll('[data-child]').forEach(b=>b.onclick=async()=>{
    const selectedChild=kids.find(c=>c.id===b.dataset.child);
    if(!selectedChild)return;
    activeChild=selectedChild;
    localStorage.setItem('cilikgo_active_child',selectedChild.id);
    await renderUser(p,{showDetails:true});
  });

}


async function renderParentReportCard(p,options={}){
  const showReportDetails=options.showDetails===true;
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
      bestByTopic[topic]=Math.max(bestByTopic[topic]||0,normalizedQuizStars(r));
    });
    const mastered=Object.values(bestByTopic).filter(v=>v>=QUIZ_MASTERY_STARS).length;
    const best=rows.length?Math.max(...rows.map(normalizedQuizStars)):0;
    const stars=rows.reduce((n,r)=>n+Number(r.stars||0),0);
    return `<article class="report-subject-card">
      <span class="report-subject-icon">${icon}</span>
      <div><small>SUBJEK</small><h3>${name}</h3><p>${rows.length?`${rows.length} sesi · ${mastered}/6 topik dikuasai`:'Belum ada latihan direkodkan'}</p></div>
      <div class="report-subject-score"><b>${best?`⭐ ${best}/${QUIZ_MAX_STARS}`:'—'}</b><small>${stars} jumlah bintang</small></div>
    </article>`;
  }).join('');

  const childSelector=kids.map(c=>{
    const year=Number(c.year||Math.max(1,Number(c.age||7)-6));
    const genderLabel=c.gender==='female'?'Perempuan':c.gender==='male'?'Lelaki':'';
    return `<button class="report-child-chip report-profile-card ${showReportDetails&&activeChild?.id===c.id?'active':''}" data-report-child="${c.id}">
      <span class="profile-card-avatar">${esc(c.avatar||'🧒')}</span>
      <div class="profile-card-copy"><b>${esc(c.name||'-')}</b><small>Tahun ${year}${genderLabel?` · ${genderLabel}`:''}</small></div>
      <span class="profile-card-pill alt">Lihat</span>
    </button>`;
  }).join('');

  $('#dashboard').innerHTML=`<div class="dash-shell parent-shell clean-shell">
    ${renderParentRightNav(p,'report')}

    <section class="dash-main clean-main">
      ${kids.length?`
        <section class="report-selector-panel">
          <div class="report-selector-head">
            <div><span class="dash-kicker">REPORT KAD</span><h1>Prestasi Pelajar</h1><p>Pilih satu profil pelajar untuk melihat ringkasan penggunaan dan prestasinya.</p></div>
            <span class="report-selector-count">${kids.length} profil</span>
          </div>
          <div class="report-child-selector profile-picker-list">${childSelector}</div>
        </section>

        ${showReportDetails&&activeChild?`<div class="report-revealed-details">
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
        </div>`:''}
      `:`<div class="empty-state settings-empty"><h3>Belum ada profil pelajar</h3><p>Tambah profil terlebih dahulu untuk melihat Report Kad.</p><button class="btn primary" id="reportAddProfile">Tambah Profil</button></div>`}
    </section>
  </div>`;

  wireParentRightNav(p);
  $('#reportOverviewLink')?.addEventListener('click',e=>{e.preventDefault();history.pushState(null,'','#dashboard');renderUser(p);});
  $('#reportStudentLink')?.addEventListener('click',e=>{e.preventDefault();renderStudentPortal(p);});
  $('#reportSubscriptionLink')?.addEventListener('click',e=>{e.preventDefault();renderParentSubscriptionView(p);});
  $('#reportSettingsLink')?.addEventListener('click',e=>{e.preventDefault();history.pushState(null,'','#settings');renderParentSettingsView(p);});
  $('#parentReportLogoutNav')?.addEventListener('click',e=>{e.preventDefault();setRoleNav(false);logoutCilikGo();});
  $('#reportAddProfile')?.addEventListener('click',()=>prepareChildModal(null));

  document.querySelectorAll('[data-report-child]').forEach(btn=>btn.onclick=async()=>{
    const child=kids.find(c=>c.id===btn.dataset.reportChild);
    if(!child)return;
    activeChild=child;
    localStorage.setItem('cilikgo_active_child',child.id);
    await renderParentReportCard(p,{showDetails:true});
  });

  animateIn($('#dashboard'));
}


function accountGenderLabel(value){
  return value==='male'?'Lelaki':value==='female'?'Perempuan':'Belum ditetapkan';
}

function renderSettingsDisclosure({id,icon,title,summary,badge='',body=''}) {
  return `<article class="std-setting-card" data-settings-card="${esc(id)}">
    <button class="std-setting-trigger" type="button" data-settings-toggle="${esc(id)}" aria-expanded="false">
      <span class="std-setting-icon">${icon}</span>
      <span class="std-setting-trigger-copy">
        <small>TETAPAN</small>
        <b>${esc(title)}</b>
        <span>${esc(summary)}</span>
      </span>
      ${badge?`<span class="std-setting-badge">${esc(badge)}</span>`:''}
      <span class="std-setting-chevron" aria-hidden="true">⌄</span>
    </button>
    <div class="std-setting-panel hidden" data-settings-panel="${esc(id)}">${body}</div>
  </article>`;
}

function renderStandardAccountSettings(p,roleLabel='Pengguna'){
  const gender=String(p.gender||'');
  const email=String(p.email||fb?.auth?.currentUser?.email||'');
  const verified=fb?.auth?.currentUser?.emailVerified===true;

  const personalBody=`<div class="std-settings-form-grid">
      <label class="std-field"><span>Nama</span><input id="accountProfileName" maxlength="80" value="${esc(p.name||'')}" placeholder="Nama penuh"></label>
      <label class="std-field"><span>Jantina</span><select id="accountProfileGender">
        <option value="" ${!gender?'selected':''}>Belum ditetapkan</option>
        <option value="male" ${gender==='male'?'selected':''}>Lelaki</option>
        <option value="female" ${gender==='female'?'selected':''}>Perempuan</option>
      </select></label>
      <label class="std-field"><span>Nombor Telefon</span><input id="accountProfilePhone" inputmode="tel" maxlength="24" value="${esc(p.phone||'')}" placeholder="Contoh: 0123456789"></label>
      <label class="std-field std-field-readonly"><span>E-mel Berdaftar</span><input value="${esc(email)}" readonly></label>
    </div>
    <div class="std-settings-actions">
      <button class="btn primary" id="saveStandardAccountProfile">Simpan Maklumat</button>
      <span class="std-settings-helper">Nama, jantina dan nombor telefon boleh dikemas kini pada bila-bila masa.</span>
    </div>`;

  const securityBody=`<div class="std-security-box">
      <div class="std-security-email">
        <span>✉️</span>
        <div><small>E-MEL PENGESAHAN</small><b>${esc(email||'-')}</b><p>${verified?'E-mel akaun telah disahkan.':'Pautan tukar kata laluan akan dihantar ke e-mel ini.'}</p></div>
        <span class="std-email-status ${verified?'verified':'pending'}">${verified?'Disahkan':'E-mel berdaftar'}</span>
      </div>
      <div class="std-password-copy"><h4>Tukar Kata Laluan</h4><p>Untuk keselamatan, CilikGo menghantar pautan pengesahan/reset ke e-mel berdaftar. Kata laluan tidak disimpan atau dipaparkan dalam dashboard.</p></div>
      <button class="btn primary" id="sendPasswordChangeEmail">Hantar E-mel Tukar Kata Laluan</button>
    </div>`;

  return `<section class="standard-account-settings">
    <div class="std-settings-heading">
      <div><small>AKAUN ${esc(String(roleLabel).toUpperCase())}</small><h2>Tetapan Akaun</h2><p>Kemaskini maklumat peribadi dan keselamatan akaun. Buka bahagian yang ingin diubah sahaja.</p></div>
      <span class="std-account-role">${esc(roleLabel)}</span>
    </div>
    <div class="std-settings-stack">
      ${renderSettingsDisclosure({
        id:'account-personal',
        icon:'👤',
        title:'Maklumat Peribadi',
        summary:`${p.name||'Nama belum ditetapkan'} · ${accountGenderLabel(gender)}`,
        badge:p.phone?'Telefon lengkap':'Kemaskini',
        body:personalBody
      })}
      ${renderSettingsDisclosure({
        id:'account-security',
        icon:'🔐',
        title:'Tukar Kata Laluan',
        summary:'Pautan selamat dihantar ke e-mel berdaftar',
        badge:verified?'E-mel disahkan':'E-mel',
        body:securityBody
      })}
    </div>
  </section>`;
}

function wireSettingsDisclosures(scope=document){
  scope.querySelectorAll('[data-settings-toggle]').forEach(btn=>{
    btn.onclick=()=>{
      const id=btn.dataset.settingsToggle;
      const panel=scope.querySelector(`[data-settings-panel="${CSS.escape(id)}"]`);
      if(!panel)return;
      const open=panel.classList.contains('hidden');
      panel.classList.toggle('hidden',!open);
      btn.setAttribute('aria-expanded',open?'true':'false');
      btn.closest('.std-setting-card')?.classList.toggle('open',open);
    };
  });
}

async function saveStandardAccountProfile(p){
  if(!fb?.auth?.currentUser)throw new Error('Sila log masuk semula.');
  const name=($('#accountProfileName')?.value||'').trim();
  const gender=($('#accountProfileGender')?.value||'').trim();
  const phone=($('#accountProfilePhone')?.value||'').trim();

  if(name.length<2||name.length>80)throw new Error('Nama perlu antara 2 hingga 80 aksara.');
  if(gender&&!['male','female'].includes(gender))throw new Error('Pilihan jantina tidak sah.');
  if(phone&&!/^[0-9+\-\s()]{8,24}$/.test(phone))throw new Error('Sila semak nombor telefon bimbit.');

  const payload={
    name,
    gender:gender||null,
    phone:phone||'',
    updatedAt:fb.serverTimestamp()
  };
  await fb.setDoc(fb.doc(fb.db,'users',p.uid),payload,{merge:true});
  Object.assign(p,{name,gender:gender||null,phone:phone||''});
  if(currentProfile?.uid===p.uid)Object.assign(currentProfile,{name,gender:gender||null,phone:phone||''});
}

function wireStandardAccountSettings(p,onSaved){
  wireSettingsDisclosures($('#dashboard')||document);

  const saveBtn=$('#saveStandardAccountProfile');
  if(saveBtn)saveBtn.onclick=async()=>{
    setButtonLoading(saveBtn,true,'Menyimpan…');
    try{
      await saveStandardAccountProfile(p);
      toast('Maklumat akaun berjaya dikemas kini.');
      if(typeof onSaved==='function')await onSaved();
      else setButtonLoading(saveBtn,false);
    }catch(e){
      console.error(e);
      toast('Gagal kemas kini akaun: '+friendlyError(e));
      setButtonLoading(saveBtn,false);
    }
  };

  const passBtn=$('#sendPasswordChangeEmail');
  if(passBtn)passBtn.onclick=async()=>{
    const email=fb?.auth?.currentUser?.email||p.email;
    if(!email){toast('E-mel akaun tidak ditemui.');return;}
    setButtonLoading(passBtn,true,'Menghantar…');
    try{
      await fb.sendPasswordResetEmail(fb.auth,email);
      toast('E-mel pengesahan tukar kata laluan telah dihantar.');
    }catch(e){
      console.error(e);
      toast('Gagal hantar e-mel: '+friendlyError(e));
    }finally{
      setButtonLoading(passBtn,false);
    }
  };
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

  const studentProfilesBody=`<div class="role-settings-inner">
    <div class="role-settings-toolbar">
      <div><small>PROFIL ANAK</small><h3>Urus Profil Pelajar</h3><p>Tambah, edit atau padam profil pelajar. Rekod latihan kekal terikat kepada profil masing-masing.</p></div>
      <button class="btn primary small" id="settingsAddProfile">+ Tambah Profil</button>
    </div>
    <div class="settings-info-card"><span>⚙️</span><div><b>Pengurusan profil</b><p>Perubahan nama, jantina, tahun dan avatar pelajar boleh dibuat di sini.</p></div></div>
    <div class="settings-profile-list">${profileRows||`<div class="empty-state settings-empty"><h3>Belum ada profil pelajar</h3><p>Tambah profil pertama untuk membuka Ruang Pelajar.</p><button class="btn primary" id="settingsEmptyAdd">Tambah Profil</button></div>`}</div>
  </div>`;

  $('#dashboard').innerHTML=`<div class="dash-shell parent-shell clean-shell">
    ${renderParentRightNav(p,'settings')}
    <section class="dash-main clean-main standard-settings-page">
      ${renderStandardAccountSettings(p,'Penjaga')}
      <div class="std-settings-stack role-settings-stack">
        ${renderSettingsDisclosure({
          id:'parent-student-profiles',
          icon:'🎒',
          title:'Profil Pelajar',
          summary:`${kids.length} profil pelajar · Urus maklumat anak`,
          badge:kids.length?`${kids.length} profil`:'Belum ada',
          body:studentProfilesBody
        })}
      </div>
    </section>
  </div>`;

  wireParentRightNav(p);
  wireStandardAccountSettings(p,()=>renderParentSettingsView(p));

  $('#settingsOverviewLink')?.addEventListener('click',e=>{e.preventDefault();history.pushState(null,'','#dashboard');renderUser(p);});
  $('#settingsReportCardLink')?.addEventListener('click',e=>{e.preventDefault();history.pushState(null,'','#report-card');renderParentReportCard(p);});
  $('#settingsStudentLink')?.addEventListener('click',e=>{e.preventDefault();renderStudentPortal(p);});
  $('#settingsSubscriptionLink')?.addEventListener('click',e=>{e.preventDefault();renderParentSubscriptionView(p);});
  $('#settingsAddProfile')?.addEventListener('click',()=>prepareChildModal(null));
  $('#settingsEmptyAdd')?.addEventListener('click',()=>prepareChildModal(null));
  $('#parentSettingsLogoutNav')?.addEventListener('click',e=>{e.preventDefault();setRoleNav(false);logoutCilikGo();});

  document.querySelectorAll('[data-edit-child]').forEach(btn=>btn.onclick=()=>{
    const child=kids.find(c=>c.id===btn.dataset.editChild);
    if(child)prepareChildModal(child);
  });
  document.querySelectorAll('[data-delete-child]').forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.deleteChild;
    setButtonLoading(btn,true,'Memadam…');
    const ok=await deleteStudentProfile(p,id);
    if(ok)await renderParentSettingsView(p);
    else setButtonLoading(btn,false);
  });

  animateIn($('#dashboard'));
}

async function renderAgent(p,initialView='overview'){
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
  const [referrals,myOrders,myCommissions,myPayouts]=await Promise.all([
    loadReferrals(),loadAgentDocs('orders'),loadAgentDocs('commissions'),loadAgentDocs('commissionPayouts')
  ]);
  const paidOrders=myOrders.filter(o=>o.status==='paid');
  const pendingCommissions=myCommissions.filter(c=>c.status==='pending');
  const pending=pendingCommissions.reduce((s,c)=>s+Number(c.amount||0),0);
  const paidCommission=myCommissions.filter(c=>c.status==='paid').reduce((s,c)=>s+Number(c.amount||0),0);
  const totalCommission=myCommissions.reduce((s,c)=>s+Number(c.amount||0),0);
  const sales=paidOrders.reduce((s,o)=>s+Number(o.amount||0),0);
  const conversion=referrals.length?Math.round((paidOrders.length/referrals.length)*100):0;
  const refUrl=`${location.origin}${location.pathname}?ref=${encodeURIComponent(code)}`;
  const saturdayLabel=nextSaturdayLabel();
  const bankReady=agentBankReady(p);
  const payoutHistory=[...myPayouts].sort((a,b)=>(b.paidAt?.toMillis?.()||b.createdAt?.toMillis?.()||0)-(a.paidAt?.toMillis?.()||a.createdAt?.toMillis?.()||0));

  const status=s=>`<span class="badge ${['failed','inactive'].includes(s)?'status-inactive':''}">${esc(s||'-')}</span>`;
  const referralRows=referrals.length?`<div class="table-wrap"><table class="table"><tr><th>Penjaga</th><th>E-mel</th><th>Langganan</th><th>Jualan</th></tr>${referrals.map(u=>{
    const uo=myOrders.filter(o=>o.userUid===u.id);
    return `<tr><td>${esc(u.name||'-')}</td><td>${esc(u.email||'-')}</td><td>${status(u.subscriptionStatus||'inactive')}</td><td>${uo.filter(o=>o.status==='paid').length}</td></tr>`;
  }).join('')}</table></div>`:'<div class="empty-state">Belum ada Penjaga mendaftar melalui link anda.</div>';

  const commissionRows=myCommissions.length?`<div class="table-wrap"><table class="table"><tr><th>Order</th><th>Jualan</th><th>Jenis</th><th>Komisen</th><th>Status</th></tr>${[...myCommissions].reverse().map(c=>`<tr><td><code>${esc(c.orderId||c.id)}</code></td><td>${formatMoney(c.saleAmount)}</td><td>${esc(c.rateLabel||(c.ratePercent?c.ratePercent+'%':'Tetap'))}</td><td><b>${formatMoney(c.amount)}</b></td><td>${status(c.status)}</td></tr>`).join('')}</table></div>`:'<div class="empty-state">Belum ada rekod komisen. Komisen akan direkod selepas Admin mengesahkan pembayaran referral.</div>';

  const payoutRows=payoutHistory.length?`<div class="table-wrap"><table class="table"><tr><th>Tarikh bayar</th><th>Jumlah</th><th>Rekod</th><th>Akaun bank</th></tr>${payoutHistory.slice(0,20).map(x=>`<tr><td>${formatDate(x.paidAt||x.createdAt)}</td><td><b>${formatMoney(x.totalAmount)}</b></td><td>${Number(x.itemCount||0)} komisen</td><td>${esc(x.bankName||'-')} · ${esc(x.accountNumber||'-')}</td></tr>`).join('')}</table></div>`:'<div class="empty-state">Belum ada rekod pembayaran komisen mingguan.</div>';

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
      <div class="portal-side-foot"><small>Kod Agent</small><b>${esc(code||'-')}</b><button class="side-logout-btn portal-logout-btn" id="agentLogoutNav">↪ Log Keluar</button></div>
    </aside>
    <section class="dash-main portal-main"><div id="agentView"></div></section>
  </div>`;

  const views={
    overview:()=>`${renderRoleHero('agent',{kicker:'Dashboard Agent',title:`Selamat datang, ${p.name||p.email}` ,description:'Semak referral, jualan dan komisen anda dalam paparan yang lebih tersusun dan mudah dibaca.',pills:['🔗 Kongsi referral','💰 Pantau komisen','📈 Lihat prestasi']})}
      <div class="agent-link-card"><div><small>Link referral unik anda</small><h3>Kongsi CilikGo dan bina rangkaian anda</h3><div class="copy-row"><input id="agentRefUrl" readonly value="${esc(refUrl)}"><button class="btn primary" id="copyAgentLink">Salin Link</button></div><p>Kod Agent: <b>${esc(code||'-')}</b></p></div><span class="agent-link-icon">🔗</span></div>
      ${renderMetricPalette([
        {tone:'purple',icon:'👥',label:'Pendaftaran referral',value:referrals.length,meta:'Penjaga yang mendaftar menggunakan kod anda'},
        {tone:'blue',icon:'🧾',label:'Pembelian berjaya',value:paidOrders.length,meta:'Transaksi yang telah disahkan oleh Admin'},
        {tone:'green',icon:'📈',label:'Conversion',value:`${conversion}%`,meta:'Peratus referral yang bertukar menjadi jualan'},
        {tone:'orange',icon:'💵',label:'Nilai jualan',value:formatMoney(sales),meta:'Jumlah jualan yang berjaya'},
        {tone:'pink',icon:'⏳',label:'Komisen pending',value:formatMoney(pending),meta:`Menunggu bayaran pada ${saturdayLabel}`},
        {tone:'mint',icon:'✅',label:'Komisen dibayar',value:formatMoney(paidCommission),meta:'Jumlah komisen yang telah dibayar'}
      ],'agent-overview-metrics')}
      <div class="agent-info-grid"><div class="recommend-card"><span class="recommend-icon">📣</span><div><small>Cara guna</small><h3>Kongsi link referral anda</h3><p>Apabila Penjaga membuka link anda dan mendaftar, kod Agent direkodkan pada akaun mereka.</p></div></div><div class="strength-card"><small>Komisen CilikGo</small><h3>RM30 pelanggan baharu · RM10 renewal</h3><p>Pembayaran dibuat melalui pindahan bank. Selepas Admin mengesahkan bukti WhatsApp dan mengaktifkan akaun, jualan serta komisen akan direkod secara automatik.</p></div></div>`,
    referrals:()=>`<div class="dash-head portal-page-head"><div><small>Affiliate network</small><h2>Senarai Referral</h2></div><span class="badge">${referrals.length} Penjaga</span></div><div class="agent-toolbar"><input id="agentSearch" placeholder="Cari nama atau e-mel…"><span>${referrals.length} pendaftaran</span></div><div id="referralTable">${referralRows}</div>`,
    sales:()=>`<div class="dash-head portal-page-head"><div><small>Prestasi jualan</small><h2>Jualan Referral</h2></div><span class="badge">RM${sales.toFixed(2)}</span></div><div class="agent-stat-grid compact"><div class="stat"><small>Jumlah order</small><b>${myOrders.length}</b></div><div class="stat"><small>Berjaya</small><b>${paidOrders.length}</b></div><div class="stat"><small>Conversion</small><b>${conversion}%</b></div></div>${myOrders.length?`<div class="table-wrap"><table class="table"><tr><th>Order</th><th>Pelan</th><th>Nilai</th><th>Status</th></tr>${[...myOrders].reverse().map(o=>`<tr><td><code>${esc(o.id)}</code></td><td>${esc(o.plan||'-')}</td><td>RM${Number(o.amount||0).toFixed(2)}</td><td>${status(o.status)}</td></tr>`).join('')}</table></div>`:'<div class="empty-state">Belum ada jualan yang disahkan oleh Admin.</div>'}`,
    commission:()=>`<div class="dash-head portal-page-head"><div><small>Pendapatan affiliate</small><h2>Komisen</h2><p>Admin membuat pembayaran komisen setiap hari Sabtu.</p></div><span class="badge">${formatMoney(totalCommission)}</span></div>
      <section class="weekly-payout-hero">
        <div><small>BAYARAN SETERUSNYA</small><h3>${esc(saturdayLabel)}</h3><p>Semua komisen berstatus <b>pending</b> akan termasuk dalam jumlah pembayaran seterusnya.</p></div>
        <div class="weekly-payout-amount"><small>MENUNGGU BAYARAN</small><strong>${formatMoney(pending)}</strong><span>${pendingCommissions.length} rekod komisen</span></div>
        <div class="weekly-bank-status ${bankReady?'ready':'missing'}"><small>AKAUN BANK</small><b>${bankReady?'✓ Lengkap':'! Belum lengkap'}</b><span>${esc(agentBankSummary(p))}</span></div>
      </section>
      <div class="agent-stat-grid compact"><div class="stat"><small>Jumlah komisen</small><b>${formatMoney(totalCommission)}</b></div><div class="stat"><small>Pending</small><b>${formatMoney(pending)}</b></div><div class="stat"><small>Dibayar</small><b>${formatMoney(paidCommission)}</b></div></div>
      <div class="commission-section-head"><div><small>REKOD KOMISEN</small><h3>Transaksi komisen</h3></div></div>${commissionRows}
      <div class="commission-section-head payout-history-head"><div><small>SEJARAH BAYARAN</small><h3>Pembayaran mingguan</h3></div></div>${payoutRows}`,
    settings:()=>{
      const referralBody=`<div class="portal-settings-grid">
        <div class="portal-setting-card"><span>👤</span><div><small>NAMA AGENT</small><b>${esc(p.name||'-')}</b><p>${esc(p.email||'-')}</p></div></div>
        <div class="portal-setting-card"><span>🔑</span><div><small>KOD AGENT</small><b>${esc(code||'-')}</b><p>Kod ini digunakan untuk merekod referral.</p></div></div>
        <div class="portal-setting-card wide"><span>🔗</span><div><small>PAUTAN REFERRAL</small><b class="break-text">${esc(refUrl)}</b><p>Kongsi pautan ini kepada Penjaga yang ingin mendaftar CilikGo.</p><button class="btn primary small" id="copyAgentSettingsLink">Salin Pautan</button></div></div>
      </div>`;

      const bankBody=`<section class="agent-bank-settings embedded-role-setting">
        <div class="agent-bank-head"><div><small>PEMBAYARAN KOMISEN</small><h3>Akaun Bank Agent</h3><p>Admin menggunakan maklumat ini untuk transfer komisen setiap hari Sabtu.</p></div><span class="bank-ready-badge ${bankReady?'ready':'missing'}">${bankReady?'✓ Lengkap':'Belum lengkap'}</span></div>
        <div class="agent-bank-form">
          <label><span>Nama Bank</span><input id="agentPayoutBankName" value="${esc(p.payoutBankName||'')}" placeholder="Contoh: Maybank"></label>
          <label><span>Nama Pemilik Akaun</span><input id="agentPayoutAccountName" value="${esc(p.payoutAccountName||'')}" placeholder="Nama seperti pada akaun bank"></label>
          <label><span>Nombor Akaun</span><input id="agentPayoutAccountNumber" inputmode="numeric" value="${esc(p.payoutAccountNumber||'')}" placeholder="Contoh: 123456789012"></label>
        </div>
        <button class="btn primary" id="saveAgentBank">Simpan Akaun Bank</button>
        <p class="agent-bank-privacy">🔒 Maklumat bank hanya boleh dilihat oleh Agent pemilik akaun dan Admin CilikGo.</p>
      </section>`;

      return `<div class="standard-settings-page">
        ${renderStandardAccountSettings(p,'Agent')}
        <div class="std-settings-stack role-settings-stack">
          ${renderSettingsDisclosure({id:'agent-referral',icon:'🔗',title:'Referral Agent',summary:'Kod dan pautan referral unik anda',badge:code||'Agent',body:referralBody})}
          ${renderSettingsDisclosure({id:'agent-bank',icon:'🏦',title:'Akaun Bank Komisen',summary:'Maklumat pembayaran komisen setiap Sabtu',badge:bankReady?'Lengkap':'Perlu kemas kini',body:bankBody})}
        </div>
      </div>`;
    }
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
    if(view==='settings') wireStandardAccountSettings(p,()=>renderAgent(p,'settings'));
    if($('#saveAgentBank')) $('#saveAgentBank').onclick=async()=>{
      const btn=$('#saveAgentBank');
      const payoutBankName=($('#agentPayoutBankName')?.value||'').trim();
      const payoutAccountName=($('#agentPayoutAccountName')?.value||'').trim();
      const payoutAccountNumber=($('#agentPayoutAccountNumber')?.value||'').replace(/\s+/g,'').trim();
      if(!payoutBankName||!payoutAccountName||!payoutAccountNumber){
        toast('Lengkapkan nama bank, nama pemilik akaun dan nombor akaun.');
        return;
      }
      if(!/^[0-9-]{6,24}$/.test(payoutAccountNumber)){
        toast('Sila semak nombor akaun bank.');
        return;
      }
      setButtonLoading(btn,true,'Menyimpan…');
      try{
        const payload={payoutBankName,payoutAccountName,payoutAccountNumber,payoutUpdatedAt:fb.serverTimestamp(),updatedAt:fb.serverTimestamp()};
        await fb.setDoc(fb.doc(fb.db,'users',p.uid),payload,{merge:true});
        Object.assign(p,{payoutBankName,payoutAccountName,payoutAccountNumber});
        if(currentProfile?.uid===p.uid) Object.assign(currentProfile,{payoutBankName,payoutAccountName,payoutAccountNumber});
        toast('Maklumat akaun bank berjaya disimpan.');
        mount('settings');
      }catch(e){
        console.error(e);
        toast('Gagal simpan akaun bank: '+(e.message||e));
        setButtonLoading(btn,false);
      }
    };
    if($('#agentSearch')) $('#agentSearch').oninput=()=>{
      const q=$('#agentSearch').value.toLowerCase();
      const list=referrals.filter(u=>(u.name||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q));
      $('#referralTable').innerHTML=list.length?`<div class="table-wrap"><table class="table"><tr><th>Penjaga</th><th>E-mel</th><th>Langganan</th></tr>${list.map(u=>`<tr><td>${esc(u.name||'-')}</td><td>${esc(u.email||'-')}</td><td>${status(u.subscriptionStatus||'inactive')}</td></tr>`).join('')}</table></div>`:'<div class="empty-state">Tiada referral sepadan.</div>';
    };
  };
  document.querySelectorAll('.agent-nav').forEach(a=>a.onclick=()=>{setRoleNav(false);mount(a.dataset.view);});
  $('#agentLogoutNav')?.addEventListener('click',e=>{e.preventDefault();setRoleNav(false);logoutCilikGo();});
  mount(initialView);
}

async function renderAdminSubscriptions(){
  const root=$('#adminContent')||$('.admin-shell .portal-main');
  root.innerHTML=`<div class="dash-head portal-page-head"><div><small>Pengurusan akses Penjaga</small><h2>Langganan Manual</h2></div><span class="badge">Admin</span></div><div class="loading-skeleton" style="height:90px"></div>`;
  try{
    const [usersSnap,ordersSnap,commissionsSnap,settings]=await Promise.all([
      fb.getDocs(fb.collection(fb.db,'users')),
      fb.getDocs(fb.collection(fb.db,'orders')),
      fb.getDocs(fb.collection(fb.db,'commissions')),
      loadManualPaymentSettings(true)
    ]);
    const allUsers=usersSnap.docs.map(d=>({id:d.id,...d.data()}));
    const users=allUsers.filter(u=>u.role==='user');
    const agents=allUsers.filter(u=>u.role==='agent'&&u.agentCode);
    const orders=ordersSnap.docs.map(d=>({id:d.id,...d.data()}));
    const commissions=commissionsSnap.docs.map(d=>({id:d.id,...d.data()}));
    const rows=users.map(u=>{
      const state=subscriptionState(u);
      const days=subscriptionDaysLeft(u);
      const userOrders=orders.filter(o=>o.userUid===u.id);
      return {...u,_end:state.end,_state:state.status,_active:state.active,_expired:state.expired,_lifetime:state.lifetime,_days:days,_orders:userOrders,_paidBefore:hasPaidSubscriptionBefore(u)};
    });
    const activeCount=rows.filter(x=>x._active&&!x._lifetime).length;
    const lifetimeCount=rows.filter(x=>x._active&&x._lifetime).length;
    const expiredCount=rows.filter(x=>x._expired).length;
    const inactiveCount=rows.filter(x=>!x._active&&!x._expired).length;
    const promo=settings.lifetimePromoActive!==false;

    const stateBadge=u=>u._lifetime&&u._active
      ?'<span class="badge">Lifetime</span>'
      :`<span class="badge ${u._active?'':'status-inactive'}">${esc(u._active?'active':u._expired?'expired':'inactive')}</span>`;
    const agentOptions=(u)=>`<select class="sub-agent-select" data-uid="${u.id}" aria-label="Agent referral">
      <option value="">Direct / tiada Agent</option>${agents.map(a=>`<option value="${esc(a.agentCode)}" ${u.referredByCode===a.agentCode?'selected':''}>${esc(a.name||a.email||'Agent')} · ${esc(a.agentCode)}</option>`).join('')}
    </select>`;
    const referralCell=u=>{
      const userOrders=orders.filter(o=>o.userUid===u.id&&o.status==='paid');
      const unattributed=userOrders.some(o=>!o.agentUid&&!commissions.some(c=>c.orderId===o.id));
      return `<div class="admin-referral-cell"><small>${u.referredByCode?`Direkod: ${esc(u.referredByCode)}`:'Belum dikaitkan'}</small>${agentOptions(u)}${unattributed?`<button class="btn ghost small repair-commission" data-uid="${u.id}">Baiki komisen</button>`:''}</div>`;
    };
    const actions=u=>{
      if(u._lifetime&&u._active)return `<div class="admin-sub-actions"><span class="badge">♾️ Lifetime</span><button class="btn ghost danger sub-manage" data-uid="${u.id}" data-action="expire">Tamatkan</button></div>`;
      if(!u._paidBefore)return `<div class="admin-sub-actions"><button class="btn primary sub-manage" data-uid="${u.id}" data-action="${promo?'lifetime':'starter3'}">${promo?'Aktif Lifetime RM45':'Aktif 3 Bulan RM45'}</button></div>`;
      return `<div class="admin-sub-actions"><button class="btn ghost sub-manage" data-uid="${u.id}" data-action="renewal">+1 bulan RM15</button><button class="btn ghost danger sub-manage" data-uid="${u.id}" data-action="expire">Tamatkan</button></div>`;
    };
    const table=list=>list.length?`<div class="table-wrap"><table class="table admin-sub-table"><tr><th>Penjaga</th><th>Referral Agent</th><th>Status</th><th>Tamat</th><th>Baki</th><th>Transaksi</th><th>Tindakan</th></tr>${list.map(u=>`<tr>
      <td><b>${esc(u.name||'-')}</b><small>${esc(u.email||'-')}</small></td>
      <td>${referralCell(u)}</td>
      <td>${stateBadge(u)}</td>
      <td>${u._lifetime&&u._active?'Lifetime':u._end?u._end.toLocaleDateString('ms-MY'):'-'}</td>
      <td>${u._lifetime&&u._active?'∞':u._active?u._days+' hari':'-'}</td>
      <td>${u._orders.length}</td>
      <td>${actions(u)}</td>
    </tr>`).join('')}</table></div>`:'<div class="empty-state">Tiada Penjaga sepadan.</div>';

    root.innerHTML=`<div class="dash-head portal-page-head"><div><small>Bank transfer + bukti WhatsApp</small><h2>Langganan Manual</h2></div><span class="badge">${rows.length} Penjaga</span></div>
      <div class="admin-stat-grid"><div class="stat"><small>Lifetime</small><b>${lifetimeCount}</b></div><div class="stat"><small>Aktif bertempoh</small><b>${activeCount}</b></div><div class="stat"><small>Tamat</small><b>${expiredCount}</b></div><div class="stat"><small>Belum aktif</small><b>${inactiveCount}</b></div></div>
      <div class="admin-sub-note">🏦 <b>Pembayaran Manual.</b> Admin hanya mengaktifkan akaun selepas menerima bukti pindahan bank melalui WhatsApp. ${promo?'<b>Promosi Lifetime RM45 sedang AKTIF.</b>':'Promosi Lifetime telah tamat — pelanggan baharu RM45/3 bulan.'}</div>
      <div class="agent-toolbar"><input id="subSearch" placeholder="Cari nama atau e-mel…"><select id="subFilter"><option value="all">Semua status</option><option value="lifetime">Lifetime</option><option value="active">Aktif</option><option value="expired">Tamat</option><option value="inactive">Belum aktif</option></select></div>
      <div id="subTable">${table(rows)}</div>`;

    const bind=()=>{
      document.querySelectorAll('.sub-manage').forEach(btn=>btn.onclick=async()=>{
        const u=rows.find(x=>x.id===btn.dataset.uid);if(!u)return;
        const action=btn.dataset.action;
        const labels={lifetime:'aktifkan Lifetime RM45',starter3:'aktifkan 3 bulan RM45',renewal:'tambah 1 bulan RM15',expire:'tamatkan akses'};
        if(!confirm(`Sahkan ${labels[action]||action} untuk ${u.name||u.email}?\n\nPastikan bukti pembayaran telah diterima sebelum pengaktifan.`))return;
        setButtonLoading(btn,true,'Simpan…');
        try{
          const selectedAgent=$(`.sub-agent-select[data-uid="${u.id}"]`)?.value||null;
          const result=await callAdminSubscriptionAction(u.id,action,selectedAgent);
          cachedManualPaymentSettings=null;
          const extra=result.commissionAmount?` Komisen RM${Number(result.commissionAmount).toFixed(0)} direkodkan.`:'';
          const email=result.emailQueued?' E-mel pengaktifan telah dimasukkan ke queue.':'';
          toast(action==='expire'?'Akses berjaya ditamatkan.':`Langganan berjaya diaktifkan.${extra}${email}`);
          await renderAdminSubscriptions();
        }catch(e){console.error(e);toast('Gagal mengemas kini langganan: '+(e.message||e));setButtonLoading(btn,false);}
      });
      document.querySelectorAll('.repair-commission').forEach(btn=>btn.onclick=async()=>{
        const u=rows.find(x=>x.id===btn.dataset.uid);if(!u)return;
        const selectedAgent=$(`.sub-agent-select[data-uid="${u.id}"]`)?.value||u.referredByCode||'';
        if(!selectedAgent)return toast('Pilih Agent terlebih dahulu sebelum membaiki komisen.');
        if(!confirm(`Baiki transaksi tanpa komisen untuk ${u.name||u.email} dan kaitkan kepada Agent ${selectedAgent}?`))return;
        setButtonLoading(btn,true,'Baiki…');
        try{
          const result=await callAdminRepairCommission(u.id,selectedAgent);
          toast(result.alreadyProcessed?'Komisen transaksi ini sudah direkodkan.':`Komisen RM${Number(result.commissionAmount||0).toFixed(0)} berjaya direkodkan.`);
          await renderAdminSubscriptions();
        }catch(e){console.error(e);toast('Gagal membaiki komisen: '+(e.message||e));setButtonLoading(btn,false);}
      });
    };
    const refresh=()=>{
      const q=($('#subSearch')?.value||'').toLowerCase(),f=$('#subFilter')?.value||'all';
      const list=rows.filter(u=>{
        const stateMatch=f==='all'||(f==='lifetime'&&u._lifetime&&u._active)||(f==='active'&&u._active&&!u._lifetime)||(f==='expired'&&u._expired)||(f==='inactive'&&!u._active&&!u._expired);
        return stateMatch&&((u.name||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q));
      });
      $('#subTable').innerHTML=table(list);bind();
    };
    $('#subSearch').oninput=refresh;$('#subFilter').onchange=refresh;bind();
  }catch(e){console.error(e);root.innerHTML=`<div class="empty-state">Gagal memuatkan langganan: ${esc(e.message||e)}</div>`;}
}


async function renderAdmin(p,initialView='overview'){
  setRoleNav(false);
  document.body.classList.remove('student-mode'); showDashboardPage();
  const safeDocs=async(name)=>{
    try{return (await fb.getDocs(fb.collection(fb.db,name))).docs.map(d=>({id:d.id,...d.data()}));}
    catch(e){console.warn(name,e);return [];}
  };
  const [users,children,allProgress,orders,commissions,commissionPayouts,manualPaymentSettings]=await Promise.all([
    safeDocs('users'),safeDocs('children'),safeDocs('progress'),safeDocs('orders'),safeDocs('commissions'),safeDocs('commissionPayouts'),loadManualPaymentSettings(true)
  ]);
  const progress=allProgress.filter(r=>Number(r.year)>=1&&r.subject);
  const agents=users.filter(u=>u.role==='agent'), customers=users.filter(u=>u.role==='user');
  const activeSubs=customers.filter(u=>subscriptionState(u).active);
  const paidOrders=orders.filter(o=>o.status==='paid');
  const sales=paidOrders.reduce((s,o)=>s+Number(o.amount||0),0);
  const commissionTotal=commissions.reduce((s,c)=>s+Number(c.amount||0),0);
  const commissionPendingTotal=commissions.filter(c=>c.status==='pending').reduce((s,c)=>s+Number(c.amount||0),0);
  const commissionPaidTotal=commissions.filter(c=>c.status==='paid').reduce((s,c)=>s+Number(c.amount||0),0);
  const adminProfit=Math.max(0,sales-commissionTotal);
  const directSales=paidOrders.filter(o=>!o.agentUid).reduce((s,o)=>s+Number(o.amount||0),0);
  const saturdayLabel=nextSaturdayLabel();
  const totalStars=progress.reduce((s,x)=>s+Number(x.stars||0),0);

  const agentFinance=a=>{
    const ao=paidOrders.filter(o=>o.agentUid===a.id);
    const ac=commissions.filter(c=>c.agentUid===a.id);
    const gross=ao.reduce((s,o)=>s+Number(o.amount||0),0);
    const commission=ac.reduce((s,c)=>s+Number(c.amount||0),0);
    const pending=ac.filter(c=>c.status==='pending').reduce((s,c)=>s+Number(c.amount||0),0);
    const paid=ac.filter(c=>c.status==='paid').reduce((s,c)=>s+Number(c.amount||0),0);
    return {orders:ao.length,gross,commission,pending,paid,profit:Math.max(0,gross-commission),records:ac.length};
  };

  const sortedPayouts=[...commissionPayouts].sort((a,b)=>(b.paidAt?.toMillis?.()||b.createdAt?.toMillis?.()||0)-(a.paidAt?.toMillis?.()||a.createdAt?.toMillis?.()||0));

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
      <div class="portal-side-foot"><small>Sistem</small><b>CilikGo Admin</b><button class="side-logout-btn portal-logout-btn" id="adminLogoutNav">↪ Log Keluar</button></div>
    </aside>
    <section class="dash-main portal-main"><div id="adminContent">${body}</div></section>
  </div>`;

  const head=(title,sub='CilikGo Control Center')=>`<div class="dash-head portal-page-head"><div><small>${sub}</small><h2>${title}</h2></div><span class="badge">Admin</span></div>`;
  const empty=t=>`<div class="empty-state">${t}</div>`;
  const statusBadge=s=>`<span class="badge ${s==='inactive'||s==='failed'?'status-inactive':''}">${esc(s||'-')}</span>`;

  const views={
    overview:()=>`${renderRoleHero('admin',{kicker:'CilikGo Control Center',title:'Overview Admin',description:'Paparan ringkas ini memudahkan anda memantau pengguna, hasil jualan, komisen dan prestasi sistem tanpa maklumat berulang.',pills:['🛡️ Kawalan sistem','💳 Jualan & komisen','📊 Ringkasan pantas']})}
      ${renderMetricPalette([
        {tone:'purple',icon:'👨‍👩‍👧',label:'Penjaga',value:customers.length,meta:'Jumlah akaun Penjaga'},
        {tone:'blue',icon:'🤝',label:'Agent',value:agents.length,meta:'Jumlah akaun Agent'},
        {tone:'orange',icon:'🎒',label:'Profil pelajar',value:children.length,meta:'Semua profil anak yang direkodkan'},
        {tone:'green',icon:'✅',label:'Langganan aktif',value:activeSubs.length,meta:'Akaun Penjaga yang aktif'},
        {tone:'mint',icon:'💵',label:'Jualan dibayar',value:formatMoney(sales),meta:'Jumlah transaksi yang telah dibayar'},
        {tone:'pink',icon:'💰',label:'Komisen Agent',value:formatMoney(commissionTotal),meta:'Semua komisen yang dijana'},
        {tone:'gold',icon:'📆',label:'Perlu bayar Sabtu',value:formatMoney(commissionPendingTotal),meta:saturdayLabel},
        {tone:'teal',icon:'📈',label:'Untung Admin',value:formatMoney(adminProfit),meta:'Jualan tolak komisen Agent'}
      ],'admin-overview-metrics')}
      <div class="commission-explain admin-overview-note">Paparan overview kini disusun semula supaya lebih kemas, lebih mudah dibaca dan tiada pengulangan maklumat penting.</div>
      <div class="admin-two-col"><div><h3>Akaun terkini</h3>${users.length?`<div class="table-wrap"><table class="table"><tr><th>Nama</th><th>Role</th><th>Status</th></tr>${users.slice(-8).reverse().map(u=>`<tr><td>${esc(u.name||u.email||'-')}</td><td>${statusBadge(u.role)}</td><td>${statusBadge(u.subscriptionStatus||'n/a')}</td></tr>`).join('')}</table></div>`:empty('Tiada akaun.')}</div>
      <div><h3>Ringkasan sistem</h3><div class="admin-summary"><p><b>${orders.length}</b> rekod transaksi</p><p><b>${commissions.length}</b> rekod komisen</p><p><b>${formatMoney(directSales)}</b> jualan direct</p><p><b>${progress.length}</b> rekod pembelajaran</p></div></div></div>`,

    users:()=>`${head('User / Penjaga','Pengurusan akaun')}<div class="admin-toolbar"><input id="adminSearch" placeholder="Cari nama atau e-mel…"><span>${customers.length} akaun</span></div><div id="adminUserTable">${renderUserRows(customers)}</div>`,

    agents:()=>`${head('Agent','Pengurusan affiliate')}<div class="admin-toolbar"><input id="adminSearch" placeholder="Cari nama, e-mel atau kod…"><span>${agents.length} agent</span></div><div id="adminAgentTable">${renderAgentRows(agents)}</div>`,

    children:()=>`${head('Profil Pelajar','Pemantauan profil pembelajaran')}<div class="stat-grid"><div class="stat"><small>Jumlah profil</small><b>${children.length}</b></div><div class="stat"><small>Tahun 1</small><b>${children.filter(c=>Number(c.year||Math.max(1,Number(c.age||7)-6))===1).length}</b></div><div class="stat"><small>Tahun 2–6</small><b>${children.filter(c=>Number(c.year||Math.max(1,Number(c.age||7)-6))>=2).length}</b></div></div>${children.length?`<div class="table-wrap"><table class="table"><tr><th>Pelajar</th><th>Tahun</th><th>Penjaga</th><th>⭐</th></tr>${children.map(c=>{const owner=users.find(u=>u.id===c.ownerUid);const stars=progress.filter(x=>x.childId===c.id).reduce((s,x)=>s+Number(x.stars||0),0);const year=Number(c.year||Math.max(1,Number(c.age||7)-6));return `<tr><td>${esc(c.avatar||'🧒')} ${esc(c.name||'-')}</td><td>Tahun ${year}</td><td>${esc(owner?.name||owner?.email||'-')}</td><td>${stars}</td></tr>`}).join('')}</table></div>`:empty('Belum ada profil pelajar.')}`,

    learning:()=>{
      const subjectDefs=[['bm','Bahasa Melayu','🇲🇾'],['bi','Bahasa Inggeris','🔤'],['math','Matematik','➗'],['science','Sains','🔬']];
      const cards=subjectDefs.map(([k,n,i])=>{const r=progress.filter(x=>x.subject===k);return `<div class="stat"><small>${i} ${n}</small><b>${r.reduce((s,x)=>s+Number(x.stars||0),0)} ⭐</b><span>${r.length} sesi</span></div>`}).join('');
      return `${head('Prestasi Pembelajaran','Analitik Tahun 1–2 dan rekod pembelajaran')}<div class="admin-stat-grid subject-admin-stats">${cards}</div>${progress.length?`<div class="table-wrap"><table class="table"><tr><th>Pelajar</th><th>Subjek</th><th>Topik</th><th>⭐</th><th>Percubaan</th></tr>${progress.slice(-30).reverse().map(x=>{const child=children.find(c=>c.id===x.childId);return `<tr><td>${esc(child?.name||'-')}</td><td>${esc(({bm:'Bahasa Melayu',bi:'Bahasa Inggeris',math:'Matematik',science:'Sains'})[x.subject]||x.subject||'-')}</td><td>${esc(x.topic||'-')}</td><td>${Number(x.stars||0)}</td><td>${Number(x.attempts||0)}</td></tr>`}).join('')}</table></div>`:empty('Belum ada rekod pembelajaran.')}`;
    },

    subscriptions:()=>`${head('Langganan','Status akses Penjaga')}<div class="stat-grid"><div class="stat"><small>Aktif</small><b>${activeSubs.length}</b></div><div class="stat"><small>Tidak aktif</small><b>${customers.length-activeSubs.length}</b></div><div class="stat"><small>Jumlah Penjaga</small><b>${customers.length}</b></div></div>${customers.length?`<div class="table-wrap"><table class="table"><tr><th>Penjaga</th><th>Status</th><th>Tamat</th></tr>${customers.map(u=>`<tr><td>${esc(u.name||u.email||'-')}</td><td>${statusBadge(u.subscriptionStatus||'inactive')}</td><td>${formatDate(u.subscriptionEndsAt)}</td></tr>`).join('')}</table></div>`:empty('Tiada Penjaga.')}`,

    transactions:()=>`${head('Transaksi','Pengesahan pembayaran manual oleh Admin')}<div class="stat-grid"><div class="stat"><small>Jumlah rekod</small><b>${orders.length}</b></div><div class="stat"><small>Dibayar</small><b>${paidOrders.length}</b></div><div class="stat"><small>Nilai dibayar</small><b>RM${sales.toFixed(2)}</b></div></div>${orders.length?`<div class="table-wrap"><table class="table"><tr><th>ID</th><th>Pelan</th><th>Nilai</th><th>Status</th></tr>${orders.slice(-30).reverse().map(o=>`<tr><td><code>${esc(o.id)}</code></td><td>${esc(o.plan||'-')}</td><td>RM${Number(o.amount||0).toFixed(2)}</td><td>${statusBadge(o.status)}</td></tr>`).join('')}</table></div>`:empty('Belum ada transaksi manual yang disahkan.')}`,

    commissions:()=>{
      const agentCards=agents.map(a=>{
        const f=agentFinance(a);
        const bankOk=agentBankReady(a);
        return `<article class="admin-agent-payout-card ${f.pending>0?'has-pending':''}">
          <div class="admin-agent-payout-head"><div><small>AGENT</small><h3>${esc(a.name||a.email||'-')}</h3><span>${esc(a.agentCode||'-')}</span></div><div class="pending-pill">${formatMoney(f.pending)}<small>pending</small></div></div>
          <div class="agent-money-grid"><div><small>Jualan</small><b>${formatMoney(f.gross)}</b></div><div><small>Komisen</small><b>${formatMoney(f.commission)}</b></div><div><small>Dibayar</small><b>${formatMoney(f.paid)}</b></div><div class="profit"><small>Untung Admin</small><b>${formatMoney(f.profit)}</b></div></div>
          <div class="admin-bank-box ${bankOk?'ready':'missing'}"><div><small>AKAUN BANK</small><b>${bankOk?esc(a.payoutBankName):'Belum lengkap'}</b><span>${bankOk?`${esc(a.payoutAccountName)} · ${esc(a.payoutAccountNumber)}`:'Minta Agent lengkapkan di Agent → Tetapan.'}</span></div>${bankOk?'<span class="bank-check">✓</span>':'<span class="bank-check">!</span>'}</div>
          <button class="btn primary full mark-agent-payout" data-agent-uid="${a.id}" ${f.pending<=0||!bankOk?'disabled':''}>${f.pending>0?`Tandakan Dibayar ${formatMoney(f.pending)}`:'Tiada Pending'}</button>
        </article>`;
      }).join('');
      const payoutHistory=sortedPayouts.length?`<div class="table-wrap"><table class="table"><tr><th>Tarikh</th><th>Agent</th><th>Jumlah</th><th>Rekod</th><th>Akaun Bank</th></tr>${sortedPayouts.slice(0,40).map(x=>{const a=users.find(u=>u.id===x.agentUid);return `<tr><td>${formatDate(x.paidAt||x.createdAt)}</td><td>${esc(a?.name||x.agentName||x.agentUid||'-')}</td><td><b>${formatMoney(x.totalAmount)}</b></td><td>${Number(x.itemCount||0)}</td><td>${esc(x.bankName||'-')} · ${esc(x.accountNumber||'-')}</td></tr>`}).join('')}</table></div>`:empty('Belum ada pembayaran komisen direkodkan.');
      return `${head('Komisen & Bayaran Agent','Bayaran komisen dibuat setiap hari Sabtu')}
        <div class="admin-finance-strip commission-finance"><div><small>JUALAN KASAR</small><b>${formatMoney(sales)}</b></div><div><small>JUMLAH KOMISEN</small><b>${formatMoney(commissionTotal)}</b></div><div><small>PERLU TRANSFER SABTU</small><b>${formatMoney(commissionPendingTotal)}</b><span>${esc(saturdayLabel)}</span></div><div class="profit"><small>KEUNTUNGAN ADMIN</small><b>${formatMoney(adminProfit)}</b></div></div>
        <div class="commission-explain">Contoh: jualan RM45 − komisen Agent RM30 = <b>keuntungan Admin RM15</b>. Keuntungan dikira berdasarkan semua transaksi berstatus dibayar.</div>
        <div class="admin-agent-payout-grid">${agentCards||empty('Belum ada Agent.')}</div>
        <div class="commission-section-head"><div><small>SEJARAH BAYARAN</small><h3>Pembayaran komisen mingguan</h3></div></div>${payoutHistory}`;
    },

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

    settings:()=>{
      const paymentBody=`<div class="settings-grid">
          <div class="setting-card"><b>Promosi Lifetime</b><strong>${manualPaymentSettings.lifetimePromoActive!==false?'AKTIF':'TAMAT'}</strong><small>RM45 sekali bayar untuk pengguna baharu</small></div>
          <div class="setting-card"><b>Selepas promosi</b><strong>RM45</strong><small>3 bulan · kemudian RM15/bulan</small></div>
          <div class="setting-card"><b>Komisen Agent</b><strong>RM30 / RM10</strong><small>Pelanggan baharu / renewal bulanan</small></div>
        </div>
        <section class="admin-manual-payment-settings embedded-role-setting">
          <div class="dash-head compact"><div><small>PEMBAYARAN MANUAL</small><h3>Akaun bank & WhatsApp Admin</h3></div></div>
          <div class="manual-settings-grid">
            <label><span>Nama Bank</span><input id="manualBankName" value="${esc(manualPaymentSettings.bankName||'')}" placeholder="Contoh: Maybank"></label>
            <label><span>Nama Pemilik Akaun</span><input id="manualAccountName" value="${esc(manualPaymentSettings.accountName||'')}" placeholder="Nama seperti pada akaun bank"></label>
            <label><span>Nombor Akaun</span><input id="manualAccountNumber" value="${esc(manualPaymentSettings.accountNumber||'')}" placeholder="Nombor akaun bank"></label>
            <label><span>WhatsApp Admin</span><input id="manualAdminWhatsapp" value="${esc(manualPaymentSettings.adminWhatsapp||'')}" placeholder="60123456789"></label>
            <label class="manual-promo-switch"><input id="manualLifetimePromo" type="checkbox" ${manualPaymentSettings.lifetimePromoActive!==false?'checked':''}><span><b>Promosi Lifetime RM45 aktif</b><small>Tutup suis ini apabila promosi tamat. Pelanggan baharu selepas itu menerima 3 bulan pada RM45.</small></span></label>
          </div>
          <button class="btn primary" id="saveManualPaymentSettings">Simpan Tetapan Pembayaran</button>
        </section>
        <div class="dash-note">📧 Selepas Admin mengaktifkan langganan, Firebase Function akan memasukkan e-mel pengaktifan ke queue. Tetapkan SMTP Gmail App Password sebelum deploy Functions.</div>`;

      return `<div class="standard-settings-page">
        ${renderStandardAccountSettings(p,'Admin')}
        <div class="std-settings-stack role-settings-stack">
          ${renderSettingsDisclosure({id:'admin-payment',icon:'💳',title:'Pembayaran Manual & Promosi',summary:'Bank Admin, WhatsApp, Lifetime RM45 dan komisen Agent',badge:manualPaymentSettings.lifetimePromoActive!==false?'Lifetime aktif':'Pelan 3 bulan',body:paymentBody})}
        </div>
      </div>`;
    }
  };

  function renderAgentRows(list){
    return list.length?`<div class="table-wrap"><table class="table"><tr><th>Nama</th><th>Kod</th><th>Jualan</th><th>Komisen</th><th>Pending Sabtu</th><th>Untung Admin</th><th>Bank</th></tr>${list.map(a=>{const f=agentFinance(a);return `<tr><td><b>${esc(a.name||'-')}</b><small class="table-sub">${esc(a.email||'-')}</small></td><td><code>${esc(a.agentCode||'-')}</code></td><td>${formatMoney(f.gross)}</td><td>${formatMoney(f.commission)}</td><td><b>${formatMoney(f.pending)}</b></td><td><b>${formatMoney(f.profit)}</b></td><td>${agentBankReady(a)?`<span class="bank-table-ready">✓ ${esc(agentBankSummary(a))}</span>`:'<span class="bank-table-missing">Belum lengkap</span>'}</td></tr>`}).join('')}</table></div>`:empty('Tiada Agent ditemui.');
  }

  function renderUserRows(list){
    return list.length?`<div class="table-wrap"><table class="table"><tr><th>Nama</th><th>E-mel</th><th>Langganan</th><th>Daftar melalui</th></tr>${list.map(u=>`<tr><td>${esc(u.name||'-')}</td><td>${esc(u.email||'-')}</td><td>${statusBadge(u.subscriptionStatus||'inactive')}</td><td>${esc(u.referredByCode||'Direct')}</td></tr>`).join('')}</table></div>`:empty('Tiada pengguna ditemui.');
  }

  async function markAgentPayout(agentUid){
    if(currentProfile?.role!=='admin')throw new Error('Akses Admin diperlukan.');
    const agentRef=fb.doc(fb.db,'users',agentUid);
    const agentSnap=await fb.getDoc(agentRef);
    if(!agentSnap.exists())throw new Error('Akaun Agent tidak ditemui.');
    const agent={id:agentSnap.id,...agentSnap.data()};
    if(agent.role!=='agent')throw new Error('Akaun ini bukan Agent.');
    if(!agentBankReady(agent))throw new Error('Agent belum melengkapkan maklumat akaun bank.');

    const commissionSnap=await fb.getDocs(fb.query(fb.collection(fb.db,'commissions'),fb.where('agentUid','==',agentUid)));
    const pendingDocs=commissionSnap.docs.filter(d=>(d.data()||{}).status==='pending');
    if(!pendingDocs.length)throw new Error('Tiada komisen pending untuk Agent ini.');
    if(pendingDocs.length>400)throw new Error('Terlalu banyak rekod pending. Hubungi penyelenggara sebelum meneruskan.');

    const totalAmount=pendingDocs.reduce((s,d)=>s+Number((d.data()||{}).amount||0),0);
    const ok=confirm(`Sahkan anda SUDAH transfer ${formatMoney(totalAmount)} kepada ${agent.name||agent.email||'Agent'}?\n\n${agent.payoutBankName}\n${agent.payoutAccountName}\n${agent.payoutAccountNumber}\n\nSelepas disahkan, ${pendingDocs.length} komisen akan ditanda sebagai DIBAYAR.`);
    if(!ok)return {cancelled:true};

    const batchId=`PAYOUT-${agentUid}-${Date.now()}`;
    const payoutRef=fb.doc(fb.db,'commissionPayouts',batchId);
    const batch=fb.writeBatch(fb.db);
    pendingDocs.forEach(d=>batch.update(d.ref,{
      status:'paid',
      paidAt:fb.serverTimestamp(),
      paidBy:fb.auth.currentUser.uid,
      payoutBatchId:batchId
    }));
    batch.set(payoutRef,{
      agentUid,
      agentCode:agent.agentCode||null,
      agentName:agent.name||agent.email||'Agent',
      totalAmount,
      itemCount:pendingDocs.length,
      bankName:agent.payoutBankName,
      accountName:agent.payoutAccountName,
      accountNumber:agent.payoutAccountNumber,
      status:'paid',
      payoutDay:'Saturday',
      paidAt:fb.serverTimestamp(),
      paidBy:fb.auth.currentUser.uid,
      createdAt:fb.serverTimestamp()
    });
    await batch.commit();
    return {cancelled:false,totalAmount,itemCount:pendingDocs.length,batchId};
  }

  let currentView='overview';
  const mount=async(view)=>{
    currentView=view;
    $('#dashboard').innerHTML=shell(view,view==='subscriptions'?'':views[view]());
    $('#adminLogoutNav')?.addEventListener('click',e=>{e.preventDefault();setRoleNav(false);logoutCilikGo();});
    if(view==='subscriptions') await renderAdminSubscriptions();
    document.querySelectorAll('.admin-nav').forEach(a=>a.onclick=()=>{setRoleNav(false);mount(a.dataset.view);});
    const main=$('.admin-shell .portal-main'); if(main) main.scrollTop=0;
    animateIn($('#adminContent'));
    const search=$('#adminSearch');
    if(search&&view==='users') search.oninput=()=>{const q=search.value.toLowerCase();$('#adminUserTable').innerHTML=renderUserRows(customers.filter(u=>(u.name||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q)));};
    if(search&&view==='agents') search.oninput=()=>{const q=search.value.toLowerCase();$('#adminAgentTable').innerHTML=renderAgentRows(agents.filter(a=>(a.name||'').toLowerCase().includes(q)||(a.email||'').toLowerCase().includes(q)||(a.agentCode||'').toLowerCase().includes(q)));};
    if(view==='settings') wireStandardAccountSettings(p,()=>renderAdmin(p,'settings'));
    if(view==='commissions'){
      document.querySelectorAll('.mark-agent-payout').forEach(btn=>btn.onclick=async()=>{
        const agentUid=btn.dataset.agentUid;
        setButtonLoading(btn,true,'Memproses…');
        try{
          const result=await markAgentPayout(agentUid);
          if(result?.cancelled){setButtonLoading(btn,false);return;}
          toast(`Pembayaran ${formatMoney(result.totalAmount)} ditanda selesai.`);
          await renderAdmin(p,'commissions');
        }catch(e){
          console.error(e);
          toast('Gagal tandakan pembayaran: '+(e.message||e));
          setButtonLoading(btn,false);
        }
      });
    }
    if(view==='settings'&&$('#saveManualPaymentSettings')) $('#saveManualPaymentSettings').onclick=async()=>{
      const btn=$('#saveManualPaymentSettings');setButtonLoading(btn,true,'Menyimpan…');
      try{
        const payload={
          bankName:($('#manualBankName')?.value||'').trim(),
          accountName:($('#manualAccountName')?.value||'').trim(),
          accountNumber:($('#manualAccountNumber')?.value||'').trim(),
          adminWhatsapp:normalizeWhatsapp($('#manualAdminWhatsapp')?.value||''),
          lifetimePromoActive:!!$('#manualLifetimePromo')?.checked,
          lifetimePrice:SUBSCRIPTION_BUSINESS.lifetimePrice,
          starterPrice:SUBSCRIPTION_BUSINESS.starterPrice,
          starterMonths:SUBSCRIPTION_BUSINESS.starterMonths,
          renewalPrice:SUBSCRIPTION_BUSINESS.renewalPrice,
          renewalMonths:SUBSCRIPTION_BUSINESS.renewalMonths,
          newSubscriberCommission:SUBSCRIPTION_BUSINESS.newSubscriberCommission,
          renewalCommission:SUBSCRIPTION_BUSINESS.renewalCommission,
          updatedAt:fb.serverTimestamp(),updatedBy:fb.auth.currentUser.uid
        };
        await fb.setDoc(fb.doc(fb.db,'settings','manualPayment'),payload,{merge:true});
        cachedManualPaymentSettings={...DEFAULT_MANUAL_PAYMENT_SETTINGS,...payload};
        applyPublicBusinessConfig(cachedManualPaymentSettings);
        toast('Tetapan pembayaran manual berjaya disimpan.');
        await mount('settings');
      }catch(e){console.error(e);toast('Gagal simpan tetapan: '+(e.message||e));setButtonLoading(btn,false);}
    };
  };
  await mount(initialView);
}

async function renderPortal(p){
  showDashboardPage();
  $('#portalTitle')?.replaceChildren(document.createTextNode(p.role==='admin'?'Dashboard Admin':p.role==='agent'?'Dashboard Agent':'Dashboard Penjaga'));
  $('#portalSubtitle')?.replaceChildren(document.createTextNode('Paparan ini menggunakan akaun dan role sebenar daripada Firebase.'));
  if($('#appMemberName')) $('#appMemberName').textContent=p.name||p.email||'Akaun';
  if(p.role==='admin') await renderAdmin(p); else if(p.role==='agent') await renderAgent(p); else await renderUser(p);
}

if(fb) fb.onAuthStateChanged(fb.auth, async user=>{
  if(!user){
    currentProfile=null;
    $('#guestActions').classList.remove('hidden');
    $('#memberActions').classList.add('hidden');
    $('#mobileGuestActions')?.classList.remove('hidden');
    $('#mobileMemberActions')?.classList.add('hidden');
    $('#portalTitle')?.replaceChildren(document.createTextNode('Dashboard anda.'));
    $('#portalSubtitle')?.replaceChildren(document.createTextNode('Log masuk untuk membuka dashboard mengikut peranan akaun anda.'));
    $('#dashboard').innerHTML='<div class="portal-locked"><div class="lock-icon">🔐</div><h3>Portal dilindungi</h3><p>Log masuk untuk membuka dashboard.</p><button class="btn primary" id="lockedLogin">Log Masuk</button></div>';
    $('#lockedLogin').onclick=()=>showAuthPage('login');
    if(location.hash==='#login')showAuthPage('login');
    else if(location.hash==='#register')showAuthPage('register');
    else showPublicPage();
    return;
  }
  try{
    currentProfile=await getProfile(user);
    if(currentProfile.role==='user') currentProfile=await claimReferralForCurrentUser(currentProfile);
    $('#guestActions').classList.add('hidden');
    $('#memberActions').classList.remove('hidden');
    $('#mobileGuestActions')?.classList.add('hidden');
    $('#mobileMemberActions')?.classList.remove('hidden');
    const displayName=currentProfile.name||user.email;
    if($('#memberName')) $('#memberName').textContent=displayName;
    if($('#mobileMemberName')) $('#mobileMemberName').textContent=displayName;
    if($('#appMemberName')) $('#appMemberName').textContent=displayName;
    if($('#appMobileMemberName')) $('#appMobileMemberName').textContent=displayName;
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
  if(hash==='#subscription'&&currentProfile.role==='user'){renderParentSubscriptionView(currentProfile);return;}
  if(hash==='#dashboard'){await renderPortal(currentProfile);return;}
  if(hash==='#home')showPublicPage();
});

$('#buyBtn').onclick=async()=>{
  if(!fb?.auth.currentUser){
    showAuthPage('register','user');
    toast('Daftar akaun Penjaga dahulu untuk mendapatkan akses CilikGo.');
    return;
  }
  if(currentProfile?.role!=='user'){toast('Langganan CilikGo adalah untuk akaun Penjaga.');return;}
  history.pushState(null,'','#subscription');
  await renderParentSubscriptionView(currentProfile);
};
loadManualPaymentSettings().then(applyPublicBusinessConfig).catch(e=>console.warn('public pricing config',e));


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
  const sub=subscriptionState(profile),expired=sub.expired,paidBefore=hasPaidSubscriptionBefore(profile);
  const promo=cachedManualPaymentSettings?.lifetimePromoActive!==false;
  const initial=!paidBefore&&!expired;
  const price=initial?45:15;
  const plan=initial?(promo?'Promosi Lifetime':'3 bulan akses'):'Pembaharuan 1 bulan';
  $('#gameContent').innerHTML=`<div class="subscription-gate"><div class="gate-icon">🔒</div><small>Akses Premium CilikGo</small>
    <h2>${expired?'Langganan telah tamat':'Langganan diperlukan'}</h2>
    <p>${expired?'Perbaharui langganan secara manual untuk meneruskan latihan Tahun 1–6.':'Pembayaran CilikGo dibuat melalui pindahan bank dan disahkan secara manual oleh Admin.'}</p>
    <div class="gate-plan"><span>${esc(plan)}</span><b>RM${price}</b><small>${initial?(promo?'sekali bayar · Lifetime':'3 bulan pertama'):'1 bulan'}</small></div>
    <div class="gate-actions"><button class="btn primary" id="gateManualPayment">Lihat Cara Bayar</button><button class="btn ghost" id="gateBack">Kembali</button></div>
    <p class="gate-note">Transfer bank → WhatsApp bukti pembayaran → Admin aktifkan akaun → e-mel pengesahan.</p></div>`;
  if(!$('#gameModal').open) $('#gameModal').showModal();
  $('#gateBack').onclick=()=>$('#gameModal').close();
  $('#gateManualPayment').onclick=async()=>{
    $('#gameModal').close();
    history.pushState(null,'','#subscription');
    await renderParentSubscriptionView(profile);
  };
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
