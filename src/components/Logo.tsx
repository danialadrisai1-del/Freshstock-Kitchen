import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = "", size = 48 }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Rounded background */}
        <rect
          width="100"
          height="100"
          rx="24"
          fill="url(#brandGradient)"
        />
        
        {/* Stylized Grocery Bag / Basket */}
        <path
          d="M30 45V75C30 77.7614 32.2386 80 35 80H65C67.7614 80 70 77.7614 70 75V45"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M25 45H75L71.5 35H28.5L25 45Z"
          fill="white"
        />
        
        {/* Leaf Accent */}
        <path
          d="M50 35C50 35 62 25 65 35C65 45 50 45 50 45C50 45 35 45 35 35C38 25 50 35 50 35Z"
          fill="#D1FAE5" // brand-light
          stroke="white"
          strokeWidth="2"
        />

        <defs>
          <linearGradient
            id="brandGradient"
            x1="0"
            y1="0"
            x2="100"
            y2="100"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#10B981" /> {/* brand */}
            <stop offset="1" stopColor="#059669" /> {/* brand-dark */}
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};
