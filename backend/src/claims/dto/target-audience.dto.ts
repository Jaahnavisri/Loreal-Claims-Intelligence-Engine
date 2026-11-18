import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class TargetAudienceDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  minAge?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  maxAge?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}
