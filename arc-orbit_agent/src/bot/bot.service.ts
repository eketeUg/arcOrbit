import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../database/schemas/user.schema';
import { allFeaturesMarkup, welcomeMessageMarkup } from './markups';
import { WalletService } from 'src/wallet/wallet.service';

import { Session, SessionDocument } from 'src/database/schemas/session.schema';
import { UserService } from 'src/user/user.service';

const token = process.env.TELEGRAM_TOKEN;

@Injectable()
export class BotService {
  private bot: TelegramBot;
  private logger = new Logger(BotService.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly userService: UserService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Session.name) private readonly sessionModel: Model<Session>,
  ) {
    this.bot = new TelegramBot(token, { polling: true });
    this.bot.on('message', this.handleRecievedMessages);
    this.bot.on('callback_query', this.handleButtonCommands);
  }

  handleRecievedMessages = async (msg: any) => {
    this.logger.debug(msg);
    try {
      await this.bot.sendChatAction(msg.chat.id, 'typing');

      const [user, session] = await Promise.all([
        this.userModel.findOne({ chatId: msg.chat.id }),
        this.sessionModel.findOne({ chatId: msg.chat.id }),
      ]);

      const regex2 = /^0x[a-fA-F0-9]{40}$/;
      const regex = /^Swap (?:also )?(\d+\.?\d*) (\w+) (?:to|for) (\w+)$/i;
      const match = msg.text.trim().match(regex);
      const match2 = msg.text.trim().match(regex2);
      if ((match || match2) && !session) {
        console.log(msg.text.trim());
        // return this.handleAgentprompts(user, msg.text.trim());
      }

      // Handle text inputs if not a command
      if (msg.text !== '/start' && msg.text !== '/menu' && session) {
        // return this.handleUserTextInputs(msg, session!);
      } else if (msg.text !== '/start' && msg.text !== '/menu' && !session) {
        // return this.handleAgentprompts(user, msg.text.trim());
      }
      const command = msg.text!;
      console.log('Command :', command);

      if (command === '/start') {
        try {
          console.log('User   ', user);
          const username = msg.from.username;

          await this.userService.findOrCreateTelegramUser({
            chatId: msg.chat.id,
            username,
          });

          const welcome = await welcomeMessageMarkup(username);

          await this.bot.sendMessage(msg.chat.id, welcome.message, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: welcome.keyboard,
            },
          });

          return;
        } catch (error) {
          this.logger.error(error);

          await this.bot.sendMessage(
            msg.chat.id,

            '⚠️ An unexpected error occurred. Please try again later.',
          );
        }
      }

      // Handle /menu command
      if (command === '/menu') {
        const allFeatures = await allFeaturesMarkup(user, '0');
        if (allFeatures) {
          const replyMarkup = { inline_keyboard: allFeatures.keyboard };
          await this.bot.sendMessage(msg.chat.id, allFeatures.message, {
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          });
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  handleButtonCommands = async (query: any) => {
    this.logger.debug(query);
    let command: string;

    function isJSON(str) {
      try {
        JSON.parse(str);
        return true;
      } catch (e) {
        console.log(e);
        return false;
      }
    }

    if (isJSON(query.data)) {
      command = JSON.parse(query.data).command;
    } else {
      command = query.data;
    }

    const chatId = query.message.chat.id;

    try {
      await this.bot.sendChatAction(chatId, 'typing');
      const user = await this.userModel.findOne({ chatId: chatId });
      let session: SessionDocument;
      switch (command) {
        case '/menu':
          await this.sendAllFeature(user);
          return;

        //   close opened markup and delete session
        case '/closeDelete':
          await this.bot.sendChatAction(query.message.chat.id, 'typing');
          await this.sessionModel.deleteMany({
            chatId: chatId,
          });
          return await this.bot.deleteMessage(
            query.message.chat.id,
            query.message.message_id,
          );

        case '/close':
          await this.bot.sendChatAction(query.message.chat.id, 'typing');
          return await this.bot.deleteMessage(
            query.message.chat.id,
            query.message.message_id,
          );

        default:
          return await this.bot.sendMessage(
            query.message.chat.id,
            `Processing command failed, please try again`,
          );
      }
    } catch (error) {
      console.log(error);
    }
  };

  sendAllFeature = async (user: UserDocument) => {
    try {
      await this.bot.sendChatAction(user.chatId, 'typing');
      const allFeatures = await allFeaturesMarkup(user, '0');
      if (allFeatures) {
        const replyMarkup = {
          inline_keyboard: allFeatures.keyboard,
        };
        await this.bot.sendMessage(user.chatId, allFeatures.message, {
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        });
      }
    } catch (error) {
      console.log(error);
    }
  };
}
