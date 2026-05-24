/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { UserProfile, CompanionVibe } from "../types";
import { User, MessageCircle, Flame, Moon, Compass, ChevronRight } from "lucide-react";
import { motion } from "motion/react";

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [name, setName] = useState("");
  const [vibe, setVibe] = useState<CompanionVibe>("chill");
  const [customTopic, setCustomTopic] = useState("");
  const [errorCode, setErrorCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorCode("Please let me know what to call you! It makes things feel more personal.");
      return;
    }
    onComplete({
      name: name.trim(),
      vibe,
      customTopic: customTopic.trim() || undefined,
      isOnboarded: true,
    });
  };

  const vibes = [
    {
      id: "gentle" as CompanionVibe,
      title: "The Gentle Listener",
      description: "Comforting, highly validating, soft-spoken, and infinitely accepting. Perfect when you feel fragile or just need someone to hold a peaceful space for your thoughts.",
      icon: Moon,
      color: "bg-[#E8EDE0] text-[#5A6A4A] border-[#D8DDD0]",
      activeColor: "ring-2 ring-[#5A6A4A] bg-[#E8EDE0]/60",
    },
    {
      id: "chill" as CompanionVibe,
      title: "The Chill Buddy",
      description: "Relaxed, warm, down-to-earth, and conversational. Speaks like a close friend pulling up a chair with key contractions and casual real-talk validation.",
      icon: Compass,
      color: "bg-[#F2E8E0] text-[#8A5A4A] border-[#E2D8D0]",
      activeColor: "ring-2 ring-[#8A5A4A] bg-[#F2E8E0]/60",
    },
    {
      id: "cheerleader" as CompanionVibe,
      title: "The Uplifting Cheerleader",
      description: "Bright, enthusiastic, warm, positive, and deeply validating. Reminds you of your inner strength and gently highlights the good when things feel gray.",
      icon: Flame,
      color: "bg-[#F9F4EE] text-[#8B7E72] border-[#EAE2D8]",
      activeColor: "ring-2 ring-[#8B7E72] bg-[#F9F4EE]/60",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#4A4A3A] flex flex-col justify-center items-center p-4 selection:bg-[#E8EDE0]">
      {/* Background soft organic circles */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-[#E8EDE0]/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#F2E8E0]/30 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-2xl bg-white rounded-[32px] border border-[#E0E0D5] shadow-sm p-6 md:p-10 relative z-10"
      >
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#E8EDE0] text-[#5A6A4A] mb-4 border border-[#D8DDD0]">
            <MessageCircle className="w-3.5 h-3.5" />
            Your Mind Safe Space
          </span>
          <h1 className="text-3xl md:text-4xl font-serif italic text-[#3A3A2A]">
            Meet Your Companion
          </h1>
          <p className="text-[#8C8C7B] mt-2 max-w-lg mx-auto text-sm md:text-base leading-relaxed">
            No charts, no telemetry, and absolutely no professional jargon. Just a close, empathetic friend here to listen and validate you.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label id="lbl-name" className="block text-sm font-semibold text-[#4A4A3A]">
              What should your companion call you?
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C8C7B]">
                <User className="w-5 h-5" />
              </span>
              <input
                id="inp-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrorCode("");
                }}
                placeholder="For example: Jordan, Terry, Sam..."
                maxLength={40}
                className="w-full pl-12 pr-4 py-3.5 rounded-[24px] border border-[#E0E0D5] bg-[#F5F5F0]/30 text-[#4A4A3A] focus:outline-none focus:ring-2 focus:ring-[#5A6A4A]/20 focus:border-[#5A6A4A] transition-all font-medium placeholder:text-[#8C8C7B]"
              />
            </div>
            {errorCode && (
              <p id="err-name" className="text-rose-700 text-xs font-semibold pl-1">
                {errorCode}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-[#4A4A3A]">
              Choose their supportive vibe:
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {vibes.map((item) => {
                const Icon = item.icon;
                const isSelected = vibe === item.id;
                return (
                  <button
                    id={`btn-vibe-${item.id}`}
                    key={item.id}
                    type="button"
                    onClick={() => setVibe(item.id)}
                    className={`flex flex-col text-left p-4 rounded-[24px] border transition-all cursor-pointer ${
                      isSelected
                        ? item.activeColor + " border-[#5A6A4A] shadow-sm"
                        : "border-[#E0E0D5] bg-[#F5F5F0]/20 hover:bg-[#F5F5F0]/60"
                    }`}
                  >
                    <span className={`p-2 rounded-xl mb-3 inline-block border ${item.color}`}>
                      <Icon className="w-5 h-5" />
                    </span>
                    <h3 className="font-semibold text-sm text-[#3A3A2A]">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[#6B6B5B] mt-1.5 line-clamp-4 leading-relaxed font-normal">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label id="lbl-topic" className="block text-sm font-semibold text-[#4A4A3A]">
              Anything specific weighing on your mind today? (Optional)
            </label>
            <textarea
              id="txt-topic"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="e.g., Struggling with a research deadline, had a fight with a close friend, feeling anxious for no reason..."
              maxLength={150}
              rows={2}
              className="w-full px-4 py-3 rounded-[20px] border border-[#E0E0D5] bg-[#F5F5F0]/30 text-[#4A4A3A] focus:outline-none focus:ring-2 focus:ring-[#5A6A4A]/20 focus:border-[#5A6A4A] transition-all text-sm placeholder:text-[#8C8C7B]"
            />
            <p className="text-[11px] text-[#8C8C7B] pl-1 font-medium italic">
              Selecting this lets your companion greet you with deep, personalized tracking of this situation first.
            </p>
          </div>

          <button
            id="btn-complete-onboarding"
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-4 bg-[#5A6A4A] hover:bg-[#4A5A3A] text-white rounded-[28px] font-semibold shadow-sm active:scale-[0.98] transition-all cursor-pointer mt-4"
          >
            Open Up and Connect
            <ChevronRight className="w-5 h-5" />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
