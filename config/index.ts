// Central exports for all city configurations
export { riversideCities, getRiversideCityBySlug, getAllRiversideCitySlugs } from './riverside-cities';
export { orangeCountyCities, getOrangeCountyCityBySlug, getAllOrangeCountyCitySlugs } from './orange-county-cities';

// Combined utilities
import { riversideCities } from './riverside-cities';
import { orangeCountyCities } from './orange-county-cities';

export const allSouthernCaliforniaCities = [
  ...riversideCities,
  ...orangeCountyCities
];

export const getCityBySlug = (slug: string) => {
  return allSouthernCaliforniaCities.find(city => city.slug === slug);
};

export const getAllCitySlugs = () => {
  return allSouthernCaliforniaCities.map(city => city.slug);
};

export const getCitiesByCounty = (county: 'riverside' | 'orange') => {
  if (county === 'riverside') return riversideCities;
  if (county === 'orange') return orangeCountyCities;
  return [];
};

export const searchCitiesByName = (searchTerm: string) => {
  const lowercaseSearch = searchTerm.toLowerCase();
  return allSouthernCaliforniaCities.filter(city => 
    city.name.toLowerCase().includes(lowercaseSearch) ||
    city.neighborhoods.some(n => n.toLowerCase().includes(lowercaseSearch))
  );
};

export const getCitiesByZipCode = (zipCode: string) => {
  return allSouthernCaliforniaCities.filter(city => 
    city.zipCodes.includes(zipCode)
  );
};

// Type definitions for TypeScript support
export interface City {
  name: string;
  slug: string;
  zipCodes: string[];
  neighborhoods: string[];
  popularVenues: string[];
  highlights: string[];
  story: string;
  nearbyCities: string[];
}






