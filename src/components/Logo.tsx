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
        className="w-full h-full drop-shadow-sm"
      >
        {/* Background rounded squircle */}
        <path 
          d="M60 0 C 120 0 120 120 60 120 C 0 120 0 0 60 0 Z" 
          fill="url(#brandGradient2)"
        />
        
        {/* Modern Pantry / Basket Abstraction */}
        <path d="M35 50 C 35 45 40 40 45 40 H 75 C 80 40 85 45 85 50 V 80 C 85 85 80 90 75 90 H 45 C 40 90 35 85 35 80 V 50 Z" fill="white" />
        
        {/* Inner geometric accent (like an item in the box) */}
        <circle cx="50" cy="55" r="5" fill="#10B981" />
        <rect x="60" y="50" width="10" height="25" rx="5" fill="#34D399" />
        
        {/* Sweeping Leaf across the top */}
        <path 
          d="M 60 40 C 60 20 85 20 85 20 C 85 20 85 45 65 45 M 65 45 C 55 45 50 40 60 40 Z" 
          fill="#D1FAE5"
          className="origin-center"
        />

        <defs>
          <linearGradient
            id="brandGradient2"
            x1="10"
            y1="10"
            x2="110"
            y2="110"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#059669" /> {/* text-emerald-600 */}
            <stop offset="1" stopColor="#022C22" /> {/* text-emerald-950 */}
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};
