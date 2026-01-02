
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

const parseDateAsHK = (dateStr: string): string => {
    if (!dateStr) return toHKDateString(new Date());
    const cleanDateStr = dateStr.split(' ')[0].split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDateStr)) return cleanDateStr; 
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return toHKDateString(parsed);
    return toHKDateString(new Date());
};

// Normalize string for fuzzy wildcard matching (lowercase, no spaces, no special chars)
const normalize = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const fetchTransactions = async (
  sheetUrlOrId: string, 
  incomeCategories: string[], 
  investmentCategories: string[],
  expenseCategories: string[] = [],
  categoryIcons: Record<string, string> = {}
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
    const knownCategories = [...incomeCategories, ...investmentCategories, ...expenseCategories];

    // Fuzzy matching logic: Wildcard + Skip Spacing
    const findMatch = (rawInput: string): string => {
        const inputNorm = normalize(rawInput);
        if (!inputNorm) return "Others";

        // 1. Try Exact Match First
        const exact = knownCategories.find(c => c.toLowerCase() === rawInput.trim().toLowerCase());
        if (exact) return exact;

        // 2. Try Wildcard Match for categories that have icons (indicating "Smart" categories)
        const wildcardMatch = knownCategories.find(c => {
            const catNorm = normalize(c);
            if (!catNorm) return false;
            
            // If the category has an icon, it acts as a wildcard
            const hasIcon = !!categoryIcons[c];
            if (hasIcon) {
                return inputNorm.includes(catNorm) || catNorm.includes(inputNorm);
            }
            // If no icon, still check for exact normalized match
            return inputNorm === catNorm;
        });

        return wildcardMatch || "Others";
    };

    if (isCsv) {
        const text = await res.text();
        const rows = text.split('\n').map(r => parseCSVLine(r));
        if (rows.length < 2) return [];

        const headers = rows[0].map(h => h.toLowerCase());
        const dateIdx = headers.findIndex(h => h.includes('date'));
        const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('cost') || h.includes('price'));
        const catIdx = headers.findIndex(h => h.includes('category') || h.includes('type'));
        const noteIdx = headers.findIndex(h => h.includes('note') || h.includes('desc') || h.includes('item'));
        const timestampIdx = headers.findIndex(h => h.includes('timestamp'));

        const nI = noteIdx > -1 ? noteIdx : 4;

        return rows.slice(1).map((row, idx) => {
            if (row.length < 2) return null;
            
            const looksLikeDate = (val: string) => /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(val) || /^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(val);

            let amountStr = "";
            if (amountIdx > -1 && row[amountIdx]) amountStr = row[amountIdx];
            else {
                if (row[2] && !looksLikeDate(row[2])) amountStr = row[2];
                else if (row[1] && !looksLikeDate(row[1])) amountStr = row[1];
            }
            amountStr = amountStr.replace(/[^0-9.-]+/g,"");

            let dateStr = "";
            if (dateIdx > -1 && row[dateIdx]) dateStr = row[dateIdx];
            else if (timestampIdx > -1 && row[timestampIdx]) dateStr = row[timestampIdx];
            
            const isoDate = parseDateAsHK(dateStr);
            const rawCat = catIdx > -1 ? row[catIdx] : row[3];
            const category = findMatch(rawCat || "");
            
            let stableId = `csv-${idx}-${isoDate}-${amountStr}`;
            if (row[0] && row[0].length > 10) stableId = `form-${row[0].replace(/[^a-zA-Z0-9]/g, '')}`;

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
        
        return items.map((d: any) => {
            const cat = findMatch(d.category || "Others");
            return {
                id: d.id || Math.random().toString(36).substr(2, 9),
                date: d.date, 
                amount: parseFloat(d.amount),
                category: cat,
                note: d.note,
                type: determineType(cat),
                source: d.source || 'IOS shortcut' 
            };
        });
    }
  } catch (e) {
    console.warn("Fetch Error", e);
    return [];
  }
};

export const testConnection = async (scriptUrl: string): Promise<{ success: boolean; message: string }> => {
    if (!scriptUrl.includes('script.google.com')) return { success: false, message: "Invalid URL." };
    try {
        const res = await fetch(scriptUrl);
        const text = await res.text();
        const json = JSON.parse(text);
        return json.status === 'success' ? { success: true, message: "Connection successful!" } : { success: false, message: "Unexpected status." };
    } catch (e) {
        return { success: false, message: `Error: ${e instanceof Error ? e.message : String(e)}` };
    }
};

export const saveTransaction = async (sheetDbUrl: string, transaction: Transaction): Promise<boolean> => {
  if (!sheetDbUrl || sheetDbUrl.includes("docs.google.com")) return true; 
  try {
    const res = await fetch(sheetDbUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'add', data: transaction })
    });
    return res.ok;
  } catch (e) { return false; }
};

export const saveBulkTransactions = async (sheetDbUrl: string, transactions: Transaction[]): Promise<{ success: boolean; count: number; error?: string; sheetName?: string }> => {
  if (!sheetDbUrl || sheetDbUrl.includes("docs.google.com")) return { success: true, count: transactions.length };
  try {
    const res = await fetch(sheetDbUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'addBulk', data: transactions })
    });
    const json = await res.json();
    return { success: json.status === 'success', count: json.count || transactions.length, sheetName: json.targetSheet };
  } catch (e) { return { success: false, count: 0, error: String(e) }; }
};
