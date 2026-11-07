import { Layout } from "#common/views/Layout.js";

interface SuccessProps {
  nickname: string;
}

export function Success({ nickname }: SuccessProps) {
  return (
    <Layout title="Account linked successfully!">
      <p safe>Character {nickname} has been linked to your Discord.</p>
      <p>You can now close this tab/window.</p>
    </Layout>
  );
}
