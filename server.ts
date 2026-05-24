import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json());

  // Safe initialize Gemini Client
  const getGeminiClient = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is missing.");
    }
    return new GoogleGenAI({
      apiKey: key || "MOCK_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  const ai = getGeminiClient();

  // Helper system instruction generator
  const getSystemInstructions = (profile: { name: string; vibe: string; customTopic?: string }) => {
    const nameStr = profile.name || "friend";
    const vibeDetails = {
      gentle: "You are 'The Gentle Listener'. Focus on being comforting, highly validating, soft-spoken, and accepting. Let them feel fully heard.",
      chill: "You are 'The Chill Buddy'. Focus on being relaxed, casual, warm, down-to-earth, and relatable. Speak like a close companion over coffee.",
      cheerleader: "You are 'The Encouraging Cheerleader'. Focus on being uplifting, warm, highly supportive, and positive, reminding them of their strength.",
    }[profile.vibe as "gentle" | "chill" | "cheerleader"] || "You are a warm, empathetic close friend.";

    return `You are a supportive, down-to-earth, and highly relatable personal mental wellness companion. 
Your role is to listen to the user share their feelings or daily experiences and respond like a close, empathetic friend—not a textbook, clinical psychologist, or formal assistant.

User Profile:
- Name: ${nameStr}
- Vibe Preferred: ${vibeDetails}
${profile.customTopic ? `- Ongoing Context/Topic: They might be dealing with "${profile.customTopic}".` : ""}

STRICT RULES FOR EVERY RESPONSE:
1. Tone & Voice:
- Speak like a normal human. Use common expressions, casual contractions (e.g., "it's", "don't", "you're", "oof", "man", "gosh"), and natural everyday language.
- Provide deep, authentic validation first (e.g., "Oof, that sounds incredibly draining," "I totally get why you're feeling that way," "Man, that's a really tough spot to be in").

2. Response Length & Structure:
- Keep responses extremely short and impactful (maximum 3 to 5 sentences total). NEVER output long walls of text.
- Use exactly two short paragraphs.
- Paragraph 1 (1-2 sentences): Validate their feelings with genuine empathy and a relatable, grounded observation.
- Paragraph 2 (1-2 sentences): Give them exactly one or two simple, practical, actionable steps they can do right now to feel better or clear their head. Keep these steps lightweight and grounded (e.g., grabbing water, stretching, a quick deep breath, naming 3 things they see, listening to one song).

3. Account-Based Continuity & Memory:
- Address the user by their name (${nameStr}) naturally, but don't overdo it or say it in every sentence.
- Always check the conversation history provided. If they are updating you on an ongoing situation or referring back to something, acknowledge it naturally (e.g., "Hey ${nameStr}, welcome back! How did that thing turn out?" or "Good to see you again, ${nameStr}. How are you holding up since we last talked?"). Treat them like a regular friend whose life you are actively keeping up with.

4. SAFETY GUARDRAIL:
- If the user expresses severe crisis, self-injury, or self-harm, immediately pivot to a warm, gentle recommendation of standard helpline resources. Maintain your supportive, caring tone while doing so. For example: "I'm so sorry you're carrying such a heavy weight right now, and I want to make sure you're safe. Please reach out to someone who can really support you—you can call or text 988 anytime to reach the Suicide & Crisis Lifeline. You don't have to carry this alone."`;
  };

  // Chat API route
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, profile } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: "Gemini API key is not configured. Please add GEMINI_API_KEY in Settings > Secrets.",
        });
      }

      const clientProfile = profile || { name: "friend", vibe: "chill" };
      const systemInstruction = getSystemInstructions(clientProfile);

      // Map messages to Gemini Content API expectations
      // We will take the last 10 messages for context
      const recentMessages = messages.slice(-10);
      const contents = recentMessages.map((m: any) => {
        return {
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        };
      });

      console.log(`Generating chat response for ${clientProfile.name} (vibe: ${clientProfile.vibe})`);

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.9,
          topP: 0.95,
        },
      });

      const responseText = response.text || "I'm here for you. What's on your mind?";
      res.json({ text: responseText });
    } catch (error: any) {
      console.error("Error in chat endpoint:", error);
      res.status(500).json({ error: error.message || "Something went wrong on the server." });
    }
  });

  // Welcome Custom Generation API
  app.post("/api/welcome", async (req, res) => {
    try {
      const { history, profile } = req.body;
      const clientProfile = profile || { name: "friend", vibe: "chill" };

      if (!process.env.GEMINI_API_KEY) {
        // Return fallback if key is missing
        return res.json({
          text: `Hey ${clientProfile.name}! Welcome back. What's on your mind today? I'm ready to listen.`,
        });
      }

      const systemInstruction = `You are a warm, down-to-earth personal mental wellness companion.
The user is returning to the app. You need to write a VERY short greeting (1-2 sentences) checking in on them.
Look at their profile and the previous history. If they were talking about something specific previously, follow up on it naturally!
If there is no history, just say a warm, casual greeting using their name (${clientProfile.name}) and ask how they are holding up.
Never list steps. Never write paragraphs. Just a simple, text-message style greeting. (Max 2 sentences).`;

      let contents = "Greet the user warmly based on their profile and prior history.";
      if (history && Array.isArray(history) && history.length > 0) {
        // Format history for context
        const historyText = history
          .slice(-6)
          .map((m: any) => `${m.role === "user" ? "User" : "Companion"}: ${m.content}`)
          .join("\n");
        contents = `Profile: Name: ${clientProfile.name}, Vibe: ${clientProfile.vibe}
Previous Conversation:
${historyText}

Based on this, generate a warm follow-up greeting. Check in on how they are doing or follow up on what they shared. Make it casual and friendly.`;
      }

      console.log(`Generating personalized welcome for ${clientProfile.name}`);

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.9,
        },
      });

      const responseText =
        response.text || `Hey ${clientProfile.name}, welcome back! How are you holding up today?`;
      res.json({ text: responseText });
    } catch (error: any) {
      console.error("Error in welcome endpoint:", error);
      res.json({
        text: `Hey ${req.body?.profile?.name || "there"}! Good to see you again. Tell me, how are you holding up?`,
      });
    }
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
