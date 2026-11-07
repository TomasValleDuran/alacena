import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'

import { useServer } from '@/store/server'
import { space, type as t } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

import { Button } from './button'
import { Icon, type IconName } from './icon'

/** Centered message block for empty / error / permission states. */
export function StateView({
  icon,
  title,
  body,
  children,
}: {
  icon: IconName
  title: string
  body?: string
  children?: ReactNode
}) {
  const { c } = useTheme()
  return (
    <View
      style={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: space.xxl,
        paddingVertical: 64,
        gap: space.md,
      }}
    >
      <Icon name={icon} size={40} color={c.text2} />
      <Text style={[t.title, { color: c.text, textAlign: 'center' }]}>{title}</Text>
      {body ? (
        <Text selectable style={[t.callout, { color: c.text2, textAlign: 'center', lineHeight: 21 }]}>
          {body}
        </Text>
      ) : null}
      {children ? <View style={{ gap: space.sm, marginTop: space.md, alignItems: 'center' }}>{children}</View> : null}
    </View>
  )
}

export function LoadingView() {
  const { c } = useTheme()
  return (
    <View style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 96 }}>
      <ActivityIndicator color={c.text2} />
    </View>
  )
}

/** First-load failure: almost always "the backend isn't reachable from this phone". */
export function ConnectionError({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  const apiUrl = useServer((s) => s.apiUrl)
  return (
    <StateView
      icon="offline"
      title="No pudimos conectar"
      body={`${message ?? ''}\nServidor: ${apiUrl}`.trim()}
    >
      <Button label="Reintentar" onPress={onRetry} />
      <Button label="Cambiar servidor" variant="quiet" onPress={() => router.push('/settings')} />
    </StateView>
  )
}
