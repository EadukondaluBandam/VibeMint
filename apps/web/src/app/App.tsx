import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../stores/auth/AuthContext';
import { AppRouter } from './router';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}
