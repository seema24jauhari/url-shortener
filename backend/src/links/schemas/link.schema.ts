import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LinkDocument = Link & Document;

@Schema({ timestamps: true })
export class Link {
  @Prop({ required: true, unique: true })
  short_code: string;

  @Prop({ required: true })
  long_url: string;

  @Prop({ default: 0 })
  clicks: number;

  @Prop({ type: Date, default: null })
  expires_at: Date | null;
}

export const LinkSchema = SchemaFactory.createForClass(Link);