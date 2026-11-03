import { toast } from "sonner";

// The app raises toasts through this helper, not sonner directly, so the set of
// toast kinds stays small and consistent. Colors come from the status tokens
// wired into the Toaster (src/components/ui/sonner.tsx).
export const notify = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
};
