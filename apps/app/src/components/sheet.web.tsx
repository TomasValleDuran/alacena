import { router } from 'expo-router'
import Head from 'expo-router/head'
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'

import { overlay, radius, space } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

/**
 * Web sheet: the route is a transparent modal (see app/_layout.tsx), so this
 * draws the scrim and a centred dialog card itself. Escape and a click on the
 * scrim close it; focus moves into the dialog, Tab stays inside it, and focus
 * goes back to whatever opened it.
 */
export function Sheet({ title, children }: { title: string; children: ReactNode }) {
  const { c, dark } = useTheme()
  const card = useRef<ComponentRef<typeof View>>(null)
  // read during the first render, before an autoFocus field inside takes focus
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null))

  useEffect(() => {
    const el = card.current as unknown as HTMLElement | null
    // an autoFocus field inside may already have focus; otherwise focus the dialog
    if (el && !el.contains(document.activeElement)) el.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeSheet()
      } else if (e.key === 'Tab' && el) {
        trapTab(e, el)
      }
    }
    // capture phase: RNW TextInput stops keydown propagation, so a bubbling
    // listener would miss Escape/Tab while a field inside has focus
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      if (opener?.isConnected) opener.focus()
    }
  }, [opener])

  return (
    <View style={styles.root}>
      <Head>
        <title>{`${title} · Alacena`}</title>
      </Head>
      <Pressable
        accessible={false}
        focusable={false}
        aria-hidden
        onPress={closeSheet}
        style={[StyleSheet.absoluteFill, { backgroundColor: overlay.scrim }]}
      />
      <View
        ref={card}
        role="dialog"
        aria-modal
        aria-label={title}
        tabIndex={-1}
        // in dark mode the shadow barely shows, so the card gets a hairline edge
        style={[styles.card, { backgroundColor: c.surface }, dark && { borderWidth: 1, borderColor: c.separator }]}
      >
        <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </View>
  )
}

/** Close the current sheet; after a cold load of a sheet URL there's nothing to go back to. */
export function closeSheet() {
  if (router.canGoBack()) router.back()
  else router.replace('/')
}

const FOCUSABLE = 'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'

function trapTab(e: KeyboardEvent, root: HTMLElement) {
  const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (n) => !n.hasAttribute('disabled') && n.getAttribute('aria-disabled') !== 'true' && n.offsetParent !== null,
  )
  if (items.length === 0) {
    e.preventDefault()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement
  if (e.shiftKey && (active === first || active === root || !root.contains(active))) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (active === last || !root.contains(active))) {
    e.preventDefault()
    first.focus()
  }
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
  },
})
