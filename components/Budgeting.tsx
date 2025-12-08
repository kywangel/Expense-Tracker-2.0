import React, { useState, useMemo } from 'react';
import { AppSettings } from '../types';
import { format, addMonths, subMonths } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

interface BudgetingProps {
  settings: AppSettings;
  onUpdateBudget: (monthKey: string, category: string, amount: number) => void;
  onBack: () => void;
  onShowNotification: (message: string) => void;
}

const VIBRANT_INCOME_COLORS = ['#10B981', '#22C55E', '#84CC16', '#A3E635', '#65A30D', '#BEF264'];
const VIBRANT_EXPENSE_COLORS = ['#EF4444', '#F97316', '#EAB308', '#D97706', '#DC2626', '#F43F5E'];
const VIBRANT_INVESTMENT_COLORS = ['#3B82F6', '#6366F1', '#8B5CF6', '#A78BFA', '#4F46E5', '#2563EB'];

const Budgeting: React.FC<BudgetingProps> = ({ settings, onUpdateBudget, onBack, onShowNotification }) => {
    const { monthlyCategoryBudgets, incomeCategories, expenseCategories, investmentCategories } = settings;
    
    const [viewDate, setViewDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('list');

    const monthKey = useMemo(() => format(viewDate, 'yyyy-MM'), [viewDate]);
    const budgetsForMonth = useMemo(() => monthlyCategoryBudgets[monthKey] || {}, [monthlyCategoryBudgets, monthKey]);

    const handleCopyFromPrevious = () => {
        const prevMonthDate = subMonths(viewDate, 1);
        const prevMonthKey = format(prevMonthDate, 'yyyy-MM');
        const prevMonthBudgets = monthlyCategoryBudgets[prevMonthKey] || {};
        
        if (Object.keys(prevMonthBudgets).length === 0) {
            onShowNotification("Previous month has no budget to copy.");
            return;
        }

        Object.entries(prevMonthBudgets).forEach(([category, amount]) => {
            onUpdateBudget(monthKey, category, amount);
        });
        onShowNotification(`Copied budget from ${format(prevMonthDate, 'MMMM yyyy')}.`);
    };

    const yearlyBudgetData = useMemo(() => {
        const year = viewDate.getFullYear();
        const yearMonths = Array.from({ length: 12 }, (_, i) => format(new Date(year, i, 1), 'yyyy-MM'));
        
        return yearMonths.map(mKey => {
            const monthBudgets = monthlyCategoryBudgets[mKey] || {};
            const totalExpenses = expenseCategories.reduce((sum, cat) => sum + (monthBudgets[cat] || 0), 0);
            return {
                name: format(new Date(mKey + '-02'), 'MMM'),
                budget: totalExpenses
            };
        });
    }, [viewDate, monthlyCategoryBudgets, expenseCategories]);
    
    const totalYearlyBudget = useMemo(() => {
        return yearlyBudgetData.reduce((sum, month) => sum + month.budget, 0);
    }, [yearlyBudgetData]);

    const renderBudgetSection = (title: string, categories: string[], type: 'income' | 'expense' | 'investment') => {
        const totalBudget = categories.reduce((sum, cat) => sum + (budgetsForMonth[cat] || 0), 0);
        const chartColors = type === 'income' ? VIBRANT_INCOME_COLORS : type === 'expense' ? VIBRANT_EXPENSE_COLORS : VIBRANT_INVESTMENT_COLORS;

        const chartData = useMemo(() => {
            const sorted = categories
                .map(cat => ({ name: cat, value: budgetsForMonth[cat] || 0 }))
                .filter(item => item.value > 0)
                .sort((a, b) => b.value - a.value);

            const top5 = sorted.slice(0, 5);
            const othersValue = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
            
            const finalData = [...top5];
            if (othersValue > 0) {
                finalData.push({ name: 'Others', value: othersValue });
            }
            return finalData;
        }, [categories, budgetsForMonth]);

        return (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6 border border-gray-200">
                <div className={`${type === 'income' ? 'bg-green-500' : type === 'expense' ? 'bg-red-700' : 'bg-blue-600'} text-white px-4 py-2 font-bold text-sm`}>
                    <span className="capitalize">{title}</span>
                </div>

                {viewMode === 'list' ? (
                    <div className="divide-y divide-gray-100">
                        {categories.map(cat => (
                            <div key={cat} className="grid grid-cols-2 gap-4 px-4 py-3 text-sm items-center">
                                <label htmlFor={`${cat}-budget`} className="font-medium text-gray-800 truncate pr-2">{cat}</label>
                                <input
                                    id={`${cat}-budget`}
                                    type="number"
                                    placeholder="0.00"
                                    value={budgetsForMonth[cat] || ''}
                                    onChange={e => onUpdateBudget(monthKey, cat, parseFloat(e.target.value) || 0)}
                                    className="w-full text-right bg-gray-100 rounded-md px-2 py-1 font-mono focus:ring-2 focus:ring-blue-200 focus:outline-none"
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-4 h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="80%" innerRadius="50%">
                                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />)}
                                </Pie>
                                <Tooltip 
                                    formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
                                    contentStyle={{
                                        backgroundColor: 'rgba(255,255,255,0.9)', 
                                        backdropFilter: 'blur(4px)', 
                                        borderRadius: '0.75rem', 
                                        border: '1px solid #e5e7eb'
                                    }}
                                />
                                <Legend 
                                    iconType="circle" 
                                    layout="horizontal" 
                                    verticalAlign="bottom" 
                                    align="center"
                                    wrapperStyle={{fontSize: '12px', lineHeight: '20px', paddingLeft: '10px', paddingRight: '10px'}}
                                />
                            </PieChart>
                         </ResponsiveContainer>
                    </div>
                )}

                <div className="px-4 py-3 bg-gray-50 font-bold text-sm border-t border-gray-200 flex justify-between">
                     <span>Total Budget</span>
                     <span className="font-mono">${totalBudget.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-24">
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-gray-800">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Back
                </button>
                 <button onClick={handleCopyFromPrevious} className="text-xs font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg">
                    Copy from Previous Month
                </button>
            </div>
            
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => setViewDate(d => subMonths(d, 1))} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">&lt;</button>
                    <span className="font-bold text-gray-700 text-center w-32">{format(viewDate, 'MMMM yyyy')}</span>
                    <button onClick={() => setViewDate(d => addMonths(d, 1))} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">&gt;</button>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setViewMode('list')} className={`p-1 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" /></svg></button>
                    <button onClick={() => setViewMode('chart')} className={`p-1 rounded ${viewMode === 'chart' ? 'bg-white shadow-sm' : ''}`}><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg></button>
                </div>
            </div>

            {renderBudgetSection('Income', incomeCategories, 'income')}
            {renderBudgetSection('Expenses', expenseCategories, 'expense')}
            {renderBudgetSection('Savings / Investments', investmentCategories, 'investment')}

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-center mb-4">Yearly Budget Overview ({viewDate.getFullYear()})</h3>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={yearlyBudgetData}>
                            <XAxis dataKey="name" tick={{fontSize: 12}} />
                            <YAxis tickFormatter={(v) => `$${Number(v/1000).toFixed(0)}k`} tick={{fontSize: 12}} width={40}/>
                            <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                            <Bar dataKey="budget" fill="#EF4444" name="Budgeted Expenses" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="text-center mt-4 border-t pt-4">
                    <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide">Total Yearly Budgeted Expenses</p>
                    <p className="text-xl font-bold font-mono text-gray-800">
                        ${totalYearlyBudget.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Budgeting;