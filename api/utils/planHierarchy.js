/**
 * Plan hierarchy and transition rules
 *
 * Centralized logic for subscription plan comparisons,
 * used by prodamus routes, webhook processing, and cron tasks.
 */

// Plan hierarchy: higher number = higher tier
const PLAN_HIERARCHY = {
  guest: 0,
  demo: 1,
  individual: 2,
  premium: 3
};

// Plan IDs mapped to code_names (from subscription_plans table)
const PLAN_ID_TO_CODE = {
  5: 'guest',
  2: 'demo',
  6: 'individual',
  7: 'premium'
};

// Subscription duration in days
const SUBSCRIPTION_DURATION_DAYS = 30;

// Max allowed resulting expiry from NOW (anti-stacking)
const MAX_EXPIRY_FROM_NOW_DAYS = 60;

// Window before expiry when renewal/downgrade becomes available
const RENEWAL_WINDOW_DAYS = 30;

/**
 * Get plan level (0-3) by code_name
 * @param {string} codeName
 * @returns {number}
 */
function getPlanLevel(codeName) {
  return PLAN_HIERARCHY[codeName] ?? -1;
}

/**
 * Check if target plan is a downgrade from current plan
 * @param {string} currentCodeName
 * @param {string} targetCodeName
 * @returns {boolean}
 */
function isDowngrade(currentCodeName, targetCodeName) {
  return getPlanLevel(targetCodeName) < getPlanLevel(currentCodeName);
}

/**
 * Check if target plan is an upgrade from current plan
 * @param {string} currentCodeName
 * @param {string} targetCodeName
 * @returns {boolean}
 */
function isUpgrade(currentCodeName, targetCodeName) {
  return getPlanLevel(targetCodeName) > getPlanLevel(currentCodeName);
}

/**
 * Check if it's a same-plan renewal
 * @param {string} currentCodeName
 * @param {string} targetCodeName
 * @returns {boolean}
 */
function isSamePlan(currentCodeName, targetCodeName) {
  return currentCodeName === targetCodeName;
}

/**
 * Calculate days remaining on subscription
 * @param {Date|string|null} expiresAt
 * @returns {number|null} days remaining, or null if no expiry
 */
function daysRemaining(expiresAt) {
  if (!expiresAt) return null;
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export {
  PLAN_HIERARCHY,
  PLAN_ID_TO_CODE,
  SUBSCRIPTION_DURATION_DAYS,
  MAX_EXPIRY_FROM_NOW_DAYS,
  RENEWAL_WINDOW_DAYS,
  getPlanLevel,
  isDowngrade,
  isUpgrade,
  isSamePlan,
  daysRemaining
};
