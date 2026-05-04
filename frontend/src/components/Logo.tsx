import React from 'react';
import { Database } from 'lucide-react';

interface LogoProps {
  size?: number;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 24, className = "" }) => {
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <Database 
        size={size} 
        className="text-indigo-600" 
        strokeWidth={2.5}
      />
    </div>
  );
};

export default Logo;
