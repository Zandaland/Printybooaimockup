
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  isSelected?: boolean;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick, isSelected = false }) => {
  const selectedClasses = isSelected ? 'border-lime-400 bg-lime-100' : 'border-zinc-900';
  const cursorClass = onClick ? 'cursor-pointer' : '';

  return (
    <div
      className={`bg-white border-2 ${selectedClasses} rounded-none p-6 transition-all duration-200 ${cursorClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;