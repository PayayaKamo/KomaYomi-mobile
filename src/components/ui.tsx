import React, { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { colors, radius, spacing } from '../theme';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      {children}
    </SafeAreaView>
  );
}

export function Header({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={10} style={styles.backButton} accessibilityRole="button">
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
      ) : null}
      <View style={styles.headerText}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        (disabled || busy) && styles.buttonDisabled,
        pressed && !disabled && !busy && styles.buttonPressed,
      ]}>
      {busy ? <ActivityIndicator size="small" color={colors.text} /> : null}
      <Text
        style={[
          styles.buttonLabel,
          variant === 'ghost' && styles.buttonLabelGhost,
          variant === 'danger' && styles.buttonLabelDanger,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  dotColor,
}: {
  label: string;
  active: boolean;
  onPress?: () => void;
  dotColor?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button">
      {dotColor ? <View style={[styles.chipDot, { backgroundColor: dotColor }]} /> : null}
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && styles.segmentActive]}
            accessibilityRole="button">
            <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Compact edit/read switch; the read side is advisory only on mobile. */
export function ModeButton({
  readOnly,
  onToggle,
}: {
  readOnly: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.modeButton, readOnly ? styles.modeButtonRead : styles.modeButtonEdit]}
      accessibilityRole="button"
      accessibilityLabel={t('mode.toggle')}
      accessibilityState={{ selected: readOnly }}>
      <View style={[styles.modeDot, readOnly ? styles.modeDotRead : styles.modeDotEdit]} />
      <Text style={[styles.modeLabel, readOnly ? styles.modeLabelRead : styles.modeLabelEdit]}>
        {readOnly ? t('mode.readShort') : t('mode.editShort')}
      </Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'accent' | 'warning' }) {
  return (
    <View style={[styles.badge, tone === 'accent' && styles.badgeAccent, tone === 'warning' && styles.badgeWarning]}>
      <Text style={[styles.badgeLabel, tone === 'accent' && styles.badgeLabelAccent, tone === 'warning' && styles.badgeLabelWarning]}>
        {label}
      </Text>
    </View>
  );
}

export function Banner({ text, tone = 'warning' }: { text: string; tone?: 'warning' | 'error' }) {
  return (
    <View style={[styles.banner, tone === 'error' && styles.bannerError]}>
      <Text style={[styles.bannerText, tone === 'error' && styles.bannerTextError]}>{text}</Text>
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  backIcon: { color: colors.text, fontSize: 26, lineHeight: 28, marginTop: -2 },
  headerText: { flex: 1 },
  headerTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  headerSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDanger: { backgroundColor: 'transparent', borderColor: colors.danger },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.78 },
  buttonLabel: { color: '#0b1020', fontSize: 15, fontWeight: '700' },
  buttonLabelGhost: { color: colors.accent },
  buttonLabelDanger: { color: colors.danger },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  chipLabelActive: { color: colors.text },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.accentSoft },
  segmentLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  segmentLabelActive: { color: colors.text },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  modeButtonEdit: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
  modeButtonRead: { backgroundColor: '#2b2417', borderColor: colors.warning },
  modeDot: { width: 6, height: 6, borderRadius: 3 },
  modeDotEdit: { backgroundColor: colors.success },
  modeDotRead: { backgroundColor: colors.warning },
  modeLabel: { fontSize: 11, fontWeight: '700' },
  modeLabelEdit: { color: colors.textMuted },
  modeLabelRead: { color: colors.warning },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeAccent: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  badgeWarning: { backgroundColor: '#3a2c18', borderColor: colors.warning },
  badgeLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  badgeLabelAccent: { color: colors.accent },
  badgeLabelWarning: { color: colors.warning },
  banner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#2b2417',
    borderWidth: 1,
    borderColor: '#5b4722',
    gap: 2,
  },
  bannerError: { backgroundColor: '#2c1a1c', borderColor: '#6a2b30' },
  bannerText: { color: colors.warning, fontSize: 12, lineHeight: 17 },
  bannerTextError: { color: colors.danger },
  empty: { padding: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyHint: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
