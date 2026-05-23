import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type SessionDocument = mongoose.HydratedDocument<Session>;

@Schema()
export class Session {
  @Prop({ type: mongoose.Schema.Types.BigInt, ref: 'User' })
  chatId: number;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: mongoose.Types.ObjectId;

  @Prop({ default: false })
  sessionOn: boolean;

  @Prop({ default: false })
  createWallet: boolean;

  @Prop()
  userInputId: number[];

  @Prop()
  transactionId: string;

  @Prop({ default: false })
  allocationSetting: boolean;

  @Prop({ default: false })
  thresholdSetting: boolean;

  @Prop({ default: false })
  crossChainAllocationSetting: boolean;

  @Prop({ default: false })
  crossChainThresholdSetting: boolean;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
