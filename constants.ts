
import { startOfMonth, addMonths, subMonths, setDate, subDays, endOfMonth } from 'date-fns';

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Family Allowance", "Lunch", "Entertainment", "Dinner", "Balancing Figure", 
  "Subscription (HK Career)", "Transportation", "Clothing", "My Treat", 
  "Snacks and Coffee", "Donation", "Sports", "Others", "Breakfast", 
  "Personal Care", "Health", "Personal Investment", "Entertainment Subscription", "Traveling"
];

export const DEFAULT_INCOME_CATEGORIES = [
  "Employment", "Side Hustle", "Dividends", "My Sweat Money", "Capital Gain (Stock)"
];

export const DEFAULT_INVESTMENT_CATEGORIES = [
  "Long-Term Stock", "SPY", "Day Trading Stocks", "Retirement Account", "Emergency Fund"
];

/**
 * Determines transaction type based on category.
 */
export const getTransactionType = (
  category: string, 
  incomeCategories: string[], 
  investmentCategories: string[]
): 'expense' | 'income' | 'investment' => {
  if (incomeCategories.includes(category)) return 'income';
  if (investmentCategories.includes(category)) return 'investment';
  return 'expense';
};

export const DEFAULT_SHEET_ID = "1BScmi-6DI1Cj7VRMaKdpSVYyo2ibtHfkV3icz1OYBdM";
export const DEFAULT_GID = "78662654";

// Helper to enforce Hong Kong Timezone (UTC+8) for all date strings (YYYY-MM-DD)
export const toHKDateString = (dateInput?: Date | string | number) => {
  const date = dateInput ? new Date(dateInput) : new Date();
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Asia/Hong_Kong', 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  }).format(date);
};

/**
 * Parses a date string safely into a local Date object.
 * Prevents timezone shifting (e.g. YYYY-MM-DD being parsed as UTC midnight
 * and ending up in the previous calendar day when accessed in local time).
 */
export const parseLocalDate = (dateInput?: string | Date | number): Date => {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === 'number') return new Date(dateInput);

  const clean = dateInput.split('T')[0].split(' ')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      // Month index is 0-based
      return new Date(year, month - 1, day);
    }
  }

  const d = new Date(dateInput);
  if (!isNaN(d.getTime())) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return new Date();
};

/**
 * Calculates the start and end of a financial month cycle.
 * If startDay is 25, then Feb 24 belongs to Jan (starts Jan 25).
 */
export const getFinancialInterval = (date: Date, startDay: number = 1) => {
  if (startDay <= 1) {
    return { start: startOfMonth(date), end: endOfMonth(date) };
  }
  
  let start = setDate(startOfMonth(date), startDay);
  if (date.getDate() < startDay) {
    start = subMonths(start, 1);
  }
  
  const end = subDays(addMonths(start, 1), 1);
  return { start, end };
};
