import { Image } from 'expo-image'
import { useState } from 'react'
import { View } from 'react-native'

import { radius } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

import { Icon } from './icon'

/** Catalog photos are packshots on white — they sit on a white tile in both themes. */
export function ProductThumb({
  uri,
  blurHash,
  size = 52,
}: {
  uri: string | null
  blurHash?: string | null
  size?: number
}) {
  const { c } = useTheme()
  const [failed, setFailed] = useState(false)
  const showImage = uri && !failed

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size >= 96 ? radius.lg : radius.md,
        borderCurve: 'continuous',
        backgroundColor: showImage ? '#FFFFFF' : c.fill,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessible={false}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          contentFit="contain"
          placeholder={blurHash ? { blurhash: blurHash } : undefined}
          placeholderContentFit="cover"
          transition={150}
          recyclingKey={uri}
          onError={() => setFailed(true)}
          style={{ width: size * 0.88, height: size * 0.88 }}
        />
      ) : (
        <Icon name="box" size={Math.round(size * 0.42)} color={c.text2} />
      )}
    </View>
  )
}
