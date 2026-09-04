import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClickDocument = Click & Document;

@Schema({ timestamps: { createdAt: 'clicked_at', updatedAt: false } })
export class Click {
  @Prop({ type: Types.ObjectId, ref: 'Link', default: null})
  short_code: string;

  @Prop()
  ip_hash: string;

  @Prop({ default: 'direct' })
  referrer: string;

  @Prop()
  device: string;

  @Prop()
  browser: string;

  @Prop()
  country: string;
}

export const ClickSchema = SchemaFactory.createForClass(Click);