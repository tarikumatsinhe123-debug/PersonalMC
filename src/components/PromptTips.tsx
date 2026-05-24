/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CloudRain, Sparkles, Brain, Flame, ArrowRight } from "lucide-react";

interface PromptTipsProps {
  onSelect: (promptText: string) => void;
}

export default function PromptTips({ onSelect }: PromptTipsProps) {
  const categories = [
    {
      label: "Heavy Day",
      text: "I had an incredibly heavy day and just feel totally exhausted or shut down. I don't know where to start.",
      icon: CloudRain,
      color: "border-[#D8DDD0] hover:border-[#5A6A4A] bg-[#E8EDE0]/70 text-[#5A6A4A]",
    },
    {
      label: "Overthinking Loop",
      text: "My brain is carrying ten different thoughts and keeps looping over the same stress. I can't quiet my mind.",
      icon: Brain,
      color: "border-[#E2D8D0] hover:border-[#8A5A4A] bg-[#F2E8E0]/70 text-[#8A5A4A]",
    },
    {
      label: "Vent Space",
      text: "I just need a safe space to vent about something that frustrated me without anyone trying to fix it.",
      icon: Flame,
      color: "border-[#EAE2D8] hover:border-[#8B7E72] bg-[#F9F4EE]/70 text-[#8B7E72]",
    },
    {
      label: "Good News!",
      text: "Something actually went really well today and I wanted to celebrate it with you!",
      icon: Sparkles,
      color: "border-[#E0E0D5] hover:border-[#5A6A4A] bg-[#FFFFFF] text-[#4A4A3A]",
    },
  ];

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-[#8C8C7B] px-1">
        Tap to Start Sharing
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {categories.map((card, i) => {
          const Icon = card.icon;
          return (
            <button
              id={`shortcut-prompt-${i}`}
              key={card.label}
              onClick={() => onSelect(card.text)}
              className={`flex items-start text-left p-4 rounded-[24px] border transition-all duration-200 cursor-pointer group ${card.color}`}
            >
              <div className="p-2 bg-white rounded-xl mr-3 border border-[#E0E0D5] shrink-0 text-[#6B6B5B]">
                <Icon className="w-4 h-4" />
              </div>
              <div className="space-y-0.5 pr-4 relative w-full">
                <span className="font-bold text-xs block">
                  {card.label}
                </span>
                <p className="text-xs opacity-90 line-clamp-2 leading-relaxed font-medium">
                  {card.text}
                </p>
                <span className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-current">
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
