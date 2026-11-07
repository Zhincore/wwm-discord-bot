import { Layout } from "#common/views/Layout.js";

const window = null as any;

function redirectJs() {
  const hashValue = window.location.hash.substring(1);
  const params = new URLSearchParams(hashValue);

  const url = new URL(window.location);
  url.pathname = url.pathname.replace(/callback$/, "role");
  for (const [key, value] of params) {
    url.searchParams.set(key, value);
  }

  window.location.replace(url);
}

export function Callback() {
  return (
    <Layout
      title="Please wait..."
      head={<script>{redirectJs.toString()}</script>}
    ></Layout>
  );
}
