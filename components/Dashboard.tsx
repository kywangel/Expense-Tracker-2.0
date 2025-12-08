import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  transactions: Transaction[];
  currentMonthBudgets: Record<string, number>; // Renamed for clarity
  incomeCategories: string[];
  expenseCategories: string[];
  investmentCategories: string[];
}

const INCOME_CHART_COLORS = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'];
const EXPENSE_CHART_COLORS = ['#B91C1C', '#DC2626', '#EF4444', '#F87171', '#FCA5A5'];
const INVESTMENT_CHART_COLORS = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'];


const Dashboard: React.FC<DashboardProps> = ({ transactions, currentMonthBudgets, incomeCategories, expenseCategories, investmentCategories }) => {
  const [viewModes, setViewModes] = useState({
    income: 'table',
    expenses: 'table',
    savings: 'table',
  });

  const toggleViewMode = (section: 'income' | 'expenses' | 'savings') => {
    setViewModes(prev => ({ ...prev, [section]: prev[section] === 'table' ? 'chart' : 'table' }));
  };
  
  const spendingMap = transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);

  const netBalance = transactions.reduce((sum, t) => sum + t.amount, 0);

  const renderSection = (title: 'Income' | 'Expenses' | 'Savings', categories: string[], headerColor: string) => {
    const sectionKey = title.toLowerCase() as 'income' | 'expenses' | 'savings';
    const viewMode = viewModes[sectionKey];

    const getTopFiveData = () => {
        const sorted = categories
            .map(cat => ({ name: cat, value: Math.abs(spendingMap[cat] || 0) }))
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value);

        const top5 = sorted.slice(0, 5);
        const othersValue = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
        
        const chartData = [...top5];
        if (othersValue > 0) {
            chartData.push({ name: 'Others', value: othersValue });
        }
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
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6 border border-gray-200">
        <div className={`${headerColor} text-white px-4 py-2 font-bold text-sm flex justify-between items-center w-full`}>
           <span>{title}</span>
           <div className="flex items-center gap-1">
             <button onClick={() => toggleViewMode(sectionKey)} className={`p-1 rounded ${viewMode === 'table' ? 'bg-black/20' : ''}`}><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" /></svg></button>
             <button onClick={() => toggleViewMode(sectionKey)} className={`p-1 rounded ${viewMode === 'chart' ? 'bg-black/20' : ''}`}><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg></button>
           </div>
        </div>

        {viewMode === 'table' ? (
          <div className="animate-fade-in">
            <div className="grid grid-cols-10 gap-2 px-4 py-2 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                <div className="col-span-3">Category</div>
                <div className="col-span-2 text-right">Tracked</div>
                <div className="col-span-2 text-right">Budget</div>
                <div className="col-span-2 text-center">% Compl.</div>
                <div className="col-span-1 text-right">Rem.</div>
            </div>
            <div className="divide-y divide-gray-100">
              {categories.map(cat => {
                const tracked = spendingMap[cat] || 0;
                const budget = currentMonthBudgets[cat] || 0;
                const percent = budget > 0 ? (Math.abs(tracked) / budget) * 100 : 0;
                const remaining = budget - Math.abs(tracked);
                
                const barColor = percent > 100 ? 'bg-red-500' :
                                 title === 'Income' ? 'bg-green-500' :
                                 title === 'Expenses' ? 'bg-red-700' : 'bg-blue-600';

                return (
                  <div key={cat} className="grid grid-cols-10 gap-2 px-4 py-3 text-xs items-center hover:bg-gray-50 transition-colors">
                    <div className="col-span-3 font-medium text-gray-800 truncate pr-1">{cat}</div>
                    <div className="col-span-2 text-right text-gray-600 font-mono">{Math.abs(tracked).toFixed(1)}</div>
                    <div className="col-span-2 text-right text-gray-600 font-mono">{budget > 0 ? budget.toFixed(1) : '-'}</div>
                    <div className="col-span-2 flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div className={`${barColor} h-full rounded-full`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
                      </div>
                    </div>
                     <div className={`col-span-1 text-right font-mono ${budget > 0 && remaining < 0 ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                        {budget > 0 ? remaining.toFixed(0) : '-'}
                     </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 flex items-center h-48 animate-fade-in">
            <div className="w-1/2 h-full">
               <ResponsiveContainer>
                 <PieChart>
                   <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" fill="#8884d8" paddingAngle={5}>
                     {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />)}
                   </Pie>
                 </PieChart>
               </ResponsiveContainer>
            </div>
            <div className="w-1/2 text-xs space-y-1 pl-4">
                {chartData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between">
                        <div className="flex items-center">
                           <span className="w-2.5 h-2.5 rounded-sm mr-2" style={{ backgroundColor: chartColors[index % chartColors.length] }}></span>
                           <span className="text-gray-600 truncate max-w-[80px]">{entry.name}</span>
                        </div>
                        <span className="font-mono font-semibold text-gray-700">{entry.value.toLocaleString()}</span>
                    </div>
                ))}
                 <div className="font-bold pt-1 border-t mt-2 flex justify-between">
                     <span>Total</span>
                     <span>{Math.abs(totalTracked).toLocaleString()}</span>
                 </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
        <p className="text-xs text-gray-500 font-semibold uppercase">Net Balance</p>
        <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {netBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
        </p>
        <p className="text-xs text-gray-400">Income - (Expenses + Investments)</p>
      </div>
      {renderSection('Income', incomeCategories, 'bg-green-500')}
      {renderSection('Expenses', expenseCategories, 'bg-red-700')}
      {renderSection('Savings', investmentCategories, 'bg-blue-600')}
    </div>
  );
};

export default Dashboard;