import type { Role } from 'discord.js';
import { RoleOption } from 'necord';

export class EnableLLMDto {
  @RoleOption({
    name: 'role',
    description: 'Optionally role to limit LLM usage to. Any role if empty.',
    required: false,
  })
  public role?: Role;
}
