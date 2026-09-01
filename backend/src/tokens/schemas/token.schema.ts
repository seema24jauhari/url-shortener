import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';

// tokens/schemas/token.schema.ts
@Schema()
export class Token {
  @Prop({ required: true }) user_id: string;
  @Prop({ required: true }) refresh_token_hash: string;
  @Prop({ required: true, expires: 0 }) expires_at: Date; // TTL index
  @Prop({ default: false }) revoked: boolean;
}

export const TokenSchema = SchemaFactory.createForClass(Token);
