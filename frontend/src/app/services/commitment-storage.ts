import { Injectable } from '@angular/core';

import { CommitmentStep, CommitmentTask, CommitmentTaskInput } from '../models/commitment';

const STORAGE_KEY = 'commitment_tasks';

@Injectable({ providedIn: 'root' })
export class CommitmentStorageService {
  createDraft(input: CommitmentTaskInput): CommitmentTask {
    const taskId = crypto.randomUUID();
    const task: CommitmentTask = {
      ...input,
      id: taskId,
      status: 'Draft',
      steps: this.generateMockSteps(taskId, input),
      createdAt: new Date().toISOString(),
    };

    const tasks = this.getAll();
    this.saveAll([task, ...tasks]);

    return task;
  }

  getAll(): CommitmentTask[] {
    const rawTasks = localStorage.getItem(STORAGE_KEY);

    if (!rawTasks) {
      return [];
    }

    try {
      return JSON.parse(rawTasks) as CommitmentTask[];
    } catch {
      return [];
    }
  }

  getLatestDraft(): CommitmentTask | undefined {
    return this.getAll().find((task) => task.status === 'Draft');
  }

  getById(taskId: string): CommitmentTask | undefined {
    return this.getAll().find((task) => task.id === taskId);
  }

  private saveAll(tasks: CommitmentTask[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  private generateMockSteps(taskId: string, input: CommitmentTaskInput): CommitmentStep[] {
    const stepCount = input.preferredStepCount;
    const credits = this.splitCredit(input.commitmentAmount, stepCount);
    const baseMinutes = this.getBaseMinutes(input.difficultyLevel, input.workStyle);

    return Array.from({ length: stepCount }, (_, index) => {
      const order = index + 1;

      return {
        id: crypto.randomUUID(),
        taskId,
        order,
        title: this.getStepTitle(order, stepCount, input.title),
        description: this.getStepDescription(order, stepCount, input),
        expectedOutput: this.getExpectedOutput(order, stepCount, input.title),
        timeLimitMinutes: baseMinutes + index * 5,
        assignedCredit: credits[index],
        status: 'Pending',
        extensionsUsed: 0,
        maxExtensions: 3,
      };
    });
  }

  private splitCredit(total: number, count: number): number[] {
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / count);
    const remainder = cents - base * count;

    return Array.from({ length: count }, (_, index) => {
      const value = base + (index < remainder ? 1 : 0);
      return value / 100;
    });
  }

  private getBaseMinutes(difficulty: CommitmentTaskInput['difficultyLevel'], style: CommitmentTaskInput['workStyle']): number {
    const difficultyMinutes = {
      Easy: 25,
      Medium: 40,
      Hard: 55,
    }[difficulty];

    const styleAdjustment = {
      Fast: -5,
      Steady: 0,
      HighQuality: 10,
    }[style];

    return difficultyMinutes + styleAdjustment;
  }

  private getStepTitle(order: number, stepCount: number, title: string): string {
    if (order === 1) {
      return `Clarify scope for ${title}`;
    }

    if (order === stepCount) {
      return `Finalize and verify ${title}`;
    }

    return `Complete milestone ${order} for ${title}`;
  }

  private getStepDescription(order: number, stepCount: number, input: CommitmentTaskInput): string {
    if (order === 1) {
      return `Turn the task description into a concrete checklist and identify the first visible output for: ${input.description}`;
    }

    if (order === stepCount) {
      return 'Review the finished work, fix obvious gaps, and prepare evidence that the commitment is complete.';
    }

    return `Work on a focused slice of the task using the ${input.workStyle} style, keeping the output small enough to finish within this step.`;
  }

  private getExpectedOutput(order: number, stepCount: number, title: string): string {
    if (order === 1) {
      return 'A short checklist with a clear next action.';
    }

    if (order === stepCount) {
      return `A final, reviewable version of "${title}" with completion evidence.`;
    }

    return 'A concrete intermediate deliverable that can be checked before moving on.';
  }
}
