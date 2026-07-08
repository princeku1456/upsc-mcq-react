/* =========================================
   TOASTR SHIM
   The original app used the toastr CDN library. This maps the
   exact same API (success / error / info / warning) onto
   react-toastify so every ported call site stays unchanged.
   ========================================= */
import { toast } from "react-toastify";

export const toastr = {
  success: (msg) => toast.success(msg),
  error: (msg) => toast.error(msg),
  info: (msg) => toast.info(msg),
  warning: (msg) => toast.warn(msg),
};
