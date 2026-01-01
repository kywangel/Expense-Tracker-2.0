
import React, { useState, useRef, useEffect } from 'react';
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

  // Mobile-native drag state
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
  const [dragType, setDragType] = useState<string | null>(null);

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
   * Enhanced Pointer Move Logic
   * Uses real-time coordinate tracking to trigger swaps with smooth transitions
   */
  const handlePointerMove = (e: React.PointerEvent, type: 'income' | 'expense' | 'investment', categories: string[]) => {
      if (activeDragIndex === null || dragType !== type) return;

      const container = e.currentTarget as HTMLElement;
      const children = Array.from(container.children) as HTMLElement[];
      const pointerY = e.clientY;

      // Determine which index the pointer is currently "targeting"
      let targetIndex = activeDragIndex;
      
      for (let i = 0; i < children.length; i++) {
          const rect = children[i].getBoundingClientRect();
          const threshold = rect.top + rect.height / 2;
          
          if (pointerY > rect.top && pointerY < rect.bottom) {
              targetIndex = i;
              break;
          }
      }

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

    const isDraggingSection = dragType === type;

    return (
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <h3 className="font-bold text-lg mb-5 text-gray-800 flex justify-between items-center select-none">
            {title}
            <span className="text-[10px] uppercase text-gray-400 tracking-wider font-bold bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                {categories.length} Total
            </span>
        </h3>
        
        <div 
            className={`space-y-3 mb-6 relative transition-colors ${isDraggingSection ? 'cursor-grabbing' : ''}`}
            onPointerMove={(e) => handlePointerMove(e, type, categories)}
            onPointerUp={() => { setActiveDragIndex(null); setDragType(null); }}
            onPointerLeave={() => { setActiveDragIndex(null); setDragType(null); }}
        >
          {categories.map((cat, index) => {
            const isBeingEdited = editing?.name === cat && editing?.type === type;
            const isDraggingItem = activeDragIndex === index && dragType === type;

            return (
              <div 
                key={cat} 
                className={`flex justify-between items-center border rounded-xl transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] 
                  ${isDraggingItem 
                    ? 'bg-blue-50 border-blue-300 shadow-2xl scale-[1.05] z-50 ring-4 ring-blue-500/10' 
                    : isDraggingSection 
                        ? 'bg-gray-50/50 border-gray-100 opacity-90' 
                        : 'bg-gray-50 border-gray-100'
                  } 
                  ${isBeingEdited ? 'ring-2 ring-blue-500 bg-white border-blue-200 z-10' : ''}
                  select-none
                `}
                style={{ 
                    // Prevent default long-press behaviors and text selection on iOS
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    touchAction: isDraggingSection ? 'none' : 'pan-y'
                }}
              >
                {/* Fixed Drag Handle - Strictly for reordering */}
                <div 
                    className={`w-14 h-14 flex items-center justify-center transition-colors shrink-0 
                        ${isDraggingItem ? 'text-blue-600' : 'text-gray-300 active:text-gray-600'}
                    `}
                    style={{ touchAction: 'none' }}
                    onPointerDown={(e) => {
                        // Crucial for iOS: prevents the system from taking control of the pointer
                        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                        setActiveDragIndex(index);
                        setDragType(type);
                    }}
                >
                  <svg className="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 8h16M4 16h16" />
                  </svg>
                </div>

                <div className="flex-grow min-w-0 py-3 px-1">
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
                    <span className={`text-sm font-bold truncate block transition-colors ${isDraggingItem ? 'text-blue-700' : 'text-gray-700'}`}>
                        {cat}
                    </span>
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
                        className={`w-14 h-14 flex items-center justify-center transition-colors hover:text-blue-600 active:bg-blue-50 ${isDraggingItem ? 'text-blue-300' : 'text-gray-400'}`}
                        aria-label={`Edit ${cat}`}
                        disabled={isDraggingSection}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={() => onDeleteCategory(type, cat)}
                        className={`w-14 h-14 flex items-center justify-center rounded-r-xl transition-colors active:bg-red-50 active:scale-90 ${isDraggingItem ? 'text-red-300' : 'text-red-500'}`}
                        aria-label={`Delete ${cat}`}
                        disabled={isDraggingSection}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.6} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
      <div className="flex items-center mb-6 px-1 select-none">
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
