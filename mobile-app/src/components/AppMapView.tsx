import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  RasterSource,
  ViewAnnotation,
  type StyleSpecification,
  type ViewAnnotationRef,
} from "@maplibre/maplibre-react-native";

export type AppMapMarker = {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  type: "bus" | "stop";
  color?: string;
  draggable?: boolean;
  prominent?: boolean;
};

export type AppMapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
};

export type LatLng = { latitude: number; longitude: number };

/** follow = chase bus; overview = keep bus + stops in frame */
export type MapCameraMode = "follow" | "overview";

type Props = {
  style?: StyleProp<ViewStyle>;
  initialRegion?: AppMapRegion;
  followCoordinate?: LatLng | null;
  cameraMode?: MapCameraMode;
  markers?: AppMapMarker[];
  routeCoords?: LatLng[];
  onMarkerDragEnd?: (id: string, lat: number, lng: number) => void;
  onMapPress?: (lat: number, lng: number) => void;
  children?: React.ReactNode;
};

const DEFAULT_REGION: AppMapRegion = {
  latitude: 12.9716,
  longitude: 77.5946,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

/**
 * Empty base style — tiles come from <RasterSource>, not style.sources.
 * No glyph URL: we avoid symbol/text layers so MapLibre won't hit
 * "Unable to parse resourceUrl" for missing fonts.
 */
const EMPTY_STYLE: StyleSpecification = {
  version: 8,
  name: "Empty",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#E8EEF2" },
    },
  ],
};

/** Single absolute tile template (MapLibre Native requires absolute URLs). */
const OSM_TILES = ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"];

export function regionFromCoords(coords: LatLng[], pad = 1.6): AppMapRegion {
  if (!coords.length) return DEFAULT_REGION;
  if (coords.length === 1) {
    return {
      latitude: coords[0].latitude,
      longitude: coords[0].longitude,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    };
  }
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * pad, 0.02),
    longitudeDelta: Math.max((maxLng - minLng) * pad, 0.02),
  };
}

function deltaToZoom(latitudeDelta: number): number {
  return Math.min(18, Math.max(1, Math.log2(360 / Math.max(latitudeDelta, 0.0005))));
}

function markerColor(marker: AppMapMarker): string {
  if (marker.color) return marker.color;
  return marker.type === "stop" ? "#2F5D8C" : "#1B7F4E";
}

function IOSMap({
  style,
  initialRegion,
  followCoordinate,
  cameraMode = "follow",
  markers = [],
  routeCoords = [],
  onMarkerDragEnd,
  onMapPress,
  children,
}: Props) {
  const mapRef = useRef<MapView | null>(null);
  const region = initialRegion || DEFAULT_REGION;

  useEffect(() => {
    if (!mapRef.current) return;

    if (cameraMode === "overview" && markers.length > 0) {
      const coords = markers.map((m) => ({ latitude: m.lat, longitude: m.lng }));
      const r = regionFromCoords(coords);
      mapRef.current.animateToRegion(
        {
          latitude: r.latitude,
          longitude: r.longitude,
          latitudeDelta: r.latitudeDelta ?? 0.04,
          longitudeDelta: r.longitudeDelta ?? 0.04,
        },
        500,
      );
      return;
    }

    if (cameraMode === "follow" && followCoordinate) {
      mapRef.current.animateToRegion(
        {
          latitude: followCoordinate.latitude,
          longitude: followCoordinate.longitude,
          latitudeDelta: region.latitudeDelta ?? 0.04,
          longitudeDelta: region.longitudeDelta ?? 0.04,
        },
        500,
      );
    }
  }, [
    cameraMode,
    followCoordinate?.latitude,
    followCoordinate?.longitude,
    markers,
    region.latitudeDelta,
    region.longitudeDelta,
  ]);

  return (
    <View style={[styles.wrap, style]} collapsable={false}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: region.latitude,
          longitude: region.longitude,
          latitudeDelta: region.latitudeDelta ?? 0.04,
          longitudeDelta: region.longitudeDelta ?? 0.04,
        }}
        onPress={
          onMapPress
            ? (e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                onMapPress(latitude, longitude);
              }
            : undefined
        }
      >
        {routeCoords.length >= 2 ? (
          <Polyline coordinates={routeCoords} strokeColor="#1C4E7A" strokeWidth={4} />
        ) : null}
        {markers.map((m) => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.lat, longitude: m.lng }}
            title={m.title}
            description={m.draggable ? "Drag to move" : undefined}
            pinColor={markerColor(m)}
            draggable={Boolean(m.draggable)}
            onDragEnd={
              m.draggable && onMarkerDragEnd
                ? (e) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    onMarkerDragEnd(m.id, latitude, longitude);
                  }
                : undefined
            }
          >
            {m.prominent ? (
              <View style={[styles.prominentPin, { backgroundColor: markerColor(m) }]}>
                <Text style={styles.prominentText}>{m.draggable ? "DRAG" : m.title || "•"}</Text>
              </View>
            ) : null}
          </Marker>
        ))}
      </MapView>
      {children ? <View style={styles.overlay} pointerEvents="box-none">{children}</View> : null}
    </View>
  );
}

function AndroidDraggableBus({
  marker,
  onMarkerDragEnd,
}: {
  marker: AppMapMarker;
  onMarkerDragEnd?: (id: string, lat: number, lng: number) => void;
}) {
  const ref = useRef<ViewAnnotationRef | null>(null);
  const refreshed = useRef(false);

  useEffect(() => {
    if (refreshed.current) return;
    const t = setTimeout(() => {
      try {
        ref.current?.refresh();
        refreshed.current = true;
      } catch {
        // native view may not be ready
      }
    }, 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <ViewAnnotation
      ref={ref}
      id="sim-bus-pin"
      title={marker.title || "Bus"}
      lngLat={[marker.lng, marker.lat]}
      anchor="center"
      draggable={Boolean(marker.draggable)}
      onDragEnd={
        marker.draggable && onMarkerDragEnd
          ? (e) => {
              try {
                const lngLat = e.nativeEvent?.lngLat;
                if (!lngLat || lngLat.length < 2) return;
                const [lng, lat] = lngLat;
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                onMarkerDragEnd(marker.id, lat, lng);
              } catch {
                // ignore
              }
            }
          : undefined
      }
    >
      <View style={[styles.prominentPin, { backgroundColor: markerColor(marker) }]}>
        <Text style={styles.prominentText}>{marker.draggable ? "DRAG" : "BUS"}</Text>
      </View>
    </ViewAnnotation>
  );
}

function AndroidMap({
  style,
  initialRegion,
  followCoordinate,
  cameraMode = "follow",
  markers = [],
  routeCoords = [],
  onMarkerDragEnd,
  onMapPress,
  children,
}: Props) {
  const region = initialRegion || DEFAULT_REGION;
  const overview = useMemo(
    () => regionFromCoords(markers.map((m) => ({ latitude: m.lat, longitude: m.lng }))),
    [markers],
  );

  const stops = useMemo(() => markers.filter((m) => m.type === "stop"), [markers]);
  const busMarker = useMemo(() => markers.find((m) => m.type === "bus") ?? null, [markers]);
  const draggable = Boolean(busMarker?.draggable);

  const stopsGeo = useMemo(() => {
    if (!stops.length) return null;
    return {
      type: "FeatureCollection" as const,
      features: stops.map((m) => ({
        type: "Feature" as const,
        properties: { title: m.title || "Stop", color: markerColor(m) },
        geometry: { type: "Point" as const, coordinates: [m.lng, m.lat] },
      })),
    };
  }, [stops]);

  const lineGeo = useMemo(() => {
    if (routeCoords.length < 2) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: routeCoords.map((c) => [c.longitude, c.latitude]),
      },
    };
  }, [routeCoords]);

  const busGeo = useMemo(() => {
    if (!busMarker || draggable) return null;
    if (busMarker.lat === 0 && busMarker.lng === 0) return null;
    return {
      type: "Feature" as const,
      properties: { color: markerColor(busMarker), title: busMarker.title || "Bus" },
      geometry: {
        type: "Point" as const,
        coordinates: [busMarker.lng, busMarker.lat],
      },
    };
  }, [busMarker, draggable]);

  const cameraProps = useMemo(() => {
    if (cameraMode === "overview" && markers.length > 0) {
      return {
        center: [overview.longitude, overview.latitude] as [number, number],
        zoom: deltaToZoom(overview.latitudeDelta ?? 0.04),
        duration: 450,
      };
    }
    if (cameraMode === "follow" && followCoordinate) {
      return {
        center: [followCoordinate.longitude, followCoordinate.latitude] as [number, number],
        zoom: deltaToZoom(region.latitudeDelta ?? 0.035),
        duration: 450,
      };
    }
    return null;
  }, [cameraMode, followCoordinate, markers.length, overview, region.latitudeDelta]);

  return (
    <View style={[styles.wrap, style]} collapsable={false}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={EMPTY_STYLE}
        attribution={false}
        logo={false}
        onPress={
          onMapPress
            ? (e) => {
                try {
                  const lngLat = e.nativeEvent?.lngLat;
                  if (!lngLat || lngLat.length < 2) return;
                  const [lng, lat] = lngLat;
                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                  onMapPress(lat, lng);
                } catch {
                  // empty press
                }
              }
            : undefined
        }
      >
        <RasterSource id="osm" tiles={OSM_TILES} tileSize={256} attribution="© OpenStreetMap">
          <Layer id="osm-tiles" type="raster" />
        </RasterSource>

        {cameraProps ? (
          <Camera center={cameraProps.center} zoom={cameraProps.zoom} duration={cameraProps.duration} />
        ) : (
          <Camera
            initialViewState={{
              center: [region.longitude, region.latitude],
              zoom: deltaToZoom(region.latitudeDelta ?? 0.04),
            }}
          />
        )}

        {lineGeo ? (
          <GeoJSONSource id="route-line" data={lineGeo}>
            <Layer
              id="route-line-layer"
              type="line"
              paint={{ "line-color": "#1C4E7A", "line-width": 4 }}
            />
          </GeoJSONSource>
        ) : null}

        {stopsGeo ? (
          <GeoJSONSource id="stops" data={stopsGeo}>
            <Layer
              id="stops-circle"
              type="circle"
              paint={{
                "circle-radius": 9,
                "circle-color": "#2F5D8C",
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
              }}
            />
          </GeoJSONSource>
        ) : null}

        {busGeo ? (
          <GeoJSONSource id="live-bus" data={busGeo}>
            <Layer
              id="live-bus-circle"
              type="circle"
              paint={{
                "circle-radius": 12,
                "circle-color": busMarker?.color || "#1B7F4E",
                "circle-stroke-width": 3,
                "circle-stroke-color": "#ffffff",
              }}
            />
          </GeoJSONSource>
        ) : null}

        {busMarker?.draggable ? (
          <AndroidDraggableBus marker={busMarker} onMarkerDragEnd={onMarkerDragEnd} />
        ) : null}
      </Map>
      {children ? <View style={styles.overlay} pointerEvents="box-none">{children}</View> : null}
    </View>
  );
}

export function AppMapView(props: Props) {
  if (Platform.OS === "android") {
    return <AndroidMap {...props} />;
  }
  return <IOSMap {...props} />;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: "hidden", backgroundColor: "#DCE3EA" },
  overlay: { position: "absolute", top: 12, left: 12, right: 12, gap: 6 },
  prominentPin: {
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  prominentText: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
