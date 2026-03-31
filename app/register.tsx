import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { NORMALIZED_BASE_URL, REGISTER_ENDPOINT } from '@/utils/constants';

type ThemeName = keyof typeof Colors;
type FormField = 'fullName' | 'email' | 'password' | 'dob' | 'phone';

type FormErrors = Partial<Record<FormField | 'global', string>>;

type RegisterPayload = {
  fullName: string;
  email: string;
  password: string;
  dob: string;
  phone: string;
};


const initialFormState: RegisterPayload = {
  fullName: '',
  email: '',
  password: '',
  dob: '',
  phone: '',
};

// Accepts MM-DD-YYYY, returns YYYY-MM-DD or null if invalid
function toIsoDate(mmddyyyy: string): string | null {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(mmddyyyy)) return null;
  const [mm, dd, yyyy] = mmddyyyy.split('-');
  const iso = `${yyyy}-${mm}-${dd}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  // Guard against month/day overflow (e.g. 13-01-2000)
  if (d.getUTCFullYear() !== Number(yyyy) || d.getUTCMonth() + 1 !== Number(mm) || d.getUTCDate() !== Number(dd)) return null;
  return iso;
}

function isAtLeast21(isoDate: string): boolean {
  const dob = new Date(isoDate);
  if (isNaN(dob.getTime())) return false;
  const today = new Date();
  const age = today.getFullYear() - dob.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  return age > 21 || (age === 21 && hasBirthdayPassed);
}

// Auto-inserts dashes: "1203" → "12-03-", "12031998" → "12-03-1998"
function formatDobInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

// Auto-inserts dashes for US numbers. International numbers (starting with +) are left as-is.
function formatPhoneInput(raw: string): string {
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// If already E.164, send as-is. Otherwise treat as 10-digit US number and prepend +1.
function toE164Phone(formatted: string): string {
  if (formatted.startsWith('+')) return formatted.replace(/[^\d+]/g, '');
  return `+1${formatted.replace(/\D/g, '')}`;
}

export default function RegisterScreen() {
  const router = useRouter();
  const { loginWithToken } = useAuth();
  const theme = (useColorScheme() ?? 'dark') as ThemeName;
  const palette = Colors[theme];

  const [form, setForm] = useState<RegisterPayload>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const formCardY = useRef(0);
  const fieldGroupY = useRef<Partial<Record<FormField, number>>>({});

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const dobRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  const scrollToField = (field: FormField) => {
    const y = (fieldGroupY.current[field] ?? 0) + formCardY.current;
    scrollViewRef.current?.scrollTo({ y: y - 120, animated: true });
  };

  const handleFieldChange = useCallback((field: FormField, value: string) => {
    const coerced = field === 'dob' ? formatDobInput(value) : field === 'phone' ? formatPhoneInput(value) : value;
    setForm((previous) => ({ ...previous, [field]: coerced }));
    setErrors((current) => ({ ...current, [field]: undefined, global: undefined }));
  }, []);

  const validate = useCallback((payload: RegisterPayload): FormErrors => {
    const nextErrors: FormErrors = {};

    if (!payload.fullName.trim()) {
      nextErrors.fullName = 'Add the name people will see.';
    }

    const emailCandidate = payload.email.trim();
    if (!emailCandidate) {
      nextErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidate)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!payload.password) {
      nextErrors.password = 'Create a password.';
    } else if (payload.password.length < 12) {
      nextErrors.password = 'Use at least 12 characters.';
    } else if (!/[a-z]/.test(payload.password)) {
      nextErrors.password = 'Include at least one lowercase letter.';
    } else if (!/[A-Z]/.test(payload.password)) {
      nextErrors.password = 'Include at least one uppercase letter.';
    } else if (!/[0-9]/.test(payload.password)) {
      nextErrors.password = 'Include at least one number.';
    } else if (!/[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?]/.test(payload.password)) {
      nextErrors.password = 'Include at least one special character (e.g. !@#$%).';
    }

    const dobCandidate = payload.dob.trim();
    if (!dobCandidate) {
      nextErrors.dob = 'Date of birth is required.';
    } else {
      const iso = toIsoDate(dobCandidate);
      if (!iso) {
        nextErrors.dob = 'Enter a valid date (MM-DD-YYYY).';
      } else if (!isAtLeast21(iso)) {
        nextErrors.dob = 'You must be at least 21 years old to register.';
      }
    }

    const phoneCandidate = payload.phone.trim();
    if (!phoneCandidate) {
      nextErrors.phone = 'Phone number is required.';
    } else if (phoneCandidate.startsWith('+')) {
      if (!/^\+[1-9]\d{1,14}$/.test(phoneCandidate.replace(/[^\d+]/g, ''))) {
        nextErrors.phone = 'Enter a valid international number (e.g. +14155552671).';
      }
    } else if (phoneCandidate.replace(/\D/g, '').length !== 10) {
      nextErrors.phone = 'Enter a 10-digit US number (e.g. 555-123-4567).';
    }

    return nextErrors;
  }, []);

  const handleSubmit = useCallback(async () => {
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    if (!NORMALIZED_BASE_URL) {
      setErrors({ global: 'Set EXPO_PUBLIC_API_URL to register new accounts.' });
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const body: Record<string, string> = {
        full_name: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        dob: toIsoDate(form.dob.trim())!,
        phone: toE164Phone(form.phone),
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      let response;
      try {
        response = await fetch(REGISTER_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const message = payload?.message ?? 'We could not create your account right now.';
        setErrors({ global: message });
        return;
      }

      // Registration succeeded — sign in with the returned token
      if (!payload?.token) {
        setErrors({ global: 'Registration succeeded but sign-in failed. Please log in.' });
        return;
      }
      await loginWithToken(payload.token, payload.data ?? null);
      router.replace('/(tabs)');
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        setErrors({ global: 'The request timed out. Please check your connection and try again.' });
      } else {
        setErrors({ global: 'Unable to reach the server. Please try again.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [form, validate, loginWithToken, router]);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: palette.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[styles.scrollContent, { backgroundColor: palette.background }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.heroTitle, { color: palette.text }]}>Join To The Pub</Text>

        <View style={[styles.formCard, { backgroundColor: palette.cardSurface, borderColor: palette.border }]} onLayout={(e) => { formCardY.current = e.nativeEvent.layout.y; }}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Your Info</Text>

          {/* Full name */}
          <View style={styles.fieldGroup} onLayout={(e) => { fieldGroupY.current.fullName = e.nativeEvent.layout.y; }}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: palette.text }]}>Full name</Text>
            </View>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: palette.background, borderColor: errors.fullName ? palette.networkErrorText : palette.border },
              ]}
            >
              <FontAwesome name="user" size={16} color={palette.cardSubtitle} style={styles.inputIcon} />
              <TextInput
                value={form.fullName}
                onChangeText={(value) => handleFieldChange('fullName', value)}
                placeholder="John Smith"
                placeholderTextColor={palette.icon}
                autoCapitalize="words"
                autoComplete="name"
                style={[styles.input, { color: palette.text }]}
                returnKeyType="next"
                onSubmitEditing={() => { emailRef.current?.focus(); scrollToField('email'); }}
                submitBehavior="submit"
              />
            </View>
            {errors.fullName ? <Text style={[styles.errorText, { color: palette.networkErrorText }]}>{errors.fullName}</Text> : null}
          </View>

          {/* Email */}
          <View style={styles.fieldGroup} onLayout={(e) => { fieldGroupY.current.email = e.nativeEvent.layout.y; }}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: palette.text }]}>Email</Text>
            </View>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: palette.background, borderColor: errors.email ? palette.networkErrorText : palette.border },
              ]}
            >
              <FontAwesome name="envelope" size={16} color={palette.cardSubtitle} style={styles.inputIcon} />
              <TextInput
                ref={emailRef}
                value={form.email}
                onChangeText={(value) => handleFieldChange('email', value)}
                placeholder="john.smith@example.com"
                placeholderTextColor={palette.icon}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                style={[styles.input, { color: palette.text }]}
                returnKeyType="next"
                onSubmitEditing={() => { passwordRef.current?.focus(); scrollToField('password'); }}
                submitBehavior="submit"
              />
            </View>
            {errors.email ? <Text style={[styles.errorText, { color: palette.networkErrorText }]}>{errors.email}</Text> : null}
          </View>

          {/* Password */}
          <View style={styles.fieldGroup} onLayout={(e) => { fieldGroupY.current.password = e.nativeEvent.layout.y; }}>
            <Text style={[styles.label, { color: palette.text }]}>Password</Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: palette.background, borderColor: errors.password ? palette.networkErrorText : palette.border },
              ]}
            >
              <FontAwesome name="lock" size={16} color={palette.cardSubtitle} style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                value={form.password}
                onChangeText={(value) => handleFieldChange('password', value)}
                placeholder="••••••••••••"
                placeholderTextColor={palette.icon}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password-new"
                style={[styles.input, { color: palette.text }]}
                returnKeyType="next"
                onSubmitEditing={() => { dobRef.current?.focus(); scrollToField('dob'); }}
                submitBehavior="submit"
              />
              <TouchableOpacity onPress={() => setShowPassword((current) => !current)}>
                <Text style={[styles.togglePassword, { color: palette.cardSubtitle }]}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={[styles.errorText, { color: palette.networkErrorText }]}>{errors.password}</Text> : null}
          </View>

          {/* Date of birth */}
          <View style={styles.fieldGroup} onLayout={(e) => { fieldGroupY.current.dob = e.nativeEvent.layout.y; }}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: palette.text }]}>Date of birth</Text>
              <Text style={[styles.helperText, { color: palette.cardSubtitle }]}>Must be 21+</Text>
            </View>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: palette.background, borderColor: errors.dob ? palette.networkErrorText : palette.border },
              ]}
            >
              <FontAwesome name="calendar" size={16} color={palette.cardSubtitle} style={styles.inputIcon} />
              <TextInput
                ref={dobRef}
                value={form.dob}
                onChangeText={(value) => handleFieldChange('dob', value)}
                placeholder="MM-DD-YYYY"
                placeholderTextColor={palette.icon}
                keyboardType="number-pad"
                autoCapitalize="none"
                style={[styles.input, { color: palette.text }]}
                returnKeyType="next"
                maxLength={10}
                onSubmitEditing={() => { phoneRef.current?.focus(); scrollToField('phone'); }}
                submitBehavior="submit"
              />
            </View>
            {errors.dob ? <Text style={[styles.errorText, { color: palette.networkErrorText }]}>{errors.dob}</Text> : null}
          </View>

          {/* Phone */}
          <View style={styles.fieldGroup} onLayout={(e) => { fieldGroupY.current.phone = e.nativeEvent.layout.y; }}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: palette.text }]}>Phone</Text>
            </View>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: palette.background, borderColor: errors.phone ? palette.networkErrorText : palette.border },
              ]}
            >
              <FontAwesome name="phone" size={16} color={palette.cardSubtitle} style={styles.inputIcon} />
              <TextInput
                ref={phoneRef}
                value={form.phone}
                onChangeText={(value) => handleFieldChange('phone', value)}
                placeholder="555-123-4567 or +14155552671"
                placeholderTextColor={palette.icon}
                keyboardType="number-pad"
                autoCapitalize="none"
                autoComplete="tel"
                style={[styles.input, { color: palette.text }]}
                returnKeyType="done"
              />
            </View>
            {errors.phone ? <Text style={[styles.errorText, { color: palette.networkErrorText }]}>{errors.phone}</Text> : null}
          </View>

          {errors.global ? (
            <View style={[styles.feedbackPanel, { backgroundColor: palette.networkErrorBackground, borderColor: palette.networkErrorBorder }]}>
              <Text style={[styles.feedbackTitle, { color: palette.networkErrorText }]}>Something went wrong</Text>
              <Text style={[styles.feedbackBody, { color: palette.networkErrorText }]}>{errors.global}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.9}
            style={[
              styles.primaryButton,
              { backgroundColor: palette.loginPrimaryButton, opacity: isSubmitting ? 0.7 : 1 },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={palette.loginPrimaryButtonText} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: palette.loginPrimaryButtonText }]}>Create account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.secondaryButton, { borderColor: palette.border }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.secondaryButtonText, { color: palette.cardSubtitle }]}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    gap: 20,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 80,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '700',
  },
  formCard: {
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    gap: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  fieldGroup: {
    gap: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 13,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  inputIcon: {
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  togglePassword: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  feedbackPanel: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  feedbackBody: {
    fontSize: 15,
    lineHeight: 20,
  },
  primaryButton: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
