import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { SitesStore } from '../../core/sites.store';
import { SitePanelComponent } from '../../sites/site-panel.component';

@Component({
  selector: 'app-pending-page',
  standalone: true,
  imports: [CommonModule, SitePanelComponent],
  templateUrl: './pending-page.component.html',
  styleUrl: './pending-page.component.scss',
})
export class PendingPageComponent {
  readonly store = inject(SitesStore);
}
