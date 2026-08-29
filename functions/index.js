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

async function authAdmin(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) throw new Error('UNAUTHENTICATED');
  const decoded = await admin.auth().verifyIdToken(token);
  const snap = await db.doc(`users/${decoded.uid}`).get();
  const profile = snap.data() || {};
  if (profile.role !== 'admin') throw new Error('ADMIN_REQUIRED');
  return { uid: decoded.uid, email: decoded.email || profile.email || '' };
}

async function resolveAgent(code, buyerUid) {
  if (!code) return { agentUid: null, agentRef: null };
  const snap = await db.collection('users')
    .where('agentCode', '==', String(code).trim())
    .where('role', '==', 'agent')
    .limit(1)
    .get();
  if (snap.empty || snap.docs[0].id === buyerUid) return { agentUid: null, agentRef: null };
  return { agentUid: snap.docs[0].id, agentRef: String(code).trim() };
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
    const referral = await resolveAgent(initial.referredByCode, targetUid);

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
