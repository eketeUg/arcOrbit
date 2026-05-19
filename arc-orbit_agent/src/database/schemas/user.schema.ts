import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type UserDocument = mongoose.HydratedDocument<User>;

export type Wallet = {
  id: string;
  address: string;
  state: string;
  custodyType: string;
  accountType: string;
  createdDate: Date;
  updatedDate: Date;
};

@Schema()
export class User {
  @Prop({ unique: true })
  chatId: number;

  @Prop()
  userName: string;

  @Prop({ type: Object })
  evmWallet: Wallet;

  @Prop({ type: Object })
  svmWallet: Wallet;

  @Prop({ default: 0 })
  upperThreshold: string;

  @Prop({ default: 0 })
  lowerThreshold: string;

  @Prop({ default: 0 })
  usdcAllocation: string;

  @Prop({ default: 0 })
  tokenAllocation: string;

  @Prop({ default: false })
  rebalanceEnabled: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
