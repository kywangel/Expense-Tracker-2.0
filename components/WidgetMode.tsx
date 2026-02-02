
import React, { useMemo } from 'react';
import { Transaction, AppSettings } from '../types';
import { isSameDay, startOfMonth, isSameMonth, startOfDay, getYear, format } from 'date-fns';
import { getFinancialInterval } from '../constants';

interface WidgetModeProps {
  transactions: Transaction[];
  settings: AppSettings;
  onExit: () => void;
}

const f0 = (val: number) => Math.round(val).toLocaleString('en-US');

const WidgetMode: React.FC<WidgetModeProps> = ({ transactions, settings, onExit }) => {
  const viewDate = startOfDay(new Date());
  
  const tableData = useMemo(() => {
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
    const todayTxs = transactions.filter(tx => isSameDay(new Date(tx.date), viewDate) && tx.type === 'expense');
    
    const rows = trackedCats.map(cat => {
        const budget = effectiveBudgets[cat] || 0;
        const freq = freqTargets[cat] || 0;
        const unit = freq > 0 ? budget / freq : 0;
        const daySpent = todayTxs.filter(t => t.category === cat).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const monthSpent = monthTxs.filter(t => t.category === cat).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const monthCount = monthTxs.filter(t => t.category === cat && Math.abs(t.amount) > 0).length;
        
        return { cat, budget, freq, unit, daySpent, leftMonth: budget - monthSpent, times: monthCount };
    });

    // Handle "Others"
    const totalExpenseBudget = settings.expenseCategories.reduce((sum, c) => sum + (effectiveBudgets[c] || 0), 0);
    const trackedBudgetSum = trackedCats.reduce((sum, c) => sum + (effectiveBudgets[c] || 0), 0);
    const untrackedBudget = totalExpenseBudget - trackedBudgetSum;
    
    const othersDaySpent = todayTxs.filter(t => !trackedCats.includes(t.category)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const othersMonthSpent = monthTxs.filter(t => !trackedCats.includes(t.category)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const othersMonthCount = monthTxs.filter(t => !trackedCats.includes(t.category) && Math.abs(t.amount) > 0).length;

    return {
        rows,
        others: {
            budget: untrackedBudget,
            daySpent: othersDaySpent,
            leftMonth: untrackedBudget - othersMonthSpent,
            times: othersMonthCount
        },
        cycleLabel: billingStartDay > 1 ? `${format(monthStart, 'MMM d')} - ${format(monthEnd, 'MMM d')}` : format(viewDate, 'MMMM yyyy')
    };
  }, [transactions, settings, viewDate]);

  const getDisplayCategoryName = (name: string) => {
    const icon = settings.categoryIcons[name];
    return icon ? `${icon} ${name}` : name;
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in h-screen bg-black -mx-6 px-4 pt-4 overflow-hidden">
      <div className="flex justify-between items-center mb-2">
          <div>
              <h2 className="text-white font-black text-xl tracking-tight">Spending Analysis</h2>
              <p className="text-blue-500 text-[10px] font-bold uppercase tracking-widest">{tableData.cycleLabel}</p>
          </div>
          <button onClick={onExit} className="bg-white/10 text-white p-2 rounded-full">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
      </div>

      <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl flex-1 flex flex-col">
          <div className="overflow-y-auto">
            <table className="w-full text-[10px] text-left border-collapse">
                <thead>
                    <tr className="bg-gray-50 text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100">
                        <th className="px-3 py-4">Category</th>
                        <th className="px-2 py-4 text-right">Budget</th>
                        <th className="px-2 py-4 text-right bg-blue-50 text-blue-600">Today</th>
                        <th className="px-2 py-4 text-right">Left</th>
                        <th className="px-2 py-4 text-center">#</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {tableData.rows.map(r => (
                        <tr key={r.cat}>
                            <td className="px-3 py-4 font-bold text-gray-800 truncate max-w-[80px]">{getDisplayCategoryName(r.cat)}</td>
                            <td className="px-2 py-4 text-right font-mono text-gray-500">${f0(r.budget)}</td>
                            <td className={`px-2 py-4 text-right font-mono font-black bg-blue-50/30 ${r.daySpent > 0 ? 'text-blue-600' : 'text-gray-300'}`}>${f0(r.daySpent)}</td>
                            <td className={`px-2 py-4 text-right font-mono font-bold ${r.leftMonth < 0 ? 'text-red-500' : 'text-green-600'}`}>${f0(r.leftMonth)}</td>
                            <td className="px-2 py-4 text-center font-mono font-black text-gray-800">{r.times}</td>
                        </tr>
                    ))}
                    <tr className="bg-gray-50/50 italic font-medium">
                        <td className="px-3 py-4 text-gray-600">Others</td>
                        <td className="px-2 py-4 text-right font-mono text-gray-500">${f0(tableData.others.budget)}</td>
                        <td className={`px-2 py-4 text-right font-mono font-black bg-blue-50/30 ${tableData.others.daySpent > 0 ? 'text-blue-600' : 'text-gray-300'}`}>${f0(tableData.others.daySpent)}</td>
                        <td className={`px-2 py-4 text-right font-mono font-bold ${tableData.others.leftMonth < 0 ? 'text-red-500' : 'text-green-600'}`}>${f0(tableData.others.leftMonth)}</td>
                        <td className="px-2 py-4 text-center font-mono font-black text-gray-800">{tableData.others.times}</td>
                    </tr>
                </tbody>
            </table>
          </div>
          
          <div className="mt-auto p-6 bg-gray-900 text-white flex justify-between items-center">
              <div>
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Total Daily Spent</p>
                  <p className="text-2xl font-black tracking-tight">
                    ${f0(tableData.rows.reduce((s, r) => s + r.daySpent, 0) + tableData.others.daySpent)}
                  </p>
              </div>
              <div className="text-right">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Month Progress</p>
                  <p className="text-lg font-bold font-mono text-blue-400">
                    {format(viewDate, 'MMM d')}
                  </p>
              </div>
          </div>
      </div>
      <div className="pb-safe-area" />
    </div>
  );
};

export default WidgetMode;
