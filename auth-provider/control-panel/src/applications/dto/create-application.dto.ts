// src/applications/dto/create-application.dto.ts
import { IsString, IsUrl, MinLength } from 'class-validator';

export class CreateApplicationDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  clientId!: string;

  @IsString()
  @MinLength(1)
  logoutNotificationUrl!: string;

  @IsString()
  redirectUri!: string; // redirect URI pertama, bisa ditambah lagi setelah dibuat
}
