import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, View, useColorScheme } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path, Rect } from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'

/**
 * Splash hand-off: the overlay's first frame matches the native splash exactly
 * (cupboard mark, 76 pt wide, on the app background), so hiding the native one
 * is invisible. Then the doors open, the mark grows and fades, and the app
 * fades in. About 1 s total; a 300 ms crossfade with reduced motion.
 *
 * Timing source: alacena-assets/splash-timing.json (1 unit = 1 pt in a 100 pt box).
 * Colors follow the *system* scheme, because that's what the native splash uses.
 */

SplashScreen.preventAutoHideAsync().catch(() => {})

const COLORS = {
  light: { bg: '#F6F5F0', mark: '#2E6A3D', interior: '#E1EEE3' },
  dark: { bg: '#10120F', mark: '#8CCB99', interior: '#2E6A3D' },
} as const
const AMBER = '#F0B45A'

const EASE = {
  out: Easing.bezier(0.22, 1, 0.36, 1),
  standard: Easing.bezier(0.33, 0, 0.67, 1),
  emphasized: Easing.bezier(0.4, 0, 0.2, 1),
  accelerate: Easing.bezier(0.4, 0, 1, 1),
}

const DOOR_L =
  'M21 30H42A5 5 0 0 1 47 35V81A5 5 0 0 1 42 86H21A5 5 0 0 1 16 81V35A5 5 0 0 1 21 30ZM41.5 48A2.5 2.5 0 0 1 44 50.5V61.5A2.5 2.5 0 0 1 41.5 64A2.5 2.5 0 0 1 39 61.5V50.5A2.5 2.5 0 0 1 41.5 48Z'
const DOOR_R =
  'M58 30H79A5 5 0 0 1 84 35V81A5 5 0 0 1 79 86H58A5 5 0 0 1 53 81V35A5 5 0 0 1 58 30ZM58.5 48A2.5 2.5 0 0 1 61 50.5V61.5A2.5 2.5 0 0 1 58.5 64A2.5 2.5 0 0 1 56 61.5V50.5A2.5 2.5 0 0 1 58.5 48Z'

type Props = { children: ReactNode }

export function AnimatedSplash({ children }: Props) {
  const c = COLORS[useColorScheme() === 'dark' ? 'dark' : 'light']
  const reduced = useReducedMotion()
  const [laidOut, setLaidOut] = useState(false)
  const [done, setDone] = useState(false)

  // 0 → 1 progress per track
  const interior = useSharedValue(0)
  const door = useSharedValue(0)
  const shelf = useSharedValue(0)
  const exitScale = useSharedValue(0)
  const exitFade = useSharedValue(0)
  const overlay = useSharedValue(0)

  useEffect(() => {
    if (!laidOut) return
    SplashScreen.hideAsync().catch(() => {})

    const finish = (finished?: boolean) => {
      'worklet'
      if (finished) scheduleOnRN(setDone, true)
    }

    if (reduced) {
      overlay.value = withTiming(1, { duration: 300, easing: EASE.standard }, finish)
      return
    }
    interior.value = withDelay(60, withTiming(1, { duration: 140, easing: EASE.standard }))
    door.value = withDelay(60, withTiming(1, { duration: 420, easing: EASE.out }))
    shelf.value = withDelay(180, withTiming(1, { duration: 220, easing: EASE.standard }))
    exitScale.value = withDelay(560, withTiming(1, { duration: 340, easing: EASE.emphasized }))
    exitFade.value = withDelay(560, withTiming(1, { duration: 340, easing: EASE.accelerate }))
    overlay.value = withDelay(620, withTiming(1, { duration: 380, easing: EASE.emphasized }, finish))
  }, [laidOut, reduced, interior, door, shelf, exitScale, exitFade, overlay])

  const appStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : 0.98 + 0.02 * overlay.value }],
  }))
  const overlayStyle = useAnimatedStyle(() => ({ opacity: 1 - overlay.value }))
  const markStyle = useAnimatedStyle(() => ({
    opacity: 1 - exitFade.value,
    transform: [{ scale: 1 + 0.25 * exitScale.value }],
  }))
  const interiorStyle = useAnimatedStyle(() => ({ opacity: interior.value }))
  const shelfStyle = useAnimatedStyle(() => ({ opacity: shelf.value }))
  const doorLStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 400 }, { rotateY: `${-82 * door.value}deg` }],
  }))
  const doorRStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 400 }, { rotateY: `${82 * door.value}deg` }],
  }))

  return (
    <View style={styles.fill}>
      {/* once done, drop the transform entirely so nothing in the app sits under a scaled layer */}
      <Animated.View style={[styles.fill, done ? null : appStyle]}>{children}</Animated.View>
      {!done && (
        <Animated.View
          pointerEvents="none"
          onLayout={() => setLaidOut(true)}
          style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.bg }, overlayStyle]}
        >
          <Animated.View style={[styles.box, markStyle]}>
            <Animated.View style={[styles.interior, interiorStyle]}>
              <Svg width={68} height={56} viewBox="16 30 68 56">
                <Rect x={16} y={30} width={68} height={56} rx={5} fill={c.interior} />
              </Svg>
            </Animated.View>
            <Animated.View style={[styles.shelf, shelfStyle]}>
              <Svg width={56} height={4} viewBox="22 55 56 4">
                <Rect x={22} y={55} width={56} height={4} rx={2} fill={AMBER} />
              </Svg>
            </Animated.View>
            <Animated.View style={[styles.doorL, doorLStyle]}>
              <Svg width={31} height={56} viewBox="16 30 31 56">
                <Path d={DOOR_L} fill={c.mark} fillRule="evenodd" />
              </Svg>
            </Animated.View>
            <Animated.View style={[styles.doorR, doorRStyle]}>
              <Svg width={31} height={56} viewBox="53 30 31 56">
                <Path d={DOOR_R} fill={c.mark} fillRule="evenodd" />
              </Svg>
            </Animated.View>
            <View style={styles.cornice}>
              <Svg width={76} height={10} viewBox="12 14 76 10">
                <Rect x={12} y={14} width={76} height={10} rx={4} fill={c.mark} />
              </Svg>
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  )
}

// 100 × 100 pt box; the mark's bbox is 76 × 72 pt, matching imageWidth 76 natively
const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  box: { width: 100, height: 100 },
  interior: { position: 'absolute', left: 16, top: 30, width: 68, height: 56 },
  shelf: { position: 'absolute', left: 22, top: 55, width: 56, height: 4 },
  doorL: { position: 'absolute', left: 16, top: 30, width: 31, height: 56, transformOrigin: 'left center' },
  doorR: { position: 'absolute', left: 53, top: 30, width: 31, height: 56, transformOrigin: 'right center' },
  cornice: { position: 'absolute', left: 12, top: 14, width: 76, height: 10 },
})
