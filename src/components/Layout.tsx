import React, { useEffect } from 'react';
import { Link, Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, Globe2, Search, Heart, Tv } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../store/useAppStore';
import LoadingScreen from './LoadingScreen';
import { AnimatePresence } from 'motion/react';

export default function Layout() {
  const { loadChannels, isLoading, pkChannels, channels } = useAppStore();
  const location = useLocation();

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const isInitialLoading = isLoading && pkChannels.length === 0 && channels.length === 0;

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/countries', icon: Globe2, label: 'Countries' },
    { path: '/search', icon: Search, label: 'Search' },
    { path: '/favorites', icon: Heart, label: 'Favorites' },
  ];

  const categoryLinks = [
    { label: 'Trending', to: '/?category=All', category: 'All' },
    { label: 'Sports', to: '/?category=Sports', category: 'Sports' },
    { label: 'News', to: '/?category=News', category: 'News' },
  ];

  const currentCategory = new URLSearchParams(location.search).get('category') || 'All';

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-[#050505] text-slate-100 font-sans overflow-hidden select-none">
      
      <AnimatePresence>
        {isInitialLoading && <LoadingScreen />}
      </AnimatePresence>

      {/* Navigation Sidebar (TV Rail Style) */}
      <nav className="hidden md:flex flex-col w-24 h-full bg-[#0A0A0A] border-r border-white/5 items-center py-8 space-y-12 shadow-2xl z-20 shrink-0">
        <div className="w-12 h-12 bg-gradient-to-tr from-[#00D2FF] to-[#0082FF] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(0,210,255,0.4)] shrink-0">
          <span className="font-black text-white text-xl">S</span>
        </div>
        
        <div className="flex flex-col space-y-8">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={item.label}
              className={({ isActive }) => clsx(
                "p-3 rounded-2xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#00D2FF]",
                isActive 
                  ? "bg-white/10 text-[#00D2FF] shadow-inner" 
                  : "text-slate-500 hover:text-white"
              )}
            >
              <item.icon className="w-6 h-6" strokeWidth={2} />
            </NavLink>
          ))}
        </div>
        
        <div className="mt-auto">
          <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 overflow-hidden">
            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-500"></div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#050505]">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-[#0A0A0A] sticky top-0 z-10 border-b border-white/5">
          <div className="flex items-center gap-2 text-[#00D2FF]">
            <Tv className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tighter">Stream<span className="text-white">Pk</span></h1>
          </div>
        </header>

        {/* Global Desktop Header (optional, adds top spacing) */}
        <header className="hidden md:flex h-20 px-10 items-center justify-between shrink-0">
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-bold tracking-tighter">Stream<span className="text-[#00D2FF]">Pk</span></h1>
            <span className="px-2 py-0.5 bg-red-600 text-[10px] font-black rounded uppercase tracking-wider">Live</span>
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex space-x-2">
              {categoryLinks.map((item) => {
                const isActive = location.pathname === '/' && currentCategory.toLowerCase() === item.category.toLowerCase();

                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={clsx(
                      "px-4 py-2 rounded-full text-xs border transition-colors focus:outline-none focus:ring-2 focus:ring-[#00D2FF]",
                      isActive
                        ? "bg-[#00D2FF]/20 text-[#00D2FF] font-bold border-[#00D2FF]/30"
                        : "bg-white/5 text-slate-300 font-medium border-white/10 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-20 md:pb-8 hide-scrollbar">
          <Outlet />
        </div>
      </main>

      {/* Bottom Nav for Mobile */}
      <nav className="md:hidden fixed bottom-0 w-full bg-[#0A0A0A] border-t border-white/5 z-50 px-2 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => clsx(
                "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors focus:outline-none",
                isActive ? "text-[#00D2FF]" : "text-slate-500 hover:text-white"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
