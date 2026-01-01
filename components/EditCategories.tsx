
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

  // Mobile-safe drag state
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleEditClick = (type: string, name: string) => {
    setEditing({ type, name });
    setEditingText(name);
  };

  const handleSaveEdit = (type: 'income' | 'expense' | 'investment', oldName: string) => {
    if (!editingText.trim()) {
        setEditing(null);
        return;
    }
    onEditCategory(type, oldName, editingText.trim());
    setEditing(null);
    setEditingText('');
  };

  /**
   * Robust Mobile Reordering Logic
   * Tracks pointer Y position to determine swap targets
   */
  const handlePointerMove = (e: React.PointerEvent, type: 'income' | 'expense' | 'investment', categories: string[]) => {
      if (activeDragIndex === null) return;

      const container = e.currentTarget as HTMLElement;
      const children = Array.from(container.children);
      const pointerY = e.clientY;

      // Find which element the pointer is currently over
      let targetIndex = activeDragIndex;
      children.forEach((child, idx) => {
          const rect = child.getBoundingClientRect();
          const middle = rect.top + rect.height / 2;
          if (pointerY > rect.top && pointerY < rect.bottom) {
              targetIndex = idx;
          }
      });

      if (targetIndex !== activeDragIndex) {
          const newCategories = [...categories];
          const movedItem = newCategories.splice(activeDragIndex, 1)[0];
          newCategories.splice(targetIndex, 0, movedItem);
          
          setActiveDragIndex(targetIndex);
          onReorderCategories(type, newCategories);
      }
  };

  const renderCategoryManager = (
    title: string,
    type: 'income' | 'expense' | 'investment',
    categories: string[],
    newCatValue: string,
    setNewCatValue: (val: string) => void
  ) => {
    const handleAdd = () => {
      if (!newCatValue.trim()) return;
      onAddCategory(type, newCatValue.trim());
      setNewCatValue('');
    };

    return (
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <h3 className="font-bold text-lg mb-5 text-gray-800 flex justify-between items-center">
            {title}
            <span className="text-[10px] uppercase text-gray-400 tracking-wider font-bold bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                {categories.length} Total
            </span>
        </h3>
        
        <div 
            className="space-y-3 mb-6 touch-none"
            onPointerMove={(e) => handlePointerMove(e, type, categories)}
            onPointerUp={() => setActiveDragIndex(null)}
            onPointerLeave={() => setActiveDragIndex(null)}
        >
          {categories.map((cat, index) => {
            const isBeingEdited = editing?.name === cat && editing?.type === type;
            const isDragging = activeDragIndex === index;

            return (
              <div 
                key={cat} 
                className={`flex justify-between items-center bg-gray-50 border border-gray-100 rounded-xl transition-all ${isBeingEdited ? 'ring-2 ring-blue-500 bg-white' : ''} ${isDragging ? 'opacity-50 scale-[1.02] shadow-lg border-blue-200' : ''}`}
              >
                {/* Custom Drag Handle - Explicitly captures pointer for iOS stability */}
                <div 
                    className="w-14 h-14 flex items-center justify-center text-gray-300 cursor-grab active:cursor-grabbing hover:text-gray-500 shrink-0 select-none"
                    style={{ touchAction: 'none' }}
                    onPointerDown={(e) => {
                        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                        setActiveDragIndex(index);
                    }}
                >
                  <svg className="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8h16M4 16h16" />
                  </svg>
                </div>

                <div className="flex-grow min-w-0 py-3">
                  {isBeingEdited ? (
                    <input
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                      autoFocus
                      onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(type, cat);
                          if (e.key === 'Escape') setEditing(null);
                      }}
                    />
                  ) : (
                    <span className="text-sm font-bold text-gray-700 truncate block">{cat}</span>
                  )}
                </div>
                
                <div className="flex items-center shrink-0">
                  {isBeingEdited ? (
                    <button 
                        onMouseDown={() => handleSaveEdit(type, cat)} 
                        className="w-14 h-14 flex items-center justify-center text-green-600 active:bg-green-50 rounded-r-xl transition-colors"
                        aria-label="Save changes"
                    >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleEditClick(type, cat)} 
                        className="w-14 h-14 flex items-center justify-center text-gray-400 hover:text-blue-600 active:bg-blue-50 transition-colors"
                        aria-label={`Edit ${cat}`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={() => onDeleteCategory(type, cat)}
                        className="w-14 h-14 flex items-center justify-center rounded-r-xl transition-colors text-red-500 active:bg-red-50 active:scale-95"
                        aria-label={`Delete ${cat}`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newCatValue}
            onChange={e => setNewCatValue(e.target.value)}
            placeholder={`New ${title} Name...`}
            className="flex-grow p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button 
            onClick={handleAdd} 
            className="bg-blue-600 text-white font-bold px-6 py-4 rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-500/20"
          >
              Add
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2 pb-24">
      <div className="flex items-center mb-6 px-1">
          <button onClick={onBack} className="flex items-center text-sm font-bold text-gray-500 hover:text-gray-800 bg-gray-100 px-4 py-2.5 rounded-full transition-colors active:scale-95">
             <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
             </svg>
             Settings
          </button>
      </div>

      <div className="animate-fade-in-up">
        {renderCategoryManager('Income', 'income', settings.incomeCategories, newIncomeCat, setNewIncomeCat)}
        {renderCategoryManager('Expenses', 'expense', settings.expenseCategories, newExpenseCat, setNewExpenseCat)}
        {renderCategoryManager('Investments / Savings', 'investment', settings.investmentCategories, newInvestmentCat, setNewInvestmentCat)}
      </div>
    </div>
  );
};

export default EditCategories;
