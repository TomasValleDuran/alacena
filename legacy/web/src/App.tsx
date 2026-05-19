import { Routes, Route } from 'react-router-dom'
import { Home } from '@/pages/Home'
import { Scanner } from '@/pages/Scanner'
import { ItemDetail } from '@/pages/ItemDetail'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/scanner" element={<Scanner />} />
      <Route path="/item/:id" element={<ItemDetail />} />
    </Routes>
  )
}

export default App
