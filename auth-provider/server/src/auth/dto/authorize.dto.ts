import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class AuthorizeDto {
  @IsString()
  @IsNotEmpty()
  client_id!: string;

  @IsString()
  @IsNotEmpty()
  redirect_uri!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['code'])
  response_type!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsString()
  @IsNotEmpty()
  code_challenge!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['S256'])
  code_challenge_method!: string;
}
