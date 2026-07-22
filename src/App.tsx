
import { DirectionProvider } from "@radix-ui/react-direction";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { PaidConfirmation } from "@/components/PaidConfirmation";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";

const queryClient = new QueryClient();

// Radix primitives read direction from this provider, not from CSS. Without it
// they lay out and animate as LTR even though the page renders RTL: Select and
// Dropdown open on the wrong side, and arrow keys in Tabs move the wrong way.
const App = () => (
  <DirectionProvider dir="rtl">
    <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            {/* Outside Routes: a reminder link lands on "/" whether or not the
                recipient happens to be signed in. */}
            <PaidConfirmation />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
    </HelmetProvider>
  </DirectionProvider>
);

export default App;
