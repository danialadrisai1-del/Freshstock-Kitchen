import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface ScannedGrocery {
  name: string;
  quantity: string;
  category: string;
  suggestedExpiryDays: number;
}

export const analyzeGroceryImage = async (base64Data: string): Promise<{ data: ScannedGrocery | null, error: string | null }> => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { data: null, error: "API Key is missing. Please check your environment variables." };
    }

    console.log("Analyzing image with Gemini...");
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: "Analyze this image of a grocery item. Identify the item name, estimated quantity, category, and suggest how many days until it typically expires from now. Return as JSON." },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Data
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            quantity: { type: Type.STRING },
            category: { type: Type.STRING },
            suggestedExpiryDays: { type: Type.NUMBER }
          },
          required: ["name", "quantity", "category", "suggestedExpiryDays"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      return { data: null, error: "The AI returned an empty response. Try taking a clearer photo." };
    }

    // Remove potential markdown backticks or extra text
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);
    console.log("AI Analysis Result:", result);
    return { data: result as ScannedGrocery, error: null };
  } catch (error: any) {
    console.error("Error analyzing image:", error);
    const msg = error.message || "Unknown error during AI analysis.";
    return { data: null, error: `AI Error: ${msg}` };
  }
};
