import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type VaultSnapshotDocument = mongoose.HydratedDocument<VaultSnapshot>;

@Schema({ timestamps: true })
export class VaultSnapshot {
  @Prop({ type: Number, ref: 'User', required: true })
  chatId: number;

  @Prop({ type: Map, of: String })
  balances: Map<string, string>;

  @Prop({ type: Map, of: String })
  valuations: Map<string, string>;

  @Prop({ required: true })
  totalValueUSD: string;

  @Prop({ type: Map, of: Number })
  allocations: Map<string, number>;

  @Prop({ type: Map, of: Number })
  targetAllocations: Map<string, number>;
}

export const VaultSnapshotSchema = SchemaFactory.createForClass(VaultSnapshot);
