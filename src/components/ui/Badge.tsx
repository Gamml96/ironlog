import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success';
}

export const Badge = ({ children, variant = 'primary' }: BadgeProps) => (
  <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
    variant === 'primary' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' :
    variant === 'secondary' ? 'bg-white/5 text-muted border border-white/10' :
    'bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/20'
  }`}>
    {children}
  </div>
);
