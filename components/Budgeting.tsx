
import React, { useState, useMemo } from 'react';
import { AppSettings, Transaction } from '../types';
import { addYears, subYears, format, getYear, isSameYear } from 'date-fns';

interface BudgetingProps {
  settings: AppSettings;
  transactions: Transaction[]; 
  onUpdateBudget: (category: string, amount: number, year: number) => void;
  onBack: () => void;
  onShowNotification: (message: string) => void;
}

const Budgeting: React.FC<BudgetingProps> = ({ settings, transactions, onUpdateBudget, onBack }) => {
    const { baseCategoryBudgets, yearlyBudgets, incomeCategories, expenseCategories, investmentCategories } = settings;
    const [viewDate, setViewDate] = useState(new Date());

    const viewYear = getYear(viewDate);

    // Calculate actuals for the selected year
    const yearlyActuals = useMemo(() => {
        const actuals: Record<string, number> = {};
        transactions.forEach(tx => {
            if (isSameYear(new Date(tx.date), viewDate)) {
                actuals[tx.category] = (actuals[tx.category] || 0) + Math.abs(tx.amount);
            }
        });
        return actuals;
    }, [transactions, viewDate]);

    const renderBudgetSection = (title: string, categories: string[], type: 'income' | 'expense' | 'investment') => {
        // Calculate Total Budget for this year
        // It sums up either the specific yearly override or falls back to the base budget
        const totalBudget = categories.reduce((sum, cat) => {
            const yearSpecific = yearlyBudgets?.[viewYear.toString()]?.[cat];
            const base = baseCategoryBudgets[cat] || 0;
            return sum + (yearSpecific !== undefined ? yearSpecific : base);
        }, 0);
        
        const yearlyProjection = totalBudget * 12;

        return (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6 border border-gray-200 animate-fade-in-up">
                <div className={`${type === 'income' ? 'bg-green-500' : type === 'expense' ? 'bg-red-700' : 'bg-blue-600'} text-white px-4 py-2 font-bold text-sm flex justify-between items-center`}>
                    <span className="capitalize">{title} Budget</span>
                    <span className="opacity-80 text-xs font-normal">Monthly for {viewYear}</span>
                </div>

                <div className="divide-y divide-gray-100">
                    {categories.map(cat => {
                        const yearSpecific = yearlyBudgets?.[viewYear.toString()]?.[cat];
                        const baseAmount = baseCategoryBudgets[cat] || 0;
                        
                        // Effective budget: If specific year exists, use it, else use base
                        const effectiveBudget = yearSpecific !== undefined ? yearSpecific : baseAmount;
                        
                        const yearlyAmount = effectiveBudget * 12;
                        const actualAmount = yearlyActuals[cat] || 0;
                        const progress = yearlyAmount > 0 ? (actualAmount / yearlyAmount) * 100 : 0;
                        
                        return (
                            <div key={cat} className="grid grid-cols-[1.5fr_1fr] gap-4 px-4 py-3 text-sm items-center hover:bg-gray-50 transition-colors">
                                <div className="min-w-0">
                                    <label htmlFor={`${cat}-budget`} className="font-bold text-gray-800 truncate block">{cat}</label>
                                    
                                    {/* Progress Bar for Actual vs Budget */}
                                    <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                        <div 
                                            className={`h-full ${type === 'income' ? 'bg-green-400' : type === 'expense' ? 'bg-red-400' : 'bg-blue-400'} opacity-70`} 
                                            style={{ width: `${Math.min(progress, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center mt-1 text-[10px]">
                                        <span className="text-gray-500 font-medium">Spent: ${actualAmount.toLocaleString('en-US', {maximumFractionDigits: 0})}</span>
                                        <span className="text-gray-400">Target: {yearlyAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</span>
                                    </div>
                                </div>
                                <div>
                                    <div className="relative">
                                        <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 font-medium">$</span>
                                        <input
                                            id={`${cat}-budget`}
                                            type="number"
                                            placeholder={baseAmount > 0 && yearSpecific === undefined ? baseAmount.toString() : "0"}
                                            value={yearSpecific !== undefined ? yearSpecific : (baseAmount > 0 ? baseAmount : '')}
                                            onChange={e => onUpdateBudget(cat, parseFloat(e.target.value) || 0, viewYear)}
                                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                            className={`w-full text-right border rounded-lg pl-5 pr-2 py-2 font-mono font-bold focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all ${yearSpecific !== undefined ? 'bg-yellow-50 border-yellow-300 text-gray-900' : 'bg-white border-gray-200 text-gray-600'}`}
                                        />
                                        <p className="text-[9px] text-gray-400 text-right mt-1">/mo</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="px-4 py-3 bg-gray-50 font-bold text-sm border-t border-gray-200 flex justify-between items-center">
                     <div>
                         <span className="block text-gray-600 text-xs uppercase">Monthly Total</span>
                         <span className="font-mono text-lg text-gray-900">${totalBudget.toLocaleString('en-US', {minimumFractionDigits: 0})}</span>
                     </div>
                     <div className="text-right">
                         <span className="block text-gray-400 text-xs uppercase">{viewYear} Projection</span>
                         <span className="font-mono text-gray-500">${yearlyProjection.toLocaleString('en-US', {minimumFractionDigits: 0})}</span>
                     </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-24">
            <div className="flex items-center justify-between mb-4">
                <button onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-gray-800">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Back
                </button>
                
                {/* Year Adjustment Controls */}
                <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
                    <button onClick={() => setViewDate(subYears(viewDate, 1))} className="p-1.5 hover:bg-white rounded-md transition-colors text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <span className="px-3 font-bold text-gray-800 text-sm">{viewYear}</span>
                    <button onClick={() => setViewDate(addYears(viewDate, 1))} className="p-1.5 hover:bg-white rounded-md transition-colors text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                    <button 
                        onClick={() => setViewDate(new Date())}
                        disabled={isSameYear(viewDate, new Date())}
                        className="text-xs font-semibold text-blue-600 px-2 disabled:text-gray-400 disabled:cursor-default"
                    >
                        Today
                    </button>
                </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                <p className="text-sm text-blue-800">
                    <strong>Budgeting for {viewYear}:</strong> Adjustments here save specifically for this year.
                    <br/><span className="text-xs opacity-75 mt-1 block">Yellow inputs indicate specific overrides for {viewYear}. White inputs use the default base.</span>
                </p>
            </div>

            {renderBudgetSection('Income', incomeCategories, 'income')}
            {renderBudgetSection('Expenses', expenseCategories, 'expense')}
            {renderBudgetSection('Savings / Investments', investmentCategories, 'investment')}
        </div>
    );
};

export default Budgeting;
