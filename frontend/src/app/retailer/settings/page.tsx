"use client";

import { useEffect, useState, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Store,
  User as UserIcon,
  Building2,
  UserCheck,
  Languages,
  Bell,
  Shield,
  HelpCircle,
  Info,
  Check,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  FileText,
  Lock,
  LogOut,
  ChevronRight,
  ExternalLink,
  Edit2,
  X,
  Save,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SettingsResponse {
  profile: {
    retailer_id: string;
    retailer_code: string;
    shop_name: string;
    owner_name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    gstin: string | null;
    account_status: string;
    is_active: boolean;
  };
  preferences: {
    language: "en" | "hi";
    order_notifications: boolean;
    order_confirmation_notifications: boolean;
    delivery_notifications: boolean;
    account_notifications: boolean;
    promotional_notifications: boolean;
  };
  salesman: {
    assigned: boolean;
    salesman: {
      name: string;
      phone: string | null;
      email: string;
      assigned_at: string;
    } | null;
  };
  security: {
    registered_phone: string;
    registered_email: string;
    role: string;
    account_created_at: string | null;
  };
}

/* ------------------------------------------------------------------ */
/*  Translations dictionary (Hindi & English)                          */
/* ------------------------------------------------------------------ */

const t = {
  en: {
    title: "Settings",
    subtitle: "Manage your shop information and account preferences.",
    shopProfile: "Shop Profile",
    personalInfo: "Personal Information",
    businessInfo: "Business Information",
    assignedSalesman: "Assigned Salesman",
    languagePref: "Language Preferences",
    notifPref: "Notification Preferences",
    privacySecurity: "Privacy & Security",
    helpSupport: "Help & Support",
    about: "About Orderlyy",
    edit: "Edit Profile",
    save: "Save Changes",
    cancel: "Cancel",
    readOnly: "Read-only",
    verified: "Verified Active",
    unverified: "Pending Verification",
    activeSalesman: "Field Representative",
    noSalesman: "No salesman assigned yet. Routine orders are processed directly by Jabalpur Central Depot.",
  },
  hi: {
    title: "सेटिंग्स (Settings)",
    subtitle: "अपनी दुकान की जानकारी और खाता प्राथमिकताओं को प्रबंधित करें।",
    shopProfile: "दुकान प्रोफ़ाइल (Shop Profile)",
    personalInfo: "व्यक्तिगत जानकारी (Personal Info)",
    businessInfo: "व्यापार जानकारी (Business Info)",
    assignedSalesman: "नियुक्त सेल्समैन (Assigned Salesman)",
    languagePref: "भाषा प्राथमिकता (Language)",
    notifPref: "अधिसूचना प्राथमिकताएं (Notifications)",
    privacySecurity: "गोपनीयता और सुरक्षा (Privacy & Security)",
    helpSupport: "सहायता और संपर्क (Help & Support)",
    about: "ऑर्डरली के बारे में (About Orderlyy)",
    edit: "बदलाव करें (Edit)",
    save: "सहेजें (Save)",
    cancel: "रद्द करें (Cancel)",
    readOnly: "केवल पढ़ने योग्य",
    verified: "सत्यापित किराना",
    unverified: "सत्यापन लंबित",
    activeSalesman: "क्षेत्रीय प्रतिनिधि",
    noSalesman: "कोई सेल्समैन नियुक्त नहीं है। आपके ऑर्डर सीधे जबलपुर डिपो द्वारा प्रोसेस किए जाते हैं।",
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function RetailerSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successToast, setSuccessToast] = useState("");

  // Edit Profile Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    shop_name: "",
    owner_name: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    gstin: "",
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Preference updating state
  const [updatingPrefKey, setUpdatingPrefKey] = useState<string | null>(null);

  // Current language
  const [lang, setLang] = useState<"en" | "hi">("en");

  /* Load Settings Data */
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/register");
      return;
    }

    let active = true;

    async function loadSettings() {
      try {
        const res = await apiRequest<SettingsResponse>("/settings");
        if (!active) return;
        setData(res);
        setLang(res.preferences.language || "en");
        setEditForm({
          shop_name: res.profile.shop_name || "",
          owner_name: res.profile.owner_name || "",
          address: res.profile.address || "",
          city: res.profile.city || "",
          state: res.profile.state || "",
          pincode: res.profile.pincode || "",
          gstin: res.profile.gstin || "",
        });
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load settings from server."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSettings();

    return () => {
      active = false;
    };
  }, [user, authLoading, router]);

  function triggerToast(msg: string) {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(""), 3000);
  }

  /* Profile Save Handler */
  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setIsSavingProfile(true);
    setError("");

    try {
      const res = await apiRequest<{ profile: SettingsResponse["profile"] }>(
        "/settings/profile",
        {
          method: "PATCH",
          body: JSON.stringify(editForm),
        }
      );

      setData((prev) =>
        prev
          ? {
              ...prev,
              profile: res.profile,
            }
          : prev
      );
      setIsEditing(false);
      triggerToast("Shop profile updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  /* Preference Toggle Handler */
  async function handleTogglePref(key: keyof SettingsResponse["preferences"], val: boolean | string) {
    if (!data) return;
    setUpdatingPrefKey(key);

    try {
      const payload = { [key]: val };
      const res = await apiRequest<{ preferences: SettingsResponse["preferences"] }>(
        "/settings/preferences",
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      );

      setData((prev) =>
        prev
          ? {
              ...prev,
              preferences: res.preferences,
            }
          : prev
      );

      if (key === "language") {
        setLang(val as "en" | "hi");
        localStorage.setItem("orderly_lang", val as string);
        triggerToast(`Language switched to ${val === "hi" ? "हिंदी" : "English"}`);
      } else {
        triggerToast("Notification preference saved.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save preference.");
    } finally {
      setUpdatingPrefKey(null);
    }
  }

  /* Logout */
  async function handleSignOut() {
    await logout();
    router.replace("/register");
  }

  const str = t[lang];

  /* ---------------------------------------------------------------- */
  /*  Loading State                                                    */
  /* ---------------------------------------------------------------- */

  if (authLoading || loading) {
    return (
      <div className="w-full px-4 py-6 sm:px-6 max-w-4xl mx-auto space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[#E7E6E0]" />
        <div className="h-4 w-72 animate-pulse rounded bg-[#E7E6E0]" />
        <div className="space-y-4 pt-4">
          <div className="h-44 animate-pulse rounded-[6px] bg-[#E7E6E0]" />
          <div className="h-44 animate-pulse rounded-[6px] bg-[#E7E6E0]" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="w-full px-4 py-12 max-w-md mx-auto text-center">
        <div className="rounded-[6px] border border-[#EDBCBC] bg-[#FBF0F0] p-6 text-xs text-[#8C2828]">
          <AlertCircle size={24} className="mx-auto mb-2 text-[#8C2828]" />
          <p className="font-bold">Unable to load settings</p>
          <p className="mt-1 opacity-80">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-[4px] bg-[#8C2828] px-4 py-2 text-xs font-semibold text-white min-h-[44px]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { profile, preferences, salesman, security } = data;
  const isApproved = profile.account_status === "ACTIVE";

  return (
    <div className="w-full px-4 py-5 sm:px-6 max-w-4xl mx-auto space-y-6 pb-28 md:pb-16">

      {/* ── Page Header ────────────────────────────────────────── */}
      <section className="border-b border-[#E7E6E0] pb-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#242724]">
          {str.title}
        </h1>
        <p className="mt-0.5 text-xs sm:text-sm text-[#666864]">
          {str.subtitle}
        </p>
      </section>

      {/* Toast alert */}
      {successToast && (
        <div className="flex items-center gap-2 rounded-[4px] border border-[#C3DEC9] bg-[#EEF6F1] px-4 py-3 text-xs font-bold text-[#205234] shadow-xs animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>{successToast}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-[4px] border border-[#EDBCBC] bg-[#FBF0F0] px-4 py-3 text-xs font-semibold text-[#8C2828]">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── A. SHOP PROFILE & C. BUSINESS INFORMATION ──────────── */}
      <section className="rounded-[6px] border border-[#E7E6E0] bg-white p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E7E6E0] pb-3">
          <div className="flex items-center gap-2">
            <Store size={16} className="text-[#79565D]" />
            <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#242724]">
              {str.shopProfile}
            </h2>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E7E6E0] bg-white px-3 py-1.5 text-xs font-semibold text-[#242724] hover:bg-[#F0EFEA] hover:border-[#79565D] transition-colors min-h-[44px]"
            >
              <Edit2 size={13} className="text-[#79565D]" />
              <span>{str.edit}</span>
            </button>
          )}
        </div>

        {isEditing ? (
          /* Inline Edit Form */
          <form onSubmit={handleProfileSave} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-[#969892] block mb-1">
                  Shop Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.shop_name}
                  onChange={(e) => setEditForm({ ...editForm, shop_name: e.target.value })}
                  className="w-full rounded-[4px] border border-[#E7E6E0] p-2.5 text-xs text-[#242724] outline-none focus:border-[#79565D] min-h-[44px]"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-[#969892] block mb-1">
                  Owner Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.owner_name}
                  onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })}
                  className="w-full rounded-[4px] border border-[#E7E6E0] p-2.5 text-xs text-[#242724] outline-none focus:border-[#79565D] min-h-[44px]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-[#969892] block mb-1">
                  Shop Address *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full rounded-[4px] border border-[#E7E6E0] p-2.5 text-xs text-[#242724] outline-none focus:border-[#79565D] min-h-[44px]"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-[#969892] block mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className="w-full rounded-[4px] border border-[#E7E6E0] p-2.5 text-xs text-[#242724] outline-none focus:border-[#79565D] min-h-[44px]"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-[#969892] block mb-1">
                  Pincode *
                </label>
                <input
                  type="text"
                  required
                  pattern="[0-9]{6}"
                  value={editForm.pincode}
                  onChange={(e) => setEditForm({ ...editForm, pincode: e.target.value })}
                  className="w-full rounded-[4px] border border-[#E7E6E0] p-2.5 text-xs text-[#242724] outline-none focus:border-[#79565D] min-h-[44px]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-[#969892] block mb-1">
                  GSTIN (Optional)
                </label>
                <input
                  type="text"
                  placeholder="23XXXXX0000X1Z0"
                  value={editForm.gstin}
                  onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value })}
                  className="w-full rounded-[4px] border border-[#E7E6E0] p-2.5 text-xs text-[#242724] outline-none focus:border-[#79565D] font-mono min-h-[44px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F0EFEA]">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-[4px] border border-[#E7E6E0] px-4 py-2 text-xs font-semibold text-[#666864] hover:bg-[#F0EFEA] min-h-[44px]"
              >
                {str.cancel}
              </button>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#79565D] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#67474E] disabled:opacity-50 min-h-[44px]"
              >
                <Save size={13} />
                <span>{isSavingProfile ? "Saving..." : str.save}</span>
              </button>
            </div>
          </form>
        ) : (
          /* Profile Read View */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#969892]">Shop Name</p>
              <p className="mt-0.5 text-sm font-bold text-[#242724]">{profile.shop_name}</p>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#969892]">Retailer ID (Read-only)</p>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-[#242724]">{profile.retailer_code}</span>
                <Badge variant={isApproved ? "success" : "warning"} className="text-[9px]">
                  {profile.account_status}
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#969892]">Owner Name</p>
              <p className="mt-0.5 text-xs font-semibold text-[#242724]">{profile.owner_name}</p>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#969892]">Registered Mobile</p>
              <p className="mt-0.5 font-mono text-xs font-semibold text-[#242724]">{profile.phone}</p>
            </div>

            <div className="sm:col-span-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#969892]">Registered Shop Address</p>
              <p className="mt-0.5 text-xs text-[#242724] leading-relaxed">
                {profile.address}, {profile.city}, {profile.state} — <span className="font-mono">{profile.pincode}</span>
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#969892]">GSTIN</p>
              <p className="mt-0.5 font-mono text-xs text-[#242724]">
                {profile.gstin || "Not Registered (Unregistered Kirana)"}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#969892]">Assigned Depot</p>
              <p className="mt-0.5 text-xs font-semibold text-[#242724]">Jabalpur Central FMCG Depot</p>
            </div>
          </div>
        )}
      </section>

      {/* ── B. PERSONAL INFORMATION ────────────────────────────── */}
      <section className="rounded-[6px] border border-[#E7E6E0] bg-white p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-[#E7E6E0] pb-3">
          <UserIcon size={16} className="text-[#79565D]" />
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#242724]">
            {str.personalInfo}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#969892]">Owner / Primary Contact</span>
            <p className="mt-0.5 font-semibold text-[#242724]">{profile.owner_name}</p>
          </div>
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#969892]">Mobile Phone</span>
            <p className="mt-0.5 font-mono font-semibold text-[#242724]">{profile.phone}</p>
          </div>
          <div className="sm:col-span-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#969892]">Registered Email</span>
            <p className="mt-0.5 font-semibold text-[#242724]">{profile.email || "—"}</p>
          </div>
        </div>
      </section>

      {/* ── D. ASSIGNED SALESMAN ───────────────────────────────── */}
      <section className="rounded-[6px] border border-[#E7E6E0] bg-white p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-[#E7E6E0] pb-3">
          <UserCheck size={16} className="text-[#79565D]" />
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#242724]">
            {str.assignedSalesman}
          </h2>
        </div>

        {salesman.assigned && salesman.salesman ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <div>
              <p className="text-sm font-bold text-[#242724]">{salesman.salesman.name}</p>
              <p className="text-[11px] text-[#666864] mt-0.5">
                Assigned Route Representative &bull; Jabalpur Sector
              </p>
              {salesman.salesman.phone && (
                <p className="font-mono text-xs font-semibold text-[#242724] mt-1">
                  {salesman.salesman.phone}
                </p>
              )}
            </div>

            {salesman.salesman.phone && (
              <a
                href={`tel:${salesman.salesman.phone}`}
                className="inline-flex items-center gap-2 rounded-[4px] bg-[#79565D] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#67474E] transition-colors self-start sm:self-auto min-h-[44px]"
              >
                <Phone size={13} />
                <span>Call Representative</span>
              </a>
            )}
          </div>
        ) : (
          <div className="rounded-[4px] bg-[#FAF9F6] border border-dashed border-[#E7E6E0] p-4 text-xs text-[#666864]">
            <p className="font-semibold text-[#242724]">{str.noSalesman}</p>
            <p className="mt-1 text-[11px] text-[#969892]">
              Need help with a routine restock or order desk check? Call Jabalpur Central Depot:{" "}
              <a href="tel:+917612408890" className="text-[#79565D] font-bold underline">
                +91 761 240 8890
              </a>
            </p>
          </div>
        )}
      </section>

      {/* ── E. LANGUAGE PREFERENCES ────────────────────────────── */}
      <section className="rounded-[6px] border border-[#E7E6E0] bg-white p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-[#E7E6E0] pb-3">
          <Languages size={16} className="text-[#79565D]" />
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#242724]">
            {str.languagePref}
          </h2>
        </div>

        <p className="text-xs text-[#666864]">
          Select your preferred application display language.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => handleTogglePref("language", "en")}
            disabled={updatingPrefKey === "language"}
            className={`flex items-center justify-between p-3.5 rounded-[6px] border text-xs font-bold transition-all min-h-[48px] ${
              lang === "en"
                ? "border-[#79565D] bg-[#F4EFF0] text-[#67474E] shadow-2xs"
                : "border-[#E7E6E0] bg-white text-[#242724] hover:bg-[#F0EFEA]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🇬🇧</span>
              <span>English (Default)</span>
            </div>
            {lang === "en" && <Check size={16} className="text-[#79565D]" />}
          </button>

          <button
            type="button"
            onClick={() => handleTogglePref("language", "hi")}
            disabled={updatingPrefKey === "language"}
            className={`flex items-center justify-between p-3.5 rounded-[6px] border text-xs font-bold transition-all min-h-[48px] ${
              lang === "hi"
                ? "border-[#79565D] bg-[#F4EFF0] text-[#67474E] shadow-2xs"
                : "border-[#E7E6E0] bg-white text-[#242724] hover:bg-[#F0EFEA]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🇮🇳</span>
              <span>हिंदी (Hindi)</span>
            </div>
            {lang === "hi" && <Check size={16} className="text-[#79565D]" />}
          </button>
        </div>
      </section>

      {/* ── F. NOTIFICATION PREFERENCES ────────────────────────── */}
      <section className="rounded-[6px] border border-[#E7E6E0] bg-white p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-[#E7E6E0] pb-3">
          <Bell size={16} className="text-[#79565D]" />
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#242724]">
            {str.notifPref}
          </h2>
        </div>

        <div className="divide-y divide-[#F0EFEA]">
          {[
            {
              key: "order_notifications",
              title: "Order Desk Updates",
              desc: "Get notified when your order is reviewed, approved, or held by Jabalpur Order Desk.",
            },
            {
              key: "order_confirmation_notifications",
              title: "Order Confirmation Notifications",
              desc: "Immediate SMS and app alerts when your routine order is created.",
            },
            {
              key: "delivery_notifications",
              title: "Route Dispatch Alerts",
              desc: "Alerts when the depot van departs with your kirana shipment.",
            },
            {
              key: "account_notifications",
              title: "Account & Credit Alerts",
              desc: "Notifications regarding credit limit updates, payment passbook receipts, and due dates.",
            },
            {
              key: "promotional_notifications",
              title: "Trade Schemes & Volume Rebates",
              desc: "Alerts for new Buy 10 Get 1 Free offers and brand promotions.",
            },
          ].map((item) => {
            const isChecked = Boolean(preferences[item.key as keyof typeof preferences]);
            const isBusy = updatingPrefKey === item.key;

            return (
              <div
                key={item.key}
                className="flex items-center justify-between gap-4 py-3.5 first:pt-1 last:pb-1"
              >
                <div>
                  <p className="text-xs font-semibold text-[#242724]">{item.title}</p>
                  <p className="text-[11px] text-[#666864] mt-0.5 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={isChecked}
                  disabled={isBusy}
                  onClick={() => handleTogglePref(item.key as keyof SettingsResponse["preferences"], !isChecked)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none min-h-[44px] items-center ${
                    isChecked ? "bg-[#79565D]" : "bg-[#D5D3CB]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                      isChecked ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── G. PRIVACY AND SECURITY ────────────────────────────── */}
      <section className="rounded-[6px] border border-[#E7E6E0] bg-white p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-[#E7E6E0] pb-3">
          <Shield size={16} className="text-[#79565D]" />
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#242724]">
            {str.privacySecurity}
          </h2>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-[#F0EFEA] pb-2.5">
            <div>
              <p className="font-semibold text-[#242724]">Authenticated Phone</p>
              <p className="text-[11px] text-[#666864]">Secured via Firebase OTP authentication</p>
            </div>
            <span className="font-mono font-bold text-[#242724]">{security.registered_phone}</span>
          </div>

          <div className="flex items-center justify-between border-b border-[#F0EFEA] pb-2.5">
            <div>
              <p className="font-semibold text-[#242724]">Account Role</p>
              <p className="text-[11px] text-[#666864]">Retailer Wholesale Ordering Authority</p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {security.role}
            </Badge>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-[11px] text-[#666864]">
              Want to end your session on this device?
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#EDBCBC] bg-[#FBF0F0] px-4 py-2 text-xs font-bold text-[#8C2828] hover:bg-[#F7E1E1] transition-colors min-h-[44px]"
            >
              <LogOut size={13} />
              <span>Sign Out of Kirana Workspace</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── H. HELP AND SUPPORT ────────────────────────────────── */}
      <section className="rounded-[6px] border border-[#E7E6E0] bg-white p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-[#E7E6E0] pb-3">
          <HelpCircle size={16} className="text-[#79565D]" />
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#242724]">
            {str.helpSupport}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-[4px] border border-[#E7E6E0] bg-[#FAF9F6] p-3.5">
            <p className="font-bold text-[#242724]">Jabalpur Central Depot Order Desk</p>
            <p className="mt-1 text-[11px] text-[#666864]">
              For urgent case requests, stock approvals, and credit line enhancements:
            </p>
            <div className="mt-2.5 space-y-1">
              <a
                href="tel:+917612408890"
                className="flex items-center gap-1.5 text-xs font-bold text-[#79565D] hover:underline"
              >
                <Phone size={12} />
                <span>+91 761 240 8890</span>
              </a>
              <p className="text-[10px] text-[#969892]">Hours: Mon – Sat, 9:00 AM – 7:00 PM</p>
            </div>
          </div>

          <div className="rounded-[4px] border border-[#E7E6E0] bg-[#FAF9F6] p-3.5">
            <p className="font-bold text-[#242724]">Next-Morning Delivery Policy</p>
            <p className="mt-1 text-[11px] text-[#666864] leading-relaxed">
              Orders confirmed before <strong>4:00 PM</strong> are loaded onto morning route delivery vans. Free freight on orders over ₹2,000.
            </p>
            <Link
              href="/retailer/orders"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#79565D] hover:underline"
            >
              <span>Track Dispatches</span>
              <ChevronRight size={12} />
            </Link>
          </div>
        </div>

        {/* Quick FAQs */}
        <div className="pt-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#969892] mb-2">
            Frequently Asked Questions
          </p>
          <div className="space-y-2 text-xs">
            <details className="rounded-[4px] border border-[#E7E6E0] p-3 group">
              <summary className="font-semibold text-[#242724] cursor-pointer list-none flex items-center justify-between">
                <span>How are my wholesale case rates determined?</span>
                <ChevronRight size={13} className="group-open:rotate-90 transition-transform" />
              </summary>
              <p className="mt-2 text-[11px] text-[#666864] leading-relaxed border-t border-[#F0EFEA] pt-2">
                All prices are authorized distributor wholesale rates calculated per pack size and units per case, including applicable trade schemes.
              </p>
            </details>

            <details className="rounded-[4px] border border-[#E7E6E0] p-3 group">
              <summary className="font-semibold text-[#242724] cursor-pointer list-none flex items-center justify-between">
                <span>How do Trade Schemes (Buy 10 Get 1 Free) work?</span>
                <ChevronRight size={13} className="group-open:rotate-90 transition-transform" />
              </summary>
              <p className="mt-2 text-[11px] text-[#666864] leading-relaxed border-t border-[#F0EFEA] pt-2">
                Trade scheme bonuses are automatically evaluated by the Order Desk and applied to your invoice without manual coupons.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* ── I. ABOUT ORDERLYY ──────────────────────────────────── */}
      <section className="rounded-[6px] border border-[#E7E6E0] bg-white p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-[#E7E6E0] pb-3">
          <Info size={16} className="text-[#79565D]" />
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#242724]">
            {str.about}
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#969892]">Platform</p>
            <p className="mt-0.5 font-bold text-[#242724]">Orderlyy FMCG</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#969892]">Version</p>
            <p className="mt-0.5 font-mono text-[#242724]">v2.4.0 (2026)</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#969892]">Assigned Hub</p>
            <p className="mt-0.5 font-semibold text-[#242724]">Jabalpur Central</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#969892]">Retail Network</p>
            <p className="mt-0.5 font-semibold text-[#242724]">1,800+ Kiranas</p>
          </div>
        </div>

        <p className="text-[10px] text-[#969892] pt-2 border-t border-[#F0EFEA]">
          Authorized B2B Kirana ordering platform connected to Jabalpur Central Depot. All rights reserved.
        </p>
      </section>

    </div>
  );
}
