
import React from 'react';
import { AppView } from '../types';

interface NavigationProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentView, onChangeView }) => {
  const navItems = [
    { id: AppView.DASHBOARD, label: 'Home', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
    )},
    { id: AppView.STATISTICS, label: 'Stats', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
    )},
    { id: AppView.ADD_TRANSACTION, label: 'Add', icon: (
      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
      </div>
    ), isMain: true},
    { id: AppView.DATABASE, label: 'Data', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3zM9 4v16M15 4v16M4 10h16M4 15h16" /></svg>
    )},
    { id: AppView.AI_TOOLS, label: 'Analysis', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    )},
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
