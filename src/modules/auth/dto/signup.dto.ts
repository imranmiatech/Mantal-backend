import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @IsString()
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
