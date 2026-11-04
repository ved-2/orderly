
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  Store,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";

import {
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  refreshEmailVerification,
  resendVerificationEmail,
  sendPasswordReset,
  logout,
} from "@/lib/auth";

type RegistrationResult = {
  retailer_id: string;
  retailer_code: string;
  shop_name: string;
  registration_status: string;
  credit_limit: number;
  can_place_orders: boolean;
  duplicate_flag: boolean;
};

type Stage = "account" | "verification" | "shop" | "success";

export default function RegisterPage() {
  const { user, loading } = useAuth();

  const [stage, setStage] = useState<Stage>("account");
  const [accountType, setAccountType] = useState<"retailer" | "distributor">("retailer");
  const [isLogin, setIsLogin] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RegistrationResult | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [shop, setShop] = useState({
    shop_name: "",
    owner_name: "",
    phone: "",
    address: "",
    city: "",
    state: "Madhya Pradesh",
    pincode: "",
  });

  async function handlePasswordReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResetSuccess(false);

    try {
      await sendPasswordReset(email);
      setResetSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send password reset email."
      );
    } finally {
      setBusy(false);
    }
  }

  async function redirectAfterLogin() {
    try {
      const profile = await apiRequest<{
        role: string;
        retailer_id: string | null;
      }>("/auth/me");

      if (profile.role === "DISTRIBUTOR_ADMIN") {
        window.location.replace("/distributor");
        return;
      }

      if (profile.role === "ORDER_DESK") {
        window.location.replace("/order-desk");
        return;
      }

      if (profile.role === "SALESMAN") {
        window.location.replace("/salesman");
        return;
      }

      if (profile.retailer_id) {
        window.location.replace("/retailer/dashboard");
        return;
      }

      setStage("shop");
    } catch (error) {
      console.error("Unable to check user profile:", error);
      setStage("shop");
    }
  }

  useEffect(() => {
    if (loading) return;
    if (user && user.emailVerified) {
      redirectAfterLogin();
    }
  }, [user, loading]);

  async function handleEmailAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      if (isLogin) {
        const firebaseUser = await loginWithEmail(email, password);

        if (!firebaseUser.emailVerified) {
          setStage("verification");
        } else {
          if (accountType === "distributor") {
            try {
              await apiRequest("/auth/distributor/register", { method: "POST" });
            } catch {
              // ignore if already registered
            }
          }
          await redirectAfterLogin();
        }
      } else {
        await registerWithEmail(email, password);
        setStage("verification");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Authentication failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleAuth() {
    setBusy(true);
    setError("");

    try {
      const firebaseUser = await loginWithGoogle();

      if (!firebaseUser.emailVerified) {
        setStage("verification");
      } else {
        if (accountType === "distributor") {
          try {
            await apiRequest("/auth/distributor/register", { method: "POST" });
            window.location.replace("/distributor");
            return;
          } catch {
            // fallback to redirectAfterLogin
          }
        }
        await redirectAfterLogin();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Google sign-in failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleVerification() {
    setBusy(true);
    setError("");

    try {
      await refreshEmailVerification();
      if (accountType === "distributor") {
        await apiRequest("/auth/distributor/register", { method: "POST" });
        window.location.replace("/distributor");
        return;
      }
      setStage("shop");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Verification failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleResendVerification() {
    setBusy(true);
    setError("");

    try {
      await resendVerificationEmail();
      setError("Verification email sent. Check your inbox.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to send email.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleShopRegistration(
    e: React.FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await apiRequest<RegistrationResult>(
        "/retailers/register",
        {
          method: "POST",
          body: JSON.stringify(shop),
        },
      );

      setResult(response);
      setStage("success");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Registration failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </main>
    );
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900";

  return (
    <main className="flex min-h-screen bg-[#f5f5f2] text-slate-900">
      <section className="mx-auto flex w-full max-w-xl flex-col justify-center px-5 py-12 sm:px-10">
        <Link href="/" className="mb-12 inline-flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-white">
            <Store size={19} />
          </span>
          <span className="text-xl font-semibold tracking-tight">
            orderly
          </span>
        </Link>

        {stage !== "success" && (
          <div className="mb-8">
            {stage === "account" && !isForgotPassword && (
              <div className="mb-6 grid grid-cols-2 border border-slate-300 bg-slate-200/60 p-1 rounded-md text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAccountType("retailer");
                    setError("");
                  }}
                  className={`py-2 text-xs font-semibold rounded transition-colors ${
                    accountType === "retailer"
                      ? "bg-white text-slate-950 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Retailer (Kirana Shop)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccountType("distributor");
                    setError("");
                  }}
                  className={`py-2 text-xs font-semibold rounded transition-colors ${
                    accountType === "distributor"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Distributor Admin
                </button>
              </div>
            )}

            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {accountType === "distributor" ? "Distributor Operations" : "Retailer account"}
            </p>

            <h1 className="text-3xl font-semibold tracking-tight">
              {isForgotPassword
                ? "Reset your password."
                : stage === "account" && (
                    accountType === "distributor"
                      ? (isLogin ? "Distributor Sign In." : "Register as Distributor Admin.")
                      : (isLogin ? "Welcome back." : "Register your shop.")
                  )}
              {stage === "verification" && "Verify your email."}
              {stage === "shop" && "Tell us about your shop."}
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              {isForgotPassword
                ? "Enter your account email to receive a password reset link."
                : stage === "account" && (
                    accountType === "distributor"
                      ? "Create or access your distributor administrator account to manage kirana shops, orders, and pricing."
                      : "Create your account to access distributor products, prices and schemes."
                  )}
              {stage === "verification" &&
                `We need to verify ${user?.email ?? email} before continuing.`}
              {stage === "shop" &&
                "Enter your business details to start placing orders."}
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {stage === "account" && isForgotPassword ? (
          <div className="space-y-5">
            {resetSuccess ? (
              <div className="space-y-4 rounded-md border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-medium text-emerald-900">
                  Password reset link sent!
                </p>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  We sent a reset link to <span className="font-semibold">{email}</span>. Please check your inbox and follow the instructions to reset your password.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setResetSuccess(false);
                    setError("");
                  }}
                  className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Return to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Registered email address
                  </label>
                  <input
                    className={inputClass}
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {busy ? <Loader2 size={17} className="animate-spin" /> : null}
                  Send reset link
                  {!busy && <ArrowRight size={16} />}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setError("");
                    }}
                    className="text-xs font-semibold text-slate-700 underline underline-offset-4 hover:text-slate-900"
                  >
                    &larr; Back to sign in
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : stage === "account" && (
          <div className="space-y-5">
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Email address
                </label>
                <input
                  className={inputClass}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium">
                    Password
                  </label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setError("");
                        setResetSuccess(false);
                      }}
                      className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-900"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  className={inputClass}
                  type="password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>

              <button
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? <Loader2 size={17} className="animate-spin" /> : null}
                {accountType === "distributor"
                  ? (isLogin ? "Sign in as Distributor" : "Create Distributor Account")
                  : (isLogin ? "Sign in" : "Create account")}
                {!busy && <ArrowRight size={16} />}
              </button>
            </form>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-500">OR</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={handleGoogleAuth}
              className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
            >
              Continue with Google
            </button>

            <p className="text-center text-sm text-slate-600">
              {isLogin ? "New to Orderly?" : "Already have an account?"}{" "}
              <button
                type="button"
                className="font-semibold text-slate-900 underline underline-offset-4"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                  setIsForgotPassword(false);
                }}
              >
                {isLogin ? "Create account" : "Sign in"}
              </button>
            </p>
          </div>
        )}

        {stage === "verification" && (
          <div className="space-y-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white">
              <Mail size={25} />
            </div>

            <p className="text-sm leading-6 text-slate-600">
              Open the verification email and click its verification link.
              Return here after completing verification.
            </p>

            <button
              type="button"
              disabled={busy}
              onClick={handleVerification}
              className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              I've verified my email
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={handleResendVerification}
              className="w-full border border-slate-300 bg-white px-4 py-3 text-sm"
            >
              Resend verification email
            </button>
          </div>
        )}

        {stage === "shop" && (
          <form onSubmit={handleShopRegistration} className="space-y-4">
            {(
              [
                ["shop_name", "Shop name", "Shree Ganesh General Stores"],
                ["owner_name", "Owner name", "Your full name"],
                ["phone", "Phone number", "9876543210"],
                ["address", "Shop address", "Street, area and landmark"],
                ["city", "City", "Jabalpur"],
                ["state", "State", "Madhya Pradesh"],
                ["pincode", "PIN code", "482001"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <div key={key}>
                <label className="mb-2 block text-sm font-medium">
                  {label}
                </label>
                <input
                  className={inputClass}
                  required
                  value={shop[key]}
                  placeholder={placeholder}
                  onChange={(e) =>
                    setShop((previous) => ({
                      ...previous,
                      [key]: e.target.value,
                    }))
                  }
                  maxLength={key === "address" ? 300 : 150}
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? <Loader2 size={17} className="animate-spin" /> : null}
              Submit shop registration
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>
        )}

        {stage === "success" && result && (
          <div className="space-y-5">
            <CheckCircle2 size={48} className="text-emerald-700" />

            <h1 className="text-3xl font-semibold">
              Registration received.
            </h1>

            <p className="text-sm leading-6 text-slate-600">
              Your shop has been registered. You can start browsing and
              placing orders while the distributor reviews your details.
            </p>

            <div className="space-y-2 rounded-md border border-slate-200 bg-white p-4 text-sm">
              <p>
                <span className="text-slate-500">Shop:</span>{" "}
                {result.shop_name}
              </p>
              <p>
                <span className="text-slate-500">Retailer ID:</span>{" "}
                {result.retailer_code}
              </p>
              <p>
                <span className="text-slate-500">Verification:</span>{" "}
                {result.registration_status}
              </p>
              <p>
                <span className="text-slate-500">Credit limit:</span>{" "}
                ₹{result.credit_limit.toFixed(2)}
              </p>
              {result.duplicate_flag && (
                <p className="text-amber-700">
                  Your shop details require additional review.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                window.location.href = "/retailer/dashboard";
              }}
              className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white"
            >
              Continue to Orderly
            </button>
          </div>
        )}

        <p className="mt-12 text-center text-xs text-slate-500">
          Orderly Distribution Management
        </p>
      </section>
    </main>
  );
}
