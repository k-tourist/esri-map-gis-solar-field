import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SitesStore } from '../../core/sites.store';
import type { Site, SystemHealth } from '../../models/site.model';

function sumPanels(sites: Site[]): number {
  return sites.reduce((a, s) => a + (s.panelCount ?? 0), 0);
}

function sumPeakKw(sites: Site[]): number {
  return sites.reduce((a, s) => a + (s.peakKw ?? 0), 0);
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
})
export class DashboardPageComponent implements OnInit {
  readonly store = inject(SitesStore);

  readonly portfolio = computed(() => {
    const all = this.store.sites();
    const pending = this.store.pendingSites();
    const installed = this.store.installedSites();
    return {
      totalSites: all.length,
      pendingCount: pending.length,
      installedCount: installed.length,
      panelsTotal: sumPanels(all),
      panelsInstalled: sumPanels(installed),
      panelsPending: sumPanels(pending),
      peakInstalledKw: sumPeakKw(installed),
      peakPendingKw: sumPeakKw(pending),
    };
  });

  readonly fleet = computed(() => {
    const sites = this.store.installedSites();
    let nameplateKw = 0;
    let acKw = 0;
    let dailyKwh = 0;
    let weeklyKwh = 0;
    let prSum = 0;
    let prN = 0;
    let maxAc = 0;
    for (const s of sites) {
      nameplateKw += s.peakKw ?? 0;
      const e = s.energy;
      const ac = e?.acOutputKw;
      if (ac != null) {
        acKw += ac;
        maxAc = Math.max(maxAc, ac);
      }
      if (e?.dailyYieldKwh != null) {
        dailyKwh += e.dailyYieldKwh;
      }
      if (e?.weeklyYieldKwh != null) {
        weeklyKwh += e.weeklyYieldKwh;
      }
      if (e?.performanceRatioPct != null) {
        prSum += e.performanceRatioPct;
        prN++;
      }
    }
    const avgPrPct = prN > 0 ? prSum / prN : null;
    return {
      sites,
      nameplateKw,
      acKw,
      dailyKwh,
      weeklyKwh,
      avgPrPct,
      maxAc,
    };
  });

  ngOnInit(): void {
    this.store.load();
  }

  trackById(_i: number, s: Site): number {
    return s.id;
  }

  acBarPct(site: Site): number {
    const ac = site.energy?.acOutputKw;
    const max = this.fleet().maxAc;
    if (ac == null || max <= 0) {
      return 0;
    }
    return Math.min(100, (ac / max) * 100);
  }

  acFleetSharePct(site: Site): number | null {
    const ac = site.energy?.acOutputKw;
    const total = this.fleet().acKw;
    if (ac == null || total <= 0) {
      return null;
    }
    return (ac / total) * 100;
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
}
