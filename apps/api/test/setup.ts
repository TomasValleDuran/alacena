import { afterAll, beforeEach, vi } from 'vitest'
import { prisma } from '../src/db.js'

// No network in tests: both external lookups are replaced by mocks.
vi.mock('../src/lib/pricely.js', () => ({
  lookupPricely: vi.fn(async () => null),
  pricelyCategories: vi.fn(async () => null),
  pricelyInsights: vi.fn(async () => null),
}))
vi.mock('../src/lib/openFoodFacts.js', () => ({
  lookupBarcode: vi.fn(async () => null),
  parsePackagingUnit: vi.fn(),
}))

beforeEach(async () => {
  vi.clearAllMocks()
  await prisma.$executeRaw`TRUNCATE TABLE shopping_list, stock_items, products CASCADE`
})

afterAll(async () => {
  await prisma.$disconnect()
})
