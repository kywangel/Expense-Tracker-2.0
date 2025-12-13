
import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { differenceInCalendarMonths, getDaysInMonth, isSameMonth, isSameDay, startOfMonth, startOfDay } from 'date-fns';

interface DashboardProps {
  transactions: Transaction[];
  baseCategoryBudgets: Record<string, number>;
  incomeCategories: string[];
  expenseCategories: string[];
  investmentCategories: string[];
  cumulativeStartMonth?: string;
}

const INCOME_CHART_COLORS = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'];
const EXPENSE_CHART_COLORS = ['#B91C1C', '#DC2626', '#EF4444', '#F87171', '#FCA5A5'];
const INVESTMENT_CHART_COLORS = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'];

type ViewMode = 'monthly' | 'daily' | 'cumulative';
type ChartMode = 'table' | 'chart';

const Dashboard: React.FC<DashboardProps> = ({ transactions, baseCategoryBudgets, incomeCategories, expenseCategories, investmentCategories, cumulativeStartMonth }) => {
  const [viewTimeFrame, setViewTimeFrame] = useState<ViewMode>('monthly');
  
  const [viewModes, setViewModes] = useState({
    income: 'table',
    expenses: 'table',
    savings: 'table',
  });

  const toggleViewMode = (section: 'income' | 'expenses' | 'savings') => {
    setViewModes(prev => ({ ...prev, [section]: prev[section] === 'table' ? 'chart' : 'table' }));
  };

  // --- Logic for Time Frame Filtering & Budget Scaling ---
  
  const today = new Date();

  // 1. Determine Start Date for Cumulative View
  const firstTxDate = useMemo(() => {
    if (cumulativeStartMonth) {
         const [year, month] = cumulativeStartMonth.split('-').map(Number);
         // Month in Date constructor is 0-indexed
         return new Date(year, month - 1, 1);
    }
    if (transactions.length === 0) return today;
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return new Date(sorted[0].date);
  }, [transactions, cumulativeStartMonth]);

  // 2. Filter Transactions based on View Mode
  const filteredTransactions = useMemo(() => {
      return transactions.filter(t => {
          const tDate = new Date(t.date);
          if (viewTimeFrame === 'monthly') {
              return isSameMonth(tDate, today);
          } else if (viewTimeFrame === 'daily') {
              return isSameDay(tDate, today);
          } else {
              // Cumulative: All transactions since the first recorded one (or the custom start date)
              return tDate >= startOfDay(firstTxDate);
          }
      });
  }, [transactions, viewTimeFrame, firstTxDate]);

  // 3. Calculate Spending Map for filtered transactions
  const spendingMap = useMemo(() => {
      return filteredTransactions.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);
  }, [filteredTransactions]);

  // 4. Calculate Budget Multiplier
  const budgetMultiplier = useMemo(() => {
      if (viewTimeFrame === 'monthly') return 1;
      if (viewTimeFrame === 'daily') {
          return 1 / getDaysInMonth(today);
      }
      // Cumulative
      // Logic: Number of months from firstTxDate to Now (inclusive)
      const monthsDiff = differenceInCalendarMonths(today, firstTxDate);
      return Math.max(1, monthsDiff + 1);
  }, [viewTimeFrame, firstTxDate]);


  // --- Totals Calculation ---
  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalExpenses = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
  const netBalance = totalIncome - totalExpenses;

  const renderSection = (title: 'Income' | 'Expenses' | 'Savings', categories: string[], headerColor: string) => {
    const sectionKey = title.toLowerCase() as 'income' | 'expenses' | 'savings';
    const viewMode = viewModes[sectionKey];

    const getTopFiveData = () => {
        const validItems = categories
            .map(cat => ({ name: cat, value: Math.abs(spendingMap[cat] || 0) }))
            .filter(item => item.value > 0);
        validItems.sort((a, b) => b.value - a.value);
        const top5 = validItems.slice(0, 5);
        const others = validItems.slice(5);
        const othersValue = others.reduce((sum, item) => sum + item.value, 0);
        const chartData = [...top5];
        if (othersValue > 0) {
            const existingOthers = chartData.find(d => d.name === 'Others');
            if (existingOthers) existingOthers.value += othersValue;
            else chartData.push({ name: 'Others', value: othersValue });
        }
        chartData.sort((a, b) => b.value - a.value);
        return chartData;
    };
    
    const chartData = useMemo(() => getTopFiveData(), [categories, spendingMap]);
    
    const chartColors = useMemo(() => {
        if (title === 'Income') return INCOME_CHART_COLORS;
        if (title === 'Expenses') return EXPENSE_CHART_COLORS;
        return INVESTMENT_CHART_COLORS;
    }, [title]);

    const totalTracked = categories.reduce((sum, cat) => sum + (spendingMap[cat] || 0), 0);

    return (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6 border border-gray-200">
        <div className={`${headerColor} text-white px-4 py-3 font-bold text-sm flex justify-between items-center w-full`}>
           <span>{title}</span>
           <div className="flex items-center gap-1">
             <button onClick={() => toggleViewMode(sectionKey)} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-black/20 text-white' : 'text-white/70 hover:bg-white/10'}`}><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" /></svg></button>
             <button onClick={() => toggleViewMode(sectionKey)} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'chart' ? 'bg-black/20 text-white' : 'text-white/70 hover:bg-white/10'}`}><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg></button>
           </div>
        </div>

        {viewMode === 'table' ? (
          <div className="animate-fade-in">
             <div className="flex justify-between px-4 py-2 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <span>Category / Progress</span>
                <span>Tracked / {viewTimeFrame === 'monthly' ? 'Budget' : 'Target'}</span>
             </div>
            <div className="divide-y divide-gray-100">
              {categories.map(cat => {
                const tracked = spendingMap[cat] || 0;
                // Scale budget based on view multiplier
                const baseBudget = baseCategoryBudgets[cat] || 0;
                const budget = baseBudget * budgetMultiplier;
                
                const percent = budget > 0 ? (Math.abs(tracked) / budget) * 100 : 0;
                
                const barColor = percent > 100 ? 'bg-red-500' :
                                 title === 'Income' ? 'bg-green-500' :
                                 title === 'Expenses' ? 'bg-red-600' : 'bg-blue-600';

                return (
                  <div key={cat} className="flex justify-between items-center py-3 px-4 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col flex-1 pr-4 min-w-0">
                        <span className="font-semibold text-gray-800 text-sm break-words leading-tight">{cat}</span>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 max-w-[140px]">
                           <div className={`${barColor} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                        <span className="font-bold text-gray-900 text-sm tracking-tight">{Math.abs(tracked).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                        <span className="text-xs text-gray-400 font-medium mt-0.5">/ {budget > 0 ? budget.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '--'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-6 flex flex-col items-center animate-fade-in">
            <div className="w-full h-56">
               <ResponsiveContainer>
                 <PieChart>
                   <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" paddingAngle={5}>
                     {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />)}
                   </Pie>
                 </PieChart>
               </ResponsiveContainer>
            </div>
            
            <div className="w-full grid grid-cols-2 gap-x-6 gap-y-3 mt-4 pt-4 border-t border-gray-100">
                {chartData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center min-w-0">
                           <span className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: chartColors[index % chartColors.length] }}></span>
                           <span className="text-gray-600 truncate">{entry.name}</span>
                        </div>
                        <span className="font-mono font-semibold text-gray-900 ml-2">{entry.value.toLocaleString()}</span>
                    </div>
                ))}
            </div>
             <div className="font-bold text-sm text-gray-800 pt-4 mt-2 border-t w-full flex justify-between items-center">
                 <span>Total</span>
                 <span>{Math.abs(totalTracked).toLocaleString()}</span>
             </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-24">
      {/* View Toggle */}
      <div className="bg-gray-200 p-1 rounded-xl flex text-xs font-semibold">
          {(['monthly', 'daily', 'cumulative'] as const).map(mode => (
              <button 
                  key={mode} 
                  onClick={() => setViewTimeFrame(mode)} 
                  className={`flex-1 py-1.5 rounded-lg capitalize transition-all duration-200 leading-none ${viewTimeFrame === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  {mode}
              </button>
          ))}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center">
        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">
            {viewTimeFrame} Net Balance
        </p>
        <p className={`text-3xl font-extrabold tracking-tight ${netBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {netBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
        </p>
        <p className="text-[10px] text-gray-400 mt-2 font-medium">Income - Expenses (Excl. Investments)</p>
      </div>

      {renderSection('Income', incomeCategories, 'bg-green-500')}
      {renderSection('Expenses', expenseCategories, 'bg-red-700')}
      {renderSection('Savings', investmentCategories, 'bg-blue-600')}
    </div>
  );
};

export default Dashboard;
