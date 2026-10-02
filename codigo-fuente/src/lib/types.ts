export type Geology = {
  status: 'ok' | 'empty' | 'unavailable';
  sheet: string | null;
  sheetName: string | null;
  unit: string | null;
  lithology: string | null;
  lithologyOriginal?: string | null;
  source: string;
  sourceUrl: string;
  queriedAt: string;
  via?: 'server' | 'browser';
  error?: string;
};
export type Photo = { id: string; sampleId: string; firingId: string | null; caption: string; createdAt: string; url?: string; objectKey?: string };
export type Firing = {
  id: string; sampleId: string; date: string; temperature: number; atmosphere: string;
  holdMinutes: number | null; color: string; shrinkage: number | null; absorption: number | null;
  description: string; notes: string; createdAt: string;
};
export type Sample = {
  kind?: 'sample';
  id: string; name: string; collectedDate: string; lat: number; lng: number;
  description: string; notes: string; geology: Geology; createdAt: string; updatedAt: string;
  firings: Firing[]; photos: Photo[];
};
export type Point = { lat: number; lng: number };
export type Visit = {
  kind: 'visit'; id: string; name: string; lat: number; lng: number; notes: string;
  plannedDate: string | null; visitStatus: 'pending' | 'visited'; sourceUrl: string | null; sourceTitle: string | null;
  geology: Geology; createdAt: string; updatedAt: string;
  collectedDate: null; description: string; photos: []; firings: [];
};
export type NotebookRecord = Sample | Visit;
export const isVisit = (record: NotebookRecord): record is Visit => record.kind === 'visit';
