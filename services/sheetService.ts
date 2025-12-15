
import { Transaction } from "../types";
import { DEFAULT_SHEET_ID, DEFAULT_GID, getTransactionType, toHKDateString } from "../constants";

// Helper to parse CSV line correctly handling quotes
const parseCSVLine = (str: string) => {
  const arr = [];
  let quote = false;
  let col = "";
  for (let c = 0; c < str.length; c++) {
    const cc = str[c];
    if (cc === '"') {
      quote = !quote;
    } else if (cc === ',' && !quote) {
      arr.push(col);
      col = "";
    } else {
      col += cc;
    }
  }
  arr.push(col);
  return arr.map(s => s.trim().replace(/^"|"$/g, ''));
};

// Helper to safely parse a date string as HKT (or absolute date) without shifting
const parseDateAsHK = (dateStr: string): string => {
    if (!dateStr) return toHKDateString(new Date());

    // Try to isolate the date part (YYYY-MM-DD or MM/DD/YYYY) to avoid time shifting
    // Google sheets often output yyyy-MM-dd HH:mm:ss
    const cleanDateStr = dateStr.split(' ')[0].split('T')[0];
    
    // If it matches YYYY-MM-DD, create as UTC to ensure stability
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDateStr)) {
        return cleanDateStr; 
    }
    
    // Fallback for other formats (e.g. 12/31/2024)
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        return toHKDateString(parsed);
    }
    
    return toHKDateString(new Date());
};

export const fetchTransactions = async (
  sheetUrlOrId: string, 
  incomeCategories: string[], 
  investmentCategories: string[]
): Promise<Transaction[]> => {
  let fetchUrl = sheetUrlOrId;
  let isCsv = false;

  if (sheetUrlOrId.includes("docs.google.com") || sheetUrlOrId === DEFAULT_SHEET_ID) {
    const idMatch = sheetUrlOrId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const sheetId = idMatch ? idMatch[1] : (sheetUrlOrId === DEFAULT_SHEET_ID ? DEFAULT_SHEET_ID : null);
    
    const gidMatch = sheetUrlOrId.match(/[#&?]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : DEFAULT_GID;

    if (sheetId) {
       fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
       isCsv = true;
    }
  }

  try {
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);

    const determineType = (category: string) => getTransactionType(category, incomeCategories, investmentCategories);

    if (isCsv) {
        const text = await res.text();
        const rows = text.split('\n').map(r => parseCSVLine(r));
        if (rows.length < 2) return [];

        const headers = rows[0].map(h => h.toLowerCase());
        const dateIdx = headers.findIndex(h => h.includes('date'));
        const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('cost') || h.includes('price'));
        const catIdx = headers.findIndex(h => h.includes('category') || h.includes('type'));
        const noteIdx = headers.findIndex(h => h.includes('note') || h.includes('desc') || h.includes('item'));
        const timestampIdx = headers.findIndex(h => h.includes('timestamp')); // Detect Google Form Timestamp

        // Default indices if headers missing, but we handle date separately below
        const aI = amountIdx > -1 ? amountIdx : 2; // Default Amount to Col C (index 2) if standard form? Or 1? 
        // Let's stick to simple defaults but override date logic
        const cI = catIdx > -1 ? catIdx : 3;
        const nI = noteIdx > -1 ? noteIdx : 4;

        return rows.slice(1).map((row, idx) => {
            if (row.length < 2) return null;
            
            // Amount Extraction
            // If header found, use it. Else check typical columns C (2) or B (1)
            let amountStr = "";
            if (amountIdx > -1 && row[amountIdx]) amountStr = row[amountIdx];
            else if (row[2] && /[\d\.\$]+/.test(row[2])) amountStr = row[2]; // Try Col C
            else if (row[1] && /[\d\.\$]+/.test(row[1])) amountStr = row[1]; // Try Col B fallback
            
            amountStr = amountStr.replace(/[^0-9.-]+/g,"");

            // Date Extraction Logic (User Request: Col B then Col A)
            let dateStr = "";
            
            // 1. If explicit 'date' header exists, prefer it
            if (dateIdx > -1 && row[dateIdx]) {
                dateStr = row[dateIdx];
            }
            // 2. If no data yet, try explicit 'timestamp' header
            if (!dateStr && timestampIdx > -1 && row[timestampIdx]) {
                dateStr = row[timestampIdx];
            }
            // 3. Fallback / User Priority: Check Column B (Index 1) then Column A (Index 0)
            if (!dateStr) {
                if (row.length > 1 && row[1]) dateStr = row[1];
                else if (row.length > 0 && row[0]) dateStr = row[0];
            }

            const isoDate = parseDateAsHK(dateStr);

            const category = (catIdx > -1 ? row[catIdx] : row[cI]) || "Uncategorized";
            
            // Robust ID Generation
            let stableId = `csv-${idx}-${isoDate}-${amountStr}`;
            // If Col A is timestamp-like, use it for ID stability
            if (row[0] && row[0].length > 10) {
                 const tsSafe = row[0].replace(/[^a-zA-Z0-9]/g, '');
                 stableId = `form-${tsSafe}`;
            }

            return {
                id: stableId, 
                date: isoDate,
                amount: parseFloat(amountStr) || 0,
                category: category,
                note: (noteIdx > -1 ? row[noteIdx] : row[nI]) || "",
                type: determineType(category),
                source: 'IOS shortcut'
            };
        }).filter(Boolean) as Transaction[];
    } else {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.data || []);
        return items.map((d: any) => ({
            id: d.id || Math.random().toString(36).substr(2, 9),
            date: d.date, 
            amount: parseFloat(d.amount),
            category: d.category,
            note: d.note,
            type: determineType(d.category),
            source: d.source || 'IOS shortcut' 
        }));
    }
  } catch (e) {
    console.warn("Fetch Error. Ensure the Google Sheet is 'Anyone with the link' or 'Published to Web'.", e);
    return [];
  }
};

export const testConnection = async (scriptUrl: string): Promise<{ success: boolean; message: string }> => {
    if (!scriptUrl.includes('script.google.com')) {
        return { success: false, message: "Invalid URL. Must be a Google Apps Script URL." };
    }
    try {
        const res = await fetch(scriptUrl);
        const text = await res.text();
        try {
            const json = JSON.parse(text);
            if (json.status === 'success') {
                return { success: true, message: "Connection successful!" };
            }
            return { success: false, message: "Script reachable but returned unexpected status." };
        } catch {
            return { success: false, message: "Script returned HTML instead of JSON. Did you deploy as 'Web App'?" };
        }
    } catch (e) {
        return { success: false, message: `Network error: ${e instanceof Error ? e.message : String(e)}` };
    }
};

export const saveTransaction = async (sheetDbUrl: string, transaction: Transaction): Promise<boolean> => {
  if (!sheetDbUrl || sheetDbUrl.includes("docs.google.com")) {
      console.log("Mock Write-back (Read-only source configured):", transaction);
      return true; 
  }

  try {
    const res = await fetch(sheetDbUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'add', data: transaction })
    });
    return res.ok;
  } catch (e) {
    console.error("SheetDB Save Error:", e);
    return false;
  }
};

export const saveBulkTransactions = async (sheetDbUrl: string, transactions: Transaction[]): Promise<{ success: boolean; count: number; error?: string; sheetName?: string }> => {
  if (!sheetDbUrl || sheetDbUrl.includes("docs.google.com")) {
      console.log("Mock Bulk Save (Read-only source):", transactions.length);
      return { success: true, count: transactions.length };
  }

  try {
    const BATCH_SIZE = 50;
    const batches = [];
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        batches.push(transactions.slice(i, i + BATCH_SIZE));
    }

    let successCount = 0;
    let lastSheetName = "";

    for (const batch of batches) {
        const res = await fetch(sheetDbUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'addBulk', data: batch })
        });
        
        if (!res.ok) {
            return { success: false, count: successCount, error: `HTTP Error ${res.status}` };
        }

        const text = await res.text();
        try {
            const json = JSON.parse(text);
            if (json.status === 'success') {
                successCount += (json.count || batch.length);
                if (json.targetSheet) lastSheetName = json.targetSheet;
            } else {
                return { success: false, count: successCount, error: json.message || "Script Error" };
            }
        } catch (e) {
            console.error("Invalid JSON response:", text.substring(0, 100));
            return { success: false, count: successCount, error: "Invalid response. Check if 'New Deployment' was created." };
        }
    }
    
    return { success: successCount >= transactions.length, count: successCount, sheetName: lastSheetName };
  } catch (e) {
    console.error("SheetDB Bulk Save Error:", e);
    return { success: false, count: 0, error: e instanceof Error ? e.message : "Network Error" };
  }
};
