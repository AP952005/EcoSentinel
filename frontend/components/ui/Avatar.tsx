'use client';
import Image from 'next/image';
import { AVATAR_ASSETS, AvatarState } from '@/lib/avatars';

interface AvatarProps {
  state: AvatarState;
  size?: number;
  className?: string;
  alt?: string;
}

export function Avatar({ state, size = 120, className = '', alt }: AvatarProps) {
  const src = AVATAR_ASSETS[state];
  const label = alt || `EcoSentinel assistant — ${state} pose`;

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={label}
        width={size}
        height={size}
        className="eco-avatar w-full h-full"
        style={{ objectFit: 'contain' }}
        priority
        onError={(e) => {
          // Graceful fallback if asset missing
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );
}
