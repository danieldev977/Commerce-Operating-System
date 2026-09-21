import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { CommerceShell } from '@/components/commerce-shell';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  FulfillmentPage,
  InventoryPage,
  OrderDetailPage,
  OrdersPage,
  OverviewPage,
  SettlementsPage,
  VendorsPage,
} from '@/pages/commerce-pages';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <CommerceShell>
        <Switch>
          <Route path="/" component={OverviewPage} />
          <Route path="/orders" component={OrdersPage} />
          <Route path="/orders/:orderId" component={OrderDetailPage} />
          <Route path="/inventory" component={InventoryPage} />
          <Route path="/fulfillment" component={FulfillmentPage} />
          <Route path="/vendors" component={VendorsPage} />
          <Route path="/settlements" component={SettlementsPage} />
          <Route component={NotFound} />
        </Switch>
      </CommerceShell>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
