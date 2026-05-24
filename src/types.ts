/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CompanionVibe = "gentle" | "chill" | "cheerleader";

export interface UserProfile {
  name: string;
  vibe: CompanionVibe;
  customTopic?: string;
  isOnboarded: boolean;
}

export interface Message {
  id: string;
  role: "user" | "companion";
  content: string;
  timestamp: string;
}

export interface WellnessActivity {
  id: string;
  title: string;
  description: string;
  category: "breathing" | "grounding" | "reflection";
  guide: string[];
}
