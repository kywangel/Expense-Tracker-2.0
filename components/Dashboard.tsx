import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { 
  differenceInCalendarMonths, 
  getDaysInMonth, 
  isSameMonth, 
  isSameDay, 
  startOfDay, 
  addMonths, 
  subMonths, 
  addDays, 
  subDays, 
  format, 
  isToday 
} from 'date-fns';

interface DashboardProps {
  transactions: Transaction[];
  baseCategoryBudgets: Record<string, number>;
  incomeCategories: string[];
  expenseCategories: string[];
  investmentCategories: string[];
  categoryIcons: Record<string, string>;
  cumulativeStartMonth?: string;
  isBalanceVisible: boolean;
  setIsBalanceVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const INCOME_CHART_COLORS = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'];
const EXPENSE_CHART_COLORS = ['#B91C1C', '#DC2626', '#EF4444', '#F87171', '#FCA5A5'];
const INVESTMENT_CHART_COLORS = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'];

type ViewMode = 'monthly' | 'daily' | 'cumulative';

// Consistent 1-decimal rounding helper
const f1 = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions, 
  baseCategoryBudgets, 
  incomeCategories, 
  expenseCategories, 
  investmentCategories, 
  categoryIcons,
  cumulativeStartMonth,
  isBalanceVisible,
  setIsBalanceVisible
}) => {
  const [viewTimeFrame, setViewTimeFrame] = useState<ViewMode>('monthly');
  const [viewDate, setViewDate] = useState<Date>(new Date());
  
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    income: false,
    expenses: false,
    savings: false
  });

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleCategoryDrilldown = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handlePrev = () => {
    if (viewTimeFrame === 'monthly') setViewDate(prev => subMonths(prev, 1));
    else if (viewTimeFrame === 'daily') setViewDate(prev => subDays(prev, 1));
  };

  const handleNext = () => {
    if (viewTimeFrame === 'monthly') setViewDate(prev => addMonths(prev, 1));
    else if (viewTimeFrame === 'daily') setViewDate(prev => addDays(prev, 1));
  };

  const jumpToToday = () => setViewDate(new Date());

  const firstTxDate = useMemo(() => {
    if (cumulativeStartMonth) {
         const [year, month] = cumulativeStartMonth.split('-').map(Number);
         return new Date(year, month - 1, 1);
    }
    if (transactions.length === 0) return new Date();
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return new Date(sorted[0].date);
  }, [transactions, cumulativeStartMonth]);

  const filteredTransactions = useMemo(() => {
      const todayBoundary = addDays(startOfDay(new Date()), 1); // Up to end of today
      return transactions.filter(t => {
          const tDate = new Date(t.date);
          if (viewTimeFrame === 'monthly') {
              return isSameMonth(tDate, viewDate);
          } else if (viewTimeFrame === 'daily') {
              return isSameDay(tDate, viewDate);
          } else {
              // Cumulative view logic: strictly from settings start month up to today
              return tDate >= startOfDay(firstTxDate) && tDate < todayBoundary;
          }
      });
  }, [transactions, viewTimeFrame, viewDate, firstTxDate]);

  const spendingMap = useMemo(() => {
      return filteredTransactions.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);
  }, [filteredTransactions]);

  const budgetMultiplier = useMemo(() => {
      if (viewTimeFrame === 'monthly') return 1;
      if (viewTimeFrame === 'daily') {
          return 1 / getDaysInMonth(viewDate);
      }
      // For cumulative, always calculate relative to "Today" to match filteredTransactions range
      const today = new Date();
      const monthsDiff = differenceInCalendarMonths(today, firstTxDate);
      return Math.max(1, monthsDiff + 1);
  }, [viewTimeFrame, firstTxDate, viewDate]);

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalExpenses = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
  const netBalance = totalIncome - totalExpenses;

  const getDisplayCategoryName = (name: string) => {
      const icon = categoryIcons[name];
      return icon ? `${icon} ${name}` : name;
  };

  const renderSection = (title: 'Income' | 'Expenses' | 'Savings', categories: string[], headerColor: string) => {
    const sectionKey = title.toLowerCase() as 'income' | 'expenses' | 'savings';
    const isExpanded = expandedSections[sectionKey];
    const type = sectionKey === 'income' ? 'income' : sectionKey === 'expenses' ? 'expense' : 'investment';

    const otherCategories = categories.filter(c => c.toLowerCase() === 'others');
    const mainCategories = categories.filter(c => c.toLowerCase() !== 'others');

    const chartItems = categories
        .map(cat => ({ name: cat, value: Math.abs(spendingMap[cat] || 0) }))
        .filter(item => item.value > 0);
    
    const strayTxs = filteredTransactions.filter(t => 
        t.type === type && !categories.includes(t.category)
    );
    const strayValue = strayTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const hasStray = strayValue > 0;

    if (hasStray) {
        chartItems.push({ name: 'Uncategorized', value: strayValue });
    }
    
    // Sort items by value
    chartItems.sort((a, b) => b.value - a.value);
    
    // Grouping logic: Top 5 categories shown individually, others grouped as "Remaining"
    const top5 = chartItems.slice(0, 5);
    const othersPieValue = chartItems.slice(5).reduce((sum, item) => sum + item.value, 0);
    
    const finalChartData = [...top5];
    if (othersPieValue > 0) finalChartData.push({ name: 'Remaining', value: othersPieValue });
    
    const chartColors = title === 'Income' ? INCOME_CHART_COLORS : (title === 'Expenses' ? EXPENSE_CHART_COLORS : INVESTMENT_CHART_COLORS);
    const totalTracked = filteredTransactions.filter(t => t.type === type).reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const renderCategoryRow = (cat: string) => {
        const tracked = spendingMap[cat] || 0;
        const budget = (baseCategoryBudgets[cat] || 0) * budgetMultiplier;
        const percent = budget > 0 ? (Math.abs(tracked) / budget) * 100 : 0;
        const isDrilledDown = expandedCategories[`${sectionKey}-${cat}`];
        const barColor = percent > 100 ? 'bg-red-500' : title === 'Income' ? 'bg-green-500' : title === 'Expenses' ? 'bg-red-600' : 'bg-blue-600';
        
        const normalBg = title === 'Income' ? 'bg-green-50/40' : title === 'Expenses' ? 'bg-red-50/40' : 'bg-blue-50/40';
        const activeBg = title === 'Income' ? 'bg-green-100' : title === 'Expenses' ? 'bg-red-100' : 'bg-blue-100';
        const hoverBg = title === 'Income' ? 'hover:bg-green-50/80' : title === 'Expenses' ? 'hover:bg-red-50/80' : 'hover:bg-blue-50/80';
        const childBg = title === 'Income' ? 'bg-green-50/60' : title === 'Expenses' ? 'bg-red-50/60' : 'bg-blue-50/60';
        
        const catTransactions = filteredTransactions.filter(t => t.category === cat && t.type === type);

        if (tracked === 0 && budget === 0) return null;

        return (
          <div key={cat} className="flex flex-col border-b border-gray-100 last:border-0">
            <div 
              onClick={() => toggleCategoryDrilldown(`${sectionKey}-${cat}`)} 
              className={`flex justify-between items-center py-4 px-4 transition-colors cursor-pointer ${isDrilledDown ? activeBg : `${normalBg} ${hoverBg}`}`}
            >
              <div className="flex flex-col flex-1 pr-4 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                     <span className={`font-bold text-sm leading-tight ${cat.toLowerCase() === 'others' ? 'text-gray-500 italic' : 'text-gray-800'}`}>
                        {getDisplayCategoryName(cat)}
                     </span>
                     {catTransactions.length > 0 && <span className="text-[10px] text-gray-500 font-bold bg-white/50 px-1.5 rounded-md border border-gray-100">{catTransactions.length} items</span>}
                     <svg className={`w-3 h-3 text-gray-400 transition-transform ${isDrilledDown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  <div className="w-full bg-gray-200/50 rounded-full h-1 mt-2 max-w-[140px]">
                     <div className={`${barColor} h-1 rounded-full transition-all duration-500`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
                  </div>
              </div>
              <div className="flex flex-col items-end shrink-0">
                  <span className="font-mono font-bold text-gray-900 text-sm">{isBalanceVisible ? `$${f1(Math.abs(tracked))}` : '****'}</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">/ {budget > 0 ? f1(budget) : '--'}</span>
              </div>
            </div>
            {isDrilledDown && (
              <div className="divide-y divide-white/50">
                  {catTransactions.length > 0 ? catTransactions.map(tx => (
                      <div key={tx.id} className={`flex justify-between items-center py-3 pl-12 pr-4 ${childBg}`}>
                          <div className="flex flex-col min-w-0">
                              <span className="text-[11px] font-bold text-gray-800 truncate">
                                  {getDisplayCategoryName(tx.category)}
                              </span>
                              <div className="flex flex-col mt-0.5">
                                  <span className="text-[9px] text-gray-500 font-semibold">{format(new Date(tx.date), 'MMMM d, yyyy')}</span>
                                  {tx.note && <span className="text-[9px] text-gray-400 italic font-medium truncate max-w-[200px]">{tx.note}</span>}
                              </div>
                          </div>
                          <span className={`text-[11px] font-mono font-bold shrink-0 ml-4 ${tx.type === 'income' ? 'text-green-600' : 'text-gray-900'}`}>
                              {isBalanceVisible ? `${tx.type === 'income' ? '+' : ''}${f1(Math.abs(tx.amount))}` : '****'}
                          </span>
                      </div>
                  )) : <div className={`py-4 pl-12 pr-4 text-[10px] text-gray-400 italic ${childBg}`}>No transactions found</div>}
              </div>
            )}
          </div>
        );
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6 border border-gray-200">
        <div className={`${headerColor} text-white px-4 py-3 font-bold text-sm flex justify-between items-center`}>
           <span>{title}</span>
           <span className="text-xs opacity-90">{isBalanceVisible ? `$${f1(totalTracked)}` : '****'}</span>
        </div>

        <div className="p-4 flex flex-col items-center">
            {totalTracked > 0 ? (
              <>
                <div className="w-full h-48 sm:h-56">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={finalChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="60%" outerRadius="85%" paddingAngle={4}>
                        {finalChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full flex flex-col gap-y-2 mt-4 px-2">
                    {finalChartData.map((entry, index) => (
                        <div key={entry.name} className="flex items-center justify-between text-[11px] sm:text-xs">
                            <div className="flex items-center min-w-0 flex-1">
                               <span className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: chartColors[index % chartColors.length] }}></span>
                               <span className={`text-gray-600 font-medium truncate ${entry.name === 'Remaining' ? 'italic text-gray-400' : ''}`}>
                                 {entry.name === 'Remaining' ? 'Remaining Categories' : getDisplayCategoryName(entry.name)}
                               </span>
                               <span className="text-[10px] text-gray-400 font-bold ml-2">{((entry.value / totalTracked) * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center shrink-0">
                                <span className="font-mono font-bold text-gray-800">{isBalanceVisible ? `$${f1(entry.value)}` : '****'}</span>
                            </div>
                        </div>
                    ))}
                </div>
              </>
            ) : (
              <div className="h-32 flex items-center justify-center text-gray-300 text-sm font-medium italic">No data for this period</div>
            )}
        </div>

        <button 
          onClick={() => toggleSection(sectionKey)}
          className="w-full py-3 border-t border-gray-100 flex items-center justify-center gap-2 text-blue-600 font-bold text-xs bg-blue-50/30 hover:bg-blue-50 transition-colors"
        >
          {isExpanded ? 'Hide Category Details' : 'Show Category Details'}
          <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>

        {isExpanded && (
          <div className="animate-fade-in bg-gray-50/30">
            <div className="flex justify-between px-4 py-2 text-[9px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 bg-gray-50">
                <span>Category / Progress</span>
                <span>Tracked / Budget</span>
            </div>
            
            {mainCategories.map(cat => renderCategoryRow(cat))}
            {otherCategories.map(cat => renderCategoryRow(cat))}

            {hasStray && (
               <div className="flex flex-col border-t-2 border-dashed border-gray-100">
                  <div 
                    onClick={() => toggleCategoryDrilldown(`${sectionKey}-virtual-others`)} 
                    className={`flex justify-between items-center py-4 px-4 transition-colors cursor-pointer bg-red-50/20 ${expandedCategories[`${sectionKey}-virtual-others`] ? 'bg-red-50' : 'hover:bg-red-50/40'}`}
                  >
                    <div className="flex flex-col flex-1 pr-4 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                           <span className="font-bold text-red-800 text-sm leading-tight italic underline decoration-red-200 decoration-2">Uncategorized Items</span>
                           <span className="text-[10px] text-red-400 font-bold bg-white/50 px-1.5 rounded-md border border-red-100">{strayTxs.length} items</span>
                           <svg className={`w-3 h-3 text-red-400 transition-transform ${expandedCategories[`${sectionKey}-virtual-others`] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                        <span className="font-mono font-bold text-red-900 text-sm">{isBalanceVisible ? `$${f1(strayValue)}` : '****'}</span>
                        <span className="text-[9px] text-red-400 font-black uppercase tracking-tighter">Missing Cat</span>
                    </div>
                  </div>
                  {expandedCategories[`${sectionKey}-virtual-others`] && (
                    <div className="divide-y divide-white/50 bg-red-50/40">
                        {strayTxs.map(tx => (
                            <div key={tx.id} className="flex justify-between items-center py-3 pl-12 pr-4">
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[11px] font-bold text-gray-800 truncate">
                                        {getDisplayCategoryName(tx.category || "Others")}
                                    </span>
                                    <div className="flex flex-col mt-0.5">
                                        <span className="text-[9px] text-gray-500 font-semibold">{format(new Date(tx.date), 'MMMM d, yyyy')}</span>
                                        {tx.note && <span className="text-[9px] text-gray-400 italic font-medium truncate max-w-[200px]">{tx.note}</span>}
                                    </div>
                                </div>
                                <span className={`text-[11px] font-mono font-bold shrink-0 ml-4 ${tx.type === 'income' ? 'text-green-600' : 'text-gray-900'}`}>
                                    {isBalanceVisible ? `${tx.type === 'income' ? '+' : ''}${f1(Math.abs(tx.amount))}` : '****'}
                                </span>
                            </div>
                        ))}
                    </div>
                  )}
               </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const periodLabel = useMemo(() => {
    if (viewTimeFrame === 'monthly') return format(viewDate, 'MMMM yyyy');
    if (viewTimeFrame === 'daily') return format(viewDate, 'MMMM d, yyyy');
    return `Cumulative (since ${format(firstTxDate, 'MMM yyyy')})`;
  }, [viewTimeFrame, viewDate, firstTxDate]);

  return (
    <div className="space-y-4 pb-24">
      <div className="bg-gray-200 p-1 rounded-xl flex text-xs font-semibold">
          {(['monthly', 'daily', 'cumulative'] as const).map(mode => (
              <button 
                  key={mode} 
                  onClick={() => { setViewTimeFrame(mode); jumpToToday(); }} 
                  className={`flex-1 py-1.5 rounded-lg capitalize transition-all duration-200 leading-none ${viewTimeFrame === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  {mode}
              </button>
          ))}
      </div>

      <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <button onClick={handlePrev} disabled={viewTimeFrame === 'cumulative'} className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 active:scale-90 transition-transform disabled:opacity-30">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={handleNext} disabled={viewTimeFrame === 'cumulative'} className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 active:scale-90 transition-transform disabled:opacity-30">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <div className="text-center"><p className="text-sm font-extrabold text-gray-800 tracking-tight">{periodLabel}</p></div>
          <button onClick={jumpToToday} disabled={viewTimeFrame === 'cumulative' || (viewTimeFrame === 'monthly' ? isSameMonth(new Date(), viewDate) : isSameDay(new Date(), viewDate))} className="text-[10px] font-bold text-blue-600 uppercase tracking-widest disabled:opacity-30 px-2 py-1 bg-blue-50 rounded-md">Today</button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-blue-500"></div>
        
        <button 
          onClick={() => setIsBalanceVisible(!isBalanceVisible)}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 rounded-full"
        >
          {isBalanceVisible ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          )}
        </button>

        <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-[0.2em] mb-1">Net Balance</p>
        <p className={`text-3xl font-black tracking-tighter ${netBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {isBalanceVisible ? `${netBalance < 0 ? '-$' : '$'}${f1(Math.abs(netBalance))}` : '****'}
        </p>
        <div className="flex justify-center gap-4 mt-3 pt-3 border-t border-gray-50">
            <div className="text-left"><span className="block text-[8px] text-gray-400 font-bold uppercase">Income</span><span className="font-mono font-bold text-green-600 text-xs">{isBalanceVisible ? `$${f1(totalIncome)}` : '****'}</span></div>
            <div className="text-left"><span className="block text-[8px] text-gray-400 font-bold uppercase">Expenses</span><span className="font-mono font-bold text-red-500 text-xs">{isBalanceVisible ? `$${f1(totalExpenses)}` : '****'}</span></div>
        </div>
      </div>

      {renderSection('Income', incomeCategories, 'bg-green-500')}
      {renderSection('Expenses', expenseCategories, 'bg-red-700')}
      {renderSection('Savings', investmentCategories, 'bg-blue-600')}
    </div>
  );
};

export default Dashboard;