/**
 * Starter content for Four Seasons Guest House & Restaurant, Chame (Manang, Nepal).
 * Everything here is editable later from the admin panel (/admin).
 */
import { roomTypes, menu } from './seed-catalog.js';

export { roomTypes, menu };

export const settings = {
  name: 'Four Seasons Guest House & Restaurant',
  shortName: 'Four Seasons',
  tagline: 'A warm bed, a hot shower and a mountain view in the heart of Chame.',
  intro:
    'Family-run guest house and restaurant on the Annapurna Circuit in Chame, Manang. Ten clean rooms with attached bathrooms and hot showers, a sunny terrace facing Lamjung Himal, and home-cooked Nepali food that trekkers come back for.',
  phone: '+977-XXXXXXXX',
  whatsapp: '+977XXXXXXXX',
  email: 'info@fourseasonschame.com',
  address: 'G6XW+X7V, Chame 33500, Manang, Gandaki, Nepal',
  plusCode: 'G6XW+X7V',
  mapsUrl: 'https://maps.app.goo.gl/ehu96RVwt48rh1oc8?g_st=ac',
  mapEmbed: 'https://maps.google.com/maps?q=Four%20Seasons%20Guest%20House%20Chame%20Manang&z=14&output=embed',
  altitude: '2,710 m / 8,891 ft',
  checkIn: '12:00',
  checkOut: '10:00',
  currency: 'NPR',
  latitude: 28.5522,
  longitude: 84.2404,
  googleRating: 4.3,
  googleReviewCount: 40,
  facilities: [
    { icon: 'wifi', title: 'Wi-Fi', text: 'Free wireless internet in the restaurant and rooms.' },
    { icon: 'shower', title: 'Hot shower', text: 'Attached bathroom and piping hot shower in every room.' },
    { icon: 'plug', title: 'Charging points', text: 'A power point beside every bed for cameras and power banks.' },
    { icon: 'laundry', title: 'Laundry service', text: 'Same-day washing and drying, ready before you set off.' },
    { icon: 'bag', title: 'Gear storage', text: 'Leave a bag with us free while you trek to Manang and back.' },
    { icon: 'bolt', title: 'Backup generator', text: 'Lights and charging stay on during village power cuts.' },
    { icon: 'car', title: 'Private parking', text: 'Off-street parking for jeeps, bikes and the Besisahar bus.' },
    { icon: 'sun', title: 'Sunny terrace', text: 'South-facing terrace for sunrise on Lamjung Himal.' }
  ],
  policies: [
    { label: 'Check-in', value: 'From 12:00 (noon). Late arrival? Call ahead and we will keep your room.' },
    { label: 'Check-out', value: 'By 10:00. Free luggage storage after check-out.' },
    { label: 'Payment', value: 'Cash in NPR at the guest house, NPR or USD notes. No prepayment required.' },
    { label: 'Cancellation', value: 'Free cancellation up to 24 hours before arrival. Trekking emergency? Message us on WhatsApp.' },
    { label: 'Children', value: 'Under 6 stay free with parents. Extra mattress NPR 500.' },
    { label: 'Meals', value: 'Breakfast, packed lunch and dinner daily, 06:00 - 21:00.' }
  ]
};

export const reviews = [
  { name: 'Sample review', country: 'Replace me', rating: 5, text: 'Paste a real Google review here from Admin > Reviews. The star layout and grid are already built.', date: '2026-01-01' },
  { name: 'Sample review', country: 'Replace me', rating: 5, text: 'Two or three short quotes work best - mention the hot shower, the Dal Bhat refill and the mountain view.', date: '2026-01-01' },
  { name: 'Sample review', country: 'Replace me', rating: 4, text: 'Live Google rating is 4.3 from 40 reviews. Real quotes make this section genuine social proof.', date: '2026-01-01' }
];

/**
 * The datastore is created from this on first run, then lives in /data/db.json
 * so admin edits survive restarts.
 */
export function createSeed() {
  return {
    settings: structuredClone(settings),
    roomTypes: structuredClone(roomTypes),
    menu: structuredClone(menu),
    reviews: structuredClone(reviews),
    blocks: [],
    bookings: [],
    inquiries: [],
    notifications: [],
    meta: { createdAt: new Date().toISOString(), version: 1 }
  };
}
