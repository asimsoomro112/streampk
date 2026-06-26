import React from 'react';
import { motion } from 'motion/react';

export default function LoadingScreen() {
  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[100] bg-[#050505] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-[#00D2FF]/15 rounded-full blur-[100px] pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-1000">
        {/* Logo Spinner */}
        <div className="w-24 h-24 mb-8 relative">
          <div className="absolute inset-0 border-4 border-white/5 rounded-2xl"></div>
          <div className="absolute inset-0 border-4 border-[#00D2FF] rounded-2xl border-t-transparent animate-spin" style={{ animationDuration: '1.5s' }}></div>
          <div className="absolute inset-1 flex items-center justify-center bg-gradient-to-tr from-[#00D2FF] to-[#0082FF] rounded-xl shadow-[0_0_40px_rgba(0,210,255,0.4)]">
            <span className="font-black text-white text-4xl">S</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-8 text-white drop-shadow-lg">
          Stream<span className="text-[#00D2FF]">PK</span>
        </h1>

        {/* Loading text with pulse */}
        <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl">
          <div className="w-2 h-2 bg-[#00D2FF] rounded-full animate-pulse shadow-[0_0_10px_rgba(0,210,255,1)]"></div>
          <span className="text-xs font-bold text-slate-300 tracking-[0.2em] uppercase">
            Initializing Live Streams
          </span>
        </div>
      </div>
    </motion.div>
  );
}
