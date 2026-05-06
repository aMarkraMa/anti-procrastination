export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';
export type WorkStyle = 'Fast' | 'Steady' | 'HighQuality';
export type CommitmentStatus = 'Draft' | 'Confirmed' | 'InProgress' | 'Completed' | 'Failed';
export type StepStatus = 'Pending' | 'InProgress' | 'Completed' | 'Failed';

export interface CommitmentTaskInput {
  title: string;
  description: string;
  finalDeadline: string;
  commitmentAmount: number;
  difficultyLevel: DifficultyLevel;
  preferredStepCount: number;
  workStyle: WorkStyle;
}

export interface CommitmentTask extends CommitmentTaskInput {
  id: string;
  status: CommitmentStatus;
  steps: CommitmentStep[];
  createdAt: string;
}

export interface CommitmentStep {
  id: string;
  taskId: string;
  order: number;
  title: string;
  description: string;
  expectedOutput: string;
  timeLimitMinutes: number;
  assignedCredit: number;
  status: StepStatus;
  extensionsUsed: number;
  maxExtensions: number;
  startedAt?: string;
  completedAt?: string;
}
