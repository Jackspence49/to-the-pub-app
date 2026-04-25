import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { Stack } from 'expo-router';
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

function formatDob(dob: string): string {
  const datePart = dob.split('T')[0];
  const [year, month, day] = datePart.split('-');
  return `${month}/${day}/${year}`;
}

function InfoRow({ label, value, palette }: { label: string; value: string; palette: (typeof Colors)[ThemeName] }) {
  return (
    <View style={infoStyles.row}>
      <Text style={[infoStyles.label, { color: palette.cardSubtitle }]}>{label}</Text>
      <Text style={[infoStyles.value, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  value: {
    fontSize: 15,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
});

export default function AccountScreen() {
  const theme = (useColorScheme() ?? 'dark') as ThemeName;
  const palette = Colors[theme];
  const { user, logout, deleteAccount } = useAuth();
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
  const formattedDob = user?.dob ? formatDob(user.dob) : null;

  return (
    <View style={[styles.container, { backgroundColor: palette.background, paddingTop: insets.top + 16 }]}>
      <Stack.Screen options={{ headerBackTitle: '' }} />
      <View style={styles.avatarSection}>
        <UserCircle size={72} color={palette.iconSelected} strokeWidth={1.25} />
        <Text style={[styles.name, { color: palette.text }]}>{displayName}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: palette.cardSurface, borderColor: palette.border }]}>
        {user?.email ? (
          <>
            <InfoRow label="Email" value={user.email} palette={palette} />
            {formattedDob ? <View style={[styles.divider, { backgroundColor: palette.border }]} /> : null}
          </>
        ) : null}
        {formattedDob ? (
          <InfoRow label="Date of Birth" value={formattedDob} palette={palette} />
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: palette.cardSurface, borderColor: palette.border }]}>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleLogout}
          disabled={isLoggingOut || isDeletingAccount}
          activeOpacity={0.7}
        >
          {isLoggingOut ? (
            <ActivityIndicator size="small" color={palette.networkErrorText} style={styles.actionIcon} />
          ) : (
            <LogOut size={20} color={palette.networkErrorText} style={styles.actionIcon} />
          )}
          <Text style={[styles.actionText, { color: palette.networkErrorText }]}>Log Out</Text>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: palette.border }]} />

        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleDeleteAccount}
          disabled={isLoggingOut || isDeletingAccount}
          activeOpacity={0.7}
        >
          {isDeletingAccount ? (
            <ActivityIndicator size="small" color={palette.networkErrorText} style={styles.actionIcon} />
          ) : (
            <Trash2 size={20} color={palette.networkErrorText} style={styles.actionIcon} />
          )}
          <Text style={[styles.actionText, { color: palette.networkErrorText }]}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 20,
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
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 14,
  },
  actionIcon: {
    width: 20,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
