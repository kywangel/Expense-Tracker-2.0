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
    subWeeks, startOfWeek as dateFnsStartOfWeek, endOfYear, addMonths
} from 'date-fns';

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

// Improved dynamic domain calculation
const getNiceDomain = (vals: number[]): [number, number] => {
    if (vals.length === 0) return [0, 1000];
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const range = maxVal - minVal || 1000;
    
    // Add 15% buffer to top and bottom to make it "breathable" and truly dynamic
    return [minVal - range * 0.15, maxVal + range * 0.15];
};

const Statistics: React.FC<StatisticsProps> = ({ transactions, expenseCategories, settings, isBalanceVisible, setIsBalanceVisible }) => {
  const [period, setPeriod] = useState<'Daily' | 'W' | 'Y'>('Daily');
  const [assetView, setAssetView] = useState<'wealth' | 'investment'>('wealth');
  const [dateOffset, setDateOffset] = useState(0); 
  const [monthlyFlowYear, setMonthlyFlowYear] = useState(new Date().getFullYear());
  const [expandedDailyCats, setExpandedDailyCats] = useState<Record<string, boolean>>({});
  
  const spendingScrollRef = useRef<HTMLDivElement>(null);

  // Horizontal scroll dragging state
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);

  // Updated signatures to accept HTMLDivElement | null to fix TS2345
  const onMouseDown = (e: React.MouseEvent, ref: React.RefObject<HTMLDivElement | null>, type?: string) => {
    if (!ref.current) return;
    isDragging.current = true;
    startX.current = e.pageX - ref.current.offsetLeft;
    scrollLeftStart.current = ref.current.scrollLeft;
  };

  const onMouseLeave = () => {
    isDragging.current = false;
  };

  const onMouseUp = () => {
    isDragging.current = false;
  };

  const onMouseMove = (e: React.MouseEvent, ref: React.RefObject<HTMLDivElement | null>) => {
    if (!isDragging.current || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX.current) * 2; // scroll-fast factor
    ref.current.scrollLeft = scrollLeftStart.current - walk;
  };

  const [visibleMax, setVisibleMax] = useState(1000);
  const [activePopupData, setActivePopupData] = useState<any>(null);

  const sortedTransactions = useMemo(() => 
    [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
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
            if (tx.type === 'income') {
                runningWealth += Math.abs(tx.amount);
                runningCumIncome += Math.abs(tx.amount);
            }
            if (tx.type === 'expense') {
                runningWealth -= Math.abs(tx.amount);
                runningCumExpense += Math.abs(tx.amount);
            }
            if (tx.type === 'investment') {
                runningInvestment += Math.abs(tx.amount);
            }
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
            if (tx.type === 'income') {
                runningWealth += Math.abs(tx.amount);
                runningCumIncome += Math.abs(tx.amount);
            }
            if (tx.type === 'expense') {
                runningWealth -= Math.abs(tx.amount);
                runningCumExpense += Math.abs(tx.amount);
            }
            if (tx.type === 'investment') {
                runningInvestment += Math.abs(tx.amount);
            }
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

  // Asset Navigation State
  const [assetEndIndex, setAssetEndIndex] = useState(allMonthlyBalances.length);
  const ASSET_WINDOW_SIZE = 12;

  useEffect(() => {
    setAssetEndIndex(allMonthlyBalances.length);
  }, [allMonthlyBalances.length]);

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

  const gradientOffset = useMemo(() => {
    const data = visibleAssetData.map(i => assetView === 'wealth' ? i.wealth : i.investment);
    const max = Math.max(...data, 0);
    const min = Math.min(...data, 0);
    if (max <= 0 && min < 0) return 0;
    if (min >= 0 && max > 0) return 1;
    if (max === min) return 0.5;
    return max / (max - min);
  }, [visibleAssetData, assetView]);

  const spendingChartData = useMemo(() => {
    const today = new Date();
    let interval: { start: Date; end: Date };
    let formatLabel: (date: Date) => string;
    let dataPoints: Date[];

    const firstTxDate = sortedTransactions.length > 0 
        ? startOfMonth(new Date(sortedTransactions[0].date)) 
        : subMonths(today, 36);

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
    const scrollWidth = el.scrollWidth;
    const scrollLeft = el.scrollLeft;
    const visibleCount = period === 'W' ? 7 : 12;
    const barWidth = scrollWidth / spendingChartData.length;
    const startIndex = Math.max(0, Math.floor(scrollLeft / barWidth));
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
    if (spendingScrollRef.current) {
        spendingScrollRef.current.scrollLeft = spendingScrollRef.current.scrollWidth;
    }
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

  /**
   * Daily View Table implementation.
   */
  const DailyTableView = () => {
    const viewDate = startOfDay(addDays(new Date(), dateOffset));
    const yearStr = getYear(viewDate).toString();
    const effectiveBudgets = settings.yearlyBudgets?.[yearStr] || settings.baseCategoryBudgets || {};
    const trackedCats = settings.dailyViewCategories || [];
    const freqTargets = settings.dailyTransactionsPerMonth || {};
    
    const monthTxs = transactions.filter(tx => isSameMonth(new Date(tx.date), viewDate) && tx.type === 'expense');
    const selectedDayTxs = transactions.filter(tx => isSameDay(new Date(tx.date), viewDate) && tx.type === 'expense');
    
    const totalExpenseBudget = expenseCategories.reduce((sum, c) => sum + (effectiveBudgets[c] || 0), 0);
    const trackedBudgetSum = trackedCats.reduce((sum, c) => sum + (effectiveBudgets[c] || 0), 0);
    
    const rows = trackedCats.map(cat => {
        const budget = effectiveBudgets[cat] || 0;
        const freq = freqTargets[cat] || 0;
        const unit = freq > 0 ? budget / freq : 0;
        const daySpent = selectedDayTxs.filter(t => t.category === cat).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const monthSpent = monthTxs.filter(t => t.category === cat).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const monthCount = monthTxs.filter(t => t.category === cat && Math.abs(t.amount) > 0).length;
        
        return { cat, budget, freq, unit, daySpent, leftMonth: budget - monthSpent, times: monthCount };
    });
    
    const untrackedBudget = totalExpenseBudget - trackedBudgetSum;
    const othersDaySpent = selectedDayTxs.filter(t => !trackedCats.includes(t.category)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const othersMonthSpent = monthTxs.filter(t => !trackedCats.includes(t.category)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const othersMonthCount = monthTxs.filter(t => !trackedCats.includes(t.category) && Math.abs(t.amount) > 0).length;
    
    const totalDaySpent = rows.reduce((s, r) => s + r.daySpent, 0) + othersDaySpent;
    const totalLeftMonthVal = rows.reduce((s, r) => s + r.leftMonth, 0) + (untrackedBudget - othersMonthSpent);
    const totalTimesVal = rows.reduce((s, r) => s + r.times, 0) + othersMonthCount;

    const toggleCat = (cat: string) => {
        setExpandedDailyCats(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    const renderBreakdown = (catName: string, items: Transaction[]) => {
        const sorted = [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (sorted.length === 0) {
            return (
                <tr key={`${catName}-empty`} className="bg-blue-50/20 italic animate-fade-in text-gray-400 text-[10px]">
                    <td colSpan={7} className="px-8 py-4 text-center">No transactions recorded for this category this month.</td>
                </tr>
            );
        }

        return (
            <React.Fragment key={`${catName}-breakdown`}>
                <tr className="bg-blue-50/40">
                    <td colSpan={7} className="px-4 py-2 border-t border-blue-200/30">
                        <p className="text-[10px] font-black text-blue-600/60 uppercase tracking-[0.2em] flex items-center gap-2">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                            Monthly Breakdown for {catName}
                        </p>
                    </td>
                </tr>
                {sorted.map(tx => (
                    <tr key={tx.id} className="bg-blue-50/30 text-[10px] animate-fade-in hover:bg-blue-100/40 border-l-4 border-blue-500/30">
                        <td colSpan={4} className="px-6 py-2.5">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    {settings.categoryIcons[tx.category] && (
                                      <span className="shrink-0 w-4 h-4 flex items-center justify-center bg-white/80 rounded-full text-[10px] shadow-sm ring-1 ring-blue-100/30">
                                          {settings.categoryIcons[tx.category]}
                                      </span>
                                    )}
                                    <span className="font-bold text-gray-800 tracking-tight">{tx.category}</span>
                                    <span className="text-[9px] font-black text-blue-500 bg-white/50 px-1.5 rounded-md border border-blue-100/50 uppercase tracking-tighter shadow-sm">
                                        {format(new Date(tx.date), 'EEE, MMM d')}
                                    </span>
                                </div>
                                {tx.note && <span className="text-gray-400 italic text-[9px] truncate max-w-[200px] mt-0.5">{tx.note}</span>}
                            </div>
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono font-black text-blue-600">{isBalanceVisible ? `$${f0(Math.abs(tx.amount))}` : '****'}</td>
                        <td colSpan={2} className="px-2 py-2.5"></td>
                    </tr>
                ))}
            </React.Fragment>
        );
    };

    const spentHeaderLabel = isToday(viewDate) ? 'Today' : format(viewDate, 'MMM d');

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-center gap-4 py-2">
            <button onClick={() => setDateOffset(p => p - 1)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-gray-800">{format(viewDate, 'EEEE, MMM do')}</span>
            </div>
            <button onClick={() => setDateOffset(p => p + 1)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </button>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-xl border border-gray-100 shadow-sm">
            <table className="w-full text-[11px] sm:text-xs text-left border-collapse bg-white">
                <thead>
                    <tr className="bg-gray-50 text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100">
                        <th className="px-3 py-3">Category</th>
                        <th className="px-2 py-3 text-right">Budget</th>
                        <th className="px-2 py-3 text-center">Freq</th>
                        <th className="px-2 py-3 text-right">Unit</th>
                        <th className="px-2 py-3 text-right bg-blue-50/50 text-blue-600">{spentHeaderLabel}</th>
                        <th className="px-2 py-3 text-right">Left</th>
                        <th className="px-2 py-3 text-center">Times</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {rows.map(r => (
                        <React.Fragment key={r.cat}>
                            <tr onClick={() => toggleCat(r.cat)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                                <td className="px-3 py-3 font-semibold text-gray-700 flex items-center gap-1.5">
                                    <svg className={`w-3 h-3 transition-transform text-gray-400 ${expandedDailyCats[r.cat] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                    {getDisplayCategoryName(r.cat)}
                                </td>
                                <td className="px-2 py-3 text-right font-mono text-gray-600">{isBalanceVisible ? `$${f0(r.budget)}` : '****'}</td>
                                <td className="px-2 py-3 text-center font-mono text-gray-400">{r.freq > 0 ? r.freq : '--'}</td>
                                <td className="px-2 py-3 text-right font-mono text-gray-400">{isBalanceVisible ? (r.unit > 0 ? `$${f0(r.unit)}` : '$--') : '****'}</td>
                                <td className={`px-2 py-3 text-right font-mono font-bold bg-blue-50/30 ${r.daySpent > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{isBalanceVisible ? `$${f0(r.daySpent)}` : '****'}</td>
                                <td className={`px-2 py-3 text-right font-mono ${r.leftMonth < 0 ? 'text-red-500' : 'text-green-600'}`}>{isBalanceVisible ? `$${f0(r.leftMonth)}` : '****'}</td>
                                <td className="px-2 py-3 text-center font-mono font-bold text-gray-700">{r.times}</td>
                            </tr>
                            {expandedDailyCats[r.cat] && renderBreakdown(r.cat, monthTxs.filter(tx => tx.category === r.cat))}
                        </React.Fragment>
                    ))}
                    <tr 
                      className="bg-gray-50/50 italic cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => toggleCat('Others')}
                    >
                        <td className="px-3 py-3 font-semibold text-gray-700 flex items-center gap-1.5">
                            <svg className={`w-3 h-3 transition-transform text-gray-400 ${expandedDailyCats['Others'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                            Others
                        </td>
                        <td className="px-2 py-3 text-right font-mono text-gray-600">{isBalanceVisible ? `$${f0(untrackedBudget)}` : '****'}</td>
                        <td className="px-2 py-3 text-center font-mono text-gray-400">--</td>
                        <td className="px-2 py-3 text-right font-mono text-gray-400">$--</td>
                        <td className={`px-2 py-3 text-right font-mono font-bold bg-blue-50/30 ${othersDaySpent > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{isBalanceVisible ? `$${f0(othersDaySpent)}` : '****'}</td>
                        <td className={`px-2 py-3 text-right font-mono ${untrackedBudget - othersMonthSpent < 0 ? 'text-red-500' : 'text-green-600'}`}>{isBalanceVisible ? `$${f0(untrackedBudget - othersMonthSpent)}` : '****'}</td>
                        <td className="px-2 py-3 text-center font-mono font-bold text-gray-700">{othersMonthCount}</td>
                    </tr>
                    {expandedDailyCats['Others'] && renderBreakdown('Others', monthTxs.filter(tx => !trackedCats.includes(tx.category)))}
                    <tr className="bg-blue-50/80 font-black border-t-2 border-blue-100">
                        <td className="px-3 py-3 text-blue-900 uppercase tracking-tighter">Total Spending</td>
                        <td className="px-2 py-3 text-right font-mono text-blue-900/60">{isBalanceVisible ? `$${f0(totalExpenseBudget)}` : '****'}</td>
                        <td className="px-2 py-3 text-center font-mono text-gray-400">--</td>
                        <td className="px-2 py-3 text-right font-mono text-gray-400">$--</td>
                        <td className="px-2 py-3 text-right font-mono text-blue-800 bg-blue-100/60 shadow-inner">{isBalanceVisible ? `$${f0(totalDaySpent)}` : '****'}</td>
                        <td className={`px-2 py-3 text-right font-mono ${totalLeftMonthVal < 0 ? 'text-red-600' : 'text-green-700'}`}>{isBalanceVisible ? `$${f0(totalLeftMonthVal)}` : '****'}</td>
                        <td className="px-2 py-3 text-center font-mono text-blue-900">{totalTimesVal}</td>
                    </tr>
                </tbody>
            </table>
        </div>
      </div>
    );
  };

  const CenteredAnalysisPopup = ({ active, payload, type }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      if (type === 'asset') {
          const displayDate = format(data.date, 'MMMM yyyy');
          
          return (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6 pointer-events-none transition-all animate-fade-in">
              <div className="rounded-[2.5rem] bg-white border border-gray-100 flex flex-col overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] min-w-[320px] max-w-[95%] pointer-events-auto scale-100">
                <div className="px-8 pt-8 pb-5 border-b border-gray-50 bg-gray-50/50">
                  <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.3em] mb-1.5">Asset Summary</p>
                  <p className="text-[20px] font-black text-gray-900 tracking-tight leading-none">{displayDate}</p>
                </div>
                <div className="flex flex-col p-8 space-y-6">
                  {assetView === 'wealth' ? (
                    <>
                        <div className="flex justify-between items-center">
                            <span className="text-[12px] font-black text-gray-400 uppercase tracking-widest">Cumulative Income</span>
                            <span className="text-[16px] font-mono font-black text-green-600">{isBalanceVisible ? `$${f1(data.cumIncome)}` : '****'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[12px] font-black text-gray-400 uppercase tracking-widest">Cumulative Expense</span>
                            <span className="text-[16px] font-mono font-black text-red-500">{isBalanceVisible ? `-$${f1(data.cumExpense)}` : '****'}</span>
                        </div>
                        <div className="pt-6 border-t-2 border-gray-100 flex justify-between items-center">
                            <span className="text-[12px] font-black text-gray-400 uppercase tracking-widest">Net Asset</span>
                            <span className={`text-[22px] font-mono font-black leading-none ${data.wealth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {isBalanceVisible ? `${data.wealth < 0 ? '-' : ''}${f1(Math.abs(data.wealth))}` : '****'}
                            </span>
                        </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center">
                        <span className="text-[12px] font-black text-gray-400 uppercase tracking-widest">Total Investment</span>
                        <span className="text-[22px] font-mono font-black text-blue-600 leading-none">{isBalanceVisible ? `$${f1(data.investment)}` : '****'}</span>
                    </div>
                  )}
                </div>
                <button onClick={() => setActivePopupData(null)} className="bg-gray-900 text-white py-5 font-black text-[11px] uppercase tracking-[0.4em] active:bg-gray-800 transition-colors w-full">Dismiss</button>
              </div>
            </div>
          );
      } else {
          const displayDate = data.rawDate 
            ? (period === 'W' ? format(data.rawDate, 'MMMM do, yyyy') : format(data.rawDate, 'MMMM yyyy')) 
            : data.name;
            
          const validItems = payload.filter((item: any) => item.value !== undefined && item.value > 0);
          const sortedAll = [...validItems].sort((a: any, b: any) => b.value - a.value);
          const top5 = sortedAll.slice(0, 5);
          const othersVal = sortedAll.slice(5).reduce((s, i) => s + i.value, 0);
          const total = sortedAll.reduce((s, i) => s + i.value, 0);
          
          return (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6 pointer-events-none transition-all animate-fade-in">
              <div className="rounded-[2.5rem] bg-white border border-gray-100 flex flex-col overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] min-w-[320px] max-w-[95%] pointer-events-auto scale-100">
                <div className="px-8 pt-8 pb-5 border-b border-gray-50 bg-gray-50/50">
                  <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.3em] mb-1.5">Period Analysis</p>
                  <p className="text-[20px] font-black text-gray-900 tracking-tight leading-none">{displayDate}</p>
                </div>
                <div className="flex flex-col p-8 space-y-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Spending Categories</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</span>
                  </div>
                  {top5.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between gap-8">
                      <div className="flex items-center gap-3 min-w-0">
                          <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.color }} />
                          <span className="text-[14px] font-bold truncate text-gray-700 tracking-tight">{getDisplayCategoryName(item.name)}</span>
                      </div>
                      <span className="text-[14px] font-mono font-black text-gray-900 whitespace-nowrap">{isBalanceVisible ? `$${f1(item.value)}` : '****'}</span>
                    </div>
                  ))}
                  {othersVal > 0 && (
                    <div className="flex items-center justify-between gap-8 pt-1 border-t border-gray-50">
                      <div className="flex items-center gap-3 min-w-0">
                          <div className="w-3 h-3 rounded-full shrink-0 shadow-sm bg-gray-200" />
                          <span className="text-[14px] font-bold truncate text-gray-400 italic">Others</span>
                      </div>
                      <span className="text-[14px] font-mono font-bold text-gray-400 whitespace-nowrap">{isBalanceVisible ? `$${f1(othersVal)}` : '****'}</span>
                    </div>
                  )}
                  {validItems.length === 0 && (
                    <div className="py-10 text-center text-gray-300 font-bold uppercase text-[10px] tracking-widest">No Data Recorded</div>
                  )}
                  <div className="pt-6 border-t-2 border-gray-100 mt-2 flex justify-between items-center">
                      <span className="text-[12px] font-black text-gray-400 uppercase tracking-widest">Total Expenses</span>
                      <span className="text-[22px] font-mono font-black text-blue-600 leading-none">{isBalanceVisible ? `$${f1(total)}` : '****'}</span>
                  </div>
                </div>
                <button onClick={() => setActivePopupData(null)} className="bg-gray-900 text-white py-5 font-black text-[11px] uppercase tracking-[0.4em] active:bg-gray-800 transition-colors w-full">Dismiss</button>
              </div>
            </div>
          );
      }
    }
    return null;
  };

  const flowOverTimeData = useMemo(() => {
    const yearStart = startOfYearFunc(new Date(monthlyFlowYear, 0, 1));
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

  const portfolioDomain = useMemo(() => {
    const vals = flowOverTimeData.flatMap(d => [d.income, d.expense, d.investment]);
    return getNiceDomain(vals);
  }, [flowOverTimeData]);

  const currentViewRangeLabel = useMemo(() => {
    if (spendingChartData.length === 0) return 'No Data Available';
    const first = spendingChartData[0].rawDate;
    const last = spendingChartData[spendingChartData.length-1].rawDate;
    return `${format(first, 'MMM yyyy')} - ${format(last, 'MMM yyyy')}`;
  }, [spendingChartData]);

  return (
    <div className="space-y-4 pb-40 px-1 -mt-4" onClick={() => setActivePopupData(null)}>
       <style dangerouslySetInnerHTML={{ __html: `
         .recharts-wrapper { overflow: visible !important; }
         .recharts-surface { overflow: visible !important; }
         .no-scrollbar::-webkit-scrollbar { display: none; }
         .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
         svg { outline: none !important; }
         .chart-container-relative-box { position: relative; height: 280px; width: 100%; overflow: visible; }
         .static-y-axis-overlay { position: absolute; top: 0; right: 0; height: 100%; width: 56px; background: white; z-index: 100; pointer-events: none; border-left: 1px dashed #f1f5f9; }
         .scrollable-chart-layer { height: 100%; overflow-x: auto; overflow-y: visible; cursor: grab; }
         .scrollable-chart-layer:active { cursor: grabbing; }
         .recharts-clip-layer { clip-path: inset(0 0 0 0); }
         .recharts-tooltip-wrapper { visibility: hidden !important; }
         @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
         .animate-fade-in { animation: fadeIn 0.2s cubic-bezier(0.2, 0, 0, 1) forwards; }
       `}} />

       <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden select-none relative">
            <div className="flex justify-between items-end mb-6 relative z-30 bg-white">
                <h3 className="font-bold text-lg text-gray-800 tracking-tight leading-none mb-1">Net Asset</h3>
                <div className="flex bg-gray-100 p-0.5 rounded-lg text-[10px] font-bold shrink-0 items-center mr-10">
                    <button onClick={() => setAssetView('wealth')} className={`px-3 py-1 rounded-md transition-all ${assetView === 'wealth' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>Wealth</button>
                    <button onClick={() => setAssetView('investment')} className={`px-3 py-1 rounded-md transition-all ${assetView === 'investment' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>Investments</button>
                </div>
            </div>
            
            <button 
              onClick={(e) => { e.stopPropagation(); setIsBalanceVisible(!isBalanceVisible); }}
              className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 rounded-full z-[40]"
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

            <div className="mt-6 mb-8 flex flex-col items-center relative z-20">
                <div className="flex flex-col items-center mb-6">
                    <p className={`text-3xl font-black tracking-tight ${windowStats.current >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {isBalanceVisible ? `${windowStats.current < 0 ? '-' : ''}$${f1(Math.abs(windowStats.current))}` : '****'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[11px] font-bold flex items-center gap-0.5 ${windowStats.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {windowStats.change >= 0 ? '▲' : '▼'}{Math.abs(Math.round(windowStats.percent))}%
                        </span>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{windowStats.range}</p>
                    </div>
                </div>
                
                <div className="flex items-center bg-gray-100/80 p-0.5 rounded-full select-none shadow-inner border border-black/5">
                    <button 
                        onClick={() => setAssetEndIndex(prev => Math.max(ASSET_WINDOW_SIZE, prev - 1))}
                        disabled={assetEndIndex <= ASSET_WINDOW_SIZE}
                        className="p-2.5 text-gray-400 disabled:opacity-20 active:scale-90 transition-transform"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button 
                        onClick={() => setAssetEndIndex(allMonthlyBalances.length)}
                        disabled={assetEndIndex >= allMonthlyBalances.length}
                        className="px-5 py-1.5 text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] bg-white rounded-full shadow-sm border border-black/5 active:scale-95 transition-transform disabled:bg-transparent disabled:shadow-none disabled:text-gray-300"
                    >
                        TODAY
                    </button>
                    <button 
                        onClick={() => setAssetEndIndex(prev => Math.min(allMonthlyBalances.length, prev + 1))}
                        disabled={assetEndIndex >= allMonthlyBalances.length}
                        className="p-2.5 text-gray-400 disabled:opacity-20 active:scale-90 transition-transform"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>

            <div className="chart-container-relative-box">
                <div className="w-full h-full relative pointer-events-auto">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart 
                          data={visibleAssetData} 
                          margin={{ top: 10, right: 60, left: 10, bottom: 5 }} 
                          onMouseDown={(data: any) => { if (data && data.activePayload) setActivePopupData({ active: true, payload: data.activePayload, type: 'asset' }); }}
                        >
                            <defs>
                                <linearGradient id="assetSplitFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset={gradientOffset} stopColor="#10b981" stopOpacity={0.2} />
                                    <stop offset={gradientOffset} stopColor="#ef4444" stopOpacity={0.2} />
                                </linearGradient>
                                <linearGradient id="assetSplitStroke" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset={gradientOffset} stopColor="#10b981" stopOpacity={1} />
                                    <stop offset={gradientOffset} stopColor="#ef4444" stopOpacity={1} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis 
                                dataKey="name" 
                                tick={{fontSize: 8, fontWeight: 700, fill: '#cbd5e1'}} 
                                tickFormatter={(v) => v.charAt(0)} 
                                stroke="none" 
                                dy={5} 
                                interval={0} 
                            />
                            <YAxis hide domain={assetChartDomain} />
                            <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" />
                            <Area 
                                type="monotone" 
                                dataKey={assetView} 
                                stroke="url(#assetSplitStroke)" 
                                strokeWidth={3} 
                                fillOpacity={1} 
                                fill="url(#assetSplitFill)" 
                                isAnimationActive={false} 
                                dot={{ r: 4, fill: '#fff', strokeWidth: 2.5, stroke: '#94a3b8' }} 
                                activeDot={{ r: 7, strokeWidth: 3, stroke: '#fff', fill: '#007AFF' }} 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                    <div className="static-y-axis-overlay">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={visibleAssetData} margin={{ top: 10, right: 2, left: 0, bottom: 5 }}>
                                <YAxis 
                                  orientation="right" 
                                  tick={{fontSize: 8, fontWeight: 700, fill: '#cbd5e1', textAnchor: 'start', dx: 2}} 
                                  tickFormatter={v => isBalanceVisible ? formatAccounting(v) : '****'} 
                                  width={52} 
                                  domain={assetChartDomain} 
                                  axisLine={false} 
                                  tickLine={false}
                                  interval="preserveStartEnd"
                                />
                                <Area dataKey={assetView} stroke="none" fill="none" isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-visible select-none">
             <div className="flex justify-between items-end mb-8 relative z-30 bg-white">
                <div className="flex flex-col min-w-0 flex-1">
                    <h3 className="font-bold text-lg text-gray-800 tracking-tight leading-none mb-1">Spending</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{period === 'W' ? 'WEEKLY' : 'YEARLY'} ANALYSIS</p>
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
                  <div className="flex items-center justify-between mb-8 relative z-20 bg-white px-1">
                    <div className="flex flex-col">
                        <span className="text-xs font-black text-gray-900 tracking-tight">Viewing Analysis</span>
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{currentViewRangeLabel}</span>
                    </div>
                    <button onClick={() => { setDateOffset(0); if(spendingScrollRef.current) spendingScrollRef.current.scrollLeft = spendingScrollRef.current.scrollWidth; }} className="text-xs font-black text-blue-600 px-5 py-2.5 bg-blue-50 rounded-2xl active:scale-95 transition-transform">Today</button>
                  </div>
                  
                  <div className="chart-container-relative-box overflow-visible">
                    <div ref={spendingScrollRef} onScroll={handleSpendingScroll} onMouseDown={(e) => onMouseDown(e, spendingScrollRef, 'spending')} onMouseLeave={onMouseLeave} onMouseUp={onMouseUp} onMouseMove={(e) => onMouseMove(e, spendingScrollRef)} className="scrollable-chart-layer no-scrollbar" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x', overflowX: 'auto', overflowY: 'visible' }}>
                        <div style={{ width: `${Math.max(100, (spendingChartData.length / (period === 'W' ? 7 : 12)) * 100)}%`, minWidth: '100%', height: '100%' }} className="relative block pointer-events-none">
                            <div className="pointer-events-auto w-full h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={spendingChartData} margin={{ top: 0, right: 60, left: 5, bottom: 0 }} barGap={6} onMouseDown={(data: any) => { if (data && data.activePayload) setActivePopupData({ active: true, payload: data.activePayload, type: 'spending' }); }}>
                                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} stroke="none" dy={10} interval={0} />
                                        <YAxis hide domain={[0, visibleMax]} />
                                        <Tooltip content={() => null} cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} />
                                        {[...expenseCategories, "Uncategorized Items"].map(cat => (
                                          <Bar key={cat} dataKey={cat} stackId="a" fill={expenseColors[cat] || '#ccc'} name={cat} isAnimationActive={false} barSize={period === 'W' ? 28 : 20} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                    <div className="static-y-axis-overlay">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={spendingChartData} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                                <YAxis orientation="right" tick={{fontSize: 8, fontWeight: 700, fill: '#cbd5e1', textAnchor: 'start', dx: 2}} axisLine={false} tickLine={false} width={52} domain={[0, visibleMax]} tickFormatter={(v) => isBalanceVisible ? (v >= 1000 ? `$${f0(v/1000)}k` : `$${f0(v)}`) : '****'} />
                                {[...expenseCategories, "Uncategorized Items"].map(cat => <Bar key={cat} dataKey={cat} stackId="a" fill="none" isAnimationActive={false} />)}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                  </div>
                  
                  <div className="mt-8 overflow-x-auto no-scrollbar">
                     <div className="flex flex-wrap gap-2 px-1">
                        {[...expenseCategories, "Uncategorized Items"].map(cat => (
                           <div key={cat} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-full border border-gray-100">
                             <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: expenseColors[cat] }} />
                             <span className="text-[9px] font-bold text-gray-500 whitespace-nowrap">{getDisplayCategoryName(cat)}</span>
                           </div>
                        ))}
                     </div>
                  </div>
                 </>
                 )}
            </div>
        </div>

        {activePopupData && <CenteredAnalysisPopup active={activePopupData.active} payload={activePopupData.payload} type={activePopupData.type} />}

       <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-visible select-none">
          <div className="flex justify-between items-start mb-8 relative z-30 bg-white">
             <div className="flex flex-col min-w-0 flex-1">
                <h3 className="font-bold text-lg text-gray-800 tracking-tight leading-none mb-1">Portfolio Trends</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">MONTHLY FLOW</p>
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
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 600, fill: '#cbd5e1'}} stroke="none" dy={10} interval={1} />
                <YAxis orientation="right" tick={{fontSize: 9, fontWeight: 600, fill: '#cbd5e1'}} stroke="none" width={40} dx={-2} domain={portfolioDomain} tickFormatter={(v) => isBalanceVisible ? `$${f0(v/1000)}k` : '****'} />
                <Bar dataKey="income" fill="#10b981" name="Income" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="expense" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="investment" fill="#3b82f6" name="Investments" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
       </div>
    </div>
  );
};

export default Statistics;