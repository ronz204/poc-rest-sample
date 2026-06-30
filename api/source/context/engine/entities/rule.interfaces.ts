export interface CreateAction {
  flagId: string;
  segmentId: string;
  priority: number;
  outcome: boolean;
  rollout?: number;
};

export interface UpdateAction {
  priority?: number;
  outcome?: boolean;
  rollout?: number | null;
  segmentId?: string;
};
