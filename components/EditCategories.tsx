
import React, { useState, useRef } from 'react';
import { AppSettings, Transaction } from '../types';

interface EditCategoriesProps {
  settings: AppSettings;
  transactions: Transaction[];
  onAddCategory: (type: 'income' | 'expense' | 'investment', category: string) => void;
  onDeleteCategory: (type: 'income' | 'expense' | 'investment', category: string) => void;
  onEditCategory: (type: 'income' | 'expense' | 'investment', oldName: string, newName: string) => void;
  onReorderCategories: (type: 'income' | 'expense' | 'investment', reorderedCategories: string[]) => void;
  onBack: () => void;
}

const EditCategories: React.FC<EditCategoriesProps> = ({ 
    settings, transactions, onAddCategory, onDeleteCategory, 
    onEditCategory, onReorderCategories, onBack 
}) => {
  const [newIncomeCat, setNewIncomeCat] = useState('');
  const [newExpenseCat, setNewExpenseCat] = useState('');
  const [newInvestmentCat, setNewInvestmentCat] = useState('');
  
  const [editing, setEditing] = useState<{ type: string; name: string } | null>(null);
  const [editingText, setEditingText] = useState('');

  const usedCategories = new Set(transactions.map(t => t.category));

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleEditClick = (type: string, name: string) => {
    setEditing({ type, name });
    setEditingText(name);
  };

  const handleSaveEdit = (type: 'income' | 'expense' | 'investment', oldName: string) => {
    onEditCategory(type, oldName, editingText);
    setEditing(null);
    setEditingText('');
  };

  const handleDragSort = (type: 'income' | 'expense' | 'investment', categories: string[]) => {
      if (dragItem.current === null || dragOverItem.current === null) return;
      
      const newCategories = [...categories];
      const draggedItemContent = newCategories.splice(dragItem.current, 1)[0];
      newCategories.splice(dragOverItem.current, 0, draggedItemContent);
      
      dragItem.current = null;
      dragOverItem.current = null;
      
      onReorderCategories(type, newCategories);
  };

  const renderCategoryManager = (
    title: string,
    type: 'income' | 'expense' | 'investment',
    categories: string[],
    newCatValue: string,
    setNewCatValue: (val: string) => void
  ) => {
    const handleAdd = () => {
      onAddCategory(type, newCatValue);
      setNewCatValue('');
    };

    return (
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-lg mb-4 text-gray-800">{title}</h3>
        <div className="space-y-2 mb-4">
          {categories.map((cat, index) => (
            <div 
              key={cat} 
              className="flex justify-between items-center bg-gray-50 p-2 rounded-lg group"
              draggable
              onDragStart={() => dragItem.current = index}
              onDragEnter={() => dragOverItem.current = index}
              onDragEnd={() => handleDragSort(type, categories)}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="flex items-center space-x-3 flex-grow min-w-0">
                <svg className="w-5 h-5 text-gray-400 cursor-grab flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>

                {editing?.name === cat && editing?.type === type ? (
                  <input
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="flex-grow p-1 bg-white border border-blue-500 rounded text-sm focus:outline-none min-w-0"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(type, cat)}
                    onBlur={() => setEditing(null)}
                  />
                ) : (
                  <span className="text-sm text-gray-700 truncate">{cat}</span>
                )}
              </div>
              
              <div className="flex items-center space-x-1 flex-shrink-0">
                {editing?.name === cat && editing?.type === type ? (
                  <>
                    <button onMouseDown={() => handleSaveEdit(type, cat)} className="p-1 text-green-600 hover:bg-green-100 rounded-full"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleEditClick(type, cat)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg></button>
                    <button
                      onClick={() => onDeleteCategory(type, cat)}
                      disabled={usedCategories.has(cat)}
                      className="text-red-500 p-1 rounded-full hover:bg-red-100 disabled:text-gray-300 disabled:cursor-not-allowed"
                      title={usedCategories.has(cat) ? "Cannot delete category in use" : "Delete category"}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex space-x-2">
          <input
            type="text"
            value={newCatValue}
            onChange={e => setNewCatValue(e.target.value)}
            placeholder={`New ${title} Category`}
            className="flex-grow p-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button onClick={handleAdd} className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-blue-700">Add</button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24">
      <button onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-2">
         <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
         Back to Settings
      </button>

      {renderCategoryManager('Income', 'income', settings.incomeCategories, newIncomeCat, setNewIncomeCat)}
      {renderCategoryManager('Expenses', 'expense', settings.expenseCategories, newExpenseCat, setNewExpenseCat)}
      {renderCategoryManager('Investments / Savings', 'investment', settings.investmentCategories, newInvestmentCat, setNewInvestmentCat)}
    </div>
  );
};

export default EditCategories;
