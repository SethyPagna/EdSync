export const ALL_CLASSES_SCOPE = "all";

type ClassScopeRow = {
  id: string;
};

type SearchParamsReader = {
  get(name: string): string | null;
};

export function classScopeFromSearchParams(searchParams: SearchParamsReader | null | undefined) {
  const classId = searchParams?.get("classId")?.trim();
  return classId || ALL_CLASSES_SCOPE;
}

export function hasClassScope(classes: ClassScopeRow[], classId: string) {
  return classId === ALL_CLASSES_SCOPE || classes.some((classRow) => classRow.id === classId);
}

export function scopedClassHref(path: string, classId: string) {
  if (classId === ALL_CLASSES_SCOPE) return path;
  const params = new URLSearchParams({ classId });
  return `${path}?${params.toString()}`;
}
