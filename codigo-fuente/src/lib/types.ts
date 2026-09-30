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
  id: string; name: string; collectedDate: string; lat: number; lng: number;
  description: string; notes: string; geology: Geology; createdAt: string; updatedAt: string;
  firings: Firing[]; photos: Photo[];
};
export type Point = { lat: number; lng: number };
