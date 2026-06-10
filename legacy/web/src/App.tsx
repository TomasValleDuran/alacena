import { Navigate, Route, Routes } from 'react-router-dom'
import { Home } from '@/pages/Home'
import { AddProducts } from '@/pages/AddProducts'
import { ItemDetail } from '@/pages/ItemDetail'
import { ShoppingList } from '@/pages/ShoppingList'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/add" element={<AddProducts />} />
      <Route path="/lista" element={<ShoppingList />} />
      <Route path="/item/:id" element={<ItemDetail />} />
      {/* old scanner URL may live on in installed PWAs */}
      <Route path="/scanner" element={<Navigate to="/add" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
