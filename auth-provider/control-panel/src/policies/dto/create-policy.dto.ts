// src/policies/dto/create-policy.dto.ts
import { IsString, MinLength } from 'class-validator';

export class CreatePolicyDto {
  @IsString()
  @MinLength(1)
  applicationId!: string;

  @IsString()
  @MinLength(1)
  groupId!: string;
}
