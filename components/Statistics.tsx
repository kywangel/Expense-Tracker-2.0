
import React, { useState, useMemo } from 'react';
import { Transaction, AppSettings } from '../types';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    Legend, Area, AreaChart
} from 'recharts';
import { 
    format, endOfWeek, endOfYear,
    eachDayOfInterval, eachMonthOfInterval, 
    isToday, isSameMonth, addWeeks, addYears, isSameDay,
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

const Statistics: React.FC<StatisticsProps> = ({ transactions, expenseCategories, settings }) => {
  const [period, setPeriod] = useState<'Daily' | 'W' | 'Y'>('Daily');
  const [assetView, setAssetView] = useState<'wealth' | 'investment'>('wealth');
  const [dateOffset, setDateOffset] = useState(0); 

  const [netAssetYear, setNetAssetYear] = useState(new Date().getFullYear());
  const [monthlyFlowYear, setMonthlyFlowYear] = useState(new Date().getFullYear());

  const sortedTransactions = useMemo(() => 
    [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [transactions]
  );

  const getDisplayCategoryName = (name: string) => {
    const icon = settings.categoryIcons[name];
    return icon ? `${icon} ${name}` : name;
  };

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
    expenseCategories.forEach((cat, i) => {
        colorMap[cat] = IOS_COLORS[i % IOS_COLORS.length];
    });
    return colorMap;
  }, [expenseCategories]);

  // ABSOLUTELY OPAQUE CUSTOM TOOLTIP
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const validItems = payload.filter((item: any) => item.value > 0);
      if (validItems.length === 0) return null;

      // Sort items by value for better readability
      const sortedItems = [...validItems].sort((a: any, b: any) => b.value - a.value);

      return (
        <div 
          className="rounded-2xl border border-gray-100 flex flex-col gap-2 min-w-[220px]"
          style={{ 
            backgroundColor: '#FFFFFF', // Solid pure white
            opacity: 1, 
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0,0,0,0.1)',
            padding: '16px',
            zIndex: 9999999, // Massive z-index
            pointerEvents: 'none',
            position: 'relative',
            mixBlendMode: 'normal',
          }}
        >
          <p className="text-sm font-black text-gray-900 border-b border-gray-100 pb-2 mb-2">{label}</p>
          <div className="flex flex-col gap-2">
            {sortedItems.map((item: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <span className="text-[11px] font-bold truncate pr-2" style={{ color: item.color }}>
                  {getDisplayCategoryName(item.name)}
                </span>
                <span className="text-[11px] font-mono font-black text-gray-900">
                  ${item.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const TidyLegend = (props: any) => {
    const { payload } = props;
    if (!payload || payload.length === 0) return null;

    return (
      <div className="mt-8 px-2 relative z-0">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-y-3 gap-x-2">
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-start gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-[10px] leading-tight font-bold text-gray-500 truncate" title={entry.value}>
                {getDisplayCategoryName(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const DailyTableView = () => {
    const viewDate = startOfDay(addDays(new Date(), dateOffset));
    const yearStr = getYear(viewDate).toString();
    const effectiveBudgets = settings.yearlyBudgets?.[yearStr] || settings.baseCategoryBudgets || {};
    const trackedCats = settings.dailyViewCategories || [];
    const targetFreqs = settings.dailyTransactionsPerMonth || {};

    const monthTxs = transactions.filter(tx => isSameMonth(new Date(tx.date), viewDate) && tx.type === 'expense');
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
        return { cat, budget, freq, unitCost, daySpent, leftMonth: budget - monthSpent, monthCount };
    });

    const untrackedBudget = totalExpenseBudget - trackedBudgetSum;
    const othersDaySpent = selectedDayTxs.filter(t => !trackedCats.includes(t.category)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const othersMonthSpent = monthTxs.filter(t => !trackedCats.includes(t.category)).reduce((sum, t) => sum + Math.abs(t.amount), 0);

    rows.push({
        cat: 'Others', budget: untrackedBudget, freq: 0, unitCost: 0, daySpent: othersDaySpent,
        leftMonth: untrackedBudget - othersMonthSpent, monthCount: monthTxs.filter(t => !trackedCats.includes(t.category)).length
    });

    const spentHeaderLabel = isToday(viewDate) ? 'Today' : format(viewDate, 'MMM d');

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-center gap-4 py-2">
                <button onClick={() => setDateOffset(p => p - 1)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-sm font-bold text-gray-800">{format(viewDate, 'EEEE, MMM do')}</span>
                    {dateOffset !== 0 && <button onClick={() => setDateOffset(0)} className="text-[10px] font-bold text-blue-600 uppercase tracking-tight hover:underline">Back to Today</button>}
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
                                <td className="px-3 py-3 font-semibold text-gray-700">{getDisplayCategoryName(r.cat)}</td>
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

  return (
    <div className="space-y-6 pb-24">
       {/* FORCE OPAQUE TOOLTIP CSS INJECTION */}
       <style dangerouslySetInnerHTML={{ __html: `
         .recharts-tooltip-wrapper {
           opacity: 1 !important;
           z-index: 10000000 !important;
           visibility: visible !important;
           pointer-events: none !important;
           mix-blend-mode: normal !important;
         }
         .recharts-legend-wrapper {
           z-index: 1 !important;
           pointer-events: auto !important;
         }
       `}} />

       <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-gray-500 text-sm leading-tight">Net Asset<br/>Change</h3>
                <div className="flex items-center justify-end gap-x-4 gap-y-2 flex-wrap max-w-xs sm:max-w-md">
                   <div className="flex items-center gap-1 text-sm">
                     <button onClick={() => setNetAssetYear(y => y - 1)} className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">&lt;</button>
                     <span className="font-bold text-gray-600 w-10 text-center">{netAssetYear}</span>
                     <button onClick={() => setNetAssetYear(y => y + 1)} className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">&gt;</button>
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
                                <stop offset={gradientOffset} stopColor="#FF3B30" stopOpacity={1} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="name" tick={{fontSize: 12}} stroke="#9ca3af" axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 12}} stroke="#9ca3af" tickFormatter={(v) => `$${Number(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={40}/>
                        <Tooltip 
                            formatter={(v: number) => `$${v.toLocaleString()}`} 
                            isAnimationActive={false}
                            contentStyle={{ borderRadius: '12px', opacity: 1, backgroundColor: '#ffffff', zIndex: 99999 }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="balance" 
                          stroke={assetView === 'wealth' ? "url(#colorWealthSplit)" : "#007AFF"} 
                          strokeWidth={2.5} 
                          fillOpacity={0.4} 
                          fill={assetView === 'wealth' ? "url(#colorWealthSplit)" : "#007AFF"} 
                          isAnimationActive={false} 
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 overflow-visible">
             <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-gray-500 text-sm leading-tight">Spending<br/>Analysis</h3>
                <div className="flex items-center justify-end gap-x-2 gap-y-2 flex-wrap">
                    <div className="flex bg-gray-100 p-1 rounded-lg text-[10px] sm:text-xs">
                        {(['Daily', 'W', 'Y'] as const).map(p => (
                            <button key={p} onClick={() => { setPeriod(p); setDateOffset(0); }} className={`px-3 py-1.5 font-bold rounded-md transition-colors ${period === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="w-full">
                {period === 'Daily' ? <DailyTableView /> : (
                 <>
                  <div className="flex items-center justify-center gap-4 my-2">
                    <button onClick={() => setDateOffset(p => p - 1)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">&lt;</button>
                    <span className="text-sm font-bold text-gray-600">
                        {period === 'W' ? `${format(startOfWeek(addWeeks(new Date(), dateOffset)), 'd MMM')} - ${format(endOfWeek(addWeeks(new Date(), dateOffset)), 'd MMM')}` : format(addYears(new Date(), dateOffset), 'yyyy')}
                    </span>
                    <button onClick={() => setDateOffset(p => p + 1)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">&gt;</button>
                  </div>
                  <div className="h-auto relative">
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart 
                          key={`chart-${period}`} 
                          data={spendingChartData} 
                          margin={{ top: 20, right: 10, left: -10, bottom: 0 }}
                          isAnimationActive={false}
                        >
                            <XAxis dataKey="name" tick={{fontSize: 11, fontWeight: 'bold'}} stroke="#9ca3af" axisLine={false} tickLine={false} />
                            <YAxis tick={{fontSize: 10}} stroke="#9ca3af" axisLine={false} tickLine={false} width={45} tickFormatter={(v) => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} />
                            <Tooltip 
                                content={<CustomTooltip />} 
                                cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }} 
                                isAnimationActive={false} 
                                wrapperStyle={{ zIndex: 10000000, opacity: 1, pointerEvents: 'none' }}
                                allowEscapeViewBox={{ x: true, y: true }}
                            />
                            <Legend content={<TidyLegend />} />
                            {expenseCategories.map(cat => (
                                <Bar 
                                    key={cat} 
                                    dataKey={cat} 
                                    stackId="a" 
                                    fill={expenseColors[cat] || '#ccc'} 
                                    name={cat} 
                                    isAnimationActive={false} 
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                 </div>
                 </>
                 )}
            </div>
        </div>

       <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
             <h3 className="font-semibold text-gray-500 text-sm leading-tight">Monthly<br/>Flow</h3>
            <div className="flex items-center gap-1 text-sm">
                 <button onClick={() => setMonthlyFlowYear(y => y - 1)} className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">&lt;</button>
                 <span className="font-bold text-gray-600 w-10 text-center">{monthlyFlowYear}</span>
                 <button onClick={() => setMonthlyFlowYear(y => y + 1)} className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">&gt;</button>
            </div>
          </div>
          <div className="h-64 -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flowOverTimeData}>
                <XAxis dataKey="name" tick={{fontSize: 12}} stroke="#9ca3af" axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 12}} stroke="#9ca3af" axisLine={false} tickLine={false} width={40} />
                <Tooltip 
                  isAnimationActive={false}
                  formatter={(v: number) => `$${v.toLocaleString()}`} 
                  contentStyle={{ 
                    borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', 
                    backgroundColor: '#ffffff', opacity: 1, zIndex: 9999
                  }} 
                />
                <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}}/>
                <Bar dataKey="income" fill="#34C759" name="Income" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="expense" fill="#FF3B30" name="Expenses" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="investment" fill="#007AFF" name="Investments" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
       </div>
    </div>
  );
};

export default Statistics;
