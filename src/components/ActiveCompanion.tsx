/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { UserProfile, Message, CompanionVibe } from "../types";
import {
  Send,
  Trash2,
  SlidersHorizontal,
  Moon,
  Compass,
  Flame,
  LifeBuoy,
  X,
  Heart,
  CheckCircle,
  HelpCircle,
  Clock,
  Menu,
} from "lucide-react";
import PromptTips from "./PromptTips";
import { motion, AnimatePresence } from "motion/react";
import {
  callGeminiDirectClient,
  generateLocalWelcome,
  generateLocalChatReply
} from "../lib/companionFallback";

interface ActiveCompanionProps {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  messages: Message[];
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  onReset: () => void;
}

export default function ActiveCompanion({
  profile,
  setProfile,
  messages,
  setMessages,
  onReset,
}: ActiveCompanionProps) {
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Settings / Profile Drawer State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editVibe, setEditVibe] = useState(profile.vibe);
  const [editTopic, setEditTopic] = useState(profile.customTopic || "");

  // Interactive Exercises State
  const [activeExercise, setActiveExercise] = useState<"none" | "breathing" | "grounding">("none");
  const [breathingStep, setBreathingStep] = useState<"Inhale" | "Hold" | "Exhale" | "Rest">("Inhale");
  const [breathingTimer, setBreathingTimer] = useState(4);
  const [groundingStep, setGroundingStep] = useState(5); // 5 things to see... down to 1

  // Crisis Modal State
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  // Mobile Menu Drawer State
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Breathing loop timer logic
  useEffect(() => {
    let interval: any;
    if (activeExercise === "breathing") {
      interval = setInterval(() => {
        setBreathingTimer((prev) => {
          if (prev <= 1) {
            // cycle to next state
            setBreathingStep((current) => {
              switch (current) {
                case "Inhale":
                  return "Hold";
                case "Hold":
                  return "Exhale";
                case "Exhale":
                  return "Rest";
                case "Rest":
                  return "Inhale";
              }
            });
            return 4; // Reset box duration
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeExercise, breathingStep]);

  // Generate a message when the companion welcomes the user automatically (or follow up)
  const [hasDoneWelcomeCheck, setHasDoneWelcomeCheck] = useState(false);

  useEffect(() => {
    if (hasDoneWelcomeCheck) return;

    const requestWelcomeMessage = async () => {
      // If we already have conversation and it's long, let's welcome back.
      // Or if it is a fresh session with a custom topic, greet.
      setIsLoading(true);
      let welcomeText = "";

      // 1. Try Express backend endpoint first
      try {
        const response = await fetch("/api/welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            history: messages,
            profile: profile,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.text) {
            welcomeText = data.text;
          }
        }
      } catch (err) {
        console.warn("Backend welcome endpoint failed or unavailable. Falling back to client-side.", err);
      }

      // 2. Try direct client-side Gemini call if client API key is configured
      const clientApiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (!welcomeText && clientApiKey) {
        try {
          welcomeText = await callGeminiDirectClient({
            apiKey: clientApiKey,
            type: "welcome",
            profile,
            messages
          });
        } catch (geminiErr) {
          console.error("Direct browser Gemini welcome failed:", geminiErr);
        }
      }

      // 3. Fallback to highly-polished local generated vibe-matching reply
      if (!welcomeText) {
        welcomeText = generateLocalWelcome(profile, messages);
      }

      if (welcomeText) {
        // Add a welcome companion message if no session message pair exists,
        // or if the last message isn't already a companion greeting.
        setMessages((prev) => {
          if (prev.length === 0 || prev[prev.length - 1].role === "user") {
            return [
              ...prev,
              {
                id: "welcome-" + Date.now(),
                role: "companion",
                content: welcomeText,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              },
            ];
          }
          return prev;
        });
      }
      setIsLoading(false);
      setHasDoneWelcomeCheck(true);
    };

    requestWelcomeMessage();
  }, [hasDoneWelcomeCheck, profile, messages, setMessages]);

  const handleSendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setErrorText(null);
    setInputText("");

    // Detect crisis triggers in client side too as backup
    const lower = trimmed.toLowerCase();
    const crisisKeywords = [
      "suicide",
      "kill myself",
      "want to die",
      "self harm",
      "cutting myself",
      "end my life",
    ];
    const isCrisis = crisisKeywords.some((word) => lower.includes(word));

    const userMsg: Message = {
      id: "msg-" + Date.now(),
      role: "user",
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    if (isCrisis) {
      setShowSafetyModal(true);
    }

    setIsLoading(true);

    try {
      let replyText = "";

      // 1. Try Express backend endpoint first
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
            profile: profile,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.text) {
            replyText = data.text;
          }
        } else {
          console.warn("Express backend chat endpoint returned status error, initiating client fallbacks.");
        }
      } catch (apiErr) {
        console.warn("Express backend chat API disconnected or unavailable, trying client fallbacks.", apiErr);
      }

      // 2. Direct browser REST invocation if VITE_GEMINI_API_KEY is supplied
      const clientApiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (!replyText && clientApiKey) {
        try {
          replyText = await callGeminiDirectClient({
            apiKey: clientApiKey,
            type: "chat",
            profile,
            messages: updatedMessages
          });
        } catch (geminiErr) {
          console.error("Direct browser Gemini chat request failed:", geminiErr);
        }
      }

      // 3. Fallback to highly empathetic local contextual responder matching their active vibe companion
      if (!replyText) {
        replyText = generateLocalChatReply(profile, updatedMessages);
      }

      const companionMsg: Message = {
        id: "rep-" + Date.now(),
        role: "companion",
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, companionMsg]);
    } catch (err: any) {
      console.error(err);
      setErrorText("Oops, I encountered a connection issue. Are you online?");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setProfile({
      ...profile,
      name: editName.trim(),
      vibe: editVibe,
      customTopic: editTopic.trim() || undefined,
    });
    setIsSettingsOpen(false);
    // Request a fresh welcome to introduce the new settings
    setHasDoneWelcomeCheck(false);
  };

  const currentVibeDetails = {
    gentle: {
      title: "The Gentle Listener",
      icon: Moon,
      bg: "bg-[#E8EDE0] text-[#5A6A4A] border-[#D8DDD0]",
      accentText: "text-[#5A6A4A]",
      accentBg: "bg-[#E8EDE0]",
      accentBorder: "border-[#D8DDD0]",
    },
    chill: {
      title: "The Chill Buddy",
      icon: Compass,
      bg: "bg-[#F2E8E0] text-[#8A5A4A] border-[#E2D8D0]",
      accentText: "text-[#8A5A4A]",
      accentBg: "bg-[#F2E8E0]",
      accentBorder: "border-[#E2D8D0]",
    },
    cheerleader: {
      title: "The Uplifting Cheerleader",
      icon: Flame,
      bg: "bg-[#F9F4EE] text-[#8B7E72] border-[#EAE2D8]",
      accentText: "text-[#8B7E72]",
      accentBg: "bg-[#F9F4EE]",
      accentBorder: "border-[#EAE2D8]",
    },
  }[profile.vibe];

  const CompIcon = currentVibeDetails.icon;

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#4A4A3A] flex flex-col md:flex-row h-screen overflow-hidden selection:bg-[#E8EDE0]">
      
      {/* Background Soft Organic Textures & Hues */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[#E8EDE0]/45 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#F2E8E0]/40 rounded-full blur-3xl pointer-events-none" />

      {/* Sidebar - Desktop Layout */}
      <aside className="hidden md:flex w-80 shrink-0 bg-white border-r border-[#E0E0D5] flex-col p-6 justify-between relative z-20 overflow-y-auto">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-widest font-bold text-[#8C8C7B]">
                Mental Sanctum
              </span>
              <h2 className="text-xl font-serif italic text-[#3A3A2A]">
                QuietSpace
              </h2>
            </div>
            <button
              id="btn-settings-toggle"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-xl text-[#6B6B5B] hover:text-[#5A6A4A] hover:bg-[#F5F5F0] border border-transparent hover:border-[#E0E0D5] transition-all cursor-pointer"
              title="Companion Settings"
            >
              <SlidersHorizontal className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Active Profile Info */}
          <div className={`p-4 rounded-[24px] border ${currentVibeDetails.bg} space-y-3 shadow-none`}>
            <div className="flex items-center gap-3">
              <span className="p-2 bg-white rounded-xl shadow-sm border border-[#E0E0D5]/40 text-current">
                <CompIcon className="w-4.5 h-4.5" />
              </span>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                  Companion style
                </dt>
                <dd className="font-bold text-sm">
                  {currentVibeDetails.title}
                </dd>
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t border-black/5">
              <span className="text-[10px] font-semibold opacity-85 block">Chatting with:</span>
              <p className="font-bold text-sm flex items-center gap-1.5 text-[#3A3A2A]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5A6A4A] animate-pulse" />
                {profile.name}
              </p>
            </div>

            {profile.customTopic && (
              <div className="space-y-1 pt-2 border-t border-black/5">
                <span className="text-[10px] font-semibold opacity-85 block">What's on your mind:</span>
                <p className="text-xs italic line-clamp-2 text-current opacity-90 font-medium">
                  "{profile.customTopic}"
                </p>
              </div>
            )}
          </div>

          {/* Rapid Interactive Safe-Space Exercises Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-[#8C8C7B]">
              Grounding Exercises
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <button
                id="btn-start-breathing"
                onClick={() => {
                  setActiveExercise("breathing");
                  setBreathingStep("Inhale");
                  setBreathingTimer(4);
                }}
                className={`flex items-center gap-3 w-full text-left p-3.5 rounded-[20px] border transition-all cursor-pointer ${
                  activeExercise === "breathing"
                    ? "border-[#5A6A4A] bg-[#E8EDE0] text-[#5A6A4A] font-semibold"
                    : "border-[#E0E0D5] bg-white hover:bg-[#F5F5F0]/60 hover:border-[#5A6A4A]/50"
                }`}
              >
                <div className="p-1.5 bg-white rounded-lg shadow-sm text-[#5A6A4A] border border-[#E0E0D5]/50">
                  <Heart className={`w-4 h-4 ${activeExercise === "breathing" ? "animate-pulse" : ""}`} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#3A3A2A]">
                    4-4-4-4 Box Breathing
                  </h4>
                  <p className="text-[11px] text-[#6B6B5B] mt-0.5 line-clamp-1">
                    Reset heartbeat and focus
                  </p>
                </div>
              </button>

              <button
                id="btn-start-grounding"
                onClick={() => {
                  setActiveExercise("grounding");
                  setGroundingStep(5);
                }}
                className={`flex items-center gap-3 w-full text-left p-3.5 rounded-[20px] border transition-all cursor-pointer ${
                  activeExercise === "grounding"
                    ? "border-[#8A5A4A] bg-[#F2E8E0] text-[#8A5A4A] font-semibold"
                    : "border-[#E0E0D5] bg-white hover:bg-[#F5F5F0]/60 hover:border-[#8A5A4A]/50"
                }`}
              >
                <div className="p-1.5 bg-white rounded-lg shadow-sm text-[#8A5A4A] border border-[#E0E0D5]/50">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#3A3A2A]">
                    5-4-3-2-1 Grounding Game
                  </h4>
                  <p className="text-[11px] text-[#6B6B5B] mt-0.5 line-clamp-1">
                    Halt severe overthinking loops
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Safety Info Bar */}
        <div className="mt-6 md:mt-0 space-y-3">
          <button
            id="btn-safety-trigger"
            onClick={() => setShowSafetyModal(true)}
            className="flex items-center gap-2.5 w-full justify-center py-2.5 px-4 rounded-[20px] border border-[#E2D8D0] bg-[#F2E8E0] hover:bg-[#EBE0D8] text-[#8A5A4A] font-bold text-xs cursor-pointer transition-all shadow-sm"
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            Crisis Safety Resources
          </button>

          <button
            id="btn-clear-memory"
            onClick={onReset}
            className="w-full text-center text-xs font-semibold uppercase tracking-wider text-[#8C8C7B] hover:text-[#5A6A4A] hover:underline cursor-pointer"
          >
            Clear current conversation memory
          </button>
        </div>
      </aside>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-black"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-xs bg-white h-full relative z-10 p-6 flex flex-col justify-between overflow-y-auto"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-[#8C8C7B]">
                      Mental Sanctum
                    </span>
                    <h2 className="text-xl font-serif italic text-[#3A3A2A]">
                      QuietSpace
                    </h2>
                  </div>
                  <button
                    id="btn-close-mobile-menu"
                    onClick={() => setIsMenuOpen(false)}
                    className="p-2 rounded-xl text-[#6B6B5B] hover:text-[#5A6A4A] hover:bg-[#F5F5F0] border border-transparent hover:border-[#E0E0D5] transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Active Profile Info */}
                <div className={`p-4 rounded-[24px] border ${currentVibeDetails.bg} space-y-3 shadow-none`}>
                  <div className="flex items-center gap-3">
                    <span className="p-2 bg-white rounded-xl shadow-sm border border-[#E0E0D5]/40 text-current">
                      <CompIcon className="w-4.5 h-4.5" />
                    </span>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                        Companion style
                      </dt>
                      <dd className="font-bold text-sm">
                        {currentVibeDetails.title}
                      </dd>
                    </div>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-black/5">
                    <span className="text-[10px] font-semibold opacity-85 block">Chatting with:</span>
                    <p className="font-bold text-sm flex items-center gap-1.5 text-[#3A3A2A]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5A6A4A] animate-pulse" />
                      {profile.name}
                    </p>
                  </div>

                  {profile.customTopic && (
                    <div className="space-y-1 pt-2 border-t border-black/5">
                      <span className="text-[10px] font-semibold opacity-85 block">What's on your mind:</span>
                      <p className="text-xs italic line-clamp-2 text-current opacity-90 font-medium">
                        "{profile.customTopic}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Rapid Interactive Safe-Space Exercises Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-[#8C8C7B]">
                    Grounding Exercises
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      id="btn-m-start-breathing"
                      onClick={() => {
                        setActiveExercise("breathing");
                        setBreathingStep("Inhale");
                        setBreathingTimer(4);
                        setIsMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full text-left p-3.5 rounded-[20px] border transition-all cursor-pointer ${
                        activeExercise === "breathing"
                          ? "border-[#5A6A4A] bg-[#E8EDE0] text-[#5A6A4A] font-semibold"
                          : "border-[#E0E0D5] bg-white hover:bg-[#F5F5F0]/60 hover:border-[#5A6A4A]/50"
                      }`}
                    >
                      <div className="p-1.5 bg-white rounded-lg shadow-sm text-[#5A6A4A] border border-[#E0E0D5]/50">
                        <Heart className={`w-4 h-4 ${activeExercise === "breathing" ? "animate-pulse" : ""}`} />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-[#3A3A2A]">
                          4-4-4-4 Box Breathing
                        </h4>
                        <p className="text-[11px] text-[#6B6B5B] mt-0.5 line-clamp-1">
                          Reset heartbeat and focus
                        </p>
                      </div>
                    </button>

                    <button
                      id="btn-m-start-grounding"
                      onClick={() => {
                        setActiveExercise("grounding");
                        setGroundingStep(5);
                        setIsMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full text-left p-3.5 rounded-[20px] border transition-all cursor-pointer ${
                        activeExercise === "grounding"
                          ? "border-[#8A5A4A] bg-[#F2E8E0] text-[#8A5A4A] font-semibold"
                          : "border-[#E0E0D5] bg-white hover:bg-[#F5F5F0]/60 hover:border-[#8A5A4A]/50"
                      }`}
                    >
                      <div className="p-1.5 bg-white rounded-lg shadow-sm text-[#8A5A4A] border border-[#E0E0D5]/50">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-[#3A3A2A]">
                          5-4-3-2-1 Grounding Game
                        </h4>
                        <p className="text-[11px] text-[#6B6B5B] mt-0.5 line-clamp-1">
                          Halt overthinking loops
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    id="btn-m-settings"
                    onClick={() => {
                      setIsSettingsOpen(true);
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-3 w-full text-left p-3.5 rounded-[20px] border border-[#E0E0D5] bg-white hover:bg-[#F5F5F0]/60 transition-all cursor-pointer animate-none"
                  >
                    <div className="p-1.5 bg-white rounded-lg shadow-sm text-[#5A6A4A] border border-[#E0E0D5]/50">
                      <SlidersHorizontal className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-[#3A3A2A]">
                        Companion Settings
                      </h4>
                      <p className="text-[11px] text-[#6B6B5B] mt-0.5">
                        Change companion details and style
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  id="btn-m-safety"
                  onClick={() => {
                    setShowSafetyModal(true);
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center gap-2.5 w-full justify-center py-2.5 px-4 rounded-[20px] border border-[#E2D8D0] bg-[#F2E8E0] hover:bg-[#EBE0D8] text-[#8A5A4A] font-bold text-xs cursor-pointer transition-all shadow-sm"
                >
                  <LifeBuoy className="w-3.5 h-3.5" />
                  Crisis Safety Resources
                </button>

                <button
                  id="btn-m-clear-memory"
                  onClick={() => {
                    onReset();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-center text-xs font-semibold uppercase tracking-wider text-[#8C8C7B] hover:text-[#5A6A4A] hover:underline cursor-pointer"
                >
                  Clear conversation memory
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main chat center */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Grounding Exercise Panel / Header Overlay */}
        <AnimatePresence>
          {activeExercise !== "none" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-white border-b border-[#E0E0D5] overflow-hidden relative z-10 shrink-0 shadow-sm"
            >
              <div className="p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 max-w-4xl mx-auto">
                {activeExercise === "breathing" ? (
                  <div className="flex items-center gap-5 w-full">
                    {/* Breathing animated circle */}
                    <div className="relative shrink-0 flex items-center justify-center w-20 h-20 bg-[#F5F5F0] rounded-full border border-[#E0E0D5]">
                      <motion.div
                        animate={{
                          scale:
                            breathingStep === "Inhale"
                              ? 1.4
                              : breathingStep === "Hold"
                              ? 1.4
                              : breathingStep === "Exhale"
                              ? 0.95
                              : 1.0,
                        }}
                        transition={{
                          duration: 4,
                          ease: "easeInOut",
                        }}
                        className={`w-12 h-12 rounded-full absolute ${
                          breathingStep === "Inhale"
                            ? "bg-[#E8EDE0]/80"
                            : breathingStep === "Hold"
                            ? "bg-[#D8DDD0]/85 animate-pulse"
                            : "bg-[#F2E8E0]/80"
                        }`}
                      />
                      <span className="relative z-10 font-bold text-sm text-[#4A4A3A]">
                        {breathingTimer}s
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8C8C7B]">
                        Active Box Breathing Technique
                      </span>
                      <h3 className="font-serif italic text-base text-[#3A3A2A] leading-snug">
                        {breathingStep === "Inhale" && "Gently breathe in through your nose..."}
                        {breathingStep === "Hold" && "Hold the air inside your lungs. Relax..."}
                        {breathingStep === "Exhale" && "Slowly let the breath go. Free everything..."}
                        {breathingStep === "Rest" && "Stay empty. Take this brief moment to sit still..."}
                      </h3>
                      <p className="text-xs text-[#8C8C7B]">
                        Follow the shrinking/expanding bubble. Match your pace and feel your body settle.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 w-full">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8C8C7B]">
                        The 5-4-3-2-1 Mental Anchor
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#E8EDE0] text-[#5A6A4A] border border-[#D8DDD0] font-bold">
                        Step {6 - groundingStep} of 5
                      </span>
                    </div>

                    <div className="min-h-[3.5rem] flex items-center">
                      <h3 className="font-serif italic text-[#3A3A2A] text-base leading-snug">
                        {groundingStep === 5 && "👀 Look around: Find 5 separate things you can SEE."}
                        {groundingStep === 4 && "✋ Reach out: Find 4 distinct things you can TOUCH physically."}
                        {groundingStep === 3 && "👂 Listen up: Name 3 unique sounds you can HEAR right now."}
                        {groundingStep === 2 && "👃 Take a sniff: Identify 2 distinct scents you can SMELL in the air."}
                        {groundingStep === 1 && "👅 Focus inward: Acknowledge 1 pleasant thing you can TASTE or feel inside."}
                      </h3>
                    </div>

                    <div className="flex gap-2">
                      {groundingStep > 1 ? (
                        <button
                          id="btn-grounding-next"
                          onClick={() => setGroundingStep((prev) => prev - 1)}
                          className="px-5 py-2.5 bg-[#5A6A4A] hover:bg-[#4A5A3A] text-white rounded-[20px] text-xs font-bold cursor-pointer transition-all shadow-sm"
                        >
                          I've Done This (Next Step)
                        </button>
                      ) : (
                        <button
                          id="btn-grounding-finish"
                          onClick={() => setActiveExercise("none")}
                          className="px-5 py-2.5 bg-[#5A6A4A] hover:bg-[#4A5A3A] text-white rounded-[20px] text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          I'm Back In My Body (Done!)
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <button
                  id="btn-close-exercise"
                  onClick={() => setActiveExercise("none")}
                  className="px-4 py-2 border border-[#E0E0D5] rounded-[20px] hover:bg-[#F5F5F0]/60 text-[#6B6B5B] text-xs font-bold cursor-pointer shrink-0"
                >
                  Hide Exercise
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

         {/* Dynamic elegant Natural Tones header */}
        <header className="flex items-center justify-between p-4 md:p-6 pb-4 border-b border-[#E0E0D5]/50 max-w-4xl w-full mx-auto shrink-0 relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu toggle */}
            <button
              id="btn-mobile-menu"
              onClick={() => setIsMenuOpen(true)}
              className="md:hidden p-2.5 rounded-xl text-[#6B6B5B] hover:text-[#5A6A4A] hover:bg-[#F5F5F0] border border-[#E0E0D5] transition-all cursor-pointer shrink-0"
              title="Open Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-serif italic text-[#3A3A2A] truncate">Hey {profile.name}.</h1>
              <p className="text-[#8C8C7B] text-xs md:text-sm mt-0.5 truncate">Good to see you again. How are you holding up today?</p>
            </div>
          </div>
          <div className="text-right hidden sm:block shrink-0">
            <p className="text-xs font-bold uppercase tracking-widest text-[#8C8C7B]">
              {new Date().toLocaleDateString([], { month: "long", day: "numeric" })}
            </p>
            <p className="text-xs text-[#6B6B5B] mt-0.5 font-medium">
              {new Date().toLocaleDateString([], { weekday: "long" })}
            </p>
          </div>
        </header>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-4xl w-full mx-auto relative">
          
          {messages.length === 0 && (
            <div className="max-w-2xl mx-auto text-center space-y-8 pt-12 pb-6">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-block p-4 bg-[#E8EDE0] rounded-full border border-[#D8DDD0]"
              >
                <div className="p-3 bg-white rounded-full shadow-sm text-[#5A6A4A]">
                  <Heart className="w-6 h-6 animate-pulse" />
                </div>
              </motion.div>

              <div className="space-y-3">
                <h3 className="text-2xl md:text-3xl font-serif italic text-[#3A3A2A]">
                  Welcome to Your Quiet Space
                </h3>
                <p className="text-sm text-[#8C8C7B] max-w-md mx-auto leading-relaxed font-semibold">
                  I'm here to listen, exactly as you are. Tap a category prompt below or share your thoughts in the text box.
                </p>
              </div>

              <div className="pt-6 border-t border-[#E0E0D5]">
                <PromptTips onSelect={handleSendMessage} />
              </div>
            </div>
          )}

          <div className="space-y-6">
            {messages.map((item) => {
              const isUser = item.role === "user";
              return (
                <div
                  key={item.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"} items-start gap-3`}
                >
                  {!isUser && (
                    <span className={`p-2 shrink-0 bg-white rounded-xl shadow-sm border border-[#E0E0D5] ${currentVibeDetails.accentText}`}>
                      <CompIcon className="w-5 h-5" />
                    </span>
                  )}
                  
                  <div className={`max-w-[85%] md:max-w-[70%] space-y-1.5`}>
                    <div
                      className={
                        isUser
                          ? "bg-white p-5 rounded-[32px] rounded-br-[4px] shadow-sm text-sm leading-relaxed border border-[#E0E0D5] text-[#4A4A3A]"
                          : `bg-[#F5F5F0] border-2 ${currentVibeDetails.accentBorder} p-6 rounded-[32px] rounded-bl-[4px] space-y-4 text-left shadow-sm`
                      }
                    >
                      {/* Rich formatting: first block is structural validation serif italic, remainder is clean text */}
                      {item.content.split("\n\n").map((para, pIdx) => (
                        <p
                          key={pIdx}
                          className={
                            !isUser && pIdx === 0
                              ? `text-lg font-serif italic ${currentVibeDetails.accentText} leading-snug`
                              : "text-sm text-[#4A4A3A] leading-relaxed font-normal"
                          }
                        >
                          {para}
                        </p>
                      ))}
                    </div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider text-[#8C8C7B] mt-1.5 ${isUser ? "text-right" : "text-left"}`}>
                      {isUser ? "You" : currentVibeDetails.title} • {item.timestamp}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start items-start gap-4 animate-pulse">
                <span className={`p-2 shrink-0 bg-white rounded-xl shadow-sm border border-[#E0E0D5] ${currentVibeDetails.accentText}`}>
                  <CompIcon className="w-5 h-5 animate-spin-slow" />
                </span>
                <div className="space-y-1.5 bg-[#F5F5F0] border border-[#E0E0D5] px-6 py-4 rounded-[32px] rounded-bl-[4px] max-w-[50%]">
                  <div className="flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8C8C7B] animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8C8C7B] animate-bounce delay-100" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8C8C7B] animate-bounce delay-200" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#8C8C7B] block mt-1">
                    Your companion is writing...
                  </span>
                </div>
              </div>
            )}

            {errorText && (
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 text-rose-800 text-xs font-bold text-center max-w-md mx-auto">
                {errorText}
              </div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="bg-white border-t border-[#E0E0D5] p-4 md:p-6 relative z-10 shrink-0">
          <div className="max-w-4xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (inputText.trim()) {
                  handleSendMessage(inputText);
                }
              }}
              className="relative flex items-center"
            >
              <input
                id="main-chat-input"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Share what you are feeling, ${profile.name}...`}
                disabled={isLoading}
                className="w-full bg-white border border-[#E0E0D5] rounded-[24px] md:rounded-[32px] py-4 md:py-6 pl-5 pr-14 md:pl-8 md:pr-16 text-sm focus:outline-none focus:border-[#5A6A4A] placeholder-[#8C8C7B] shadow-inner text-[#4A4A3A]"
              />
              <button
                id="btn-send-message"
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="absolute right-2.5 md:right-4 bg-[#5A6A4A] text-white p-2.5 md:p-3.5 rounded-full hover:bg-[#4A5A3A] hover:shadow-sm transition-all active:scale-[0.97] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-center text-[10px] text-[#8C8C7B] mt-4 uppercase tracking-[0.2em] font-bold">
              I'm here to listen, exactly as you are.
            </p>
          </div>
        </div>
      </main>

      {/* Settings / Companion Profile Edit Drawer */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-md bg-[#F5F5F0] border-l border-[#E0E0D5] h-full relative z-10 p-6 flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-[#E0E0D5]">
                  <h3 className="font-serif italic text-lg text-[#3A3A2A] flex items-center gap-2">
                    <SlidersHorizontal className="w-4.5 h-4.5 text-[#5A6A4A]" />
                    Customize Your Companion
                  </h3>
                  <button
                    id="btn-close-settings"
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1 rounded-lg hover:bg-white/50 text-[#8C8C7B]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#8C8C7B]">
                      Your Name
                    </label>
                    <input
                      id="edit-inp-name"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-[20px] border border-[#E0E0D5] bg-white text-[#4A4A3A] focus:outline-none focus:ring-1 focus:ring-[#5A6A4A] focus:border-[#5A6A4A] font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#8C8C7B]">
                      Struggling With (Ongoing Context)
                    </label>
                    <textarea
                      id="edit-inp-topic"
                      value={editTopic}
                      onChange={(e) => setEditTopic(e.target.value)}
                      placeholder="Add an ongoing struggle to keep continuity focus active"
                      rows={2}
                      className="w-full px-4 py-3 rounded-[20px] border border-[#E0E0D5] bg-white text-[#4A4A3A] focus:outline-none focus:ring-1 focus:ring-[#5A6A4A] focus:border-[#5A6A4A] placeholder:text-[#8C8C7B] text-sm"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#8C8C7B]">
                      Companion Vibe style
                    </label>
                    <div className="space-y-2">
                      {[
                        { id: "gentle" as CompanionVibe, title: "The Gentle Listener", icon: Moon, activeBorder: "border-[#5A6A4A] bg-[#E8EDE0] text-[#5A6A4A]" },
                        { id: "chill" as CompanionVibe, title: "The Chill Buddy", icon: Compass, activeBorder: "border-[#8A5A4A] bg-[#F2E8E0] text-[#8A5A4A]" },
                        { id: "cheerleader" as CompanionVibe, title: "The Encouraging Cheerleader", icon: Flame, activeBorder: "border-[#8B7E72] bg-[#F9F4EE] text-[#8B7E72]" },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = editVibe === item.id;
                        return (
                          <button
                            id={`settings-vibe-btn-${item.id}`}
                            key={item.id}
                            type="button"
                            onClick={() => setEditVibe(item.id)}
                            className={`flex items-center justify-between w-full p-3.5 rounded-[20px] border text-left text-xs font-bold cursor-pointer transition-all ${
                              isSelected
                                ? item.activeBorder
                                : "border-[#E0E0D5] bg-white hover:bg-white/50 text-[#6B6B5B]"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Icon className="w-4.5 h-4.5" />
                              {item.title}
                            </span>
                            {isSelected && <span className="w-2 h-2 rounded-full bg-current" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    id="btn-save-settings"
                    type="submit"
                    className="w-full py-4 bg-[#5A6A4A] hover:bg-[#4A5A3A] text-white rounded-[28px] text-xs font-bold cursor-pointer transition-all mt-4 shadow-sm"
                  >
                    Save & Update Vibe Check
                  </button>
                </form>
              </div>

              <div className="p-4 rounded-[24px] bg-white border border-[#E0E0D5] text-center shadow-none">
                <p className="text-xs text-[#6B6B5B] italic leading-relaxed">
                  "Changing companion vibe re-evaluates the tone. They'll acknowledge you under their new personality."
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Extreme crisis support resources modal */}
      <AnimatePresence>
        {showSafetyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSafetyModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            />
            {/* Box */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-white rounded-[32px] border border-[#E0E0D5] shadow-sm p-6 relative z-10 space-y-5 text-[#4A4A3A]"
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-3 items-center text-[#A84343]">
                  <span className="p-2 bg-[#F2E8E0] rounded-xl border border-[#E2D8D0]">
                    <LifeBuoy className="w-6 h-6 animate-pulse" />
                  </span>
                  <div>
                    <h3 className="font-serif italic text-xl text-[#3A3A2A]">
                      Please know you're not alone
                    </h3>
                    <p className="text-xs text-[#8A5A4A] font-semibold mt-0.5">
                      We want to make sure you have the support you need.
                    </p>
                  </div>
                </div>
                <button
                  id="btn-close-safety"
                  onClick={() => setShowSafetyModal(false)}
                  className="p-1 rounded-lg hover:bg-[#F5F5F0] text-[#8C8C7B]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5 text-sm text-[#4A4A3A] leading-relaxed">
                <p className="font-medium">
                  I'm incredibly sorry you're carrying such a heavy weight right now. As a companion, I'm always ready to listen, but please connect with real professionals who are trained and deeply care about keeping you safe.
                </p>

                <div className="p-4 rounded-[24px] bg-[#F9F4EE] border border-[#EAE2D8] space-y-3">
                  <h4 className="font-bold text-[#8B7E72] text-xs uppercase tracking-widest">
                    Immediate Crisis Assistance
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-sm text-[#3A3A2A] block">
                          Suicide & Crisis Lifeline
                        </span>
                        <span className="text-xs text-[#8C8C7B] font-medium">Free, confidential 24/7 care</span>
                      </div>
                      <a
                        href="tel:988"
                        className="px-4 py-2 rounded-[20px] bg-[#A84343] hover:bg-[#903232] text-white font-bold text-xs shadow-sm cursor-pointer transition-all"
                      >
                        Call / Text 988
                      </a>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#EAE2D8]">
                      <div>
                        <span className="font-bold text-sm text-[#3A3A2A] block">
                          Counselor Text Line
                        </span>
                        <span className="text-xs text-[#8C8C7B] font-medium">Text HOME for text counselor</span>
                      </div>
                      <a
                        href="sms:741741"
                        className="px-4 py-2 rounded-[20px] bg-[#5A6A4A] hover:bg-[#4A5A3A] text-white font-bold text-xs shadow-sm cursor-pointer transition-all"
                      >
                        Text HOME to 741741
                      </a>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[#8C8C7B] font-medium">
                  If you are outside of the United States, please visit{" "}
                  <a
                    href="https://findahelpline.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[#5A6A4A] underline"
                  >
                    findahelpline.com
                  </a>{" "}
                  to find free, local, confidential crisis lines in your country instantly.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  id="btn-safety-confirm"
                  onClick={() => setShowSafetyModal(false)}
                  className="px-5 py-2.5 bg-[#5A6A4A] text-white hover:bg-[#4A5A3A] rounded-[20px] font-bold text-xs shadow-sm cursor-pointer transition-all"
                >
                  Okay, understood
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
