import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

const Logo: React.FC<LogoProps> = ({ className = "w-5 h-5", size = 20 }) => {
  return (
    <img 
      src="/logo.png" 
      alt="DriveSafe Logo" 
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
      onError={(e) => {
        // Fallback to a placeholder or icon if image fails to load
        const target = e.target as HTMLImageElement;
        target.onerror = null; 
        target.src = "https://img.icons8.com/ios-filled/50/ffffff/database.png";
      }}
    />
  );
};

export default Logo;
