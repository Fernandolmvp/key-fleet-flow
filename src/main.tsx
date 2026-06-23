import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installTrialErrorInterceptor } from "./lib/trial-error-interceptor";
import ErrorBoundary from "./components/ErrorBoundary";

installTrialErrorInterceptor();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
