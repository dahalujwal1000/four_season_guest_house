/**
 * Availability maths. A booking holds one room of its type for every night in [checkIn, checkOut).
 * Blocks hold a room for a single date (manual maintenance / offline booking entry).
 */

export function toDate(value) {
  const d = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function iso(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Inclusive list of nights between checkIn (inclusive) and checkOut (exclusive). */
export function nightsBetween(checkIn, checkOut) {
  const start = toDate(checkIn);
  const end = toDate(checkOut);
  if (!start || !end) return [];
  const nights = [];
  for (let d = new Date(start); d < end; d = addDays(d, 1)) nights.push(iso(d));
  return nights;
}

export function isValidRange(checkIn, checkOut) {
  const start = toDate(checkIn);
  const end = toDate(checkOut);
  if (!start || !end) return false;
  if (end <= start) return false;
  const maxNights = 30;
  return nightsBetween(start, end).length <= maxNights;
}

const ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'checked-in']);

/** Occupied room count per type per night. */
export function occupancyMap(data, roomTypeIds) {
  const map = new Map();
  const bump = (roomTypeId, date) => {
    if (roomTypeIds && !roomTypeIds.includes(roomTypeId)) return;
    const key = `${roomTypeId}|${date}`;
    map.set(key, (map.get(key) || 0) + 1);
  };
  for (const booking of data.bookings || []) {
    if (!ACTIVE_STATUSES.has(booking.status)) continue;
    for (const night of nightsBetween(booking.checkIn, booking.checkOut)) bump(booking.roomTypeId, night);
  }
  for (const block of data.blocks || []) {
    const dates = block.dateTo
      ? nightsBetween(block.dateFrom, addDays(toDate(block.dateTo), 1))
      : [String(block.dateFrom).slice(0, 10)];
    for (const night of dates) bump(block.roomTypeId, night);
  }
  return map;
}

export function occupiedOn(map, roomTypeId, date) {
  return map.get(`${roomTypeId}|${date}`) || 0;
}

/**
 * Free rooms for a stay. Returns per room type: {rooms, minAvailable, available, nights[]}
 */
export function availabilityFor(data, checkIn, checkOut, guests = 1) {
  const nights = nightsBetween(checkIn, checkOut);
  const map = occupancyMap(data);
  return (data.roomTypes || []).map((type) => {
    const perNight = nights.map((night) => {
      const free = Math.max(type.rooms - occupiedOn(map, type.id, night), 0);
      return { date: night, free };
    });
    const minAvailable = perNight.length ? Math.min(...perNight.map((n) => n.free)) : type.rooms;
    const fitsGuests = (type.capacity || 2) >= Number(guests || 1);
    return {
      id: type.id,
      name: type.name,
      price: type.price,
      capacity: type.capacity,
      rooms: type.rooms,
      minAvailable,
      available: minAvailable > 0 && fitsGuests,
      nights: perNight
    };
  });
}

/** Calendar grid for the admin panel: every night with occupied / total per room type. */
export function calendarGrid(data, fromDate, days = 31) {
  const from = toDate(fromDate) || toDate(iso(new Date()));
  const map = occupancyMap(data);
  return {
    from: iso(from),
    roomTypes: (data.roomTypes || []).map((type) => {
      const cells = [];
      for (let i = 0; i < days; i += 1) {
        const date = iso(addDays(from, i));
        const occupied = occupiedOn(map, type.id, date);
        cells.push({ date, occupied, total: type.rooms, free: Math.max(type.rooms - occupied, 0) });
      }
      return { id: type.id, name: type.name, total: type.rooms, cells };
    })
  };
}