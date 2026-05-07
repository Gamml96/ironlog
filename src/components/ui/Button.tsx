import React from 'react';
import { Dumbbell } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  loadingText?: string;
  children?: React.ReactNode;
  className?: string;
  onClick?: any;
  disabled?: boolean;
}

export const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  loading = false,
  loadingText,
  disabled,
  ...props 
}: ButtonProps) => {
  const base = "inline-flex items-center justify-center font-display font-black uppercase transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 tracking-wider gap-2";
  const variants = {
    primary: "bg-brand-primary text-black hover:bg-brand-primary/90 shadow-[0_4px_20px_rgba(255,94,26,0.3)]",
    secondary: "bg-bg-card text-white hover:bg-white/10 border border-white/10",
    ghost: "bg-transparent text-white hover:bg-white/5",
    danger: "bg-red-600/20 text-red-500 hover:bg-red-600/30 border border-red-500/20",
  };
  const sizes = {
    sm: "h-9 px-4 text-xs rounded-xl",
    md: "h-12 px-6 text-sm rounded-2xl",
    lg: "h-14 px-8 text-base rounded-2xl",
    icon: "h-12 w-12 rounded-2xl flex-shrink-0",
  };
  
  return (
    <button 
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} 
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Dumbbell className="w-5 h-5 animate-spin" />
          {loadingText && <span className="ml-2">{loadingText}</span>}
        </>
      ) : (
        children
      )}
    </button>
  );
};
