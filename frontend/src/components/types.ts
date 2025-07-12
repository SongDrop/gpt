export type DatabaseType =
  | "Azure Cognitive Search"
  | "Azure Cosmos DB"
  | "Azure Blob Storage"
  | "Community Shared";

export interface Contributor {
  id: string;
  name: string;
  avatar?: string;
}

export interface RagDatabase {
  id: string;
  name: string;
  description: string;
  type: DatabaseType;
  owner: Contributor;
  contributors: Contributor[];
  isPublic: boolean;
  tags: string[];
  lastUpdated: string;
  documentCount: number;
  usageCount: number;
  rating?: number;
  isSelected: boolean;
  files?: {
    name: string;
    size: number;
    type: string;
    uploadedAt: string;
  }[];
}

export interface DatabaseFilterOptions {
  searchQuery: string;
  typeFilter: DatabaseType | "all";
  ownershipFilter: "all" | "mine" | "community";
  sortBy: "lastUpdated" | "name" | "documentCount" | "usageCount";
  sortDirection: "asc" | "desc";
}
