"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiRequest } from "@/lib/api";
import {
  addToCart,
  clearCart,
  getCart,
  removeFromCart,
  updateCartQuantity,
  type CartItem,
  type QuantityUnit,
} from "@/lib/cart";

export interface ClarificationOption {
  product_id: string;
  sku: string;
  name: string;
  brand_name: string;
  pack_size: number;
  pack_unit: string;
  units_per_case: number;
  price: number | null;
  is_in_stock: boolean;
  quantity_available: number;
}

export interface ProductCardInfo {
  product_id: string;
  sku: string;
  name: string;
  brand_name: string;
  category: string;
  pack_size: number;
  pack_unit: string;
  units_per_case: number;
  price: number | null;
  mrp: number | null;
  is_in_stock: boolean;
  quantity_available: number;
  cart_quantity: number;
  cart_unit: QuantityUnit;
  image_url: string | null;
  scheme_label?: string | null;
}

export interface CartAction {
  action: "ADD" | "UPDATE" | "REMOVE" | "CLEAR" | "SYNC";
  product_id?: string | null;
  sku?: string | null;
  name?: string | null;
  brand_name?: string | null;
  pack_size?: number | null;
  pack_unit?: string | null;
  units_per_case?: number;
  price?: number;
  quantity?: number;
  quantity_unit?: QuantityUnit;
  quantity_available?: number;
  gst_included?: boolean;
  image_url?: string | null;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  audio_text?: string | null;
  intent?: string;
  timestamp: string;
  suggested_products?: ProductCardInfo[];
  pending_clarification?: string | null;
}

export interface AssistantSessionResponse {
  session_id: string;
  retailer_id: string;
  mode: "CHAT" | "VOICE";
  messages: AssistantMessage[];
  pending_question?: string | null;
  pending_options?: ClarificationOption[];
  is_confirmed: boolean;
  created_order_id?: string | null;
}

export interface AssistantChatResponse {
  session_id: string;
  reply: string;
  audio_text: string;
  intent: string;
  messages: AssistantMessage[];
  suggested_products: ProductCardInfo[];
  cart_actions: CartAction[];
  is_order_confirmed: boolean;
  created_order_id: string | null;
  pending_clarification: string | null;
}

interface AIAssistantContextType {
  isOpen: boolean;
  mode: "CHAT" | "VOICE";
  messages: AssistantMessage[];
  isLoading: boolean;
  isSpeaking: boolean;
  activeClarification: string | null;
  suggestedProducts: ProductCardInfo[];
  openAssistant: (mode?: "CHAT" | "VOICE") => void;
  closeAssistant: () => void;
  setMode: (mode: "CHAT" | "VOICE") => void;
  sendMessage: (text: string) => Promise<void>;
  resetSession: () => Promise<void>;
  speakText: (text: string) => void;
  stopSpeaking: () => void;
}

const AIAssistantContext = createContext<AIAssistantContextType | null>(null);

export function AIAssistantProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"CHAT" | "VOICE">("CHAT");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeClarification, setActiveClarification] = useState<string | null>(null);
  const [suggestedProducts, setSuggestedProducts] = useState<ProductCardInfo[]>([]);

  // Stop Web Speech synthesis safely
  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  // Speak response in Voice Mode using Hindi / Indian English voice
  const speakText = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis || !text) return;

      stopSpeaking();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Prefer Indian English / Hindi voice if available
      const voices = window.speechSynthesis.getVoices();
      const hiVoice = voices.find(
        (v) => v.lang.startsWith("hi") || v.lang.includes("IN")
      );
      if (hiVoice) {
        utterance.voice = hiVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [stopSpeaking]
  );

  // Load session from server on mount
  const loadSession = useCallback(async () => {
    try {
      const data = await apiRequest<AssistantSessionResponse>("/assistant/session");
      if (data?.messages) {
        setMessages(data.messages);
        setActiveClarification(data.pending_question || null);
      }
    } catch {
      // Ignored for non-retailer users or during auth loading
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Apply server cart actions to local cart
  const applyCartActions = useCallback((actions: CartAction[]) => {
    for (const act of actions) {
      if (act.action === "CLEAR") {
        clearCart();
      } else if (act.action === "ADD" && act.product_id) {
        try {
          addToCart({
            product_id: act.product_id,
            sku: act.sku || "",
            name: act.name || "",
            brand_name: act.brand_name || "",
            pack_size: act.pack_size || 1,
            pack_unit: act.pack_unit || "gm",
            units_per_case: act.units_per_case || 1,
            price: act.price || 0,
            gst_included: act.gst_included ?? true,
            quantity_available: act.quantity_available || 999,
            quantity: act.quantity || 1,
            quantity_unit: act.quantity_unit || "PIECE",
            image_url: act.image_url,
          });
        } catch {
          // Handled by cart limits
        }
      } else if (act.action === "REMOVE" && act.product_id) {
        removeFromCart(act.product_id, act.quantity_unit || "CASE");
        removeFromCart(act.product_id, "PIECE");
      } else if (act.action === "UPDATE" && act.product_id && act.quantity) {
        updateCartQuantity(
          act.product_id,
          act.quantity_unit || "PIECE",
          act.quantity
        );
      }
    }
  }, []);

  // Send message to AI Assistant endpoint
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setIsLoading(true);

      // Optimistic user message append
      const tempUserMsg: AssistantMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        audio_text: trimmed,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      try {
        const currentCart = getCart();
        const response = await apiRequest<AssistantChatResponse>("/assistant/chat", {
          method: "POST",
          body: JSON.stringify({
            message: trimmed,
            mode,
            cart_snapshot: currentCart,
          }),
        });

        if (response) {
          setMessages(response.messages);
          setActiveClarification(response.pending_clarification);
          if (response.suggested_products?.length > 0) {
            setSuggestedProducts(response.suggested_products);
          }

          // Apply cart actions returned from backend
          if (response.cart_actions?.length > 0) {
            applyCartActions(response.cart_actions);
          }

          // In Voice Mode, speak the concise audio response
          if (mode === "VOICE" && response.audio_text) {
            speakText(response.audio_text);
          }
        }
      } catch (err) {
        const errorMsg: AssistantMessage = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            err instanceof Error
              ? `Error: ${err.message}`
              : "Server se connect nahi ho saka. Kripya dobara koshish karein.",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, mode, applyCartActions, speakText]
  );

  const resetSession = useCallback(async () => {
    stopSpeaking();
    setIsLoading(true);
    try {
      const data = await apiRequest<AssistantSessionResponse>("/assistant/session", {
        method: "DELETE",
      });
      if (data?.messages) {
        setMessages(data.messages);
        setActiveClarification(null);
        setSuggestedProducts([]);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  }, [stopSpeaking]);

  const openAssistant = useCallback((targetMode?: "CHAT" | "VOICE") => {
    if (targetMode) setMode(targetMode);
    setIsOpen(true);
  }, []);

  const closeAssistant = useCallback(() => {
    stopSpeaking();
    setIsOpen(false);
  }, [stopSpeaking]);

  return (
    <AIAssistantContext.Provider
      value={{
        isOpen,
        mode,
        messages,
        isLoading,
        isSpeaking,
        activeClarification,
        suggestedProducts,
        openAssistant,
        closeAssistant,
        setMode,
        sendMessage,
        resetSession,
        speakText,
        stopSpeaking,
      }}
    >
      {children}
    </AIAssistantContext.Provider>
  );
}

export function useAIAssistant() {
  const ctx = useContext(AIAssistantContext);
  if (!ctx) {
    throw new Error("useAIAssistant must be used within an AIAssistantProvider");
  }
  return ctx;
}
