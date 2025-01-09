export type SiteLifecycle = 'pending' | 'installed';

export type SystemHealth = 'healthy' | 'degraded' | 'fault' | 'offline' | 'unknown';

export interface SiteEnergySnapshot {
  acOutputKw?: number;
  dailyYieldKwh?: number;
  weeklyYieldKwh?: number;
  dcStringVoltageV?: number;
  gridFrequencyHz?: number;
  performanceRatioPct?: number;
}

export interface SiteFootprintVertex {
  longitude: number;
  latitude: number;
  z?: number;
}

export interface SitePointGeometry {
  type: 'point';
  longitude: number;
  latitude: number;
  z?: number;
  footprintMeters?: { lengthM: number; widthM: number };
  footprintRing?: SiteFootprintVertex[];
}

export interface Site {
  id: number;
  name: string;
  geometry: SitePointGeometry;
  tiltDeg: number;
  azimuthDeg: number;
  peakKw: number;
  panelCount: number;
  notes: string;
  lifecycleStatus: SiteLifecycle;
  updatedAt?: string;
  installDate?: string;
  systemHealth?: SystemHealth;
  energy?: SiteEnergySnapshot;
}

export type SiteCreatePayload = Omit<Site, 'id'> & {
  updatedAt?: string;
  installDate?: string;
  systemHealth?: SystemHealth;
  energy?: SiteEnergySnapshot;
};

export type SiteUpdatePayload = Partial<Omit<Site, 'id'>> & {
  geometry?: SitePointGeometry;
  updatedAt?: string;
};
