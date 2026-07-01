import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
