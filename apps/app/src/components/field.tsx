import { useState, type Ref } from 'react'
import { Text, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native'

import { radius, space, type as t } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

/** Labelled text input. Label sits above (never a placeholder-as-label). */
export function Field({
  label,
  ref,
  ...props
}: TextInputProps & { label: string; ref?: Ref<TextInputInstance> }) {
  const { c } = useTheme()
  const [focused, setFocused] = useState(false)
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[t.footnote, { color: c.text2, fontWeight: '600' }]}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={c.text2}
        selectionColor={c.accent}
        onFocus={(e) => {
          setFocused(true)
          props.onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          props.onBlur?.(e)
        }}
        {...props}
        style={[
          t.body,
          {
            minHeight: 48,
            paddingHorizontal: space.md,
            borderRadius: radius.md,
            borderCurve: 'continuous',
            backgroundColor: c.fill,
            color: c.text,
            borderWidth: 2,
            borderColor: focused ? c.accent : 'transparent',
          },
          props.style,
        ]}
      />
    </View>
  )
}
