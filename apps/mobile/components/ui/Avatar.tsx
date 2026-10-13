import { useState, type FC } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  type ImageStyle,
} from 'react-native';
import { theme } from '../../theme';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  src?: string;
  fallback?: string;
  size?: AvatarSize;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export const Avatar: FC<AvatarProps> = ({
  src,
  fallback = 'VM',
  size = 'md',
  style,
  imageStyle,
}) => {
  const [hasError, setHasError] = useState(false);

  const sizeDimensions: Record<AvatarSize, { dim: number; fontSize: number }> = {
    sm: { dim: 32, fontSize: 12 },
    md: { dim: 40, fontSize: 14 },
    lg: { dim: 56, fontSize: 18 },
  };

  const { dim, fontSize } = sizeDimensions[size];

  if (src && !hasError) {
    return (
      <View
        style={[styles.imageContainer, { width: dim, height: dim, borderRadius: dim / 2 }, style]}
      >
        <Image
          source={{ uri: src }}
          onError={() => setHasError(true)}
          style={[styles.image, { width: dim, height: dim, borderRadius: dim / 2 }, imageStyle]}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
        },
        style,
      ]}
    >
      <Text style={[styles.fallbackText, { fontSize }]}>{fallback.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceElevated,
  },
  image: {
    backgroundColor: theme.colors.surfaceElevated,
  },
  fallback: {
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fallbackText: {
    color: theme.colors.foreground,
    fontWeight: '600',
  },
});
