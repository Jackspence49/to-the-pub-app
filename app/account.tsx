import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'expo-router';
import { LogOut, Trash2, UserCircle } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ThemeName = keyof typeof Colors;

export default function AccountScreen() {
  const theme = (useColorScheme() ?? 'dark') as ThemeName;
  const palette = Colors[theme];
  const { user, logout, deleteAccount } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This cannot be undone.',
      [
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingAccount(true);
            const result = await deleteAccount();
            setIsDeletingAccount(false);
            if (!result.success) {
              Alert.alert('Error', result.message ?? 'Something went wrong. Please try again.');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const displayName = user?.full_name ?? user?.email ?? 'Your Account';
  const displayEmail = user?.email;

  return (
    <View style={[styles.container, { backgroundColor: palette.background, paddingTop: insets.top + 16 }]}>
      <View style={styles.avatarSection}>
        <UserCircle size={72} color={palette.iconSelected} strokeWidth={1.25} />
        <Text style={[styles.name, { color: palette.text }]}>{displayName}</Text>
        {displayEmail ? (
          <Text style={[styles.email, { color: palette.cardSubtitle }]}>{displayEmail}</Text>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: palette.cardSurface, borderColor: palette.border }]}>
        <TouchableOpacity
          style={styles.row}
          onPress={handleLogout}
          disabled={isLoggingOut || isDeletingAccount}
          activeOpacity={0.7}
        >
          {isLoggingOut ? (
            <ActivityIndicator size="small" color={palette.networkErrorText} style={styles.rowIcon} />
          ) : (
            <LogOut size={20} color={palette.networkErrorText} style={styles.rowIcon} />
          )}
          <Text style={[styles.rowText, { color: palette.networkErrorText }]}>Log Out</Text>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: palette.border }]} />

        <TouchableOpacity
          style={styles.row}
          onPress={handleDeleteAccount}
          disabled={isLoggingOut || isDeletingAccount}
          activeOpacity={0.7}
        >
          {isDeletingAccount ? (
            <ActivityIndicator size="small" color={palette.networkErrorText} style={styles.rowIcon} />
          ) : (
            <Trash2 size={20} color={palette.networkErrorText} style={styles.rowIcon} />
          )}
          <Text style={[styles.rowText, { color: palette.networkErrorText }]}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 28,
  },
  avatarSection: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 24,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
  },
  email: {
    fontSize: 15,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 14,
  },
  rowIcon: {
    width: 20,
  },
  rowText: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 54,
  },
});
