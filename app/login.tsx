import { FontAwesome } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
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

type ThemeName = keyof typeof Colors;
type FormField = 'email' | 'password';

type FormErrors = Partial<Record<FormField | 'global', string>>;

type LoginFormState = {
  email: string;
  password: string;
};

const initialFormState: LoginFormState = {
  email: '',
  password: '',
};

export default function LoginScreen() {
  const { login, status } = useAuth();
  const router = useRouter();
  const theme = (useColorScheme() ?? 'dark') as ThemeName;
  const palette = Colors[theme];

  const [form, setForm] = useState<LoginFormState>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleFieldChange = useCallback((field: FormField, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, global: undefined }));
  }, []);

  const validate = useCallback((payload: LoginFormState): FormErrors => {
    const nextErrors: FormErrors = {};
    const emailCandidate = payload.email.trim();

    if (!emailCandidate) {
      nextErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidate)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!payload.password) {
      nextErrors.password = 'Enter your password.';
    }

    return nextErrors;
  }, []);

  const handleSubmit = useCallback(async () => {
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    const result = await login({
      email: form.email.trim(),
      password: form.password,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setErrors({ global: result.message ?? 'Unable to sign in. Please try again.' });
      return;
    }

    router.replace('/(tabs)');
  }, [form, login, router, validate]);

  if (status === 'checking') {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.activePill} />
      </View>
    );
  }

  if (status === 'authenticated') {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: palette.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { backgroundColor: palette.background }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, { backgroundColor: palette.loginHeroBackground }]}
        >
          <Text style={[styles.heroEyebrow, { color: palette.loginHeroAccent }]}>Welcome back</Text>
          <Text style={[styles.heroTitle, { color: palette.text }]}>Log back in</Text>
          <Text style={[styles.heroBody, { color: palette.loginHeroBody }]}>Your favorite spots and tonight&rsquo;s best local events are just a tap away.</Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: palette.cardSurface, borderColor: palette.border }]}
        >
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Your account</Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: palette.text }]}>Email</Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: palette.background, borderColor: errors.email ? palette.networkErrorText : palette.border },
              ]}
            >
              <FontAwesome name="envelope" size={16} color={palette.cardSubtitle} style={styles.inputIcon} />
              <TextInput
                value={form.email}
                onChangeText={(value) => handleFieldChange('email', value)}
                placeholder="alex@example.com"
                placeholderTextColor={palette.icon}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                style={[styles.input, { color: palette.text }]}
                returnKeyType="next"
              />
            </View>
            {errors.email ? <Text style={[styles.errorText, { color: palette.networkErrorText }]}>{errors.email}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: palette.text }]}>Password</Text>
              <TouchableOpacity onPress={() => setShowPassword((current) => !current)}>
                <Text style={[styles.togglePassword, { color: palette.cardSubtitle }]}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: palette.background, borderColor: errors.password ? palette.networkErrorText : palette.border },
              ]}
            >
              <FontAwesome name="lock" size={16} color={palette.cardSubtitle} style={styles.inputIcon} />
              <TextInput
                value={form.password}
                onChangeText={(value) => handleFieldChange('password', value)}
                placeholder="••••••••"
                placeholderTextColor={palette.icon}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                style={[styles.input, { color: palette.text }]}
                returnKeyType="done"
              />
            </View>
            {errors.password ? <Text style={[styles.errorText, { color: palette.networkErrorText }]}>{errors.password}</Text> : null}
          </View>

          {errors.global ? (
            <View style={[styles.feedbackPanel, { backgroundColor: palette.networkErrorBackground, borderColor: palette.networkErrorBorder }]}
            >
              <Text style={[styles.feedbackTitle, { color: palette.networkErrorText }]}>Try again</Text>
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
              <Text style={[styles.primaryButtonText, { color: palette.loginPrimaryButtonText }]}>Sign in</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/register')}
            style={[styles.secondaryButton, { borderColor: palette.border }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.secondaryButtonText, { color: palette.cardSubtitle }]}>Need an account? Register</Text>
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
  heroCard: {
    borderRadius: 24,
    padding: 24,
    gap: 10,
  },
  heroEyebrow: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '700',
  },
  heroBody: {
    fontSize: 16,
    lineHeight: 22,
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
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
