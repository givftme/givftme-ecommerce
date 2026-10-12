import { sendOrderStatusEmail } from "@/lib/email/resend";
import { formatPrice } from "@/lib/utils";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] as string);
}

export async function sendPoolContributionReceiptEmail(input: {
  to: string;
  poolTitle: string;
  amount: number;
  amountRaised: number;
  targetAmount: number;
  contributorCount: number;
  poolUrl: string;
  contributionId: string;
  refundRequired?: boolean;
}) {
  const {
    to, poolTitle, amount, amountRaised, targetAmount,
    contributorCount, poolUrl, contributionId, refundRequired = false,
  } = input;
  const subject = refundRequired
    ? `Payment update for "${poolTitle}"`
    : `Your contribution to "${poolTitle}" was received`;
  const percentage = targetAmount > 0 ? Math.min(100, Math.round(amountRaised / targetAmount * 100)) : 0;
  const text = refundRequired
    ? `Your payment of ${formatPrice(amount)} was captured after the pool closed. The Gifvtme team has been asked to refund it manually. View the pool: ${poolUrl}`
    : `You contributed ${formatPrice(amount)} to ${poolTitle}. Pool progress: ${formatPrice(amountRaised)} of ${formatPrice(targetAmount)} (${percentage}% funded). ${contributorCount} people have contributed. View the pool: ${poolUrl}`;
  const details = refundRequired
    ? `<p>Your payment of ${escapeHtml(formatPrice(amount))} was captured after the pool closed. The Gifvtme team has been asked to refund it manually.</p>`
    : `<p>You contributed <strong>${escapeHtml(formatPrice(amount))}</strong> to <strong>${escapeHtml(poolTitle)}</strong>.</p><p>Pool progress: ${escapeHtml(formatPrice(amountRaised))} of ${escapeHtml(formatPrice(targetAmount))} (${percentage}% funded). ${contributorCount} people have contributed.</p>`;
  const html = `<div style="font-family: Inter, Arial, sans-serif; color: #000000; line-height: 1.6;">${details}<p><a href="${poolUrl}" style="color: #C50404;">View the pool</a></p></div>`;
  return sendOrderStatusEmail({ to, subject, text, html, idempotencyKey: `pool-contribution:${contributionId}:receipt` });
}

export async function sendPoolFullyFundedEmail(input: {
  to: string;
  poolTitle: string;
  targetAmount: number;
  contributorCount: number;
  poolUrl: string;
  isItemPool: boolean;
  poolId: string;
}) {
  const { to, poolTitle, targetAmount, contributorCount, poolUrl, isItemPool, poolId } = input;
  const nextStep = isItemPool
    ? "The Gifvtme team will start procuring your gift shortly."
    : `${formatPrice(targetAmount)} will be transferred to you soon.`;
  const subject = `🎉 Your gift pool "${poolTitle}" is fully funded!`;
  const text = `${poolTitle} has reached its target of ${formatPrice(targetAmount)}. ${contributorCount} people contributed. ${nextStep} View your pool: ${poolUrl}`;
  const html = `<div style="font-family: Inter, Arial, sans-serif; color: #000000; line-height: 1.6;"><p>Great news — <strong>${escapeHtml(poolTitle)}</strong> has reached its target of ${escapeHtml(formatPrice(targetAmount))}!</p><p>${contributorCount} people contributed to make this happen.</p><p>${escapeHtml(nextStep)}</p><p><a href="${poolUrl}" style="color: #C50404;">View your pool →</a></p></div>`;
  return sendOrderStatusEmail({ to, subject, text, html, idempotencyKey: `group-pool:${poolId}:fully-funded` });
}

export async function sendPoolCashedOutEmail(input: {
  to: string;
  poolTitle: string;
  cashedOutAmount: number;
  contributorCount: number;
  poolUrl: string;
  contributionId: string;
}) {
  const { to, poolTitle, cashedOutAmount, contributorCount, poolUrl, contributionId } = input;
  const subject = `"${poolTitle}" has been fulfilled`;
  const text = `The gift pool you contributed to has been completed. ${formatPrice(cashedOutAmount)} was raised in total across ${contributorCount} contributors. Thank you for being part of this! View the pool: ${poolUrl}`;
  const html = `<div style="font-family: Inter, Arial, sans-serif; color: #000000; line-height: 1.6;"><p>The gift pool you contributed to has been completed.</p><p>${escapeHtml(formatPrice(cashedOutAmount))} was raised in total across ${contributorCount} contributors.</p><p>Thank you for being part of this!</p><p><a href="${poolUrl}" style="color: #C50404;">View the pool</a></p></div>`;
  return sendOrderStatusEmail({ to, subject, text, html, idempotencyKey: `pool-contribution:${contributionId}:cashed-out` });
}
