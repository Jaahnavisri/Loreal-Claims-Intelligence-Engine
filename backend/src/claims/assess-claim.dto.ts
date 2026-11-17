import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AssessClaimDto {
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  claimText!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productName?: string;

  @IsString()
  @MinLength(30)
  @MaxLength(12000)
  evidence!: string;
}

