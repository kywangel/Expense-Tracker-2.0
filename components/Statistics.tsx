import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Transaction, AppSettings } from '../types';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    Area, AreaChart, CartesianGrid
} from 'recharts';
import { 
    format, endOfWeek, endOfYear,
    eachDayOfInterval, eachMonthOfInterval, 
    isToday, isSameMonth, addWeeks, addYears, isSameDay,
    startOfDay, addDays, getYear, subMonths, startOfMonth, endOfMonth,
    subWeeks, startOfWeek as dateFnsStartOfWeek
} from 'date-fns';

const startOfYear = (date: Date) => {
    const d = new Date(date);
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
    return d;
};

interface StatisticsProps {
  transactions: Transaction[];
  incomeCategories: string[];
  investmentCategories: string[];
  expenseCategories: string[];
  settings: AppSettings;
}

const IOS_COLORS = [
    '#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', 
    '#5AC8FA', '#FF2D55', '#5856D6', '#FFCC00', '#8E8E93', 
    '#63E6BE', '#FA5252', '#BE4BDB', '#4C6EF5', '#FAB005', 
    '#12B886', '#7950F2', '#FD7E14', '#228BE6', '#E64980'
];

const f1 = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f0 = (val: number) => Math.round(val).toLocaleString('en-US');

const formatAccounting = (val: number) => {
    const absVal = Math.abs(val);
    const sign = val < 0 ? "-" : "";
    let formattedNum = "";
    
    if (absVal >= 1000000) {
        formattedNum = (absVal / 1000000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'm';
    } else if (absVal >= 1000) {
        formattedNum = (absVal / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'k';
    } else {
        formattedNum = absVal.toLocaleString('en-US');
    }
    
    return `${sign}$${formattedNum}`;
};

const Statistics: React.FC<StatisticsProps> = ({ transactions, expenseCategories, settings }) => {
  const [period, setPeriod] = useState<'Daily' | 'W' | 'Y'>('Daily');
  const [assetView, setAssetView] = useState<'wealth' | 'investment'>('wealth');
  const [dateOffset, setDateOffset] = useState(0); 

  const [monthlyFlowYear, setMonthlyFlowYear] = useState(new Date().getFullYear());
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const spendingScrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Centrally manage the popup (tooltip) visibility and data
  const [activePopupData, setActivePopupData] = useState<any>(null);

  const sortedTransactions = useMemo(() => 
    [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [transactions]
  );

  const allMonthlyBalances = useMemo(() => {
    if (sortedTransactions.length === 0) return [];
    const firstTxDate = new Date(sortedTransactions[0].date);
    const historyMonths = Math.max(47, Math.ceil((new Date().getTime() - firstTxDate.getTime()) / (30 * 24 * 3600 * 1000)));
    const start = startOfMonth(subMonths(new Date(), historyMonths));
    const end = endOfMonth(new Date());
    const months = eachMonthOfInterval({ start, end });
    
    let runningWealth = 0;
    let runningInvestment = 0;
    
    const priorTxs = sortedTransactions.filter(tx => new Date(tx.date) < start);
    priorTxs.forEach(tx => {
        if (tx.type === 'income') runningWealth += Math.abs(tx.amount);
        if (tx.type === 'expense') runningWealth -= Math.abs(tx.amount);
        if (tx.type === 'investment') runningInvestment += Math.abs(tx.amount);
    });

    const results: { name: string; date: Date; wealth: number; investment: number }[] = [];
    months.forEach(monthDate => {
        const mStart = startOfMonth(monthDate);
        const mEnd = endOfMonth(monthDate);
        const monthTxs = sortedTransactions.filter(tx => {
            const d = new Date(tx.date);
            return d >= mStart && d <= mEnd;
        });
        monthTxs.forEach(tx => {
            if (tx.type === 'income') runningWealth += Math.abs(tx.amount);
            if (tx.type === 'expense') runningWealth -= Math.abs(tx.amount);
            if (tx.type === 'investment') runningInvestment += Math.abs(tx.amount);
        });
        results.push({ name: format(monthDate, 'MMM'), date: monthDate, wealth: runningWealth, investment: runningInvestment });
    });
    return results;
  }, [sortedTransactions]);

  const assetChartDomain = useMemo(() => {
    if (allMonthlyBalances.length === 0) return [0, 1000];
    const vals = allMonthlyBalances.map(b => assetView === 'wealth' ? b.wealth : b.investment);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min;
    const padding = range * 0.1 || 1000;
    return [min - padding, max + padding];
  }, [allMonthlyBalances, assetView]);

  const [activeWindowEndIndex, setActiveWindowEndIndex] = useState(allMonthlyBalances.length > 0 ? allMonthlyBalances.length - 1 : 0);

  useEffect(() => {
    if (allMonthlyBalances.length > 0) {
      setActiveWindowEndIndex(allMonthlyBalances.length - 1);
    }
  }, [allMonthlyBalances.length]);

  useEffect(() => {
    if (scrollRef.current && allMonthlyBalances.length > 0) {
        const timeout = setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
          }
        }, 150);
        return () => clearTimeout(timeout);
    }
  }, [allMonthlyBalances.length]);

  useEffect(() => {
    if (spendingScrollRef.current) {
        spendingScrollRef.current.scrollLeft = spendingScrollRef.current.scrollWidth;
    }
  }, [period, dateOffset]);

  const handleAssetScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      const scrollPos = container.scrollLeft;
      const containerWidth = container.clientWidth;
      const contentWidth = container.scrollWidth;
      const ratio = scrollPos / (contentWidth - containerWidth || 1);
      const safeIndex = Math.max(0, Math.min(allMonthlyBalances.length - 1, Math.round(ratio * (allMonthlyBalances.length - 1))));
      if (safeIndex !== activeWindowEndIndex) setActiveWindowEndIndex(safeIndex);
  };

  const onMouseDown = (e: React.MouseEvent, ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current) return;
    setIsDragging(true);
    setStartX(e.pageX - ref.current.offsetLeft);
    setScrollLeft(ref.current.scrollLeft);
  };

  const onMouseLeave = () => setIsDragging(false);
  const onMouseUp = () => setIsDragging(false);

  const onMouseMove = (e: React.MouseEvent, ref: React.RefObject<HTMLDivElement>) => {
    if (!isDragging || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX) * 1.5; 
    ref.current.scrollLeft = scrollLeft - walk;
  };

  const windowStats = useMemo(() => {
      if (allMonthlyBalances.length === 0) return { change: 0, range: 'No data', percent: 0 };
      const endIndex = Math.max(0, Math.min(allMonthlyBalances.length - 1, activeWindowEndIndex));
      const startIndex = Math.max(0, endIndex - 23); 
      const first = allMonthlyBalances[startIndex] || allMonthlyBalances[0];
      const last = allMonthlyBalances[endIndex];
      const valStart = assetView === 'wealth' ? first.wealth : first.investment;
      const valEnd = assetView === 'wealth' ? last.wealth : last.investment;
      const change = valEnd - valStart;
      const percent = valStart !== 0 ? (change / Math.abs(valStart)) * 100 : 0;
      return { change, range: `${format(first.date, 'MMM yyyy')} - ${format(last.date, 'MMM yyyy')}`, percent };
  }, [allMonthlyBalances, activeWindowEndIndex, assetView]);

  const getDisplayCategoryName = (name: string) => {
    const icon = settings.categoryIcons[name];
    return icon ? `${icon} ${name}` : name;
  };

  const spendingChartData = useMemo(() => {
    const baseDate = new Date();
    let interval: { start: Date; end: Date };
    let formatLabel: (date: Date) => string;
    let dataPoints: Date[];

    const firstTxDate = sortedTransactions.length > 0 ? startOfMonth(new Date(sortedTransactions[0].date)) : subMonths(new Date(), 36);

    switch (period) {
      case 'W':
        const currentWeekEnd = endOfWeek(addWeeks(baseDate, dateOffset));
        const windowStart = subWeeks(dateFnsStartOfWeek(currentWeekEnd), 3);
        interval = { start: windowStart, end: currentWeekEnd };
        dataPoints = eachDayOfInterval(interval);
        formatLabel = (date) => format(date, 'EEE');
        break;
      case 'Y':
        // Yearly view: only up to latest month
        const latestMonth = endOfMonth(new Date());
        interval = { start: firstTxDate, end: latestMonth };
        dataPoints = eachMonthOfInterval(interval);
        formatLabel = (date) => format(date, 'MMM');
        break;
      default: return [];
    }
    
    const relevantTxs = sortedTransactions.filter(tx => {
        const txDate = new Date(tx.date);
        return !isNaN(txDate.getTime()) && txDate >= interval.start && txDate <= interval.end && tx.type === 'expense';
    });

    const results: any[] = [];
    dataPoints.forEach(point => {
        const key = formatLabel(point);
        const pointData: any = { name: key, rawDate: point };
        relevantTxs.forEach(tx => {
            if (isSameDay(new Date(tx.date), point) || (period === 'Y' && isSameMonth(new Date(tx.date), point))) {
                // Logic: Match predefined categories, otherwise "Uncategorized Items"
                const mappedCategory = expenseCategories.includes(tx.category) ? tx.category : "Uncategorized Items";
                pointData[mappedCategory] = (pointData[mappedCategory] || 0) + Math.abs(tx.amount);
            }
        });
        results.push(pointData);
    });
    return results;
  }, [sortedTransactions, period, dateOffset, expenseCategories]);

  const spendingChartDomain = useMemo(() => {
    if (spendingChartData.length === 0) return [0, 1000];
    const maxVal = Math.max(...spendingChartData.map(d => {
        let sum = 0;
        // Total sum includes all expense categories + Uncategorized
        [...expenseCategories, "Uncategorized Items"].forEach(cat => { sum += (d[cat] || 0); });
        return sum;
    }));
    return [0, Math.ceil(maxVal * 1.1) || 1000];
  }, [spendingChartData, expenseCategories]);

  const expenseColors = useMemo(() => {
    const colorMap: Record<string, string> = {};
    expenseCategories.forEach((cat, i) => { colorMap[cat] = IOS_COLORS[i % IOS_COLORS.length]; });
    colorMap["Uncategorized Items"] = "#94a3b8"; // Slate color for uncategorized
    return colorMap;
  }, [expenseCategories]);

  // Centered Overlay Tooltip ensuring full message visibility
  const CenteredGlobalTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const displayDate = data.rawDate 
        ? (period === 'W' ? format(data.rawDate, 'MMMM do, yyyy') : format(data.rawDate, 'MMMM yyyy')) 
        : data.name;
        
      const validItems = payload.filter((item: any) => item.value !== undefined && item.value > 0);
      // Top 5 spending categories logic
      const sortedItems = [...validItems].sort((a: any, b: any) => b.value - a.value).slice(0, 5);
      const total = validItems.reduce((s: number, i: any) => s + i.value, 0);
      
      return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6 pointer-events-none transition-opacity animate-fade-in">
          <div className="rounded-[2.5rem] border border-gray-100 flex flex-col bg-white overflow-hidden shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] min-w-[300px] max-w-[90%] pointer-events-auto">
            <div className="px-8 pt-7 pb-4 border-b border-gray-50 bg-gray-50/50">
              <p className="text-[12px] font-black text-blue-600 uppercase tracking-[0.25em] mb-1.5">
                {period === 'W' ? 'Weekly Data' : 'Monthly Data'}
              </p>
              <p className="text-[18px] font-black text-gray-900 tracking-tight leading-none">{displayDate}</p>
            </div>
            <div className="flex flex-col p-8 space-y-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Top 5 Categories</span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</span>
              </div>
              {sortedItems.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-4 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.color }} />
                      <span className="text-[14px] font-bold truncate text-gray-700 tracking-tight">{getDisplayCategoryName(item.name)}</span>
                  </div>
                  <span className="text-[14px] font-mono font-black text-gray-900 whitespace-nowrap">${f1(item.value)}</span>
                </div>
              ))}
              {validItems.length === 0 && (
                <div className="py-8 text-center text-gray-400 font-bold italic">Zero transactions recorded</div>
              )}
              <div className="pt-6 border-t border-gray-100 mt-2 flex justify-between items-center">
                  <span className="text-[12px] font-black text-gray-400 uppercase tracking-widest">Total Expenses</span>
                  <span className="text-[20px] font-mono font-black text-blue-600 leading-none">${f1(total)}</span>
              </div>
              {validItems.length > 5 && (
                  <p className="text-[11px] text-gray-300 font-bold uppercase text-center pt-2 italic tracking-tighter">
                    + {validItems.length - 5} other categories
                  </p>
              )}
            </div>
            <button 
                onPointerDown={() => setActivePopupData(null)}
                className="bg-gray-900 text-white py-4 font-black text-xs uppercase tracking-[0.2em] active:bg-gray-800 transition-colors"
            >
                Dismiss Analysis
            </button>
          </div>
        </div>
      );
    }
    return null;
  };

  const ManualLegend = ({ categories, colors }: { categories: string[], colors: Record<string, string> }) => {
    if (!categories || categories.length === 0) return null;
    return (
      <div className="mt-8 px-2 grid grid-cols-3 gap-x-2 gap-y-3 border-t border-gray-50 pt-8">
        {categories.map((cat, index) => (
          <div key={index} className="flex items-center gap-1.5 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: colors[cat] || '#ccc' }} />
            <span className="text-[9px] leading-tight font-bold text-gray-400 truncate">{getDisplayCategoryName(cat)}</span>
          </div>
        ))}
      </div>
    );
  };

  const DailyTableView = () => {
    const viewDate = startOfDay(addDays(new Date(), dateOffset));
    const yearStr = getYear(viewDate).toString();
    const effectiveBudgets = settings.yearlyBudgets?.[yearStr] || settings.baseCategoryBudgets || {};
    const trackedCats = settings.dailyViewCategories || [];
    const monthTxs = transactions.filter(tx => isSameMonth(new Date(tx.date), viewDate) && tx.type === 'expense');
    const selectedDayTxs = transactions.filter(tx => isSameDay(new Date(tx.date), viewDate) && tx.type === 'expense');
    const totalExpenseBudget = expenseCategories.reduce((sum, c) => sum + (effectiveBudgets[c] || 0), 0);
    const trackedBudgetSum = trackedCats.reduce((sum, c) => sum + (effectiveBudgets[c] || 0), 0);
    const rows = trackedCats.map(cat => {
        const budget = effectiveBudgets[cat] || 0;
        const daySpent = selectedDayTxs.filter(t => t.category === cat).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const monthSpent = monthTxs.filter(t => t.category === cat).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        return { cat, budget, daySpent, leftMonth: budget - monthSpent };
    });
    const untrackedBudget = totalExpenseBudget - trackedBudgetSum;
    const othersDaySpent = selectedDayTxs.filter(t => !trackedCats.includes(t.category)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const othersMonthSpent = monthTxs.filter(t => !trackedCats.includes(t.category)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    rows.push({ cat: 'Others', budget: untrackedBudget, daySpent: othersDaySpent, leftMonth: untrackedBudget - othersMonthSpent });
    const spentHeaderLabel = isToday(viewDate) ? 'Today' : format(viewDate, 'MMM d');
    return (
        <div className="space-y-4 animate-fade-in px-1">
            <div className="flex items-center justify-between py-2 bg-white sticky top-0 z-[40]">
                <button onClick={() => setDateOffset(p => p - 1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 border border-gray-100 active:scale-90 transition-transform">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="flex flex-col items-center"><span className="text-sm font-bold text-gray-700 tracking-tight">{format(viewDate, 'EEEE, MMM do')}</span></div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setDateOffset(0)} disabled={dateOffset === 0} className="text-xs font-bold text-blue-600 px-2 disabled:opacity-30">Today</button>
                    <button onClick={() => setDateOffset(p => p + 1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 border border-gray-100 active:scale-90 transition-transform">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <table className="w-full text-[10px] text-left border-collapse">
                    <thead>
                        <tr className="text-gray-400 font-bold uppercase tracking-widest border-b border-gray-50 bg-gray-50/20">
                            <th className="px-4 py-3">Category</th>
                            <th className="px-2 py-3 text-right">Budget</th>
                            <th className="px-2 py-3 text-right text-blue-600 bg-blue-50/10">{spentHeaderLabel}</th>
                            <th className="px-2 py-3 text-right">Left</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {rows.map(r => (
                            <tr key={r.cat}>
                                <td className="px-4 py-3 font-semibold text-gray-600">{getDisplayCategoryName(r.cat)}</td>
                                <td className="px-2 py-3 text-right font-mono text-gray-400">${f0(r.budget)}</td>
                                <td className={`px-2 py-3 text-right font-mono font-bold ${r.daySpent > 0 ? 'text-blue-500' : 'text-gray-300'}`}>${f0(r.daySpent)}</td>
                                <td className={`px-2 py-3 text-right font-mono font-bold ${r.leftMonth < 0 ? 'text-red-400' : 'text-green-500'}`}>${f0(r.leftMonth)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };

  const flowOverTimeData = useMemo(() => {
    const yearStart = startOfYear(new Date(monthlyFlowYear, 0, 1));
    const yearEnd = endOfYear(new Date(monthlyFlowYear, 11, 31));
    const monthlyDataMap = new Map<string, { name: string, income: number, expense: number, investment: number }>();
    const yearMonths = eachMonthOfInterval({ start: yearStart, end: yearEnd });
    yearMonths.forEach(m => monthlyDataMap.set(format(m, 'MMM'), { name: format(m, 'MMM'), income: 0, expense: 0, investment: 0 }));
    sortedTransactions.forEach(curr => {
        const txDate = new Date(curr.date);
        if (txDate >= yearStart && txDate <= yearEnd) {
            const month = format(txDate, 'MMM');
            const monthEntry = monthlyDataMap.get(month);
            if (monthEntry) {
                if (curr.type === 'income') monthEntry.income += curr.amount;
                else if (curr.type === 'expense') monthEntry.expense += Math.abs(curr.amount);
                else if (curr.type === 'investment') monthEntry.investment += Math.abs(curr.amount);
            }
        }
    });
    return Array.from(monthlyDataMap.values());
  }, [sortedTransactions, monthlyFlowYear]);

  const gradientOffset = useMemo(() => {
    if (!allMonthlyBalances || allMonthlyBalances.length === 0) return 0;
    const balances = allMonthlyBalances.map(i => assetView === 'wealth' ? i.wealth : i.investment);
    const max = Math.max(...balances);
    const min = Math.min(...balances);
    if (max <= 0.0001) return 0; 
    if (min >= 0) return 1;
    return max / (max - min);
  }, [allMonthlyBalances, assetView]);

  const currentViewRangeLabel = useMemo(() => {
    if (spendingChartData.length === 0) return 'No Data Available';
    const first = spendingChartData[0].rawDate;
    const last = spendingChartData[spendingChartData.length-1].rawDate;
    if (period === 'W') return `${format(first, 'd MMM')} - ${format(last, 'd MMM yyyy')}`;
    return `${format(first, 'MMM yyyy')} - ${format(last, 'MMM yyyy')}`;
  }, [spendingChartData, period]);

  return (
    <div className="space-y-4 pb-40 px-1 -mt-4" onClick={() => setActivePopupData(null)}>
       <style dangerouslySetInnerHTML={{ __html: `
         .recharts-wrapper { overflow: visible !important; }
         .recharts-surface { overflow: visible !important; }
         .recharts-cartesian-grid-horizontal line { stroke: #f3f4f6; }
         .no-scrollbar::-webkit-scrollbar { display: none; }
         .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
         svg { outline: none !important; }
         .recharts-surface:focus { outline: none !important; }
         * { -webkit-tap-highlight-color: transparent !important; }
         .chart-container-relative-box { position: relative; height: 280px; width: 100%; overflow: visible; }
         .static-y-axis-overlay { position: absolute; top: 0; right: 0; height: 100%; width: 56px; background: white; z-index: 20; pointer-events: none; border-left: 1px dashed #f1f5f9; }
         .scrollable-chart-layer { height: 100%; overflow-x: auto; overflow-y: visible; cursor: grab; }
         .scrollable-chart-layer:active { cursor: grabbing; }
         .recharts-clip-layer { clip-path: inset(0 0 0 0); }
         .recharts-tooltip-wrapper { visibility: hidden !important; }
         @keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
         .animate-fade-in { animation: fadeIn 0.15s cubic-bezier(0.2, 0, 0, 1) forwards; }
       `}} />

       {/* Net Asset Card */}
       <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden select-none">
            <div className="flex justify-between items-end mb-6 relative z-30 bg-white">
                <h3 className="font-bold text-lg text-gray-800 tracking-tight leading-none mb-1">Net Asset</h3>
                <div className="flex bg-gray-100 p-0.5 rounded-lg text-[10px] font-bold shrink-0">
                    <button onClick={() => setAssetView('wealth')} className={`px-3 py-1 rounded-md transition-all ${assetView === 'wealth' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>Wealth</button>
                    <button onClick={() => setAssetView('investment')} className={`px-3 py-1 rounded-md transition-all ${assetView === 'investment' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>Investments</button>
                </div>
            </div>

            <div className="mt-10 mb-8 flex flex-col relative z-20">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                    <p className={`text-xl font-black ${windowStats.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {windowStats.change >= 0 ? '+' : ''}${f1(windowStats.change)}
                    </p>
                    <span className={`text-[10px] font-bold ${windowStats.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {windowStats.change >= 0 ? '▲' : '▼'}{Math.abs(Math.round(windowStats.percent))}%
                    </span>
                </div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">{windowStats.range}</p>
            </div>

            <div className="chart-container-relative-box overflow-hidden">
                <div ref={scrollRef} onScroll={handleAssetScroll} onMouseDown={(e) => onMouseDown(e, scrollRef)} onMouseLeave={onMouseLeave} onMouseUp={onMouseUp} onMouseMove={(e) => onMouseMove(e, scrollRef)} className="scrollable-chart-layer no-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}>
                    <div style={{ width: `${Math.max(100, (allMonthlyBalances.length / 24) * 100)}%`, minWidth: '100%', height: '100%' }} className="relative block pointer-events-none">
                        <div className="pointer-events-auto w-full h-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={allMonthlyBalances} margin={{ top: 10, right: 0, left: 0, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="colorSplitTrend" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0" stopColor={gradientOffset > 0 ? "#10b981" : "#ef4444"} stopOpacity={0.2} />
                                            <stop offset={gradientOffset} stopColor={gradientOffset > 0 ? "#10b981" : "#ef4444"} stopOpacity={0.2} />
                                            <stop offset={gradientOffset} stopColor="#ef4444" stopOpacity={0.2} />
                                            <stop offset="1" stopColor="#ef4444" stopOpacity={0.2} />
                                        </linearGradient>
                                        <linearGradient id="strokeSplitTrend" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0" stopColor={gradientOffset > 0 ? "#10b981" : "#ef4444"} />
                                            <stop offset={gradientOffset} stopColor={gradientOffset > 0 ? "#10b981" : "#ef4444"} />
                                            <stop offset={gradientOffset} stopColor="#ef4444" />
                                            <stop offset="1" stopColor="#ef4444" />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                    <XAxis dataKey="name" tick={{fontSize: 8, fontWeight: 700, fill: '#cbd5e1'}} tickFormatter={(v) => v.charAt(0)} stroke="none" dy={5} interval={0} padding={{ left: 0, right: 0 }} />
                                    <YAxis hide domain={assetChartDomain} />
                                    <Area type="monotone" dataKey={assetView} stroke="url(#strokeSplitTrend)" strokeWidth={3} fillOpacity={1} fill="url(#colorSplitTrend)" isAnimationActive={false} dot={{ r: 3, fill: '#94a3b8', strokeWidth: 0, fillOpacity: 0.8 }} activeDot={{ r: 5, strokeWidth: 0, fill: '#94a3b8' }} connectNulls />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
                <div className="static-y-axis-overlay">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={allMonthlyBalances} margin={{ top: 10, right: 2, left: 0, bottom: 5 }}>
                            <YAxis orientation="right" tick={{fontSize: 8, fontWeight: 700, fill: '#cbd5e1', textAnchor: 'start', dx: 2}} tickFormatter={formatAccounting} width={52} domain={assetChartDomain} axisLine={false} tickLine={false} />
                            <Area dataKey={assetView} stroke="none" fill="none" isAnimationActive={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* Refined Spending Card: exactly 12 columns visible for Y, scroll navigation, and centered pop-up */}
        <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-visible select-none">
             <div className="flex justify-between items-end mb-8 relative z-30 bg-white">
                <div className="flex flex-col min-w-0 flex-1">
                    <h3 className="font-bold text-lg text-gray-800 tracking-tight leading-none mb-1">Spending</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{period === 'W' ? 'WEEKLY' : 'YEARLY'} SPENDING ANALYSIS</p>
                </div>
                <div className="flex bg-gray-100 p-0.5 rounded-lg text-[10px] font-bold ml-2 shrink-0">
                    {(['Daily', 'W', 'Y'] as const).map(p => (
                        <button key={p} onClick={() => { setPeriod(p); setDateOffset(0); }} className={`px-3 py-1 rounded-md transition-all ${period === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>{p}</button>
                    ))}
                </div>
            </div>
            
            <div className="w-full">
                {period === 'Daily' ? <DailyTableView /> : (
                 <>
                  {/* Arrows deleted as requested, scroll navigation only */}
                  <div className="flex items-center justify-between mb-8 relative z-20 bg-white px-1">
                    <div className="flex flex-col">
                        <span className="text-xs font-black text-gray-900 tracking-tight">Period Shown</span>
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{currentViewRangeLabel}</span>
                    </div>
                    <button 
                        onClick={() => { setDateOffset(0); if(spendingScrollRef.current) spendingScrollRef.current.scrollLeft = spendingScrollRef.current.scrollWidth; }} 
                        className="text-xs font-black text-blue-600 px-5 py-2.5 bg-blue-50 rounded-2xl active:scale-95 transition-transform"
                    >
                        Today
                    </button>
                  </div>
                  
                  <div className="chart-container-relative-box overflow-visible">
                    <div ref={spendingScrollRef} onMouseDown={(e) => onMouseDown(e, spendingScrollRef)} onMouseLeave={onMouseLeave} onMouseUp={onMouseUp} onMouseMove={(e) => onMouseMove(e, spendingScrollRef)} className="scrollable-chart-layer no-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x', overflowX: 'auto', overflowY: 'visible' }}>
                        <div style={{ 
                            // WIDTH LOGIC: 7 bars for W, 12 bars for Y visible at once
                            width: `${Math.max(100, (spendingChartData.length / (period === 'W' ? 7 : 12)) * 100)}%`, 
                            minWidth: '100%', 
                            height: '100%' 
                        }} className="relative block pointer-events-none">
                            <div className="pointer-events-auto w-full h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={spendingChartData} margin={{ top: 0, right: 0, left: 5, bottom: 0 }} barGap={6}
                                        onMouseDown={(data) => {
                                            if (data && data.activePayload) {
                                                setActivePopupData({ active: true, payload: data.activePayload });
                                            }
                                        }}
                                    >
                                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                        <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} stroke="none" dy={10} interval={0} />
                                        <YAxis hide domain={spendingChartDomain} />
                                        {/* Hidden Tooltip but used to extract data on click/touch */}
                                        <Tooltip content={() => null} cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} />
                                        {[...expenseCategories, "Uncategorized Items"].map(cat => (
                                          <Bar 
                                            key={cat} 
                                            dataKey={cat} 
                                            stackId="a" 
                                            fill={expenseColors[cat] || '#ccc'} 
                                            name={cat} 
                                            isAnimationActive={false} 
                                            barSize={period === 'W' ? 24 : 18} // Adjusted sizes for visibility
                                          />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                    <div className="static-y-axis-overlay">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={spendingChartData} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                                <YAxis orientation="right" tick={{fontSize: 8, fontWeight: 700, fill: '#cbd5e1', textAnchor: 'start', dx: 2}} axisLine={false} tickLine={false} width={52} domain={spendingChartDomain} tickFormatter={(v) => v >= 1000 ? `$${f0(v/1000)}k` : `$${f0(v)}`} />
                                {[...expenseCategories, "Uncategorized Items"].map(cat => <Bar key={cat} dataKey={cat} stackId="a" fill="none" isAnimationActive={false} />)}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                  </div>
                  <ManualLegend categories={[...expenseCategories, "Uncategorized Items"]} colors={expenseColors} />
                 </>
                 )}
            </div>
        </div>

        {/* Centered Overlay Popup ensuring full visibility of Top 5 analysis */}
        {activePopupData && <CenteredGlobalTooltip active={activePopupData.active} payload={activePopupData.payload} />}

       <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-visible select-none">
          <div className="flex justify-between items-start mb-8 relative z-30 bg-white">
             <div className="flex flex-col min-w-0 flex-1">
                <h3 className="font-bold text-lg text-gray-800 tracking-tight leading-none mb-1 whitespace-nowrap overflow-hidden text-ellipsis">Monthly Flow</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest whitespace-nowrap overflow-hidden text-ellipsis">PORTFOLIO</p>
             </div>
            <div className="flex items-center bg-gray-50 px-3 py-1 rounded-full text-xs font-bold text-gray-500 gap-3 border border-gray-100 ml-2 shrink-0">
                 <button onClick={() => setMonthlyFlowYear(y => y - 1)} className="hover:text-blue-500 active:scale-90 transition-transform font-mono">&lt;</button>
                 <span className="w-8 text-center font-mono">{monthlyFlowYear}</span>
                 <button onClick={() => setMonthlyFlowYear(y => y + 1)} className="hover:text-blue-500 active:scale-90 transition-transform font-mono">&gt;</button>
            </div>
          </div>
          <div className="h-64 overflow-visible">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flowOverTimeData} margin={{ top: 0, right: 5, left: 5, bottom: 0 }} barSize={12}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 600, fill: '#cbd5e1'}} stroke="none" dy={10} interval={1} />
                <YAxis orientation="right" tick={{fontSize: 9, fontWeight: 600, fill: '#cbd5e1'}} stroke="none" width={40} dx={-2} tickFormatter={(v) => `$${f0(v/1000)}k`} />
                <Bar dataKey="income" fill="#10b981" name="Income" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="expense" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="investment" fill="#3b82f6" name="Investments" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ManualLegend categories={['Income', 'Expenses', 'Investments']} colors={{'Income': '#10b981', 'Expenses': '#ef4444', 'Investments': '#3b82f6'}} />
       </div>
    </div>
  );
};

export default Statistics;