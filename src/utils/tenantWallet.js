export const WEEKLY_FREE_CREDITS = 50;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Monday, 5 January 1970, 00:00 UTC.
export const WEEK_EPOCH_MS = 4 * 24 * 60 * 60 * 1000;

export function walletWeek(now = Date.now()) {
  return Math.floor((now - WEEK_EPOCH_MS) / WEEK_MS);
}

export function nextWalletGrantAt(now = Date.now()) {
  return WEEK_EPOCH_MS + (walletWeek(now) + 1) * WEEK_MS;
}

export function weeklyWalletUpdate(wallet, now = Date.now()) {
  const week = walletWeek(now);
  if (!wallet) return { balance: WEEKLY_FREE_CREDITS, lastGrantWeek: week };

  if (!Number.isSafeInteger(wallet.balance) || wallet.balance < 0 ||
      !Number.isSafeInteger(wallet.lastGrantWeek)) {
    throw new Error("The tenant wallet data is invalid.");
  }
  const elapsedWeeks = week - wallet.lastGrantWeek;
  if (elapsedWeeks <= 0) return null;
  const balance = wallet.balance + elapsedWeeks * WEEKLY_FREE_CREDITS;
  if (!Number.isSafeInteger(balance)) throw new Error("The tenant wallet balance is too large.");
  return { balance, lastGrantWeek: week };
}
