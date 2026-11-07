import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { router, useFocusEffect, useIsFocused } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View, type LayoutRectangle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/button'
import { Icon, type IconName } from '@/components/icon'
import { PriceList } from '@/components/price-list'
import { ProductThumb } from '@/components/product-thumb'
import { StateView } from '@/components/state-view'
import { reportError } from '@/lib/alert'
import { normalizeScanned } from '@/lib/barcode'
import { codeCenter, createScanGate, isAimed, type Rect } from '@/lib/scan-gate'
import { feedback } from '@/lib/feedback'
import { stockLevel } from '@/lib/types'
import { MODE_COPY, useScan, type LogEntry, type ScanMode } from '@/store/scan'
import { useShopping } from '@/store/shopping'
import { useStock } from '@/store/stock'
import { overlay, radius, space, type as t } from '@/theme/tokens'
import { useTabBottomInset } from '@/theme/use-tab-bottom-inset'
import { useTheme } from '@/theme/use-theme'

/** Retail symbologies only — fewer types = faster native detection, no stray QR reads. */
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a'] as const

export default function ScanScreen() {
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
  const { mode, busy, pending, submit, notice, dismissNotice } = useScan()
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
        <ModeSwitch />
        <GlassIcon icon="keyboard" label="Ingresar código a mano" onPress={() => router.push('/manual-entry')} />
      </View>

      {/* aim */}
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}
        onLayout={(e) => (aimArea.current = e.nativeEvent.layout)}
      >
        <Reticle active={busy != null} onLayout={(r) => (reticle.current = r)} />
        <View
          style={{
            backgroundColor: overlay.glass,
            borderRadius: radius.pill,
            paddingHorizontal: space.lg,
            paddingVertical: space.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
          }}
          accessibilityLiveRegion="polite"
        >
          {busy ? <ActivityIndicator size="small" color={overlay.text} /> : null}
          <Text style={[t.subhead, { color: overlay.text }]}>
            {busy ? (
              `Buscando ${busy}…`
            ) : (
              <>
                <Text style={{ color: MODE_UI[mode].bg, fontWeight: '700' }}>{MODE_COPY[mode].label}</Text>
                {` · ${MODE_COPY[mode].hint}`}
              </>
            )}
          </Text>
        </View>
      </View>

      {/* results */}
      <View style={{ paddingHorizontal: space.md, paddingBottom: bottomInset + space.md, gap: space.sm }}>
        {notice ? (
          <Pressable
            onPress={dismissNotice}
            accessibilityRole="alert"
            accessibilityHint="Toca para cerrar"
            style={{
              backgroundColor: overlay.glass,
              borderRadius: radius.md,
              padding: space.md,
              flexDirection: 'row',
              gap: space.sm,
              alignItems: 'center',
            }}
          >
            <Icon name="warning" size={18} color={overlay.danger} />
            <Text selectable style={[t.callout, { color: overlay.text, flex: 1 }]}>
              {notice.text}
            </Text>
            <Icon name="close" size={16} color={overlay.text2} />
          </Pressable>
        ) : null}
        {mode === 'check' ? <CheckResult /> : <SessionPanel />}
      </View>
    </View>
  )
}

/* ---------------------------------------------------------------- pieces */

/**
 * + · 🔍 · − (Guardar · Consultar · Usar), icons only so it fits between the
 * torch and keyboard buttons; the names stay as accessibility labels and the
 * hint under the viewfinder spells out the current mode. The selected mode takes its own color so
 * "am I adding or subtracting?" reads at a glance: green adds, amber
 * subtracts, white just looks.
 */
const MODE_UI: Record<ScanMode, { icon: IconName; bg: string; fg: string }> = {
  add: { icon: 'modeAdd', bg: overlay.accent, fg: overlay.onAccent },
  check: { icon: 'search', bg: overlay.text, fg: '#10120F' },
  use: { icon: 'modeUse', bg: overlay.warn, fg: '#2A1A00' },
}

function ModeSwitch() {
  const mode = useScan((s) => s.mode)
  const setMode = useScan((s) => s.setMode)
  const modes: ScanMode[] = ['add', 'check', 'use']
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flex: 1,
        flexDirection: 'row',
        backgroundColor: overlay.glass,
        borderRadius: radius.pill,
        padding: 4,
      }}
    >
      {modes.map((m) => {
        const selected = m === mode
        const ui = MODE_UI[m]
        const fg = selected ? ui.fg : overlay.text
        return (
          <Pressable
            key={m}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={MODE_COPY[m].label}
            accessibilityHint={MODE_COPY[m].hint}
            onPress={() => {
              if (!selected) feedback.tick()
              setMode(m)
            }}
            style={({ pressed }) => ({
              flex: 1,
              height: 40, // + 2×4 padding = 48, same as the round buttons beside it
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? ui.bg : pressed ? overlay.glassPressed : 'transparent',
            })}
          >
            <Icon name={ui.icon} size={24} color={fg} />
          </Pressable>
        )
      })}
    </View>
  )
}

function GlassIcon({
  icon,
  label,
  onPress,
  selected,
}: {
  icon: IconName
  label: string
  onPress: () => void
  selected?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? overlay.text : pressed ? overlay.glassPressed : overlay.glass,
      })}
    >
      <Icon name={icon} size={22} color={selected ? '#10120F' : overlay.text} />
    </Pressable>
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

function Card({ children }: { children: React.ReactNode }) {
  const { c } = useTheme()
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        padding: space.md,
        gap: space.sm,
        boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
      }}
    >
      {children}
    </View>
  )
}

/** Guardar / Usar: units per scan + what this session did, with undo. */
function SessionPanel() {
  const { c } = useTheme()
  const { mode, perScan, setPerScan, log, clearSession } = useScan()
  const live = log.filter((e) => !e.undone)
  const units = live.reduce((acc, e) => acc + Math.abs(e.delta), 0)

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={[t.subhead, { color: c.text }]}>
            {mode === 'add' ? 'Sumar' : 'Restar'} por escaneo
          </Text>
          <Text style={[t.footnote, { color: c.text2 }]}>
            {perScan === 1 ? 'De a uno' : `Packs de ${perScan}`}
          </Text>
        </View>
        <PerScanStepper value={perScan} onChange={setPerScan} />
      </View>

      {log.length > 0 ? (
        <>
          <View style={{ height: 1, backgroundColor: c.separator }} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[t.footnote, { color: c.text2, flex: 1 }]}>
              Esta sesión: {live.length} {live.length === 1 ? 'escaneo' : 'escaneos'} · {units}{' '}
              {units === 1 ? 'unidad' : 'unidades'}
            </Text>
            <Pressable onPress={clearSession} hitSlop={12} accessibilityRole="button">
              <Text style={[t.footnote, { color: c.accent, fontWeight: '600' }]}>Limpiar</Text>
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 196 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: space.xs }}>
              {log.slice(0, 8).map((e) => (
                <LogRow key={e.key} entry={e} />
              ))}
            </View>
          </ScrollView>
        </>
      ) : null}
    </Card>
  )
}

function PerScanStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { c } = useTheme()
  const btn = (icon: 'add' | 'remove', delta: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={delta > 0 ? 'Más por escaneo' : 'Menos por escaneo'}
      disabled={disabled}
      hitSlop={7}
      onPress={() => {
        feedback.tick()
        onChange(value + delta)
      }}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? c.separator : c.fill,
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <Icon name={icon} size={17} color={c.text} />
    </Pressable>
  )
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {btn('remove', -1, value <= 1)}
      <Text style={[t.headline, { minWidth: 40, textAlign: 'center', color: c.text, fontVariant: ['tabular-nums'] }]}>
        ×{value}
      </Text>
      {btn('add', 1, value >= 99)}
    </View>
  )
}

function LogRow({ entry }: { entry: LogEntry }) {
  const { c } = useTheme()
  const undo = useScan((s) => s.undo)
  const onList = useShopping((s) => s.items.some((r) => r.productId === entry.product.id && !r.checked))
  const addToList = useShopping((s) => s.addProduct)
  const sign = entry.delta > 0 ? '+' : '−'
  const ranOut = entry.total === 0 && entry.delta < 0

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: entry.undone ? 0.45 : 1 }}
    >
      <ProductThumb uri={entry.product.imageUrl} blurHash={entry.product.blurHash} size={40} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[t.callout, { color: c.text, fontWeight: '600' }]}>
          {entry.product.name}
        </Text>
        <Text style={[t.footnote, { color: ranOut ? c.danger : c.text2, fontVariant: ['tabular-nums'] }]}>
          {entry.undone
            ? 'Deshecho'
            : `${sign}${Math.abs(entry.delta)} · ${ranOut ? 'se acabó' : `hay ${entry.total}`}`}
        </Text>
      </View>
      {!entry.undone && ranOut && !onList ? (
        <SmallAction
          label="A la lista"
          onPress={() => addToList(entry.product.id).catch((e) => reportError(e, 'No se pudo agregar'))}
        />
      ) : null}
      {!entry.undone ? <SmallAction label="Deshacer" onPress={() => undo(entry.key)} /> : null}
    </View>
  )
}

function SmallAction({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8 }}
      style={({ pressed }) => ({
        minHeight: 32,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        justifyContent: 'center',
        backgroundColor: pressed ? c.separator : c.fill,
      })}
    >
      <Text style={[t.footnote, { color: c.text, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  )
}

/** Consultar: "¿tengo esto en casa?" — answer first, quick fixes second. */
function CheckResult() {
  const { c } = useTheme()
  const product = useScan((s) => s.checked)
  const row = useStock((s) => (product ? s.items.find((r) => r.productId === product.id) : undefined))
  const adjust = useStock((s) => s.adjust)
  const adjustProduct = useStock((s) => s.adjustProduct)
  const onList = useShopping((s) => (product ? s.items.some((r) => r.productId === product.id && !r.checked) : false))
  const addToList = useShopping((s) => s.addProduct)

  if (!product) {
    return (
      <Card>
        <Text style={[t.callout, { color: c.text2, textAlign: 'center', paddingVertical: space.sm }]}>
          Escaneá algo para ver cuánto hay en casa y cuánto sale en cada súper. Nada cambia en este modo.
        </Text>
      </Card>
    )
  }

  const qty = row?.quantity ?? 0
  const level = row ? stockLevel(row.quantity, row.minQty) : 'out'
  const answer = !row ? 'No está en la despensa' : qty === 0 ? 'Se acabó' : `Hay ${qty} en casa`

  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <ProductThumb uri={product.imageUrl} blurHash={product.blurHash} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={[t.headline, { color: c.text }]}>
            {product.name}
          </Text>
          <Text
            accessibilityLiveRegion="polite"
            style={[t.title, { color: level === 'out' ? c.danger : level === 'low' ? c.warn : c.accent }]}
          >
            {answer}
          </Text>
          {level === 'low' ? (
            <Text style={[t.footnote, { color: c.warn }]}>Por debajo del mínimo ({row?.minQty})</Text>
          ) : null}
        </View>
      </View>
      {/* prices can be long (10+ markets expanded): scroll inside the card */}
      <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 1, backgroundColor: c.separator, marginBottom: space.sm }} />
        <PriceList productId={product.id} />
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            label={onList ? 'En la lista' : 'A la lista'}
            icon={onList ? 'check' : 'cartAdd'}
            variant="secondary"
            disabled={onList}
            onPress={() => addToList(product.id).catch((e) => reportError(e, 'No se pudo agregar'))}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Sumar 1"
            icon="add"
            variant="secondary"
            onPress={() => {
              feedback.success()
              ;(row ? adjust(row, 1) : adjustProduct(product, 1).then(() => {})).catch((e) => reportError(e))
            }}
          />
        </View>
      </View>
    </Card>
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
