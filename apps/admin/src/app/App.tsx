import { BrowserRouter } from 'react-router-dom';
import { AdminAuthProvider } from '../stores/AdminAuthContext';
import { AppRouter } from './router';

export default function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <AppRouter />
      </AdminAuthProvider>
    </BrowserRouter>
  );
}
