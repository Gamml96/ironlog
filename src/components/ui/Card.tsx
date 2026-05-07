import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  onClick?: any;
  borderAccent?: boolean;
  key?: React.Key;
}

export const Card = ({ children, className = "", onClick, borderAccent, ...props }: CardProps) => (
  <div 
    onClick={onClick}
    className={`bg-bg-card border-white/5 rounded-[24px] p-6 ${borderAccent ? 'border-l-4 border-l-brand-primary' : 'border'} ${className} ${onClick ? 'active:bg-white/5 transition-colors cursor-pointer shadow-xl' : ''}`}
    {...props}
  >
    {children}
  </div>
);
