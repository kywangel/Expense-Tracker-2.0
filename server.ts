import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initializing the GenAI client with API key from environment
// Using the recommended 'aistudio-build' User-Agent for telemetry
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for larger statement images/PDFs
  app.use(express.json({ limit: '10mb' }));

  // API Route: Analyze bank statement
  app.post('/api/gemini/analyze-statement', async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body;
      if (!base64Data) {
        return res.status(400).json({ error: 'Missing statement data' });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: base64Data
              }
            },
            {
              text: 'Analyze this bank statement (image or PDF). Extract all transactions visible. Return a JSON array where each object has: date (YYYY-MM-DD), amount (number, positive for expense), category (guess based on description), note (the description on the statement). Ignore headers or balances.'
            }
          ]
        },
        config: {
          responseMimeType: 'application/json',
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
              required: ['date', 'amount']
            }
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        return res.json({ results: parsed });
      }
      
      return res.json({ results: [] });
    } catch (error) {
      console.error('Gemini Analysis Error:', error);
      return res.status(500).json({ error: 'Failed to analyze file. It might be too large or unclear.' });
    }
  });

  // API Route: Generate spending habit summary
  app.post('/api/gemini/habit-summary', async (req, res) => {
    try {
      const { transactions } = req.body;
      if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        return res.json({ summary: 'No data available to analyze.' });
      }

      const txSummary = transactions.slice(0, 50).map(t => `${t.date}: ${t.category} $${t.amount}`).join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Here are my recent expenses:\n${txSummary}\n\nAnalyze my spending habits. Identify one key trend and suggest one actionable improvement for next month. Keep it short, friendly, and under 50 words.`,
      });

      return res.json({ summary: response.text || 'Could not generate summary.' });
    } catch (error) {
      console.error('Gemini Text Error:', error);
      return res.status(500).json({ error: 'AI service is currently unavailable.' });
    }
  });

  // API Route: Reconcile investment
  app.post('/api/gemini/reconcile-investment', async (req, res) => {
    try {
      const { netCashFlow, actualInvestmentChange } = req.body;
      const diff = (actualInvestmentChange || 0) - (netCashFlow || 0);

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `My calculated Net Cash Flow (Income - Expenses) is $${netCashFlow}. My Investment Portfolio changed by $${actualInvestmentChange}. The difference is $${diff}. Suggest 3 brief reasons why this discrepancy might exist (e.g., hidden fees, market gains, timing differences). Format as a bulleted list.`,
      });

      return res.json({ reconciliation: response.text || 'Could not reconcile data.' });
    } catch (error) {
      console.error('Gemini Reconciliation Error:', error);
      return res.status(500).json({ error: 'AI service unavailable for reconciliation.' });
    }
  });

  // Vite integration for development vs production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
