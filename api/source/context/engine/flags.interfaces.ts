export interface CreateAction {
  key: string;
  name: string;
  short: string;
};

export interface UpdateAction {
  name?: string;
  short?: string;
  default?: boolean;
};
