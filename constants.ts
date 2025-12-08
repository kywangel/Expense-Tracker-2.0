

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

// This function is now pure, relying on passed-in arguments
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