import { Toaster } from "sonner";
import "../styles/sonner-overrides.css";

const ToasterProvider = () => (
  <Toaster
    position="top-center"
    expand={true}
    richColors
    duration={4000}
    closeButton
    toastOptions={{
      className: "sonner-toast",
    }}
  />
);

export default ToasterProvider;
