// src/applications/dto/add-redirect-uri.dto.ts
import { IsString, MinLength } from 'class-validator';

export class AddRedirectUriDto {
  @IsString()
  @MinLength(1)
  redirectUri!: string;
}
