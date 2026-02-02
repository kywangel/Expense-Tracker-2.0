
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
