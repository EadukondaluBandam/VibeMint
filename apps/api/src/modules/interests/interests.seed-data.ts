export interface SeedInterest {
  name: string;
  slug: string;
  category: string;
  description: string;
  icon?: string;
  sortOrder: number;
}

export const INITIAL_INTERESTS: SeedInterest[] = [
  // 1. Technology
  {
    name: 'AI & Machine Learning',
    slug: 'ai-machine-learning',
    category: 'Technology',
    description: 'Artificial intelligence, neural networks, and generative models.',
    icon: 'cpu',
    sortOrder: 1,
  },
  {
    name: 'Web Development',
    slug: 'web-development',
    category: 'Technology',
    description: 'Frontend, backend, modern frameworks, and cloud systems.',
    icon: 'code',
    sortOrder: 2,
  },
  {
    name: 'Mobile Apps',
    slug: 'mobile-apps',
    category: 'Technology',
    description: 'iOS, Android, and cross-platform native app development.',
    icon: 'smartphone',
    sortOrder: 3,
  },
  {
    name: 'Cybersecurity',
    slug: 'cybersecurity',
    category: 'Technology',
    description: 'Information security, cryptography, and ethical hacking.',
    icon: 'shield',
    sortOrder: 4,
  },

  // 2. Music
  {
    name: 'Electronic & EDM',
    slug: 'electronic-edm',
    category: 'Music',
    description: 'House, techno, synthwave, and festival electronic dance music.',
    icon: 'headphones',
    sortOrder: 10,
  },
  {
    name: 'Hip-Hop & Rap',
    slug: 'hip-hop-rap',
    category: 'Music',
    description: 'Boom bap, trap, lyricism, and modern hip-hop culture.',
    icon: 'mic',
    sortOrder: 11,
  },
  {
    name: 'Indie & Rock',
    slug: 'indie-rock',
    category: 'Music',
    description: 'Alternative, post-punk, shoegaze, and indie rock.',
    icon: 'disc',
    sortOrder: 12,
  },
  {
    name: 'Pop & R&B',
    slug: 'pop-rnb',
    category: 'Music',
    description: 'Contemporary pop, neo-soul, and rhythm & blues.',
    icon: 'music',
    sortOrder: 13,
  },

  // 3. Movies
  {
    name: 'Sci-Fi & Fantasy',
    slug: 'sci-fi-fantasy',
    category: 'Movies',
    description: 'World-building, space exploration, and high fantasy cinema.',
    icon: 'film',
    sortOrder: 20,
  },
  {
    name: 'Cinema & Directing',
    slug: 'cinema-directing',
    category: 'Movies',
    description: 'Independent film, cinematography, and auteur directors.',
    icon: 'video',
    sortOrder: 21,
  },
  {
    name: 'Documentaries',
    slug: 'documentaries',
    category: 'Movies',
    description: 'Real-world investigative documentaries and historical stories.',
    icon: 'tv',
    sortOrder: 22,
  },
  {
    name: 'Anime & Animation',
    slug: 'anime-animation',
    category: 'Movies',
    description: 'Japanese animation, 3D craft, and visual storytelling.',
    icon: 'smile',
    sortOrder: 23,
  },

  // 4. Travel
  {
    name: 'Backpacking',
    slug: 'backpacking',
    category: 'Travel',
    description: 'Budget exploration, hostels, and spontaneous trails.',
    icon: 'compass',
    sortOrder: 30,
  },
  {
    name: 'Solo Travel',
    slug: 'solo-travel',
    category: 'Travel',
    description: 'Self-guided adventures, independence, and global journeys.',
    icon: 'user',
    sortOrder: 31,
  },
  {
    name: 'City Breaks',
    slug: 'city-breaks',
    category: 'Travel',
    description: 'Architecture, nightlife, and cultural city explorations.',
    icon: 'map-pin',
    sortOrder: 32,
  },
  {
    name: 'Road Trips',
    slug: 'road-trips',
    category: 'Travel',
    description: 'Scenic highways, van life, and cross-country expeditions.',
    icon: 'navigation',
    sortOrder: 33,
  },

  // 5. Fitness
  {
    name: 'Weightlifting',
    slug: 'weightlifting',
    category: 'Fitness',
    description: 'Strength training, bodybuilding, and powerlifting.',
    icon: 'activity',
    sortOrder: 40,
  },
  {
    name: 'Running & Marathon',
    slug: 'running-marathon',
    category: 'Fitness',
    description: '5k, 10k, endurance training, and marathon pacing.',
    icon: 'fast-forward',
    sortOrder: 41,
  },
  {
    name: 'Yoga & Pilates',
    slug: 'yoga-pilates',
    category: 'Fitness',
    description: 'Core stability, mobility, breathwork, and mindfulness.',
    icon: 'feather',
    sortOrder: 42,
  },
  {
    name: 'CrossFit',
    slug: 'crossfit',
    category: 'Fitness',
    description: 'High-intensity functional fitness and conditioning.',
    icon: 'zap',
    sortOrder: 43,
  },

  // 6. Gaming
  {
    name: 'PC Gaming',
    slug: 'pc-gaming',
    category: 'Gaming',
    description: 'Custom rigs, Steam libraries, and high-FPS gaming.',
    icon: 'monitor',
    sortOrder: 50,
  },
  {
    name: 'Console Gaming',
    slug: 'console-gaming',
    category: 'Gaming',
    description: 'PlayStation, Xbox, and Nintendo switch gaming.',
    icon: 'play',
    sortOrder: 51,
  },
  {
    name: 'Esports',
    slug: 'esports',
    category: 'Gaming',
    description: 'Competitive leagues, tactical shooters, and MOBAs.',
    icon: 'award',
    sortOrder: 52,
  },
  {
    name: 'Retro Gaming',
    slug: 'retro-gaming',
    category: 'Gaming',
    description: 'Classic 8-bit, 16-bit, and arcade arcade nostalgia.',
    icon: 'rewind',
    sortOrder: 53,
  },

  // 7. Photography
  {
    name: 'Street Photography',
    slug: 'street-photography',
    category: 'Photography',
    description: 'Candid urban life, monochrome, and golden hour street scenes.',
    icon: 'camera',
    sortOrder: 60,
  },
  {
    name: 'Landscape Photography',
    slug: 'landscape-photography',
    category: 'Photography',
    description: 'Mountain vistas, long exposures, and wilderness horizons.',
    icon: 'image',
    sortOrder: 61,
  },
  {
    name: 'Portrait Photography',
    slug: 'portrait-photography',
    category: 'Photography',
    description: 'Studio lighting, editorial shoots, and human expression.',
    icon: 'user-check',
    sortOrder: 62,
  },

  // 8. Art and Design
  {
    name: 'UI/UX Design',
    slug: 'ui-ux-design',
    category: 'Art and Design',
    description: 'Design systems, prototyping, and user experience research.',
    icon: 'layout',
    sortOrder: 70,
  },
  {
    name: 'Digital Illustration',
    slug: 'digital-illustration',
    category: 'Art and Design',
    description: 'Concept art, character design, and raster/vector art.',
    icon: 'pen-tool',
    sortOrder: 71,
  },
  {
    name: 'Painting & Sketching',
    slug: 'painting-sketching',
    category: 'Art and Design',
    description: 'Oils, acrylics, watercolors, and sketchbook drawings.',
    icon: 'edit-3',
    sortOrder: 72,
  },

  // 9. Food
  {
    name: 'Specialty Coffee',
    slug: 'specialty-coffee',
    category: 'Food',
    description: 'Pour-overs, single origin beans, espresso, and latte art.',
    icon: 'coffee',
    sortOrder: 80,
  },
  {
    name: 'Street Food',
    slug: 'street-food',
    category: 'Food',
    description: 'Night markets, local specialties, and global street cuisine.',
    icon: 'shopping-bag',
    sortOrder: 81,
  },
  {
    name: 'Baking & Pastry',
    slug: 'baking-pastry',
    category: 'Food',
    description: 'Sourdough, croissants, patisserie, and artisanal baking.',
    icon: 'package',
    sortOrder: 82,
  },

  // 10. Books
  {
    name: 'Fiction & Novels',
    slug: 'fiction-novels',
    category: 'Books',
    description: 'Literary fiction, contemporary stories, and classic novels.',
    icon: 'book',
    sortOrder: 90,
  },
  {
    name: 'Non-Fiction',
    slug: 'non-fiction',
    category: 'Books',
    description: 'Biographies, science, history, and behavioral psychology.',
    icon: 'book-open',
    sortOrder: 91,
  },
  {
    name: 'Sci-Fi & Speculative',
    slug: 'scifi-speculative',
    category: 'Books',
    description: 'Dystopias, cyberpunk, hard sci-fi, and space opera.',
    icon: 'bookmark',
    sortOrder: 92,
  },

  // 11. Sports
  {
    name: 'Football / Soccer',
    slug: 'football-soccer',
    category: 'Sports',
    description: 'Champions League, Premier League, and grassroots pitch football.',
    icon: 'target',
    sortOrder: 100,
  },
  {
    name: 'Basketball',
    slug: 'basketball',
    category: 'Sports',
    description: 'NBA, streetball, pickup courts, and buzzer beaters.',
    icon: 'circle',
    sortOrder: 101,
  },
  {
    name: 'Climbing & Bouldering',
    slug: 'climbing-bouldering',
    category: 'Sports',
    description: 'Crags, indoor boulder gyms, dynos, and top-rope climbing.',
    icon: 'triangle',
    sortOrder: 102,
  },

  // 12. Nature
  {
    name: 'Hiking & Trails',
    slug: 'hiking-trails',
    category: 'Nature',
    description: 'Alpine trails, backcountry loops, and summit hikes.',
    icon: 'sun',
    sortOrder: 110,
  },
  {
    name: 'Camping',
    slug: 'camping',
    category: 'Nature',
    description: 'Campfires, stargazing, wilderness survival, and tents.',
    icon: 'moon',
    sortOrder: 111,
  },
  {
    name: 'Wildlife & Conservation',
    slug: 'wildlife-conservation',
    category: 'Nature',
    description: 'Ecology, fauna preservation, and habitat restoration.',
    icon: 'heart',
    sortOrder: 112,
  },

  // 13. Fashion
  {
    name: 'Streetwear',
    slug: 'streetwear',
    category: 'Fashion',
    description: 'Sneakers, drops, oversized silhouettes, and Japanese street style.',
    icon: 'tag',
    sortOrder: 120,
  },
  {
    name: 'Vintage & Thrift',
    slug: 'vintage-thrift',
    category: 'Fashion',
    description: '90s workwear, secondhand gems, and circular fashion.',
    icon: 'archive',
    sortOrder: 121,
  },
  {
    name: 'Sustainable Fashion',
    slug: 'sustainable-fashion',
    category: 'Fashion',
    description: 'Eco materials, slow fashion, and ethical craftsmanship.',
    icon: 'refresh-cw',
    sortOrder: 122,
  },

  // 14. Education
  {
    name: 'Science & Astronomy',
    slug: 'science-astronomy',
    category: 'Education',
    description: 'Astrophysics, cosmology, biology, and particle physics.',
    icon: 'globe',
    sortOrder: 130,
  },
  {
    name: 'History & Culture',
    slug: 'history-culture',
    category: 'Education',
    description: 'Ancient civilizations, world revolutions, and anthropology.',
    icon: 'map',
    sortOrder: 131,
  },
  {
    name: 'Languages & Polyglot',
    slug: 'languages-polyglot',
    category: 'Education',
    description: 'Language acquisition, linguistics, and global communication.',
    icon: 'message-circle',
    sortOrder: 132,
  },

  // 15. Entrepreneurship
  {
    name: 'Startups & SaaS',
    slug: 'startups-saas',
    category: 'Entrepreneurship',
    description: 'Bootstrapping, product-market fit, and scaling tech ventures.',
    icon: 'trending-up',
    sortOrder: 140,
  },
  {
    name: 'Creator Economy',
    slug: 'creator-economy',
    category: 'Entrepreneurship',
    description: 'Audience building, digital goods, and independent creators.',
    icon: 'share-2',
    sortOrder: 141,
  },
  {
    name: 'Small Business',
    slug: 'small-business',
    category: 'Entrepreneurship',
    description: 'Local enterprises, boutique brands, and community commerce.',
    icon: 'briefcase',
    sortOrder: 142,
  },

  // 16. Dance
  {
    name: 'Hip Hop Dance',
    slug: 'hip-hop-dance',
    category: 'Dance',
    description: 'Freestyle, breaking, popping, and urban choreography.',
    icon: 'music',
    sortOrder: 150,
  },
  {
    name: 'Contemporary Dance',
    slug: 'contemporary-dance',
    category: 'Dance',
    description: 'Expressive movement, modern technique, and stage performance.',
    icon: 'wind',
    sortOrder: 151,
  },
  {
    name: 'Salsa & Bachata',
    slug: 'salsa-bachata',
    category: 'Dance',
    description: 'Latin social dancing, musicality, and partner work.',
    icon: 'zap',
    sortOrder: 152,
  },

  // 17. Pets
  {
    name: 'Dogs & Canines',
    slug: 'dogs-canines',
    category: 'Pets',
    description: 'Puppy training, dog agility, breeds, and canine companionship.',
    icon: 'heart',
    sortOrder: 160,
  },
  {
    name: 'Cats & Felines',
    slug: 'cats-felines',
    category: 'Pets',
    description: 'Cat care, playful behaviors, and cozy feline friends.',
    icon: 'smile',
    sortOrder: 161,
  },
  {
    name: 'Animal Rescue',
    slug: 'animal-rescue',
    category: 'Pets',
    description: 'Fostering, shelter volunteering, and pet adoption advocacy.',
    icon: 'life-buoy',
    sortOrder: 162,
  },

  // 18. Lifestyle
  {
    name: 'Minimalism',
    slug: 'minimalism',
    category: 'Lifestyle',
    description: 'Intentional living, decluttering, and simple aesthetic spaces.',
    icon: 'check-circle',
    sortOrder: 170,
  },
  {
    name: 'Mindfulness & Meditation',
    slug: 'mindfulness-meditation',
    category: 'Lifestyle',
    description: 'Daily meditation, presence, stoicism, and emotional clarity.',
    icon: 'sun',
    sortOrder: 171,
  },
  {
    name: 'Productivity',
    slug: 'productivity',
    category: 'Lifestyle',
    description: 'Deep work, time management, habit systems, and focus.',
    icon: 'check-square',
    sortOrder: 172,
  },
];

export const SEED_INTERESTS = INITIAL_INTERESTS;
