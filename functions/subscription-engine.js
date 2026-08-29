const PLANS = Object.freeze({
  lifetime: { amount: 45, durationMonths: null, lifetime: true },
  starter3: { amount: 45, durationMonths: 3, lifetime: false },
  renewal: { amount: 15, durationMonths: 1, lifetime: false },
});

const COMMISSIONS = Object.freeze({
  newSubscriber: 30,
  renewal: 10,
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

module.exports = { PLANS, COMMISSIONS, addMonths, expectedPlan };
