import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type VaultTransactionDocument =
  mongoose.HydratedDocument<VaultTransaction>;

@Schema({ timestamps: true })
export class VaultTransaction {
  @Prop({ type: Number, ref: 'User', required: true })
  chatId: number;

  @Prop({
    required: true,
    enum: ['DEPOSIT', 'WITHDRAWAL', 'SWAP', 'REBALANCE_SWAP'],
  })
  type: string;

  @Prop({ required: true })
  tokenIn: string;

  @Prop({ required: true })
  tokenOut: string;

  @Prop({ required: true })
  amountIn: string;

  @Prop({ required: true })
  amountOut: string;

  @Prop()
  txHash: string;

  @Prop()
  explorerUrl: string;

  @Prop({
    required: true,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
  })
  status: string;

  @Prop()
  error: string;

  @Prop()
  rebalanceJobId: string;
}

export const VaultTransactionSchema =
  SchemaFactory.createForClass(VaultTransaction);
