const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');
admin.initializeApp();
const db = admin.firestore();

const TOYYIB_SECRET = defineSecret('TOYYIB_SECRET');
const TOYYIB_CATEGORY = defineSecret('TOYYIB_CATEGORY');
const APP_URL = process.env.APP_URL || 'https://YOUR_DOMAIN.com';
const COMMISSION_RATE = 0.15; // contoh 15% — ubah ikut polisi sebenar

async function authUser(req){
  const token=(req.headers.authorization||'').replace('Bearer ','');
  if(!token) throw new Error('UNAUTHENTICATED');
  return admin.auth().verifyIdToken(token);
}

exports.createBill = onRequest({secrets:[TOYYIB_SECRET,TOYYIB_CATEGORY],cors:true},async(req,res)=>{
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const user=await authUser(req);
    const userDoc=(await db.doc(`users/${user.uid}`).get()).data()||{};
    const orderId='CG-'+Date.now()+'-'+user.uid.slice(0,6);
    let agentUid=null;
    const agentRef=req.body.agentRef;
    if(agentRef){
      const snap=await db.collection('users').where('agentCode','==',agentRef).where('role','==','agent').limit(1).get();
      if(!snap.empty) agentUid=snap.docs[0].id;
    }
    await db.doc(`orders/${orderId}`).set({userUid:user.uid,agentUid,agentRef:agentRef||null,plan:'starter',amount:69,status:'created',createdAt:admin.firestore.FieldValue.serverTimestamp()});

    const form=new URLSearchParams({
      userSecretKey:TOYYIB_SECRET.value(), categoryCode:TOYYIB_CATEGORY.value(), billName:'CilikGo 4 Bulan',
      billDescription:'Langganan CilikGo 4 bulan', billPriceSetting:'1', billPayorInfo:'1', billAmount:'6900',
      billReturnUrl:`${APP_URL}/?payment=return`, billCallbackUrl:`${APP_URL}/api/toyyibCallback`, billExternalReferenceNo:orderId,
      billTo:userDoc.name||'Pelanggan CilikGo', billEmail:user.email||userDoc.email||'', billPhone:userDoc.phone||''
    });
    const r=await fetch('https://toyyibpay.com/index.php/api/createBill',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form});
    const data=await r.json(); const billCode=data?.[0]?.BillCode;
    if(!billCode) throw new Error('ToyyibPay tidak memulangkan BillCode');
    await db.doc(`orders/${orderId}`).update({billCode});
    res.json({orderId,billCode,paymentUrl:`https://toyyibpay.com/${billCode}`});
  }catch(e){console.error(e);res.status(400).json({error:e.message});}
});

exports.toyyibCallback = onRequest({secrets:[TOYYIB_SECRET],cors:false},async(req,res)=>{
  try{
    const {refno,status,order_id,billcode,hash}=req.body||{};
    const expected=crypto.createHash('md5').update(TOYYIB_SECRET.value()+status+order_id+refno+'ok').digest('hex');
    if(hash!==expected) return res.status(401).send('INVALID_HASH');
    const orderRef=db.doc(`orders/${order_id}`); const snap=await orderRef.get(); if(!snap.exists) return res.status(404).send('ORDER_NOT_FOUND');
    const order=snap.data();
    if(status==='1' && order.status!=='paid'){
      await db.runTransaction(async tx=>{
        tx.update(orderRef,{status:'paid',refno,billCode:billcode,paidAt:admin.firestore.FieldValue.serverTimestamp()});
        tx.update(db.doc(`users/${order.userUid}`),{subscriptionStatus:'active',subscriptionStartedAt:admin.firestore.FieldValue.serverTimestamp(),subscriptionMonths:4});
        if(order.agentUid){
          const amount=Number((order.amount*COMMISSION_RATE).toFixed(2));
          tx.set(db.collection('commissions').doc(),{agentUid:order.agentUid,orderId:order_id,amount,status:'pending',createdAt:admin.firestore.FieldValue.serverTimestamp()});
        }
      });
    } else if(status==='2'){ await orderRef.update({status:'pending',refno}); }
    else if(status==='3'){ await orderRef.update({status:'failed',refno}); }
    res.status(200).send('OK');
  }catch(e){console.error(e);res.status(500).send('ERROR');}
});
