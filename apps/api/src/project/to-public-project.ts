export function toPublicProject<
  T extends {
    backgroundObjectKey?: string | null;
    backgroundMimeType?: string | null;
  },
>(project: T) {
  const {
    backgroundObjectKey: _backgroundObjectKey,
    backgroundMimeType: _backgroundMimeType,
    ...publicProject
  } = project;
  return publicProject;
}
