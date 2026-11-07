import { Layout } from "#common/views/Layout.js";
import safeRedirectJS from "./callback-redirect.js?raw" with { type: "text" };

export function Callback() {
  return (
    <Layout
      title="Please wait..."
      head={<script>{safeRedirectJS}</script>}
    ></Layout>
  );
}
