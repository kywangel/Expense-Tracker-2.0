import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    LineChart, Line, Legend, Area, AreaChart
} from 'recharts';
import { 
    format, endOfWeek, endOfMonth, endOfYear,
    eachDayOfInterval, eachMonthOfInterval, getDay, addMonths, 
    isToday, isSameMonth, addWeeks, addYears, isSameYear
} from 'date-fns';
import startOfWeek from 'date-fns/startOfWeek';
import startOfMonth from 'date-fns/startOfMonth';
import startOfYear from 'date-fns/startOfYear';
import subMonths from 'date-fns/subMonths';

interface StatisticsProps {
  transactions: Transaction[];
  incomeCategories: string[];
  investmentCategories: string[];
  expenseCategories: string[];
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

const Statistics: React.FC<StatisticsProps> = ({ transactions, expenseCategories }) => {
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

    const priorTransactions = sortedTransactions.filter(tx => new Date(tx.date) < yearStart);
    let startWealth = priorTransactions.reduce((acc, tx) => acc + (tx.type === 'income' || tx.type === 'expense' ? tx.amount : 0), 0);
    let startInvestment = priorTransactions.reduce((acc, tx) => acc + (tx.type === 'investment' ? Math.abs(tx.amount) : 0), 0);

    const yearMonths = eachMonthOfInterval({ start: yearStart, end: yearEnd });
    
    const monthlyChanges = sortedTransactions
        .filter(tx => { const d = new Date(tx.date); return d >= yearStart && d <= yearEnd; })
        .reduce((acc, tx) => {
            const month = format(new Date(tx.date), 'MMM');
            if (!acc[month]) acc[month] = { wealth: 0, investment: 0 };
            if (tx.type === 'income' || tx.type === 'expense') acc[month].wealth += tx.amount;
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
        interval = { start: startOfMonth(subMonths(sixMonthsDate, 5)), end: endOfMonth(sixMonthsDate) };
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
    
    const dailyTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        transactions.filter(tx => isSameMonth(new Date(tx.date), baseDate) && tx.type === 'expense')
            .forEach(tx => {
                const day = format(new Date(tx.date), 'd');
                totals[day] = (totals[day] || 0) + Math.abs(tx.amount);
            });
        return totals;
    }, [transactions, baseDate]);
    
    return (
        <div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 font-bold mb-2">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day,i) => <div key={i}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startingDayIndex }).map((_, i) => <div key={`e-${i}`} />)}
                {daysInMonth.map(day => {
                    const dayKey = format(day, 'd');
                    const total = dailyTotals[dayKey];
                    const amountStr = total ? total.toFixed(0) : '';
                    const fontSize = amountStr.length > 4 ? 'text-[9px]' : amountStr.length > 3 ? 'text-[10px]' : 'text-xs';
                    return (
                        <div key={day.toString()} className={`rounded-lg p-1.5 h-16 text-left flex flex-col ${isToday(day) ? 'bg-blue-50' : ''}`}>
                            <span className={`font-bold text-xs ${isToday(day) ? 'text-blue-600' : 'text-gray-600'}`}>{dayKey}</span>
                            {total && <p className={`text-red-600 font-bold mt-1 ${fontSize}`}>-${total.toLocaleString()}</p>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };
  
  const handleResetSpendingView = () => {
    setDateOffset(0);
    setCalendarDate(new Date());
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
                            <linearGradient id="colorWealth" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorInvestment" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="name" tick={{fontSize: 12}} stroke="#9ca3af" axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 12}} stroke="#9ca3af" tickFormatter={(v) => `$${Number(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={40}/>
                        <Tooltip contentStyle={{backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(4px)', borderRadius: '0.75rem', border: '1px solid #e5e7eb'}} formatter={(v: number) => `$${v.toLocaleString()}`} />
                        <Area type="monotone" dataKey="balance" stroke={assetView === 'wealth' ? "#10b981" : "#3B82F6"} strokeWidth={2.5} fillOpacity={1} fill={`url(#${assetView === 'wealth' ? 'colorWealth' : 'colorInvestment'})`} />
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
                      disabled={(period === 'M' && isSameMonth(calendarDate, new Date())) || (period !== 'M' && dateOffset === 0)}
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
                            period === '6M' ? `${format(startOfMonth(subMonths(addMonths(new Date(), dateOffset * 6), 5)), 'MMM yyyy')} - ${format(endOfMonth(addMonths(new Date(), dateOffset * 6)), 'MMM yyyy')}` :
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