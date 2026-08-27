const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

const TOYYIB_SECRET = defineSecret('TOYYIB_SECRET');
const TOYYIB_CATEGORY = defineSecret('TOYYIB_CATEGORY');
const PUBLIC_APP_URL = defineString('PUBLIC_APP_URL', { default: 'https://mhafizmnasir.github.io/cilikgo' });
const TOYYIB_ENV = defineString('TOYYIB_ENV', { default: 'sandbox' });
const COMMISSION_PERCENT = defineString('COMMISSION_PERCENT', { default: '15' });

const REGION = 'asia-southeast1';
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'cilikgo-web';

function toyyibBaseUrl(){
  return TOYYIB_ENV.value()==='production' ? 'https://toyyibpay.com' : 'https://dev.toyyibpay.com';
}
function callbackUrl(){
  return `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/toyyibCallback`;
}
function appReturnUrl(){
  return `${PUBLIC_APP_URL.value().replace(/\/$/,'')}/?payment=return`;
}
async function authUser(req){
  const token=(req.headers.authorization||'').replace('Bearer ','');
  if(!token) throw new Error('UNAUTHENTICATED');
  return admin.auth().verifyIdToken(token);
}
function addMonths(date,months){
  const d=new Date(date), day=d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+months);
  const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  d.setUTCDate(Math.min(day,last)); return d;
}
async function resolveAgent(code,buyerUid){
  if(!code) return {agentUid:null,agentRef:null};
  const snap=await db.collection('users').where('agentCode','==',String(code).trim()).where('role','==','agent').limit(1).get();
  if(snap.empty||snap.docs[0].id===buyerUid) return {agentUid:null,agentRef:null};
  return {agentUid:snap.docs[0].id,agentRef:String(code).trim()};
}

exports.createBill=onRequest({
  region:REGION,
  secrets:[TOYYIB_SECRET,TOYYIB_CATEGORY],
  cors:['https://mhafizmnasir.github.io',/https:\/\/.*\.web\.app$/,/https:\/\/.*\.firebaseapp\.com$/,/http:\/\/localhost:\d+/]
},async(req,res)=>{
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const user=await authUser(req);
    const userRef=db.doc(`users/${user.uid}`);
    const userSnap=await userRef.get();
    const profile=userSnap.data()||{};
    if(profile.role!=='user') return res.status(403).json({error:'Akaun Penjaga diperlukan.'});

    const active=profile.subscriptionStatus==='active'&&profile.subscriptionEndsAt?.toDate?.()>new Date();
    const requested=req.body?.plan==='renewal'?'renewal':'starter';
    const plan=requested==='renewal'&&active?'renewal':'starter';
    const amount=plan==='renewal'?15:69;
    const months=plan==='renewal'?1:4;
    const referral=await resolveAgent(profile.referredByCode,user.uid);
    const orderId=`CG-${Date.now()}-${user.uid.slice(0,6)}`;

    await db.doc(`orders/${orderId}`).set({
      userUid:user.uid,userEmail:user.email||profile.email||'',
      agentUid:referral.agentUid,agentRef:referral.agentRef,
      plan,months,amount,currency:'MYR',status:'created',
      createdAt:admin.firestore.FieldValue.serverTimestamp()
    });

    const form=new URLSearchParams({
      userSecretKey:TOYYIB_SECRET.value(),
      categoryCode:TOYYIB_CATEGORY.value(),
      billName:plan==='renewal'?'CilikGo 1 Bulan':'CilikGo 4 Bulan',
      billDescription:plan==='renewal'?'Langganan CilikGo 1 bulan':'Langganan CilikGo 4 bulan',
      billPriceSetting:'1',billPayorInfo:'1',billAmount:String(amount*100),
      billReturnUrl:appReturnUrl(),billCallbackUrl:callbackUrl(),
      billExternalReferenceNo:orderId,billTo:profile.name||'Pelanggan CilikGo',
      billEmail:user.email||profile.email||'',billPhone:profile.phone||''
    });

    const r=await fetch(`${toyyibBaseUrl()}/index.php/api/createBill`,{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form
    });
    const raw=await r.text();
    let data; try{data=JSON.parse(raw)}catch{throw new Error(`Respons ToyyibPay tidak sah: ${raw.slice(0,120)}`)}
    const billCode=data?.[0]?.BillCode;
    if(!billCode) throw new Error('ToyyibPay tidak memulangkan BillCode');
    const paymentUrl=`${toyyibBaseUrl()}/${billCode}`;
    await db.doc(`orders/${orderId}`).update({billCode,paymentEnvironment:TOYYIB_ENV.value(),paymentUrl});
    return res.json({orderId,billCode,paymentUrl});
  }catch(e){console.error(e);return res.status(400).json({error:e.message||'Gagal menyediakan pembayaran.'});}
});

exports.toyyibCallback=onRequest({region:REGION,secrets:[TOYYIB_SECRET],cors:false},async(req,res)=>{
  try{
    const {refno,status,order_id,billcode,hash,amount,reason}=req.body||{};
    if(!refno||!status||!order_id||!hash) return res.status(400).send('MISSING_FIELDS');
    const expected=crypto.createHash('md5').update(TOYYIB_SECRET.value()+status+order_id+refno+'ok').digest('hex');
    const a=Buffer.from(String(hash).toLowerCase()), b=Buffer.from(expected.toLowerCase());
    if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) return res.status(401).send('INVALID_HASH');

    const orderRef=db.doc(`orders/${order_id}`);
    const snap=await orderRef.get();
    if(!snap.exists) return res.status(404).send('ORDER_NOT_FOUND');
    const order=snap.data();

    if(status==='1'&&order.status!=='paid'){
      await db.runTransaction(async tx=>{
        const freshSnap=await tx.get(orderRef), fresh=freshSnap.data();
        if(fresh.status==='paid') return;
        const userRef=db.doc(`users/${fresh.userUid}`);
        const userSnap=await tx.get(userRef), profile=userSnap.data()||{};
        const now=new Date(), oldEnd=profile.subscriptionEndsAt?.toDate?.();
        const base=oldEnd&&oldEnd>now?oldEnd:now;
        const end=addMonths(base,Number(fresh.months||(fresh.plan==='renewal'?1:4)));

        tx.update(orderRef,{status:'paid',refno,billCode:billcode||fresh.billCode||null,paidAmount:amount||null,paymentReason:reason||null,paidAt:admin.firestore.FieldValue.serverTimestamp()});
        tx.set(userRef,{subscriptionStatus:'active',subscriptionStartedAt:profile.subscriptionStartedAt||admin.firestore.FieldValue.serverTimestamp(),subscriptionEndsAt:admin.firestore.Timestamp.fromDate(end),lastPaymentOrderId:order_id,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});

        if(fresh.agentUid){
          const pct=Math.max(0,Number(COMMISSION_PERCENT.value())||0);
          const commission=Number((Number(fresh.amount||0)*pct/100).toFixed(2));
          tx.set(db.doc(`commissions/${order_id}`),{agentUid:fresh.agentUid,userUid:fresh.userUid,orderId:order_id,plan:fresh.plan,saleAmount:Number(fresh.amount||0),ratePercent:pct,amount:commission,status:'pending',createdAt:admin.firestore.FieldValue.serverTimestamp()});
        }
      });
    }else if(status==='2'&&order.status!=='paid'){
      await orderRef.update({status:'pending',refno,paymentReason:reason||null});
    }else if(status==='3'&&order.status!=='paid'){
      await orderRef.update({status:'failed',refno,paymentReason:reason||null});
    }
    return res.status(200).send('OK');
  }catch(e){console.error(e);return res.status(500).send('ERROR');}
});
