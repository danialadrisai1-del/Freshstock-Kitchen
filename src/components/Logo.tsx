import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = "", size = 48 }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
      >
        {/* Premium Superellipse Background */}
        <rect width="120" height="120" rx="34" fill="url(#primaryGradient)" />
        
        {/* Background Stack / Open Box Flap */}
        <rect x="34" y="36" width="52" height="30" rx="10" fill="#FFD0C2" />
        
        {/* Foreground Box Base */}
        <rect x="24" y="52" width="72" height="46" rx="14" fill="white" />
        
        {/* Inside dashboard details (lines to signify inventory list) */}
        <rect x="40" y="68" width="24" height="8" rx="4" fill="#FF4713" opacity="0.12" />
        <rect x="40" y="80" width="40" height="8" rx="4" fill="#FF4713" opacity="0.12" />
        
        {/* Fresh Produce popping out (Orange / Fruit Abstract) */}
        <circle cx="60" cy="50" r="16" fill="#FF4713" stroke="white" strokeWidth="6" />
        
        {/* Fresh Leaf on top of the fruit */}
        <path 
          d="M 58 32 C 58 20 74 18 74 18 C 74 18 74 28 64 34 Z" 
          fill="white" 
        />

        <defs>
          <linearGradient
            id="primaryGradient"
            x1="0"
            y1="0"
            x2="120"
            y2="120"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#FF7A4D" />
            <stop offset="1" stopColor="#D82900" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};
