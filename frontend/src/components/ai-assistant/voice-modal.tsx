"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  MessageSquare,
  X,
  RotateCcw,
  Sparkles,
  ShoppingCart,
  Check,
} from "lucide-react";
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb";
import { isAIEcho } from "@/lib/echo-filter";
import { useAIAssistant } from "@/contexts/ai-assistant-context";
import { getCartItemCount, getCartSubtotal } from "@/lib/cart";

// Web Speech API interface declarations for TypeScript
interface IWindowSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: () => void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

export function AIAssistantVoiceModal() {
  const {
    isOpen,
    mode,
    isLoading,
    isSpeaking,
    isCoolingDown,
    lastSpokenText,
    recentSpokenTexts,
    messages,
    closeAssistant,
    setMode,
    sendMessage,
    resetSession,
    stopSpeaking,
  } = useAIAssistant();

  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<
    "listening" | "processing" | "speaking" | "muted" | "idle"
  >("idle");
  const [cartCount, setCartCount] = useState(0);
  const [cartSubtotal, setCartSubtotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const isSpeakingRef = useRef(isSpeaking);
  const isCoolingDownRef = useRef(isCoolingDown);
  const isLoadingRef = useRef(isLoading);
  const recentSpokenTextsRef = useRef(recentSpokenTexts);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isCoolingDownRef.current = isCoolingDown;
  }, [isCoolingDown]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    recentSpokenTextsRef.current = recentSpokenTexts;
  }, [recentSpokenTexts]);

  const recognitionRef = useRef<IWindowSpeechRecognition | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRecognizingRef = useRef(false);
  const isDirectSpeakingRef = useRef<boolean>(false);

  // Sync cart stats
  useEffect(() => {
    const syncCart = () => {
      setCartCount(getCartItemCount());
      setCartSubtotal(getCartSubtotal());
    };
    syncCart();
    window.addEventListener("orderly-cart-updated", syncCart);
    return () => window.removeEventListener("orderly-cart-updated", syncCart);
  }, []);

  // Update voiceStatus based on context state
  useEffect(() => {
    if (isMicMuted) {
      setVoiceStatus("muted");
    } else if (isLoading) {
      setVoiceStatus("processing");
    } else if (isSpeaking) {
      setVoiceStatus("speaking");
    } else {
      setVoiceStatus("listening");
    }
  }, [isMicMuted, isLoading, isSpeaking]);

  // Submit recognized speech
  const handleFinalSpeech = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;

      // Anti-Echo Guard: If speech recognition picked up the assistant's own voice
      // (e.g. "kitna chahiye", "ye upload hai", or words from recent AI speech), drop it immediately.
      if (isAIEcho(clean, recentSpokenTextsRef.current)) {
        setLiveTranscript("");
        return;
      }

      setLiveTranscript("");
      setVoiceStatus("processing");

      // Interrupt any ongoing audio
      stopSpeaking();

      await sendMessage(clean);
    },
    [sendMessage, stopSpeaking]
  );

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRec =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;

    if (!SpeechRec) {
      setErrorMessage(
        "Aapke browser me speech recognition support nahi hai. Kripya Chat Mode use karein."
      );
      return;
    }

    const recognition: IWindowSpeechRecognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    // hi-IN recognizes Hindi, Hinglish, and Indian English
    recognition.lang = "hi-IN";

    recognition.onstart = () => {
      isRecognizingRef.current = true;
      setErrorMessage("");
    };

    recognition.onresult = (event: any) => {
      // Discard immediately if the assistant is speaking, cooling down, or processing
      if (
        isSpeakingRef.current ||
        isCoolingDownRef.current ||
        isLoadingRef.current
      ) {
        setLiveTranscript("");
        return;
      }

      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      const activeText = (final || interim).trim();
      if (!activeText) return;

      // Anti-echo filter: Drop assistant prompts & echoes (e.g. "kitna chahiye", "ye upload hai")
      if (isAIEcho(activeText, recentSpokenTextsRef.current)) {
        setLiveTranscript("");
        return;
      }

      setLiveTranscript(activeText);

      // Reset silence timer
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      // After 1.2 seconds of silence, treat speech as finished and process
      silenceTimerRef.current = setTimeout(() => {
        if (activeText.trim() && !isAIEcho(activeText, recentSpokenTextsRef.current)) {
          handleFinalSpeech(activeText);
        } else {
          setLiveTranscript("");
        }
      }, 750);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }
      if (event.error === "not-allowed") {
        setErrorMessage("Microphone permission allow karein.");
        setIsMicMuted(true);
      }
    };

    recognition.onend = () => {
      isRecognizingRef.current = false;
      // Restart listening only if Voice Mode is active, mic is not muted, and assistant is NOT speaking/cooling down
      if (
        isOpen &&
        mode === "VOICE" &&
        !isMicMuted &&
        !isDirectSpeakingRef.current &&
        !isSpeakingRef.current &&
        !isCoolingDownRef.current &&
        !isLoadingRef.current
      ) {
        try {
          recognition.start();
        } catch {
          // Ignored
        }
      }
    };

    recognitionRef.current = recognition;

    const onSpeakingStart = () => {
      isDirectSpeakingRef.current = true;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setLiveTranscript("");
      try {
        recognition.abort();
      } catch {}
    };

    const onSpeakingEnd = () => {
      setTimeout(() => {
        isDirectSpeakingRef.current = false;
        if (isOpen && mode === "VOICE" && !isMicMuted && !isSpeakingRef.current && !isLoadingRef.current) {
          try {
            recognition.start();
          } catch {}
        }
      }, 800);
    };

    window.addEventListener("orderly-ai-speaking-start", onSpeakingStart);
    window.addEventListener("orderly-ai-speaking-end", onSpeakingEnd);

    return () => {
      window.removeEventListener("orderly-ai-speaking-start", onSpeakingStart);
      window.removeEventListener("orderly-ai-speaking-end", onSpeakingEnd);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try {
        recognition.abort();
      } catch {
        // Ignored
      }
    };
  }, [
    handleFinalSpeech,
    isCoolingDown,
    isMicMuted,
    isOpen,
    isSpeaking,
    isLoading,
    lastSpokenText,
    mode,
  ]);

  // Pause recognition during speech synthesis and resume after cooldown
  useEffect(() => {
    if (isSpeaking || isCoolingDown || isLoading) {
      if (recognitionRef.current && isRecognizingRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignored
        }
      }
    } else if (isOpen && mode === "VOICE" && !isMicMuted) {
      if (recognitionRef.current && !isRecognizingRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // Ignored
        }
      }
    }
  }, [isSpeaking, isCoolingDown, isLoading, isOpen, mode, isMicMuted]);

  if (!isOpen || mode !== "VOICE") return null;

  // Most recent assistant message
  const lastAssistantMsg = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-300">
      <div className="relative flex h-full w-full max-w-lg flex-col items-center justify-between p-6 text-[#242724] sm:h-[90vh] sm:rounded-3xl sm:border sm:border-white/20 sm:bg-[linear-gradient(180deg,#F6F5F1_0%,#EFECE6_100%)] sm:shadow-2xl">
        {/* Top Header */}
        <header className="flex w-full items-center justify-between">
          {/* Brand & Depot */}
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-[#79565D] text-white">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#242724]">Orderly Voice</p>
              <p className="text-[10px] text-[#666864]">Hands-Free Hindi & English</p>
            </div>
          </div>

          {/* Cart Status Pill */}
          <div className="flex items-center gap-1.5 rounded-full border border-[#E7E6E0] bg-white px-3 py-1 text-xs shadow-2xs">
            <ShoppingCart size={13} className="text-[#79565D]" />
            <span className="font-semibold text-[#242724]">{cartCount} items</span>
            {cartSubtotal > 0 && (
              <span className="text-[11px] text-[#666864]">· ₹{cartSubtotal.toFixed(0)}</span>
            )}
          </div>

          {/* Close */}
          <button
            type="button"
            onClick={closeAssistant}
            title="Close Voice Mode"
            className="flex size-8 items-center justify-center rounded-full bg-white/80 text-[#5b4b4d] shadow-sm hover:bg-white"
          >
            <X size={17} />
          </button>
        </header>

        {/* Center Orb & State Visualizer */}
        <div className="my-auto flex flex-col items-center justify-center gap-6">
          {/* 3D Voice Orb */}
          <div className="relative flex size-44 items-center justify-center sm:size-52">
            <VoicePoweredOrb
              active={!isMicMuted && voiceStatus === "listening"}
              className="size-full rounded-full"
            />

            {/* Status Pulse Ring */}
            {voiceStatus === "listening" && (
              <div className="pointer-events-none absolute inset-0 animate-ping rounded-full border border-[#79565D]/30 opacity-40 [animation-duration:3s]" />
            )}
          </div>

          {/* State Indicator Pill */}
          <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-1.5 shadow-sm backdrop-blur-md">
            <span
              className={`size-2.5 rounded-full shadow-sm ${
                voiceStatus === "listening"
                  ? "animate-pulse bg-[#4E8962]"
                  : voiceStatus === "processing"
                  ? "animate-spin bg-[#C98A2C]"
                  : voiceStatus === "speaking"
                  ? "bg-[#79565D]"
                  : "bg-[#969892]"
              }`}
            />
            <span className="text-xs font-semibold capitalize tracking-wide text-[#242724]">
              {voiceStatus === "listening" && "Listening... Aap bol sakte hain"}
              {voiceStatus === "processing" && "Processing... Soch rahe hain"}
              {voiceStatus === "speaking" && "Assistant bol raha hai..."}
              {voiceStatus === "muted" && "Microphone Muted"}
              {voiceStatus === "idle" && "Ready"}
            </span>
          </div>

          {/* Live Transcript / Response Feedback Bubble */}
          <div className="w-full max-w-sm min-h-16 rounded-2xl border border-white/70 bg-white/75 p-3.5 text-center shadow-sm backdrop-blur-md">
            {liveTranscript ? (
              <div>
                <p className="text-xs font-medium text-[#242724] italic">
                  "{liveTranscript}"
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                    handleFinalSpeech(liveTranscript);
                  }}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#4E8962] px-3.5 py-1 text-xs font-semibold text-white shadow-xs transition-transform hover:scale-105 active:scale-95"
                >
                  <Check size={13} />
                  <span>Done Speaking (Send)</span>
                </button>
              </div>
            ) : lastAssistantMsg ? (
              <p className="text-xs text-[#5b4b4d] line-clamp-3">
                {lastAssistantMsg.audio_text || lastAssistantMsg.content}
              </p>
            ) : (
              <p className="text-xs text-[#969892]">
                "Parle-G 10 packet", "Tata Salt 1 case", ya "Order confirm karo" bolein.
              </p>
            )}
          </div>

          {errorMessage && (
            <p className="text-xs text-[#8C2828] font-medium">{errorMessage}</p>
          )}
        </div>

        {/* Bottom Voice Controls */}
        <footer className="flex w-full items-center justify-around rounded-2xl border border-white/70 bg-white/80 p-3 shadow-lg backdrop-blur-xl">
          {/* Mic Mute Toggle */}
          <button
            type="button"
            onClick={() => {
              if (!isMicMuted && liveTranscript.trim()) {
                handleFinalSpeech(liveTranscript);
              }
              setIsMicMuted((prev) => !prev);
            }}
            aria-label={isMicMuted ? "Unmute microphone" : "Mute microphone"}
            title={isMicMuted ? "Unmute microphone" : "Mute microphone"}
            className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
              isMicMuted ? "text-[#8C2828]" : "text-[#242724]"
            }`}
          >
            <div
              className={`flex size-11 items-center justify-center rounded-full border shadow-sm transition-all ${
                isMicMuted
                  ? "border-[#8C2828]/30 bg-[#8C2828]/10 text-[#8C2828]"
                  : "border-[#E7E6E0] bg-white text-[#242724] hover:bg-[#F6F5F1]"
              }`}
            >
              {isMicMuted ? <MicOff size={19} /> : <Mic size={19} />}
            </div>
            <span>{isMicMuted ? "Unmute Mic" : "Mute Mic"}</span>
          </button>

          {/* Speaker Mute Toggle */}
          <button
            type="button"
            onClick={() => {
              if (isSpeaking) stopSpeaking();
              setIsSpeakerMuted((prev) => !prev);
            }}
            aria-label={isSpeakerMuted ? "Unmute speaker" : "Mute speaker"}
            title={isSpeakerMuted ? "Unmute speaker" : "Mute speaker"}
            className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
              isSpeakerMuted ? "text-[#8C2828]" : "text-[#242724]"
            }`}
          >
            <div
              className={`flex size-11 items-center justify-center rounded-full border shadow-sm transition-all ${
                isSpeakerMuted
                  ? "border-[#8C2828]/30 bg-[#8C2828]/10 text-[#8C2828]"
                  : "border-[#E7E6E0] bg-white text-[#242724] hover:bg-[#F6F5F1]"
              }`}
            >
              {isSpeakerMuted ? <VolumeX size={19} /> : <Volume2 size={19} />}
            </div>
            <span>{isSpeakerMuted ? "Unmute Audio" : "Mute Audio"}</span>
          </button>

          {/* Switch to Chat Mode */}
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              setMode("CHAT");
            }}
            aria-label="Switch to Visual Chat Mode"
            title="Switch to Chat Mode"
            className="flex flex-col items-center gap-1 text-[11px] font-medium text-[#79565D]"
          >
            <div className="flex size-11 items-center justify-center rounded-full border border-[#79565D]/30 bg-[#79565D]/10 text-[#79565D] shadow-sm hover:bg-[#79565D]/20 transition-all">
              <MessageSquare size={19} />
            </div>
            <span>Chat Mode</span>
          </button>

          {/* Reset Conversation */}
          <button
            type="button"
            onClick={resetSession}
            aria-label="Reset Conversation"
            title="Reset conversation"
            className="flex flex-col items-center gap-1 text-[11px] font-medium text-[#666864] hover:text-[#242724]"
          >
            <div className="flex size-11 items-center justify-center rounded-full border border-[#E7E6E0] bg-white text-[#666864] shadow-sm hover:bg-[#F6F5F1] transition-all">
              <RotateCcw size={17} />
            </div>
            <span>Clear</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
