import {
  districts_en,
  divisions_en,
  upazilas_en,
} from 'bangladesh-location-data';

type LocationNode = {
  value: number;
  title: string;
};

const normalizeName = (value: string) => value.trim().toLowerCase();

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const bangladeshDivisions = divisions_en.map((division) => ({
  code: division.value,
  name: division.title,
  slug: slugify(division.title),
}));

export const getDivisionByCode = (divisionCode: number) =>
  bangladeshDivisions.find((division) => division.code === divisionCode) ?? null;

export const getDistrictsByDivisionCode = (divisionCode: number) => {
  const districts = (districts_en as Record<number, LocationNode[]>)[divisionCode] ?? [];

  return districts.map((district) => ({
    code: district.value,
    name: district.title,
    slug: slugify(district.title),
    divisionCode,
  }));
};

export const getDistrictByCode = (districtCode: number) => {
  for (const division of bangladeshDivisions) {
    const district = getDistrictsByDivisionCode(division.code).find(
      (item) => item.code === districtCode,
    );

    if (district) {
      return district;
    }
  }

  return null;
};

export const getDistrictBySlug = (districtSlug: string) => {
  for (const division of bangladeshDivisions) {
    const district = getDistrictsByDivisionCode(division.code).find(
      (item) => item.slug === districtSlug,
    );

    if (district) {
      return district;
    }
  }

  return null;
};

export const getUpazilasByDistrictCode = (districtCode: number) => {
  const upazilas = (upazilas_en as Record<number, LocationNode[]>)[districtCode] ?? [];

  return upazilas.map((upazila) => ({
    code: upazila.value,
    name: upazila.title,
    slug: slugify(upazila.title),
    districtCode,
  }));
};

export const getUpazilaByCode = (districtCode: number, upazilaCode: number) =>
  getUpazilasByDistrictCode(districtCode).find(
    (upazila) => upazila.code === upazilaCode,
  ) ?? null;

export const getUpazilaByName = (districtCode: number, upazilaName: string) =>
  getUpazilasByDistrictCode(districtCode).find(
    (upazila) => normalizeName(upazila.name) === normalizeName(upazilaName),
  ) ?? null;

export const getLocationHierarchy = () =>
  bangladeshDivisions.map((division) => ({
    ...division,
    districts: getDistrictsByDivisionCode(division.code).map((district) => ({
      ...district,
      upazilas: getUpazilasByDistrictCode(district.code),
    })),
  }));
