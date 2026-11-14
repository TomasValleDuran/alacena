import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { Pressable, Text, View, type TextInputInstance } from 'react-native'

import { Button } from '@/components/button'
import { Field } from '@/components/field'
import { MODE_COPY, useScan } from '@/store/scan'
import { space, type as t } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

/**
 * Type a code — or point a Bluetooth/USB barcode scanner at the phone: those
 * "type" the digits plus Enter, so the field stays focused after each submit
 * and works as a continuous hardware-scanner inbox too.
 */
export default function ManualEntrySheet() {
  const { c } = useTheme()
  const { mode, perScan, submit, busy, log, notice } = useScan()
  const [code, setCode] = useState('')
  const input = useRef<TextInputInstance>(null)
  const last = log[0]

  function send() {
    const value = code.trim()
    if (!value) return
    submit(value, 'manual')
    setCode('')
    input.current?.focus()
  }

  const modeLine =
    mode === 'check'
      ? 'Modo Consultar: no cambia nada'
      : `Modo ${MODE_COPY[mode].label}: ${mode === 'add' ? '+' : '−'}${perScan} por código`

  return (
    <View style={{ padding: space.xl, paddingTop: space.xxl, gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text style={[t.title, { color: c.text }]}>Ingresar código</Text>
        <Text style={[t.callout, { color: c.text2 }]}>{modeLine}</Text>
      </View>

      <Field
        ref={input}
        label="Código de barras"
        value={code}
        onChangeText={(v) => setCode(v.replace(/\s/g, ''))}
        placeholder="7790000000000"
        keyboardType="number-pad"
        autoFocus
        autoCorrect={false}
        returnKeyType="search"
        submitBehavior="submit"
        onSubmitEditing={send}
        style={{ fontSize: 22, fontVariant: ['tabular-nums'], letterSpacing: 1 }}
      />

      <Button label={busy ? `Buscando ${busy}…` : 'Buscar'} onPress={send} disabled={!code.trim()} stretch />

      <View accessibilityLiveRegion="polite" style={{ minHeight: 20 }}>
        {notice ? (
          <Text selectable style={[t.callout, { color: c.danger }]}>
            {notice.text}
          </Text>
        ) : last && !last.undone ? (
          <Text style={[t.callout, { color: c.text2 }]} numberOfLines={2}>
            Último: <Text style={{ color: c.text, fontWeight: '600' }}>{last.product.name}</Text> (
            {last.delta > 0 ? '+' : '−'}
            {Math.abs(last.delta)}, hay {last.total})
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace('/new-product')}
        style={{ paddingVertical: space.sm }}
        hitSlop={8}
      >
        <Text style={[t.callout, { color: c.accent, fontWeight: '600' }]}>
          ¿No tiene código? Crear producto a mano
        </Text>
      </Pressable>
    </View>
  )
}
