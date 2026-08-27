import { firebaseConfig, USE_FIREBASE } from './firebase.js';

let fb = null;
let firebaseInitError = null;
if (USE_FIREBASE) {
  try {
    const appMod = await import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js');
    const dbMod = await import('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js');
    const app = appMod.initializeApp(firebaseConfig);
    fb = { auth: authMod.getAuth(app), db: dbMod.getFirestore(app), ...authMod, ...dbMod };
  } catch (error) {
    firebaseInitError = error;
    console.error('Firebase gagal dimulakan:', error);
  }
}

const $ = s => document.querySelector(s);
const toast = msg => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600); };

document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>$('#'+b.dataset.open).showModal());
document.querySelectorAll('dialog .x').forEach(b=>b.onclick=()=>b.closest('dialog').close());

const ref = new URLSearchParams(location.search).get('ref');
if(ref){ localStorage.setItem('cilikgo_ref',ref); toast('Kod agent '+ref+' telah direkodkan.'); }

$('#agentSignupBtn').onclick=()=>{ $('#regRole').value='agent'; $('#registerModal').showModal(); };

$('#registerBtn').onclick=async()=>{
  const name=$('#regName').value.trim(), email=$('#regEmail').value.trim(), pass=$('#regPassword').value, role=$('#regRole').value;
  if(!name||!email||pass.length<6) return toast('Sila lengkapkan maklumat.');
  if(!fb){ localStorage.setItem('cilikgo_demo_user',JSON.stringify({name,email,role})); $('#registerModal').close(); return toast('Akaun demo berjaya didaftarkan. Sambungkan Firebase untuk production.'); }
  try{
    const cred=await fb.createUserWithEmailAndPassword(fb.auth,email,pass);
    const agentCode=role==='agent'?'CG-'+cred.user.uid.slice(0,7).toUpperCase():null;
    await fb.setDoc(fb.doc(fb.db,'users',cred.user.uid),{name,email,role,agentCode,createdAt:fb.serverTimestamp(),subscriptionStatus:'inactive'});
    $('#registerModal').close(); toast('Akaun berjaya didaftarkan.');
  }catch(e){ toast(e.message); }
};

$('#loginBtn').onclick=async()=>{
  const email=$('#loginEmail').value.trim();
  const password=$('#loginPassword').value;
  if(!email || !password) return toast('Masukkan e-mel dan kata laluan.');
  if(!fb) {
    console.error(firebaseInitError);
    return toast('Firebase tidak dapat disambungkan. Jalankan CilikGo melalui localhost/Firebase Hosting.');
  }
  try{
    const cred = await fb.signInWithEmailAndPassword(fb.auth,email,password);
    const profileSnap = await fb.getDoc(fb.doc(fb.db,'users',cred.user.uid));
    const profile = profileSnap.exists() ? profileSnap.data() : { role:'user', name:cred.user.email };
    $('#loginModal').close();
    renderRole(['admin','agent','user'].includes(profile.role) ? profile.role : 'user');
    document.querySelector('.dashboard-demo')?.scrollIntoView({behavior:'smooth'});
    toast('Berjaya log masuk sebagai '+(profile.role || 'user')+'.');
  }catch(e){
    console.error(e);
    const friendly = e.code === 'auth/invalid-credential' ? 'E-mel atau kata laluan tidak tepat.'
      : e.code === 'auth/user-disabled' ? 'Akaun ini telah dinyahaktifkan.'
      : e.code === 'auth/too-many-requests' ? 'Terlalu banyak cubaan. Cuba semula sebentar lagi.'
      : e.message;
    toast('Log masuk gagal: '+friendly);
  }
};

$('#forgotBtn').onclick=async()=>{
  const email=$('#loginEmail').value.trim(); if(!email) return toast('Masukkan e-mel terlebih dahulu.');
  if(!fb) return toast('Firebase tidak dapat disambungkan. Jalankan melalui localhost/Firebase Hosting.');
  try{ await fb.sendPasswordResetEmail(fb.auth,email); toast('E-mel reset kata laluan telah dihantar.'); }catch(e){ console.error(e); toast(e.message); }
};

$('#buyBtn').onclick=async()=>{
  if(!USE_FIREBASE){ toast('Demo: sambungkan Firebase Functions + ToyyibPay untuk pembayaran sebenar.'); return; }
  try{
    const token=await fb.auth.currentUser?.getIdToken(); if(!token) return toast('Sila log masuk dahulu.');
    const res=await fetch('/api/createBill',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({plan:'starter',agentRef:localStorage.getItem('cilikgo_ref')||null})});
    const data=await res.json(); if(!res.ok) throw new Error(data.error||'Gagal cipta bil');
    location.href=data.paymentUrl;
  }catch(e){ toast(e.message); }
};

const dashboards={
user:`<div class="dash-shell"><aside class="dash-side"><h3>👨‍👩‍👧 CilikGo</h3><a class="active">Ringkasan</a><a>Profil Anak</a><a>Modul 3M</a><a>Kemajuan</a><a>Langganan</a><a>Tetapan</a></aside><section class="dash-main"><div class="dash-head"><div><small>Selamat kembali,</small><h2>Ibu Aina 👋</h2></div><span class="badge">Aktif · 73 hari lagi</span></div><div class="stat-grid"><div class="stat"><small>Aktiviti siap</small><b>28</b></div><div class="stat"><small>Masa belajar</small><b>4j 35m</b></div><div class="stat"><small>Streak</small><b>🔥 5 hari</b></div></div><h3>Kemajuan 3M</h3><div class="module-row"><div class="module-mini"><b>📖 62%</b><small>Membaca</small></div><div class="module-mini"><b>✏️ 48%</b><small>Menulis</small></div><div class="module-mini"><b>🧮 76%</b><small>Mengira</small></div></div></section></div>`,
agent:`<div class="dash-shell"><aside class="dash-side"><h3>🤝 Portal Agent</h3><a class="active">Dashboard</a><a>Pautan Affiliate</a><a>Pembelian</a><a>Komisen</a><a>Profil</a><a>Tetapan</a></aside><section class="dash-main"><div class="dash-head"><div><small>Agent</small><h2>Azlan</h2></div><span class="badge">Disahkan</span></div><div class="stat-grid"><div class="stat"><small>Jumlah klik</small><b>248</b></div><div class="stat"><small>Pembelian berjaya</small><b>31</b></div><div class="stat"><small>Komisen</small><b>RM465</b></div></div><h3>Pembelian terkini</h3><table class="table"><tr><th>Tarikh</th><th>Rujukan</th><th>Nilai</th><th>Status</th></tr><tr><td>27 Ogos</td><td>CG-8841</td><td>RM69</td><td><span class="badge">Berjaya</span></td></tr><tr><td>25 Ogos</td><td>CG-8802</td><td>RM69</td><td><span class="badge">Berjaya</span></td></tr></table></section></div>`,
admin:`<div class="dash-shell"><aside class="dash-side"><h3>🛡️ Admin</h3><a class="active">Overview</a><a>User</a><a>Agent</a><a>Langganan</a><a>Transaksi</a><a>Modul 3M</a><a>Komisen</a><a>Settings</a></aside><section class="dash-main"><div class="dash-head"><div><small>CilikGo Control Center</small><h2>Dashboard Admin</h2></div><span class="badge">Super Admin</span></div><div class="stat-grid"><div class="stat"><small>User aktif</small><b>1,284</b></div><div class="stat"><small>Agent</small><b>86</b></div><div class="stat"><small>Jualan bulan ini</small><b>RM18.4k</b></div></div><h3>Operasi terkini</h3><table class="table"><tr><th>Item</th><th>Butiran</th><th>Status</th></tr><tr><td>Pembayaran</td><td>318 transaksi bulan ini</td><td><span class="badge">Normal</span></td></tr><tr><td>Agent</td><td>6 permohonan baharu</td><td><span class="badge">Semak</span></td></tr><tr><td>Kandungan</td><td>3 aktiviti menunggu publish</td><td><span class="badge">Draft</span></td></tr></table></section></div>`};
function renderRole(r){ $('#dashboard').innerHTML=dashboards[r]; document.querySelectorAll('.role-tab').forEach(x=>x.classList.toggle('active',x.dataset.role===r)); }
document.querySelectorAll('.role-tab').forEach(b=>b.onclick=()=>renderRole(b.dataset.role)); renderRole('user');

const games={
 read:{title:'📖 Cari suku kata',prompt:'BA + ?',answers:['JU','KU','TU'],correct:'JU',success:'Betul! BA + JU = BAJU 🎉'},
 write:{title:'✏️ Pilih ejaan betul',prompt:'🐱',answers:['KUCIN','KUCING','KUSING'],correct:'KUCING',success:'Hebat! Ejaan betul ialah KUCING ⭐'},
 count:{title:'🧮 Kira objek',prompt:'🍎 🍎 🍎',answers:['2','3','4'],correct:'3',success:'Tepat! Ada 3 biji epal 🍎'}
};
document.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>{const g=games[b.dataset.game];$('#gameContent').innerHTML=`<h2>${g.title}</h2><p>Jawab soalan ini:</p><div class="game-prompt">${g.prompt}</div><div class="answers">${g.answers.map(a=>`<button class="answer">${a}</button>`).join('')}</div><p id="gameMsg"></p>`;$('#gameModal').showModal();document.querySelectorAll('.answer').forEach(x=>x.onclick=()=>$('#gameMsg').textContent=x.textContent===g.correct?g.success:'Cuba lagi 💪');});
