const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();
const db = admin.firestore();

const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');
const PUBLIC_APP_URL = defineString('PUBLIC_APP_URL', { default: 'https://mhafizmnasir.github.io/cilikgo' });

const REGION = 'asia-southeast1';
const BUSINESS = Object.freeze({
  lifetimePrice: 45,
  starterPrice: 45,
  starterMonths: 3,
  renewalPrice: 15,
  renewalMonths: 1,
  newSubscriberCommission: 30,
  renewalCommission: 10,
});

function htmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

async function authUser(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) throw new Error('UNAUTHENTICATED');
  const decoded = await admin.auth().verifyIdToken(token);
  const snap = await db.doc(`users/${decoded.uid}`).get();
  return { uid: decoded.uid, email: decoded.email || '', profile: snap.exists ? (snap.data() || {}) : null };
}

async function authAdmin(req) {
  const user = await authUser(req);
  const profile = user.profile || {};
  if (profile.role !== 'admin') throw new Error('ADMIN_REQUIRED');
  return { uid: user.uid, email: user.email || profile.email || '' };
}

async function resolveAgent(code, buyerUid) {
  const clean = String(code || '').trim();
  if (!clean) return { agentUid: null, agentRef: null };
  const snap = await db.collection('users')
    .where('agentCode', '==', clean)
    .limit(5)
    .get();
  const doc = snap.docs.find(d => d.id !== buyerUid && (d.data() || {}).role === 'agent');
  if (!doc) return { agentUid: null, agentRef: null };
  return { agentUid: doc.id, agentRef: clean };
}

async function resolveAgentForProfile(profile, buyerUid, overrideCode = null) {
  if (profile?.referredByAgentUid && profile.referredByAgentUid !== buyerUid) {
    const snap = await db.doc(`users/${profile.referredByAgentUid}`).get();
    const data = snap.exists ? (snap.data() || {}) : {};
    if (data.role === 'agent') return { agentUid: snap.id, agentRef: data.agentCode || profile.referredByCode || null };
  }
  if (profile?.referredByCode) {
    const stored = await resolveAgent(profile.referredByCode, buyerUid);
    if (stored.agentUid) return stored;
  }
  return resolveAgent(overrideCode, buyerUid);
}

async function getManualPaymentSettings() {
  const snap = await db.doc('settings/manualPayment').get();
  const data = snap.exists ? snap.data() : {};
  return {
    lifetimePromoActive: data.lifetimePromoActive !== false,
  };
}

function safeRequestId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 72);
}

function subscriptionEmailPayload(profile, plan, endDate) {
  const isLifetime = plan === 'lifetime';
  const planLabel = isLifetime
    ? 'Akses Lifetime CilikGo'
    : plan === 'starter3'
      ? 'Akses CilikGo 3 Bulan'
      : 'Pembaharuan CilikGo 1 Bulan';
  return {
    to: profile.email || '',
    name: profile.name || 'Pengguna CilikGo',
    plan,
    planLabel,
    lifetime: isLifetime,
    endsAt: endDate ? admin.firestore.Timestamp.fromDate(endDate) : null,
    appUrl: `${PUBLIC_APP_URL.value().replace(/\/$/, '')}/#dashboard`,
  };
}

exports.claimReferral = onRequest({
  region: REGION,
  cors: [
    'https://mhafizmnasir.github.io',
    /https:\/\/.*\.web\.app$/,
    /https:\/\/.*\.firebaseapp\.com$/,
    /http:\/\/localhost:\d+/,
  ],
}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await authUser(req);
    if (!user.profile || user.profile.role !== 'user') return res.status(400).json({ code: 'USER_REQUIRED', error: 'Referral hanya untuk akaun Penjaga.' });
    const referralCode = String(req.body?.referralCode || '').trim();
    const referral = await resolveAgent(referralCode, user.uid);
    if (!referral.agentUid) return res.status(400).json({ code: 'INVALID_AGENT', error: 'Kod Agent tidak sah.' });

    const userRef = db.doc(`users/${user.uid}`);
    const result = await db.runTransaction(async tx => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error('USER_NOT_FOUND');
      const profile = snap.data() || {};
      if (profile.role !== 'user') throw new Error('USER_REQUIRED');
      if (profile.referredByAgentUid || profile.referredByCode) {
        if (!profile.referredByAgentUid && profile.referredByCode === referral.agentRef) {
          tx.set(userRef, {
            referredByAgentUid: referral.agentUid,
            referralClaimedAt: profile.referralClaimedAt || admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
          return { alreadyClaimed: true, referredByCode: profile.referredByCode, agentUid: referral.agentUid };
        }
        return {
          alreadyClaimed: true,
          referredByCode: profile.referredByCode || null,
          agentUid: profile.referredByAgentUid || null,
        };
      }
      const paidBefore = profile.customerPaidOnce === true || !!profile.subscriptionStartedAt || !!profile.lastPaymentOrderId;
      if (paidBefore) throw new Error('PAID_CUSTOMER_CANNOT_CLAIM');
      tx.set(userRef, {
        referredByCode: referral.agentRef,
        referredByAgentUid: referral.agentUid,
        referralClaimedAt: admin.firestore.FieldValue.serverTimestamp(),
        referralClaimSource: 'agent_link',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return { alreadyClaimed: false, referredByCode: referral.agentRef, agentUid: referral.agentUid };
    });
    return res.json(result);
  } catch (e) {
    console.error('claimReferral', e);
    const map = {
      UNAUTHENTICATED: 'Sila log masuk semula.',
      USER_NOT_FOUND: 'Akaun Penjaga tidak ditemui.',
      USER_REQUIRED: 'Referral hanya untuk akaun Penjaga.',
      PAID_CUSTOMER_CANNOT_CLAIM: 'Referral perlu direkodkan sebelum pembelian pertama.',
    };
    return res.status(400).json({ code: e.message || 'CLAIM_FAILED', error: map[e.message] || e.message || 'Gagal merekod referral.' });
  }
});

exports.adminManageSubscription = onRequest({
  region: REGION,
  cors: [
    'https://mhafizmnasir.github.io',
    /https:\/\/.*\.web\.app$/,
    /https:\/\/.*\.firebaseapp\.com$/,
    /http:\/\/localhost:\d+/,
  ],
}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const adminUser = await authAdmin(req);
    const targetUid = String(req.body?.targetUid || '').trim();
    const action = String(req.body?.action || '').trim();
    const requestId = safeRequestId(req.body?.requestId);
    if (!targetUid || !requestId) return res.status(400).json({ error: 'Maklumat permintaan tidak lengkap.' });
    if (!['lifetime', 'starter3', 'renewal', 'expire'].includes(action)) {
      return res.status(400).json({ error: 'Tindakan langganan tidak sah.' });
    }

    const settings = await getManualPaymentSettings();
    const initialSnap = await db.doc(`users/${targetUid}`).get();
    if (!initialSnap.exists) return res.status(404).json({ error: 'Akaun Penjaga tidak ditemui.' });
    const initial = initialSnap.data() || {};
    if (initial.role !== 'user') return res.status(400).json({ error: 'Hanya akaun Penjaga boleh dilanggan.' });
    const agentCodeOverride = String(req.body?.agentCodeOverride || '').trim() || null;
    const referral = await resolveAgentForProfile(initial, targetUid, agentCodeOverride);

    const operationId = `MAN-${requestId}`;
    const auditRef = db.doc(`subscriptionAudit/${operationId}`);
    const orderRef = db.doc(`orders/${operationId}`);
    const commissionRef = db.doc(`commissions/${operationId}`);
    const mailRef = db.doc(`mailQueue/${operationId}`);
    const userRef = db.doc(`users/${targetUid}`);

    const result = await db.runTransaction(async tx => {
      const auditSnap = await tx.get(auditRef);
      if (auditSnap.exists) {
        const existing = auditSnap.data() || {};
        return { alreadyProcessed: true, action: existing.action || action, emailQueued: existing.emailQueued === true };
      }

      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new Error('USER_NOT_FOUND');
      const profile = userSnap.data() || {};
      const now = new Date();
      const currentEnd = profile.subscriptionEndsAt?.toDate?.() || null;
      const lifetime = profile.subscriptionLifetime === true || profile.subscriptionType === 'lifetime';
      const paidBefore = profile.customerPaidOnce === true || !!profile.subscriptionStartedAt || !!profile.lastPaymentOrderId;

      let amount = 0;
      let months = 0;
      let endDate = null;
      let planLabel = '';
      let commissionAmount = 0;
      let commissionType = null;
      let userUpdate = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
      if (action !== 'expire' && referral.agentUid && !profile.referredByAgentUid && !profile.referredByCode) {
        userUpdate.referredByCode = referral.agentRef;
        userUpdate.referredByAgentUid = referral.agentUid;
        userUpdate.referralClaimedAt = admin.firestore.FieldValue.serverTimestamp();
        userUpdate.referralClaimSource = agentCodeOverride ? 'admin_activation_override' : 'stored_referral';
      }

      if (action === 'expire') {
        userUpdate = {
          ...userUpdate,
          subscriptionStatus: 'expired',
          subscriptionLifetime: false,
          subscriptionType: 'expired',
          subscriptionEndsAt: admin.firestore.Timestamp.fromDate(now),
        };
      } else if (action === 'lifetime') {
        if (!settings.lifetimePromoActive) throw new Error('LIFETIME_PROMO_ENDED');
        if (paidBefore || lifetime) throw new Error('LIFETIME_NEW_CUSTOMERS_ONLY');
        amount = BUSINESS.lifetimePrice;
        planLabel = 'Akses Lifetime CilikGo';
        commissionAmount = referral.agentUid ? BUSINESS.newSubscriberCommission : 0;
        commissionType = commissionAmount ? 'new_subscriber' : null;
        userUpdate = {
          ...userUpdate,
          subscriptionStatus: 'active',
          subscriptionLifetime: true,
          subscriptionType: 'lifetime',
          subscriptionEndsAt: admin.firestore.FieldValue.delete(),
          subscriptionStartedAt: profile.subscriptionStartedAt || admin.firestore.FieldValue.serverTimestamp(),
          customerPaidOnce: true,
          firstPaidAt: profile.firstPaidAt || admin.firestore.FieldValue.serverTimestamp(),
          lastPaymentOrderId: operationId,
        };
      } else if (action === 'starter3') {
        if (settings.lifetimePromoActive) throw new Error('STARTER_AVAILABLE_AFTER_PROMO');
        if (paidBefore) throw new Error('STARTER_NEW_CUSTOMERS_ONLY');
        amount = BUSINESS.starterPrice;
        months = BUSINESS.starterMonths;
        endDate = addMonths(now, months);
        planLabel = 'Akses CilikGo 3 Bulan';
        commissionAmount = referral.agentUid ? BUSINESS.newSubscriberCommission : 0;
        commissionType = commissionAmount ? 'new_subscriber' : null;
        userUpdate = {
          ...userUpdate,
          subscriptionStatus: 'active',
          subscriptionLifetime: false,
          subscriptionType: 'time_limited',
          subscriptionStartedAt: profile.subscriptionStartedAt || admin.firestore.FieldValue.serverTimestamp(),
          subscriptionEndsAt: admin.firestore.Timestamp.fromDate(endDate),
          customerPaidOnce: true,
          firstPaidAt: profile.firstPaidAt || admin.firestore.FieldValue.serverTimestamp(),
          lastPaymentOrderId: operationId,
        };
      } else if (action === 'renewal') {
        if (lifetime) throw new Error('LIFETIME_DOES_NOT_RENEW');
        if (!paidBefore) throw new Error('ACTIVATE_NEW_CUSTOMER_FIRST');
        amount = BUSINESS.renewalPrice;
        months = BUSINESS.renewalMonths;
        const base = currentEnd && currentEnd > now ? currentEnd : now;
        endDate = addMonths(base, months);
        planLabel = 'Pembaharuan CilikGo 1 Bulan';
        commissionAmount = referral.agentUid ? BUSINESS.renewalCommission : 0;
        commissionType = commissionAmount ? 'monthly_renewal' : null;
        userUpdate = {
          ...userUpdate,
          subscriptionStatus: 'active',
          subscriptionLifetime: false,
          subscriptionType: 'time_limited',
          subscriptionStartedAt: profile.subscriptionStartedAt || admin.firestore.FieldValue.serverTimestamp(),
          subscriptionEndsAt: admin.firestore.Timestamp.fromDate(endDate),
          customerPaidOnce: true,
          lastPaymentOrderId: operationId,
        };
      }

      tx.set(userRef, userUpdate, { merge: true });

      if (action !== 'expire') {
        tx.set(orderRef, {
          userUid: targetUid,
          userEmail: profile.email || '',
          agentUid: referral.agentUid,
          agentRef: referral.agentRef,
          agentCode: referral.agentRef,
          plan: action,
          planName: planLabel,
          amount,
          months: months || null,
          currency: 'MYR',
          status: 'paid',
          paymentStatus: 'manual_verified',
          paymentMethod: 'bank_transfer_manual',
          verificationMethod: 'whatsapp_proof',
          adminUid: adminUser.uid,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        if (commissionAmount > 0 && referral.agentUid) {
          tx.set(commissionRef, {
            agentUid: referral.agentUid,
            agentCode: referral.agentRef,
            userUid: targetUid,
            orderId: operationId,
            plan: action,
            saleAmount: amount,
            commissionType,
            rateType: 'fixed',
            rateLabel: commissionType === 'new_subscriber' ? 'RM30 pelanggan baharu' : 'RM10 pembaharuan bulanan',
            amount: commissionAmount,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        const mail = subscriptionEmailPayload(profile, action, endDate);
        if (mail.to) {
          tx.set(mailRef, {
            ...mail,
            status: 'queued',
            userUid: targetUid,
            orderId: operationId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      tx.set(auditRef, {
        userUid: targetUid,
        userEmail: profile.email || null,
        action,
        previousStatus: profile.subscriptionStatus || 'inactive',
        previousLifetime: lifetime,
        previousEndsAt: currentEnd ? admin.firestore.Timestamp.fromDate(currentEnd) : null,
        newStatus: action === 'expire' ? 'expired' : 'active',
        newLifetime: action === 'lifetime',
        newEndsAt: endDate ? admin.firestore.Timestamp.fromDate(endDate) : null,
        source: 'admin_manual_bank_transfer',
        adminUid: adminUser.uid,
        orderId: action === 'expire' ? null : operationId,
        commissionAmount,
        emailQueued: action !== 'expire' && !!profile.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        alreadyProcessed: false,
        action,
        orderId: action === 'expire' ? null : operationId,
        endDate: endDate ? endDate.toISOString() : null,
        lifetime: action === 'lifetime',
        commissionAmount,
        emailQueued: action !== 'expire' && !!profile.email,
      };
    });

    return res.json(result);
  } catch (e) {
    console.error('adminManageSubscription', e);
    const map = {
      UNAUTHENTICATED: 'Sila log masuk semula.',
      ADMIN_REQUIRED: 'Akses Admin diperlukan.',
      USER_NOT_FOUND: 'Akaun Penjaga tidak ditemui.',
      LIFETIME_PROMO_ENDED: 'Promosi Lifetime telah tamat.',
      LIFETIME_NEW_CUSTOMERS_ONLY: 'Lifetime hanya untuk pelanggan baharu yang belum pernah melanggan.',
      STARTER_AVAILABLE_AFTER_PROMO: 'Pelan 3 bulan bermula selepas promosi Lifetime tamat.',
      STARTER_NEW_CUSTOMERS_ONLY: 'Pelan permulaan 3 bulan hanya untuk pelanggan baharu.',
      LIFETIME_DOES_NOT_RENEW: 'Akaun Lifetime tidak memerlukan pembaharuan.',
      ACTIVATE_NEW_CUSTOMER_FIRST: 'Aktifkan pelan pelanggan baharu terlebih dahulu.',
    };
    return res.status(400).json({ error: map[e.message] || e.message || 'Gagal mengemas kini langganan.' });
  }
});

exports.adminRepairReferralCommission = onRequest({
  region: REGION,
  cors: [
    'https://mhafizmnasir.github.io',
    /https:\/\/.*\.web\.app$/,
    /https:\/\/.*\.firebaseapp\.com$/,
    /http:\/\/localhost:\d+/,
  ],
}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const adminUser = await authAdmin(req);
    const targetUid = String(req.body?.targetUid || '').trim();
    const agentCode = String(req.body?.agentCode || '').trim();
    if (!targetUid || !agentCode) return res.status(400).json({ error: 'Penjaga dan Agent diperlukan.' });

    const [userSnap, ordersSnap] = await Promise.all([
      db.doc(`users/${targetUid}`).get(),
      db.collection('orders').where('userUid', '==', targetUid).get(),
    ]);
    if (!userSnap.exists) throw new Error('USER_NOT_FOUND');
    const profile = userSnap.data() || {};
    if (profile.role !== 'user') throw new Error('USER_REQUIRED');
    const referral = await resolveAgent(agentCode, targetUid);
    if (!referral.agentUid) throw new Error('INVALID_AGENT');
    if (profile.referredByAgentUid && profile.referredByAgentUid !== referral.agentUid) throw new Error('REFERRAL_CONFLICT');
    if (profile.referredByCode && profile.referredByCode !== referral.agentRef) throw new Error('REFERRAL_CONFLICT');

    const paidOrders = ordersSnap.docs
      .map(d => ({ id: d.id, ref: d.ref, ...(d.data() || {}) }))
      .filter(o => o.status === 'paid')
      .sort((a, b) => {
        const ta = a.paidAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const tb = b.paidAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return tb - ta;
      });
    const order = paidOrders.find(o => !o.agentUid) || paidOrders[0];
    if (!order) throw new Error('NO_PAID_ORDER');

    const commissionRef = db.doc(`commissions/${order.id}`);
    const auditRef = db.doc(`subscriptionAudit/REPAIR-${order.id}`);
    const userRef = db.doc(`users/${targetUid}`);
    const orderRef = db.doc(`orders/${order.id}`);
    const commissionAmount = order.plan === 'renewal' ? BUSINESS.renewalCommission : BUSINESS.newSubscriberCommission;
    const commissionType = order.plan === 'renewal' ? 'monthly_renewal' : 'new_subscriber';

    const result = await db.runTransaction(async tx => {
      const [freshOrder, existingCommission] = await Promise.all([tx.get(orderRef), tx.get(commissionRef)]);
      if (!freshOrder.exists) throw new Error('NO_PAID_ORDER');
      if (existingCommission.exists) {
        const c = existingCommission.data() || {};
        return { alreadyProcessed: true, orderId: order.id, commissionAmount: Number(c.amount || commissionAmount), agentUid: c.agentUid || referral.agentUid };
      }
      const fresh = freshOrder.data() || {};
      if (fresh.agentUid && fresh.agentUid !== referral.agentUid) throw new Error('ORDER_AGENT_CONFLICT');

      tx.set(orderRef, {
        agentUid: referral.agentUid,
        agentRef: referral.agentRef,
        agentCode: referral.agentRef,
        referralRepairedAt: admin.firestore.FieldValue.serverTimestamp(),
        referralRepairedBy: adminUser.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.set(commissionRef, {
        agentUid: referral.agentUid,
        agentCode: referral.agentRef,
        userUid: targetUid,
        orderId: order.id,
        plan: fresh.plan || order.plan || null,
        saleAmount: Number(fresh.amount || order.amount || 0),
        commissionType,
        rateType: 'fixed',
        rateLabel: commissionType === 'new_subscriber' ? 'RM30 pelanggan baharu' : 'RM10 pembaharuan bulanan',
        amount: commissionAmount,
        status: 'pending',
        repaired: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.set(userRef, {
        referredByCode: referral.agentRef,
        referredByAgentUid: referral.agentUid,
        referralClaimedAt: admin.firestore.FieldValue.serverTimestamp(),
        referralClaimSource: 'admin_commission_repair',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.set(auditRef, {
        userUid: targetUid,
        action: 'repair_referral_commission',
        orderId: order.id,
        agentUid: referral.agentUid,
        agentCode: referral.agentRef,
        commissionAmount,
        source: 'admin_commission_repair',
        adminUid: adminUser.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return { alreadyProcessed: false, orderId: order.id, commissionAmount, agentUid: referral.agentUid };
    });
    return res.json(result);
  } catch (e) {
    console.error('adminRepairReferralCommission', e);
    const map = {
      UNAUTHENTICATED: 'Sila log masuk semula.',
      ADMIN_REQUIRED: 'Akses Admin diperlukan.',
      USER_NOT_FOUND: 'Akaun Penjaga tidak ditemui.',
      USER_REQUIRED: 'Hanya akaun Penjaga boleh dibaiki.',
      INVALID_AGENT: 'Kod Agent tidak sah.',
      REFERRAL_CONFLICT: 'Akaun ini sudah dikaitkan dengan Agent lain.',
      ORDER_AGENT_CONFLICT: 'Transaksi ini sudah dikaitkan dengan Agent lain.',
      NO_PAID_ORDER: 'Tiada transaksi berbayar untuk dibaiki.',
    };
    return res.status(400).json({ error: map[e.message] || e.message || 'Gagal membaiki komisen.' });
  }
});

exports.sendSubscriptionActivationEmail = onDocumentCreated({
  document: 'mailQueue/{mailId}',
  region: REGION,
  secrets: [SMTP_USER, SMTP_PASS],
}, async event => {
  const snap = event.data;
  if (!snap) return;
  const mail = snap.data() || {};
  if (!mail.to || mail.status === 'sent') return;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
    });

    const endText = mail.lifetime
      ? 'Lifetime — tiada tarikh tamat'
      : mail.endsAt?.toDate?.()?.toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' }) || '-';
    const subject = mail.lifetime
      ? 'CilikGo: Akaun Lifetime anda sudah aktif 🎉'
      : 'CilikGo: Langganan anda sudah aktif 🎉';

    await transporter.sendMail({
      from: `CilikGo <${SMTP_USER.value()}>`,
      to: mail.to,
      subject,
      text: `Hai ${mail.name || 'Pengguna CilikGo'}, akaun CilikGo anda sudah aktif. Pelan: ${mail.planLabel || '-'}. Tempoh: ${endText}. Buka CilikGo: ${mail.appUrl || PUBLIC_APP_URL.value()}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#27243d;line-height:1.6">
          <div style="background:linear-gradient(135deg,#6c5ce7,#8f7cf4);padding:28px;border-radius:20px 20px 0 0;color:#fff">
            <div style="font-size:14px;font-weight:700">CilikGo</div>
            <h1 style="margin:8px 0 0;font-size:28px">Akaun anda sudah aktif 🎉</h1>
          </div>
          <div style="padding:28px;border:1px solid #ece9f8;border-top:0;border-radius:0 0 20px 20px">
            <p>Hai <b>${htmlEscape(mail.name || 'Pengguna CilikGo')}</b>,</p>
            <p>Pembayaran anda telah disahkan oleh Admin dan akses CilikGo kini aktif.</p>
            <div style="background:#f7f5ff;border-radius:14px;padding:18px;margin:20px 0">
              <div><b>Pelan:</b> ${htmlEscape(mail.planLabel || '-')}</div>
              <div><b>Tempoh:</b> ${htmlEscape(endText)}</div>
            </div>
            <p style="text-align:center;margin:26px 0">
              <a href="${htmlEscape(mail.appUrl || PUBLIC_APP_URL.value())}" style="background:#6c5ce7;color:#fff;text-decoration:none;padding:13px 22px;border-radius:12px;font-weight:700">Buka CilikGo</a>
            </p>
            <p style="font-size:12px;color:#777">E-mel ini dihantar secara automatik selepas Admin mengaktifkan akses anda.</p>
          </div>
        </div>`,
    });

    await snap.ref.set({
      status: 'sent',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      error: admin.firestore.FieldValue.delete(),
    }, { merge: true });
  } catch (e) {
    console.error('sendSubscriptionActivationEmail', e);
    await snap.ref.set({
      status: 'failed',
      error: String(e.message || e).slice(0, 500),
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
});
