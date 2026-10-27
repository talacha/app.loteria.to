import { createBrowserRouter, RouterProvider } from 'react-router';
import { routes } from './routes';
import Shell from './Shell';

const router = createBrowserRouter([{ element: <Shell />, children: routes }]);

export default function App() {
  return <RouterProvider router={router} />;
}
