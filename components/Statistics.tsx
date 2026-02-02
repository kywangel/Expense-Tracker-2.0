
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Transaction, AppSettings } from '../types';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    Area, AreaChart, CartesianGrid, ReferenceLine
} from 'recharts';
import { 
    format, endOfWeek, 
    eachDayOfInterval, eachMonthOfInterval, 
    isToday, isSameMonth, addWeeks, isSameDay,
    startOfDay, addDays, getYear, subMonths, startOfMonth, endOfMonth,
    subWeeks, startOfWeek as dateFnsStartOfWeek, endOfYear, addMonths,
    getDaysInMonth,
    getDate
} from 'date-fns';
import { getFinancialInterval } from '../constants';

const startOfYearFunc = (date: Date) => {
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
  isBalanceVisible: boolean;
  setIsBalanceVisible: React.Dispatch<React.SetStateAction<boolean>>;
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

const getNiceDomain = (vals: number[]): [number, number] => {
    if (vals.length === 0) return [0, 1000];
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const range = maxVal - minVal || 1000;
    return [minVal - range * 0.15, maxVal + range * 0.15];
};

const Statistics: React.FC<StatisticsProps> = ({ transactions, expenseCategories, settings, isBalanceVisible, setIsBalanceVisible }) => {
  const [period, setPeriod] = useState<'Daily' | 'W' | 'Y'>('Daily');
  const [assetView, setAssetView] = useState<'wealth' | 'investment'>('wealth');
  const [dateOffset, setDateOffset] = useState(0); 
  const [monthlyFlowYear, setMonthlyFlowYear] = useState(new Date().getFullYear());
  const [expandedDailyCats, setExpandedDailyCats] = useState<Record<string, boolean>>({});
  
  const spendingScrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);

  const onMouseDown = (e: React.MouseEvent, ref: React.RefObject<any>) => {
    if (!ref.current) return;
    isDragging.current = true;
    startX.current = e.pageX - ref.current.offsetLeft;
    scrollLeftStart.current = ref.current.scrollLeft;
  };

  const onMouseLeave = () => { isDragging.current = false; };
  const onMouseUp = () => { isDragging.current = false; };

  const onMouseMove = (e: React.MouseEvent, ref: React.RefObject<any>) => {
    if (!isDragging.current || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX.current) * 2;
    ref.current.scrollLeft = scrollLeftStart.current - walk;
  };

  const [visibleMax, setVisibleMax] = useState(1000);
  const [activePopupData, setActivePopupData] = useState<any>(null);

  const sortedTransactions = useMemo(() => 
    [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(a.date).getTime()),
    [transactions]
  );

  const allMonthlyBalances = useMemo(() => {
    if (sortedTransactions.length === 0) return [];
    
    let start = startOfMonth(subMonths(new Date(), 24)); 
    if (settings.cumulativeStartMonth) {
        const [y, m] = settings.cumulativeStartMonth.split('-').map(Number);
        start = new Date(y, m - 1, 1);
    } else if (sortedTransactions.length > 0) {
        start = startOfMonth(new Date(sortedTransactions[0].date));
    }
    
    const end = endOfMonth(new Date());
    const months = eachMonthOfInterval({ start, end });
    
    let runningWealth = 0;
    let runningInvestment = 0;
    let runningCumIncome = 0;
    let runningCumExpense = 0;

    sortedTransactions.forEach(tx => {
        const d = new Date(tx.date);
        if (d < start) {
            if (tx.type === 'income') { runningWealth += Math.abs(tx.amount); runningCumIncome += Math.abs(tx.amount); }
            if (tx.type === 'expense') { runningWealth -= Math.abs(tx.amount); runningCumExpense += Math.abs(tx.amount); }
            if (tx.type === 'investment') { runningInvestment += Math.abs(tx.amount); }
        }
    });

    return months.map(monthDate => {
        const mStart = startOfMonth(monthDate);
        const mEnd = endOfMonth(monthDate);
        const monthTxs = sortedTransactions.filter(tx => {
            const d = new Date(tx.date);
            return d >= mStart && d <= mEnd;
        });

        monthTxs.forEach(tx => {
            if (tx.type === 'income') { runningWealth += Math.abs(tx.amount); runningCumIncome += Math.abs(tx.amount); }
            if (tx.type === 'expense') { runningWealth -= Math.abs(tx.amount); runningCumExpense += Math.abs(tx.amount); }
            if (tx.type === 'investment') { runningInvestment += Math.abs(tx.amount); }
        });

        return { 
            name: format(monthDate, 'MMM'), 
            date: monthDate, 
            wealth: runningWealth, 
            investment: runningInvestment,
            cumIncome: runningCumIncome,
            cumExpense: runningCumExpense
        };
    });
  }, [sortedTransactions, settings.cumulativeStartMonth]);

  const [assetEndIndex, setAssetEndIndex] = useState(allMonthlyBalances.length);
  const ASSET_WINDOW_SIZE = 12;

  useEffect(() => { setAssetEndIndex(allMonthlyBalances.length); }, [allMonthlyBalances.length]);

  const visibleAssetData = useMemo(() => {
      const start = Math.max(0, assetEndIndex - ASSET_WINDOW_SIZE);
      return allMonthlyBalances.slice(start, assetEndIndex);
  }, [allMonthlyBalances, assetEndIndex]);

  const assetChartDomain = useMemo(() => {
    const vals = visibleAssetData.map(b => assetView === 'wealth' ? b.wealth : b.investment);
    return getNiceDomain(vals);
  }, [visibleAssetData, assetView]);

  const windowStats = useMemo(() => {
    if (visibleAssetData.length === 0) return { current: 0, change: 0, percent: 0, range: 'No data' };
    const currentIdx = visibleAssetData.length - 1;
    const current = visibleAssetData[currentIdx]?.[assetView] || 0;
    const prev = visibleAssetData[0]?.[assetView] || 0;
    const change = current - prev;
    const percent = prev !== 0 ? (change / Math.abs(prev)) * 100 : (current > 0 ? 100 : 0);
    const dateRange = `${format(visibleAssetData[0].date, 'MMM yy').toUpperCase()} - ${format(visibleAssetData[currentIdx].date, 'MMM yy').toUpperCase()}`;
    return { current, change, percent, range: dateRange };
  }, [visibleAssetData, assetView]);

  const spendingChartData = useMemo(() => {
    const today = new Date();
    let interval: { start: Date; end: Date };
    let formatLabel: (date: Date) => string;
    let dataPoints: Date[];

    const firstTxDate = sortedTransactions.length > 0 ? startOfMonth(new Date(sortedTransactions[0].date)) : subMonths(today, 36);

    switch (period) {
      case 'W':
        const currentWeekEnd = endOfWeek(today);
        const windowStart = subWeeks(dateFnsStartOfWeek(currentWeekEnd), 24); 
        interval = { start: windowStart, end: currentWeekEnd };
        dataPoints = eachDayOfInterval(interval);
        formatLabel = (date) => format(date, 'EEE');
        break;
      case 'Y':
        const latestMonth = endOfMonth(today);
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

    return dataPoints.map(point => {
        const key = formatLabel(point);
        const pointData: any = { name: key, rawDate: point };
        relevantTxs.forEach(tx => {
            const txDate = new Date(tx.date);
            if (isSameDay(txDate, point) || (period === 'Y' && isSameMonth(txDate, point))) {
                const cat = expenseCategories.includes(tx.category) ? tx.category : "Uncategorized Items";
                pointData[cat] = (pointData[cat] || 0) + Math.abs(tx.amount);
            }
        });
        return pointData;
    });
  }, [sortedTransactions, period, expenseCategories]);

  const handleSpendingScroll = useCallback(() => {
    if (!spendingScrollRef.current || spendingChartData.length === 0) return;
    const el = spendingScrollRef.current;
    const visibleCount = period === 'W' ? 7 : 12;
    const barWidth = el.scrollWidth / spendingChartData.length;
    const startIndex = Math.max(0, Math.floor(el.scrollLeft / barWidth));
    const endIndex = Math.min(spendingChartData.length - 1, startIndex + visibleCount);
    const visibleData = spendingChartData.slice(startIndex, endIndex + 1);
    
    const totals = visibleData.map(d => {
        let sum = 0;
        [...expenseCategories, "Uncategorized Items"].forEach(cat => { sum += (d[cat] || 0); });
        return sum;
    });
    const [, neatMax] = getNiceDomain(totals);
    setVisibleMax(neatMax || 1000);
  }, [spendingChartData, period, expenseCategories]);

  useEffect(() => {
    handleSpendingScroll();
    if (spendingScrollRef.current) { spendingScrollRef.current.scrollLeft = spendingScrollRef.current.scrollWidth; }
  }, [period, spendingChartData, handleSpendingScroll]);

  const expenseColors = useMemo(() => {
    const colorMap: Record<string, string> = {};
    expenseCategories.forEach((cat, i) => { colorMap[cat] = IOS_COLORS[i % IOS_COLORS.length]; });
    colorMap["Uncategorized Items"] = "#94a3b8";
    return colorMap;
  }, [expenseCategories]);

  const getDisplayCategoryName = (name: string) => {
    const icon = settings.categoryIcons[name];
    return icon ? `${icon} ${name}` : name;
  };

  const DailyTableView = () => {
    const viewDate = startOfDay(addDays(new Date(), dateOffset));
    const billingStartDay = settings.billingCycleStartDay || 1;
    const { start: monthStart, end: monthEnd } = getFinancialInterval(viewDate, billingStartDay);
    
    const yearStr = getYear(viewDate).toString();
    const effectiveBudgets = settings.yearlyBudgets?.[yearStr] || settings.baseCategoryBudgets || {};
    const trackedCats = settings.dailyViewCategories || [];
    const freqTargets = settings.dailyTransactionsPerMonth || {};
    
    const monthTxs = transactions.filter(tx => {
        const tDate = new Date(tx.date);
        return tDate >= monthStart && tDate <= monthEnd && tx.type === 'expense';
    });
    const selectedDayTxs = transactions.filter(tx => isSameDay(new Date(tx.date), viewDate) && tx.type === 'expense');
    
    const totalExpenseBudget = expenseCategories.reduce((sum, c) => sum + (effectiveBudgets[c] || 0), 0);
    const trackedBudgetSum = trackedCats.reduce((sum, c) => sum + (effectiveBudgets[c] || 0), 0);
    
    const daysInMonthCount = Math.round((monthEnd.getTime() - monthStart.getTime()) / (1000 * 3600 * 24)) + 1;
    const currentDayOfCycle = Math.round((viewDate.getTime() - monthStart.getTime()) / (1000 * 3600 * 24)) + 1;
    const remainingDaysInMonth = Math.max(1, daysInMonthCount - currentDayOfCycle + 1);

    const rows = trackedCats.map(cat => {
        const budget = effectiveBudgets[cat] || 0;
        const freq = freqTargets[cat] || 0;
        const unit = freq > 0 ? budget / freq : 0;
        const daySpent = selectedDayTxs.filter(t => t.category === cat).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const monthSpent = monthTxs.filter(t => t.category === cat).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const monthCount = monthTxs.filter(t => t.category === cat && Math.abs(t.amount) > 0).length;
        
        const remainingBudget = budget - monthSpent;
        const remainingFreq = freq - monthCount;
        const avgLeft = remainingFreq > 0 ? (remainingBudget / remainingFreq) : remainingBudget;

        return { cat, budget, freq, unit, daySpent, avgLeft, totalLeft: remainingBudget, times: monthCount };
    });
    
    const othersBudget = totalExpenseBudget - trackedBudgetSum;
    const othersDaySpent = selectedDayTxs.filter(t => !trackedCats.includes(t.category)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const othersMonthSpent = monthTxs.filter(t => !trackedCats.includes(t.category)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const othersMonthCount = monthTxs.filter(t => !trackedCats.includes(t.category) && Math.abs(t.amount) > 0).length;
    const othersRemainingBudget = othersBudget - othersMonthSpent;
    const othersAvgLeft = othersRemainingBudget / remainingDaysInMonth;

    const grandTotalData = useMemo(() => {
        const initial = { budget: 0, daySpent: 0, spentMonth: 0, times: 0 };
        const summedRows = rows.reduce((acc, r) => ({
            budget: acc.budget + r.budget,
            daySpent: acc.daySpent + r.daySpent,
            spentMonth: acc.spentMonth + (r.budget - (r.totalLeft || 0)),
            times: acc.times + r.times
        }), initial);
        
        const totalBudget = summedRows.budget + othersBudget;
        const totalMonthSpent = monthTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const totalRemainingBudget = totalBudget - totalMonthSpent;
        
        return {
            budget: totalBudget,
            daySpent: rows.reduce((s, r) => s + r.daySpent, 0) + othersDaySpent,
            avgLeft: totalRemainingBudget / remainingDaysInMonth,
            totalLeft: totalRemainingBudget,
            times: summedRows.times + othersMonthCount
        };
    }, [rows, othersBudget, othersDaySpent, monthTxs, remainingDaysInMonth, othersMonthCount]);

    const isAllExpanded = useMemo(() => {
        const allTracked = trackedCats.length > 0 && trackedCats.every(c => expandedDailyCats[c]);
        return allTracked && expandedDailyCats['Others'] && expandedDailyCats['GrandTotal'];
    }, [trackedCats, expandedDailyCats]);

    const handleToggleAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isAllExpanded) {
            setExpandedDailyCats({});
        } else {
            const next: Record<string, boolean> = { Others: true, GrandTotal: true };
            trackedCats.forEach(c => next[c] = true);
            setExpandedDailyCats(next);
        }
    };
    
    const renderBreakdown = (catName: string, items: Transaction[]) => {
        const sorted = [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (sorted.length === 0) return <tr key={`${catName}-empty`} className="bg-blue-50/20 italic animate-fade-in text-gray-400 text-[10px]"><td colSpan={8} className="px-8 py-4 text-center">No transactions for this cycle.</td></tr>;
        
        const total = items.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

        return <React.Fragment key={`${catName}-breakdown`}>
            {sorted.map(tx => (
                <tr key={tx.id} className="bg-blue-50/10 text-[10px] animate-fade-in border-l-4 border-blue-400/40">
                    <td colSpan={3} className="px-6 py-2.5">
                        <div className="flex flex-col">
                            <span className="font-bold text-gray-700">{tx.category}</span>
                            {tx.note && <span className="text-gray-400 italic font-medium">{tx.note}</span>}
                            <span className="text-[8px] text-gray-300 font-bold uppercase mt-0.5">{format(new Date(tx.date), 'MMM d')}</span>
                        </div>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono font-bold text-blue-600">{isBalanceVisible ? `$${f0(Math.abs(tx.amount))}` : '****'}</td>
                    <td colSpan={4}></td>
                </tr>
            ))}
            <tr className="bg-blue-100/40 text-[10px] font-black border-l-4 border-blue-600 border-b border-blue-200/50">
                <td colSpan={3} className="px-6 py-3 text-blue-800 uppercase tracking-widest text-[8px]">
                    Cycle {catName === 'GrandTotal' ? 'Grand' : catName} Total
                </td>
                <td className="px-2 py-3 text-right font-mono text-blue-700 text-xs">
                    {isBalanceVisible ? `$${f0(total)}` : '****'}
                </td>
                <td colSpan={4} className="px-2 py-3 text-center text-blue-700 font-mono italic opacity-60">
                    {items.length} items
                </td>
            </tr>
        </React.Fragment>;
    };

    const renderChevron = (isExpanded: boolean) => (
        <svg className={`w-3 h-3 transition-transform duration-300 ml-1.5 ${isExpanded ? 'rotate-180 text-blue-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
    );

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex flex-col items-center justify-center gap-1 py-2 relative">
            <div className="flex items-center gap-4">
                <button onClick={() => setDateOffset(p => p - 1)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2" stroke="currentColor"/></svg>
                </button>
                <span className="text-sm font-bold text-gray-800">{format(viewDate, 'EEEE, MMM do')}</span>
                <button onClick={() => setDateOffset(p => p + 1)} disabled={dateOffset >= 0} className="p-2 rounded-full text-gray-500 disabled:opacity-10 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="2" stroke="currentColor"/></svg>
                </button>
            </div>
            {billingStartDay > 1 && (
                <span className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">Cycle: {format(monthStart, 'MMM d')} - {format(monthEnd, 'MMM d')}</span>
            )}
            <button onClick={() => setDateOffset(0)} disabled={dateOffset === 0} className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full disabled:opacity-0 transition-all">TODAY</button>
        </div>
        <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-[11px] sm:text-xs text-left border-collapse">
                <thead>
                    <tr className="bg-gray-50 text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100">
                        <th className="px-3 py-3 group cursor-pointer" onClick={handleToggleAll}>
                            <div className="flex items-center gap-1">
                                Category
                                <div className={`p-1 rounded-md transition-colors ${isAllExpanded ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                                    <svg className={`w-3 h-3 transition-transform duration-300 ${isAllExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </th>
                        <th className="px-2 py-3 text-right">Budget</th>
                        <th className="px-2 py-3 text-right bg-blue-50 text-blue-600">{isToday(viewDate) ? 'Today' : format(viewDate, 'MMM d')}</th>
                        <th className="px-2 py-3 text-right">AVG LEFT</th>
                        <th className="px-2 py-3 text-right">TOTAL LEFT</th>
                        <th className="px-2 py-3 text-center">Freq</th>
                        <th className="px-2 py-3 text-right">Unit</th>
                        <th className="px-2 py-3 text-center">#</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {rows.map(r => (
                        <React.Fragment key={r.cat}>
                            <tr onClick={() => setExpandedDailyCats(p => ({ ...p, [r.cat]: !p[r.cat] }))} className="cursor-pointer hover:bg-gray-50/80 transition-colors group">
                                <td className="px-3 py-3 font-bold text-gray-700 flex items-center">
                                    {getDisplayCategoryName(r.cat)}
                                    {renderChevron(expandedDailyCats[r.cat])}
                                </td>
                                <td className="px-2 py-3 text-right font-mono text-gray-500">{isBalanceVisible ? `$${f0(r.budget)}` : '****'}</td>
                                <td className={`px-2 py-3 text-right font-mono font-black bg-blue-50/30 ${r.daySpent > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{isBalanceVisible ? `$${f0(r.daySpent)}` : '****'}</td>
                                <td className={`px-2 py-3 text-right font-mono font-bold ${r.avgLeft < 0 ? 'text-red-500' : 'text-green-600'}`}>{isBalanceVisible ? `$${f0(r.avgLeft)}` : '****'}</td>
                                <td className={`px-2 py-3 text-right font-mono font-bold ${r.totalLeft < 0 ? 'text-red-500' : 'text-green-600'}`}>{isBalanceVisible ? `$${f0(r.totalLeft)}` : '****'}</td>
                                <td className="px-2 py-3 text-center text-gray-400 font-mono">{r.freq || '--'}</td>
                                <td className="px-2 py-3 text-right font-mono text-gray-500">{isBalanceVisible ? `$${f0(r.unit)}` : '****'}</td>
                                <td className="px-2 py-3 text-center font-mono font-black text-gray-800">{r.times}</td>
                            </tr>
                            {expandedDailyCats[r.cat] && renderBreakdown(r.cat, monthTxs.filter(tx => tx.category === r.cat))}
                        </React.Fragment>
                    ))}
                    <tr onClick={() => setExpandedDailyCats(p => ({ ...p, Others: !p.Others }))} className="bg-gray-50/30 cursor-pointer hover:bg-gray-100/60 transition-colors">
                        <td className="px-3 py-4 text-gray-600 italic font-medium flex items-center">
                            Others
                            {renderChevron(expandedDailyCats['Others'])}
                        </td>
                        <td className="px-2 py-4 text-right font-mono text-gray-500">{isBalanceVisible ? `$${f0(othersBudget)}` : '****'}</td>
                        <td className={`px-2 py-4 text-right font-mono font-black bg-blue-50/30 ${othersDaySpent > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{isBalanceVisible ? `$${f0(othersDaySpent)}` : '****'}</td>
                        <td className={`px-2 py-4 text-right font-mono font-bold ${othersAvgLeft < 0 ? 'text-red-500' : 'text-green-600'}`}>{isBalanceVisible ? `$${f0(othersAvgLeft)}` : '****'}</td>
                        <td className={`px-2 py-4 text-right font-mono font-bold ${othersRemainingBudget < 0 ? 'text-red-500' : 'text-green-600'}`}>{isBalanceVisible ? `$${f0(othersRemainingBudget)}` : '****'}</td>
                        <td className="px-2 py-4 text-center font-mono text-gray-400">--</td>
                        <td className="px-2 py-4 text-right font-mono text-gray-400">--</td>
                        <td className="px-2 py-4 text-center font-mono font-black text-gray-800">{othersMonthCount}</td>
                    </tr>
                    {expandedDailyCats['Others'] && renderBreakdown('Others', monthTxs.filter(tx => !trackedCats.includes(tx.category)))}
                    
                    <tr onClick={() => setExpandedDailyCats(p => ({ ...p, GrandTotal: !p.GrandTotal }))} className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-200 cursor-pointer hover:bg-gray-200/50 transition-colors">
                        <td className="px-3 py-4 text-[10px] uppercase tracking-wider flex items-center">
                            GRAND TOTAL
                            {renderChevron(expandedDailyCats['GrandTotal'])}
                        </td>
                        <td className="px-2 py-4 text-right font-mono">{isBalanceVisible ? `$${f0(grandTotalData.budget)}` : '****'}</td>
                        <td className="px-2 py-4 text-right font-mono bg-blue-100 text-blue-700">{isBalanceVisible ? `$${f0(grandTotalData.daySpent)}` : '****'}</td>
                        <td className={`px-2 py-4 text-right font-mono ${grandTotalData.avgLeft < 0 ? 'text-red-600' : 'text-green-700'}`}>{isBalanceVisible ? `$${f0(grandTotalData.avgLeft)}` : '****'}</td>
                        <td className={`px-2 py-4 text-right font-mono ${grandTotalData.totalLeft < 0 ? 'text-red-600' : 'text-green-700'}`}>{isBalanceVisible ? `$${f0(grandTotalData.totalLeft)}` : '****'}</td>
                        <td className="px-2 py-4 text-center text-gray-400 font-mono">--</td>
                        <td className="px-2 py-4 text-right font-mono text-gray-400 font-mono">--</td>
                        <td className="px-2 py-4 text-center font-mono">{grandTotalData.times}</td>
                    </tr>
                    {expandedDailyCats['GrandTotal'] && renderBreakdown('GrandTotal', monthTxs)}
                </tbody>
            </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-40 px-1 -mt-4" onClick={() => setActivePopupData(null)}>
       <style dangerouslySetInnerHTML={{ __html: `
         .no-scrollbar::-webkit-scrollbar { display: none; }
         .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
         .chart-container-relative-box { position: relative; height: 280px; width: 100%; overflow: visible; }
         .static-y-axis-overlay { position: absolute; top: 0; right: 0; height: 100%; width: 56px; background: white; z-index: 100; pointer-events: none; border-left: 1px dashed #f1f5f9; }
         .scrollable-chart-layer { height: 100%; overflow-x: auto; overflow-y: visible; cursor: grab; }
         @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
         .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
       `}} />

       <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden relative select-none">
            <div className="flex justify-between items-end mb-6 relative z-30">
                <h3 className="font-bold text-lg text-gray-800 tracking-tight">Net Asset</h3>
                <div className="flex bg-gray-100 p-0.5 rounded-lg text-[10px] font-bold">
                    <button onClick={() => setAssetView('wealth')} className={`px-3 py-1 rounded-md transition-all ${assetView === 'wealth' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>Wealth</button>
                    <button onClick={() => setAssetView('investment')} className={`px-3 py-1 rounded-md transition-all ${assetView === 'investment' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>Investments</button>
                </div>
            </div>
            
            <div className="mt-6 mb-8 flex flex-col items-center relative z-20">
                <p className={`text-3xl font-black tracking-tighter ${windowStats.current >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {isBalanceVisible ? `${windowStats.current < 0 ? '-' : ''}$${f1(Math.abs(windowStats.current))}` : '****'}
                </p>
                <div className="flex items-center bg-gray-100/80 p-0.5 rounded-full mt-6 shadow-inner">
                    <button onClick={() => setAssetEndIndex(p => Math.max(ASSET_WINDOW_SIZE, p - 1))} disabled={assetEndIndex <= ASSET_WINDOW_SIZE} className="p-2.5 text-gray-400 disabled:opacity-20 active:scale-90 transition-transform"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="3" stroke="currentColor"/></svg></button>
                    <button onClick={() => setAssetEndIndex(allMonthlyBalances.length)} disabled={assetEndIndex >= allMonthlyBalances.length} className="px-5 py-1.5 text-[9px] font-black text-blue-600 bg-white rounded-full shadow-sm border border-black/5 active:scale-95 transition-all">TODAY</button>
                    <button onClick={() => setAssetEndIndex(p => Math.min(allMonthlyBalances.length, p + 1))} disabled={assetEndIndex >= allMonthlyBalances.length} className="p-2.5 text-gray-400 disabled:opacity-20 active:scale-90 transition-transform"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="3" stroke="currentColor"/></svg></button>
                </div>
            </div>

            <div className="chart-container-relative-box">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={visibleAssetData} margin={{ top: 10, right: 60, left: 10, bottom: 5 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{fontSize: 8, fontWeight: 700, fill: '#cbd5e1'}} tickFormatter={(v) => v.charAt(0)} stroke="none" dy={5} interval={0} />
                        <YAxis hide domain={assetChartDomain} />
                        <Area type="monotone" dataKey={assetView} stroke="#007AFF" strokeWidth={3} fill="#007AFF10" isAnimationActive={false} />
                    </AreaChart>
                </ResponsiveContainer>
                <div className="static-y-axis-overlay"><ResponsiveContainer width="100%" height="100%"><AreaChart data={visibleAssetData} margin={{ top: 10, right: 2, left: 0, bottom: 5 }}><YAxis orientation="right" tick={{fontSize: 8, fontWeight: 700, fill: '#cbd5e1'}} tickFormatter={v => isBalanceVisible ? formatAccounting(v) : '****'} width={52} domain={assetChartDomain} axisLine={false} tickLine={false} /><Area dataKey={assetView} stroke="none" fill="none" isAnimationActive={false}/></AreaChart></ResponsiveContainer></div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-visible select-none">
             <div className="flex justify-between items-end mb-8">
                <div className="flex flex-col"><h3 className="font-bold text-lg text-gray-800 tracking-tight leading-none mb-1">Spending</h3><p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{period === 'W' ? 'WEEKLY' : 'YEARLY'} ANALYSIS</p></div>
                <div className="flex bg-gray-100 p-0.5 rounded-lg text-[10px] font-bold shrink-0">{(['Daily', 'W', 'Y'] as const).map(p => (<button key={p} onClick={() => { setPeriod(p); setDateOffset(0); }} className={`px-3 py-1 rounded-md transition-all ${period === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>{p}</button>))}</div>
            </div>
            
            <div className="w-full">
                {period === 'Daily' ? <DailyTableView /> : (
                 <>
                  <div className="chart-container-relative-box overflow-visible">
                    <div ref={spendingScrollRef} onScroll={handleSpendingScroll} onMouseDown={(e) => onMouseDown(e, spendingScrollRef)} onMouseLeave={onMouseLeave} onMouseUp={onMouseUp} onMouseMove={(e) => onMouseMove(e, spendingScrollRef)} className="scrollable-chart-layer no-scrollbar">
                        <div style={{ width: `${Math.max(100, (spendingChartData.length / (period === 'W' ? 7 : 12)) * 100)}%`, minWidth: '100%', height: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={spendingChartData} margin={{ top: 0, right: 60, left: 5, bottom: 0 }} onMouseDown={(data: any) => { if (data && data.activePayload) setActivePopupData({ active: true, payload: data.activePayload, type: 'spending' }); }}>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} stroke="none" dy={10} interval={0} />
                                    <YAxis hide domain={[0, visibleMax]} />
                                    {[...expenseCategories, "Uncategorized Items"].map(cat => (<Bar key={cat} dataKey={cat} stackId="a" fill={expenseColors[cat] || '#ccc'} isAnimationActive={false} barSize={period === 'W' ? 28 : 20} />))}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="static-y-axis-overlay"><ResponsiveContainer width="100%" height="100%"><BarChart data={spendingChartData} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}><YAxis orientation="right" tick={{fontSize: 8, fontWeight: 700, fill: '#cbd5e1'}} axisLine={false} tickLine={false} width={52} domain={[0, visibleMax]} tickFormatter={(v) => isBalanceVisible ? (v >= 1000 ? `$${f0(v/1000)}k` : `$${f0(v)}`) : '****'} /></BarChart></ResponsiveContainer></div>
                  </div>
                 </>
                )}
            </div>
        </div>
        
        <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-visible select-none">
             <div className="flex justify-between items-start mb-8 relative z-30 bg-white">
                <div className="flex flex-col min-w-0 flex-1">
                    <h3 className="font-bold text-lg text-gray-800 tracking-tight leading-none mb-1">Portfolio Trends</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">YEARLY FLOW</p>
                </div>
                <div className="flex items-center bg-gray-50 px-3 py-1 rounded-full text-xs font-bold text-gray-500 gap-3 border border-gray-100 ml-2 shrink-0">
                    <button onClick={() => setMonthlyFlowYear(y => y - 1)} className="hover:text-blue-500 active:scale-90 transition-transform font-mono">&lt;</button>
                    <span className="w-8 text-center font-mono">{monthlyFlowYear}</span>
                    <button onClick={() => setMonthlyFlowYear(y => y + 1)} className="hover:text-blue-500 active:scale-90 transition-transform font-mono">&gt;</button>
                </div>
            </div>
            <div className="h-64 overflow-visible">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                        data={useMemo(() => {
                            const yearStart = startOfYearFunc(new Date(monthlyFlowYear, 0, 1));
                            const yearEnd = endOfYear(new Date(monthlyFlowYear, 11, 31));
                            const monthlyDataMap = new Map();
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
                        }, [sortedTransactions, monthlyFlowYear])}
                        margin={{ top: 0, right: 5, left: 5, bottom: 0 }}
                        barSize={12}
                    >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 600, fill: '#cbd5e1'}} stroke="none" dy={10} interval={1} />
                        <YAxis orientation="right" tick={{fontSize: 9, fontWeight: 600, fill: '#cbd5e1'}} stroke="none" width={40} dx={-2} tickFormatter={(v) => isBalanceVisible ? `$${f0(v/1000)}k` : '****'} />
                        <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                        <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                        <Bar dataKey="investment" fill="#3b82f6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {activePopupData && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6 pointer-events-auto" onClick={(e) => { e.stopPropagation(); setActivePopupData(null); }}>
            <div className="rounded-[2.5rem] bg-white border p-8 shadow-2xl min-w-[320px] max-w-[95%] animate-fade-in text-center" onClick={e => e.stopPropagation()}>
              <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.4em] mb-3">Analysis Result</p>
              <p className="text-[20px] font-black text-gray-900 mb-6 leading-tight">
                {activePopupData.payload?.[0]?.payload?.rawDate ? format(activePopupData.payload[0].payload.rawDate, 'MMMM do, yyyy') : activePopupData.payload?.[0]?.payload?.name || 'Summary'}
              </p>
              <div className="space-y-4 mb-8">
                {activePopupData.payload.filter((p: any) => (p.value || 0) > 0).slice(0, 5).map((p: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></div>
                            <span className="font-bold text-gray-700">{p.name}</span>
                        </div>
                        <span className="font-mono font-black text-gray-900">{isBalanceVisible ? `$${f1(p.value)}` : '****'}</span>
                    </div>
                ))}
              </div>
              <button onClick={() => setActivePopupData(null)} className="bg-gray-900 text-white py-4 px-8 rounded-full font-black text-[11px] uppercase tracking-[0.4em] w-full transition-transform active:scale-95">Dismiss</button>
            </div>
          </div>
        )}
    </div>
  );
};

export default Statistics;
