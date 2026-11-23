import { Injectable, Logger } from '@nestjs/common';
import { cleanContent, type Message } from 'discord.js';
import { Context, On, type ContextOf } from 'necord';

import { Conversations } from './conversation';
import { BusyError, LLMService } from './llm.service';
import { ToolLevel } from './tool-agent';

const MESSAGE_LIMIT = 2000;
const TYPING_INTERVAL = 8_000;

const EMPTY_HINT = 'Mention me together with your question.';
const BUSY_HINT = "I'm still working on your previous question.";
const ERROR_REPLY = 'Something went wrong, try again later.';

/** Shorten `text` to Discord's message limit, preferring a line break. */
export function fitMessage(text: string, limit = MESSAGE_LIMIT): string {
  if (text.length <= limit) return text;
  const cut = text.lastIndexOf('\n', limit - 1);
  return `${text.slice(0, cut > limit / 2 ? cut : limit - 1).trimEnd()}…`;
}

/** Answers messages that mention the bot; a reply to an answer continues that conversation. */
@Injectable()
export class LLMListener {
  readonly #logger = new Logger(LLMListener.name);
  #conversations?: Conversations<Message>;

  constructor(private readonly service: LLMService) {}

  @On('messageCreate')
  async onMessage(@Context() [message]: ContextOf<'messageCreate'>) {
    const botId = message.client.user.id;
    if (message.author.bot || !message.inGuild()) return;
    if (!message.mentions.users.has(botId)) return;

    const settings = this.service.getSettings(message.guildId);
    if (!settings || !message.member) return;

    const maxLevel = Object.values(ToolLevel).find((level) => {
      const roleId = settings[level];
      return roleId && message.member!.roles.cache.has(roleId);
    });
    if (!maxLevel) return;

    this.#conversations ??= new Conversations<Message>(botId, (m) =>
      this.#text(m, botId),
    );
    const conversations = this.#conversations;

    const text = this.#text(message, botId);
    if (!text) return this.#reply(message, EMPTY_HINT);

    const typing = setInterval(
      () => void message.channel.sendTyping().catch(() => null),
      TYPING_INTERVAL,
    );
    try {
      await message.channel.sendTyping().catch(() => null);
      const result = await this.service.ask({
        text,
        toolLevel: maxLevel,
        asker: {
          id: message.author.id,
          name: message.member?.displayName ?? message.author.displayName,
        },
        history: await conversations.historyFor(message),
      });
      clearInterval(typing);
      if (result?.answer.trim()) {
        const sent = await this.#reply(message, result.answer.trim());
        if (sent) conversations.remember(sent.id, result.turns);
      }
    } catch (error) {
      if (error instanceof BusyError) {
        return await this.#reply(message, BUSY_HINT);
      }
      this.#logger.error(error);
      return await this.#reply(message, ERROR_REPLY);
    } finally {
      clearInterval(typing);
    }
  }

  /** Message text without the bot's mention, other mentions as names; the bot's own messages verbatim. */
  #text(message: Message, botId: string): string {
    if (message.author.id === botId) return message.content;
    const withoutBot = message.content.replace(
      new RegExp(`<@!?${botId}>`, 'g'),
      '@Chirpy',
    );
    return cleanContent(withoutBot, message.channel).trim();
  }

  /** Reply without letting the content ping anyone but the asker. */
  async #reply(message: Message, content: string) {
    return message
      .reply({
        content: fitMessage(content),
        allowedMentions: { parse: [], repliedUser: true },
      })
      .catch((error: unknown) => {
        this.#logger.error(error);
        return null;
      });
  }
}
