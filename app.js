import { firebaseConfig, USE_FIREBASE } from './firebase.js';

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
const toast = msg => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000); };

document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>$('#'+b.dataset.open).showModal());
document.querySelectorAll('dialog .x').forEach(b=>b.onclick=()=>b.closest('dialog').close());
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
    await fb.setDoc(fb.doc(fb.db,'users',cred.user.uid),{name,email,role,agentCode,createdAt:fb.serverTimestamp(),subscriptionStatus:'inactive'});
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

async function renderUser(p){
  try{ await loadChildren(p.uid); }catch(e){ console.warn(e); userChildren=[]; activeChild=null; }
  const progress=await loadProgress(p.uid,activeChild?.id);
  const correct=progress.filter(x=>x.correct===true).length, attempts=progress.length;
  const byModule=k=>progress.filter(x=>x.module===k&&x.correct===true).length;
  const active=p.subscriptionStatus==='active';
  $('#dashboard').innerHTML=`<div class="dash-shell"><aside class="dash-side"><h3>👨‍👩‍👧 CilikGo</h3><a class="active">Ringkasan</a><a>Profil Anak</a><a>Modul 3M</a><a>Kemajuan</a><a>Langganan</a><a>Tetapan</a></aside><section class="dash-main"><div class="dash-head"><div><small>Selamat kembali,</small><h2>${esc(p.name)} 👋</h2></div><span class="badge ${active?'':'status-inactive'}">${active?'Langganan Aktif':'Mod Ujian'}</span></div>
  <div class="stat-grid"><div class="stat"><small>Profil anak</small><b>${userChildren.length}</b></div><div class="stat"><small>Jawapan betul</small><b>${correct}/${attempts}</b></div><div class="stat"><small>Bintang</small><b>⭐ ${correct}</b></div></div>
  <div class="section-line"><h3>Profil Anak</h3><button class="btn primary" id="addChildBtn">+ Tambah Anak</button></div>
  ${userChildren.length?`<div class="child-grid">${userChildren.map(c=>`<button class="child-card ${activeChild?.id===c.id?'selected':''}" data-child="${c.id}"><span>${esc(c.avatar||'🧒')}</span><b>${esc(c.name||'Anak')}</b><small>${esc(c.age||'')} tahun</small></button>`).join('')}</div>`:'<div class="empty-state">Belum ada profil anak. Tambah profil pertama untuk mula merekod kemajuan 3M.</div>'}
  ${activeChild?`<div class="learning-panel"><div class="section-line"><div><small>Sedang belajar sebagai</small><h3>${esc(activeChild.avatar||'🧒')} ${esc(activeChild.name)}</h3></div><button class="btn ghost" id="deleteChildBtn">Padam Profil</button></div><div class="module-progress-grid"><div><b>📖 Membaca</b><strong>${byModule('Membaca')} ⭐</strong><button class="btn primary child-game" data-game="read">Mula</button></div><div><b>✏️ Menulis</b><strong>${byModule('Menulis')} ⭐</strong><button class="btn primary child-game" data-game="write">Mula</button></div><div><b>🧮 Mengira</b><strong>${byModule('Mengira')} ⭐</strong><button class="btn primary child-game" data-game="count">Mula</button></div></div><p class="muted-left">Setiap jawapan direkodkan ke Firestore mengikut profil anak yang dipilih.</p></div>`:''}
  <div class="dash-note">Versi ini merekod profil anak dan percubaan aktiviti 3M sebenar dalam Firestore. Modul kandungan penuh boleh ditambah selepas aliran ini disahkan.</div></section></div>`;
  $('#addChildBtn').onclick=()=>$('#childModal').showModal();
  document.querySelectorAll('[data-child]').forEach(b=>b.onclick=()=>{ activeChild=userChildren.find(c=>c.id===b.dataset.child); localStorage.setItem('cilikgo_active_child',activeChild.id); renderUser(p); });
  document.querySelectorAll('.child-game').forEach(b=>b.onclick=()=>openGame(b.dataset.game,true));
  if($('#deleteChildBtn')) $('#deleteChildBtn').onclick=async()=>{ if(!activeChild||!confirm(`Padam profil ${activeChild.name}? Rekod kemajuan sedia ada akan kekal untuk audit.`)) return; try{ await fb.deleteDoc(fb.doc(fb.db,'children',activeChild.id)); localStorage.removeItem('cilikgo_active_child'); toast('Profil anak dipadam.'); await renderUser(p); }catch(e){toast('Gagal padam profil: '+friendlyError(e));} };
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
  let users=[]; try{ users=(await fb.getDocs(fb.collection(fb.db,'users'))).docs.map(d=>({id:d.id,...d.data()})); }catch(e){console.error(e);}
  const agents=users.filter(u=>u.role==='agent'), customers=users.filter(u=>u.role==='user');
  $('#dashboard').innerHTML=`<div class="dash-shell"><aside class="dash-side"><h3>🛡️ Admin</h3><a class="active">Overview</a><a>User</a><a>Agent</a><a>Langganan</a><a>Transaksi</a><a>Modul 3M</a><a>Komisen</a><a>Settings</a></aside><section class="dash-main"><div class="dash-head"><div><small>CilikGo Control Center</small><h2>${esc(p.name)}</h2></div><span class="badge">Admin</span></div><div class="stat-grid"><div class="stat"><small>Jumlah akaun</small><b>${users.length}</b></div><div class="stat"><small>User/Penjaga</small><b>${customers.length}</b></div><div class="stat"><small>Agent</small><b>${agents.length}</b></div></div><h3>Akaun terkini</h3>${users.length?`<table class="table"><tr><th>Nama</th><th>E-mel</th><th>Role</th></tr>${users.slice(0,12).map(u=>`<tr><td>${esc(u.name||'-')}</td><td>${esc(u.email||'-')}</td><td><span class="badge">${esc(u.role||'user')}</span></td></tr>`).join('')}</table>`:'<div class="empty-state">Tiada rekod pengguna ditemui.</div>'}<div class="dash-note">Role Admin tidak boleh dipilih ketika pendaftaran awam. Akaun Admin pertama perlu ditetapkan secara manual dalam Firestore untuk keselamatan.</div></section></div>`;
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

$('#buyBtn').onclick=async()=>{
  if(!fb?.auth.currentUser) return toast('Sila log masuk dahulu.');
  try{ const token=await fb.auth.currentUser.getIdToken(); const res=await fetch('/api/createBill',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({plan:'starter',agentRef:localStorage.getItem('cilikgo_ref')||null})}); const data=await res.json(); if(!res.ok) throw new Error(data.error||'Gagal cipta bil'); location.href=data.paymentUrl; }
  catch(e){ toast('Pembayaran belum tersedia di GitHub Pages. Integrasi Firebase Functions/ToyyibPay diperlukan.'); console.warn(e); }
};

$('#saveChildBtn').onclick=async()=>{
  if(!fb?.auth.currentUser||currentProfile?.role!=='user') return toast('Fungsi ini untuk akaun Penjaga.');
  const name=$('#childName').value.trim(), age=Number($('#childAge').value), avatar=$('#childAvatar').value;
  if(!name) return toast('Masukkan nama panggilan anak.');
  try{ const ref=await fb.addDoc(fb.collection(fb.db,'children'),{ownerUid:fb.auth.currentUser.uid,name,age,avatar,createdAt:fb.serverTimestamp()}); localStorage.setItem('cilikgo_active_child',ref.id); $('#childName').value=''; $('#childModal').close(); toast('Profil anak berjaya ditambah.'); await renderUser(currentProfile); }
  catch(e){ console.error(e); toast('Gagal simpan profil: '+friendlyError(e)); }
};

const games={read:{title:'📖 Cari suku kata',prompt:'BA + ?',answers:['JU','KU','TU'],correct:'JU',success:'Betul! BA + JU = BAJU 🎉'},write:{title:'✏️ Pilih ejaan betul',prompt:'🐱',answers:['KUCIN','KUCING','KUSING'],correct:'KUCING',success:'Hebat! Ejaan betul ialah KUCING ⭐'},count:{title:'🧮 Kira objek',prompt:'🍎 🍎 🍎',answers:['2','3','4'],correct:'3',success:'Tepat! Ada 3 biji epal 🍎'}};

function openGame(key,track=false){
  const g=games[key];
  $('#gameContent').innerHTML=`<h2>${g.title}</h2>${track&&activeChild?`<p class="game-child">${esc(activeChild.avatar||'🧒')} ${esc(activeChild.name)} · ${gameKeyToModule[key]}</p>`:''}<p>Jawab soalan ini:</p><div class="game-prompt">${g.prompt}</div><div class="answers">${g.answers.map(a=>`<button class="answer">${a}</button>`).join('')}</div><p id="gameMsg"></p>`;
  $('#gameModal').showModal();
  document.querySelectorAll('.answer').forEach(x=>x.onclick=async()=>{
    const isCorrect=x.textContent===g.correct; $('#gameMsg').textContent=isCorrect?g.success:'Cuba lagi 💪';
    document.querySelectorAll('.answer').forEach(a=>a.disabled=true);
    if(track&&activeChild&&fb?.auth.currentUser){
      try{ await fb.addDoc(fb.collection(fb.db,'progress'),{ownerUid:fb.auth.currentUser.uid,childId:activeChild.id,module:gameKeyToModule[key],activity:key,answer:x.textContent,correct:isCorrect,stars:isCorrect?1:0,createdAt:fb.serverTimestamp()}); if(isCorrect) toast('⭐ Kemajuan '+activeChild.name+' direkodkan!'); setTimeout(()=>renderUser(currentProfile),500); }
      catch(e){console.error(e);toast('Jawapan diberi tetapi rekod kemajuan gagal disimpan.');}
    }
  });
}
document.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>openGame(b.dataset.game,false));
