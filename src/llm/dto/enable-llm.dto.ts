import type { Role } from 'discord.js';
import { RoleOption, StringOption } from 'necord';

import { arrayToChoices } from '#common/utils.ts';
import { ToolLevel } from '#llm/utils/tool-agent.ts';

export class EnableLLMDto {
  @StringOption({
    name: 'level',
    description: 'The level of features to provide.',
    choices: arrayToChoices(ToolLevel),
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
