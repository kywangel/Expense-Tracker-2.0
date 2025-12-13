
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, AppSettings } from '../types';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    LineChart, Line, Legend, Area, AreaChart
} from 'recharts';
import { 
    format, endOfWeek, endOfMonth, endOfYear,
    eachDayOfInterval, eachMonthOfInterval, getDay, addMonths, 
    isToday, isSameMonth, addWeeks, addYears, isSameYear, isSameDay
} from 'date-fns';

// Local implementations to bypass missing date-fns exports
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
  const [period, setPeriod] = useState<'W' | 'M' | '6M' | 'Y'>('M');
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

    // STRICT LOGIC: Net Asset = Income (positive) - Expenses (negative or absolute subtraction).
    // Investments are handled separately in the 'investment' view.

    const priorTransactions = sortedTransactions.filter(tx => new Date(tx.date) < yearStart);
    
    // Calculate initial wealth (Income - Expenses)
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
            if (tx.type === 'expense') acc[month].wealth -= Math.abs(tx.amount); // Subtract expense
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
  
  // Calculate gradient offset for split coloring (Green > 0, Red < 0)
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
    let interval;
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
        // Using addMonths(..., -5) instead of subMonths
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
        if (!tx || !tx.date) return false;
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


  const CustomTooltip = ({ active, payload, label, expenseCategories }: any) => {
    if (active && payload && payload.length) {
      const topFive = expenseCategories
        .map((cat: string) => ({ name: cat, value: payload[0].payload[cat] || 0 }))
        .filter((p: any) => p.value > 0)
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 5);

      return (
        <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-gray-200">
          <p className="font-bold text-gray-800 mb-2">{label}</p>
          <p className="text-sm text-gray-600 font-semibold mb-3">Total Expenses: <span className="font-mono">${(payload[0].payload.total || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span></p>
          <div className="space-y-1 text-sm">
            {topFive.map((p: any) => (
              <div key={p.name} className="flex justify-between items-center gap-4">
                <span className="text-gray-600 truncate max-w-[120px]">{p.name}</span>
                <span className="font-mono font-semibold text-gray-800">${p.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };
  
  const CalendarView = ({ baseDate, setBaseDate }: {baseDate: Date, setBaseDate: (d:Date)=>void}) => {
    const start = startOfMonth(baseDate);
    const daysInMonth = eachDayOfInterval({ start, end: endOfMonth(baseDate) });
    const startingDayIndex = getDay(start) === 0 ? 6 : getDay(start) - 1;
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    
    // Ensure selectedDate is within the current view month if possible, or default to first day
    useEffect(() => {
        if (!isSameMonth(selectedDate, baseDate)) {
             if (isSameMonth(new Date(), baseDate)) {
                 setSelectedDate(new Date());
             } else {
                 setSelectedDate(startOfMonth(baseDate));
             }
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
    
    // Budget Calculations for Donut Chart
    const monthKey = format(baseDate, 'yyyy-MM');
    const monthBudgets: Record<string, number> = settings.monthlyCategoryBudgets[monthKey] || {};
    const totalMonthBudget = Object.values(monthBudgets).reduce((sum: number, val: number) => sum + val, 0);
    const dailyAverageBudget = totalMonthBudget > 0 ? totalMonthBudget / daysInMonth.length : 100; // Default to 100 to avoid div by zero if no budget

    const selectedDayTotal = dailyTotals[format(selectedDate, 'd')] || 0;
    
    const renderDonut = (percent: number, isActive: boolean) => {
        const radius = 16;
        const circumference = 2 * Math.PI * radius; // approx 100
        // Limit dasharray to max full circle
        const dashValue = Math.min(percent, 100) * (circumference / 100);
        
        // Colors: Red for expenses
        const strokeColor = isActive ? "#ffffff" : "#EF4444"; 
        const bgStrokeColor = isActive ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)";

        return (
            <svg viewBox="0 0 36 36" className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none">
                {/* Background Ring */}
                <path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={bgStrokeColor}
                    strokeWidth="3" // Thicker ring
                />
                {/* Foreground Ring */}
                 {percent > 0 && (
                    <path
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="3"
                        strokeDasharray={`${dashValue}, ${circumference}`}
                        strokeLinecap="round"
                    />
                 )}
            </svg>
        );
    };

    return (
        <div className="animate-fade-in">
            {/* Calendar Navigation Arrows */}
            <div className="flex justify-between items-center mb-4 px-2">
                 <button onClick={() => setBaseDate(addMonths(baseDate, -1))} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                 </button>
                 <span className="font-bold text-gray-800">{format(baseDate, 'MMMM yyyy')}</span>
                 <button onClick={() => setBaseDate(addMonths(baseDate, 1))} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                 </button>
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
                    const isTodayDate = isToday(day);
                    
                    // Donut Calc
                    const percent = (total / dailyAverageBudget) * 100;

                    return (
                        <button 
                            key={day.toString()} 
                            onClick={() => setSelectedDate(day)}
                            className={`rounded-xl h-12 w-full flex items-center justify-center relative transition-all duration-200 ${isSelected ? 'bg-gray-900 text-white shadow-md scale-105 z-10' : 'hover:bg-gray-50 text-gray-700'}`}
                        >
                            {/* Donut Chart Background */}
                            <div className="absolute inset-1">
                                {renderDonut(percent, isSelected)}
                            </div>

                            <span className={`text-sm z-10 relative ${isTodayDate && !isSelected ? 'text-blue-600 font-bold' : 'font-medium'}`}>{dayKey}</span>
                        </button>
                    );
                })}
            </div>
            
            {/* Selected Date Summary */}
            <div className="mt-6 bg-gray-50 rounded-xl p-4 flex items-center justify-between border border-gray-100 transition-all">
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase">{format(selectedDate, 'EEEE, MMMM do')}</p>
                    <p className="text-sm text-gray-600 font-medium mt-0.5">{selectedDayTotal > 0 ? 'Total Spending' : 'No expenses recorded'}</p>
                </div>
                <div className="text-right">
                    <span className={`text-xl font-bold font-mono ${selectedDayTotal > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                        ${selectedDayTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            </div>
        </div>
    );
  };
  
  const handleResetSpendingView = () => {
    setDateOffset(0);
    setCalendarDate(new Date());
    setPeriod('M'); // Force switch back to monthly view
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
                   <button 
                        onClick={() => setNetAssetYear(new Date().getFullYear())}
                        disabled={netAssetYear === new Date().getFullYear()}
                        className="text-xs font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg disabled:text-gray-400 disabled:hover:bg-transparent"
                     >
                       Today
                     </button>
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
                    <AreaChart data={assetView === 'wealth' ? netAssetData.wealthData : netAssetData.investmentData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <defs>
                            <linearGradient id="colorWealthSplit" x1="0" y1="0" x2="0" y2="1">
                                <stop offset={gradientOffset} stopColor="#10b981" stopOpacity={1} />
                                <stop offset={gradientOffset} stopColor="#EF4444" stopOpacity={1} />
                            </linearGradient>
                            <linearGradient id="colorWealthSplitFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset={gradientOffset} stopColor="#10b981" stopOpacity={0.4} />
                                <stop offset={gradientOffset} stopColor="#EF4444" stopOpacity={0.4} />
                            </linearGradient>
                            <linearGradient id="colorInvestment" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="name" tick={{fontSize: 12}} stroke="#9ca3af" axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 12}} stroke="#9ca3af" tickFormatter={(v) => `$${Number(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={40}/>
                        <Tooltip contentStyle={{backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(4px)', borderRadius: '0.75rem', border: '1px solid #e5e7eb'}} formatter={(v: number) => `$${v.toLocaleString()}`} />
                        <Area 
                            type="monotone" 
                            dataKey="balance" 
                            stroke={assetView === 'wealth' ? "url(#colorWealthSplit)" : "#3B82F6"} 
                            strokeWidth={2.5} 
                            fillOpacity={1} 
                            fill={assetView === 'wealth' ? "url(#colorWealthSplitFill)" : "url(#colorInvestment)"} 
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            {assetView === 'wealth' && <p className="text-xs text-gray-400 text-center mt-2">Wealth Growth = Cumulative (Income - Expenses)</p>}
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
             <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-gray-500 text-sm leading-tight">Spending<br/>Analysis</h3>
                <div className="flex items-center justify-end gap-x-4 gap-y-2 flex-wrap max-w-xs sm:max-w-md">
                    <button
                      onClick={handleResetSpendingView}
                      disabled={isSameMonth(calendarDate, new Date()) && period === 'M'}
                      className="text-xs font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg disabled:text-gray-400 disabled:hover:bg-transparent"
                    >
                      Today
                    </button>
                    <div className="flex bg-gray-100 p-1 rounded-lg text-xs">
                        {(['W', 'M', '6M', 'Y'] as const).map(p => (
                            <button key={p} onClick={() => { setPeriod(p); setDateOffset(0); }} className={`px-3 py-1.5 font-bold rounded-md transition-colors text-sm ${period === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="w-full">
                {period === 'M' ? <CalendarView baseDate={calendarDate} setBaseDate={setCalendarDate} /> :
                 (
                 <>
                  <div className="flex items-center justify-center gap-4 my-2">
                    <button onClick={() => setDateOffset(p => p - 1)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">&lt;</button>
                    <span className="text-sm font-bold text-gray-600">
                        {
                            period === 'W' ? `${format(startOfWeek(addWeeks(new Date(), dateOffset)), 'd MMM')} - ${format(endOfWeek(addWeeks(new Date(), dateOffset)), 'd MMM')}` :
                            period === '6M' ? `${format(startOfMonth(addMonths(addMonths(new Date(), dateOffset * 6), -5)), 'MMM yyyy')} - ${format(endOfMonth(addMonths(new Date(), dateOffset * 6)), 'MMM yyyy')}` :
                            format(addYears(new Date(), dateOffset), 'yyyy')
                        }
                    </span>
                    <button onClick={() => setDateOffset(p => p + 1)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">&gt;</button>
                  </div>
                  <div className="h-80 -ml-4">
                     {period === 'Y' ? 
                         <ResponsiveContainer width="100%" height="100%">
                             <LineChart data={spendingChartData} margin={{top: 5, right: 20, left: 10, bottom: 5}}>
                                <XAxis dataKey="name" tick={{fontSize: 12}} stroke="#9ca3af" axisLine={false} tickLine={false} />
                                <YAxis tick={{fontSize: 12}} stroke="#9ca3af" axisLine={false} tickLine={false} width={40} />
                                <Tooltip content={<CustomTooltip expenseCategories={expenseCategories} />} />
                                <Line type="monotone" dataKey="total" stroke="#EF4444" strokeWidth={2.5} name="Total Expenses" />
                             </LineChart>
                         </ResponsiveContainer>
                         :
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={spendingChartData} margin={{top: 5, right: 20, left: 10, bottom: 5}}>
                                <XAxis dataKey="name" tick={{fontSize: 12}} stroke="#9ca3af" axisLine={false} tickLine={false} />
                                <YAxis tick={{fontSize: 12}} stroke="#9ca3af" axisLine={false} tickLine={false} width={40} />
                                <Tooltip content={<CustomTooltip expenseCategories={expenseCategories} />} cursor={{fill: 'rgba(243, 244, 246, 0.7)'}} />
                                {expenseCategories.map(cat => <Bar key={cat} dataKey={cat} stackId="a" fill={expenseColors[cat] || '#ccc'} name={cat} />)}
                            </BarChart>
                        </ResponsiveContainer>
                    }
                 </div>
                 </>
                 )
                }
            </div>
        </div>

       <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
             <h3 className="font-semibold text-gray-500 text-sm leading-tight">Monthly<br/>Flow</h3>
            <div className="flex items-center justify-end gap-x-4 gap-y-2 flex-wrap max-w-xs sm:max-w-md">
              <div className="flex items-center gap-1 text-sm">
                 <button onClick={() => setMonthlyFlowYear(y => y - 1)} className="p-1 rounded-full hover:bg-gray-100 text-gray-500">&lt;</button>
                 <span className="font-bold text-gray-600 w-10 text-center">{monthlyFlowYear}</span>
                 <button onClick={() => setMonthlyFlowYear(y => y + 1)} className="p-1 rounded-full hover:bg-gray-100 text-gray-500">&gt;</button>
              </div>
              <button 
                onClick={() => setMonthlyFlowYear(new Date().getFullYear())}
                disabled={monthlyFlowYear === new Date().getFullYear()}
                className="text-xs font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg disabled:text-gray-400 disabled:hover:bg-transparent"
              >
                Today
              </button>
            </div>
          </div>
          <div className="h-64 -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flowOverTimeData} margin={{top: 5, right: 20, left: 10, bottom: 5}}>
                <XAxis dataKey="name" tick={{fontSize: 12}} stroke="#9ca3af" axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 12}} stroke="#9ca3af" axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(4px)', borderRadius: '0.75rem', border: '1px solid #e5e7eb'}} formatter={(v: number) => `$${v.toLocaleString()}`} />
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
