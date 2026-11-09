"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Mic,
  RotateCcw,
  Send,
  Sparkles,
  Volume2,
  X,
  Radio,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { useAIAssistant } from "@/contexts/ai-assistant-context";
import { AssistantProductCard } from "./product-card";

export function AIAssistantChatDrawer() {
  const {
    isOpen,
    mode,
    messages,
    isLoading,
    isSpeaking,
    activeClarification,
    closeAssistant,
    setMode,
    sendMessage,
    resetSession,
    speakText,
    stopSpeaking,
  } = useAIAssistant();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && mode === "CHAT") {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    await sendMessage(text);
  }

  const quickPrompts = [
    "Red Label 500g 2 packet",
    "Tata Salt 1 case",
    "Cart me kya hai?",
    "Order confirm karo",
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[2px] transition-all duration-300">
      {/* Drawer Container */}
      <div className="flex h-full w-full max-w-lg flex-col bg-[#F6F5F1] shadow-2xl transition-transform duration-300 sm:border-l sm:border-[#E7E6E0]">
        {/* Drawer Header */}
        <header className="flex items-center justify-between border-b border-[#E7E6E0] bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#79565D,#9C7683)] text-white shadow-sm">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-[#242724]">
                  Orderly Assistant
                </h3>
                <span className="flex size-2 rounded-full bg-[#4E8962]" />
              </div>
              <p className="text-[11px] text-[#666864]">
                Multilingual Kirana AI · Hindi & English
              </p>
            </div>
          </div>

          {/* Mode Switcher & Actions */}
          <div className="flex items-center gap-1.5">
            {/* Mode Toggle Pill */}
            <div className="flex rounded-full border border-[#E7E6E0] bg-[#F6F5F1] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode("CHAT")}
                className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                  mode === "CHAT"
                    ? "bg-white text-[#242724] shadow-2xs"
                    : "text-[#666864] hover:text-[#242724]"
                }`}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => setMode("VOICE")}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-colors ${
                  mode === "VOICE"
                    ? "bg-[#79565D] text-white shadow-2xs"
                    : "text-[#666864] hover:text-[#242724]"
                }`}
              >
                <Radio size={11} className={mode === "VOICE" ? "animate-pulse" : ""} />
                Voice
              </button>
            </div>

            {/* Reset Dialogue */}
            <button
              type="button"
              onClick={resetSession}
              title="Reset conversation"
              className="flex size-8 items-center justify-center rounded-full text-[#666864] hover:bg-[#F0EFEA] hover:text-[#242724]"
            >
              <RotateCcw size={15} />
            </button>

            {/* Close Drawer */}
            <button
              type="button"
              onClick={closeAssistant}
              className="flex size-8 items-center justify-center rounded-full text-[#666864] hover:bg-[#F0EFEA] hover:text-[#242724]"
            >
              <X size={17} />
            </button>
          </div>
        </header>

        {/* Conversation Message Feed */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 sm:px-6">
          {messages.map((msg) => {
            const isUser = msg.role === "user";

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                {/* Bubble */}
                <div
                  className={`relative max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-2xs ${
                    isUser
                      ? "rounded-tr-xs bg-[#242724] text-white"
                      : "rounded-tl-xs border border-[#E7E6E0] bg-white text-[#242724]"
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.content}</p>

                  {/* Audio Speaker Icon for Assistant */}
                  {!isUser && msg.audio_text && (
                    <button
                      type="button"
                      onClick={() =>
                        isSpeaking ? stopSpeaking() : speakText(msg.audio_text || msg.content)
                      }
                      title="Listen to response"
                      className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[#79565D] hover:underline"
                    >
                      <Volume2 size={12} />
                      <span>{isSpeaking ? "Stop" : "Listen"}</span>
                    </button>
                  )}
                </div>

                {/* Suggested Product Cards */}
                {!isUser && msg.suggested_products && msg.suggested_products.length > 0 && (
                  <div className="mt-3 flex w-full gap-3 overflow-x-auto pb-2 pt-1 scrollbar-none">
                    {msg.suggested_products.map((prod, pIdx) => (
                      <AssistantProductCard key={`${prod.product_id}-${pIdx}`} product={prod} />
                    ))}
                  </div>
                )}

                {/* Clarification Quick Reply Chips */}
                {!isUser && msg.pending_clarification && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["Option 1", "Option 2", "500g wala", "250g wala"].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => sendMessage(chip)}
                        className="rounded-full border border-[#79565D]/30 bg-white px-3 py-1 text-[11px] font-medium text-[#79565D] shadow-2xs hover:bg-[#79565D]/10"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-[#969892]">
              <div className="flex size-7 items-center justify-center rounded-full border border-[#E7E6E0] bg-white">
                <Bot size={14} className="text-[#79565D]" />
              </div>
              <div className="flex gap-1 rounded-full bg-white px-3 py-2 border border-[#E7E6E0]">
                <span className="size-1.5 animate-bounce rounded-full bg-[#79565D]" />
                <span className="size-1.5 animate-bounce rounded-full bg-[#79565D] [animation-delay:0.2s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-[#79565D] [animation-delay:0.4s]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="border-t border-[#E7E6E0]/60 bg-white/50 px-4 py-2 sm:px-6">
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {quickPrompts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                className="whitespace-nowrap rounded-full border border-[#E7E6E0] bg-white px-2.5 py-1 text-[11px] text-[#666864] transition-colors hover:border-[#79565D]/40 hover:text-[#242724]"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSend}
          className="border-t border-[#E7E6E0] bg-white p-3 sm:px-6 sm:py-4"
        >
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Bol kar ya likh kar order dein..."
              disabled={isLoading}
              className="w-full rounded-full border border-[#E7E6E0] bg-[#F6F5F1] py-2.5 pl-4 pr-20 text-xs text-[#242724] placeholder-[#969892] focus:border-[#79565D] focus:bg-white focus:outline-none"
            />

            <div className="absolute right-1.5 flex items-center gap-1">
              {/* Mic mode switch */}
              <button
                type="button"
                onClick={() => setMode("VOICE")}
                title="Switch to Voice Mode"
                className="flex size-7 items-center justify-center rounded-full text-[#666864] hover:bg-[#E7E6E0] hover:text-[#242724]"
              >
                <Mic size={14} />
              </button>

              {/* Send message */}
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="flex size-7 items-center justify-center rounded-full bg-[#79565D] text-white disabled:opacity-40"
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
