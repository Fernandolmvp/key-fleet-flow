import { toast } from "sonner";

let lastRedirectAt = 0;

/**
 * Detects TRIAL_EXPIRED errors raised by the Postgres trigger
 * `enforce_trial_active()` and routes the user to the subscription page.
 */
export function isTrialExpiredError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    (typeof err === "string" && err) ||
    (err as any)?.message ||
    (err as any)?.error?.message ||
    (err as any)?.error_description ||
    "";
  return typeof msg === "string" && msg.includes("TRIAL_EXPIRED");
}

export function handleTrialExpiredError(err: unknown): boolean {
  if (!isTrialExpiredError(err)) return false;
  const now = Date.now();
  if (now - lastRedirectAt < 3000) return true;
  lastRedirectAt = now;
  try {
    toast.error("Seu período de teste expirou. Ative sua assinatura para continuar.");
  } catch {}
  if (typeof window !== "undefined") {
    const target = "/app/assinatura";
    if (!window.location.pathname.startsWith(target)) {
      setTimeout(() => { window.location.href = target; }, 400);
    }
  }
  return true;
}

/**
 * Installs global listeners that catch trial-expired errors anywhere they
 * bubble up (unhandled promise rejections, generic window errors).
 */
export function installTrialErrorInterceptor() {
  if (typeof window === "undefined") return;
  if ((window as any).__trialInterceptorInstalled) return;
  (window as any).__trialInterceptorInstalled = true;

  window.addEventListener("unhandledrejection", (e) => {
    handleTrialExpiredError(e.reason);
  });
  window.addEventListener("error", (e) => {
    handleTrialExpiredError(e.error ?? e.message);
  });

  // Wrap fetch to detect PostgREST error bodies even when callers swallow them.
  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const res = await origFetch(...args);
    try {
      const ct = res.headers.get("content-type") || "";
      if (!res.ok && ct.includes("application/json")) {
        const clone = res.clone();
        const body = await clone.text();
        if (body.includes("TRIAL_EXPIRED")) {
          handleTrialExpiredError(body);
        }
      }
    } catch {}
    return res;
  };
}