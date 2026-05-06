import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { CommitmentTask } from '../../models/commitment';
import { CommitmentStorageService } from '../../services/commitment-storage';

@Component({
  selector: 'app-review',
  standalone: true,
  imports: [CurrencyPipe, RouterModule],
  templateUrl: './review.html',
  styleUrls: ['./review.css'],
})
export class ReviewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly storage = inject(CommitmentStorageService);

  protected readonly task = computed<CommitmentTask | undefined>(() => {
    const taskId = this.route.snapshot.queryParamMap.get('taskId');
    return taskId ? this.storage.getById(taskId) : this.storage.getLatestDraft();
  });

  protected readonly assignedTotal = computed(() => {
    const task = this.task();
    return task?.steps.reduce((sum, step) => sum + step.assignedCredit, 0) ?? 0;
  });
}
