import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class StudyMetadataDto {
  @IsOptional() @IsInt() @Min(0) @Max(120)
  minParticipantAge?: number | null;

  @IsOptional() @IsInt() @Min(0) @Max(120)
  maxParticipantAge?: number | null;

  @IsOptional() @IsInt() @Min(1) @Max(1000000)
  sampleSize?: number | null;

  @IsOptional() @IsString() @MaxLength(160)
  location?: string | null;

  @IsOptional() @IsString() @MaxLength(160)
  duration?: string | null;

  @IsOptional() @IsString() @MaxLength(160)
  studyType?: string | null;

  @IsOptional() @IsString() @MaxLength(1000)
  studyConditions?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  outcomeMeasure?: string | null;

  @IsOptional() @IsString() @MaxLength(1200)
  genderDistribution?: string | null;

  @IsOptional() @IsString() @MaxLength(300)
  skinType?: string | null;

  @IsOptional() @IsString() @MaxLength(120)
  season?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  measurementMethod?: string | null;
}
