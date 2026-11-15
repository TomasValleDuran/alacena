import { ActivityIndicator, Pressable, Text, View } from 'react-native'

import { HIT, radius, space, type as t } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

import { Icon, type IconName } from './icon'

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger'

/** Capsule button. `quiet` is text-only for secondary actions next to a primary. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  stretch,
}: {
  label: string
  onPress: () => void
  variant?: Variant
  icon?: IconName
  loading?: boolean
  disabled?: boolean
  stretch?: boolean
}) {
  const { c } = useTheme()
  const unavailable = disabled || loading
  const bg = {
    primary: c.accent,
    secondary: c.accentSoft,
    quiet: 'transparent',
    danger: c.dangerSoft,
  }[variant]
  const fg = {
    primary: c.onAccent,
    secondary: c.accent,
    quiet: c.accent,
    danger: c.danger,
  }[variant]

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={!!unavailable}
      aria-busy={!!loading}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: HIT,
        paddingHorizontal: space.xl,
        borderRadius: radius.pill,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: stretch ? 'stretch' : 'auto',
        opacity: unavailable && !loading ? 0.45 : pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {icon ? <Icon name={icon} size={19} color={fg} /> : null}
          <Text style={[t.headline, { color: fg }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

/** Round icon-only header button with a visible hit area and an accessible name. */
export function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName
  label: string
  onPress: () => void
}) {
  const { c } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? c.fill : 'transparent',
      })}
    >
      <Icon name={icon} size={22} color={c.accent} />
    </Pressable>
  )
}
