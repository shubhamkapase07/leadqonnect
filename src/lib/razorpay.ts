// Razorpay Checkout loader + types.
// Checkout (card/UPI entry) runs entirely inside Razorpay's hosted iframe, so the only
// thing the app needs client-side is the checkout.js script and the subscription id +
// public key id, both produced by the `createRazorpaySubscription` Cloud Function.

export interface RazorpayCheckoutResult {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

export interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description?: string;
  image?: string;
  theme?: { color?: string };
  prefill?: { name?: string; email?: string };
  notes?: Record<string, string>;
  handler: (response: RazorpayCheckoutResult) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (resp: unknown) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let scriptPromise: Promise<void> | null = null;

/** Lazily inject Razorpay's checkout.js (once) and resolve when it's ready. */
export function loadRazorpay(): Promise<void> {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Failed to load Razorpay Checkout. Check your connection and try again.'));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Open Razorpay Checkout for a subscription and resolve with the signed result when
 * the user completes payment, or reject if they dismiss/fail.
 */
export function openRazorpayCheckout(
  options: Omit<RazorpayOptions, 'handler' | 'modal'>
): Promise<RazorpayCheckoutResult> {
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error('Razorpay Checkout is not loaded.'));
      return;
    }
    let settled = false;
    const rzp = new window.Razorpay({
      ...options,
      handler: (response) => {
        settled = true;
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          if (!settled) reject(new Error('Payment cancelled.'));
        },
      },
    });
    rzp.on('payment.failed', (resp: unknown) => {
      if (settled) return;
      settled = true;
      const desc = (resp as { error?: { description?: string } })?.error?.description;
      reject(new Error(desc || 'Payment failed. Please try again.'));
    });
    rzp.open();
  });
}
