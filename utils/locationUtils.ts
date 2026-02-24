
import { PROVINCES } from '../constants';

// Haversine formula to calculate distance between two points on Earth
const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg: number) => {
  return deg * (Math.PI / 180);
};

export const findClosestProvince = (userLat: number, userLng: number) => {
  let closestProvince = null;
  let minDistance = Infinity;

  // Filter out 'all' option
  const validProvinces = PROVINCES.filter(p => p.id !== 'all' && p.lat && p.lng);

  for (const province of validProvinces) {
    if (province.lat && province.lng) {
      const distance = getDistanceFromLatLonInKm(userLat, userLng, province.lat, province.lng);
      if (distance < minDistance) {
        minDistance = distance;
        closestProvince = province;
      }
    }
  }

  return closestProvince;
};
