import type { Product } from '@/types/product'

type ProductThumbProps = {
  product: Product
  className?: string
}

/** Product photo, or its initial set in the display serif when there is none */
export function ProductThumb({ product, className = '' }: ProductThumbProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-pine-50 ${className}`}
    >
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt=""
          className="h-full w-full object-contain mix-blend-multiply"
          loading="lazy"
        />
      ) : (
        <span className="font-display text-xl text-pine-300 italic select-none">
          {product.name.trim().charAt(0).toUpperCase() || '·'}
        </span>
      )}
    </div>
  )
}
