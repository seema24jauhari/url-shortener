import { IsUrl } from 'class-validator';

export class CreateLinkDto {
  @IsUrl()
  long_url: string;
}