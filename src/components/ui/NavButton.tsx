import React from 'react';

interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

export function NavButton({ icon, label, active, onClick }: NavButtonProps) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 px-4 h-full relative transition-all duration-300 ${active ? 'text-brand-primary' : 'text-muted hover:text-white/60'}`}
    >
      <div className={`transition-transform duration-300 ${active ? 'scale-110 -translate-y-1' : ''}`}>
        {React.cloneElement(icon as React.ReactElement, { size: active ? 24 : 20, strokeWidth: active ? 3 : 2 })}
      </div>
      <span className={`text-[9px] font-black uppercase tracking-widest transition-all ${active ? 'opacity-100' : 'opacity-40'}`}>{label}</span>
      {active && (
        <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-10 h-1 bg-brand-primary rounded-b-full shadow-[0_0_15px_rgba(255,94,26,0.5)]" />
      )}
    </button>
  );
}
