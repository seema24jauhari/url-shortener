import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Document } from 'mongoose';

export type LinkDocument = Link & Document & { created_at: Date };

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: false } })
export class Link {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null})
  user_id: Types.ObjectId | null

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