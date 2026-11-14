export const WEEKLY_FREE_CREDITS = 50;
export const PROFILE_COLLECTION_CREDITS = 5;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Monday, 5 January 1970, 00:00 UTC.
export const WEEK_EPOCH_MS = 4 * 24 * 60 * 60 * 1000;

export function walletWeek(now = Date.now()) {
  return Math.floor((now - WEEK_EPOCH_MS) / WEEK_MS);
}

export function nextWalletGrantAt(now = Date.now()) {
  return WEEK_EPOCH_MS + (walletWeek(now) + 1) * WEEK_MS;
}

export function profileCollectionDebit(wallet, now = Date.now()) {
  // Refresh separately before collecting so migration/refills retain their rules.
  if (!wallet || weeklyWalletUpdate(wallet, now) || wallet.lastGrantWeek !== walletWeek(now)) {
    throw new Error("Refresh your wallet and try collecting again.");
  }
  const fromGrant = Math.min(wallet.grantBalance, PROFILE_COLLECTION_CREDITS);
  const fromPurchased = PROFILE_COLLECTION_CREDITS - fromGrant;
  if (wallet.purchasedBalance < fromPurchased) {
    throw new Error(`You need ${PROFILE_COLLECTION_CREDITS} credits to collect profile data.`);
  }
  return {
    grantBalance: wallet.grantBalance - fromGrant,
    purchasedBalance: wallet.purchasedBalance - fromPurchased,
  };
}

export function weeklyWalletUpdate(wallet, now = Date.now()) {
  const week = walletWeek(now);
  if (!wallet) return { grantBalance: WEEKLY_FREE_CREDITS, purchasedBalance: 0, lastGrantWeek: week };

  if (!Number.isSafeInteger(wallet.lastGrantWeek)) {
    throw new Error("The tenant wallet data is invalid.");
  }

  // The original wallet contained only grants, with no purchased credits.
  if (Object.hasOwn(wallet, "balance")) {
    if (!Number.isSafeInteger(wallet.balance) || wallet.balance < 0 ||
        Object.hasOwn(wallet, "purchasedBalance") || Object.hasOwn(wallet, "grantBalance")) {
      throw new Error("The tenant wallet data is invalid.");
    }
    if (wallet.lastGrantWeek > week) throw new Error("Check your device clock and retry.");
    const grantBalance = wallet.lastGrantWeek === week
      ? Math.min(wallet.balance, WEEKLY_FREE_CREDITS)
      : WEEKLY_FREE_CREDITS;
    return { grantBalance, purchasedBalance: 0, lastGrantWeek: week };
  }

  if (!Number.isSafeInteger(wallet.grantBalance) || wallet.grantBalance < 0 ||
      wallet.grantBalance > WEEKLY_FREE_CREDITS ||
      !Number.isSafeInteger(wallet.purchasedBalance) || wallet.purchasedBalance < 0) {
    throw new Error("The tenant wallet data is invalid.");
  }
  if (wallet.lastGrantWeek >= week) return null;
  return { grantBalance: WEEKLY_FREE_CREDITS, purchasedBalance: wallet.purchasedBalance, lastGrantWeek: week };
}
