import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { router, useFocusEffect, useIsFocused } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Linking, ScrollView, View, type LayoutRectangle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/button'
import { GlassIcon, ModeSwitch, ScanNotice, StatusPill } from '@/components/scan-controls'
import { CheckResult, SessionPanel } from '@/components/scan-results'
import { StateView } from '@/components/state-view'
import { normalizeScanned } from '@/lib/barcode'
import { codeCenter, createScanGate, isAimed, type Rect } from '@/lib/scan-gate'
import { feedback } from '@/lib/feedback'
import { useScan } from '@/store/scan'
import { useShopping } from '@/store/shopping'
import { useStock } from '@/store/stock'
import { overlay, space } from '@/theme/tokens'
import { useTabBottomInset } from '@/theme/use-tab-bottom-inset'
import { useTheme } from '@/theme/use-theme'

/** Retail symbologies only — fewer types = faster native detection, no stray QR reads. */
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a'] as const

export function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions()
  const focused = useIsFocused()

  if (!permission) return <View style={{ flex: 1, backgroundColor: '#000' }} />
  if (!permission.granted) {
    return <PermissionGate canAsk={permission.canAskAgain} onRequest={requestPermission} />
  }
  return <Scanner focused={focused} />
}

function Scanner({ focused }: { focused: boolean }) {
  const insets = useSafeAreaInsets()
  const bottomInset = useTabBottomInset()
  const mode = useScan((s) => s.mode)
  const busy = useScan((s) => s.busy)
  const pending = useScan((s) => s.pending)
  const submit = useScan((s) => s.submit)
  const [torch, setTorch] = useState(false)
  const [gate] = useState(() => createScanGate())
  // the viewfinder's rect in camera-view coordinates (aim area + reticle offset)
  const aimArea = useRef<LayoutRectangle | null>(null)
  const reticle = useRef<LayoutRectangle | null>(null)
  function frameRect(): Rect | null {
    if (!aimArea.current || !reticle.current) return null
    return {
      x: aimArea.current.x + reticle.current.x,
      y: aimArea.current.y + reticle.current.y,
      width: reticle.current.width,
      height: reticle.current.height,
    }
  }

  useFocusEffect(
    useCallback(() => {
      // make sure "En casa" numbers and "en la lista" are known for Consultar
      if (useStock.getState().status === 'idle') void useStock.getState().fetch()
      if (useShopping.getState().status === 'idle') void useShopping.getState().fetch()
      // leaving the tab turns the torch off; it shouldn't come back on by itself
      return () => {
        setTorch(false)
        gate.reset()
      }
    }, [gate]),
  )

  function onScanned(result: BarcodeScanningResult) {
    // the native scanner reads the whole preview; only codes aimed at the
    // viewfinder count — anything else in shot is treated as not seen
    const center = codeCenter(result)
    const aimed = isAimed(center, frameRect())
    if (!aimed) return
    // it reports every frame; the gate decides what's a scan
    const code = normalizeScanned(result.data)
    if (gate.see(code, Date.now())) submit(code, 'camera')
  }

  const scanning = pending == null

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* only one preview may run, and only while this tab is visible */}
      {focused ? (
        <CameraView
          style={{ position: 'absolute', inset: 0 }}
          facing="back"
          active={scanning}
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={scanning ? onScanned : undefined}
        />
      ) : null}

      {/* top controls: torch · mode (what a scan does) · keyboard, one row */}
      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
        }}
      >
        <GlassIcon
          icon={torch ? 'torchOn' : 'torchOff'}
          label={torch ? 'Apagar linterna' : 'Prender linterna'}
          selected={torch}
          onPress={() => {
            feedback.tick()
            setTorch((v) => !v)
          }}
        />
        <ModeSwitch style={{ flex: 1 }} />
        <GlassIcon icon="keyboard" label="Ingresar código a mano" onPress={() => router.push('/manual-entry')} />
      </View>

      {/* aim */}
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}
        onLayout={(e) => (aimArea.current = e.nativeEvent.layout)}
      >
        <Reticle active={busy != null} onLayout={(r) => (reticle.current = r)} />
        <StatusPill />
      </View>

      {/* results */}
      <View style={{ paddingHorizontal: space.md, paddingBottom: bottomInset + space.md, gap: space.sm }}>
        <ScanNotice />
        {mode === 'check' ? <CheckResult /> : <SessionPanel />}
      </View>
    </View>
  )
}

/** Corner brackets. Turn green while a code is being looked up. */
function Reticle({ active, onLayout }: { active: boolean; onLayout: (r: LayoutRectangle) => void }) {
  const color = active ? overlay.accent : overlay.text
  const arm = 28
  const stroke = 4
  const corner = (pos: object, borders: object) => (
    <View style={[{ position: 'absolute', width: arm, height: arm, borderColor: color }, pos, borders]} />
  )
  return (
    <View
      style={{ width: '78%', maxWidth: 360, aspectRatio: 1.9 }}
      onLayout={(e) => onLayout(e.nativeEvent.layout)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {corner({ top: 0, left: 0 }, { borderTopWidth: stroke, borderLeftWidth: stroke, borderTopLeftRadius: 14 })}
      {corner({ top: 0, right: 0 }, { borderTopWidth: stroke, borderRightWidth: stroke, borderTopRightRadius: 14 })}
      {corner({ bottom: 0, left: 0 }, { borderBottomWidth: stroke, borderLeftWidth: stroke, borderBottomLeftRadius: 14 })}
      {corner({ bottom: 0, right: 0 }, { borderBottomWidth: stroke, borderRightWidth: stroke, borderBottomRightRadius: 14 })}
    </View>
  )
}

/* ------------------------------------------------------------ permission */

function PermissionGate({ canAsk, onRequest }: { canAsk: boolean; onRequest: () => void }) {
  const { c } = useTheme()
  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <StateView
        icon="camera"
        title="Escaneá con la cámara"
        body={
          canAsk
            ? 'Alacena usa la cámara solo para leer códigos de barras. No saca fotos ni guarda imágenes.'
            : 'El permiso de cámara está desactivado. Activalo en Ajustes para escanear, o ingresá los códigos a mano.'
        }
      >
        {canAsk ? (
          <Button label="Permitir cámara" icon="camera" onPress={onRequest} />
        ) : (
          <Button label="Abrir Ajustes" onPress={() => Linking.openSettings()} />
        )}
        <Button label="Ingresar código a mano" variant="quiet" icon="keyboard" onPress={() => router.push('/manual-entry')} />
      </StateView>
    </ScrollView>
  )
}
