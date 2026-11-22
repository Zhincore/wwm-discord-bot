import type { Role } from 'discord.js';
import { RoleOption, StringOption } from 'necord';

import { ToolLevel } from '#llm/tool-agent.ts';

export class EnableLLMDto {
  @StringOption({
    name: 'level',
    description: 'The level of features to provide.',
    choices: [
      { name: 'basic', value: ToolLevel.BASIC },
      { name: 'advanced', value: ToolLevel.ADVANCED },
    ],
    required: true,
  })
  public level: ToolLevel;

  @RoleOption({
    name: 'role',
    description: 'The role that can use LLM. Use @everyone for no limit.',
    required: true,
  })
  public role: Role;
}
