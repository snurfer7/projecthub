import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

interface MapPickerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: string;
}

const MapPicker: React.FC<MapPickerProps> = ({
  initialLat,
  initialLng,
  onChange,
  height = '300px',
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  
  // Default to Tokyo if no coordinates provided
  const defaultLat = 35.6895;
  const defaultLng = 139.6917;
  
  const [currentPos, setCurrentPos] = useState({
    lat: initialLat ?? defaultLat,
    lng: initialLng ?? defaultLng,
  });

  // Update current pos if initial props change
  useEffect(() => {
    if (initialLat !== undefined && initialLng !== undefined) {
      const lat = initialLat ?? defaultLat;
      const lng = initialLng ?? defaultLng;
      setCurrentPos({ lat, lng });
      
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      }
      if (leafletMap.current) {
        leafletMap.current.setView([lat, lng]);
      }
    }
  }, [initialLat, initialLng]);

  useEffect(() => {
    if (mapRef.current && !leafletMap.current) {
      // Initialize map
      leafletMap.current = L.map(mapRef.current).setView(
        [initialLat ?? defaultLat, initialLng ?? defaultLng],
        15
      );

      // Add GSI Standard Tile Layer
      L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
        maxZoom: 18,
      }).addTo(leafletMap.current);

      // Create draggable marker
      const marker = L.marker([initialLat ?? defaultLat, initialLng ?? defaultLng], {
        draggable: true,
      }).addTo(leafletMap.current);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setCurrentPos({ lat: pos.lat, lng: pos.lng });
        onChange(pos.lat, pos.lng);
      });

      markerRef.current = marker;

      // Fix for Leaflet icon path issues in Vite
      const DefaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
      L.Marker.prototype.options.icon = DefaultIcon;
      
      // Force invalidate size after a short delay to ensure map renders correctly in modal
      setTimeout(() => {
        leafletMap.current?.invalidateSize();
      }, 100);
    }

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full space-y-2">
      <div 
        ref={mapRef} 
        className="w-full rounded-lg border border-gray-200 shadow-inner" 
        style={{ height, zIndex: 1 }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="text-[11px] text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100 flex gap-3">
          <span><span className="font-semibold">緯度:</span> {currentPos.lat.toFixed(6)}</span>
          <span><span className="font-semibold">経度:</span> {currentPos.lng.toFixed(6)}</span>
        </div>
        <div className="text-[10px] text-blue-600 font-medium">
          アイコンをドラッグして微調整できます
        </div>
      </div>
      <div className="px-1 flex items-center gap-3 text-[9px] text-gray-400">
        <span>
          &copy; <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 underline decoration-gray-100">国土地理院</a>
        </span>
        <span>
          Powered by <a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 underline decoration-gray-100">Leaflet</a>
        </span>
      </div>
    </div>
  );
};

export default MapPicker;
