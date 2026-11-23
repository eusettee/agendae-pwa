import { ReactNode, useEffect, useState } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

// Recurso FADE: o conteúdo aparece suavemente (opacidade 0 → 1) e sobe alguns pixels.
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }).start();
  }, [opacity, delay]);

  const translateY = opacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
