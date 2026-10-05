export interface Project {
  id: string;
  name: string;
  createdAt: any;
  totalCost: number;
  ownerId?: string;
  role?: ProjectRole;
  shared?: boolean;
}

export type ProjectRole = "owner" | "manager" | "office" | "chief" | "field";
