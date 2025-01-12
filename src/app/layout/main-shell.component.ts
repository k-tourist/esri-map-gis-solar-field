import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MapPanelComponent } from '../map/map-panel.component';
import { SitesStore } from '../core/sites.store';
import { PendingPageComponent } from '../features/pending/pending-page.component';
import { InstalledPageComponent } from '../features/installed/installed-page.component';
import { SiteSelectionFooterComponent } from './site-selection-footer.component';

@Component({
  selector: 'app-main-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MapPanelComponent,
    SiteSelectionFooterComponent,
    PendingPageComponent,
    InstalledPageComponent,
  ],
  templateUrl: './main-shell.component.html',
  styleUrl: './main-shell.component.scss',
})
export class MainShellComponent implements OnInit {
  readonly store = inject(SitesStore);

  readonly mapAddEnabled = computed(
    () => this.store.addMode() && this.store.workspaceTab() === 'pending',
  );

  ngOnInit(): void {
    this.store.load();
  }

  onMapSite(id: number): void {
    this.store.onMapSiteSelected(id);
  }
}
