import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 24, className = "" }) => {
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Modern Shield Base with Gradient */}
        <path 
          d="M12 2L3 6V11.5C3 16.5 6.5 20.5 12 22C17.5 20.5 21 16.5 21 11.5V6L12 2Z" 
          fill="url(#driveSafeGradient)" 
        />
        
        {/* Inner Tech-Folder Icon */}
        <path 
          d="M15.5 11H8.5C7.95 11 7.5 11.45 7.5 12V16C7.5 16.55 7.95 17 8.5 17H15.5C16.05 17 16.5 16.55 16.5 16V12C16.5 11.45 16.05 11 15.5 11Z" 
          fill="white" 
          fillOpacity="0.9"
        />
        <path 
          d="M15.5 10H12.8L11.8 9H8.5C7.95 9 7.5 9.45 7.5 10V11H16.5V11C16.5 10.45 16.05 10 15.5 10Z" 
          fill="white" 
        />
        
        {/* Refraction/Glass effect on shield */}
        <path 
          d="M12 2L3 6V11.5C3 13.5 3.5 15.5 4.5 17.5L12 2Z" 
          fill="white" 
          fillOpacity="0.1"
        />

        <defs>
          <linearGradient id="driveSafeGradient" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366F1" />
            <stop offset="1" stopColor="#3730A3" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export default Logo;
