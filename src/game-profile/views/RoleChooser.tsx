import { Layout } from "#common/views/Layout.js";
import { RoleInfo } from "#wwm/game-profile.js";
import safeCss from "./Link.css" with { type: "text" };

interface RoleProps {
  roles: RoleInfo[];
}

export function RoleChooser({ roles }: RoleProps) {
  return (
    <Layout title="Game Linking">
      <style>{safeCss}</style>
      <form method="POST" enctype="application/x-www-form-urlencoded">
        <p>Choose character to link:</p>
        <ul class="method-buttons">
          {roles.map(({ roleId, roleName }) => (
            <li>
              <button name="roleId" value={roleId} safe>
                {roleName}
              </button>
            </li>
          ))}
        </ul>
      </form>
    </Layout>
  );
}
