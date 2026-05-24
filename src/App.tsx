/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import Onboarding from "./components/Onboarding";
import ActiveCompanion from "./components/ActiveCompanion";
import { UserProfile, Message } from "./types";

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedProfile = localStorage.getItem("quietspace_profile");
      const storedMessages = localStorage.getItem("quietspace_messages");

      if (storedProfile) {
        setProfile(JSON.parse(storedProfile));
      }
      if (storedMessages) {
        setMessages(JSON.parse(storedMessages));
      }
    } catch (e) {
      console.error("Failed to load local settings:", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save profile to localStorage on updates
  useEffect(() => {
    if (!profile) return;
    localStorage.setItem("quietspace_profile", JSON.stringify(profile));
  }, [profile]);

  // Save messages to localStorage on updates
  useEffect(() => {
    if (!profile) return; // Only store messages if profile exists
    localStorage.setItem("quietspace_messages", JSON.stringify(messages));
  }, [messages, profile]);

  const handleOnboardingComplete = (newProfile: UserProfile) => {
    setProfile(newProfile);
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to clear your conversation history? Your profile and choices will be saved.")) {
      setMessages([]);
      localStorage.removeItem("quietspace_messages");
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#faf8f5] dark:bg-[#121110] text-[#2c2825] dark:text-[#f3f0ec] flex flex-col justify-center items-center">
        <div className="flex flex-col items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-amber-600/20 border border-amber-500 animate-ping inline-block" />
          <p className="text-xs font-semibold text-[#8b7e72]">Opening QuietSpace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] dark:bg-[#121110]">
      {profile && profile.isOnboarded ? (
        <ActiveCompanion
          profile={profile}
          setProfile={setProfile}
          messages={messages}
          setMessages={setMessages}
          onReset={handleReset}
        />
      ) : (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}
    </div>
  );
}
