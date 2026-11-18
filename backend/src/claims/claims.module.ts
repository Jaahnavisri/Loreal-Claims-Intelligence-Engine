import { Module } from '@nestjs/common';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';
import { AssessmentsController } from './assessments.controller';
import { EvidenceComparisonService } from './evidence-comparison.service';

@Module({ controllers: [ClaimsController, AssessmentsController], providers: [ClaimsService, EvidenceComparisonService] })
export class ClaimsModule {}

