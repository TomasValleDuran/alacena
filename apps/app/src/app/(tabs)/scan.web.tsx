import { router, useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions, type TextInputInstance } from 'react-native'

import { GlassIcon, ModeSwitch, ScanNotice, StatusPill } from '@/components/scan-controls'
import { CheckResult, SessionPanel } from '@/components/scan-results'
import { createWedgeDetector } from '@/lib/wedge'
import { useScan, type LogEntry } from '@/store/scan'
import { useShopping } from '@/store/shopping'
import { useStock } from '@/store/stock'
import { overlay, radius, space, type as t } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

/**
 * Web has no camera scanner: codes come from a USB/Bluetooth "keyboard
 * wedge" reader (it types the digits, usually plus Enter) or are typed.
 * So the screen is a dark console band — mode, one big always-focused code
 * field, status — over the same session log / Consultar card as the phone.
 *
 * Focus rules, so a reader works hands-free without stealing focus:
 *  - the field takes focus when the tab is shown, after a submit, a mode
 *    change, an undo, a pointer click on the screen, and when the new-product
 *    dialog closes — unless another field has focus, a dialog is open, or the
 *    user reached the focused control with the keyboard (it keeps focus);
 *  - while nothing editable or interactive has focus, printable keys are
 *    sent to the field, so a scan is never lost to an unfocused page;
 *  - touch-only devices are left alone: claiming focus there pops the soft
 *    keyboard over the results.
 */
const BAND = '#0B0D0A'
/** dimmer than overlay.text2 so the sample code doesn't read as typed; still 5:1 on the field */
const PLACEHOLDER = 'rgba(255, 255, 255, 0.5)'

export default function ScanScreen() {
  const { c, dark } = useTheme()
  // a 13-digit code has to fit beside the search button on a 390 px phone
  const narrow = useWindowDimensions().width < 480
  const mode = useScan((s) => s.mode)
  const submit = useScan((s) => s.submit)
  const noticeKey = useScan((s) => s.notice?.key)
  const [code, setCode] = useState('')
  const [focused, setFocused] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const input = useRef<TextInputInstance>(null)
  const [wedge] = useState(() => createWedgeDetector())
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  /** how the user last interacted: decides whether a focused control may lose focus to the field */
  const modality = useRef<'pointer' | 'keyboard'>('pointer')
  /** this tab is the focused route */
  const active = useRef(false)

  const field = () => input.current as unknown as HTMLInputElement | null

  /** May the code field take focus away from whatever has it now? */
  function mayClaim(forTyping: boolean): boolean {
    if (useScan.getState().pending != null || document.querySelector('[aria-modal="true"]')) return false
    const el = document.activeElement
    if (!(el instanceof HTMLElement) || el === document.body || el === field()) return true
    if (isEditable(el)) return false
    // a control the user clicked hands focus back; one they tabbed to keeps it
    if (el.tabIndex >= 0) return !forTyping && modality.current === 'pointer'
    return true
  }

  function refocus() {
    requestAnimationFrame(() => {
      if (!active.current || touchOnly() || !mayClaim(false)) return
      if (!window.getSelection()?.isCollapsed) return // don't wipe out text being selected
      field()?.focus()
    })
  }

  function send(raw: string) {
    clearTimeout(timer.current)
    wedge.reset()
    setCode('')
    const value = raw.trim()
    if (value) submit(value, 'manual')
    refocus()
  }

  function poll() {
    const r = wedge.idle(performance.now())
    if (!r) return
    if ('wait' in r) timer.current = setTimeout(poll, r.wait)
    else send(r.submit)
  }

  function onChangeText(text: string) {
    const next = text.replace(/\s/g, '')
    setCode(next)
    clearTimeout(timer.current)
    const delay = wedge.change(next, performance.now())
    if (delay != null) timer.current = setTimeout(poll, delay)
  }

  useFocusEffect(
    useCallback(() => {
      // "En casa" numbers and "en la lista" must be known for the results
      if (useStock.getState().status === 'idle') void useStock.getState().fetch()
      if (useShopping.getState().status === 'idle') void useShopping.getState().fetch()
      active.current = true

      function onKeyDown(e: KeyboardEvent) {
        modality.current = 'keyboard'
        const printable = e.key.length === 1 && e.key !== ' '
        if (!printable || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
        // focusing during keydown makes the browser put this key into the field
        if (document.activeElement !== field() && mayClaim(true)) field()?.focus()
      }
      function onPointerDown() {
        modality.current = 'pointer'
      }
      function onClick() {
        if (modality.current === 'pointer') refocus()
      }
      // capture phase: RNW's TextInput stops keydown from bubbling
      document.addEventListener('keydown', onKeyDown, true)
      document.addEventListener('pointerdown', onPointerDown, true)
      document.addEventListener('click', onClick, true)

      // say what each scan did, and take focus back after mode changes,
      // undo and the new-product dialog
      const unsubscribe = useScan.subscribe((s, prev) => {
        const said = describe(s, prev)
        // same sentence twice (e.g. Consultar the same thing again): a zero-width space makes it a change
        if (said) setAnnouncement((a) => (a === said ? said + String.fromCharCode(0x200b) : said))
        if (s.mode !== prev.mode || s.log !== prev.log || (prev.pending != null && s.pending == null)) refocus()
      })
      refocus()

      return () => {
        active.current = false
        document.removeEventListener('keydown', onKeyDown, true)
        document.removeEventListener('pointerdown', onPointerDown, true)
        document.removeEventListener('click', onClick, true)
        unsubscribe()
        clearTimeout(timer.current)
      }
      // once per focus: listing the helpers would re-run it (and re-grab focus) on every render;
      // they only read refs and store state, never stale props
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  )

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }}
      keyboardShouldPersistTaps="handled"
    >
      <Text role="heading" aria-level={1} style={[t.title, { color: c.text, paddingTop: space.sm }]}>
        Escanear
      </Text>

      {/* the console: always dark, like the camera overlay on the phone */}
      <View
        style={{
          backgroundColor: BAND,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          padding: space.lg,
          gap: space.md,
          ...(dark ? { borderWidth: 1, borderColor: c.separator } : null),
        }}
      >
        <ModeSwitch />

        <View style={{ gap: space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Text numberOfLines={1} style={[t.footnote, { color: overlay.text2, fontWeight: '600', flex: 1 }]}>
              Código de barras
            </Text>
            <View
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: radius.pill,
                backgroundColor: focused ? overlay.accent : overlay.text2,
              }}
            />
            <Text style={[t.footnote, { color: focused ? overlay.accent : overlay.text2 }]}>
              {focused ? 'Listo para escanear' : 'Seleccioná el campo'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <TextInput
              ref={input}
              value={code}
              onChangeText={onChangeText}
              onSubmitEditing={() => send(code)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              accessibilityLabel="Código de barras"
              accessibilityHint="Escaneá con el lector o escribí el código"
              placeholder="7790000000000"
              placeholderTextColor={PLACEHOLDER}
              selectionColor={overlay.accent}
              inputMode="numeric"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              blurOnSubmit={false}
              submitBehavior="submit"
              style={{
                flex: 1,
                minWidth: 0,
                height: 64,
                paddingHorizontal: space.lg,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                backgroundColor: overlay.glass,
                borderWidth: 2,
                borderColor: focused ? overlay.accent : 'transparent',
                outlineWidth: 0,
                color: overlay.text,
                fontSize: narrow ? 22 : 28,
                fontWeight: '600',
                letterSpacing: narrow ? 1 : 2,
                fontVariant: ['tabular-nums'],
              }}
            />
            <GlassIcon icon="search" label="Buscar" onPress={() => send(code)} />
          </View>
        </View>

        <View style={{ alignItems: 'center' }}>
          <StatusPill />
        </View>
        {/* keyed so a repeated notice is a new alert and gets announced again */}
        <ScanNotice key={noticeKey} />
      </View>

      {mode === 'check' ? <CheckResult /> : <SessionPanel />}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/new-product')}
        style={({ pressed }) => ({ alignSelf: 'center', paddingVertical: space.sm, opacity: pressed ? 0.6 : 1 })}
        hitSlop={8}
      >
        <Text style={[t.callout, { color: c.accent, fontWeight: '600' }]}>¿No tiene código? Crear producto a mano</Text>
      </Pressable>

      {/* what the last scan did, for screen readers, without leaving the field */}
      <View accessibilityLiveRegion="polite" style={visuallyHidden}>
        <Text>{announcement}</Text>
      </View>
    </ScrollView>
  )
}

type ScanSnapshot = ReturnType<typeof useScan.getState>

/** One sentence for what changed between two scan states, or null. */
function describe(s: ScanSnapshot, prev: ScanSnapshot): string | null {
  const top = s.log[0]
  if (top && top.key !== prev.log[0]?.key) return logLine(top)
  const undone = s.log.find((e) => e.undone && !prev.log.find((p) => p.key === e.key)?.undone)
  if (undone) return `Deshecho: ${undone.product.name}`
  if (s.checked && s.checked !== prev.checked) {
    const row = useStock.getState().items.find((r) => r.productId === s.checked!.id)
    if (!row) return `${s.checked.name}: no está en la despensa`
    if (row.quantity === 0) return `${s.checked.name}: se acabó`
    return `${s.checked.name}: hay ${row.quantity} en casa`
  }
  return null
}

function logLine(e: LogEntry): string {
  const sign = e.delta > 0 ? 'más' : 'menos'
  const left = e.total === 0 && e.delta < 0 ? 'se acabó' : `hay ${e.total}`
  return `${e.product.name}: ${sign} ${Math.abs(e.delta)}, ${left}`
}

function isEditable(el: HTMLElement): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el.isContentEditable
}

/** Phones and tablets without a mouse: focusing the field there opens the on-screen keyboard. */
function touchOnly(): boolean {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches
}

const visuallyHidden = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 } as const
