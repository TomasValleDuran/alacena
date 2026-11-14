# Alacena App — Project Handoff Document

> **Propósito de este documento:** Handoff completo para ser usado como contexto inicial en Claude Code u otro agente de desarrollo. Incluye objetivo, stack, arquitectura, schema, pantallas, reglas de negocio y criterios de aceptación.

---

## 1. Visión general

**Nombre tentativo:** Alacena  
**Tipo:** PWA mobile-first (React)  
**Objetivo:** Permitir al usuario escanear el código de barras de un producto, identificarlo automáticamente via API pública, y gestionar el stock de su alacena/despensa doméstica. Sin auth multi-usuario en v1 — aplicación de uso personal/familiar.

**Usuarios target:** Una o pocas personas en un hogar. Sin registro requerido en v1.

---

## 2. Stack tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Frontend | React + Vite | Estándar, buen ecosistema mobile |
| Styling | Tailwind CSS | Rápido, mobile-first |
| Routing | React Router v6 | SPA con navegación por tabs |
| Barcode scanning | `@zxing/browser` | Usa la cámara del browser, sin app nativa |
| Barcode lookup | Open Food Facts API | Gratuita, sin auth, amplia cobertura |
| Base de datos | Supabase (Postgres) | Hosted, cliente JS directo, free tier |
| Hosting | Vercel | Deploy automático desde GitHub, free tier |
| Estado global | Zustand o React Context | Liviano, suficiente para v1 |

**Sin backend propio en v1.** El frontend habla directamente con Supabase via `@supabase/supabase-js` y con Open Food Facts via fetch REST.

---

## 3. Arquitectura

```
[Browser / PWA]
      │
      ├── @zxing/browser (cámara → barcode string)
      │
      ├── Open Food Facts API
      │   GET https://world.openfoodfacts.org/api/v0/product/{barcode}.json
      │   → nombre, marca, imagen, categoría, unidad
      │
      └── Supabase JS Client
            ├── products (catálogo local cacheado)
            └── stock_items (items en la alacena con cantidad)
```

**Flujo principal de escaneo:**
1. Usuario abre scanner → cámara activa
2. `@zxing/browser` detecta un código de barras
3. App consulta primero en tabla `products` local (caché)
4. Si no está → fetch a Open Food Facts API
5. Si se encuentra el producto → mostrar info + form de cantidad
6. Usuario confirma → se guarda/actualiza en `stock_items`
7. Si Open Food Facts no tiene el producto → form manual de nombre

---

## 4. Schema de Supabase

### Tabla: `products`
Catálogo local. Se pobla al escanear productos nuevos.

```sql
create table products (
  id          uuid primary key default gen_random_uuid(),
  barcode     text unique not null,
  name        text not null,
  brand       text,
  image_url   text,
  category    text,
  unit        text,          -- "g", "ml", "u" (unidades), etc.
  created_at  timestamptz default now()
);

create index on products (barcode);
```

### Tabla: `stock_items`
El stock actual de la alacena.

```sql
create table stock_items (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references products(id) on delete cascade,
  quantity    numeric not null default 1,
  min_qty     numeric default 0,   -- alerta de stock bajo (opcional v1)
  updated_at  timestamptz default now()
);

-- Un solo registro por producto
create unique index on stock_items (product_id);
```

### Tabla: `scan_history` (opcional, v1.1)
```sql
create table scan_history (
  id          uuid primary key default gen_random_uuid(),
  barcode     text not null,
  action      text,          -- "add", "remove", "update"
  quantity    numeric,
  scanned_at  timestamptz default now()
);
```

**Row Level Security:** En v1 sin auth, RLS deshabilitado o con política pública. Si se agrega auth en v2, habilitar RLS por `user_id`.

---

## 5. Pantallas / Vistas

### 5.1 Home / Lista de stock
- Lista de todos los items en alacena con: imagen, nombre, cantidad actual
- Badge de alerta si cantidad ≤ `min_qty`
- FAB (Floating Action Button) para abrir el scanner
- Buscador por nombre
- Opciones rápidas por item: `+1`, `-1`, editar, eliminar

### 5.2 Scanner
- Vista de cámara full-screen
- Overlay con guía de encuadre (rectángulo centrado)
- Al detectar código: pausa la cámara, muestra tarjeta con info del producto
- Estado: `scanning` → `found` | `not_found` | `error`
- En `found`: mostrar nombre, imagen, cantidad actual en stock; botones `+1 rápido` y `Editar cantidad`
- En `not_found`: form para ingresar nombre manualmente + guardar

### 5.3 Detalle / Edición de item
- Info completa del producto (nombre, marca, imagen, categoría)
- Input de cantidad con teclado numérico
- Input de `min_qty` (umbral de alerta)
- Botón eliminar

### 5.4 Lista de compras (v1.1, opcional)
- Items con stock ≤ `min_qty`
- Marcar como "comprado" → actualiza stock

---

## 6. Reglas de negocio

- **Un producto = un barcode = un entry en stock_items.** No hay duplicados.
- **Cantidad nunca negativa.** Si el usuario intenta bajar de 0, mostrar advertencia o bloquear.
- **Caché local de productos:** Si el barcode ya está en la tabla `products`, no consultar Open Food Facts. Reducir latencia y evitar rate limiting.
- **Producto manual:** Si el usuario crea un producto a mano (sin barcode de OF), el barcode se usa igual como identificador; se puede generar uno interno tipo `MANUAL-{timestamp}`.
- **Imágenes:** Se guarda solo la URL de la imagen de Open Food Facts (no se hostea). Si no hay imagen, mostrar placeholder.

---

## 7. Integración Open Food Facts

**Endpoint:**
```
GET https://world.openfoodfacts.org/api/v0/product/{barcode}.json
```

**Respuesta relevante:**
```json
{
  "status": 1,
  "product": {
    "product_name": "...",
    "brands": "...",
    "image_front_url": "...",
    "categories": "...",
    "quantity": "500g"
  }
}
```

- `status: 1` → producto encontrado
- `status: 0` → no encontrado
- Sin API key requerida
- Rate limit generoso para uso personal

**Mapeo:**
```
product_name   → products.name
brands         → products.brand
image_front_url → products.image_url
categories     → products.category (tomar primera)
quantity       → parsear unidad (g, ml, etc.)
```

---

## 8. Variables de entorno

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 9. Estructura de carpetas sugerida

```
alacena/
├── public/
│   └── manifest.json          # PWA manifest
├── src/
│   ├── components/
│   │   ├── BarcodeScanner.jsx
│   │   ├── ProductCard.jsx
│   │   ├── StockList.jsx
│   │   ├── StockItem.jsx
│   │   └── ManualProductForm.jsx
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Scanner.jsx
│   │   └── ItemDetail.jsx
│   ├── lib/
│   │   ├── supabase.js         # cliente supabase
│   │   └── openFoodFacts.js    # fetch + mapeo
│   ├── store/
│   │   └── useStockStore.js    # Zustand store
│   ├── App.jsx
│   └── main.jsx
├── .env.local
├── vite.config.js
└── package.json
```

---

## 10. Dependencias principales

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x",
    "@zxing/browser": "^0.1.x",
    "react": "^18.x",
    "react-dom": "^18.x",
    "react-router-dom": "^6.x",
    "zustand": "^4.x"
  },
  "devDependencies": {
    "vite": "^5.x",
    "@vitejs/plugin-react": "^4.x",
    "tailwindcss": "^3.x",
    "autoprefixer": "^10.x",
    "postcss": "^8.x"
  }
}
```

---

## 11. PWA Setup (para instalar en home screen del celular)

Agregar en `vite.config.js` el plugin `vite-plugin-pwa` con:
- `name`: "Alacena"
- `theme_color`: a definir
- `icons`: 192x192, 512x512
- `display`: "standalone"
- `start_url`: "/"

Esto permite instalar la app desde Chrome/Safari mobile sin pasar por una app store.

---

## 12. Criterios de aceptación — MVP

- [ ] El usuario puede abrir la cámara y escanear un código de barras
- [ ] Si el producto está en Open Food Facts, se muestra nombre e imagen automáticamente
- [ ] El usuario puede agregar el producto al stock con una cantidad
- [ ] El stock persiste en Supabase (sobrevive reload)
- [ ] El usuario puede ver la lista completa de items en su alacena
- [ ] El usuario puede modificar la cantidad (+/-) desde la lista
- [ ] El usuario puede eliminar un item del stock
- [ ] Si el producto no está en OF, el usuario puede ingresarlo manualmente
- [ ] La app es usable desde un celular (mobile-first, táctil)
- [ ] La app es instalable como PWA

---

## 13. Decisiones pendientes / Out of scope v1

| Tema | Decisión |
|------|---------|
| Autenticación | Out of scope v1. En v2: Supabase Auth con magic link |
| Multi-usuario / hogares | Out of scope v1 |
| Lista de compras automática | Out of scope v1 (v1.1) |
| Historial de movimientos | Out of scope v1 (v1.1) |
| Notificaciones de stock bajo | Out of scope v1 |
| Modo offline | Deseable (PWA cache), no bloqueante para MVP |
| Backend Java | Considerado para v2 como práctica; en v1 el frontend habla directo con Supabase |

---

## 14. Checklist de setup para el agente

1. `npm create vite@latest alacena -- --template react`
2. Instalar dependencias listadas en sección 10
3. Configurar Tailwind CSS
4. Crear proyecto en Supabase → correr el SQL de la sección 4
5. Copiar `.env.local` con las variables de la sección 8
6. Implementar en orden: `lib/supabase.js` → `lib/openFoodFacts.js` → `store` → `BarcodeScanner` → `Home` → `Scanner` → `ItemDetail`
7. Configurar `vite-plugin-pwa`
8. Deploy en Vercel conectando el repo de GitHub

---

*Documento generado como handoff para Claude Code. Versión: v1.0*