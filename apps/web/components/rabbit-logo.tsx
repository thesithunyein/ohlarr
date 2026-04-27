export function RabbitLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="rabbitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#14F195" />
        </linearGradient>
        <linearGradient id="earGlow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      {/* Left ear */}
      <path
        d="M18 28C16 18 14 4 20 2C26 0 26 8 26 14L25 28"
        stroke="url(#earGlow)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Left ear inner */}
      <path
        d="M20 24C19 18 18 8 21.5 6C25 4 25 10 24.5 16L24 24"
        fill="rgba(124,58,237,0.15)"
      />
      {/* Right ear */}
      <path
        d="M46 28C48 18 50 4 44 2C38 0 38 8 38 14L39 28"
        stroke="url(#earGlow)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Right ear inner */}
      <path
        d="M44 24C45 18 46 8 42.5 6C39 4 39 10 39.5 16L40 24"
        fill="rgba(124,58,237,0.15)"
      />
      {/* Head */}
      <ellipse
        cx="32"
        cy="38"
        rx="16"
        ry="14"
        fill="url(#rabbitGrad)"
        opacity="0.9"
      />
      {/* Head highlight */}
      <ellipse
        cx="32"
        cy="34"
        rx="12"
        ry="8"
        fill="rgba(255,255,255,0.08)"
      />
      {/* Left eye */}
      <ellipse cx="26" cy="36" rx="2.5" ry="3" fill="#0a0a0f" />
      <ellipse cx="26.8" cy="35" rx="1" ry="1.2" fill="#fff" opacity="0.8" />
      {/* Right eye */}
      <ellipse cx="38" cy="36" rx="2.5" ry="3" fill="#0a0a0f" />
      <ellipse cx="38.8" cy="35" rx="1" ry="1.2" fill="#fff" opacity="0.8" />
      {/* Nose */}
      <ellipse cx="32" cy="42" rx="2" ry="1.5" fill="#0a0a0f" opacity="0.7" />
      {/* Mouth lines */}
      <path
        d="M30 43.5C30 45 32 46.5 32 46.5C32 46.5 34 45 34 43.5"
        stroke="#0a0a0f"
        strokeWidth="0.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* Circuit traces on cheeks — techy feel */}
      <path
        d="M16 38H13M13 38V42"
        stroke="#14F195"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.4"
      />
      <circle cx="13" cy="42" r="1" fill="#14F195" opacity="0.4" />
      <path
        d="M48 38H51M51 38V42"
        stroke="#14F195"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.4"
      />
      <circle cx="51" cy="42" r="1" fill="#14F195" opacity="0.4" />
      {/* Small lock icon on forehead */}
      <rect x="29.5" y="30" width="5" height="4" rx="1" fill="#14F195" opacity="0.5" />
      <path
        d="M30.5 30V28.5C30.5 27.5 31.2 27 32 27C32.8 27 33.5 27.5 33.5 28.5V30"
        stroke="#14F195"
        strokeWidth="0.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </svg>
  );
}

export function RabbitIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="miniGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#14F195" />
        </linearGradient>
      </defs>
      <path
        d="M7 11C6.2 7 5.5 2 8 1.5C10.5 1 10 4 10 6.5V11"
        stroke="url(#miniGrad)" strokeWidth="1.5" strokeLinecap="round" fill="none"
      />
      <path
        d="M17 11C17.8 7 18.5 2 16 1.5C13.5 1 14 4 14 6.5V11"
        stroke="url(#miniGrad)" strokeWidth="1.5" strokeLinecap="round" fill="none"
      />
      <ellipse cx="12" cy="15" rx="6" ry="5.5" fill="url(#miniGrad)" opacity="0.9" />
      <circle cx="10" cy="14.5" r="1" fill="#0a0a0f" />
      <circle cx="14" cy="14.5" r="1" fill="#0a0a0f" />
      <ellipse cx="12" cy="17" rx="0.8" ry="0.5" fill="#0a0a0f" opacity="0.6" />
    </svg>
  );
}
