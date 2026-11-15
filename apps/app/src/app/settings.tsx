import Constants from 'expo-constants'
import { useState } from 'react'
import { Text, View } from 'react-native'

import { Button } from '@/components/button'
import { Field } from '@/components/field'
import { closeSheet, Sheet } from '@/components/sheet'
import { api } from '@/lib/api'
import { defaultApiUrl, trimSlash } from '@/lib/server'
import { useServer } from '@/store/server'
import { useShopping } from '@/store/shopping'
import { useStock } from '@/store/stock'
import { space, type as t } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

type Probe = { state: 'idle' } | { state: 'testing' } | { state: 'ok' } | { state: 'fail' }

export default function SettingsSheet() {
  const { c } = useTheme()
  const { apiUrl, isCustom, setApiUrl } = useServer()
  const [draft, setDraft] = useState(apiUrl)
  const [probe, setProbe] = useState<Probe>({ state: 'idle' })
  const url = trimSlash(draft)
  const valid = /^https?:\/\/[^\s/]+/.test(url)

  async function test() {
    setProbe({ state: 'testing' })
    setProbe({ state: (await api.health(url)) ? 'ok' : 'fail' })
  }

  function save(value: string | null) {
    setApiUrl(value)
    // reload everything from the new server
    useStock.setState({ status: 'idle', items: [] })
    useShopping.setState({ status: 'idle', items: [] })
    void useStock.getState().fetch()
    void useShopping.getState().fetch()
    closeSheet()
  }

  return (
    <Sheet title="Ajustes">
      <View style={{ padding: space.xl, paddingTop: space.xxl, gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <Text style={[t.title, { color: c.text }]}>Servidor</Text>
          <Text style={[t.callout, { color: c.text2, lineHeight: 21 }]}>
            Dirección de back-alacena. En casa suele ser la IP de la compu en la red Wi-Fi, puerto 3001.
          </Text>
        </View>

        <Field
          label="URL"
          value={draft}
          onChangeText={(v) => {
            setDraft(v)
            setProbe({ state: 'idle' })
          }}
          placeholder="http://192.168.0.10:3001"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={test}
        />

        <View accessibilityLiveRegion="polite" style={{ minHeight: 20 }}>
          {probe.state === 'ok' ? (
            <Text style={[t.callout, { color: c.accent, fontWeight: '600' }]}>Conectado ✓</Text>
          ) : probe.state === 'fail' ? (
            <Text style={[t.callout, { color: c.danger }]}>
              No responde. ¿El backend está corriendo y en la misma red que este dispositivo?
            </Text>
          ) : null}
        </View>

        <View style={{ gap: space.xs }}>
          <Button label="Probar conexión" variant="secondary" onPress={test} loading={probe.state === 'testing'} disabled={!valid} stretch />
          <Button label="Guardar" onPress={() => save(url)} disabled={!valid || url === apiUrl} stretch />
          {isCustom ? (
            <Button
              label={`Volver a la automática (${defaultApiUrl()})`}
              variant="quiet"
              onPress={() => save(null)}
              stretch
            />
          ) : null}
        </View>

        <Text style={[t.footnote, { color: c.text2, textAlign: 'center' }]}>
          Alacena {Constants.expoConfig?.version ?? ''}
        </Text>
      </View>
    </Sheet>
  )
}
