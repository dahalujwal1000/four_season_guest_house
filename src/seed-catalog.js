export const roomTypes = [
  {
    id: 'twin',
    name: 'Standard Twin',
    price: 1500,
    rooms: 6,
    capacity: 2,
    beds: 'Two single beds',
    size: '14 m2',
    image: '/images/room-twin.jpg',
    blurb: 'Bright twin room with attached bathroom, hot shower and a power point beside each bed.',
    amenities: ['Attached bathroom', 'Hot shower', 'Thick blankets', 'Charging point', 'Wi-Fi', 'Valley window'],
    featured: false,
    sort: 1
  },
  {
    id: 'deluxe',
    name: 'Deluxe Double',
    price: 2500,
    rooms: 2,
    capacity: 2,
    beds: 'One double bed',
    size: '18 m2',
    image: '/images/room-deluxe.jpg',
    blurb: 'Our biggest bed and the best view - wake up to Lamjung Himal from your window.',
    amenities: ['Attached bathroom', 'Hot shower', 'Mountain view', 'Double bed', 'Heater on request', 'Charging point', 'Wi-Fi'],
    featured: true,
    sort: 2
  },
  {
    id: 'family',
    name: 'Family Room',
    price: 3500,
    rooms: 1,
    capacity: 4,
    beds: 'One double + two single beds',
    size: '24 m2',
    image: '/images/room-family.jpg',
    blurb: 'Sleeps a family, or two trekking friends who want space to spread out and dry their gear.',
    amenities: ['Attached bathroom', 'Hot shower', 'Sleeps 4', 'Mountain view', 'Clothes line', 'Charging points', 'Wi-Fi'],
    featured: false,
    sort: 3
  },
  {
    id: 'dorm',
    name: "Trekkers' Dorm",
    price: 800,
    rooms: 1,
    capacity: 6,
    beds: 'Six bunk beds (price per bed)',
    size: '20 m2',
    image: '/images/room-dorm.jpg',
    blurb: 'Budget bed for solo trekkers and porters. Same hot showers, shared bathroom next door.',
    amenities: ['Per bed price', 'Hot shower', 'Shared bathroom', 'Blanket and pillow', 'Lockable door', 'Charging point', 'Wi-Fi'],
    featured: false,
    sort: 4
  }
];

export const menu = [
  { section: 'Breakfast', items: [
    ['Tibetan Bread with Honey', 250, 'Fresh fried bread with honey or jam'],
    ['Chapati with Egg', 250, 'Two chapatis and a fried or boiled egg'],
    ['Muesli with Hot Milk', 300, 'Rolled oats, raisins, apple'],
    ['Pancake', 320, 'Honey, chocolate or lemon sugar'],
    ['Toast with Jam & Butter', 220, 'Three slices - tea or coffee extra'],
    ['Omelette', 250, 'Two eggs, onion, tomato - cheese +100']
  ]},
  { section: 'Nepali Favourites', items: [
    ['Dal Bhat Set (veg)', 450, 'Rice, lentil soup, seasonal curry, pickle, papad - free refill'],
    ['Dal Bhat with Chicken', 650, 'Village chicken curry with the full set'],
    ['Mutton Dal Bhat', 750, 'Slow-cooked mountain mutton - the house favourite'],
    ['Momo (10 pcs)', 300, 'Steamed or fried - veg, buff or chicken'],
    ['Thukpa', 350, 'Noodle soup with vegetables or chicken'],
    ['Chowmein', 300, 'Fried noodles - veg, egg or chicken'],
    ['Gurung Bread', 200, 'Local fried bread with honey'],
    ['Chicken Sekuwa', 550, 'Charcoal grilled with timur and garlic']
  ]},
  { section: 'Soups & Stews', items: [
    ['Garlic Soup', 250, 'The trekker classic - great above 2,700 m'],
    ['Sherpa Stew', 450, 'Hearty potato, noodle and vegetable stew'],
    ['Tomato Soup', 250, 'Served with toasted bread'],
    ['Lemon & Ginger Honey', 150, 'Hot drink for a sore throat']
  ]},
  { section: 'Continental', items: [
    ['Vegetable Pizza', 450, 'Thin crust, seasonal vegetables, cheese'],
    ['Margherita Pizza', 550, 'Tomato, mozzarella, basil'],
    ['Spaghetti', 400, 'Tomato sauce - veg or chicken'],
    ['Fried Rice', 300, 'Veg, egg or chicken'],
    ['French Fries', 250, 'Served with tomato sauce'],
    ['Grilled Cheese Sandwich', 300, 'With fries +100']
  ]},
  { section: 'Drinks', items: [
    ['Milk Tea', 80, 'Local milk, strong and sweet'],
    ['Masala Tea', 100, 'With cardamom and ginger'],
    ['Black / Lemon Tea', 100, 'Hot lemon on request'],
    ['Coffee', 120, 'Black or with milk'],
    ['Hot Chocolate', 200, 'With whipped milk'],
    ['Boiled Water (1 L)', 100, 'Refill your bottle - no plastic'],
    ['Mineral Water (1 L)', 100, 'Chilled'],
    ['Soft Drink', 150, 'Coke, Fanta, Sprite'],
    ['Fresh Lemon Soda', 200, 'Sweet or salty'],
    ['Local / Tuborg Beer', 450, 'Served cold']
  ]},
  { section: 'Desserts', items: [
    ['Apple Pie', 350, 'Warm, from Mustang apples'],
    ['Fruit Curd', 250, 'Local yoghurt, honey, banana'],
    ['Custard', 250, 'With fresh fruit']
  ]}
];
