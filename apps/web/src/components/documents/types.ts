export type DocumentFolder = {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentItem = {
  id: string;
  projectId: string;
  folderId: string | null;
  name: string;
  size: number;
  contentType: string;
  createdBy: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};
