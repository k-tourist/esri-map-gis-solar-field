import { Component, input, output } from '@angular/core';
import type { Site } from '../models/site.model';

@Component({
  selector: 'app-map-panel',
  standalone: true,
  template: `<div class="map-panel-stub" role="presentation"></div>`,
  styles: [
    `
      :host {
        display: flex;
        flex: 1;
        min-height: 0;
      }
      .map-panel-stub {
        flex: 1;
        background: linear-gradient(180deg, #1b2430 0%, #121820 100%);
      }
    `,
  ],
})
export class MapPanelComponent {
  readonly sites = input.required<Site[]>();
  readonly selectedId = input<number | null>(null);
  readonly addMode = input(false);
  readonly siteSelected = output<number>();
}
