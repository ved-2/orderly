"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";

interface CreditInfo {
  credit_limit: number;
  current_outstanding: number;
  available_credit: number;
  payment_terms_days: number;
}

interface RetailerItem {
  id: string;
  retailer_code: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  registration_status: "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "SUSPENDED";
  is_active: boolean;
  created_at: string;
  credit: CreditInfo | null;
}

interface RetailersResponse {
  items: RetailerItem[];
  total: number;
  limit: number;
  offset: number;
}

interface UserProfile {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
}

const ALLOWED_ROLES = new Set(["DISTRIBUTOR_ADMIN"]);
const PAGE_SIZE = 50;

export default function RetailersAdminPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [retailers, setRetailers] = useState<RetailerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [selectedRetailer, setSelectedRetailer] = useState<RetailerItem | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyLimit, setVerifyLimit] = useState("50000");
  const [verifyTerms, setVerifyTerms] = useState("7");
  const [verifyRejectReason, setVerifyRejectReason] = useState("");

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "CHEQUE" | "BANK_TRANSFER">("CASH");
  const [paymentNote, setPaymentNote] = useState("");

  const [showCreditModal, setShowCreditModal] = useState(false);
  const [newCreditLimit, setNewCreditLimit] = useState("");
  const [newCreditTerms, setNewCreditTerms] = useState("");
  const [creditNote, setCreditNote] = useState("");

  const [actionBusy, setActionBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

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

  // 2. Load retailers list
  const loadRetailers = useCallback(
    async (currentOffset: number, filter: string, search: string) => {
      try {
        setLoading(true);
        setError(null);

        let url = `/distributor/retailers?limit=${PAGE_SIZE}&offset=${currentOffset}`;
        if (filter !== "ALL") {
          url += `&status=${filter}`;
        }
        if (search.trim()) {
          url += `&search=${encodeURIComponent(search.trim())}`;
        }

        const res = await apiRequest<RetailersResponse>(url);
        setRetailers(res.items || []);
        setTotal(res.total || 0);
        setOffset(res.offset || 0);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load retailers from server."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (profile && ALLOWED_ROLES.has(profile.role)) {
      loadRetailers(offset, statusFilter, searchTerm);
    }
  }, [profile, offset, statusFilter, searchTerm, loadRetailers]);

  // Actions
  const handleVerify = async (action: "APPROVE" | "REJECT") => {
    if (!selectedRetailer) return;
    setActionBusy(true);
    setFeedback(null);
    try {
      const payload: {
        action: "APPROVE" | "REJECT";
        credit_limit?: number;
        payment_terms_days?: number;
        rejection_reason?: string;
      } = { action };

      if (action === "APPROVE") {
        payload.credit_limit = parseFloat(verifyLimit) || 0;
        payload.payment_terms_days = parseInt(verifyTerms, 10) || 7;
      } else {
        payload.rejection_reason = verifyRejectReason.trim() || undefined;
      }

      await apiRequest(`/distributor/retailers/${selectedRetailer.id}/verify`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setFeedback(
        action === "APPROVE"
          ? `Shop ${selectedRetailer.shop_name} approved with Rs ${payload.credit_limit} credit limit.`
          : `Shop ${selectedRetailer.shop_name} registration rejected.`
      );
      setShowVerifyModal(false);
      setSelectedRetailer(null);
      await loadRetailers(offset, statusFilter, searchTerm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification action failed.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedRetailer) return;
    const amountVal = parseFloat(paymentAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      setError("Please enter a valid payment amount greater than zero.");
      return;
    }

    setActionBusy(true);
    setFeedback(null);
    try {
      await apiRequest(`/distributor/retailers/${selectedRetailer.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: amountVal,
          payment_mode: paymentMode,
          reference_note: paymentNote.trim() || undefined,
        }),
      });

      setFeedback(
        `Recorded Rs ${amountVal.toFixed(2)} payment for ${selectedRetailer.shop_name}. Credit restored.`
      );
      setShowPaymentModal(false);
      setSelectedRetailer(null);
      setPaymentAmount("");
      setPaymentNote("");
      await loadRetailers(offset, statusFilter, searchTerm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleUpdateCreditLimit = async () => {
    if (!selectedRetailer) return;
    const limitVal = parseFloat(newCreditLimit);
    if (isNaN(limitVal) || limitVal < 0) {
      setError("Please enter a valid credit limit.");
      return;
    }

    setActionBusy(true);
    setFeedback(null);
    try {
      const payload: {
        credit_limit: number;
        payment_terms_days?: number;
        note?: string;
      } = {
        credit_limit: limitVal,
        note: creditNote.trim() || undefined,
      };

      if (newCreditTerms.trim()) {
        payload.payment_terms_days = parseInt(newCreditTerms, 10);
      }

      await apiRequest(
        `/distributor/retailers/${selectedRetailer.id}/credit-limit`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      setFeedback(
        `Updated credit limit to Rs ${limitVal.toFixed(2)} for ${selectedRetailer.shop_name}.`
      );
      setShowCreditModal(false);
      setSelectedRetailer(null);
      setNewCreditLimit("");
      setNewCreditTerms("");
      setCreditNote("");
      await loadRetailers(offset, statusFilter, searchTerm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update credit limit.");
    } finally {
      setActionBusy(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
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
            Only Distributor Administrators can access retailer management.
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
      {/* Top Header */}
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
              Retailer Network & Credit
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <span className="border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
              {total} Total Kiranas
            </span>
            <button
              type="button"
              onClick={() => loadRetailers(offset, statusFilter, searchTerm)}
              disabled={loading}
              className="border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      {/* Feedback Banner */}
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

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Filter Bar & Search */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1 border border-gray-200 bg-white p-1">
            {[
              { label: "All Shops", value: "ALL" },
              { label: "Pending Review", value: "PENDING_REVIEW" },
              { label: "Active", value: "ACTIVE" },
              { label: "Suspended", value: "SUSPENDED" },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.value);
                  setOffset(0);
                }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === tab.value
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search shop, owner, phone, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setOffset(0);
                  loadRetailers(0, statusFilter, searchTerm);
                }
              }}
              className="border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 outline-none focus:border-gray-900 sm:w-64"
            />
            <button
              type="button"
              onClick={() => {
                setOffset(0);
                loadRetailers(0, statusFilter, searchTerm);
              }}
              className="border border-gray-900 bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
            >
              Search
            </button>
          </div>
        </div>

        {/* Retailers Table */}
        <div className="border border-gray-200 bg-white">
          {loading && retailers.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Loading kirana network records...
            </div>
          ) : retailers.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-gray-900">
                No retailers found
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Try adjusting your search criteria or status filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Shop & Code</th>
                    <th className="px-6 py-3">Proprietor Contact</th>
                    <th className="px-6 py-3">Location</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3 text-right">Credit Limit</th>
                    <th className="px-6 py-3 text-right">Outstanding</th>
                    <th className="px-6 py-3 text-right">Available</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {retailers.map((r) => {
                    const credit = r.credit;
                    return (
                      <tr key={r.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-950">
                            {r.shop_name}
                          </p>
                          <p className="font-mono text-xs text-gray-500">
                            {r.retailer_code}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <p className="font-medium text-gray-900">
                            {r.owner_name}
                          </p>
                          <p className="text-gray-500">{r.phone}</p>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600">
                          {r.city}, {r.pincode}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`border px-2 py-0.5 text-xs font-semibold uppercase ${
                              r.registration_status === "ACTIVE"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                : r.registration_status === "PENDING_REVIEW"
                                ? "border-amber-300 bg-amber-50 text-amber-800"
                                : "border-gray-300 bg-gray-50 text-gray-700"
                            }`}
                          >
                            {r.registration_status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-xs text-gray-900">
                          {credit ? formatCurrency(credit.credit_limit) : "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-xs text-gray-900">
                          {credit ? formatCurrency(credit.current_outstanding) : "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-xs font-medium text-emerald-700">
                          {credit ? formatCurrency(credit.available_credit) : "-"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            {r.registration_status === "PENDING_REVIEW" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRetailer(r);
                                  setShowVerifyModal(true);
                                }}
                                className="border border-emerald-700 bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800"
                              >
                                Verify & Grant Credit
                              </button>
                            )}
                            {r.registration_status === "ACTIVE" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedRetailer(r);
                                    setShowPaymentModal(true);
                                  }}
                                  className="border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50"
                                >
                                  Record Payment
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedRetailer(r);
                                    setNewCreditLimit(
                                      r.credit ? String(r.credit.credit_limit) : "50000"
                                    );
                                    setNewCreditTerms(
                                      r.credit ? String(r.credit.payment_terms_days) : "7"
                                    );
                                    setShowCreditModal(true);
                                  }}
                                  className="border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50"
                                >
                                  Adjust Credit
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal 1: Verify & Grant Credit */}
      {showVerifyModal && selectedRetailer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4">
          <div className="w-full max-w-lg border border-gray-300 bg-white p-6 shadow-md">
            <h3 className="text-lg font-semibold text-gray-950">
              Verify Kirana Shop Registration
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Review details for {selectedRetailer.shop_name} ({selectedRetailer.owner_name}).
            </p>

            <div className="mt-4 border-t border-b border-gray-100 py-3 text-xs space-y-1.5 text-gray-600">
              <p>
                <span className="font-medium text-gray-900">Address:</span>{" "}
                {selectedRetailer.address}, {selectedRetailer.city} - {selectedRetailer.pincode}
              </p>
              <p>
                <span className="font-medium text-gray-900">Phone:</span>{" "}
                {selectedRetailer.phone}
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Initial Credit Limit (INR)
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    value={verifyLimit}
                    onChange={(e) => setVerifyLimit(e.target.value)}
                    className="w-full border border-gray-300 px-3 py-1.5 text-xs text-gray-900 outline-none focus:border-gray-900"
                  />
                  {["25000", "50000", "100000"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setVerifyLimit(preset)}
                      className="border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      ₹{parseInt(preset, 10) / 1000}k
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Payment Terms Window (Days)
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    value={verifyTerms}
                    onChange={(e) => setVerifyTerms(e.target.value)}
                    className="w-full border border-gray-300 px-3 py-1.5 text-xs text-gray-900 outline-none focus:border-gray-900"
                  />
                  {["7", "14", "30"].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setVerifyTerms(days)}
                      className="border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => handleVerify("REJECT")}
                disabled={actionBusy}
                className="border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Reject Shop
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowVerifyModal(false)}
                  disabled={actionBusy}
                  className="border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleVerify("APPROVE")}
                  disabled={actionBusy}
                  className="bg-emerald-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {actionBusy ? "Approving..." : "Approve & Activate Shop"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Record Payment Collection */}
      {showPaymentModal && selectedRetailer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4">
          <div className="w-full max-w-md border border-gray-300 bg-white p-6 shadow-md">
            <h3 className="text-lg font-semibold text-gray-950">
              Record Kirana Payment Collection
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              {selectedRetailer.shop_name} | Current Outstanding:{" "}
              <span className="font-mono font-semibold text-gray-900">
                {formatCurrency(selectedRetailer.credit?.current_outstanding || 0)}
              </span>
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Amount Received (INR)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 15000"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-xs text-gray-900 outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className="mt-1 w-full border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 outline-none focus:border-gray-900"
                >
                  <option value="CASH">Cash Collection</option>
                  <option value="UPI">UPI / QR Transfer</option>
                  <option value="CHEQUE">Bank Cheque</option>
                  <option value="BANK_TRANSFER">Direct Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Reference / Cheque # / Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chq #004521 or UPI Ref 3241..."
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-xs text-gray-900 outline-none focus:border-gray-900"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                disabled={actionBusy}
                className="border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordPayment}
                disabled={actionBusy || !paymentAmount}
                className="bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {actionBusy ? "Recording..." : "Record Payment & Restore Credit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Adjust Credit Limit */}
      {showCreditModal && selectedRetailer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4">
          <div className="w-full max-w-md border border-gray-300 bg-white p-6 shadow-md">
            <h3 className="text-lg font-semibold text-gray-950">
              Adjust Credit Terms
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              {selectedRetailer.shop_name}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  New Credit Limit (INR)
                </label>
                <input
                  type="number"
                  value={newCreditLimit}
                  onChange={(e) => setNewCreditLimit(e.target.value)}
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-xs text-gray-900 outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Payment Terms Window (Days)
                </label>
                <input
                  type="number"
                  value={newCreditTerms}
                  onChange={(e) => setNewCreditTerms(e.target.value)}
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-xs text-gray-900 outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Adjustment Reason / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Distributor review after 3 months of regular orders"
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-xs text-gray-900 outline-none focus:border-gray-900"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setShowCreditModal(false)}
                disabled={actionBusy}
                className="border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateCreditLimit}
                disabled={actionBusy || !newCreditLimit}
                className="bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {actionBusy ? "Updating..." : "Save Credit Terms"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
