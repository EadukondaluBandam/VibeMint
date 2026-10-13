import { useState, type FC, type ImgHTMLAttributes } from 'react';
import { colors, radius, fontWeights } from '@vibemint/design-tokens';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'size'> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: AvatarSize;
}

export const Avatar: FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  fallback = 'VM',
  size = 'md',
  style,
  ...props
}) => {
  const [hasError, setHasError] = useState(false);

  const dimensionStyles: Record<AvatarSize, { size: string; fontSize: string }> = {
    sm: { size: '32px', fontSize: '0.75rem' },
    md: { size: '40px', fontSize: '0.875rem' },
    lg: { size: '56px', fontSize: '1.25rem' },
  };

  const { size: dim, fontSize } = dimensionStyles[size];

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setHasError(true)}
        style={{
          width: dim,
          height: dim,
          borderRadius: radius.full,
          objectFit: 'cover',
          ...style,
        }}
        {...props}
      />
    );
  }

  return (
    <div
      aria-label={alt}
      role="img"
      style={{
        width: dim,
        height: dim,
        borderRadius: radius.full,
        backgroundColor: colors.dark.surfaceElevated,
        color: colors.dark.foreground,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: fontWeights.semiBold,
        fontSize,
        userSelect: 'none',
        border: `1px solid ${colors.dark.border}`,
        ...style,
      }}
    >
      {fallback.slice(0, 2).toUpperCase()}
    </div>
  );
};
