import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import type {
  Site,
  SiteCreatePayload,
  SiteFootprintVertex,
  SiteUpdatePayload,
} from '../models/site.model';

@Component({
  selector: 'app-site-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './site-panel.component.html',
  styleUrl: './site-panel.component.scss',
})
export class SitePanelComponent implements OnChanges {
  @Input() sites: Site[] = [];
  @Input() selectedId: number | null = null;
  @Input() addMode = false;
  @Input() draftPlacement: {
    longitude: number;
    latitude: number;
    z: number;
  } | null = null;
  @Input() draftFootprintVertices: SiteFootprintVertex[] = [];
  @Input() apiError = '';

  @Output() readonly pickSite = new EventEmitter<number>();
  @Output() readonly toggleAddMode = new EventEmitter<void>();
  @Output() readonly cancelDraft = new EventEmitter<void>();
  @Output() readonly undoDraftCorner = new EventEmitter<void>();
  @Output() readonly saveCreate = new EventEmitter<SiteCreatePayload>();
  @Output() readonly saveUpdate = new EventEmitter<{
    id: number;
    body: SiteUpdatePayload;
  }>();
  @Output() readonly deleteSite = new EventEmitter<number>();

  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    longitude: [
      0,
      [Validators.required, Validators.min(-180), Validators.max(180)],
    ],
    latitude: [
      0,
      [Validators.required, Validators.min(-90), Validators.max(90)],
    ],
    z: [40, [Validators.required, Validators.min(0), Validators.max(8000)]],
    tiltDeg: [15, [Validators.min(0), Validators.max(90)]],
    azimuthDeg: [180, [Validators.min(0), Validators.max(359)]],
    peakKw: [10, [Validators.min(0), Validators.max(1_000_000)]],
    panelCount: [20, [Validators.min(1), Validators.max(1_000_000)]],
    notes: [''],
  });

  errorMessage = '';

  get selectedSite(): Site | null {
    const id = this.selectedId;
    if (id == null) {
      return null;
    }
    return this.sites.find((s) => s.id === id) ?? null;
  }

  get isCreating(): boolean {
    return (
      this.addMode &&
      this.draftPlacement != null &&
      this.selectedId == null
    );
  }

  get canSave(): boolean {
    if (this.selectedSite != null) {
      return this.form.valid;
    }
    if (this.isCreating) {
      return (
        this.form.valid && this.draftFootprintVertices.length >= 3
      );
    }
    return false;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['selectedId'] ||
      changes['draftPlacement'] ||
      changes['draftFootprintVertices'] ||
      changes['sites'] ||
      changes['addMode']
    ) {
      this.patchFormFromState();
    }
  }

  private patchFormFromState(): void {
    this.errorMessage = '';
    const site = this.selectedSite;
    const draft = this.draftPlacement;
    if (site) {
      this.form.patchValue(
        {
          name: site.name,
          longitude: site.geometry.longitude,
          latitude: site.geometry.latitude,
          z: site.geometry.z ?? 40,
          tiltDeg: site.tiltDeg,
          azimuthDeg: site.azimuthDeg,
          peakKw: site.peakKw,
          panelCount: site.panelCount,
          notes: site.notes,
        },
        { emitEvent: false },
      );
      return;
    }
    if (this.isCreating && draft) {
      this.form.patchValue(
        {
          name: '',
          longitude: draft.longitude,
          latitude: draft.latitude,
          z: draft.z,
          tiltDeg: 15,
          azimuthDeg: 180,
          peakKw: 10,
          panelCount: 20,
          notes: '',
        },
        { emitEvent: false },
      );
    }
  }

  onSelectSite(id: number): void {
    this.pickSite.emit(id);
  }

  onToggleAdd(): void {
    this.toggleAddMode.emit();
  }

  onCancelDraft(): void {
    this.cancelDraft.emit();
  }

  onUndoCorner(): void {
    this.undoDraftCorner.emit();
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.isCreating && this.draftFootprintVertices.length < 3) {
      this.errorMessage =
        'Define the footprint on the map with at least three vertices before saving.';
      return;
    }
    const v = this.form.getRawValue();
    const base = {
      type: 'point' as const,
      longitude: v.longitude,
      latitude: v.latitude,
      z: v.z,
    };
    let geometry: Site['geometry'];
    if (this.isCreating && this.draftFootprintVertices.length >= 3) {
      geometry = {
        ...base,
        footprintRing: this.draftFootprintVertices.map((pt) => ({
          longitude: pt.longitude,
          latitude: pt.latitude,
          z: pt.z ?? v.z,
        })),
      };
    } else if (this.selectedSite) {
      const g = this.selectedSite.geometry;
      geometry = {
        ...base,
        ...(g.footprintRing != null ? { footprintRing: g.footprintRing } : {}),
        ...(g.footprintMeters != null ? { footprintMeters: g.footprintMeters } : {}),
      };
    } else {
      geometry = base;
    }
    if (this.selectedSite) {
      this.saveUpdate.emit({
        id: this.selectedSite.id,
        body: {
          name: v.name,
          geometry,
          tiltDeg: v.tiltDeg,
          azimuthDeg: v.azimuthDeg,
          peakKw: v.peakKw,
          panelCount: v.panelCount,
          notes: v.notes,
          lifecycleStatus: this.selectedSite!.lifecycleStatus,
        },
      });
      return;
    }
    if (this.isCreating) {
      this.saveCreate.emit({
        name: v.name,
        geometry,
        tiltDeg: v.tiltDeg,
        azimuthDeg: v.azimuthDeg,
        peakKw: v.peakKw,
        panelCount: v.panelCount,
        notes: v.notes,
        lifecycleStatus: 'pending',
      });
    }
  }

  onDelete(): void {
    const site = this.selectedSite;
    if (site) {
      this.deleteSite.emit(site.id);
    }
  }

  setError(msg: string): void {
    this.errorMessage = msg;
  }
}
