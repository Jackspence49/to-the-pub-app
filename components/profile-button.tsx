import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'expo-router';
import { UserCircle } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';

export function ProfileButton() {
  const theme = useColorScheme() ?? 'dark';
  const palette = Colors[theme];
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const handlePress = () => {
    if (isAuthenticated) {
      router.push('/account');
    } else {
      router.push('/login');
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.button} hitSlop={8} accessibilityRole="button" accessibilityLabel="Account">
      <UserCircle size={28} color={palette.icon} strokeWidth={1.5} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    marginRight: 16,
  },
});
