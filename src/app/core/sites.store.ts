import { computed, inject, Injectable, signal } from '@angular/core';
import { SiteRepository } from './site.repository';
import type {
  Site,
  SiteCreatePayload,
  SiteEnergySnapshot,
  SiteFootprintVertex,
  SiteLifecycle,
  SiteUpdatePayload,
} from '../models/site.model';

const MAX_DRAFT_FOOTPRINT_VERTICES = 24;

export type WorkspaceTab = 'pending' | 'installed';

@Injectable({ providedIn: 'root' })
export class SitesStore {
  private readonly repository = inject(SiteRepository);

  readonly sites = signal<Site[]>([]);
  readonly selectedId = signal<number | null>(null);
  readonly workspaceFocusNonce = signal(0);
  readonly addMode = signal(false);
  readonly draftFootprintVertices = signal<SiteFootprintVertex[]>([]);
  readonly draftPlacement = computed(() => {
    const verts = this.draftFootprintVertices();
    if (verts.length === 0) {
      return null;
    }
    const n = verts.length;
    const longitude = verts.reduce((s, v) => s + v.longitude, 0) / n;
    const latitude = verts.reduce((s, v) => s + v.latitude, 0) / n;
    const z = verts.reduce((s, v) => s + (v.z ?? 40), 0) / n;
    return { longitude, latitude, z };
  });
  readonly apiError = signal('');
  readonly workspaceTab = signal<WorkspaceTab>('pending');

  readonly pendingSites = computed(() =>
    this.sites().filter((s) => s.lifecycleStatus === 'pending'),
  );

  readonly installedSites = computed(() =>
    this.sites().filter((s) => s.lifecycleStatus === 'installed'),
  );

  load(): void {
    this.apiError.set('');
    this.repository.list().subscribe({
      next: (list) => this.sites.set(list.map(normalizeSite)),
      error: () => this.apiError.set('Unable to load sites.'),
    });
  }

  setWorkspaceTab(tab: WorkspaceTab): void {
    this.workspaceTab.set(tab);
    const id = this.selectedId();
    if (id == null) {
      return;
    }
    const site = this.sites().find((s) => s.id === id);
    if (!site) {
      this.selectedId.set(null);
      return;
    }
    const inTab =
      tab === 'pending'
        ? site.lifecycleStatus === 'pending'
        : site.lifecycleStatus === 'installed';
    if (!inTab) {
      this.selectedId.set(null);
    }
  }

  selectSite(id: number): void {
    const site = this.sites().find((s) => s.id === id);
    if (site) {
      this.workspaceTab.set(
        site.lifecycleStatus === 'installed' ? 'installed' : 'pending',
      );
    }
    this.selectedId.set(id);
    this.draftFootprintVertices.set([]);
  }

  clearSiteSelection(): void {
    this.selectedId.set(null);
  }

  selectSiteFromWorkspace(id: number): void {
    this.selectSite(id);
    this.workspaceFocusNonce.update((n) => n + 1);
  }

  clearAddMode(): void {
    this.addMode.set(false);
    this.draftFootprintVertices.set([]);
  }

  toggleAddMode(): void {
    const next = !this.addMode();
    if (next) {
      this.draftFootprintVertices.set([]);
      this.selectedId.set(null);
    } else {
      this.draftFootprintVertices.set([]);
    }
    this.addMode.set(next);
  }

  cancelDraft(): void {
    this.draftFootprintVertices.set([]);
    this.addMode.set(false);
  }

  onMapSiteSelected(id: number): void {
    this.selectSite(id);
    this.addMode.set(false);
  }

  appendDraftFootprintVertex(p: SiteFootprintVertex): void {
    if (!this.addMode()) {
      return;
    }
    this.selectedId.set(null);
    this.draftFootprintVertices.update((v) => {
      if (v.length >= MAX_DRAFT_FOOTPRINT_VERTICES) {
        return v;
      }
      return [...v, { longitude: p.longitude, latitude: p.latitude, z: p.z }];
    });
  }

  undoDraftFootprintVertex(): void {
    this.draftFootprintVertices.update((v) => v.slice(0, -1));
  }

  create(payload: SiteCreatePayload): void {
    this.apiError.set('');
    const body: SiteCreatePayload = {
      ...payload,
      lifecycleStatus: 'pending',
    };
    this.repository.create(body).subscribe({
      next: (created) => {
        this.load();
        this.addMode.set(false);
        this.draftFootprintVertices.set([]);
        this.workspaceTab.set('pending');
        this.selectedId.set(created.id);
      },
      error: () => this.apiError.set('Unable to create the site.'),
    });
  }

  update(id: number, body: SiteUpdatePayload): void {
    this.apiError.set('');
    this.repository.update(id, body).subscribe({
      next: () => this.load(),
      error: () => this.apiError.set('Unable to update the site.'),
    });
  }

  delete(id: number): void {
    this.apiError.set('');
    this.repository.delete(id).subscribe({
      next: () => {
        if (this.selectedId() === id) {
          this.selectedId.set(null);
        }
        this.load();
      },
      error: () => this.apiError.set('Unable to delete the site.'),
    });
  }

  commission(siteId: number): void {
    const site = this.sites().find((s) => s.id === siteId);
    if (!site || site.lifecycleStatus !== 'pending') {
      return;
    }
    const installDate = new Date().toISOString();
    const energy = demoEnergyFor(site);
    const patch: SiteUpdatePayload = {
      lifecycleStatus: 'installed',
      installDate,
      systemHealth: 'healthy',
      energy,
    };
    this.apiError.set('');
    this.repository.update(siteId, patch).subscribe({
      next: () => {
        this.load();
        this.workspaceTab.set('installed');
        this.selectedId.set(siteId);
      },
      error: () => this.apiError.set('Unable to commission this installation.'),
    });
  }
}

function normalizeSite(raw: Site): Site {
  const r = raw as unknown as { status?: string; lifecycleStatus?: SiteLifecycle };
  const lifecycle: SiteLifecycle =
    r.lifecycleStatus ??
    (r.status === 'installed'
      ? 'installed'
      : r.status === 'planned' || r.status === 'pending'
        ? 'pending'
        : 'pending');
  return { ...raw, lifecycleStatus: lifecycle };
}

function demoEnergyFor(site: Site): SiteEnergySnapshot {
  const cap = Math.max(site.peakKw, 1);
  const t = ((site.id * 7919) % 1000) / 1000;
  const ac = Math.min(cap, cap * (0.58 + t * 0.28));
  return {
    acOutputKw: Math.round(ac * 10) / 10,
    dailyYieldKwh: Math.round((ac * 4.2 + t * 12) * 10) / 10,
    weeklyYieldKwh: Math.round((ac * 29 + t * 55) * 10) / 10,
    dcStringVoltageV: Math.round(330 + t * 70),
    gridFrequencyHz: 60,
    performanceRatioPct: Math.round(79 + t * 16),
  };
}
