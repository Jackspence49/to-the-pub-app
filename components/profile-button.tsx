import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { UserCircle } from 'lucide-react-native';
import React from 'react';
import { Alert, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';

export function ProfileButton() {
  const theme = useColorScheme() ?? 'dark';
  const palette = Colors[theme];
  const { logout, deleteAccount } = useAuth();

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This cannot be undone.',
      [
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAccount();
            if (!result.success) {
              Alert.alert('Error', result.message ?? 'Something went wrong. Please try again.');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handlePress = () => {
    Alert.alert(
      'Account',
      'What would you like to do?',
      [
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: logout,
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
    );
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
