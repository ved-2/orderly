"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";

interface StaffUser {
  id: string;
  email: string;
  role: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

interface StaffResponse {
  staff: StaffUser[];
  pending_invitations: PendingInvitation[];
}

interface UserProfile {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
}

const ALLOWED_ROLES = new Set(["DISTRIBUTOR_ADMIN"]);

export default function StaffManagementPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ORDER_DESK" | "SALESMAN">("ORDER_DESK");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 1. Authenticate user
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProfileLoading(false);
      return;
    }

    let isMounted = true;
    async function fetchProfile() {
      try {
        const data = await apiRequest<UserProfile>("/auth/me");
        if (isMounted) setProfile(data);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Authentication error");
        }
      } finally {
        if (isMounted) setProfileLoading(false);
      }
    }

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  // 2. Load staff and invitations
  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<StaffResponse>("/distributor/staff");
      setStaffList(res.staff || []);
      setInvitations(res.pending_invitations || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load staff list from server."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile && ALLOWED_ROLES.has(profile.role)) {
      loadStaff();
    }
  }, [profile, loadStaff]);

  // 3. Issue Invitation
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteBusy(true);
    setError(null);
    setGeneratedLink(null);
    setCopied(false);

    try {
      const res = await apiRequest<{ invitation_link: string; message: string }>(
        "/distributor/staff/invite",
        {
          method: "POST",
          body: JSON.stringify({
            email: inviteEmail.trim().toLowerCase(),
            role: inviteRole,
          }),
        }
      );

      const fullUrl = `${window.location.origin}${res.invitation_link}`;
      setGeneratedLink(fullUrl);
      setFeedback(res.message);
      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to issue invitation.");
    } finally {
      setInviteBusy(false);
    }
  };

  // 4. Revoke Invitation
  const handleRevokeInvite = async (invitationId: string) => {
    try {
      await apiRequest(`/distributor/staff/invitations/${invitationId}/revoke`, {
        method: "POST",
      });
      setFeedback("Invitation revoked successfully.");
      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke invitation.");
    }
  };

  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  if (authLoading || profileLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm text-gray-500">Authenticating administrator session...</p>
        </div>
      </main>
    );
  }

  if (!user || !profile || !ALLOWED_ROLES.has(profile.role)) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-md border border-gray-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-gray-950">
            Access Restricted
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Only Distributor Administrators can manage staff and issue invitations.
          </p>
          <div className="mt-6">
            <Link
              href="/register"
              className="inline-block bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F6F5F1] text-[#242724]">
      <header className="sticky top-0 z-30 border-b border-[#E7E6E0] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3">
            <Link
              href="/distributor"
              className="text-xs font-semibold uppercase tracking-wider text-[#666864] hover:text-[#242724] transition-colors"
            >
              &larr; Control Center
            </Link>
            <span className="text-[#E7E6E0]">/</span>
            <h1 className="text-sm font-bold text-[#242724]">
              Staff & Salesmen Access Management
            </h1>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowInviteModal(true);
              setGeneratedLink(null);
              setError(null);
            }}
            className="rounded-[4px] bg-[#79565D] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#67474E] transition-colors shadow-2xs"
          >
            + Invite Staff Member
          </button>
        </div>
      </header>

      {feedback && (
        <div className="border-b border-emerald-200 bg-emerald-50 px-6 py-3 text-center text-xs font-medium text-emerald-900">
          {feedback}
        </div>
      )}

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-center text-xs font-medium text-red-900">
          {error}
        </div>
      )}

      <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Active Staff Table */}
        <div className="border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-950">
                Active Staff & Field Salesmen ({staffList.length})
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Users with authorized backend permissions in PostgreSQL.
              </p>
            </div>
          </div>

          {loading && staffList.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Loading staff accounts...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Email Address</th>
                    <th className="px-6 py-3">Assigned Role</th>
                    <th className="px-6 py-3">Contact</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3 text-right">Joined Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {staffList.map((st) => (
                    <tr key={st.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3.5 font-medium text-gray-950 text-xs">
                        {st.email}
                      </td>
                      <td className="px-6 py-3.5 text-xs">
                        <span
                          className={`border px-2 py-0.5 text-[11px] font-semibold uppercase ${
                            st.role === "DISTRIBUTOR_ADMIN"
                              ? "border-purple-300 bg-purple-50 text-purple-900"
                              : st.role === "ORDER_DESK"
                              ? "border-blue-300 bg-blue-50 text-blue-900"
                              : "border-emerald-300 bg-emerald-50 text-emerald-900"
                          }`}
                        >
                          {st.role.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-gray-600">
                        {st.phone || "-"}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className="border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right text-xs text-gray-500">
                        {formatDate(st.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending Invitations Table */}
        <div className="border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-950">
                Pending Staff Invitations ({invitations.length})
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Single-use tokens waiting to be redeemed by invited operators or field staff.
              </p>
            </div>
          </div>

          {invitations.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">
              No pending invitations. Click &quot;+ Invite Staff Member&quot; to issue a new secure invitation.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Invited Email</th>
                    <th className="px-6 py-3">Role to Grant</th>
                    <th className="px-6 py-3">Expires On</th>
                    <th className="px-6 py-3">Sent On</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3 font-medium text-gray-900 text-xs">
                        {inv.email}
                      </td>
                      <td className="px-6 py-3 text-xs">
                        <span className="border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                          {inv.role.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-600">
                        {formatDate(inv.expires_at)}
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-500">
                        {formatDate(inv.created_at)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Invite Staff Member */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4">
          <div className="w-full max-w-lg border border-gray-300 bg-white p-6 shadow-md">
            <h3 className="text-lg font-semibold text-gray-950">
              Invite Staff Member
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Generates a secure, single-use registration link tied to the specified email address.
            </p>

            {!generatedLink ? (
              <form onSubmit={handleCreateInvite} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Staff Member Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. salesman1@gmail.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-xs text-gray-900 outline-none focus:border-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Role to Assign
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="mt-1 w-full border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 outline-none focus:border-gray-900"
                  >
                    <option value="ORDER_DESK">Order Desk Operator (Reviews & approves orders)</option>
                    <option value="SALESMAN">Field Salesman (Places orders for assigned kiranas)</option>
                  </select>
                </div>

                <div className="border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
                  <p className="font-semibold text-gray-900">Security Rule:</p>
                  <p>
                    The recipient must authenticate with this exact email address to claim the role. Links expire in 7 days.
                  </p>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    disabled={inviteBusy}
                    className="border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteBusy || !inviteEmail}
                    className="bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {inviteBusy ? "Generating link..." : "Generate Invitation Link"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold text-emerald-900">
                    Invitation Link Ready for {inviteEmail}
                  </p>
                  <p className="mt-1 text-xs text-emerald-800">
                    Copy and send this link to the operator or salesman via WhatsApp or Email:
                  </p>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedLink}
                      className="w-full border border-emerald-300 bg-white px-3 py-1.5 font-mono text-xs text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="border border-emerald-800 bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900 whitespace-nowrap"
                    >
                      {copied ? "Copied!" : "Copy Link"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false);
                      setGeneratedLink(null);
                      setInviteEmail("");
                    }}
                    className="bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-800"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
