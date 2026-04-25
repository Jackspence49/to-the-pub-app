import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { Stack } from 'expo-router';
import { LogOut, Pencil, Trash2, UserCircle } from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ThemeName = keyof typeof Colors;

type EditForm = {
  full_name: string;
  email: string;
  phone: string;
  new_password: string;
};

type EditErrors = Partial<Record<keyof EditForm | 'global', string>>;

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

const E164_RE = /^\+[1-9]\d{1,14}$/;
const NAME_RE = /^[a-zA-Z\s'\-]{2,100}$/;

export default function AccountScreen() {
  const theme = (useColorScheme() ?? 'dark') as ThemeName;
  const palette = Colors[theme];
  const { user, logout, deleteAccount, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const [editVisible, setEditVisible] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({ full_name: '', email: '', phone: '', new_password: '' });
  const [editErrors, setEditErrors] = useState<EditErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const openEdit = useCallback(() => {
    setEditForm({
      full_name: user?.full_name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      new_password: '',
    });
    setEditErrors({});
    setShowPassword(false);
    setEditVisible(true);
  }, [user]);

  const handleFieldChange = useCallback((field: keyof EditForm, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
    setEditErrors((prev) => ({ ...prev, [field]: undefined, global: undefined }));
  }, []);

  const validate = useCallback((form: EditForm): EditErrors => {
    const errs: EditErrors = {};
    if (form.full_name && !NAME_RE.test(form.full_name)) {
      errs.full_name = 'Name must be 2–100 characters, letters only.';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'Enter a valid email address.';
    }
    if (form.phone && !E164_RE.test(form.phone.trim())) {
      errs.phone = 'Phone must be E.164 format (e.g. +15551234567). Leave blank to clear.';
    }
    return errs;
  }, []);

  const buildPayload = useCallback((form: EditForm) => {
    const payload: Record<string, string | null> = {};

    const trimmedName = form.full_name.trim();
    if (trimmedName !== (user?.full_name ?? '')) payload.full_name = trimmedName;

    const trimmedEmail = form.email.trim();
    if (trimmedEmail !== (user?.email ?? '')) payload.email = trimmedEmail;

    const trimmedPhone = form.phone.trim();
    const originalPhone = user?.phone ?? '';
    if (trimmedPhone !== originalPhone) {
      payload.phone = trimmedPhone === '' ? null : trimmedPhone;
    }

    if (form.new_password) payload.new_password = form.new_password;

    return payload;
  }, [user]);

  const handleSave = useCallback(async () => {
    const errs = validate(editForm);
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }

    const payload = buildPayload(editForm);
    if (Object.keys(payload).length === 0) {
      setEditErrors({ global: 'No changes to save.' });
      return;
    }

    setIsSubmitting(true);
    setEditErrors({});

    try {
      const result = await updateProfile(payload);
      if (!result.success) {
        setEditErrors({ global: result.message ?? 'Update failed. Please try again.' });
        return;
      }
      setEditVisible(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [editForm, validate, buildPayload, updateProfile]);

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
    <>
      <View style={[styles.container, { backgroundColor: palette.background, paddingTop: insets.top + 16 }]}>
        <Stack.Screen
           options={{
             headerTransparent: true,
             headerTitle: '',
             headerBackTitle: '',
             headerBackButtonDisplayMode: 'minimal',
             headerTintColor: palette.cardSurface,
             headerShadowVisible: false,
             headerRight: () => (
               <TouchableOpacity onPress={openEdit} hitSlop={12} style={styles.headerEditButton}>
                 <Pencil size={20} color={palette.iconSelected} />
               </TouchableOpacity>
             ),
            }}
        />

        <View style={styles.avatarSection}>
          <UserCircle size={72} color={palette.iconSelected} strokeWidth={1.25} />
          <Text style={[styles.name, { color: palette.text }]}>{displayName}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.cardSurface, borderColor: palette.border }]}>
          {user?.email ? (
            <>
              <InfoRow label="Email" value={user.email} palette={palette} />
              {(formattedDob || user?.phone) ? <View style={[styles.divider, { backgroundColor: palette.border }]} /> : null}
            </>
          ) : null}
          {user?.phone ? (
            <>
              <InfoRow label="Phone" value={user.phone} palette={palette} />
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
              <ActivityIndicator size="small" color={palette.LogOutText} style={styles.actionIcon} />
            ) : (
              <LogOut size={20} color={palette.LogOutText} style={styles.actionIcon} />
            )}
            <Text style={[styles.actionText, { color: palette.LogOutText}]}>Log Out</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: palette.border }]} />

          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleDeleteAccount}
            disabled={isLoggingOut || isDeletingAccount}
            activeOpacity={0.7}
          >
            {isDeletingAccount ? (
              <ActivityIndicator size="small" color={palette.deleteAccountText} style={styles.actionIcon} />
            ) : (
              <Trash2 size={20} color={palette.deleteAccountText} style={styles.actionIcon} />
            )}
            <Text style={[styles.actionText, { color: palette.deleteAccountText }]}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={editVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditVisible(false)}
      >
        <KeyboardAvoidingView
          style={[styles.modalFlex, { backgroundColor: palette.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalHeader, { borderBottomColor: palette.border }]}>
            <TouchableOpacity onPress={() => setEditVisible(false)} hitSlop={12}>
              <Text style={[styles.modalCancel, { color: palette.iconSelected }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSave} disabled={isSubmitting} hitSlop={12}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color={palette.iconSelected} />
              ) : (
                <Text style={[styles.modalSave, { color: palette.iconSelected }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {editErrors.global ? (
              <View style={[styles.feedbackPanel, { backgroundColor: palette.networkErrorBackground, borderColor: palette.networkErrorBorder }]}>
                <Text style={[styles.feedbackBody, { color: palette.networkErrorText }]}>{editErrors.global}</Text>
              </View>
            ) : null}

            <View style={[styles.formCard, { backgroundColor: palette.cardSurface, borderColor: palette.border }]}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: palette.text }]}>Name</Text>
                <View style={[styles.inputWrapper, { backgroundColor: palette.background, borderColor: editErrors.full_name ? palette.networkErrorText : palette.border }]}>
                  <TextInput
                    value={editForm.full_name}
                    onChangeText={(v) => handleFieldChange('full_name', v)}
                    placeholder="Jane Doe"
                    placeholderTextColor={palette.icon}
                    autoCapitalize="words"
                    autoComplete="name"
                    style={[styles.input, { color: palette.text }]}
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                </View>
                {editErrors.full_name ? <Text style={[styles.errorText, { color: palette.networkErrorText }]}>{editErrors.full_name}</Text> : null}
              </View>

              <View style={[styles.separator, { backgroundColor: palette.border }]} />

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: palette.text }]}>Email</Text>
                <View style={[styles.inputWrapper, { backgroundColor: palette.background, borderColor: editErrors.email ? palette.networkErrorText : palette.border }]}>
                  <TextInput
                    ref={emailRef}
                    value={editForm.email}
                    onChangeText={(v) => handleFieldChange('email', v)}
                    placeholder="you@example.com"
                    placeholderTextColor={palette.icon}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    style={[styles.input, { color: palette.text }]}
                    returnKeyType="next"
                    onSubmitEditing={() => phoneRef.current?.focus()}
                  />
                </View>
                {editErrors.email ? <Text style={[styles.errorText, { color: palette.networkErrorText }]}>{editErrors.email}</Text> : null}
              </View>

              <View style={[styles.separator, { backgroundColor: palette.border }]} />

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: palette.text }]}>Phone</Text>
                <View style={[styles.inputWrapper, { backgroundColor: palette.background, borderColor: editErrors.phone ? palette.networkErrorText : palette.border }]}>
                  <TextInput
                    ref={phoneRef}
                    value={editForm.phone}
                    onChangeText={(v) => handleFieldChange('phone', v)}
                    placeholder="+15551234567 (leave blank to clear)"
                    placeholderTextColor={palette.icon}
                    autoCapitalize="none"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    style={[styles.input, { color: palette.text }]}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                </View>
                {editErrors.phone ? <Text style={[styles.errorText, { color: palette.networkErrorText }]}>{editErrors.phone}</Text> : null}
              </View>

              <View style={[styles.separator, { backgroundColor: palette.border }]} />

              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={[styles.fieldLabel, { color: palette.text }]}>New Password</Text>
                  <TouchableOpacity onPress={() => setShowPassword((p) => !p)}>
                    <Text style={[styles.toggleText, { color: palette.cardSubtitle }]}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.inputWrapper, { backgroundColor: palette.background, borderColor: editErrors.new_password ? palette.networkErrorText : palette.border }]}>
                  <TextInput
                    ref={passwordRef}
                    value={editForm.new_password}
                    onChangeText={(v) => handleFieldChange('new_password', v)}
                    placeholder="Leave blank to keep current"
                    placeholderTextColor={palette.icon}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    style={[styles.input, { color: palette.text }]}
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                  />
                </View>
                {editErrors.new_password ? <Text style={[styles.errorText, { color: palette.networkErrorText }]}>{editErrors.new_password}</Text> : null}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 20,
  },
  headerEditButton: {
    paddingHorizontal: 4,
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
  // Modal
  modalFlex: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalCancel: {
    fontSize: 16,
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalScroll: {
    padding: 24,
    gap: 16,
  },
  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    fontSize: 16,
    paddingVertical: 0,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  feedbackPanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  feedbackBody: {
    fontSize: 14,
    lineHeight: 20,
  },
});
