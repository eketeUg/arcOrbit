import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type RebalanceJobDocument = mongoose.HydratedDocument<RebalanceJob>;

@Schema({ timestamps: true })
export class RebalanceJob {
  @Prop({ type: Number, ref: 'User', required: true })
  chatId: number;

  @Prop({
    required: true,
    enum: ['ANALYZING', 'PLANNED', 'EXECUTING', 'SWAPPING', 'COMPLETED', 'FAILED'],
    default: 'ANALYZING',
  })
  status: string;

  @Prop({ default: false })
  dryRun: boolean;

  @Prop({ type: Map, of: String })
  balancesBefore: Map<string, string>;

  @Prop({ type: Map, of: Number })
  allocationsBefore: Map<string, number>;

  @Prop({ type: Map, of: Number })
  targetAllocations: Map<string, number>;

  @Prop({ type: [Object], default: [] })
  plannedSwaps: Array<{
    tokenIn: string;
    tokenOut: string;
    amount: string;
    reason: string;
  }>;

  @Prop({ type: [Object], default: [] })
  executedSwaps: Array<{
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    txHash: string;
    status: 'COMPLETED' | 'FAILED';
    error?: string;
  }>;

  @Prop({ type: Map, of: String })
  balancesAfter: Map<string, string>;

  @Prop()
  error: string;
}

export const RebalanceJobSchema = SchemaFactory.createForClass(RebalanceJob);
