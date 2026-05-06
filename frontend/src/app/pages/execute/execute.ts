import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import {
  CommitmentStep,
  CommitmentTask,
  EXTENSION_RATIO,
} from '../../models/commitment';
import { CommitmentStorageService } from '../../services/commitment-storage';
import { TopbarComponent } from '../../components/topbar';
import { ConfettiComponent } from '../../components/confetti';
import { StepRewardComponent } from '../../components/step-reward';
import { formatEuro, roundCents } from '../../utils/currency';

@Component({
  selector: 'app-execute',
  standalone: true,
  imports: [RouterModule, TopbarComponent, ConfettiComponent, StepRewardComponent],
  templateUrl: './execute.html',
  styleUrls: ['./execute.css'],
})
export class ExecuteComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storage = inject(CommitmentStorageService);

  protected readonly tick = signal(0);
  protected readonly version = signal(0);
  protected readonly finalizing = signal(false);

  // Celebration state
  protected readonly confettiTrigger = signal(0);
  protected readonly rewardTrigger = signal(0);
  protected readonly rewardAmount = signal(0);
  protected readonly rewardIsFinal = signal(false);
  protected readonly earnedPulse = signal(false);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private earnedPulseTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly task = computed<CommitmentTask | undefined>(() => {
    this.version();
    const taskId = this.route.snapshot.queryParamMap.get('taskId');
    return taskId ? this.storage.getById(taskId) : this.storage.getActiveTask();
  });

  protected readonly activeStep = computed<CommitmentStep | undefined>(() => {
    return this.task()?.steps.find((s) => s.status === 'Active');
  });

  protected readonly activeIndex = computed(() => {
    const t = this.task();
    if (!t) return 0;
    const idx = t.steps.findIndex((s) => s.status === 'Active');
    return idx === -1 ? t.steps.length - 1 : idx;
  });

  protected readonly completedCount = computed(
    () => this.task()?.steps.filter((s) => s.status === 'Completed').length ?? 0,
  );

  protected readonly earnedCredit = computed(() =>
    roundCents(
      this.task()
        ?.steps.filter((s) => s.status === 'Completed')
        .reduce((sum, s) => sum + s.assignedCredit, 0) ?? 0,
    ),
  );

  protected readonly atRiskCredit = computed(() => {
    const t = this.task();
    if (!t) return 0;
    return roundCents(
      t.steps
        .filter((s) => s.status !== 'Completed')
        .reduce((sum, s) => sum + s.assignedCredit, 0),
    );
  });

  protected readonly formatEuro = formatEuro;

  protected readonly remainingMs = computed(() => {
    this.tick();
    const step = this.activeStep();
    if (!step?.deadline) return 0;
    return new Date(step.deadline).getTime() - Date.now();
  });

  protected readonly overdue = computed(() => this.remainingMs() < 0);

  protected readonly lowTime = computed(() => {
    const ms = this.remainingMs();
    if (ms < 0) return false;
    const step = this.activeStep();
    if (!step) return false;
    return ms < step.timeLimitMinutes * 60 * 1000 * 0.2;
  });

  protected readonly countdown = computed(() => {
    const ms = this.remainingMs();
    if (ms < 0) return '00:00';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
      return `${this.pad(h)}:${this.pad(m)}:${this.pad(s)}`;
    }
    return `${this.pad(m)}:${this.pad(s)}`;
  });

  protected readonly canExtend = computed(() => {
    const step = this.activeStep();
    if (!step) return false;
    return step.extensionsUsed < step.maxExtensions && this.remainingMs() > 0;
  });

  protected accountLabel(): string {
    const t = this.task();
    if (!t?.payment) return '';
    return `DB-${t.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  }

  protected deadlineLabel(): string {
    const step = this.activeStep();
    if (!step?.deadline) return '';
    const dt = new Date(step.deadline);
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  protected extensionMinutes(step: CommitmentStep): number {
    return Math.max(1, Math.round(step.timeLimitMinutes * EXTENSION_RATIO));
  }

  ngOnInit(): void {
    this.intervalId = setInterval(() => {
      this.tick.set(this.tick() + 1);
      if (this.overdue() && !this.finalizing()) {
        this.failNow();
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.earnedPulseTimer !== null) {
      clearTimeout(this.earnedPulseTimer);
      this.earnedPulseTimer = null;
    }
  }

  protected extend(): void {
    const t = this.task();
    const step = this.activeStep();
    if (!t || !step || !this.canExtend()) return;

    const addMs = this.extensionMinutes(step) * 60 * 1000;
    const newDeadline = new Date(
      new Date(step.deadline ?? new Date().toISOString()).getTime() + addMs,
    ).toISOString();

    const steps = t.steps.map((s) =>
      s.id === step.id
        ? { ...s, extensionsUsed: s.extensionsUsed + 1, deadline: newDeadline }
        : s,
    );
    this.storage.update(t.id, { steps });
    this.touch();
  }

  protected completeStep(): void {
    const t = this.task();
    const step = this.activeStep();
    if (!t || !step) return;
    if (this.overdue()) return;

    const now = new Date().toISOString();
    const stepIndex = t.steps.findIndex((s) => s.id === step.id);

    const steps: CommitmentStep[] = t.steps.map((s, i) => {
      if (i === stepIndex) {
        return { ...s, status: 'Completed' as const, completedAt: now };
      }
      if (i === stepIndex + 1) {
        return {
          ...s,
          status: 'Active' as const,
          startedAt: now,
          deadline: new Date(
            Date.now() + s.timeLimitMinutes * 60 * 1000,
          ).toISOString(),
        };
      }
      return s;
    });

    const allDone = steps.every((s) => s.status === 'Completed');
    this.storage.update(t.id, {
      steps,
      ...(allDone ? { status: 'Completed' as const, completedAt: now } : {}),
    });
    this.touch();

    this.fireReward(step.assignedCredit, allDone);

    if (allDone) {
      // Give the celebration a moment before transitioning.
      setTimeout(() => {
        this.router.navigate(['/result'], { queryParams: { taskId: t.id } });
      }, 1500);
    }
  }

  private fireReward(amount: number, isFinal: boolean): void {
    this.rewardAmount.set(amount);
    this.rewardIsFinal.set(isFinal);
    this.rewardTrigger.set(this.rewardTrigger() + 1);
    this.confettiTrigger.set(this.confettiTrigger() + 1);

    this.earnedPulse.set(true);
    if (this.earnedPulseTimer !== null) clearTimeout(this.earnedPulseTimer);
    this.earnedPulseTimer = setTimeout(() => this.earnedPulse.set(false), 900);
  }

  protected giveUp(): void {
    if (this.finalizing()) return;
    this.finalize('Abandoned');
  }

  private failNow(): void {
    this.finalize('Failed');
  }

  private finalize(status: 'Failed' | 'Abandoned'): void {
    const t = this.task();
    if (!t) return;
    this.finalizing.set(true);
    const now = new Date().toISOString();

    const steps: CommitmentStep[] = t.steps.map((s) => {
      if (s.status === 'Completed') return s;
      return { ...s, status: 'Failed' as const, failedAt: s.failedAt ?? now };
    });

    this.storage.update(t.id, {
      steps,
      status,
      failedAt: now,
    });

    this.router.navigate(['/result'], { queryParams: { taskId: t.id } });
  }

  private touch(): void {
    this.version.set(this.version() + 1);
  }

  private pad(n: number): string {
    return n.toString().padStart(2, '0');
  }
}
