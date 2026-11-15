import { useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Text, View, type TextInputInstance } from 'react-native'

import { Button } from '@/components/button'
import { Field } from '@/components/field'
import { closeSheet, Sheet } from '@/components/sheet'
import { api, errorMessage } from '@/lib/api'
import { manualBarcode } from '@/lib/barcode'
import { feedback } from '@/lib/feedback'
import { useScan } from '@/store/scan'
import { useStock } from '@/store/stock'
import { space, type as t } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

/**
 * Two entry points:
 *  - ?barcode=… : the scanner found a code no catalog knows. Saving applies
 *    the current scan mode and resumes the scan queue; closing skips it.
 *  - no params  : a product without a barcode (bulk, homemade…). Saving adds 1.
 */
export default function NewProductSheet() {
  const { c } = useTheme()
  const { barcode } = useLocalSearchParams<{ barcode?: string }>()
  const { mode, perScan, completePending, cancelPending } = useScan()
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saved = useRef(false)
  const brandRef = useRef<TextInputInstance>(null)

  // swiping the sheet away = skip this code; the queue must not stay paused
  useEffect(() => {
    return () => {
      if (barcode && !saved.current) cancelPending()
    }
  }, [barcode, cancelPending])

  const fromScan = !!barcode
  const cta = !fromScan
    ? 'Guardar y sumar 1'
    : mode === 'add'
      ? `Guardar y sumar ${perScan}`
      : mode === 'use'
        ? `Guardar y restar ${perScan}`
        : 'Guardar'

  async function save() {
    const n = name.trim()
    if (!n) {
      setError('Poné un nombre para reconocerlo en la despensa.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const product = await api.createProduct({
        barcode: barcode ?? manualBarcode(),
        name: n,
        brand: brand.trim() || null,
      })
      saved.current = true
      if (fromScan) {
        closeSheet()
        await completePending(product)
      } else {
        await useStock.getState().adjustProduct(product, 1)
        feedback.success()
        closeSheet()
      }
    } catch (e) {
      // keep the sheet open with what they typed
      setError(errorMessage(e))
      feedback.error()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title={fromScan ? 'Producto nuevo' : 'Producto sin código'}>
      <View style={{ padding: space.xl, paddingTop: space.xxl, gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <Text style={[t.title, { color: c.text }]}>{fromScan ? 'Producto nuevo' : 'Producto sin código'}</Text>
          <Text style={[t.callout, { color: c.text2, lineHeight: 21 }]}>
            {fromScan ? (
              <>
                Ningún catálogo conoce el código{' '}
                <Text selectable style={{ color: c.text, fontVariant: ['tabular-nums'] }}>
                  {barcode}
                </Text>
                . Ponele un nombre y queda guardado para la próxima.
              </>
            ) : (
              'Para cosas sueltas o caseras: fruta, carne, frascos. Se guarda en la despensa con 1 unidad.'
            )}
          </Text>
        </View>

        <Field
          label="Nombre"
          value={name}
          onChangeText={setName}
          placeholder="Ej: Yerba Playadito 1 kg"
          autoFocus
          autoCapitalize="sentences"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => brandRef.current?.focus()}
        />
        <Field
          ref={brandRef}
          label="Marca (opcional)"
          value={brand}
          onChangeText={setBrand}
          placeholder="Ej: Playadito"
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={save}
        />

        {error ? (
          <Text selectable accessibilityRole="alert" style={[t.callout, { color: c.danger }]}>
            {error}
          </Text>
        ) : null}

        <View style={{ gap: space.xs }}>
          <Button label={cta} onPress={save} loading={saving} stretch />
          <Button label={fromScan ? 'Saltear este código' : 'Cancelar'} variant="quiet" onPress={closeSheet} stretch />
        </View>
      </View>
    </Sheet>
  )
}
