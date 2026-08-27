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
if(ref){ localStorage.setItem('cilikgo_ref',ref); toast('Kod agent '+ref+' telah direkodkan.'); }
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
    const agentCode=role==='agent'?'CG-'+cred.user.uid.slice(0,7).toUpperCase():null;
    const referredByCode=role==='user'?(localStorage.getItem('cilikgo_ref')||null):null;
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
  const fallback={name:user.displayName||user.email?.split('@')[0]||'Pengguna',email:user.email||'',role:'user',subscriptionStatus:'inactive',createdAt:fb.serverTimestamp()};
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

async function renderUser(p){
  const kids=await getMyChildren();
  const progress=await getMyProgress();
  if(!activeChild&&kids.length) activeChild=kids[0];
  const totalStars=progress.reduce((s,x)=>s+Number(x.stars||0),0);
  const active=p.subscriptionStatus==='active';
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
    return `<button class="child-card ${activeChild?.id===c.id?'selected':''}" data-child="${c.id}"><span>${esc(c.avatar||'🧒')}</span><b>${esc(c.name)}</b><small>${esc(c.age)} tahun · ⭐ ${st}</small></button>`;
  }).join('');

  $('#dashboard').innerHTML=`<div class="dash-shell"><aside class="dash-side"><h3>👨‍👩‍👧 Penjaga</h3><a class="active">Perkembangan</a><a href="#modules">Modul 3M</a><a href="#pricing">Langganan</a><a href="#settings">Settings</a></aside>
  <section class="dash-main"><div class="dash-head"><div><small>Selamat datang</small><h2>${esc(p.name||'Penjaga')} 👋</h2></div><span class="badge ${active?'':'status-inactive'}">${active?'Langganan aktif':'Belum aktif'}</span></div>
  <div class="parent-overview"><div><small>Jumlah profil anak</small><b>${kids.length}</b></div><div><small>Jumlah ⭐ keluarga</small><b>${totalStars}</b></div><div><small>Aktiviti direkod</small><b>${progress.length}</b></div></div>
  <div class="child-selector-head"><div><h3>Profil Anak</h3><p>Pilih anak untuk melihat laporan perkembangannya.</p></div><button class="btn primary" id="addChildBtn">+ Tambah Anak</button></div>
  <div class="child-list">${childCards||'<div class="empty-state">Belum ada profil anak. Tambah anak untuk mula merekod kemajuan 3M.</div>'}</div>

  ${activeChild?`<div class="report-header"><div><span class="report-avatar">${esc(activeChild.avatar||'🧒')}</span><div><small>Laporan perkembangan</small><h2>${esc(activeChild.name)}</h2><p>${esc(activeChild.age)} tahun · Kemajuan berdasarkan aktiviti yang telah diselesaikan.</p></div></div><span class="report-stars">⭐ ${selectedRows.reduce((s,x)=>s+Number(x.stars||0),0)}</span></div>
  <div class="module-progress-grid">${['Membaca','Menulis','Mengira'].map(m=>{const x=summary[m],pct=Math.min(100,x.rows?Math.max(12,x.efficiency):0);return `<div class="module-report"><div class="module-report-head"><span>${moduleIcon[m]}</span><div><b>${m}</b><small>Level tertinggi ${x.level}</small></div><strong>${x.stars} ⭐</strong></div><div class="parent-progress"><span style="width:${pct}%"></span></div><div class="module-meta"><span>${x.rows} aktiviti</span><span>${x.attempts} percubaan</span><span>${x.rows?x.efficiency+'% ketepatan':'Belum mula'}</span></div></div>`}).join('')}</div>
  <div class="parent-report-grid"><div class="recommend-card"><span class="recommend-icon">💡</span><div><small>Cadangan CilikGo</small><h3>${rec.title}</h3><p>${rec.text}</p><button class="btn primary" id="recommendedActivity">Mulakan ${rec.module}</button></div></div>
  <div class="strength-card"><small>Pemerhatian ringkas</small><h3>${selectedRows.length?'Corak pembelajaran':'Belum cukup data'}</h3><p>${selectedRows.length?(rec.strongest?`${rec.strongest} ialah bahagian yang paling lancar setakat rekod semasa. Teruskan sesi pendek dan konsisten.`:'Teruskan beberapa aktiviti untuk mendapatkan gambaran perkembangan yang lebih jelas.'):'Lengkapkan beberapa aktiviti dahulu supaya CilikGo boleh memberikan cadangan yang lebih berguna.'}</p></div></div>
  <div class="recent-learning"><div class="section-title"><div><h3>Aktiviti Terkini</h3><p>Rekod terbaru ${esc(activeChild.name)}.</p></div></div>${recent.length?`<div class="recent-list">${recent.map(x=>`<div class="recent-item"><span>${moduleIcon[x.module]||'🎯'}</span><div><b>${esc(x.module||'Aktiviti')} · Level ${esc(x.level||'-')}</b><small>${Number(x.attempts||0)} percubaan</small></div><strong>⭐ ${Number(x.stars||0)}</strong></div>`).join('')}</div>`:'<div class="empty-state">Belum ada aktiviti direkod untuk anak ini.</div>'}</div>`:''}

  <div class="subscription-box"><div><small>Status langganan</small><h3>${active?'Aktif hingga '+formatDate(p.subscriptionEndsAt):'Belum aktif'}</h3><p>${active?'Akses penuh CilikGo sedang aktif.':'ToyyibPay masih KIV. Langganan boleh diaktifkan kemudian.'}</p></div><button class="btn primary" id="dashboardSubscribeBtn" ${active?'':'disabled'}>${active?'Sambung RM15 / bulan':'Pembayaran KIV'}</button></div>
  </section></div>`;

  $('#addChildBtn').onclick=()=>$('#childModal').showModal();
  if($('#dashboardSubscribeBtn')&&active) $('#dashboardSubscribeBtn').onclick=()=>startPayment('renewal');
  document.querySelectorAll('[data-child]').forEach(b=>b.onclick=async()=>{activeChild=kids.find(c=>c.id===b.dataset.child);await renderUser(p);});
  if($('#recommendedActivity')) $('#recommendedActivity').onclick=()=>openLevelPicker(({Membaca:'read',Menulis:'write',Mengira:'count'})[rec.module],true);
}
async function renderAgent(p){
  let orders=[], commissions=[];
  try{ const oq=fb.query(fb.collection(fb.db,'orders'),fb.where('agentUid','==',p.uid)); orders=(await fb.getDocs(oq)).docs.map(d=>({id:d.id,...d.data()})); }catch(e){console.warn('orders',e)}
  try{ const cq=fb.query(fb.collection(fb.db,'commissions'),fb.where('agentUid','==',p.uid)); commissions=(await fb.getDocs(cq)).docs.map(d=>({id:d.id,...d.data()})); }catch(e){console.warn('commissions',e)}
  const total=commissions.reduce((s,x)=>s+Number(x.amount||0),0), code=p.agentCode||('CG-'+p.uid.slice(0,7).toUpperCase()), link=`${location.origin}${location.pathname}?ref=${code}`;
  $('#dashboard').innerHTML=`<div class="dash-shell"><aside class="dash-side"><h3>🤝 Portal Agent</h3><a class="active">Dashboard</a><a>Pautan Affiliate</a><a>Pembelian</a><a>Komisen</a><a>Profil</a><a>Tetapan</a></aside><section class="dash-main"><div class="dash-head"><div><small>Agent</small><h2>${esc(p.name)}</h2></div><span class="badge">${esc(code)}</span></div><div class="stat-grid"><div class="stat"><small>Pembelian dirujuk</small><b>${orders.length}</b></div><div class="stat"><small>Rekod komisen</small><b>${commissions.length}</b></div><div class="stat"><small>Jumlah komisen</small><b>RM${total.toFixed(2)}</b></div></div><h3>Pautan Affiliate Anda</h3><div class="ref-box"><code id="agentLink">${esc(link)}</code><button class="btn primary" id="copyRef">Salin</button></div><h3>Pembelian</h3>${orders.length?`<table class="table"><tr><th>Rujukan</th><th>Nilai</th><th>Status</th></tr>${orders.slice(0,10).map(o=>`<tr><td>${esc(o.id)}</td><td>RM${Number(o.amount||69).toFixed(2)}</td><td><span class="badge">${esc(o.status||'direkod')}</span></td></tr>`).join('')}</table>`:'<div class="empty-state">Belum ada pembelian melalui pautan affiliate anda.</div>'}</section></div>`;
  $('#copyRef').onclick=async()=>{ await navigator.clipboard.writeText(link); toast('Pautan affiliate disalin.'); };
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
    $('#dashboard').innerHTML=shell(view,views[view]());
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
  const name=$('#childName').value.trim(), age=Number($('#childAge').value), avatar=$('#childAvatar').value;
  if(!name) return toast('Masukkan nama panggilan anak.');
  try{ const ref=await fb.addDoc(fb.collection(fb.db,'children'),{ownerUid:fb.auth.currentUser.uid,name,age,avatar,createdAt:fb.serverTimestamp()}); localStorage.setItem('cilikgo_active_child',ref.id); $('#childName').value=''; $('#childModal').close(); toast('Profil anak berjaya ditambah.'); await renderUser(currentProfile); }
  catch(e){ console.error(e); toast('Gagal simpan profil: '+friendlyError(e)); }
};

const curriculum={
  read:{
    title:'📖 Membaca',
    levels:[
      {level:1,name:'Suku Kata Asas',unlockStars:0,questions:[
        {prompt:'BA + ?',answers:['JU','KU','TU'],correct:'JU',success:'BA + JU = BAJU 🎉'},
        {prompt:'BU + ?',answers:['KU','KUH','KA'],correct:'KU',success:'BU + KU = BUKU 📚'},
        {prompt:'BO + ?',answers:['LA','LU','LI'],correct:'LA',success:'BO + LA = BOLA ⚽'},
        {prompt:'MA + ?',answers:['TA','TI','TU'],correct:'TA',success:'MA + TA = MATA 👀'},
        {prompt:'SU + ?',answers:['SU','SA','SI'],correct:'SU',success:'SU + SU = SUSU 🥛'}]},
      {level:2,name:'Bina Perkataan',unlockStars:8,questions:[
        {prompt:'KU + ?',answers:['DA','DI','DU'],correct:'DA',success:'KU + DA = KUDA 🐴'},
        {prompt:'RO + ?',answers:['TI','TA','TU'],correct:'TI',success:'RO + TI = ROTI 🍞'},
        {prompt:'NA + ?',answers:['SI','SA','SU'],correct:'SI',success:'NA + SI = NASI 🍚'},
        {prompt:'TO + ?',answers:['PI','PA','PU'],correct:'PI',success:'TO + PI = TOPI 🧢'},
        {prompt:'KA + ?',answers:['KI','KU','KO'],correct:'KI',success:'KA + KI = KAKI 🦶'}]},
      {level:3,name:'Perkataan Lebih Panjang',unlockStars:18,questions:[
        {prompt:'KE + RA + ?',answers:['JA','JI','JU'],correct:'JA',success:'KE + RA + JA = KERAJA 👑'},
        {prompt:'KE + RE + ?',answers:['TA','TI','TU'],correct:'TA',success:'KE + RE + TA = KERETA 🚗'},
        {prompt:'SE + KO + ?',answers:['LAH','LIH','LUH'],correct:'LAH',success:'SE + KO + LAH = SEKOLAH 🏫'},
        {prompt:'KE + PA + ?',answers:['LA','LI','LU'],correct:'LA',success:'KE + PA + LA = KEPALA 🙂'},
        {prompt:'BI + NA + ?',answers:['TANG','TING','TUNG'],correct:'TANG',success:'BI + NA + TANG = BINATANG 🐯'}]}
    ]},
  write:{
    title:'✏️ Menulis',
    levels:[
      {level:1,name:'Pilih Ejaan',unlockStars:0,questions:[
        {prompt:'🐱',answers:['KUCIN','KUCING','KUSING'],correct:'KUCING',success:'Ejaan betul ialah KUCING 🐱'},
        {prompt:'🐟',answers:['IKAN','EKAN','IKON'],correct:'IKAN',success:'Ejaan betul ialah IKAN 🐟'},
        {prompt:'🌸',answers:['BUNGA','BONGA','BUNGO'],correct:'BUNGA',success:'Ejaan betul ialah BUNGA 🌸'},
        {prompt:'👁️',answers:['MATA','META','MITA'],correct:'MATA',success:'Ejaan betul ialah MATA 👁️'},
        {prompt:'📚',answers:['BUKU','BOKU','BUKO'],correct:'BUKU',success:'Ejaan betul ialah BUKU 📚'}]},
      {level:2,name:'Lengkapkan Perkataan',unlockStars:8,questions:[
        {prompt:'B _ L A',answers:['O','U','A'],correct:'O',success:'B + O + LA = BOLA ⚽'},
        {prompt:'R _ T I',answers:['O','A','U'],correct:'O',success:'R + O + TI = ROTI 🍞'},
        {prompt:'K _ D A',answers:['U','O','A'],correct:'U',success:'K + U + DA = KUDA 🐴'},
        {prompt:'N _ S I',answers:['A','E','O'],correct:'A',success:'N + A + SI = NASI 🍚'},
        {prompt:'T _ P I',answers:['O','U','A'],correct:'O',success:'T + O + PI = TOPI 🧢'}]},
      {level:3,name:'Ejaan Lebih Panjang',unlockStars:18,questions:[
        {prompt:'🚗',answers:['KERETA','KARETA','KERITA'],correct:'KERETA',success:'Ejaan betul ialah KERETA 🚗'},
        {prompt:'🏫',answers:['SEKOLAH','SIKOLAH','SEKULAH'],correct:'SEKOLAH',success:'Ejaan betul ialah SEKOLAH 🏫'},
        {prompt:'🦋',answers:['RAMA-RAMA','REMA-REMA','RAMA-ROMA'],correct:'RAMA-RAMA',success:'Ejaan betul ialah RAMA-RAMA 🦋'},
        {prompt:'🚲',answers:['BASIKAL','BESIKAL','BASIKEL'],correct:'BASIKAL',success:'Ejaan betul ialah BASIKAL 🚲'},
        {prompt:'🐯',answers:['HARIMAU','HERIMAU','HARIMOU'],correct:'HARIMAU',success:'Ejaan betul ialah HARIMAU 🐯'}]}
    ]},
  count:{
    title:'🧮 Mengira',
    levels:[
      {level:1,name:'Nombor 1–5',unlockStars:0,questions:[
        {prompt:'🍎 🍎 🍎',answers:['2','3','4'],correct:'3',success:'Tepat! Ada 3 biji epal 🍎'},
        {prompt:'⭐ ⭐',answers:['1','2','3'],correct:'2',success:'Tepat! Ada 2 bintang ⭐'},
        {prompt:'🐟 🐟 🐟 🐟',answers:['3','4','5'],correct:'4',success:'Tepat! Ada 4 ekor ikan 🐟'},
        {prompt:'🌼',answers:['1','2','3'],correct:'1',success:'Tepat! Ada 1 bunga 🌼'},
        {prompt:'⚽ ⚽ ⚽ ⚽ ⚽',answers:['4','5','6'],correct:'5',success:'Tepat! Ada 5 bola ⚽'}]},
      {level:2,name:'Nombor 6–10',unlockStars:8,questions:[
        {prompt:'🍓 🍓 🍓 🍓 🍓 🍓',answers:['5','6','7'],correct:'6',success:'Bagus! Ada 6 strawberi 🍓'},
        {prompt:'🐥 🐥 🐥 🐥 🐥 🐥 🐥',answers:['6','7','8'],correct:'7',success:'Bagus! Ada 7 anak ayam 🐥'},
        {prompt:'🌟 🌟 🌟 🌟 🌟 🌟 🌟 🌟',answers:['7','8','9'],correct:'8',success:'Bagus! Ada 8 bintang 🌟'},
        {prompt:'🍊 🍊 🍊 🍊 🍊 🍊 🍊 🍊 🍊',answers:['8','9','10'],correct:'9',success:'Bagus! Ada 9 oren 🍊'},
        {prompt:'🔵 🔵 🔵 🔵 🔵 🔵 🔵 🔵 🔵 🔵',answers:['8','9','10'],correct:'10',success:'Bagus! Ada 10 bulatan 🔵'}]},
      {level:3,name:'Tambah Mudah',unlockStars:18,questions:[
        {prompt:'2 + 1 = ?',answers:['2','3','4'],correct:'3',success:'Betul! 2 + 1 = 3 🎉'},
        {prompt:'3 + 2 = ?',answers:['4','5','6'],correct:'5',success:'Betul! 3 + 2 = 5 🎉'},
        {prompt:'4 + 2 = ?',answers:['5','6','7'],correct:'6',success:'Betul! 4 + 2 = 6 🎉'},
        {prompt:'5 + 3 = ?',answers:['7','8','9'],correct:'8',success:'Betul! 5 + 3 = 8 🎉'},
        {prompt:'6 + 4 = ?',answers:['9','10','11'],correct:'10',success:'Betul! 6 + 4 = 10 🎉'}]}
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

const moduleStars=(progress,module)=>progress.filter(x=>x.module===module&&x.correct===true).reduce((n,x)=>n+(Number(x.stars)||0),0);
function unlockedLevel(progress,key){
  const levels=curriculum[key].levels, stars=moduleStars(progress,gameKeyToModule[key]);
  let unlocked=1; levels.forEach(l=>{ if(stars>=l.unlockStars) unlocked=l.level; }); return unlocked;
}
function openLevelPicker(key,track=false){
  const c=curriculum[key];
  const render=async()=>{
    const progress=track&&activeChild&&currentProfile?await loadProgress(currentProfile.uid,activeChild.id):[];
    const stars=moduleStars(progress,gameKeyToModule[key]), max=track?unlockedLevel(progress,key):3;
    $('#gameContent').innerHTML=`<h2>${c.title}</h2>${track&&activeChild?`<p class="game-child">${esc(activeChild.avatar||'🧒')} ${esc(activeChild.name)} · ${gameKeyToModule[key]}</p>`:''}<p>Pilih tahap pembelajaran:</p><div class="level-grid">${c.levels.map(l=>`<button class="level-card" data-level="${l.level}" ${l.level>max?'disabled':''}><b>Level ${l.level}</b><span>${esc(l.name)}</span><small>${l.level<=max?'Terbuka':'🔒 Perlukan '+l.unlockStars+' ⭐'}</small></button>`).join('')}</div>${track?`<p class="level-total">⭐ ${stars} bintang ${gameKeyToModule[key]}</p>`:''}`;
    $('#gameModal').showModal();
    document.querySelectorAll('.level-card:not(:disabled)').forEach(b=>b.onclick=()=>startLevel(key,Number(b.dataset.level),track));
  }; render();
}
async function startLevel(key,levelNo,track=false){
  const c=curriculum[key], level=c.levels.find(x=>x.level===levelNo);
  const cmsQuestions=await loadCmsQuestions(key,levelNo);
  const sourceQuestions=cmsQuestions.length?cmsQuestions:level.questions;
  const questions=[...sourceQuestions].sort(()=>Math.random()-.5);
  let index=0,scoreStars=0,totalAttempts=0;

  const renderQuestion=()=>{
    const q=questions[index]; let attempts=0,completed=false;
    const pct=Math.round((index/questions.length)*100);
    $('#gameContent').innerHTML=`<h2>${c.title} · Level ${levelNo}</h2>
      ${track&&activeChild?`<p class="game-child">${esc(activeChild.avatar||'🧒')} ${esc(activeChild.name)} · ${esc(level.name)}</p>`:''}
      <div class="learning-hud"><div><b>Soalan ${index+1}/${questions.length}</b><small>${pct}% selesai</small></div><div class="hud-stars">⭐ ${scoreStars}</div></div>
      <div class="level-progress"><span style="width:${pct}%"></span></div>
      <div class="audio-row"><button class="audio-btn" id="speakQuestion">🔊 Dengar</button><span>Tak apa kalau tersalah. Cuba lagi 💜</span></div>
      <div class="game-prompt">${q.prompt}</div>
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
      <div class="result-actions"><button class="btn primary" id="playAgain">Main Lagi</button><button class="btn ghost" id="backLevels">Pilih Level</button></div></div>`;
    celebrate(); speakBM(passed?'Syabas, hebat!':'Bagus kerana mencuba');
    if(track&&activeChild&&fb?.auth.currentUser){
      try{
        await fb.addDoc(fb.collection(fb.db,'progress'),{ownerUid:fb.auth.currentUser.uid,childId:activeChild.id,module:gameKeyToModule[key],activity:key,level:levelNo,questions:questions.length,correct:true,attempts:totalAttempts,stars:scoreStars,passed,createdAt:fb.serverTimestamp()});
        toast(`⭐ ${scoreStars} bintang ${activeChild.name} direkodkan!`);
      }catch(e){console.error(e);toast('Level selesai, tetapi rekod kemajuan gagal disimpan.');}
    }
    $('#playAgain').onclick=()=>startLevel(key,levelNo,track);
    $('#backLevels').onclick=()=>openLevelPicker(key,track);
  };
  renderQuestion();
}
function openGame(key,track=false){ openLevelPicker(key,track); }
document.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>openGame(b.dataset.game,false));
