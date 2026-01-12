import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { SitesStore } from '../core/sites.store';
import type { Site, SystemHealth } from '../models/site.model';

@Component({
  selector: 'app-site-selection-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './site-selection-footer.component.html',
  styleUrl: './site-selection-footer.component.scss',
})
export class SiteSelectionFooterComponent {
  readonly store = inject(SitesStore);

  readonly selectedSite = computed((): Site | null => {
    const id = this.store.selectedId();
    if (id == null) {
      return null;
    }
    return this.store.sites().find((s) => s.id === id) ?? null;
  });

  healthClass(h: SystemHealth | undefined): string {
    switch (h) {
      case 'healthy':
        return 'health-pill--healthy';
      case 'degraded':
        return 'health-pill--degraded';
      case 'fault':
        return 'health-pill--fault';
      case 'offline':
        return 'health-pill--offline';
      default:
        return 'health-pill--unknown';
    }
  }

  healthLabel(h: SystemHealth | undefined): string {
    switch (h) {
      case 'healthy':
        return 'Healthy';
      case 'degraded':
        return 'Degraded';
      case 'fault':
        return 'Fault';
      case 'offline':
        return 'Offline';
      default:
        return 'Unknown';
    }
  }

  onClear(ev: Event): void {
    ev.preventDefault();
    this.store.clearSiteSelection();
  }

  onFocusMapClick(ev: Event, id: number): void {
    ev.preventDefault();
    this.store.selectSiteFromWorkspace(id);
  }

  onInstallClick(ev: Event, s: Site): void {
    ev.preventDefault();
    if (s.lifecycleStatus !== 'pending') {
      return;
    }
    const ok = globalThis.confirm(
      `Commission "${s.name}" as an operational installation? Default health and production telemetry will be applied for demonstration.`,
    );
    if (!ok) {
      return;
    }
    this.store.commission(s.id);
  }

  onUninstallClick(ev: Event, s: Site): void {
    ev.preventDefault();
    if (s.lifecycleStatus !== 'installed') {
      return;
    }
    const ok = globalThis.confirm(
      `Remove "${s.name}" from the catalog? This deletes the installation record and cannot be undone.`,
    );
    if (!ok) {
      return;
    }
    this.store.delete(s.id);
  }

  clampPct(n: number | undefined): number {
    if (n == null || Number.isNaN(n)) {
      return 0;
    }
    return Math.min(100, Math.max(0, n));
  }

  scoreRingStyle(s: Site): Record<string, string> {
    const p = this.clampPct(s.energy?.performanceRatioPct);
    return { '--score-fill': `${p}%` };
  }

  scoreQualitative(s: Site): string {
    const p = this.clampPct(s.energy?.performanceRatioPct);
    if (p >= 85) {
      return 'Very high';
    }
    if (p >= 70) {
      return 'High';
    }
    if (p >= 55) {
      return 'Moderate';
    }
    return 'Low';
  }
}
