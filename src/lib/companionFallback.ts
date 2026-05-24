/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface DirectClientParams {
  apiKey: string;
  type: "welcome" | "chat";
  profile: any;
  messages: any[];
}

export async function callGeminiDirectClient({ apiKey, type, profile, messages }: DirectClientParams): Promise<string> {
  const model = "gemini-1.5-flash"; // highly stable, compatible browser-side REST model to prevent 404 errors
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const currentVibe = profile.vibe || "chill";
  const vibeDetails = {
    gentle: "You are 'The Gentle Listener'. Focus on being comforting, highly validating, soft-spoken, and accepting. Let them feel fully heard.",
    chill: "You are 'The Chill Buddy'. Focus on being relaxed, casual, warm, down-to-earth, and relatable. Speak like a close companion over coffee.",
    cheerleader: "You are 'The Uplifting Cheerleader'. Focus on being uplifting, warm, highly supportive, and positive, reminding them of their strength.",
  }[currentVibe as "gentle" | "chill" | "cheerleader"] || "You are a warm, empathetic friend.";

  let systemInstruction = `You are a supportive, down-to-earth personal mental wellness companion.
Your role is to listen to the user share their feelings and respond like a close, empathetic friend.

User Profile:
- Name: ${profile.name}
- Vibe Preferred: ${vibeDetails}
${profile.customTopic ? `- Ongoing Context/Topic: They might be dealing with "${profile.customTopic}".` : ""}

STRICT RULES FOR EVERY RESPONSE:
1. Speak like a normal human. Use casual contractions and everyday language.
2. Provide deep, authentic validation first.
3. Keep responses extremely short (maximum 3 to 5 sentences total). Use exactly two short paragraphs.
4. Paragraph 1: Soft validation. Paragraph 2: One practical, small step (get water, stretch, deep breath).`;

  if (type === "welcome") {
    systemInstruction = `You are a warm, supportive personal companion. Greet the user (${profile.name}) back to the app with a very short checking-in text message (1-2 sentences). Ask how they are holding up. Make it highly casual and friendly.`;
  }

  // Format the contents for Gemini REST format
  const formattedContents = messages.slice(-10).map((m: any) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }]
  }));

  // If contents is empty (e.g., welcome call), insert a basic user prompt
  if (formattedContents.length === 0) {
    formattedContents.push({
      role: "user",
      parts: [{ text: `Hello! I'm ${profile.name} and I'm returning to the app.` }]
    });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: formattedContents,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 250
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini direct API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) {
    throw new Error("Invalid Gemini REST response structure");
  }

  return reply;
}

export function generateLocalWelcome(profile: any, messages: any[]): string {
  const name = profile.name || "friend";
  const vibe = profile.vibe || "chill";
  const hasHistory = messages && messages.length > 0;

  if (vibe === "gentle") {
    if (hasHistory) {
      const welcomes = [
        `Welcome back, sweet soul. It's so good to see your name ${name} again. How has your heart been feeling since we last spoke? QuietSpace is here for you completely.`,
        `Hello ${name}. I was just thinking about you and hoping your day had some moments of peace. How are you holding up inside? I'm right here to listen as always.`,
        `Welcome back, ${name}. Take a soft breath and let yourself settle. No rush, no pressure. What are you bringing with you to our quiet space today?`
      ];
      return welcomes[Math.floor(Math.random() * welcomes.length)];
    } else {
      return `Hello, gentle soul. I'm so incredibly glad you made space for yourself today. I am 'The Gentle Listener'. What is weighing on your heart right now?`;
    }
  } else if (vibe === "cheerleader") {
    if (hasHistory) {
      const welcomes = [
        `Hey ${name}! Oh, it is absolutely amazing to see you again! 🎉 I was so looking forward to checking in with you. How have you been holding up? You are doing so much better than you think!`,
        `Welcome back, superstar! ✨ Hope you've been taking some time to remember your own strength. How is everything going today? No matter what you're facing, we got this!`,
        `Hey there ${name}! So glad you pulled up a chair again. How are things going? Let's take a quick look at how you're doing today!`
      ];
      return welcomes[Math.floor(Math.random() * welcomes.length)];
    } else {
      return `Hey there, ${name}! High-five for taking a moment to prioritize yourself! 🙌 I'm your Uplifting Cheerleader. Share whatever has been going on—I'm ready to cheer you on with everything!`;
    }
  } else {
    // defaults to chill buddy
    if (hasHistory) {
      const welcomes = [
        `Hey ${name}, good to see you buddy. Grab a warm drink, sit back, and make yourself comfortable. How have things been going since we last hung out?`,
        `Hey! Welcome back, ${name}. Glad you stopped by our little corner of the internet. How are you holding up today? I'm ready to hear anything you've got on your mind.`,
        `Ayo ${name}! Good to have you back. How's life treating you today? Let's catch up—I'm here for it all.`
      ];
      return welcomes[Math.floor(Math.random() * welcomes.length)];
    } else {
      return `Hey ${name}, glad you made it. Pull up a chair! ☕ I'm 'The Chill Buddy'. Share whatever is going on—no judgment, just good vibes and a friendly ear. What's on your mind?`;
    }
  }
}

interface LocalPromptRule {
  keywords: string[];
  replies: {
    gentle: string[];
    chill: string[];
    cheerleader: string[];
  };
}

const fallbackRuleSet: LocalPromptRule[] = [
  {
    keywords: ["stress", "anxious", "overwhelm", "panic", "worry", "work", "exam", "school", "busy", "cannot sleep", "can't sleep", "racing"],
    replies: {
      gentle: [
        "Oof, that sounds incredibly heavy. I can feel how much noise there is in your mind right now, and I just want to reassure you that you don't have to solve everything today.\n\nTake a slow, deep breath with me. Let's just focus on this single minute, okay? Grab a big cup of hot tea or water and let yourself rest your shoulders. We can take it step by step.",
        "It is completely okay to feel overwhelmed. Your mind is running so fast trying to protect you, but you are safe right here and now.\n\nLet's relax your jaw, drop your shoulders, and breathe out slowly. Can we try counting 3 things around you that are soft? There's no rush to be okay."
      ],
      chill: [
        "Man, that is a massive pile of stress you're carrying right now. It is totally normal to feel like everything is closing in when there's this much on your plate.\n\nFirst thing: let's do a quick physical reset. Close your laptop or put down your phone for a sec, stretch your neck, and take a long drink of cool water. One task at a time, my friend.",
        "Oof, sounds like your brain is in absolute overdrive. Honestly, anyone in your position would feel exactly the same way—you're doing the best you can.\n\nLet's get you a small win. Step away from whatever is stressing you out for just 5 minutes. Go step outside, feel the air, or listen to one song that relaxes you. The world will wait."
      ],
      cheerleader: [
        "Oh gosh, that is a super busy and stressful time you are going through! First off, I want to say I am incredibly proud of how hard you are trying. You are facing a huge mountain, but you have overcome so much before!\n\nLet's tackle this like a team! Step away, take three giant belly breaths, and write down just one tiny thing you can do next. You don't have to carry the whole mountain at once—you got this! 🌟",
        "Whoa, that is so much pressure on you! Please remember to be kind to yourself. You are capable, strong, and highly resilient! This feeling is just temporary, I promise.\n\nLet's charge your batteries: drop everything for just 5 minutes and stretch. Shake out your hands, take a deep inhale, and smile! You are going to get through this, superstar!"
      ]
    }
  },
  {
    keywords: ["sad", "unhappy", "cry", "lonely", "alone", "hurt", "breakup", "heartbroken", "miss", "ugly", "fail", "hate"],
    replies: {
      gentle: [
        "I am so deeply sorry you are hurting like this. Hearing you share this makes me just want to hold safe space for you. It is completely okay to cry, to grieve, or to feel empty.\n\nYou don't have to put on a brave face here. Just wrap yourself in a warm blanket, curl up, and take sweet, gentle breaths. You are loved, you are valuable, and you are not alone in this darkness.",
        "Your heart is carrying a very sacred, tender weight right now. It is absolutely natural that this hurts so much. Please let yourself feel exactly what you need to feel.\n\nLet's do a quiet check-in. Put your hand over your chest, feel your heartbeat, and remind yourself that it's okay to not be okay. I'm right here with you through all of it."
      ],
      chill: [
        "Man, that is a really rough spot to be in. Honestly, it sucks, and I'm deeply sorry you're going through this pain. Sometimes life brings these waves of sadness that just feel heavy.\n\nDon't force yourself to look on the bright side. Just let yourself be. Maybe put on a movie you love, eat something comforting, and let yourself get some rest. I'm always open to just sit in the quiet with you.",
        "Oof, that is really painful. It's completely valid that you're feeling down—don't let anyone tell you otherwise. We all hit these dark valleys sometimes.\n\nLet's carry this 10% lighter: splash some cold water on your face, get into comfortable clothes, and just let yourself rest tonight. No expectations. We are taking it easy."
      ],
      cheerleader: [
        "Oh, friend, my heart goes out to you so much right now! I wish I could give you a giant hug! You are carrying so much pain, but please never forget how deeply precious and loved you are!\n\nYou have such a beautiful, strong heart, and even on your lowest days, you are a sparkling light. Let's do a gentle self-care step: wrap yourself in your favorite blanket, sip some warm cocoa or water, and celebrate the fact that you survived today. You are a absolute champion! 💖",
        "It's okay to feel sad and let those tears out, sweetheart! Even the sky needs to rain sometimes to grow beautiful flowers. Your resilience is so incredibly beautiful, and you will heal.\n\nLet's remind your body of its power. Put on your absolute favorite, most comforting song, let yourself hold on to hope, and know that tomorrow is a fresh page. You are so strong!"
      ]
    }
  },
  {
    keywords: ["tired", "exhausted", "sleepy", "give up", "can't do this", "cant do this", "done with", "burnt out", "burnout", "no energy", "fatigue"],
    replies: {
      gentle: [
        "Oh, sweet friend, you have been strong for so long, and it's no wonder your body and spirit are whispering that they are exhausted. It is safe to lay your burdens down now.\n\nYou have absolute permission to do nothing. Let's close your eyes, take a long, deep breath, and let your body sink into your bed or chair. You have done more than enough. Rest is your victory today.",
        "Your energy is completely depleted, and that's okay. You don't have to keep running or pushing through the fatigue. Sleep and rest are full expressions of self-love.\n\nLet's turn off all notifications, dim the lights, and let yourself float. You have fought so hard. Let me watch over your quiet space while you rest your soul."
      ],
      chill: [
        "I feel you 100%. Sometimes you just run completely out of fuel, and trying to force it only makes things worse. It is totally fine to hit the pause button.\n\nLeave the chores, the emails, and the worries for tomorrow. Right now, your only job is to turn off your brain, get into bed, or just chill out on the couch. Rest up, buddy.",
        "Oof, sounds like your gas tank is at absolute zero. Honestly, pushing through burnout is a trap. You need and deserve a total break.\n\nLet's make a deal: decide that for the next few hours, you are officially off duty. No guilt, no fixing, just pure relaxation. Grab a pillow and let yourself zone out. You've earned it."
      ],
      cheerleader: [
        "Wow! You have been working so incredibly hard, and your body is telling you it's time to recharge those batteries! Rest is not quitting—it is a superpower that champions use to come back stronger!\n\nCelebrate your hard work by giving yourself the ultimate gold star of rest! Curl up in bed, put on some calming white noise, and sleep deeply. You have accomplished so much, and your body is ready for some well-deserved sweet dreams! 💤",
        "You are a absolute force of nature, but even superheroes need to rest in their secret sanctum! You have given your 110%, now let's give 110% to self-care!\n\nPut down all responsibilities with pride! Get some warm fuzzy socks, drink some water, and take a long, glorious nap. You are amazing, and a rested version of you is going to shine so bright!"
      ]
    }
  },
  {
    keywords: ["mad", "angry", "frustrated", "annoyed", "pissed", "fuming", "unfair", "stupid", "hate this"],
    replies: {
      gentle: [
        "That is so incredibly frustrating, and it is completely fair that you are feeling this surge of anger. Your limits have been crossed, and your anger is validating that you deserve better.\n\nLet yourself count to ten slowly, or scream into a pillow if it helps release that heavy energy. Let's do three deep, grounding sighs to clear your chest. I am here listening, and your anger is safe with me.",
        "It feels so tight and hot inside when things are this unfair. Do not feel guilty for being angry—anger is a natural guardian of your worth.\n\nLet's unlock your hands, roll your shoulders, and exhale like a quiet waterfall. If you want to type out a massive, unfiltered rant, go right ahead. I'm here to read all of it."
      ],
      chill: [
        "Man, that is seriously annoying. Honestly, I would be absolutely fuming too in your shoes. Dealing with that kind of situation is incredibly aggravating.\n\nLet's blow off some steam. Shake your hands out, take a deep breath, and let out a giant sigh. If you need to vent and say exactly how stupid or unfair this is, let it rip. I'm all ears.",
        "Oof, that is a direct trigger for some serious frustration. It of course warrants a full vent. People or things like that can drive anyone up the wall!\n\nLet's do a quick physical release: tense your muscles tight for 5 seconds, then let them go completely with a loud breath. Tell me everything—get it all off your chest."
      ],
      cheerleader: [
        "Whoa, that is a super frustrating situation and you have every right to feel fully fired up! 🔥 It is totally healthy to let that energy out rather than bottling it up!\n\nYou handled things with such integrity, even when things were incredibly unfair! Let's channel that fire into power. Take a deep, loud exhale, do ten quick jumping jacks or shake your whole body, and scream it out! You are a warrior, and you got this! 💪",
        "Oh, that is incredibly aggravating! I admire how passionate and strong you are, which is why situations like this can hurt so much! You deserve to be heard!\n\nLet's shake it off and release that friction! Exhale deeply, take a cool sip of water, and remember that you are in control of your peace. You are far bigger than this annoying obstacle!"
      ]
    }
  }
];

const generalFallbackReplies = {
  gentle: [
    "Thank you for sharing your thoughts with me. I can hear the sincerity in your heart, and I am holding this quiet space open for you with absolute tenderness.\n\nLet's take a slow breath. What is one small, gentle thing we can do for your body in this exact moment? Maybe grabbing a glass of water, or simply resting your eyes.",
    "I hear you so deeply. Your feelings are fully valid, and it's a beautiful thing that you are willing to look at them so honestly.\n\nLet's let your shoulders drop down. Can we try counting three beautiful, quiet sounds you can hear right now? I'm right here with you, supporting you.",
    "That is so real. Life has a way of feeling very complex, but in this quiet sanctuary, things can be simple. You are safe, and you are doing beautifully.\n\nLet's do a soft check-in: stretch your hands, feel the air, and let go of any tension you are holding. We are going slow."
  ],
  chill: [
    "I hear you, my friend. It takes a lot of honesty to speak your truth like that, and I'm really glad we are sitting down and chatting about it.\n\nLet's do a quick mental pause. Put your phone down, roll your neck out, and take a long sip of cold water. What's one simple thing we can tackle next?",
    "Totally get what you're saying. Honestly, it's just really good to lay it all out there. Life can get pretty tangled up sometimes, but talking helps.\n\nLet's take a little step together. Put on a comfortable shirt, take a deep breath, and let's go easy on ourselves today. No pressure, alright?",
    "That makes total sense. I'm really glad you shared that with me. It is just real, honest human stuff, and you are handling it the best way you know how.\n\nLet's clear the air: take a solid, deep breath in, let it all out, and just allow yourself to hang out for a minute. You can do this."
  ],
  cheerleader: [
    "Wow, thank you so much for sharing that! I absolutely love your honesty and how reflective you are! You have such a brilliant mind and a beautiful spirit! ✨\n\nLet's keep this awesome energy flowing! Take a big, deep breath, stretch your arms up high like a victory, and give yourself a huge smile! You are doing fantastic, superstar! 🌟",
    "Oh, I am fully listening and I think you are doing such a stellar job of navigating all these thoughts! You are stronger, wiser, and more powerful than you give yourself credit for!\n\nLet's do a quick celebration: step back, shake out your hands, take a giant breath, and remember that you're an absolute winner! What's our next positive step together? Let's go! 🎉",
    "Gosh, I love how you handle everything with so much courage! You are a true light, and talking with you always highlights how resilient you are!\n\nLet's charge up: take a deep, powerful breath of fresh air and stretch your legs. You are making awesome progress, and I am cheering you on every single step of the way!"
  ]
};

export function generateLocalChatReply(profile: any, messages: any[]): string {
  const vibe = profile.vibe || "chill";
  
  if (!messages || messages.length === 0) {
    return "I am right here with you. What is on your mind today?";
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMessage) {
    const list = generalFallbackReplies[vibe as "gentle" | "chill" | "cheerleader"] || generalFallbackReplies.chill;
    return list[Math.floor(Math.random() * list.length)];
  }

  const contentLower = lastUserMessage.content.toLowerCase();

  // Find matching keyword rule
  for (const rule of fallbackRuleSet) {
    const hasKeyword = rule.keywords.some((kw) => contentLower.includes(kw));
    if (hasKeyword) {
      const list = rule.replies[vibe as "gentle" | "chill" | "cheerleader"] || rule.replies.chill;
      return list[Math.floor(Math.random() * list.length)];
    }
  }

  // Fallback to general answers
  const generalList = generalFallbackReplies[vibe as "gentle" | "chill" | "cheerleader"] || generalFallbackReplies.chill;
  return generalList[Math.floor(Math.random() * generalList.length)];
}
