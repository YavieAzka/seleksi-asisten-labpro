// src/applications/dto/update-application.dto.ts
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateApplicationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsString()
  launchUrl?: string;

  @IsOptional()
  @IsString()
  logoutNotificationUrl?: string;
}
