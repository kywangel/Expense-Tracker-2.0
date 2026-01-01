
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, AppSettings } from '../types';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    LineChart, Line, Legend, Area, AreaChart
} from 'recharts';
import { 
    format, endOfWeek, endOfMonth, endOfYear,
    eachDayOfInterval, eachMonthOfInterval, getDay, addMonths, 
    isToday, isSameMonth, addWeeks, addYears, isSameYear, isSameDay,
    startOfDay, addDays, getYear
} from 'date-fns';

const startOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const startOfMonth = (date: Date) => {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
};

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

const generateShades = (hexColor: string, count: number) => {
    const color = hexColor.startsWith('#') ? hexColor.substring(1) : hexColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const shades = [];
    for (let i = 0; i < count; i++) {
        const factor = 1 - (i * 0.1);
        shades.push(`rgba(${r}, ${g}, ${b}, ${Math.max(0.2, factor)})`);
    }
    return shades;
};

const Statistics: React.FC<StatisticsProps> = ({ transactions, expenseCategories, settings }) => {
  const [period, setPeriod] = useState<'W' | 'M' | '6M' | 'Y' | 'Daily'>('M');
  const [assetView, setAssetView] = useState<'wealth' | 'investment'>('wealth');
  const [dateOffset, setDateOffset] = useState(0); 
  const [calendarDate, setCalendarDate] = useState(new Date());

  const [netAssetYear, setNetAssetYear] = useState(new Date().getFullYear());
  const [monthlyFlowYear, setMonthlyFlowYear] = useState(new Date().getFullYear());


  const sortedTransactions = useMemo(() => 
    [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [transactions]
  );
  
  const netAssetData = useMemo(() => {
    const yearStart = startOfYear(new Date(netAssetYear, 0, 1));
    const yearEnd = endOfYear(new Date(netAssetYear, 11, 31));
    const priorTransactions = sortedTransactions.filter(tx => new Date(tx.date) < yearStart);
    let startWealth = priorTransactions.reduce((acc, tx) => {
        if (tx.type === 'income') return acc + Math.abs(tx.amount);
        if (tx.type === 'expense') return acc - Math.abs(tx.amount);
        return acc;
    }, 0);
    let startInvestment = priorTransactions.reduce((acc, tx) => acc + (tx.type === 'investment' ? Math.abs(tx.amount) : 0), 0);
    const yearMonths = eachMonthOfInterval({ start: yearStart, end: yearEnd });
    const monthlyChanges = sortedTransactions
        .filter(tx => { const d = new Date(tx.date); return d >= yearStart && d <= yearEnd; })
        .reduce((acc, tx) => {
            const month = format(new Date(tx.date), 'MMM');
            if (!acc[month]) acc[month] = { wealth: 0, investment: 0 };
            if (tx.type === 'income') acc[month].wealth += Math.abs(tx.amount);
            if (tx.type === 'expense') acc[month].wealth -= Math.abs(tx.amount);
            if (tx.type === 'investment') acc[month].investment += Math.abs(tx.amount);
            return acc;
        }, {} as Record<string, { wealth: number, investment: number }>);

    const wealthData: { name: string; balance: number }[] = [];
    const investmentData: { name: string; balance: number }[] = [];
    yearMonths.forEach(monthDate => {
        const monthName = format(monthDate, 'MMM');
        startWealth += (monthlyChanges[monthName]?.wealth || 0);
        startInvestment += (monthlyChanges[monthName]?.investment || 0);
        wealthData.push({ name: monthName, balance: startWealth });
        investmentData.push({ name: monthName, balance: startInvestment });
    });
    return { wealthData, investmentData };
  }, [sortedTransactions, netAssetYear]);
  
  const gradientOffset = useMemo(() => {
    const data = assetView === 'wealth' ? netAssetData.wealthData : netAssetData.investmentData;
    if (!data || data.length === 0) return 0;
    const max = Math.max(...data.map(i => i.balance));
    const min = Math.min(...data.map(i => i.balance));
    if (max <= 0) return 0;
    if (min >= 0) return 1;
    return max / (max - min);
  }, [assetView, netAssetData]);

  const spendingChartData = useMemo(() => {
    const baseDate = new Date();
    let interval: { start: Date; end: Date };
    let formatLabel: (date: Date) => string;
    let dataPoints: Date[];

    switch (period) {
      case 'W':
        const weekDate = addWeeks(baseDate, dateOffset);
        interval = { start: startOfWeek(weekDate), end: endOfWeek(weekDate) };
        dataPoints = eachDayOfInterval(interval);
        formatLabel = (date) => format(date, 'EEE');
        break;
      case '6M':
        const sixMonthsDate = addMonths(baseDate, dateOffset * 6);
        interval = { start: startOfMonth(addMonths(sixMonthsDate, -5)), end: endOfMonth(sixMonthsDate) };
        dataPoints = eachMonthOfInterval(interval);
        formatLabel = (date) => format(date, 'MMM');
        break;
      case 'Y':
        const yearDate = addYears(baseDate, dateOffset);
        interval = { start: startOfYear(yearDate), end: endOfYear(yearDate) };
        dataPoints = eachMonthOfInterval(interval);
        formatLabel = (date) => format(date, 'MMM');
        break;
      default: return [];
    }
    
    const relevantTxs = sortedTransactions.filter(tx => {
        const txDate = new Date(tx.date);
        return !isNaN(txDate.getTime()) && txDate >= interval.start && txDate <= interval.end && tx.type === 'expense';
    });

    const dataMap = new Map<string, any>();
    dataPoints.forEach(point => dataMap.set(formatLabel(point), { name: formatLabel(point) }));

    relevantTxs.forEach(tx => {
        const key = formatLabel(new Date(tx.date));
        const entry = dataMap.get(key);
        if (entry) {
            entry[tx.category] = (entry[tx.category] || 0) + Math.abs(tx.amount);
            entry.total = (entry.total || 0) + Math.abs(tx.amount);
        }
    });
    return Array.from(dataMap.values());
  }, [sortedTransactions, period, dateOffset]);

  const expenseColors = useMemo(() => {
    const colorMap: Record<string, string> = {};
    const colors = generateShades('#EF4444', expenseCategories.length);
    expenseCategories.forEach((cat, i) => colorMap[cat] = colors[i]);
    return colorMap;
  }, [expenseCategories]);

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

  const DailyTableView = () => {
    const viewDate = startOfDay(addDays(new Date(), dateOffset));
    const yearStr = getYear(viewDate).toString();
    
    // SYNC FIX: Merge base budgets with yearly overrides for the current viewing year
    const effectiveBudgets = useMemo(() => {
        return { 
            ...(settings.baseCategoryBudgets || {}), 
            ...(settings.yearlyBudgets?.[yearStr] || {}) 
        };
    }, [settings.baseCategoryBudgets, settings.yearlyBudgets, yearStr]);

    const trackedCats = settings.dailyViewCategories || [];
    const targetFreqs = settings.dailyTransactionsPerMonth || {};
    const monthStart = startOfMonth(viewDate);

    // Transactions relative to the viewed day
    const monthTxs = transactions.filter(tx => {
        const d = new Date(tx.date);
        return isSameMonth(d, viewDate) && tx.type === 'expense';
    });
    const selectedDayTxs = transactions.filter(tx => isSameDay(new Date(tx.date), viewDate) && tx.type === 'expense');

    const totalExpenseBudget = expenseCategories.reduce((sum, c) => sum + (effectiveBudgets[c] || 0), 0);
    const trackedBudgetSum = trackedCats.reduce((sum, c) => sum + (effectiveBudgets[c] || 0), 0);

    const rows = trackedCats.map(cat => {
        const budget = effectiveBudgets[cat] || 0;
        const freq = targetFreqs[cat] || 0;
        const unitCost = freq > 0 ? budget / freq : 0;
        const daySpent = selectedDayTxs.filter(t => t.category === cat).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const monthSpent = monthTxs.filter(t => t.category === cat).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const monthCount = monthTxs.filter(t => t.category === cat).length;
        const leftMonth = budget - monthSpent;

        return { cat, budget, freq, unitCost, daySpent, leftMonth, monthCount };
    });

    const untrackedBudget = totalExpenseBudget - trackedBudgetSum;
    const othersDaySpent = selectedDayTxs.filter(t => !trackedCats.includes(t.category)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const othersMonthSpent = monthTxs.filter(t => !trackedCats.includes(t.category)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const othersMonthCount = monthTxs.filter(t => !trackedCats.includes(t.category)).length;

    rows.push({
        cat: 'Others',
        budget: untrackedBudget,
        freq: 0,
        unitCost: 0,
        daySpent: othersDaySpent,
        leftMonth: untrackedBudget - othersMonthSpent,
        monthCount: othersMonthCount
    });

    const spentHeaderLabel = isToday(viewDate) ? 'Today' : format(viewDate, 'MMM d');

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Daily Navigation Controls */}
            <div className="flex items-center justify-center gap-4 py-2">
                <button onClick={() => setDateOffset(p => p - 1)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-sm font-bold text-gray-800">{format(viewDate, 'EEEE, MMM do')}</span>
                    {dateOffset !== 0 && (
                        <button onClick={() => setDateOffset(0)} className="text-[10px] font-bold text-blue-600 uppercase tracking-tight hover:underline">Back to Today</button>
                    )}
                </div>
                <button onClick={() => setDateOffset(p => p + 1)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
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
                            <tr key={r.cat} className={r.cat === 'Others' ? 'bg-gray-50/50 italic' : ''}>
                                <td className="px-3 py-3 font-semibold text-gray-700">{r.cat}</td>
                                <td className="px-2 py-3 text-right font-mono text-gray-600">${r.budget.toLocaleString()}</td>
                                <td className="px-2 py-3 text-center font-mono text-gray-400">{r.freq || '--'}</td>
                                <td className="px-2 py-3 text-right font-mono text-gray-400">${r.unitCost > 0 ? r.unitCost.toFixed(0) : '--'}</td>
                                <td className={`px-2 py-3 text-right font-mono font-bold ${r.daySpent > 0 ? 'text-blue-600 bg-blue-50/50' : 'text-gray-300 bg-blue-50/30'}`}>${r.daySpent.toLocaleString()}</td>
                                <td className={`px-2 py-3 text-right font-mono ${r.leftMonth < 0 ? 'text-red-500 font-bold' : 'text-green-600'}`}>${r.leftMonth.toLocaleString()}</td>
                                <td className="px-2 py-3 text-center font-mono font-bold text-gray-700">{r.monthCount}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };

  const CalendarView = ({ baseDate, setBaseDate }: {baseDate: Date, setBaseDate: (d:Date)=>void}) => {
    const start = startOfMonth(baseDate);
    const daysInMonth = eachDayOfInterval({ start, end: endOfMonth(baseDate) });
    const startingDayIndex = getDay(start) === 0 ? 6 : getDay(start) - 1;
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    useEffect(() => {
        if (!isSameMonth(selectedDate, baseDate)) {
             setSelectedDate(isSameMonth(new Date(), baseDate) ? new Date() : startOfMonth(baseDate));
        }
    }, [baseDate]);

    const dailyTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        transactions.filter(tx => isSameMonth(new Date(tx.date), baseDate) && tx.type === 'expense')
            .forEach(tx => {
                const day = format(new Date(tx.date), 'd');
                totals[day] = (totals[day] || 0) + Math.abs(tx.amount);
            });
        return totals;
    }, [transactions, baseDate]);
    
    const monthBudgets: Record<string, number> = settings.baseCategoryBudgets || {};
    const totalMonthBudget = expenseCategories.reduce((sum, cat) => sum + (monthBudgets[cat] || 0), 0);
    const dailyAverageBudget = totalMonthBudget > 0 ? totalMonthBudget / daysInMonth.length : 100;
    const selectedDayTotal = dailyTotals[format(selectedDate, 'd')] || 0;
    
    const renderDonut = (percent: number, isActive: boolean) => {
        const radius = 16;
        const circumference = 2 * Math.PI * radius;
        const dashValue = Math.min(percent, 100) * (circumference / 100);
        const strokeColor = isActive ? "#ffffff" : "#EF4444"; 
        return (
            <svg viewBox="0 0 36 36" className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={isActive ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"} strokeWidth="3" />
                 {percent > 0 && <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={strokeColor} strokeWidth="3" strokeDasharray={`${dashValue}, ${circumference}`} strokeLinecap="round" />}
            </svg>
        );
    };

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-4 px-2">
                 <button onClick={() => setBaseDate(addMonths(baseDate, -1))} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">&lt;</button>
                 <span className="font-bold text-gray-800">{format(baseDate, 'MMMM yyyy')}</span>
                 <button onClick={() => setBaseDate(addMonths(baseDate, 1))} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-400 font-bold mb-2 uppercase tracking-wider">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day,i) => <div key={i}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-y-2 gap-x-1">
                {Array.from({ length: startingDayIndex }).map((_, i) => <div key={`e-${i}`} />)}
                {daysInMonth.map(day => {
                    const dayKey = format(day, 'd');
                    const total = dailyTotals[dayKey] || 0;
                    const isSelected = isSameDay(day, selectedDate);
                    const percent = (total / dailyAverageBudget) * 100;
                    return (
                        <button key={day.toString()} onClick={() => setSelectedDate(day)} className={`rounded-xl h-12 w-full flex items-center justify-center relative transition-all duration-200 ${isSelected ? 'bg-gray-900 text-white shadow-md scale-105 z-10' : 'hover:bg-gray-50 text-gray-700'}`}>
                            <div className="absolute inset-1">{renderDonut(percent, isSelected)}</div>
                            <span className={`text-sm z-10 relative ${isToday(day) && !isSelected ? 'text-blue-600 font-bold' : 'font-medium'}`}>{dayKey}</span>
                        </button>
                    );
                })}
            </div>
            <div className="mt-6 bg-gray-50 rounded-xl p-4 flex items-center justify-between border border-gray-100 transition-all">
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase">{format(selectedDate, 'EEEE, MMMM do')}</p>
                    <p className="text-sm text-gray-600 font-medium mt-0.5">{selectedDayTotal > 0 ? 'Total Spending' : 'No expenses recorded'}</p>
                </div>
                <div className="text-right"><span className={`text-xl font-bold font-mono ${selectedDayTotal > 0 ? 'text-gray-900' : 'text-gray-300'}`}>${selectedDayTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
            </div>
        </div>
    );
  };
  
  return (
    <div className="space-y-6 pb-24">
       <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-gray-500 text-sm leading-tight">Net Asset<br/>Change</h3>
                <div className="flex items-center justify-end gap-x-4 gap-y-2 flex-wrap max-w-xs sm:max-w-md">
                   <div className="flex items-center gap-1 text-sm">
                     <button onClick={() => setNetAssetYear(y => y - 1)} className="p-1 rounded-full hover:bg-gray-100 text-gray-500">&lt;</button>
                     <span className="font-bold text-gray-600 w-10 text-center">{netAssetYear}</span>
                     <button onClick={() => setNetAssetYear(y => y + 1)} className="p-1 rounded-full hover:bg-gray-100 text-gray-500">&gt;</button>
                   </div>
                 <div className="flex bg-gray-100 p-1 rounded-lg text-xs">
                    {(['wealth', 'investment'] as const).map(p => (
                        <button key={p} onClick={() => setAssetView(p)} className={`px-3 py-1.5 font-bold rounded-md transition-all capitalize text-sm ${assetView === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                            {p === 'wealth' ? 'Wealth' : 'Investments'}
                        </button>
                    ))}
                </div>
                </div>
            </div>
            <div className="h-64 -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={assetView === 'wealth' ? netAssetData.wealthData : netAssetData.investmentData}>
                        <defs>
                            <linearGradient id="colorWealthSplit" x1="0" y1="0" x2="0" y2="1">
                                <stop offset={gradientOffset} stopColor="#10b981" stopOpacity={1} />
                                <stop offset={gradientOffset} stopColor="#EF4444" stopOpacity={1} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="name" tick={{fontSize: 12}} stroke="#9ca3af" axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 12}} stroke="#9ca3af" tickFormatter={(v) => `$${Number(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={40}/>
                        <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                        <Area type="monotone" dataKey="balance" stroke={assetView === 'wealth' ? "url(#colorWealthSplit)" : "#3B82F6"} strokeWidth={2.5} fillOpacity={0.4} fill={assetView === 'wealth' ? "url(#colorWealthSplit)" : "#3B82F6"} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
             <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-gray-500 text-sm leading-tight">Spending<br/>Analysis</h3>
                <div className="flex items-center justify-end gap-x-2 gap-y-2 flex-wrap">
                    <div className="flex bg-gray-100 p-1 rounded-lg text-[10px] sm:text-xs">
                        {(['W', 'M', '6M', 'Y', 'Daily'] as const).map(p => (
                            <button key={p} onClick={() => { setPeriod(p); setDateOffset(0); }} className={`px-2 py-1.5 font-bold rounded-md transition-colors ${period === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="w-full">
                {period === 'Daily' ? <DailyTableView /> : (
                 period === 'M' ? <CalendarView baseDate={calendarDate} setBaseDate={setCalendarDate} /> : (
                 <>
                  <div className="flex items-center justify-center gap-4 my-2">
                    <button onClick={() => setDateOffset(p => p - 1)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">&lt;</button>
                    <span className="text-sm font-bold text-gray-600">
                        {period === 'W' ? `${format(startOfWeek(addWeeks(new Date(), dateOffset)), 'd MMM')} - ${format(endOfWeek(addWeeks(new Date(), dateOffset)), 'd MMM')}` :
                         period === '6M' ? `${format(startOfMonth(addMonths(addMonths(new Date(), dateOffset * 6), -5)), 'MMM yyyy')} - ${format(endOfMonth(addMonths(new Date(), dateOffset * 6)), 'MMM yyyy')}` :
                         format(addYears(new Date(), dateOffset), 'yyyy')}
                    </span>
                    <button onClick={() => setDateOffset(p => p + 1)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">&gt;</button>
                  </div>
                  <div className="h-80 -ml-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={spendingChartData}>
                            <XAxis dataKey="name" tick={{fontSize: 12}} stroke="#9ca3af" axisLine={false} tickLine={false} />
                            <YAxis tick={{fontSize: 12}} stroke="#9ca3af" axisLine={false} tickLine={false} width={40} />
                            <Tooltip cursor={{fill: 'rgba(243, 244, 246, 0.7)'}} />
                            {expenseCategories.map(cat => <Bar key={cat} dataKey={cat} stackId="a" fill={expenseColors[cat] || '#ccc'} name={cat} />)}
                        </BarChart>
                    </ResponsiveContainer>
                 </div>
                 </>
                 ))}
            </div>
        </div>

       <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
             <h3 className="font-semibold text-gray-500 text-sm leading-tight">Monthly<br/>Flow</h3>
            <div className="flex items-center gap-1 text-sm">
                 <button onClick={() => setMonthlyFlowYear(y => y - 1)} className="p-1 rounded-full hover:bg-gray-100 text-gray-500">&lt;</button>
                 <span className="font-bold text-gray-600 w-10 text-center">{monthlyFlowYear}</span>
                 <button onClick={() => setMonthlyFlowYear(y => y + 1)} className="p-1 rounded-full hover:bg-gray-100 text-gray-500">&gt;</button>
            </div>
          </div>
          <div className="h-64 -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flowOverTimeData}>
                <XAxis dataKey="name" tick={{fontSize: 12}} stroke="#9ca3af" axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 12}} stroke="#9ca3af" axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}}/>
                <Bar dataKey="income" fill="#10B981" name="Income" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#EF4444" name="Expenses" radius={[4, 4, 0, 0]} />
                <Bar dataKey="investment" fill="#3B82F6" name="Investments" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
       </div>
    </div>
  );
};

export default Statistics;
