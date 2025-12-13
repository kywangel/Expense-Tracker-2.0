
export interface Transaction {
  id: string;
  date: string; // ISO Date string
  amount: number;
  category: string;
  note?: string;
  type?: 'expense' | 'income' | 'investment';
  source?: 'IOS shortcut' | 'app input' | 'PDF file';
}

// Ensure FoundItem has a guaranteed ID for selection purposes
export interface FoundItem extends Partial<Transaction> {
  id: string; 
  added?: boolean;
}

// New type to hold both the suggested item and the one it matched with
export interface MatchedItemPair {
  suggested: FoundItem;
  matched: Transaction;
}

export interface InvestmentEntry {
  id: string;
  date: string;
  platform: string;
  assetName: string;
  shares: number;
  unitPrice: number;
  totalValue: number;
}

export interface AppSettings {
  sheetDbUrl: string; // Source 1: Google Form Responses (Read-Only usually)
  masterSheetUrl: string; // Source 2: App Database Master (Read/Write)
  monthlyBudget: number; // Kept for potential future use or legacy
  monthlyCategoryBudgets: Record<string, Record<string, number>>; // Kept for legacy/migration
  baseCategoryBudgets: Record<string, number>; // New: The universal monthly budget
  yearlyBudgets: Record<string, Record<string, number>>; // New: Overrides for specific years { "2025": { "Food": 500 } }
  cumulativeStartMonth?: string; // New: YYYY-MM string for cumulative view start
  // Dynamic category lists
  incomeCategories: string[];
  expenseCategories: string[];
  investmentCategories: string[];
}

export interface ChartDataPoint {
  name: string;
  value: number;
}

export enum AppView {
  DASHBOARD = 'dashboard',
  ADD_TRANSACTION = 'add_transaction',
  STATISTICS = 'statistics',
  AI_TOOLS = 'ai_tools',
  BUDGET = 'budget', // Kept for navigation from settings
  DATABASE = 'database', // New main tab
  SETTINGS = 'settings',
  EDIT_CATEGORIES = 'edit_categories'
}
