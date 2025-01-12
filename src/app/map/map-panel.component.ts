import {
  AfterViewInit,
  Component,
  EffectRef,
  ElementRef,
  EventEmitter,
  Injector,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  afterNextRender,
  effect,
  inject,
  untracked,
} from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';
import { SpatialReference } from '@arcgis/core/geometry';
import {
  load as loadProjection,
  project,
} from '@arcgis/core/geometry/projection';
import { webMercatorToGeographic } from '@arcgis/core/geometry/support/webMercatorUtils';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Polyline from '@arcgis/core/geometry/Polyline';
import ObjectSymbol3DLayer from '@arcgis/core/symbols/ObjectSymbol3DLayer';
import PointSymbol3D from '@arcgis/core/symbols/PointSymbol3D';
import PolygonSymbol3D from '@arcgis/core/symbols/PolygonSymbol3D';
import FillSymbol3DLayer from '@arcgis/core/symbols/FillSymbol3DLayer';
import LineSymbol3D from '@arcgis/core/symbols/LineSymbol3D';
import LineSymbol3DLayer from '@arcgis/core/symbols/LineSymbol3DLayer';
import Camera from '@arcgis/core/Camera';
import esriConfig from '@arcgis/core/config';
import WebScene from '@arcgis/core/WebScene';
import SceneView from '@arcgis/core/views/SceneView';
import type { Site } from '../models/site.model';
import { SitesStore } from '../core/sites.store';

const WEBSCENE_PORTAL_ITEM_ID = '698a905884654ba2816f85b7375bb20b';

const BOSTON_INITIAL_CAMERA = new Camera({
  position: new Point({
    spatialReference: SpatialReference.WGS84,
    longitude: -71.058,
    latitude: 42.36,
    z: 2_800,
  }),
  tilt: 65,
  heading: 10,
});

function defaultZ(site: Site): number {
  return site.geometry.z ?? 40;
}

const DEFAULT_FOOTPRINT_M = { lengthM: 14, widthM: 10 } as const;

function footprintMetersForSite(site: Site): { lengthM: number; widthM: number } {
  const f = site.geometry.footprintMeters;
  if (
    f != null &&
    f.lengthM > 0 &&
    f.widthM > 0 &&
    Number.isFinite(f.lengthM) &&
    Number.isFinite(f.widthM)
  ) {
    return { lengthM: f.lengthM, widthM: f.widthM };
  }
  return { lengthM: DEFAULT_FOOTPRINT_M.lengthM, widthM: DEFAULT_FOOTPRINT_M.widthM };
}

function unitFacingFromAzimuthDegrees(azimuthDeg: number): {
  east: number;
  north: number;
} {
  const rad = (azimuthDeg * Math.PI) / 180;
  return { east: Math.sin(rad), north: Math.cos(rad) };
}

function perpendicularCW(facing: { east: number; north: number }): {
  east: number;
  north: number;
} {
  return { east: facing.north, north: -facing.east };
}

function offsetEnToLonLat(
  centerLon: number,
  centerLat: number,
  eastM: number,
  northM: number,
): { lon: number; lat: number } {
  const latRad = (centerLat * Math.PI) / 180;
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * Math.cos(latRad);
  return {
    lon: centerLon + eastM / mPerDegLon,
    lat: centerLat + northM / mPerDegLat,
  };
}

function sitePanelCornersSynthetic(site: Site): { lon: number; lat: number; z: number }[] {
  const z = defaultZ(site);
  const clon = site.geometry.longitude;
  const clat = site.geometry.latitude;
  const { lengthM, widthM } = footprintMetersForSite(site);
  const halfL = lengthM / 2;
  const halfW = widthM / 2;
  const u = unitFacingFromAzimuthDegrees(site.azimuthDeg);
  const v = perpendicularCW(u);

  const offsetsEN: [number, number][] = [
    [-halfL * v.east - halfW * u.east, -halfL * v.north - halfW * u.north],
    [+halfL * v.east - halfW * u.east, +halfL * v.north - halfW * u.north],
    [+halfL * v.east + halfW * u.east, +halfL * v.north + halfW * u.north],
    [-halfL * v.east + halfW * u.east, -halfL * v.north + halfW * u.north],
  ];

  return offsetsEN.map(([eM, nM]) => {
    const { lon, lat } = offsetEnToLonLat(clon, clat, eM, nM);
    return { lon, lat, z };
  });
}

function siteFootprintCorners(site: Site): { lon: number; lat: number; z: number }[] {
  const ring = site.geometry.footprintRing;
  const anchorZ = site.geometry.z ?? 40;
  if (ring != null && ring.length >= 3) {
    return ring.map((v) => ({
      lon: v.longitude,
      lat: v.latitude,
      z: v.z ?? anchorZ,
    }));
  }
  return sitePanelCornersSynthetic(site);
}

function panelFootprintPolygonFromCorners(
  corners: { lon: number; lat: number; z: number }[],
): Polygon {
  const ring: number[][] = corners.map((c) => [c.lon, c.lat, c.z]);
  ring.push([corners[0].lon, corners[0].lat, corners[0].z]);
  return new Polygon({
    hasZ: true,
    rings: [ring],
    spatialReference: SpatialReference.WGS84,
  });
}

function panelFootprintPolygon(site: Site): Polygon {
  return panelFootprintPolygonFromCorners(siteFootprintCorners(site));
}

function siteAnchorLonLatZ(site: Site): { lon: number; lat: number; z: number } {
  const ring = site.geometry.footprintRing;
  const fallbackZ = site.geometry.z ?? 40;
  if (ring != null && ring.length >= 3) {
    const n = ring.length;
    const lon = ring.reduce((s, v) => s + v.longitude, 0) / n;
    const lat = ring.reduce((s, v) => s + v.latitude, 0) / n;
    const z =
      ring.reduce((s, v) => s + (v.z ?? fallbackZ), 0) / n;
    return { lon, lat, z };
  }
  return {
    lon: site.geometry.longitude,
    lat: site.geometry.latitude,
    z: fallbackZ,
  };
}

function footprintFillSymbol(
  fillRgb: number[],
  outlineRgba: number[],
  selected: boolean,
): PolygonSymbol3D {
  const fillA = selected ? 0.34 : 0.24;
  return new PolygonSymbol3D({
    symbolLayers: [
      new FillSymbol3DLayer({
        material: {
          color: [fillRgb[0]!, fillRgb[1]!, fillRgb[2]!, fillA],
        },
        outline: {
          color: outlineRgba,
          size: selected ? 1.15 : 0.8,
        },
      }),
    ],
  });
}

function locationPinSymbol(
  color: number[],
  selected: boolean,
  scale = 1,
): PointSymbol3D {
  const s = scale;
  const stemH = selected ? 20 * s : 16 * s;
  const stemW = selected ? 4.5 * s : 3.5 * s;
  const headD = selected ? 7.5 * s : 5.5 * s;
  const headZ = stemH + headD * 0.38;

  return new PointSymbol3D({
    symbolLayers: [
      new ObjectSymbol3DLayer({
        resource: { primitive: 'inverted-cone' },
        width: stemW,
        height: stemH,
        depth: stemW,
        anchor: 'bottom',
        material: { color },
      }),
      new ObjectSymbol3DLayer({
        resource: { primitive: 'sphere' },
        width: headD,
        height: headD,
        depth: headD,
        anchor: 'relative',
        anchorPosition: { x: 0, y: 0, z: headZ },
        material: { color },
      }),
    ],
  });
}

function graphicsForSite(site: Site, selected: boolean): Graphic[] {
  const installed = site.lifecycleStatus === 'installed';
  let outlineRgba: number[];
  let fillRgb: number[];
  let cornerRgba: number[];
  if (selected) {
    outlineRgba = [239, 68, 68, 0.95];
    fillRgb = [239, 68, 68];
    cornerRgba = [239, 68, 68, 0.98];
  } else if (installed) {
    outlineRgba = [45, 212, 191, 0.92];
    fillRgb = [56, 178, 172];
    cornerRgba = [56, 178, 172, 0.95];
  } else {
    outlineRgba = [251, 191, 36, 0.95];
    fillRgb = [255, 193, 7];
    cornerRgba = [255, 193, 7, 0.92];
  }

  const footprint = new Graphic({
    geometry: panelFootprintPolygon(site),
    symbol: footprintFillSymbol(fillRgb, outlineRgba, selected),
    attributes: { siteId: site.id, kind: 'footprint' },
  });

  const corners = siteFootprintCorners(site);
  const cornerScale = 0.52;
  const cornerGraphics = corners.map(
    (c) =>
      new Graphic({
        geometry: new Point({
          spatialReference: SpatialReference.WGS84,
          longitude: c.lon,
          latitude: c.lat,
          z: c.z,
        }),
        symbol: locationPinSymbol(cornerRgba, selected, cornerScale),
        attributes: { siteId: site.id, kind: 'corner' },
      }),
  );

  return [footprint, ...cornerGraphics];
}

function mapPointToLonLat(mapPoint: __esri.Point): {
  longitude: number;
  latitude: number;
  z: number;
} {
  const z = mapPoint.hasZ ? (mapPoint.z ?? 0) : 0;
  const sr = mapPoint.spatialReference;
  const wkid = sr?.wkid;
  if (wkid === 4326) {
    return {
      longitude: mapPoint.longitude!,
      latitude: mapPoint.latitude!,
      z: z || 40,
    };
  }
  if (wkid === 3857 || wkid === 102100) {
    const g = webMercatorToGeographic(mapPoint) as Point;
    return {
      longitude: g.longitude!,
      latitude: g.latitude!,
      z: z || 40,
    };
  }
  return { longitude: mapPoint.x, latitude: mapPoint.y, z: z || 40 };
}

@Component({
  selector: 'app-map-panel',
  standalone: true,
  templateUrl: './map-panel.component.html',
  styleUrl: './map-panel.component.scss',
})
export class MapPanelComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @ViewChild('sceneContainer', { static: true })
  sceneContainer!: ElementRef<HTMLDivElement>;

  @Input() sites: Site[] = [];
  @Input() selectedId: number | null = null;
  @Input() addMode = false;

  @Output() readonly siteSelected = new EventEmitter<number>();

  private view: SceneView | undefined;
  private graphicsLayer = new GraphicsLayer({
    title: 'PV installations',
    elevationInfo: { mode: 'absolute-height' },
  });
  private draftGraphicsLayer = new GraphicsLayer({
    title: 'Draft footprint (proposal)',
    elevationInfo: { mode: 'absolute-height' },
  });
  private clickHandle: __esri.Handle | undefined;
  private flyAbort: AbortController | undefined;
  private viewReady = false;
  private lastCameraFocusId: number | null = null;
  private lastHandledWorkspaceNonce = 0;
  private workspaceFlyGeneration = 0;
  private selectionEffect?: EffectRef;
  private draftFootprintEffect?: EffectRef;
  private readonly store = inject(SitesStore);

  constructor(
    private readonly ngZone: NgZone,
    private readonly injector: Injector,
  ) {}

  ngAfterViewInit(): void {
    esriConfig.assetsPath = 'https://js.arcgis.com/4.34/@arcgis/core/assets';

    afterNextRender(
      () => {
        this.ngZone.runOutsideAngular(() => {
          const map = new WebScene({
            portalItem: { id: WEBSCENE_PORTAL_ITEM_ID },
          });

          const view = new SceneView({
            container: this.sceneContainer.nativeElement,
            map,
            camera: BOSTON_INITIAL_CAMERA,
          });
          this.view = view;

          void (async () => {
            await view.when();
            await map.load();
            map.add(this.graphicsLayer);
            map.add(this.draftGraphicsLayer);
            await view.goTo(BOSTON_INITIAL_CAMERA, { animate: false });
            this.syncGraphics();
            this.syncDraftFootprintGraphics();
            this.wireClick(view);
            this.viewReady = true;
            this.bindSelectionCameraEffect();
            this.bindDraftFootprintEffect();
          })();
        });
      },
      { injector: this.injector },
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.view) {
      return;
    }
    if (changes['sites'] || changes['selectedId'] || changes['addMode']) {
      this.syncGraphics();
    }
  }

  ngOnDestroy(): void {
    this.selectionEffect?.destroy();
    this.selectionEffect = undefined;
    this.draftFootprintEffect?.destroy();
    this.draftFootprintEffect = undefined;
    this.viewReady = false;
    this.lastCameraFocusId = null;
    this.lastHandledWorkspaceNonce = 0;
    this.workspaceFlyGeneration = 0;
    this.flyAbort?.abort();
    this.flyAbort = undefined;
    this.clickHandle?.remove();
    this.clickHandle = undefined;
    this.view?.destroy();
    this.view = undefined;
  }

  private wireClick(view: SceneView): void {
    this.clickHandle?.remove();
    this.clickHandle = view.on('click', (event) => {
      void this.ngZone.run(async () => {
        const hit = await view.hitTest(event);
        const graphicHit = hit.results.find(
          (r) =>
            r.type === 'graphic' &&
            (r as { graphic?: Graphic }).graphic?.layer === this.graphicsLayer,
        ) as { graphic: Graphic } | undefined;

        if (graphicHit?.graphic) {
          const attrs = graphicHit.graphic.attributes as Record<string, unknown>;
          const id = attrs['siteId'] as number | undefined;
          if (id != null) {
            this.focusSiteFromMapClick(id);
            return;
          }
        }

        if (this.addMode && event.mapPoint) {
          const { longitude, latitude, z } = mapPointToLonLat(event.mapPoint);
          this.store.appendDraftFootprintVertex({ longitude, latitude, z });
        }
      });
    });
  }

  private syncGraphics(
    sitesOverride?: Site[],
    selectedIdOverride?: number | null,
  ): void {
    if (!this.view) {
      return;
    }
    const list = sitesOverride ?? this.sites;
    const selectedId =
      selectedIdOverride !== undefined
        ? selectedIdOverride
        : this.store.selectedId();
    this.graphicsLayer.removeAll();
    for (const site of list) {
      for (const g of graphicsForSite(site, site.id === selectedId)) {
        this.graphicsLayer.add(g);
      }
    }
  }

  private focusSiteFromMapClick(id: number): void {
    const storeSites = this.store.sites();
    const site =
      storeSites.find((s) => s.id === id) ?? this.sites.find((s) => s.id === id);
    if (!site) {
      this.siteSelected.emit(id);
      return;
    }
    this.lastCameraFocusId = id;
    this.syncGraphics(storeSites, id);
    this.ngZone.runOutsideAngular(() => {
      void this.flyCameraToSite(site, true);
    });
    this.siteSelected.emit(id);
  }

  private bindSelectionCameraEffect(): void {
    this.selectionEffect?.destroy();
    this.selectionEffect = effect(
      () => {
        const id = this.store.selectedId();
        const storeSites = this.store.sites();
        const workspaceNonce = this.store.workspaceFocusNonce();
        if (!this.viewReady) {
          return;
        }
        if (id == null) {
          this.lastCameraFocusId = null;
          untracked(() => {
            if (this.view) {
              this.syncGraphics();
            }
          });
          return;
        }
        const site = storeSites.find((s) => s.id === id);
        if (!site) {
          return;
        }
        const idChanged = this.lastCameraFocusId !== id;
        const workspacePing = workspaceNonce !== this.lastHandledWorkspaceNonce;
        const shouldFly = idChanged || workspacePing;
        this.lastCameraFocusId = id;
        untracked(() => {
          if (!this.view) {
            return;
          }
          this.syncGraphics(storeSites);
          if (!shouldFly) {
            return;
          }
          const flyGen = ++this.workspaceFlyGeneration;
          this.ngZone.runOutsideAngular(async () => {
            try {
              await this.flyCameraToSite(site, true);
            } finally {
              if (
                workspacePing &&
                flyGen === this.workspaceFlyGeneration
              ) {
                this.lastHandledWorkspaceNonce = workspaceNonce;
              }
            }
          });
        });
      },
      { injector: this.injector },
    );
  }

  private bindDraftFootprintEffect(): void {
    this.draftFootprintEffect?.destroy();
    this.draftFootprintEffect = effect(
      () => {
        this.store.addMode();
        this.store.draftFootprintVertices();
        if (!this.viewReady) {
          return;
        }
        untracked(() => this.syncDraftFootprintGraphics());
      },
      { injector: this.injector },
    );
  }

  private syncDraftFootprintGraphics(): void {
    if (!this.view) {
      return;
    }
    this.draftGraphicsLayer.removeAll();
    if (!this.store.addMode()) {
      return;
    }
    const verts = this.store.draftFootprintVertices();
    if (verts.length === 0) {
      return;
    }

    const draftCorner = [250, 204, 21, 0.95] as number[];
    const defaultZ = verts[0]?.z ?? 40;

    for (const v of verts) {
      const z = v.z ?? defaultZ;
      this.draftGraphicsLayer.add(
        new Graphic({
          geometry: new Point({
            spatialReference: SpatialReference.WGS84,
            longitude: v.longitude,
            latitude: v.latitude,
            z,
          }),
          symbol: locationPinSymbol(draftCorner, true, 0.42),
          attributes: { kind: 'draft-corner' },
        }),
      );
    }

    if (verts.length >= 2) {
      const path = verts.map((v) => [
        v.longitude,
        v.latitude,
        v.z ?? defaultZ,
      ]);
      const polyline = new Polyline({
        hasZ: true,
        paths: [path],
        spatialReference: SpatialReference.WGS84,
      });
      this.draftGraphicsLayer.add(
        new Graphic({
          geometry: polyline,
          symbol: new LineSymbol3D({
            symbolLayers: [
              new LineSymbol3DLayer({
                material: { color: [250, 204, 21, 0.95] },
                size: 2,
              }),
            ],
          }),
          attributes: { kind: 'draft-edge' },
        }),
      );
    }

    if (verts.length >= 3) {
      const corners = verts.map((v) => ({
        lon: v.longitude,
        lat: v.latitude,
        z: v.z ?? defaultZ,
      }));
      this.draftGraphicsLayer.add(
        new Graphic({
          geometry: panelFootprintPolygonFromCorners(corners),
          symbol: footprintFillSymbol(
            [255, 193, 7],
            [251, 191, 36, 0.88],
            false,
          ),
          attributes: { kind: 'draft-footprint' },
        }),
      );
    }
  }

  private async flyCameraToSite(site: Site, animate: boolean): Promise<void> {
    const view = this.view;
    if (!view) {
      return;
    }

    await view.when();
    await loadProjection();

    this.flyAbort?.abort();
    this.flyAbort = new AbortController();
    const signal = this.flyAbort.signal;

    const goOpts = {
      duration: animate ? 1550 : 0,
      easing: animate ? ('in-out-cubic' as const) : undefined,
      signal,
    };

    const template = cameraCloseOnSite(site);
    const vsr = view.spatialReference;

    try {
      let position = template.position.clone();
      if (vsr) {
        const projected = project(position, vsr);
        if (projected != null && 'x' in projected) {
          position = projected as Point;
        }
      }
      const baseCam = view.camera;
      if (!baseCam?.clone) {
        return;
      }
      const cam = baseCam.clone();
      cam.position = position;
      cam.tilt = template.tilt;
      cam.heading = template.heading;
      await view.goTo(cam, goOpts);
    } catch {
      try {
        const anchor = siteAnchorLonLatZ(site);
        const ground = new Point({
          spatialReference: SpatialReference.WGS84,
          longitude: anchor.lon,
          latitude: anchor.lat,
          z: anchor.z,
        });
        let target: Point = ground;
        if (vsr) {
          const projected = project(ground, vsr);
          if (projected != null && 'x' in projected) {
            target = projected as Point;
          }
        }
        await view.goTo(target, goOpts);
      } catch {
      }
    }
  }
}

function cameraCloseOnSite(site: Site): Camera {
  const anchor = siteAnchorLonLatZ(site);
  const z = anchor.z;
  const lon = anchor.lon;
  const lat = anchor.lat;
  const dLon = 0.00062;
  const dLat = -0.00048;
  const camZ = z + 105;
  return new Camera({
    position: new Point({
      spatialReference: SpatialReference.WGS84,
      longitude: lon - dLon,
      latitude: lat - dLat,
      z: camZ,
    }),
    tilt: 83,
    heading: 52,
  });
}
