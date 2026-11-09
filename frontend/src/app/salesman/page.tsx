"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  Layers,
  LogOut,
  MapPin,
  Mic,
  MicOff,
  Minus,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Share2,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  TrendingUp,
  Upload,
  UserCheck,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  CachedCatalogueItem,
  QueuedOrder,
  clearOfflineQueue,
  getCachedCatalogue,
  getOfflineQueue,
  queueOfflineOrder,
  removeOfflineOrder,
  saveCachedCatalogue,
} from "@/lib/offline-store";

interface RetailerOption {
  id: string;
  retailer_code: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  credit_limit: number;
  current_outstanding: number;
  available_credit: number;
  payment_terms_days: number;
  pending_orders_count: number;
}

interface SalesmanOrder {
  id: string;
  order_number: string;
  retailer_id: string;
  shop_name: string;
  retailer_code: string;
  status: string;
  total_amount: number;
  items_count: number;
  created_at: string;
  submitted_at: string | null;
}

interface UserProfile {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface AICartAction {
  action: "ADD" | "SET" | "UPDATE" | "REMOVE" | "CLEAR" | "SYNC";
  product_id?: string;
  product_name?: string;
  name?: string;
  quantity?: number;
  quantity_unit?: "CASE" | "PIECE";
}

interface AIChatResponse {
  session_id?: string;
  reply?: string;
  messages?: Array<{ role: string; content: string }>;
  cart_actions?: AICartAction[];
  suggested_products?: Array<{
    id: string;
    name: string;
    brand_name: string;
    price: number;
    units_per_case: number;
  }>;
  audio_text?: string;
}

const ALLOWED_ROLES = new Set(["SALESMAN", "DISTRIBUTOR_ADMIN"]);

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(isoString: string): string {
  if (!isoString) return "-";
  try {
    return new Date(isoString).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

export default function SalesmanPortalPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Network State
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState<QueuedOrder[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Main UI State
  const [activeTab, setActiveTab] = useState<"ORDERING" | "HISTORY">("ORDERING");
  const [retailers, setRetailers] = useState<RetailerOption[]>([]);
  const [selectedRetailer, setSelectedRetailer] = useState<RetailerOption | null>(null);
  const [showRetailerPicker, setShowRetailerPicker] = useState(false);
  const [retailerSearch, setRetailerSearch] = useState("");

  // Catalogue & Cart State
  const [catalogue, setCatalogue] = useState<CachedCatalogueItem[]>([]);
  const [catalogueSearch, setCatalogueSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [customerNote, setCustomerNote] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);

  // AI Order Tools State
  const [aiTextModalOpen, setAiTextModalOpen] = useState(false);
  const [aiTextMessage, setAiTextMessage] = useState("");
  const [aiProcessing, setAiProcessing] = useState(false);
  const [isScanningPhoto, setIsScanningPhoto] = useState(false);
  const [parchiPreviewUrl, setParchiPreviewUrl] = useState<string | null>(null);
  const [parchiModalOpen, setParchiModalOpen] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History State
  const [orderHistory, setOrderHistory] = useState<SalesmanOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // 1. Online / Offline Listener
  useEffect(() => {
    document.title = "Salesman Field Beat Portal | Orderly";
    setIsOnline(navigator.onLine);
    setOfflineQueue(getOfflineQueue());

    const handleOnline = () => {
      setIsOnline(true);
      void syncPendingQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 2. Authenticate user
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

  // 3. Load retailers, catalogue, and history
  const loadPortalData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const cached = getCachedCatalogue();
      if (cached.items.length > 0) {
        setCatalogue(cached.items);
      }

      if (navigator.onLine) {
        const [retailersRes, catalogueRes, historyRes] = await Promise.all([
          apiRequest<{ items: RetailerOption[]; total: number }>("/salesman/retailers"),
          apiRequest<{ items: CachedCatalogueItem[]; total: number }>("/salesman/catalogue"),
          apiRequest<{ items: SalesmanOrder[]; total: number }>("/salesman/orders"),
        ]);

        const fetchedRetailers = retailersRes.items || [];
        setRetailers(fetchedRetailers);
        setSelectedRetailer((prev) => prev || (fetchedRetailers.length > 0 ? fetchedRetailers[0] : null));

        const freshCatalogue = catalogueRes.items || [];
        setCatalogue(freshCatalogue);
        saveCachedCatalogue(freshCatalogue);

        setOrderHistory(historyRes.items || []);
      }
    } catch (err) {
      const cached = getCachedCatalogue();
      if (cached.items.length > 0) {
        setCatalogue(cached.items);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load catalogue.");
      }
    } finally {
      setLoading(false);
      setOfflineQueue(getOfflineQueue());
    }
  }, []);

  useEffect(() => {
    if (profile && ALLOWED_ROLES.has(profile.role)) {
      void loadPortalData();
    }
  }, [profile, loadPortalData]);

  // 4. Quantity Adjustments
  const handleQuantityChange = (productId: string, delta: number) => {
    setCartQuantities((prev) => {
      const current = prev[productId] || 0;
      const updated = Math.max(0, current + delta);
      if (updated === 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: updated };
    });
  };

  const handleSetQuantity = (productId: string, val: string) => {
    const num = parseInt(val, 10);
    setCartQuantities((prev) => {
      if (isNaN(num) || num <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: num };
    });
  };

  // Cart Totals
  const cartEntries = Object.entries(cartQuantities);
  const totalCases = cartEntries.reduce((acc, [, qty]) => acc + qty, 0);

  const estimatedSubtotal = cartEntries.reduce((acc, [prodId, qty]) => {
    const prod = catalogue.find((p) => p.id === prodId);
    const casePrice = prod ? prod.price * prod.units_per_case : 0;
    return acc + casePrice * qty;
  }, 0);

  // 5. Submit Order
  const handleSubmitOrder = async () => {
    if (!selectedRetailer || cartEntries.length === 0) return;
    setSubmittingOrder(true);
    setError(null);

    const idempotencyKey = `sls_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const orderPayload = {
      retailer_id: selectedRetailer.id,
      items: cartEntries.map(([productId, quantity]) => ({
        product_id: productId,
        quantity,
        quantity_unit: "CASE" as const,
      })),
      customer_note: customerNote || null,
      idempotency_key: idempotencyKey,
    };

    if (!navigator.onLine) {
      const queuedItem: QueuedOrder = {
        idempotency_key: idempotencyKey,
        retailer_id: selectedRetailer.id,
        shop_name: selectedRetailer.shop_name,
        items: cartEntries.map(([productId, quantity]) => {
          const prod = catalogue.find((p) => p.id === productId);
          return {
            product_id: productId,
            product_name: prod ? prod.name : "SKU",
            sku: prod ? prod.sku : "",
            quantity,
            quantity_unit: "CASE",
            price: prod ? prod.price * prod.units_per_case : 0,
          };
        }),
        customer_note: customerNote || null,
        estimated_total: estimatedSubtotal,
        queued_at: new Date().toISOString(),
      };

      queueOfflineOrder(queuedItem);
      setOfflineQueue(getOfflineQueue());
      setCartQuantities({});
      setCustomerNote("");
      setShowReviewModal(false);
      setSubmittingOrder(false);
      setFeedback("Order saved to Offline Queue. Will sync automatically when connected.");
      setTimeout(() => setFeedback(null), 5000);
      return;
    }

    try {
      const res = await apiRequest<{ order_number: string; message: string }>(
        "/salesman/orders",
        {
          method: "POST",
          body: JSON.stringify(orderPayload),
        }
      );

      setCartQuantities({});
      setCustomerNote("");
      setShowReviewModal(false);
      setFeedback(`Order ${res.order_number} booked successfully for ${selectedRetailer.shop_name}!`);
      setTimeout(() => setFeedback(null), 5000);
      void loadPortalData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order.");
    } finally {
      setSubmittingOrder(false);
    }
  };

  // 6. Sync Pending Offline Queue
  const syncPendingQueue = async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0 || syncing) return;
    setSyncing(true);
    setError(null);

    try {
      const payload = {
        orders: queue.map((q) => ({
          retailer_id: q.retailer_id,
          items: q.items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            quantity_unit: i.quantity_unit,
          })),
          customer_note: q.customer_note,
          idempotency_key: q.idempotency_key,
        })),
      };

      const res = await apiRequest<{
        synced_count: number;
        failed_count: number;
        synced: Array<{ order_number: string }>;
      }>("/salesman/orders/sync", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      clearOfflineQueue();
      setOfflineQueue([]);
      setFeedback(`Synced ${res.synced_count} offline beat orders to Order Desk!`);
      setTimeout(() => setFeedback(null), 4000);
      void loadPortalData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync offline orders.");
    } finally {
      setSyncing(false);
    }
  };

  // 7. AI Photo Parchi OCR Scan
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setParchiPreviewUrl(preview);

    try {
      setIsScanningPhoto(true);
      setError(null);
      setFeedback("Scanning parchi photo with Gemini Vision AI...");

      const formData = new FormData();
      formData.append("file", file);
      if (selectedRetailer) {
        formData.append("retailer_id", selectedRetailer.id);
      }

      const res = await apiRequest<AIChatResponse>("/assistant/scan-parchi", {
        method: "POST",
        body: formData,
      });

      let addedCount = 0;
      if (res && res.cart_actions && res.cart_actions.length > 0) {
        setCartQuantities((prev) => {
          const next = { ...prev };
          res.cart_actions!.forEach((action) => {
            if (action.product_id) {
              const current = next[action.product_id] || 0;
              next[action.product_id] = current + (action.quantity || 1);
              addedCount++;
            }
          });
          return next;
        });
        setFeedback(res.reply || `AI added ${addedCount} items from the order slip to your cart!`);
      } else if (res && res.reply) {
        setFeedback(res.reply);
      } else {
        setFeedback("Photo scanned, but could not match items to catalogue. Please review manually.");
      }
      setTimeout(() => setFeedback(null), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan parchi photo.");
    } finally {
      setIsScanningPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 8. AI Quick Text Order Parse
  const handleAiTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTextMessage.trim()) return;

    try {
      setAiProcessing(true);
      setError(null);

      const res = await apiRequest<AIChatResponse>("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({
          message: aiTextMessage.trim(),
          retailer_id: selectedRetailer?.id || null,
        }),
      });

      let addedCount = 0;
      if (res && res.cart_actions && res.cart_actions.length > 0) {
        setCartQuantities((prev) => {
          const next = { ...prev };
          res.cart_actions!.forEach((action) => {
            if (action.action === "CLEAR") {
              // clear cart
            } else if (action.action === "REMOVE") {
              if (action.product_id) delete next[action.product_id];
            } else {
              if (action.product_id) {
                const current = next[action.product_id] || 0;
                next[action.product_id] = current + (action.quantity || 1);
                addedCount++;
              }
            }
          });
          return next;
        });
        setFeedback(res.reply || `AI added ${addedCount} items to your cart!`);
        setAiTextModalOpen(false);
        setAiTextMessage("");
      } else if (res && res.reply) {
        setFeedback(res.reply);
        setAiTextModalOpen(false);
        setAiTextMessage("");
      } else {
        setError("AI could not match items. Try e.g. '5 case Fortune Oil, 10 packet Tide'.");
      }
      setTimeout(() => setFeedback(null), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process text order.");
    } finally {
      setAiProcessing(false);
    }
  };

  // 9. Voice Note Capture (Web Speech API)
  const handleVoiceOrder = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice speech is not supported in this browser. Please use text order instead.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "hi-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListeningVoice(true);
        setFeedback("Listening... Speak items e.g. 'पाँच केस फॉर्च्यून तेल और दस पैकेट सर्फ एक्सेल'");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListeningVoice(false);
        setAiTextMessage(transcript);
        setAiTextModalOpen(true);
        setFeedback(`Captured: "${transcript}". Review and confirm.`);
      };

      recognition.onerror = () => {
        setIsListeningVoice(false);
        setError("Could not capture speech. Please try speaking clearly or use text.");
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      recognition.start();
    } catch (err) {
      setIsListeningVoice(false);
      setError("Microphone permission or recognition error.");
    }
  };

  // Share order via WhatsApp
  const shareOrderOnWhatsApp = (order: SalesmanOrder) => {
    const text = `*Orderly FMCG Beat Order*\nOrder: ${order.order_number}\nShop: ${order.shop_name}\nAmount: ${formatCurrency(order.total_amount)}\nStatus: ${order.status}\nThank you!`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-[6px] border border-[#E7E6E0] bg-white p-6 shadow-2xs text-center space-y-3">
          <div className="h-8 w-8 mx-auto animate-pulse rounded-full bg-[#E7E6E0]" />
          <p className="text-xs font-semibold text-[#242724]">
            Connecting to Salesman Field Beat...
          </p>
        </div>
      </div>
    );
  }

  if (!user || !profile || !ALLOWED_ROLES.has(profile.role)) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-[6px] border border-[#E7E6E0] bg-white p-6 text-center shadow-2xs space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F4EFF0] text-[#79565D]">
            <Store size={22} />
          </div>
          <h1 className="text-base font-bold text-[#242724]">Salesman Portal</h1>
          <p className="text-xs text-[#666864]">
            Authorized Salesmen and Distributor Administrators may access the field beat portal.
          </p>
          <Link
            href="/register"
            className="inline-block rounded-[4px] bg-[#79565D] px-5 py-2 text-xs font-semibold text-white"
          >
            Sign In with Salesman Account
          </Link>
        </div>
      </div>
    );
  }

  // Filter Categories
  const categories = ["ALL", ...Array.from(new Set(catalogue.map((p) => p.category).filter(Boolean)))];

  // Filter Products
  const filteredCatalogue = catalogue.filter((p) => {
    const matchesCat = selectedCategory === "ALL" || p.category === selectedCategory;
    const term = catalogueSearch.toLowerCase().trim();
    const matchesSearch =
      !term ||
      p.sku.toLowerCase().includes(term) ||
      p.name.toLowerCase().includes(term) ||
      p.brand_name.toLowerCase().includes(term);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#F6F5F1] text-[#242724] pb-28">
      {/* 1. Ultra-Clean Top Bar */}
      <header className="sticky top-0 z-40 border-b border-[#E7E6E0] bg-white px-4 py-2.5 shadow-2xs">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#242724] text-white">
              <Store size={14} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-[#242724]">
                  orderly<span className="text-[#79565D]">.beat</span>
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    isOnline
                      ? "bg-[#EEF6F1] text-[#205234]"
                      : "bg-[#FCF6EC] text-[#7A4E12]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isOnline ? "bg-[#205234]" : "bg-[#7A4E12]"
                    }`}
                  />
                  {isOnline ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {offlineQueue.length > 0 && (
              <button
                onClick={syncPendingQueue}
                disabled={!isOnline || syncing}
                className="rounded-[4px] bg-[#7A4E12] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#633e0e] transition-colors"
              >
                {syncing ? "Syncing..." : `Sync (${offlineQueue.length})`}
              </button>
            )}

            {profile.role === "DISTRIBUTOR_ADMIN" && (
              <Link
                href="/distributor"
                className="rounded-[4px] border border-[#79565D] bg-[#F4EFF0] px-2.5 py-1 text-[11px] font-semibold text-[#79565D] hover:bg-[#eedfe2]"
              >
                Distributor Console
              </Link>
            )}

            <button
              onClick={async () => {
                await logout();
                router.replace("/register");
              }}
              className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[#E7E6E0] text-[#666864] hover:bg-[#FAF9F6]"
              title="Sign Out"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>

        {/* Tab Switcher: Order Booking vs Beat History */}
        <div className="mx-auto max-w-4xl mt-2 flex border-t border-[#F0EFEA] pt-2 text-xs">
          <button
            onClick={() => setActiveTab("ORDERING")}
            className={`flex-1 py-1.5 text-center font-bold transition-colors border-b-2 ${
              activeTab === "ORDERING"
                ? "border-[#79565D] text-[#79565D]"
                : "border-transparent text-[#969892] hover:text-[#242724]"
            }`}
          >
            Take Shop Order
          </button>
          <button
            onClick={() => setActiveTab("HISTORY")}
            className={`flex-1 py-1.5 text-center font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === "HISTORY"
                ? "border-[#79565D] text-[#79565D]"
                : "border-transparent text-[#969892] hover:text-[#242724]"
            }`}
          >
            <span>Beat Orders</span>
            {orderHistory.length > 0 && (
              <span className="rounded-full bg-[#E7E6E0] px-1.5 text-[10px]">
                {orderHistory.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto max-w-4xl p-3 sm:p-4 space-y-4">
        {/* Alerts & Feedback */}
        {feedback && (
          <div className="rounded-[4px] border border-[#BCE2CD] bg-[#F0F9F4] p-3 text-xs text-[#205234] flex items-center gap-2">
            <CheckCircle2 size={15} />
            <span>{feedback}</span>
          </div>
        )}

        {error && (
          <div className="rounded-[4px] border border-[#EDBCBC] bg-[#FBF0F0] p-3 text-xs text-[#8C2828] flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold ml-2">
              <X size={13} />
            </button>
          </div>
        )}

        {activeTab === "ORDERING" ? (
          <>
            {/* 2. Selected Kirana Banner */}
            <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-[#242724]">
                      {selectedRetailer ? selectedRetailer.shop_name : "Select Kirana Store"}
                    </span>
                    {selectedRetailer && (
                      <span className="rounded bg-[#FAF9F6] border border-[#E7E6E0] px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#666864]">
                        {selectedRetailer.retailer_code}
                      </span>
                    )}
                  </div>
                  {selectedRetailer && (
                    <p className="text-xs text-[#666864] flex items-center gap-1.5">
                      <MapPin size={12} className="text-[#79565D]" />
                      <span>{selectedRetailer.owner_name} · {selectedRetailer.address}, {selectedRetailer.city}</span>
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowRetailerPicker(true)}
                  className="rounded-[4px] border border-[#79565D] bg-[#F4EFF0] px-3 py-1.5 text-xs font-bold text-[#79565D] hover:bg-[#eedfe2] transition-colors shrink-0 flex items-center gap-1"
                >
                  <span>Switch Shop</span>
                  <ChevronDown size={13} />
                </button>
              </div>

              {/* Credit Bounds Pills */}
              {selectedRetailer && (
                <div className="grid grid-cols-3 gap-2 border-t border-[#F0EFEA] pt-3 text-xs">
                  <div className="rounded-[4px] bg-[#FAF9F6] p-2 border border-[#E7E6E0]">
                    <span className="text-[10px] font-bold uppercase text-[#969892]">Available Credit</span>
                    <p className="font-bold text-[#205234] text-sm mt-0.5">
                      {formatCurrency(selectedRetailer.available_credit)}
                    </p>
                  </div>
                  <div className="rounded-[4px] bg-[#FAF9F6] p-2 border border-[#E7E6E0]">
                    <span className="text-[10px] font-bold uppercase text-[#969892]">Outstanding</span>
                    <p className="font-bold text-[#242724] text-sm mt-0.5">
                      {formatCurrency(selectedRetailer.current_outstanding)}
                    </p>
                  </div>
                  <div className="rounded-[4px] bg-[#FAF9F6] p-2 border border-[#E7E6E0]">
                    <span className="text-[10px] font-bold uppercase text-[#969892]">Terms</span>
                    <p className="font-bold text-[#666864] text-sm mt-0.5">
                      {selectedRetailer.payment_terms_days} Days
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 3. AI Fast Order Capture Bar */}
            <div className="rounded-[6px] border border-[#79565D]/30 bg-gradient-to-r from-[#FAF6F7] to-white p-3 shadow-2xs space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#79565D]">
                <Sparkles size={14} />
                <span>AI Instant Order Capture (सुपर फास्ट आर्डर)</span>
              </div>
              <p className="text-[11px] text-[#666864]">
                Photo snap, text paste, or voice note se items turant cart me add karein:
              </p>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {/* 1. Photo Parchi Scan */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScanningPhoto}
                  className="flex flex-col items-center justify-center gap-1 rounded-[4px] border border-[#E7E6E0] bg-white p-2.5 text-center hover:border-[#79565D] hover:bg-[#F4EFF0] transition-colors shadow-2xs"
                >
                  <Camera size={18} className="text-[#79565D]" />
                  <span className="text-xs font-bold text-[#242724]">
                    {isScanningPhoto ? "Scanning..." : "📷 पर्ची Photo"}
                  </span>
                  <span className="text-[9px] text-[#969892]">Handwritten OCR</span>
                </button>

                {/* 2. Text / WhatsApp List */}
                <button
                  type="button"
                  onClick={() => setAiTextModalOpen(true)}
                  className="flex flex-col items-center justify-center gap-1 rounded-[4px] border border-[#E7E6E0] bg-white p-2.5 text-center hover:border-[#79565D] hover:bg-[#F4EFF0] transition-colors shadow-2xs"
                >
                  <FileText size={18} className="text-[#1E4B72]" />
                  <span className="text-xs font-bold text-[#242724]">📝 Text Order</span>
                  <span className="text-[9px] text-[#969892]">WhatsApp List</span>
                </button>

                {/* 3. Voice Note */}
                <button
                  type="button"
                  onClick={handleVoiceOrder}
                  disabled={isListeningVoice}
                  className={`flex flex-col items-center justify-center gap-1 rounded-[4px] border p-2.5 text-center transition-colors shadow-2xs ${
                    isListeningVoice
                      ? "border-red-400 bg-red-50 text-red-700 animate-pulse"
                      : "border-[#E7E6E0] bg-white hover:border-[#79565D] hover:bg-[#F4EFF0]"
                  }`}
                >
                  <Mic size={18} className={isListeningVoice ? "text-red-600" : "text-[#205234]"} />
                  <span className="text-xs font-bold text-[#242724]">
                    {isListeningVoice ? "बोलिये..." : "🎙️ बोल कर"}
                  </span>
                  <span className="text-[9px] text-[#969892]">Hindi / English</span>
                </button>
              </div>
            </div>

            {/* 4. Catalogue Browser & Search */}
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#969892]"
                />
                <input
                  type="text"
                  placeholder="Search brand, product, SKU (e.g. Fortune, Tide, Soap)..."
                  value={catalogueSearch}
                  onChange={(e) => setCatalogueSearch(e.target.value)}
                  className="w-full h-10 rounded-[6px] border border-[#E7E6E0] bg-white pl-9 pr-8 text-xs text-[#242724] focus:border-[#79565D] focus:outline-none shadow-2xs"
                />
                {catalogueSearch && (
                  <button
                    onClick={() => setCatalogueSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#969892] hover:text-[#242724]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-full px-3 py-1 font-semibold whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? "bg-[#242724] text-white"
                        : "bg-white border border-[#E7E6E0] text-[#666864] hover:bg-[#FAF9F6]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Product Cards List */}
              <div className="space-y-2.5">
                {filteredCatalogue.length === 0 ? (
                  <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-8 text-center text-xs text-[#969892]">
                    No products found matching your search.
                  </div>
                ) : (
                  filteredCatalogue.map((product) => {
                    const quantity = cartQuantities[product.id] || 0;
                    const casePrice = product.price * product.units_per_case;

                    return (
                      <div
                        key={product.id}
                        className={`rounded-[6px] border bg-white p-3.5 shadow-2xs transition-all ${
                          quantity > 0 ? "border-[#79565D] ring-1 ring-[#79565D]/30" : "border-[#E7E6E0]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#969892]">
                                {product.brand_name}
                              </span>
                              <span className="text-[#E7E6E0]">·</span>
                              <span className="font-mono text-[10px] text-[#666864]">
                                {product.sku}
                              </span>
                            </div>

                            <h3 className="font-bold text-sm text-[#242724]">
                              {product.name}
                            </h3>

                            <p className="text-xs text-[#666864]">
                              Pack: {product.pack_size || "Standard"} ·{" "}
                              <span className="font-semibold text-[#242724]">
                                {product.units_per_case} pcs/case
                              </span>
                            </p>

                            {/* Wholesale Rate */}
                            <div className="pt-1 flex items-baseline gap-2">
                              <span className="font-bold text-sm text-[#205234]">
                                {formatCurrency(casePrice)}
                                <span className="text-[10px] font-normal text-[#666864]">/case</span>
                              </span>
                              <span className="text-[11px] text-[#969892]">
                                ({formatCurrency(product.price)}/pc)
                              </span>
                            </div>
                          </div>

                          {/* Large Touch Stepper */}
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <div className="flex items-center rounded-[4px] border border-[#E7E6E0] bg-[#FAF9F6]">
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(product.id, -1)}
                                className="flex h-9 w-9 items-center justify-center text-[#242724] hover:bg-[#E7E6E0] active:scale-95 transition-transform"
                                aria-label="Decrease quantity"
                              >
                                <Minus size={15} />
                              </button>

                              <input
                                type="number"
                                min="0"
                                value={quantity || ""}
                                onChange={(e) => handleSetQuantity(product.id, e.target.value)}
                                placeholder="0"
                                className="h-9 w-12 border-x border-[#E7E6E0] bg-white text-center font-bold text-sm text-[#242724] focus:outline-none"
                              />

                              <button
                                type="button"
                                onClick={() => handleQuantityChange(product.id, 1)}
                                className="flex h-9 w-9 items-center justify-center text-[#242724] hover:bg-[#E7E6E0] active:scale-95 transition-transform"
                                aria-label="Increase quantity"
                              >
                                <Plus size={15} />
                              </button>
                            </div>

                            {quantity > 0 && (
                              <span className="text-[11px] font-bold text-[#79565D]">
                                Subtotal: {formatCurrency(casePrice * quantity)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        ) : (
          /* 5. Beat History Tab */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm text-[#242724]">
                Today's Booked Orders ({orderHistory.length})
              </h2>
              <button
                onClick={() => loadPortalData()}
                className="text-xs font-semibold text-[#79565D] hover:underline flex items-center gap-1"
              >
                <RefreshCw size={12} />
                <span>Refresh</span>
              </button>
            </div>

            {orderHistory.length === 0 ? (
              <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-8 text-center text-xs text-[#969892]">
                No orders booked today yet. Select a kirana store and take your first beat order.
              </div>
            ) : (
              <div className="space-y-2.5">
                {orderHistory.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-[6px] border border-[#E7E6E0] bg-white p-4 shadow-2xs space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-[#242724]">
                            {order.order_number}
                          </span>
                          <Badge
                            variant={
                              order.status === "APPROVED" || order.status === "DISPATCHED"
                                ? "success"
                                : order.status === "ON_HOLD"
                                ? "danger"
                                : "info"
                            }
                          >
                            {order.status}
                          </Badge>
                        </div>
                        <p className="font-semibold text-sm text-[#242724] mt-1">
                          {order.shop_name}
                        </p>
                        <p className="text-[11px] text-[#969892]">
                          Time: {formatDate(order.created_at)} · {order.items_count} items
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-base text-[#205234]">
                          {formatCurrency(order.total_amount)}
                        </span>
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => shareOrderOnWhatsApp(order)}
                            className="inline-flex items-center gap-1 rounded bg-[#EEF6F1] px-2 py-0.5 text-[10px] font-bold text-[#205234] hover:bg-[#d8eedf]"
                          >
                            <Share2 size={10} />
                            <span>WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. Floating Cart Bottom Bar */}
      {activeTab === "ORDERING" && totalCases > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 border-t border-[#E7E6E0] bg-white/95 backdrop-blur-md p-3 sm:p-4 shadow-lg">
          <div className="mx-auto max-w-4xl flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#969892]">
                Active Cart ({cartEntries.length} Items)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-lg text-[#205234]">
                  {formatCurrency(estimatedSubtotal)}
                </span>
                <span className="text-xs font-semibold text-[#666864]">
                  ({totalCases} Cases)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCartQuantities({})}
                className="rounded-[4px] border border-[#E7E6E0] p-2 text-[#969892] hover:text-[#8C2828] hover:bg-[#FAF9F6]"
                title="Clear Cart"
              >
                <Trash2 size={16} />
              </button>

              <button
                type="button"
                onClick={() => setShowReviewModal(true)}
                className="rounded-[4px] bg-[#205234] px-5 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-[#183f28] active:scale-98 transition-transform flex items-center gap-1.5"
              >
                <span>Book Order Now</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Switch Kirana Store Bottom Sheet / Modal */}
      {showRetailerPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setShowRetailerPicker(false)}
          />
          <div className="relative w-full max-w-lg rounded-t-xl sm:rounded-lg border border-[#E7E6E0] bg-white p-4 shadow-2xl z-10 max-h-[80vh] flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-[#F0EFEA] pb-2">
              <div className="flex items-center gap-2">
                <Store size={18} className="text-[#79565D]" />
                <h3 className="font-bold text-sm text-[#242724]">
                  Select Kirana on Your Beat ({retailers.length})
                </h3>
              </div>
              <button
                onClick={() => setShowRetailerPicker(false)}
                className="p-1 text-[#969892] hover:text-[#242724]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#969892]"
              />
              <input
                type="text"
                placeholder="Search shop name, owner, city or code..."
                value={retailerSearch}
                onChange={(e) => setRetailerSearch(e.target.value)}
                className="w-full h-9 rounded-[4px] border border-[#E7E6E0] pl-9 pr-3 text-xs text-[#242724] focus:border-[#79565D] focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#F0EFEA] border border-[#E7E6E0] rounded-[4px]">
              {retailers
                .filter((r) => {
                  if (!retailerSearch.trim()) return true;
                  const q = retailerSearch.toLowerCase();
                  return (
                    r.shop_name.toLowerCase().includes(q) ||
                    r.retailer_code.toLowerCase().includes(q) ||
                    r.owner_name.toLowerCase().includes(q) ||
                    r.city.toLowerCase().includes(q)
                  );
                })
                .map((r) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      setSelectedRetailer(r);
                      setShowRetailerPicker(false);
                    }}
                    className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${
                      selectedRetailer?.id === r.id
                        ? "bg-[#F4EFF0] font-bold"
                        : "hover:bg-[#FAF9F6]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#242724]">
                          {r.shop_name}
                        </span>
                        <span className="font-mono text-[10px] text-[#666864]">
                          {r.retailer_code}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#666864] mt-0.5">
                        {r.owner_name} · {r.city} · Limit: {formatCurrency(r.credit_limit)}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-[#205234]">
                        {formatCurrency(r.available_credit)}
                      </span>
                      <p className="text-[9px] text-[#969892]">Available</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 8. AI Quick Text Order Modal */}
      {aiTextModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setAiTextModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-lg border border-[#E7E6E0] bg-white p-5 shadow-2xl z-10 space-y-4">
            <div className="flex items-center justify-between border-b border-[#F0EFEA] pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#79565D]">
                <Sparkles size={16} />
                <span>Quick WhatsApp / Text Order</span>
              </div>
              <button
                onClick={() => setAiTextModalOpen(false)}
                className="p-1 text-[#969892] hover:text-[#242724]"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAiTextSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#242724] mb-1">
                  Order Text (Paste list from WhatsApp or voice):
                </label>
                <textarea
                  rows={4}
                  value={aiTextMessage}
                  onChange={(e) => setAiTextMessage(e.target.value)}
                  placeholder="e.g. 5 case Fortune Oil 1L, 10 packet Tide 500g, 2 case Maggi"
                  className="w-full rounded-[4px] border border-[#E7E6E0] p-2.5 text-xs text-[#242724] focus:border-[#79565D] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#F0EFEA]">
                <button
                  type="button"
                  onClick={() => setAiTextModalOpen(false)}
                  className="rounded-[4px] border border-[#E7E6E0] px-3 py-1.5 text-xs font-semibold text-[#666864]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={aiProcessing || !aiTextMessage.trim()}
                  className="rounded-[4px] bg-[#79565D] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#67474E] disabled:opacity-50"
                >
                  {aiProcessing ? "Parsing AI..." : "Add to Cart"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Order Review & Confirmation Modal */}
      {showReviewModal && selectedRetailer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setShowReviewModal(false)}
          />
          <div className="relative w-full max-w-md rounded-lg border border-[#E7E6E0] bg-white p-5 shadow-2xl z-10 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-[#F0EFEA] pb-3">
              <div>
                <h3 className="font-bold text-base text-[#242724]">Confirm Beat Order</h3>
                <p className="text-xs text-[#666864]">{selectedRetailer.shop_name}</p>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="p-1 text-[#969892] hover:text-[#242724]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Line Items List */}
            <div className="divide-y divide-[#F0EFEA] border border-[#E7E6E0] rounded-[4px] p-2.5 max-h-48 overflow-y-auto text-xs">
              {cartEntries.map(([productId, quantity]) => {
                const p = catalogue.find((item) => item.id === productId);
                if (!p) return null;
                const casePrice = p.price * p.units_per_case;
                return (
                  <div key={productId} className="py-2 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-[#242724]">{p.name}</p>
                      <p className="text-[10px] text-[#969892]">
                        {quantity} cases ({quantity * p.units_per_case} pcs) × {formatCurrency(casePrice)}/case
                      </p>
                    </div>
                    <span className="font-bold text-[#242724]">
                      {formatCurrency(casePrice * quantity)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Delivery Note */}
            <div>
              <label className="block text-xs font-semibold text-[#242724] mb-1">
                Delivery / Beat Note (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Deliver before 2 PM, urgent stock"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                className="w-full h-8 rounded-[4px] border border-[#E7E6E0] px-3 text-xs text-[#242724] focus:border-[#79565D] focus:outline-none"
              />
            </div>

            {/* Total Summary */}
            <div className="rounded-[4px] border border-[#E7E6E0] bg-[#FAF9F6] p-3 space-y-1 text-xs">
              <div className="flex justify-between font-bold text-sm text-[#242724]">
                <span>Total Amount:</span>
                <span className="text-[#205234]">{formatCurrency(estimatedSubtotal)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-[#666864]">
                <span>Available Credit:</span>
                <span className="font-bold text-[#205234]">
                  {formatCurrency(selectedRetailer.available_credit)}
                </span>
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#F0EFEA]">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="rounded-[4px] border border-[#E7E6E0] px-4 py-2 text-xs font-semibold text-[#666864]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitOrder}
                disabled={submittingOrder}
                className="rounded-[4px] bg-[#205234] px-5 py-2 text-xs font-bold text-white hover:bg-[#183f28] disabled:opacity-50"
              >
                {submittingOrder
                  ? "Booking Order..."
                  : isOnline
                  ? "Book Order Now"
                  : "Save to Offline Queue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Parchi Thumbnail Floating Pill */}
      {parchiPreviewUrl && (
        <div className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-2xl border border-[#79565D]/30 bg-white p-2 shadow-xl">
          <div
            onClick={() => setParchiModalOpen(true)}
            className="size-12 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-[#E7E6E0] bg-[#F6F5F1]"
            title="Click to view full slip"
          >
            <img src={parchiPreviewUrl} alt="Parchi" className="size-full object-cover" />
          </div>
          <div className="text-xs pr-1">
            <p className="font-bold text-[#242724]">Parchi Scanned</p>
            <button
              type="button"
              onClick={() => setParchiModalOpen(true)}
              className="text-[11px] text-[#79565D] font-medium hover:underline"
            >
              View Slip
            </button>
          </div>
          <button
            type="button"
            onClick={() => setParchiPreviewUrl(null)}
            className="flex size-6 items-center justify-center rounded-full text-[#969892] hover:bg-[#F0EFEA] hover:text-[#242724]"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Salesman Parchi Full Modal */}
      {parchiModalOpen && parchiPreviewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onClick={() => setParchiModalOpen(false)}
        >
          <div
            className="relative max-h-[90vh] max-w-lg overflow-hidden rounded-2xl bg-white p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between border-b border-[#E7E6E0] pb-2">
              <span className="text-xs font-bold text-[#242724]">Scanned Order Slip</span>
              <button
                type="button"
                onClick={() => setParchiModalOpen(false)}
                className="flex size-7 items-center justify-center rounded-full text-[#666864] hover:bg-[#F0EFEA]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto rounded-lg bg-[#F6F5F1]">
              <img src={parchiPreviewUrl} alt="Order Slip" className="h-auto w-full object-contain" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
