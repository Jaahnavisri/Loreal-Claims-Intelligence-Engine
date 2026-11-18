export enum AssessmentStatus {
  SUPPORTIVE = 'SUPPORTIVE',
  NOT_SUPPORTIVE = 'NOT_SUPPORTIVE',
  INCONCLUSIVE = 'INCONCLUSIVE',
}

export enum ReviewDecision {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  MORE_EVIDENCE_REQUIRED = 'MORE_EVIDENCE_REQUIRED',
}

export enum FindingStatus {
  MATCHED = 'MATCHED',
  DIFFERENCE_FOUND = 'DIFFERENCE_FOUND',
  MISSING_INFORMATION = 'MISSING_INFORMATION',
}

export interface TargetAudience {
  minAge: number | null;
  maxAge: number | null;
  description: string | null;
}

export interface StudyMetadata {
  minParticipantAge: number | null;
  maxParticipantAge: number | null;
  sampleSize: number | null;
  location: string | null;
  duration: string | null;
  studyType: string | null;
  studyConditions: string | null;
  outcomeMeasure: string | null;
  resultSummary: string | null;
  genderDistribution: string | null;
  skinType: string | null;
  season: string | null;
  measurementMethod: string | null;
}

export interface ClaimRecord {
  id: string;
  productName: string | null;
  claimText: string;
  targetAudience: TargetAudience;
  createdAt: string;
}

export interface AssessmentRecord {
  id: string;
  claimId: string;
  studyVersion: string;
  evidence: string;
  assessmentStatus: AssessmentStatus;
  justified: boolean;
  confidenceScore: number;
  reasoning: string;
  evidenceGaps: string[];
  limitations: string[];
  reviewRequired: boolean;
  recommendation: string;
  model: string;
  createdAt: string;
  studyMetadata: StudyMetadata;
}

export interface HumanReviewRecord {
  id: string;
  assessmentId: string;
  reviewerName: string;
  decision: ReviewDecision;
  comments: string | null;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  actorId: string | null;
  actorName: string | null;
  entityType: string;
  entityId: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface EvidenceFinding {
  field: string;
  label: string;
  status: FindingStatus;
  targetValue: string | number | null;
  previousValue: string | number | null;
  currentValue: string | number | null;
  explanation: string;
}
