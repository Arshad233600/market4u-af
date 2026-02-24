
import { GoogleGenAI } from "@google/genai";
import { USE_MOCK_DATA } from "../config";
import { apiClient } from "./apiClient";

// SECURITY: Only initialize client-side Gemini if explicitly in Mock/Dev mode.
// In Production, the variable process.env.API_KEY or VITE_API_KEY should NOT be exposed to the bundle.
let ai: GoogleGenAI | null = null;

if (USE_MOCK_DATA) {
  // Only attempt to load key in Dev/Mock mode
  const apiKey = (import.meta as any).env?.VITE_API_KEY || '';
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey: apiKey });
  }
}

const SYSTEM_INSTRUCTION_AD = `
You are an expert copywriter for an Afghan online marketplace (like Facebook Marketplace).
Write a persuasive and clear sales description in Dari (Persian) for the item.
The tone should be polite, professional, and trustworthy. 
Highlight potential benefits. 
Keep it under 100 words.
Do not include placeholders like [Phone Number].
`;

export const generateAdDescription = async (
  title: string, 
  category: string, 
  location: string
): Promise<string> => {
  
  // 1. PRODUCTION MODE: ALWAYS Call Azure Function
  // This ensures the API Key is never leaked to the browser.
  if (!USE_MOCK_DATA) {
      try {
          const response = await apiClient.post<{ description: string }>('/generateDescription', {
              title,
              category,
              location
          });
          return response.description;
      } catch (error) {
          console.error("Backend AI Error:", error);
          return "خطا در ارتباط با هوش مصنوعی (سرور).";
      }
  }

  // 2. MOCK/DEMO MODE: Client-side Call (Only for testing/demo)
  if (!ai) {
    console.warn("Gemini API Key is missing in Mock Mode.");
    return "سرویس هوشمند در حال حاضر غیرفعال است.";
  }

  try {
    const modelId = 'gemini-2.5-flash'; 
    const prompt = `Item Title: ${title}\nCategory: ${category}\nLocation: ${location}`;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_AD,
      }
    });

    return response.text || "متاسفانه نتوانستیم توضیحات را تولید کنیم.";
  } catch (error) {
    console.error("Gemini Mock Error:", error);
    return "خطا در تولید محتوا.";
  }
};

export const generateChatReply = async (
  lastMessage: string,
  productContext: string
): Promise<string> => {
    // In Production, this should also move to a backend endpoint like /api/chat/reply
    // For now, we disable it in Prod to prevent key leak, or use the Mock instance if available.
    if (!USE_MOCK_DATA) return ""; 

    if (!ai) return ""; 
    try {
        const modelId = 'gemini-2.5-flash';
        const prompt = `Product Context: ${productContext}\nBuyer says: ${lastMessage}`;
        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
            config: { maxOutputTokens: 100 }
        });
        return response.text || "";
    } catch { return ""; }
};
