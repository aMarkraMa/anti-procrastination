import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import {
  CommitmentTask,
  CommitmentTaskInput,
} from '../models/commitment';

const STORAGE_KEY = 'antiproc.commitments.v1';

@Injectable({ providedIn: 'root' })
export class CommitmentStorageService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  createDraft(input: CommitmentTaskInput): CommitmentTask {
    const task: CommitmentTask = {
      ...input,
      id: this.generateId(),
      status: 'Draft',
      steps: [],
      createdAt: new Date().toISOString(),
    };

    const tasks = this.readAll();
    tasks.push(task);
    this.writeAll(tasks);
    return task;
  }

  getById(id: string): CommitmentTask | undefined {
    return this.readAll().find((t) => t.id === id);
  }

  getLatestDraft(): CommitmentTask | undefined {
    const tasks = this.readAll();
    for (let i = tasks.length - 1; i >= 0; i--) {
      if (tasks[i].status === 'Draft') {
        return tasks[i];
      }
    }
    return undefined;
  }

  update(id: string, patch: Partial<CommitmentTask>): CommitmentTask | undefined {
    const tasks = this.readAll();
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) {
      return undefined;
    }
    tasks[index] = { ...tasks[index], ...patch, id: tasks[index].id };
    this.writeAll(tasks);
    return tasks[index];
  }

  remove(id: string): void {
    const tasks = this.readAll().filter((t) => t.id !== id);
    this.writeAll(tasks);
  }

  private readAll(): CommitmentTask[] {
    if (!this.isBrowser) {
      return [];
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as CommitmentTask[]) : [];
    } catch {
      return [];
    }
  }

  private writeAll(tasks: CommitmentTask[]): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // Storage full or blocked - fail silently in dev.
    }
  }

  private generateId(): string {
    if (this.isBrowser && typeof window.crypto?.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
