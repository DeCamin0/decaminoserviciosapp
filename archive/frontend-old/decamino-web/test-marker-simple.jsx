import { GoogleMap, Marker } from '@react-google-maps/api';

export default function TestMarkerSimple() {
  const center = { lat: 40.4168, lng: -3.7038 };
  
  const mapContainerStyle = {
    width: '100%',
    height: '400px'
  };

  const mapOptions = {
    zoomControl: true,
    scrollwheel: true,
    streetViewControl: true,
    mapTypeControl: true,
    fullscreenControl: true
  };

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={10}
        options={mapOptions}
      >
        <Marker
          position={center}
          title="Test Marker"
          label={{
            text: "Test Marker",
            className: "marker-label"
          }}
        />
      </GoogleMap>
    </div>
  );
} 