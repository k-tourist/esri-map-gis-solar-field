import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { SitesStore } from '../../core/sites.store';
import type { Site, SystemHealth } from '../../models/site.model';

@Component({
  selector: 'app-installed-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './installed-page.component.html',
  styleUrl: './installed-page.component.scss',
})
export class InstalledPageComponent {
  readonly store = inject(SitesStore);

  trackById(_i: number, s: Site): number {
    return s.id;
  }

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

  selectRow(id: number): void {
    this.store.selectSiteFromWorkspace(id);
  }
}
