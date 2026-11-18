import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AssessClaimDto } from './assess-claim.dto';
import { ClaimsService } from './claims.service';

@Controller('claims')
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Post('assess')
  assess(@Body() body: AssessClaimDto) {
    return this.claimsService.assess(body);
  }

  @Get(':claimId/assessments')
  listAssessments(@Param('claimId') claimId: string) {
    return this.claimsService.listAssessments(claimId);
  }

  @Get(':claimId/assessments/compare')
  compareAssessments(@Param('claimId') claimId: string, @Query('previousId') previousId: string, @Query('currentId') currentId: string) {
    return this.claimsService.compareAssessments(claimId, previousId, currentId);
  }

  @Get(':claimId/audit-history')
  auditHistory(@Param('claimId') claimId: string) {
    return this.claimsService.listAuditHistory(claimId);
  }
}

