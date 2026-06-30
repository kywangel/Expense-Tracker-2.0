
import React from 'react';
import { AppView } from '../types';
import { Home, PieChart, Plus, Database, Repeat } from 'lucide-react';

interface NavigationProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentView, onChangeView }) => {
  const navItems = [
    { id: AppView.DASHBOARD, label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: AppView.STATISTICS, label: 'Stats', icon: <PieChart className="w-5 h-5" /> },
    { id: AppView.ADD_TRANSACTION, label: 'Add', icon: (
      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
        <Plus className="w-6 h-6 stroke-[3]" />
      </div>
    ), isMain: true},
    { id: AppView.DATABASE, label: 'Data', icon: <Database className="w-5 h-5" /> },
    { id: AppView.RECURRING, label: 'Recurring', icon: <Repeat className="w-5 h-5" /> },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-md z-50">
      <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-2 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-white/40 ring-1 ring-black/5">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          
          if (item.isMain) {
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className="flex-1 flex justify-center items-center active:scale-90 transition-transform duration-200"
              >
                {item.icon}
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`flex-1 relative flex flex-col items-center justify-center py-2 transition-all duration-300 group`}
            >
              {/* Active Background Bubble */}
              {isActive && (
                <div className="absolute inset-x-1 inset-y-0.5 bg-gray-100 rounded-[1.8rem] -z-10 animate-fade-in" />
              )}
              
              <div className={`transition-colors duration-300 ${isActive ? 'text-blue-600' : 'text-gray-400 group-active:text-gray-600'}`}>
                {item.icon}
              </div>
              
              <span className={`text-[10px] font-medium mt-0.5 transition-colors duration-300 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Navigation;
