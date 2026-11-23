import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../theme';

type Props = { title: string; icon: ComponentProps<typeof Ionicons>['name']; onPress: () => void };

// Recurso PULSE: o botão principal cresce e volta em loop para chamar a atenção.
export function PulseButton({ title, icon, onPress }: Props) {
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.06, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8} accessibilityRole="button">
        <Ionicons name={icon} size={22} color="#fff" />
        <Text style={styles.text}>{title}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 30 },
  text: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
