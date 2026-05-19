import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { User, UserDocument } from 'src/database/schemas/user.schema';
import { WalletService } from 'src/wallet/wallet.service';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

interface FindOrCreateTelegramUserDto {
  chatId: number;
  username?: string;
}

interface FindOrCreateTelegramUserResponse {
  user: UserDocument;
  isNewUser: boolean;
}

@Injectable()
export class UserService {
  constructor(
    private readonly walletService: WalletService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async findOrCreateTelegramUser({
    chatId,
    username,
  }: FindOrCreateTelegramUserDto): Promise<FindOrCreateTelegramUserResponse> {
    const existingUser = await this.userModel.findOne({ chatId });

    if (existingUser) {
      return {
        user: existingUser,
        isNewUser: false,
      };
    }

    const wallets = await this.walletService.createWallet();

    if (!wallets || wallets.length < 2) {
      throw new InternalServerErrorException('Failed to create wallets');
    }

    const [evmWallet, svmWallet] = wallets;

    const user = await this.userModel.create({
      chatId,
      userName: username,
      evmWallet,
      svmWallet,
    });

    return {
      user,
      isNewUser: true,
    };
  }
}
