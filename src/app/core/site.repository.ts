import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { INITIAL_SITES } from '../data/sites.seed';
import type { Site, SiteCreatePayload, SiteUpdatePayload } from '../models/site.model';

@Injectable({ providedIn: 'root' })
export class SiteRepository {
  private sites: Site[] = structuredClone(INITIAL_SITES);

  list(): Observable<Site[]> {
    return of(structuredClone(this.sites));
  }

  get(id: number): Observable<Site> {
    const site = this.sites.find((s) => s.id === id);
    return site ? of(structuredClone(site)) : throwError(() => new Error('Not found'));
  }

  create(body: SiteCreatePayload): Observable<Site> {
    const id = this.nextId();
    const updatedAt = new Date().toISOString();
    const site: Site = { ...body, id, updatedAt };
    this.sites.push(site);
    return of(structuredClone(site));
  }

  update(id: number, body: SiteUpdatePayload): Observable<Site> {
    const idx = this.sites.findIndex((s) => s.id === id);
    if (idx < 0) {
      return throwError(() => new Error('Not found'));
    }
    const current = this.sites[idx];
    const next: Site = {
      ...current,
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };
    this.sites[idx] = next;
    return of(structuredClone(next));
  }

  delete(id: number): Observable<void> {
    const idx = this.sites.findIndex((s) => s.id === id);
    if (idx < 0) {
      return throwError(() => new Error('Not found'));
    }
    this.sites.splice(idx, 1);
    return of(void 0);
  }

  private nextId(): number {
    return this.sites.reduce((max, s) => Math.max(max, s.id), 0) + 1;
  }
}
