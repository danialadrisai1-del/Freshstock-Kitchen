import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface ScannedGrocery {
  name: string;
  quantity: string;
  category: string;
  suggestedExpiryDays: number;
}

export const analyzeGroceryImage = async (base64Data: string): Promise<ScannedGrocery | null> => {
  try {
    console.log("Analyzing image with Gemini...");
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: "Analyze this image of a grocery item. Identify the item name, estimated quantity, category, and suggest how many days until it typically expires from now. Return as JSON." },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }
      ],
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

    const text = response.text || '{}';
    // Remove potential markdown backticks
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);
    console.log("AI Analysis Result:", result);
    return result as ScannedGrocery;
  } catch (error) {
    console.error("Error analyzing image:", error);
    return null;
  }
};
