
export interface Transaction {
  id: string;
  date: string; // ISO Date string
  amount: number;
  category: string;
  note?: string;
  type?: 'expense' | 'income' | 'investment';
  source?: 'IOS shortcut' | 'app input' | 'PDF file' | 'recurring';
  recurringId?: string;
}

export interface RecurringItem {
  id: string;
  category: string;
  amount: number;
  type: 'expense' | 'income' | 'investment';
  note?: string;
  isActive: boolean;
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
  sheetDbUrl: string; 
  masterSheetUrl: string; 
  monthlyBudget: number; 
  monthlyCategoryBudgets: Record<string, Record<string, number>>; 
  baseCategoryBudgets: Record<string, number>; 
  yearlyBudgets: Record<string, Record<string, number>>; 
  cumulativeStartMonth?: string; 
  billingCycleStartDay?: number; // Day of month to start (1-31)
  // Dynamic category lists
  incomeCategories: string[];
  expenseCategories: string[];
  investmentCategories: string[];
  // Category Metadata
  categoryIcons: Record<string, string>; // Maps category name to emoji/icon
  // Daily View Config
  dailyViewCategories: string[]; 
  dailyTransactionsPerMonth: Record<string, number>; 
}

export interface ChartDataPoint {
  name: string;
  value: number;
}

export enum AppView {
  DASHBOARD = 'dashboard',
  ADD_TRANSACTION = 'add_transaction',
  STATISTICS = 'statistics',
  RECURRING = 'recurring',
  BUDGET = 'budget', 
  DATABASE = 'database', 
  SETTINGS = 'settings',
  EDIT_CATEGORIES = 'edit_categories',
  WIDGET = 'widget'
}
