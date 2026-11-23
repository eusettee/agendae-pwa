import { useState } from 'react';
import { Animated } from 'react-native';

// Recurso SHAKE: balança um componente para indicar erro (ex.: mensagem vazia).
export function useShake() {
  const [offset] = useState(() => new Animated.Value(0));

  const shake = () => {
    Animated.sequence(
      [10, -10, 8, -8, 0].map((toValue) => Animated.timing(offset, { toValue, duration: 60, useNativeDriver: true })),
    ).start();
  };

  return { shake, shakeStyle: { transform: [{ translateX: offset }] } };
}
