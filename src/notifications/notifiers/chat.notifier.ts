import { Inject } from '@nestjs/common';
import { ChannelType, escapeMarkdown, TextChannel } from 'discord.js';
import type { SlashCommandContext } from 'necord';

import {
  DEFAULT_AVATAR,
  GameDataService,
} from '#game-data/game-data.service.ts';
import type { ChatEvent } from '#wwm/proxy/wwm-api.js';

import { BaseNotificationsNotifier, type GuildSetting } from './base';

export class ChatNotifier extends BaseNotificationsNotifier<'chat'> {
  @Inject()
  private readonly gameData: GameDataService;

  public override getKind(): 'chat' {
    return 'chat';
  }

  protected override async onEvent(
    event: ChatEvent,
    guilds: GuildSetting[],
  ): Promise<void> {
    const username = event.sender_name;
    const text = event.text_plain || event.text;
    if (!username || !text) return;

    let avatar = this.gameData.get(
      'avatar',
      event.head_image_id || DEFAULT_AVATAR,
    );
    if (!avatar?.pic_url) avatar = this.gameData.get('avatar', DEFAULT_AVATAR);

    for (const guild of guilds) {
      await this.#sendEvent(guild.channel, username, text, avatar?.pic_url);
    }
  }

  async #sendEvent(
    channel: TextChannel,
    username: string,
    text: string,
    avatarURL?: string,
  ) {
    const webhooks = await channel.fetchWebhooks();
    let wh = webhooks.find((wh) => wh.token);
    if (!wh) {
      wh = await channel.createWebhook({ name: 'Chat Message' });
    }

    await wh.send({
      username,
      avatarURL,
      content: escapeMarkdown(text),
    });
  }

  public override async previewEvent([
    interaction,
  ]: SlashCommandContext): Promise<undefined> {
    if (interaction.channel?.type !== ChannelType.GuildText) return;
    const avatar = this.gameData.get('avatar', DEFAULT_AVATAR + 1);
    await this.#sendEvent(
      interaction.channel,
      'Karel3 [notification test]',
      'Send porls',
      avatar?.pic_url,
    );
  }
}
