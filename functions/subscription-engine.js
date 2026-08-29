const admin = require('firebase-admin');

const PLANS = Object.freeze({
  starter: { amount: 69, durationMonths: 4 },
  renewal: { amount: 15, durationMonths: 1 },
});

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

function expectedPlan(planId) {
  const plan = PLANS[planId];
  if (!plan) throw new Error('INVALID_PLAN');
  return plan;
}

async function activatePaidOrder(db, orderId, paymentRef) {
  const orderRef = db.collection('orders').doc(orderId);
  return db.runTransaction(async tx => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new Error('ORDER_NOT_FOUND');
    const order = snap.data();
    const plan = expectedPlan(order.plan);

    // Idempotency: callback/payment verification may arrive more than once.
    if (order.status === 'paid') return { alreadyProcessed: true };

    if (Number(order.amount) !== plan.amount) throw new Error('AMOUNT_MISMATCH');

    const userRef = db.collection('users').doc(order.userUid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new Error('USER_NOT_FOUND');
    const user = userSnap.data();

    const now = new Date();
    const existingEnd = user.subscriptionEndsAt?.toDate?.() || null;
    const base = existingEnd && existingEnd > now ? existingEnd : now;
    const newEnd = addMonths(base, plan.durationMonths);

    tx.update(orderRef, {
      status: 'paid',
      paymentStatus: 'paid',
      paymentRef: paymentRef || null,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.update(userRef, {
      subscriptionStatus: 'active',
      subscriptionStartedAt: user.subscriptionStartedAt || admin.firestore.FieldValue.serverTimestamp(),
      subscriptionEndsAt: admin.firestore.Timestamp.fromDate(newEnd),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { alreadyProcessed: false, subscriptionEndsAt: newEnd };
  });
}

module.exports = { PLANS, addMonths, expectedPlan, activatePaidOrder };
