import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ItemList from './pages/ItemList'
import ItemDetail from './pages/ItemDetail'
import SupplierList from './pages/SupplierList'
import SupplierDetail from './pages/SupplierDetail'
import Forecast from './pages/Forecast'
import Stock from './pages/Stock'
import Calculation from './pages/Calculation'
import Planning from './pages/Planning'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="items" element={<ItemList />} />
        <Route path="items/:id" element={<ItemDetail />} />
        <Route path="suppliers" element={<SupplierList />} />
        <Route path="suppliers/:id" element={<SupplierDetail />} />
        <Route path="forecast" element={<Forecast />} />
        <Route path="stock" element={<Stock />} />
        <Route path="calculation" element={<Calculation />} />
        <Route path="planning" element={<Planning />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
