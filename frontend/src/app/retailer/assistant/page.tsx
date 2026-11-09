"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Camera,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Mic,
  MicOff,
  Minus,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { useAIAssistant } from "@/contexts/ai-assistant-context";
import { AssistantProductCard } from "@/components/ai-assistant/product-card";
import {
  clearCart,
  getCart,
  getCartItemCount,
  getCartSubtotal,
  removeFromCart,
  updateCartQuantity,
  type CartItem,
  type QuantityUnit,
} from "@/lib/cart";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function RetailerAssistantPage() {
  const router = useRouter();
  const {
    messages,
    isLoading,
    activeClarification,
    pendingOptions,
    sendMessage,
    scanParchi,
    confirmOrder,
    updateDraftQuantity,
    removeDraftItem,
    resetSession,
    isOrderConfirmed,
    createdOrderId,
    clearConfirmation,
  } = useAIAssistant();

  const [inputText, setInputText] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [cartSubtotal, setCartSubtotal] = useState(0);
  const [mobileTab, setMobileTab] = useState<"chat" | "draft">("chat");
  const [isListening, setIsListening] = useState(false);
  const speechRecognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Kirana AI Assistant & Parchi Scanner | Orderly";
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      scanParchi(file);
      e.target.value = "";
    }
  };

  const toggleListening = () => {
    if (isListening) {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    if (typeof window === "undefined") return;
    const SpeechRec = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRec) {
      alert("Aapke browser me voice recognition support nahi hai.");
      return;
    }

    const recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "hi-IN";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript.trim()) {
        setInputText(transcript);
      }
    };

    recognition.onerror = (e: any) => {
      console.warn("Speech error:", e.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    speechRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  useEffect(() => {
    const onSpeakingStart = () => {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch {}
      }
      setIsListening(false);
    };

    window.addEventListener("orderly-ai-speaking-start", onSpeakingStart);
    return () => {
      window.removeEventListener("orderly-ai-speaking-start", onSpeakingStart);
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronize cart state
  const syncCart = () => {
    const items = getCart();
    setCartItems(items);
    setCartCount(getCartItemCount());
    setCartSubtotal(getCartSubtotal());
  };

  useEffect(() => {
    syncCart();
    window.addEventListener("orderly-cart-updated", syncCart);
    window.addEventListener("storage", syncCart);

    return () => {
      window.removeEventListener("orderly-cart-updated", syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  // Auto-scroll chat to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle text message submission
  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = inputText.trim();
    if (!clean || isLoading) return;

    setInputText("");
    await sendMessage(clean);
  };

  // Quick prompt chip click
  const handlePromptClick = async (prompt: string) => {
    if (isLoading) return;
    await sendMessage(prompt);
  };

  // Explicit confirmation button action
  const handleExplicitConfirm = async () => {
    if (cartItems.length === 0 || isLoading || isConfirming) return;
    setIsConfirming(true);
    setConfirmationNotice(null);
    try {
      await confirmOrder();
      syncCart();
    } catch (err) {
      setConfirmationNotice(
        err instanceof Error ? err.message : "Order confirm karne me problem aayi."
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const quickPrompts = [
    "Red Label 500g 2 case",
    "Tata Salt 1 case",
    "Cart me kya hai?",
    "Pehla wala hata do",
    "Order confirm karo",
  ];

  return (
    <div className="flex h-[calc(100vh-56px)] w-full flex-col bg-[#F6F5F1] text-[#242724]">
      {/* Top Banner & Control Bar */}
      <header className="border-b border-[#E7E6E0] bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#79565D,#9C7683)] text-white shadow-2xs">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#242724]">
                  Kirana AI Ordering Assistant
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#4E8962]/10 px-2 py-0.5 text-[11px] font-semibold text-[#4E8962]">
                  <span className="size-1.5 rounded-full bg-[#4E8962]" />
                  Active
                </span>
              </div>
              <p className="text-xs text-[#666864]">
                Order products in Hindi, English, or Hinglish · Deterministic Catalogue Verification
              </p>
            </div>
          </div>

          {/* Action Buttons & Mobile Tabs */}
          <div className="flex items-center gap-2">
            {/* Mobile Tab Switcher */}
            <div className="flex rounded-md border border-[#E7E6E0] bg-[#F6F5F1] p-0.5 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileTab("chat")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                  mobileTab === "chat"
                    ? "bg-white text-[#242724] shadow-2xs"
                    : "text-[#666864] hover:text-[#242724]"
                }`}
              >
                <Bot size={13} />
                Chat
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("draft")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                  mobileTab === "draft"
                    ? "bg-white text-[#79565D] shadow-2xs"
                    : "text-[#666864] hover:text-[#242724]"
                }`}
              >
                <ShoppingCart size={13} />
                Draft ({cartCount})
              </button>
            </div>

            {/* Reset Session Button */}
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Kya aap conversation aur draft reset karna chahte hain?")) {
                  resetSession();
                  clearConfirmation();
                }
              }}
              title="Reset Dialogue History"
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-md border border-[#E7E6E0] bg-white px-3 py-1.5 text-xs font-medium text-[#666864] transition-colors hover:bg-[#F6F5F1] hover:text-[#242724] disabled:opacity-50"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">Reset Dialogue</span>
            </button>

            {/* Catalogue Link */}
            <Link
              href="/retailer/catalogue"
              className="flex items-center gap-1.5 rounded-md border border-[#E7E6E0] bg-white px-3 py-1.5 text-xs font-medium text-[#666864] transition-colors hover:bg-[#F6F5F1] hover:text-[#242724]"
            >
              <Package size={14} />
              <span className="hidden sm:inline">Catalogue</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Side: Conversation Workspace (Chat Stream & Input) */}
        <section
          className={`flex min-h-0 flex-1 flex-col border-r border-[#E7E6E0] bg-[#F6F5F1] ${
            mobileTab === "draft" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Messages Scroll Area */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            {/* Conversation Messages */}
            {messages.map((msg, idx) => {
              const isUser = msg.role === "user";

              return (
                <div
                  key={msg.id || idx}
                  className={`flex items-start gap-3 ${
                    isUser ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {/* Avatar Icon */}
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      isUser
                        ? "bg-[#242724] text-white"
                        : "bg-[linear-gradient(135deg,#79565D,#9C7683)] text-white shadow-2xs"
                    }`}
                  >
                    {isUser ? <User size={14} /> : <Sparkles size={14} />}
                  </div>

                  {/* Message Bubble Content */}
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 sm:max-w-[75%] ${
                      isUser
                        ? "bg-[#242724] text-white rounded-tr-none shadow-2xs"
                        : "border border-[#E7E6E0] bg-white text-[#242724] rounded-tl-none shadow-2xs"
                    }`}
                  >
                    <p className="whitespace-pre-line text-sm leading-relaxed">
                      {msg.content}
                    </p>

                    {/* Pending Clarification Options / Option Pills */}
                    {!isUser && msg.pending_clarification && (
                      <div className="mt-3 rounded-lg border border-[#79565D]/20 bg-[#F4EFF0] p-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#79565D]">
                          <HelpCircle size={14} />
                          <span>Clarification Required</span>
                        </div>
                        <p className="mt-1 text-xs text-[#67474E]">
                          {msg.pending_clarification}
                        </p>

                        {/* Interactive Choice Pills */}
                        {pendingOptions && pendingOptions.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {pendingOptions.map((opt, oIdx) => (
                              <button
                                key={`${opt.product_id}-${oIdx}`}
                                type="button"
                                onClick={() => handlePromptClick(`${opt.name} ${opt.pack_size}${opt.pack_unit}`)}
                                className="flex items-center gap-1.5 rounded-full border border-[#79565D]/30 bg-white px-2.5 py-1 text-xs font-medium text-[#79565D] transition-colors hover:bg-[#79565D] hover:text-white"
                              >
                                <span>{opt.name}</span>
                                <span className="font-semibold">({opt.pack_size}{opt.pack_unit})</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Verified Product Cards Carousel - Show ONLY for Clarification and Inquiries */}
                    {!isUser && msg.suggested_products && msg.suggested_products.length > 0 && (msg.intent === "CLARIFY" || msg.intent === "QUERY_PRICE_STOCK") && (
                      <div className="mt-4 border-t border-[#F0EFEA] pt-3">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#969892]">
                          Verified Catalogue Items
                        </p>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {msg.suggested_products.map((prod, pIdx) => (
                            <AssistantProductCard
                              key={`${prod.product_id}-${pIdx}`}
                              product={prod}
                              onAdded={syncCart}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Timestamp */}
                    <div
                      className={`mt-1.5 text-[10px] ${
                        isUser ? "text-white/60 text-right" : "text-[#969892]"
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-[#666864]">
                <div className="flex size-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,#79565D,#9C7683)] text-white">
                  <Sparkles size={13} className="animate-spin" />
                </div>
                <div className="rounded-2xl rounded-tl-none border border-[#E7E6E0] bg-white px-4 py-2.5 shadow-2xs">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 animate-bounce rounded-full bg-[#79565D]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-[#79565D] [animation-delay:0.2s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-[#79565D] [animation-delay:0.4s]" />
                    <span className="ml-1 text-xs text-[#666864]">Processing request...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="border-t border-[#E7E6E0] bg-[#FFFFFF] px-4 py-2">
            <div className="flex items-center gap-2 overflow-x-auto text-xs">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[#969892]">
                Quick Prompts:
              </span>
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handlePromptClick(prompt)}
                  disabled={isLoading}
                  className="shrink-0 rounded-full border border-[#E7E6E0] bg-[#F6F5F1] px-3 py-1 font-medium text-[#666864] transition-colors hover:border-[#79565D] hover:bg-[#F4EFF0] hover:text-[#79565D] disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Text Input Bar */}
          <form
            onSubmit={handleSend}
            className="border-t border-[#E7E6E0] bg-white p-3 sm:p-4"
          >
            <div className="flex items-center gap-2 rounded-xl border border-[#E7E6E0] bg-[#F6F5F1] px-3 py-2 transition-all focus-within:border-[#79565D] focus-within:bg-white focus-within:shadow-2xs">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Likh kar order karein: jaise 'Red Label 500g 2 case' ya 'Pehla wala hata do'..."
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-[#242724] placeholder:text-[#969892] focus:outline-hidden disabled:opacity-50"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                aria-label="Upload photo of kirana parchi"
                title="Parchi ki photo upload karein (Gemini Vision OCR)"
                className="flex size-9 items-center justify-center rounded-lg border border-[#E7E6E0] bg-white text-[#79565D] hover:bg-[#F4EFF0] transition shadow-xs disabled:opacity-40"
              >
                <Camera size={16} />
              </button>
              <button
                type="button"
                onClick={toggleListening}
                disabled={isLoading}
                aria-label={isListening ? "Stop voice input" : "Voice input"}
                title={isListening ? "Mic band karein" : "Bol kar likhein (Voice input)"}
                className={`flex size-9 items-center justify-center rounded-lg transition-all ${
                  isListening
                    ? "bg-[#8C2828] text-white animate-pulse shadow-xs"
                    : "bg-white text-[#79565D] border border-[#E7E6E0] hover:bg-[#F4EFF0]"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                aria-label="Send message"
                className="flex size-9 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#79565D,#9C7683)] text-white shadow-2xs transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={15} />
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-[#969892]">
              Orderly Assistant validates live prices and stock with backend services before draft inclusion.
            </p>
          </form>
        </section>

        {/* Right Side: Server-Authoritative Live Order Draft & Confirmation Panel */}
        <aside
          className={`w-full shrink-0 flex-col bg-white lg:flex lg:w-96 xl:w-[420px] ${
            mobileTab === "draft" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Draft Panel Header */}
          <header className="border-b border-[#E7E6E0] bg-white px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={17} className="text-[#79565D]" />
                <h2 className="text-sm font-bold text-[#242724]">
                  Active Order Draft
                </h2>
                <span className="rounded-full bg-[#79565D]/10 px-2 py-0.5 text-[11px] font-semibold text-[#79565D]">
                  {cartCount} {cartCount === 1 ? "item" : "items"}
                </span>
              </div>
              {cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Kya aap saara cart saaf karna chahte hain?")) {
                      clearCart();
                      syncCart();
                    }
                  }}
                  title="Clear all draft items"
                  className="text-xs text-[#969892] transition-colors hover:text-[#8C2828]"
                >
                  Clear Draft
                </button>
              )}
            </div>
          </header>

          {/* Draft Confirmation Success Alert */}
          {isOrderConfirmed && (
            <div className="m-4 rounded-xl border border-[#4E8962]/30 bg-[#EDF5F0] p-4 text-[#4E8962]">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    Order Submitted to Order Desk
                  </h4>
                  <p className="mt-1 text-xs text-[#31563E]">
                    Aapka order successfully place ho gaya hai aur distributor ke approval queue me hai.
                  </p>
                  {createdOrderId && (
                    <p className="mt-1 font-mono text-xs font-semibold text-[#242724]">
                      Order Ref: #{createdOrderId.slice(0, 8).toUpperCase()}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3">
                    <Link
                      href="/retailer/orders"
                      className="inline-flex items-center gap-1 rounded-md bg-[#4E8962] px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      <span>Track Order</span>
                      <ArrowRight size={12} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        clearConfirmation();
                      }}
                      className="text-xs font-medium text-[#4E8962] underline underline-offset-2 hover:text-[#242724]"
                    >
                      Place Another Order
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Draft Items List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {cartItems.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-[#969892]">
                <div className="flex size-14 items-center justify-center rounded-full bg-[#F6F5F1] text-[#79565D]/50 mb-3">
                  <ShoppingBag size={24} />
                </div>
                <h3 className="text-sm font-semibold text-[#242724]">
                  Draft is Empty
                </h3>
                <p className="mt-1 text-xs text-[#666864] max-w-xs leading-relaxed">
                  Assistant me product boliye ya likhiye jaise{" "}
                  <span className="font-semibold text-[#79565D]">"Red Label 500g 2 packet"</span>.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cartItems.map((item) => {
                  const lineTotal =
                    item.price *
                    item.quantity *
                    (item.quantity_unit === "CASE" ? item.units_per_case : 1);

                  return (
                    <div
                      key={`${item.product_id}-${item.quantity_unit}`}
                      className="rounded-xl border border-[#E7E6E0] bg-[#FFFFFF] p-3 shadow-2xs transition-all hover:border-[#79565D]/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#79565D]">
                            {item.brand_name}
                          </p>
                          <h4 className="truncate text-xs font-semibold text-[#242724]">
                            {item.name}
                          </h4>
                          <p className="text-[11px] text-[#666864]">
                            {item.pack_size} {item.pack_unit} ·{" "}
                            <span className="rounded bg-[#F6F5F1] px-1 py-0.5 font-mono text-[10px] font-semibold text-[#242724]">
                              {item.quantity_unit}
                            </span>
                            {item.quantity_unit === "CASE" && (
                              <span className="text-[#969892]"> ({item.units_per_case} pcs/case)</span>
                            )}
                          </p>
                        </div>
                        {/* Remove Action */}
                        <button
                          type="button"
                          onClick={() => {
                            removeFromCart(item.product_id, item.quantity_unit);
                            removeDraftItem(item.product_id, item.quantity_unit);
                            syncCart();
                          }}
                          title="Remove item"
                          className="text-[#969892] transition-colors hover:text-[#8C2828]"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Quantity Spinner & Line Total */}
                      <div className="mt-3 flex items-center justify-between border-t border-[#F0EFEA] pt-2">
                        <div className="flex items-center rounded-lg border border-[#E7E6E0] bg-[#F6F5F1] p-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (item.quantity > 1) {
                                updateCartQuantity(
                                  item.product_id,
                                  item.quantity_unit,
                                  item.quantity - 1
                                );
                                updateDraftQuantity(
                                  item.product_id,
                                  item.quantity - 1,
                                  item.quantity_unit
                                );
                                syncCart();
                              } else {
                                removeFromCart(item.product_id, item.quantity_unit);
                                removeDraftItem(item.product_id, item.quantity_unit);
                                syncCart();
                              }
                            }}
                            className="flex size-6 items-center justify-center rounded text-[#666864] hover:bg-white hover:text-[#242724]"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="w-7 text-center font-mono text-xs font-bold text-[#242724]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              updateCartQuantity(
                                item.product_id,
                                item.quantity_unit,
                                item.quantity + 1
                              );
                              updateDraftQuantity(
                                item.product_id,
                                item.quantity + 1,
                                item.quantity_unit
                              );
                              syncCart();
                            }}
                            className="flex size-6 items-center justify-center rounded text-[#666864] hover:bg-white hover:text-[#242724]"
                          >
                            <Plus size={11} />
                          </button>
                        </div>

                        <div className="text-right">
                          <div className="font-mono text-xs font-bold text-[#242724]">
                            {formatCurrency(lineTotal)}
                          </div>
                          <div className="text-[10px] text-[#969892]">
                            ₹{item.price.toFixed(2)}/pc
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Draft Financial Summary & Explicit Confirmation */}
          {cartItems.length > 0 && (
            <footer className="border-t border-[#E7E6E0] bg-[#FFFFFF] p-4 sm:p-5">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-[#666864]">
                  <span>Subtotal ({cartCount} items)</span>
                  <span className="font-mono font-medium text-[#242724]">
                    {formatCurrency(cartSubtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-[#666864]">
                  <span>GST & Duties</span>
                  <span className="font-mono font-medium text-[#242724]">
                    Included in quoted price
                  </span>
                </div>
                <div className="border-t border-[#F0EFEA] pt-2 flex justify-between text-sm font-bold text-[#242724]">
                  <span>Estimated Total</span>
                  <span className="font-mono text-base font-bold text-[#79565D]">
                    {formatCurrency(cartSubtotal)}
                  </span>
                </div>
              </div>

              {/* Explicit Confirmation Action */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleExplicitConfirm}
                  disabled={isLoading || isConfirming || cartItems.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#79565D,#9C7683)] py-3 text-sm font-semibold text-white shadow-2xs transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isConfirming || isLoading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Validating with Backend...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Confirm & Place Order</span>
                    </>
                  )}
                </button>
                <p className="mt-2 text-center text-[11px] text-[#969892]">
                  Explicit confirmation: All orders undergo final verification in Order Desk.
                </p>
              </div>
            </footer>
          )}
        </aside>
      </div>
    </div>
  );
}
