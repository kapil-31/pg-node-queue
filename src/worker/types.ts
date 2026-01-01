export interface JobContext {
  jobId: string;
  retryCount: number;
  runOnce(
    key: string,
    fn: () => Promise<void>
  ): Promise<void>;
}

export type JobHandler<T = any> = (
  payload: T,
  ctx: JobContext
) => Promise<void>;


export type JobStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "RETRYABLE"
  | "COMPLETED"
  | "DEAD_LETTER";