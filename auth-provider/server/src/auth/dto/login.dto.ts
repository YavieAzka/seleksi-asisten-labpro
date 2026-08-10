import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  // Parameter OAuth dari form SSO (semuanya opsional)
  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsString()
  redirect_uri?: string;

  @IsOptional()
  @IsString()
  response_type?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  code_challenge?: string;

  @IsOptional()
  @IsString()
  code_challenge_method?: string;
}
