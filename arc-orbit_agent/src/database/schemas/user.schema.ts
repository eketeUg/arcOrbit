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

  @Prop({ default: 50 })
  allocationUsdc: number;

  @Prop({ default: 30 })
  allocationEurc: number;

  @Prop({ default: 20 })
  allocationCirbtc: number;

  @Prop({ default: 5 })
  rebalanceThreshold: number;

  @Prop({ default: false })
  rebalanceEnabled: boolean;

  @Prop({ default: 33 })
  allocationBase: number;

  @Prop({ default: 33 })
  allocationSolana: number;

  @Prop({ default: 34 })
  allocationArc: number;

  @Prop({ default: 5 })
  crossChainThreshold: number;

  @Prop({ default: false })
  crossChainRebalanceEnabled: boolean;


}

export const UserSchema = SchemaFactory.createForClass(User);
