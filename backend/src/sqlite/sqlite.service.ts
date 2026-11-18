import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  AssessmentRecord,
  AssessmentStatus,
  AuditLogRecord,
  ClaimRecord,
  HumanReviewRecord,
  ReviewDecision,
  StudyMetadata,
  TargetAudience,
} from '../claims/claims.types';

type SqlRow = Record<string, unknown>;
type AuditInput = Omit<AuditLogRecord, 'id' | 'createdAt'>;

const EMPTY_AUDIENCE: TargetAudience = { minAge: null, maxAge: null, description: null };
const EMPTY_STUDY: StudyMetadata = {
  minParticipantAge: null,
  maxParticipantAge: null,
  sampleSize: null,
  location: null,
  duration: null,
  studyType: null,
  studyConditions: null,
  outcomeMeasure: null,
  resultSummary: null,
  genderDistribution: null,
  skinType: null,
  season: null,
  measurementMethod: null,
};

@Injectable()
export class SqliteService implements OnModuleInit, OnModuleDestroy {
  private database!: DatabaseSync;

  onModuleInit() {
    const databasePath = resolve(process.cwd(), 'data', 'claims.db');
    mkdirSync(dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec('PRAGMA foreign_keys = ON');
    this.runMigrations();
  }

  private runMigrations() {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS SchemaMigrations (
        version INTEGER PRIMARY KEY,
        appliedAt TEXT NOT NULL
      )
    `);

    if (!this.hasMigration(1)) {
      this.inTransaction(() => {
        this.database.exec(`
          CREATE TABLE IF NOT EXISTS Claim (
            id TEXT PRIMARY KEY,
            productName TEXT,
            claimText TEXT NOT NULL,
            createdAt TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS Assessment (
            id TEXT PRIMARY KEY,
            claimId TEXT NOT NULL REFERENCES Claim(id) ON DELETE CASCADE,
            evidence TEXT NOT NULL,
            justified INTEGER NOT NULL CHECK (justified IN (0, 1)),
            confidenceScore REAL NOT NULL CHECK (confidenceScore >= 0 AND confidenceScore <= 1),
            reasoning TEXT NOT NULL,
            limitations TEXT NOT NULL,
            model TEXT NOT NULL,
            createdAt TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS Assessment_claimId_createdAt_idx
            ON Assessment(claimId, createdAt);
        `);
        this.markMigration(1);
      });
    }

    if (!this.hasMigration(2)) {
      this.inTransaction(() => {
        const assessmentAlreadyHadStatus = this.hasColumn('Assessment', 'assessmentStatus');
        this.ensureColumn('Claim', 'targetAudienceMinAge', 'INTEGER');
        this.ensureColumn('Claim', 'targetAudienceMaxAge', 'INTEGER');
        this.ensureColumn('Claim', 'targetAudienceDescription', 'TEXT');
        this.ensureColumn('Assessment', 'studyVersion', "TEXT NOT NULL DEFAULT 'Study 1'");
        this.ensureColumn(
          'Assessment',
          'assessmentStatus',
          "TEXT NOT NULL DEFAULT 'INCONCLUSIVE' CHECK (assessmentStatus IN ('SUPPORTIVE', 'NOT_SUPPORTIVE', 'INCONCLUSIVE'))",
        );
        this.ensureColumn('Assessment', 'evidenceGaps', "TEXT NOT NULL DEFAULT '[]'");
        this.ensureColumn('Assessment', 'reviewRequired', 'INTEGER NOT NULL DEFAULT 1');
        this.ensureColumn('Assessment', 'recommendation', "TEXT NOT NULL DEFAULT ''");

        if (!assessmentAlreadyHadStatus) {
          this.database.exec(`
            UPDATE Assessment
            SET assessmentStatus = CASE WHEN justified = 1 THEN 'SUPPORTIVE' ELSE 'NOT_SUPPORTIVE' END
          `);
        }

        this.database.exec(`
          CREATE TABLE IF NOT EXISTS StudyMetadata (
            assessmentId TEXT PRIMARY KEY REFERENCES Assessment(id) ON DELETE CASCADE,
            minParticipantAge INTEGER,
            maxParticipantAge INTEGER,
            sampleSize INTEGER,
            location TEXT,
            duration TEXT,
            studyType TEXT,
            studyConditions TEXT,
            outcomeMeasure TEXT,
            resultSummary TEXT,
            genderDistribution TEXT,
            skinType TEXT,
            season TEXT,
            measurementMethod TEXT
          );
          CREATE TABLE IF NOT EXISTS HumanReview (
            id TEXT PRIMARY KEY,
            assessmentId TEXT NOT NULL REFERENCES Assessment(id) ON DELETE CASCADE,
            reviewerName TEXT NOT NULL,
            decision TEXT NOT NULL CHECK (decision IN ('ACCEPTED', 'REJECTED', 'MORE_EVIDENCE_REQUIRED')),
            comments TEXT,
            createdAt TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS HumanReview_assessmentId_createdAt_idx
            ON HumanReview(assessmentId, createdAt);
          CREATE TABLE IF NOT EXISTS AuditLog (
            id TEXT PRIMARY KEY,
            actorId TEXT,
            actorName TEXT,
            entityType TEXT NOT NULL,
            entityId TEXT NOT NULL,
            action TEXT NOT NULL,
            details TEXT NOT NULL,
            createdAt TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS AuditLog_entity_createdAt_idx
            ON AuditLog(entityType, entityId, createdAt);
        `);
        this.markMigration(2);
      });
    }
  }

  private hasMigration(version: number) {
    return Boolean(this.database.prepare('SELECT version FROM SchemaMigrations WHERE version = ?').get(version));
  }

  private markMigration(version: number) {
    this.database.prepare('INSERT INTO SchemaMigrations (version, appliedAt) VALUES (?, ?)')
      .run(version, new Date().toISOString());
  }

  private hasColumn(table: string, column: string) {
    return (this.database.prepare(`PRAGMA table_info(${table})`).all() as SqlRow[])
      .some((row) => row.name === column);
  }

  private ensureColumn(table: string, column: string, definition: string) {
    if (!this.hasColumn(table, column)) {
      this.database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  private inTransaction<T>(operation: () => T): T {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  createClaim(input: {
    claimText: string;
    productName?: string;
    targetAudience?: Partial<TargetAudience>;
  }): ClaimRecord {
    const claim: ClaimRecord = {
      id: randomUUID(),
      claimText: input.claimText.trim(),
      productName: this.cleanText(input.productName),
      targetAudience: this.normalizeAudience(input.targetAudience),
      createdAt: new Date().toISOString(),
    };

    this.inTransaction(() => {
      this.database.prepare(`
        INSERT INTO Claim
          (id, productName, claimText, createdAt, targetAudienceMinAge, targetAudienceMaxAge, targetAudienceDescription)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        claim.id,
        claim.productName,
        claim.claimText,
        claim.createdAt,
        claim.targetAudience.minAge,
        claim.targetAudience.maxAge,
        claim.targetAudience.description,
      );
      this.appendAuditLog({
        actorId: null,
        actorName: null,
        entityType: 'CLAIM',
        entityId: claim.id,
        action: 'CLAIM_CREATED',
        details: { productName: claim.productName },
      });
    });
    return claim;
  }

  getClaimById(id: string): ClaimRecord | null {
    const row = this.database.prepare('SELECT * FROM Claim WHERE id = ?').get(id) as SqlRow | undefined;
    if (!row) return null;
    return {
      id: String(row.id),
      productName: this.nullableText(row.productName),
      claimText: String(row.claimText),
      targetAudience: {
        minAge: this.nullableNumber(row.targetAudienceMinAge),
        maxAge: this.nullableNumber(row.targetAudienceMaxAge),
        description: this.nullableText(row.targetAudienceDescription),
      },
      createdAt: String(row.createdAt),
    };
  }

  countAssessments(claimId: string) {
    const row = this.database.prepare('SELECT COUNT(*) AS count FROM Assessment WHERE claimId = ?').get(claimId) as SqlRow;
    return Number(row.count);
  }

  createAssessment(input: {
    claimId: string;
    studyVersion: string;
    evidence: string;
    assessmentStatus: AssessmentStatus;
    confidenceScore: number;
    reasoning: string;
    evidenceGaps: string[];
    limitations: string[];
    reviewRequired: boolean;
    recommendation: string;
    model: string;
    studyMetadata: StudyMetadata;
    comparisonAudit?: Record<string, unknown>;
  }): AssessmentRecord {
    const assessment: AssessmentRecord = {
      ...input,
      id: randomUUID(),
      justified: input.assessmentStatus === AssessmentStatus.SUPPORTIVE,
      createdAt: new Date().toISOString(),
    };

    this.inTransaction(() => {
      this.database.prepare(`
        INSERT INTO Assessment
          (id, claimId, studyVersion, evidence, justified, assessmentStatus, confidenceScore,
           reasoning, evidenceGaps, limitations, reviewRequired, recommendation, model, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        assessment.id,
        assessment.claimId,
        assessment.studyVersion,
        assessment.evidence,
        assessment.justified ? 1 : 0,
        assessment.assessmentStatus,
        assessment.confidenceScore,
        assessment.reasoning,
        JSON.stringify(assessment.evidenceGaps),
        JSON.stringify(assessment.limitations),
        assessment.reviewRequired ? 1 : 0,
        assessment.recommendation,
        assessment.model,
        assessment.createdAt,
      );
      this.insertStudyMetadata(assessment.id, assessment.studyMetadata);
      this.appendAuditLog({
        actorId: null,
        actorName: null,
        entityType: 'ASSESSMENT',
        entityId: assessment.id,
        action: 'ASSESSMENT_CREATED',
        details: {
          claimId: assessment.claimId,
          studyVersion: assessment.studyVersion,
          model: assessment.model,
          assessmentStatus: assessment.assessmentStatus,
          ...input.comparisonAudit,
        },
      });
    });

    return assessment;
  }

  listAssessmentsForClaim(claimId: string): AssessmentRecord[] {
    const rows = this.database.prepare(`
      SELECT a.*, sm.minParticipantAge, sm.maxParticipantAge, sm.sampleSize, sm.location,
             sm.duration, sm.studyType, sm.studyConditions, sm.outcomeMeasure, sm.resultSummary,
             sm.genderDistribution, sm.skinType, sm.season, sm.measurementMethod
      FROM Assessment a
      LEFT JOIN StudyMetadata sm ON sm.assessmentId = a.id
      WHERE a.claimId = ?
      ORDER BY a.createdAt DESC, a.rowid DESC
    `).all(claimId) as SqlRow[];
    return rows.map((row) => this.mapAssessment(row));
  }

  getAssessmentById(id: string): AssessmentRecord | null {
    const row = this.database.prepare(`
      SELECT a.*, sm.minParticipantAge, sm.maxParticipantAge, sm.sampleSize, sm.location,
             sm.duration, sm.studyType, sm.studyConditions, sm.outcomeMeasure, sm.resultSummary,
             sm.genderDistribution, sm.skinType, sm.season, sm.measurementMethod
      FROM Assessment a
      LEFT JOIN StudyMetadata sm ON sm.assessmentId = a.id
      WHERE a.id = ?
    `).get(id) as SqlRow | undefined;
    return row ? this.mapAssessment(row) : null;
  }

  createHumanReview(input: {
    assessmentId: string;
    reviewerName: string;
    decision: ReviewDecision;
    comments?: string;
  }): HumanReviewRecord {
    const review: HumanReviewRecord = {
      id: randomUUID(),
      assessmentId: input.assessmentId,
      reviewerName: input.reviewerName.trim(),
      decision: input.decision,
      comments: this.cleanText(input.comments),
      createdAt: new Date().toISOString(),
    };
    this.inTransaction(() => {
      this.database.prepare(`
        INSERT INTO HumanReview (id, assessmentId, reviewerName, decision, comments, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(review.id, review.assessmentId, review.reviewerName, review.decision, review.comments, review.createdAt);
      this.appendAuditLog({
        actorId: null,
        actorName: review.reviewerName,
        entityType: 'ASSESSMENT',
        entityId: review.assessmentId,
        action: 'HUMAN_REVIEW_SUBMITTED',
        details: { reviewId: review.id, decision: review.decision, comments: review.comments },
      });
    });
    return review;
  }

  listReviewsForAssessment(assessmentId: string): HumanReviewRecord[] {
    const rows = this.database.prepare(`
      SELECT * FROM HumanReview WHERE assessmentId = ? ORDER BY createdAt DESC, rowid DESC
    `).all(assessmentId) as SqlRow[];
    return rows.map((row) => ({
      id: String(row.id),
      assessmentId: String(row.assessmentId),
      reviewerName: String(row.reviewerName),
      decision: row.decision as ReviewDecision,
      comments: this.nullableText(row.comments),
      createdAt: String(row.createdAt),
    }));
  }

  listAuditHistoryForClaim(claimId: string): AuditLogRecord[] {
    const rows = this.database.prepare(`
      SELECT * FROM AuditLog
      WHERE (entityType = 'CLAIM' AND entityId = ?)
         OR (entityType = 'ASSESSMENT' AND entityId IN (SELECT id FROM Assessment WHERE claimId = ?))
      ORDER BY createdAt ASC, rowid ASC
    `).all(claimId, claimId) as SqlRow[];
    return rows.map((row) => ({
      id: String(row.id),
      actorId: this.nullableText(row.actorId),
      actorName: this.nullableText(row.actorName),
      entityType: String(row.entityType),
      entityId: String(row.entityId),
      action: String(row.action),
      details: this.parseObject(row.details),
      createdAt: String(row.createdAt),
    }));
  }

  recordAuditLog(input: AuditInput) {
    this.appendAuditLog(input);
  }

  private appendAuditLog(input: AuditInput) {
    this.database.prepare(`
      INSERT INTO AuditLog (id, actorId, actorName, entityType, entityId, action, details, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      input.actorId,
      input.actorName,
      input.entityType,
      input.entityId,
      input.action,
      JSON.stringify(input.details),
      new Date().toISOString(),
    );
  }

  private insertStudyMetadata(assessmentId: string, metadata: StudyMetadata) {
    this.database.prepare(`
      INSERT INTO StudyMetadata
        (assessmentId, minParticipantAge, maxParticipantAge, sampleSize, location, duration, studyType,
         studyConditions, outcomeMeasure, resultSummary, genderDistribution, skinType, season, measurementMethod)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      assessmentId,
      metadata.minParticipantAge,
      metadata.maxParticipantAge,
      metadata.sampleSize,
      metadata.location,
      metadata.duration,
      metadata.studyType,
      metadata.studyConditions,
      metadata.outcomeMeasure,
      metadata.resultSummary,
      metadata.genderDistribution,
      metadata.skinType,
      metadata.season,
      metadata.measurementMethod,
    );
  }

  private mapAssessment(row: SqlRow): AssessmentRecord {
    const status = Object.values(AssessmentStatus).includes(row.assessmentStatus as AssessmentStatus)
      ? row.assessmentStatus as AssessmentStatus
      : AssessmentStatus.INCONCLUSIVE;
    return {
      id: String(row.id),
      claimId: String(row.claimId),
      studyVersion: String(row.studyVersion ?? 'Study 1'),
      evidence: String(row.evidence),
      assessmentStatus: status,
      justified: status === AssessmentStatus.SUPPORTIVE,
      confidenceScore: Number(row.confidenceScore),
      reasoning: String(row.reasoning),
      evidenceGaps: this.parseStringArray(row.evidenceGaps),
      limitations: this.parseStringArray(row.limitations),
      reviewRequired: Number(row.reviewRequired ?? 1) === 1,
      recommendation: String(row.recommendation ?? ''),
      model: String(row.model),
      createdAt: String(row.createdAt),
      studyMetadata: {
        minParticipantAge: this.nullableNumber(row.minParticipantAge),
        maxParticipantAge: this.nullableNumber(row.maxParticipantAge),
        sampleSize: this.nullableNumber(row.sampleSize),
        location: this.nullableText(row.location),
        duration: this.nullableText(row.duration),
        studyType: this.nullableText(row.studyType),
        studyConditions: this.nullableText(row.studyConditions),
        outcomeMeasure: this.nullableText(row.outcomeMeasure),
        resultSummary: this.nullableText(row.resultSummary) ?? String(row.evidence),
        genderDistribution: this.nullableText(row.genderDistribution),
        skinType: this.nullableText(row.skinType),
        season: this.nullableText(row.season),
        measurementMethod: this.nullableText(row.measurementMethod),
      },
    };
  }

  private normalizeAudience(value?: Partial<TargetAudience>): TargetAudience {
    return {
      minAge: this.nullableNumber(value?.minAge),
      maxAge: this.nullableNumber(value?.maxAge),
      description: this.cleanText(value?.description),
    };
  }

  private parseStringArray(value: unknown): string[] {
    if (typeof value !== 'string' || value.length === 0) return [];
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string');
    } catch {
      // Older assessments stored limitations as plain text, not JSON.
    }
    return [value];
  }

  private parseObject(value: unknown): Record<string, unknown> {
    if (typeof value !== 'string') return {};
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }

  private cleanText(value?: string | null): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private nullableNumber(value: unknown): number | null {
    return value === null || value === undefined ? null : Number(value);
  }

  private nullableText(value: unknown): string | null {
    return value === null || value === undefined ? null : String(value);
  }

  onModuleDestroy() {
    this.database?.close();
  }
}
