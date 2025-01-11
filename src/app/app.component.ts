import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SitesStore } from './core/sites.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  private readonly sitesStore = inject(SitesStore);

  title = 'urban-scene';

  ngOnInit(): void {
    this.sitesStore.load();
  }
}
