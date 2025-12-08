

import { GoogleGenAI, Type } from "@google/genai";
import { Transaction } from "../types";

const apiKey = process.env.API_KEY || ''; // In a real app, strict env handling.
const ai = new GoogleGenAI({ apiKey });

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  // Simple client-side size check (approx 4MB limit for reliable XHR)
  if (file.size > 4 * 1024 * 1024) {
      throw new Error("File is too large (>4MB). Please compress it or use a smaller file.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeStatement = async (base64Data: string, mimeType: string = "image/jpeg"): Promise<Partial<Transaction>[]> => {
  try {
    // Switched to gemini-2.5-flash for better stability with large contexts/base64 payloads in browser
    const modelId = "gemini-2.5-flash"; 
    
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType, 
              data: base64Data
            }
          },
          {
            text: "Analyze this bank statement (image or PDF). Extract all transactions visible. Return a JSON array where each object has: date (YYYY-MM-DD), amount (number, positive for expense), category (guess based on description), note (the description on the statement). Ignore headers or balances."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              category: { type: Type.STRING },
              note: { type: Type.STRING }
            },
            required: ["date", "amount"]
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return [];
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze file. It might be too large or unclear.");
  }
};

export const generateHabitSummary = async (transactions: Transaction[]): Promise<string> => {
  if (transactions.length === 0) return "No data available to analyze.";

  try {
    const txSummary = transactions.slice(0, 50).map(t => `${t.date}: ${t.category} $${t.amount}`).join('\n');
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Here are my recent expenses:\n${txSummary}\n\nAnalyze my spending habits. Identify one key trend and suggest one actionable improvement for next month. Keep it short, friendly, and under 50 words.`,
    });

    return response.text || "Could not generate summary.";
  } catch (error) {
    console.error("Gemini Text Error:", error);
    return "AI service is currently unavailable.";
  }
};

export const reconcileInvestment = async (netCashFlow: number, actualInvestmentChange: number): Promise<string> => {
   try {
    const diff = actualInvestmentChange - netCashFlow;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `My calculated Net Cash Flow (Income - Expenses) is $${netCashFlow}. My Investment Portfolio changed by $${actualInvestmentChange}. The difference is $${diff}. Suggest 3 brief reasons why this discrepancy might exist (e.g., hidden fees, market gains, timing differences). Format as a bulleted list.`,
    });

    return response.text || "Could not reconcile data.";
  } catch (error) {
    console.error("Gemini Reconciliation Error:", error);
    return "AI service unavailable for reconciliation.";
  }
};