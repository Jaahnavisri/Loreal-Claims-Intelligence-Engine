import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

@Injectable()
export class SqliteService implements OnModuleInit, OnModuleDestroy {
  private database!: DatabaseSync;

  onModuleInit() {
    const databasePath = resolve(process.cwd(), 'data', 'claims.db');
    mkdirSync(dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec(`
      PRAGMA foreign_keys = ON;
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
  }

  createClaim(input: { claimText: string; productName?: string }) {
    const claim = {
      id: randomUUID(),
      claimText: input.claimText,
      productName: input.productName ?? null,
      createdAt: new Date().toISOString(),
    };
    this.database.prepare(
      'INSERT INTO Claim (id, productName, claimText, createdAt) VALUES (?, ?, ?, ?)',
    ).run(claim.id, claim.productName, claim.claimText, claim.createdAt);
    return claim;
  }

  createAssessment(input: {
    claimId: string;
    evidence: string;
    justified: boolean;
    confidenceScore: number;
    reasoning: string;
    limitations: string;
    model: string;
  }) {
    const assessment = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    this.database.prepare(`
      INSERT INTO Assessment
        (id, claimId, evidence, justified, confidenceScore, reasoning, limitations, model, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      assessment.id,
      assessment.claimId,
      assessment.evidence,
      assessment.justified ? 1 : 0,
      assessment.confidenceScore,
      assessment.reasoning,
      assessment.limitations,
      assessment.model,
      assessment.createdAt,
    );
    return assessment;
  }

  onModuleDestroy() {
    this.database?.close();
  }
}

