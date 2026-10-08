"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Ikon default Leaflet (pakai CDN agar tak perlu konfigurasi asset Next.js)
const ikon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function KlikPeta({ onPilih }: { onPilih: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPilih(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Pusatkan({ lat, lng }: { lat: number; lng: number }) {
  const map = useMapEvents({});
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 16));
  }, [lat, lng, map]);
  return null;
}

/** Peta titik absensi: ketuk peta / seret pin untuk memindahkan titik, lingkaran hijau = radius. */
export default function PetaLokasi({
  lat,
  lng,
  radius,
  onPilih,
}: {
  lat: number;
  lng: number;
  radius: number;
  onPilih: (lat: number, lng: number) => void;
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={16}
      scrollWheelZoom
      className="h-[300px] w-full rounded-2xl border border-slate-200 sm:h-[360px]"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <KlikPeta onPilih={onPilih} />
      <Pusatkan lat={lat} lng={lng} />
      <Marker
        position={[lat, lng]}
        icon={ikon}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const m = e.target as L.Marker;
            const p = m.getLatLng();
            onPilih(p.lat, p.lng);
          },
        }}
      />
      <Circle
        center={[lat, lng]}
        radius={radius}
        pathOptions={{ color: "#15803d", fillColor: "#16a34a", fillOpacity: 0.15, weight: 2 }}
      />
    </MapContainer>
  );
}
