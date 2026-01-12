import { HttpClient } from '@angular/common/http';
import { Injectable, inject, isDevMode } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import type { Site, SiteCreatePayload, SiteUpdatePayload } from '../models/site.model';

const JSON_SERVER_DEV = 'http://localhost:3001';

@Injectable({ providedIn: 'root' })
export class SiteService {
  private readonly http = inject(HttpClient);
  private readonly base = `${isDevMode() ? JSON_SERVER_DEV : environment.apiBase}/sites`;

  list(): Observable<Site[]> {
    return this.http.get<Site[]>(this.base);
  }

  get(id: number): Observable<Site> {
    return this.http.get<Site>(`${this.base}/${id}`);
  }

  create(body: SiteCreatePayload): Observable<Site> {
    return this.http.post<Site>(this.base, {
      ...body,
      updatedAt: new Date().toISOString(),
    });
  }

  update(id: number, body: SiteUpdatePayload): Observable<Site> {
    return this.http.patch<Site>(`${this.base}/${id}`, {
      ...body,
      updatedAt: new Date().toISOString(),
    });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
