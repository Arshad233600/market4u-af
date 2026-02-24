
import React, { useEffect, useRef } from 'react';
import Icon from '../src/components/ui/Icon';

interface LocationPickerProps {
  initialLat?: number;
  initialLng?: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

declare global {
  interface Window {
    L: any;
  }
}

const LocationPicker: React.FC<LocationPickerProps> = ({ initialLat, initialLng, onLocationSelect }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);

  // Default to Kabul Center if no props provided
  const defaultLat = 34.5553;
  const defaultLng = 69.2075;

  // 1. Initialize Map (Run once)
  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    // Prevent double initialization
    if (mapInstanceRef.current) return;

    const startLat = initialLat || defaultLat;
    const startLng = initialLng || defaultLng;

    const map = window.L.map(mapRef.current).setView([startLat, startLng], 13);
    
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const marker = window.L.marker([startLat, startLng], {
      draggable: true
    }).addTo(map);

    // Event Listeners
    marker.on('dragend', function() {
      const position = marker.getLatLng();
      onLocationSelect(position.lat, position.lng);
    });

    map.on('click', function(e: L.LeafletMouseEvent) {
       marker.setLatLng(e.latlng);
       onLocationSelect(e.latlng.lat, e.latlng.lng);
    });

    mapInstanceRef.current = map;
    markerInstanceRef.current = marker;

    // Cleanup function to destroy map on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run only on mount

  // 2. React to prop changes (Fly to new location)
  useEffect(() => {
      const map = mapInstanceRef.current;
      const marker = markerInstanceRef.current;

      if (map && marker && initialLat && initialLng) {
          // Check if we are already close to the target to avoid unnecessary animation
          const currentCenter = map.getCenter();
          const dist = Math.sqrt(Math.pow(currentCenter.lat - initialLat, 2) + Math.pow(currentCenter.lng - initialLng, 2));
          
          if (dist > 0.0001) { // Only move if distance is significant
              map.flyTo([initialLat, initialLng], 14, { duration: 1.5 });
              marker.setLatLng([initialLat, initialLng]);
              
              // Ensure the map renders correctly if container size changed
              setTimeout(() => {
                  map.invalidateSize();
              }, 400);
          }
      }
  }, [initialLat, initialLng]);

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation && mapInstanceRef.current && markerInstanceRef.current) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        mapInstanceRef.current.setView([latitude, longitude], 15);
        markerInstanceRef.current.setLatLng([latitude, longitude]);
        onLocationSelect(latitude, longitude);
      });
    } else {
        alert('دسترسی به موقعیت مکانی امکان‌پذیر نیست.');
    }
  };

  return (
    <div className="relative w-full h-64 rounded-xl overflow-hidden border border-gray-300 z-0 bg-gray-100">
      <div id="map" ref={mapRef} className="w-full h-full"></div>
      
      <button
        type="button"
        onClick={handleGetCurrentLocation}
        className="absolute bottom-4 right-4 z-[400] bg-white p-2 rounded-lg shadow-md text-brand-600 hover:bg-gray-50 transition-colors"
        title="موقعیت من"
      >
        <Icon name="MapPin" size={24} strokeWidth={1.8} />
      </button>

      <div className="absolute top-2 right-2 z-[400] bg-white/90 backdrop-blur px-2 py-1 rounded text-xs text-gray-600 shadow-sm pointer-events-none">
          پین را روی نقشه جابجا کنید
      </div>
    </div>
  );
};

export default LocationPicker;
