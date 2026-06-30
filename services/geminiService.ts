import { Transaction } from "../types";

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
    const response = await fetch("/api/gemini/analyze-statement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Data, mimeType }),
    });

    if (!response.ok) {
      throw new Error("Server error during statement analysis");
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze file. It might be too large or unclear.");
  }
};

export const generateHabitSummary = async (transactions: Transaction[]): Promise<string> => {
  if (transactions.length === 0) return "No data available to analyze.";

  try {
    const response = await fetch("/api/gemini/habit-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions }),
    });

    if (!response.ok) {
      throw new Error("Server error during habit summary generation");
    }

    const data = await response.json();
    return data.summary || "Could not generate summary.";
  } catch (error) {
    console.error("Gemini Text Error:", error);
    return "AI service is currently unavailable.";
  }
};

export const reconcileInvestment = async (netCashFlow: number, actualInvestmentChange: number): Promise<string> => {
   try {
    const response = await fetch("/api/gemini/reconcile-investment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ netCashFlow, actualInvestmentChange }),
    });

    if (!response.ok) {
      throw new Error("Server error during investment reconciliation");
    }

    const data = await response.json();
    return data.reconciliation || "Could not reconcile data.";
  } catch (error) {
    console.error("Gemini Reconciliation Error:", error);
    return "AI service unavailable for reconciliation.";
  }
};
