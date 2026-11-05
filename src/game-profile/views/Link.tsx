import { Layout } from "#common/views/Layout.js";
import { LoginMethod } from "#game-profile/easebar-auth.js";
import safeCss from "./link.css" with { type: "text" };

interface LinkProps {
  methods: LoginMethod[];
}

export function Link({ methods }: LinkProps) {
  return (
    <Layout title="Game Linking">
      <style>{safeCss}</style>

      <p class="prose">
        Linking your game stats to the bot allows you to participate in
        leaderboards, show off your stats and more!
      </p>
      <p>Choose your login method:</p>
      <ul class="method-buttons">
        {methods.map(({ name, url }) => (
          <li>
            <a href={url} rel="noreferer noopener">
              <button safe>{name}</button>
            </a>
          </li>
        ))}
      </ul>
    </Layout>
  );
}
