"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import { loginWithEmail, registerWithEmail } from "@/lib/auth";

interface InvitationData {
  email: string;
  role: string;
  expires_at: string;
  is_valid: boolean;
}

function InvitationAcceptanceContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { user, loading: authLoading, logout } = useAuth();

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 1. Verify invitation token on mount
  useEffect(() => {
    if (!token) {
      setError("No invitation token found in link.");
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function verifyToken() {
      try {
        setLoading(true);
        setError(null);
        const data = await apiRequest<InvitationData>(
          `/auth/invitations/${token}`,
          { requireAuth: false }
        );
        if (isMounted) setInvitation(data);
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "This invitation link is invalid or has expired."
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    verifyToken();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // 2. Accept and join
  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !invitation) return;

    setSubmitting(true);
    setError(null);

    try {
      // Step A: Ensure Firebase user session
      let activeUser = user;
      if (!activeUser || activeUser.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        try {
          activeUser = await loginWithEmail(invitation.email, password);
        } catch {
          // If login fails, attempt to register new Firebase account with this password
          activeUser = await registerWithEmail(invitation.email, password);
        }
      }

      // Step B: Redeem invitation in PostgreSQL backend
      const res = await apiRequest<{ role: string; message: string }>(
        `/auth/invitations/${token}/accept`,
        {
          method: "POST",
        }
      );

      setSuccessMessage(res.message);

      // Step C: Route to appropriate workspace
      setTimeout(() => {
        if (res.role === "ORDER_DESK") {
          window.location.replace("/order-desk");
        } else if (res.role === "SALESMAN") {
          window.location.replace("/salesman");
        } else if (res.role === "DISTRIBUTOR_ADMIN") {
          window.location.replace("/distributor");
        } else {
          window.location.replace("/distributor");
        }
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to accept staff invitation. Please check your credentials."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <p className="text-sm text-gray-500">Verifying staff invitation...</p>
      </main>
    );
  }

  if (error || !invitation) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md border border-red-200 bg-white p-6 shadow-xs">
          <h1 className="text-lg font-semibold text-red-950">
            Invitation Expired or Invalid
          </h1>
          <p className="mt-2 text-sm text-red-700 leading-relaxed">
            {error || "This invitation link cannot be used. Please ask your distributor administrator for a new invite."}
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-block border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50"
            >
              &larr; Return to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md border border-gray-200 bg-white p-8 shadow-xs">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Orderly Staff Workspace
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-950">
            Accept Staff Invitation
          </h1>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            You have been invited to join Orderly as an authorized{" "}
            <span className="font-semibold text-gray-900">
              {invitation.role.replace("_", " ")}
            </span>
            .
          </p>
        </div>

        {successMessage ? (
          <div className="mt-6 border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-900">
              {successMessage}
            </p>
            <p className="mt-1 text-xs text-emerald-800">
              Redirecting you to your staff workspace...
            </p>
          </div>
        ) : (
          <form onSubmit={handleAccept} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Assigned Email Address (Locked)
              </label>
              <input
                type="email"
                disabled
                value={invitation.email}
                className="mt-1 w-full border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">
                Assigned Operational Role
              </label>
              <input
                type="text"
                disabled
                value={invitation.role.replace("_", " ")}
                className="mt-1 w-full border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">
                Create Account Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full border border-gray-300 px-3 py-2 text-xs text-gray-900 outline-none focus:border-gray-900"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                If you already registered this email in Orderly, enter your existing password.
              </p>
            </div>

            {error && (
              <div className="border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !password}
              className="mt-2 w-full bg-gray-900 py-2.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? "Joining Orderly..." : "Accept Invitation & Join"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function InvitationPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <p className="text-sm text-gray-500">Loading...</p>
        </main>
      }
    >
      <InvitationAcceptanceContent />
    </Suspense>
  );
}
