export type LostFoundItem = {
  id: string;
  title: string;
  category: string;
  kind: 'Found' | 'Missing';
  place: string;
  date: string;
  status: string;
  description: string;
  icon: 'laptop' | 'bottle' | 'keys' | 'headphones' | 'bag';
  tone: string;
};

export const demoItems: LostFoundItem[] = [
  {
    id: 'VF-0248',
    title: 'Dark laptop sleeve',
    category: 'Electronics',
    kind: 'Found',
    place: 'Library area · Example University (Demo)',
    date: '11 Oct 2026',
    status: 'Reviewed',
    description: 'Dark padded sleeve found near a library area. A small stitched detail is withheld for verification.',
    icon: 'laptop',
    tone: 'mint'
  },
  {
    id: 'VF-0316',
    title: 'Blue water bottle',
    category: 'Personal accessories',
    kind: 'Found',
    place: 'Lecture hall area · Coastal Campus (Demo)',
    date: '10 Oct 2026',
    status: 'Reviewed',
    description: 'Reusable blue bottle. Please keep one identifying mark private when making a claim.',
    icon: 'bottle',
    tone: 'blue'
  },
  {
    id: 'VF-0191',
    title: 'Keys with a red keyring',
    category: 'Keys & cards',
    kind: 'Found',
    place: 'Student services area · Highland Institute (Demo)',
    date: '9 Oct 2026',
    status: 'Reviewed',
    description: 'Small set of keys with a red keyring. Exact count and distinctive marks are not public.',
    icon: 'keys',
    tone: 'sand'
  },
  {
    id: 'VF-0164',
    title: 'Wireless headphones',
    category: 'Electronics',
    kind: 'Found',
    place: 'Study commons · Example University (Demo)',
    date: '8 Oct 2026',
    status: 'Reviewed',
    description: 'Over-ear headphones in a dark case, found around a shared study space.',
    icon: 'headphones',
    tone: 'lavender'
  },
  {
    id: 'VF-0107',
    title: 'Canvas backpack',
    category: 'Bags',
    kind: 'Found',
    place: 'Sports centre area · Coastal Campus (Demo)',
    date: '7 Oct 2026',
    status: 'Reviewed',
    description: 'Olive canvas backpack. Contents and any owner details are kept private.',
    icon: 'bag',
    tone: 'peach'
  }
];

export const demoCases = [
  { id: 'VF-0248', subject: 'Found item · listing review', type: 'Found report', state: 'Needs review', priority: 'High', age: '18 min ago' },
  { id: 'CL-0219', subject: 'Water bottle · private claim', type: 'Claim', state: 'Evidence requested', priority: 'Normal', age: '42 min ago' },
  { id: 'VF-0191', subject: 'Keys · possible match lead', type: 'Match suggestion', state: 'Open', priority: 'Normal', age: '2 hr ago' },
  { id: 'HO-0104', subject: 'Laptop sleeve · return', type: 'Handover', state: 'Scheduled', priority: 'Today', age: 'Yesterday' }
];

export const demoInstitutions = [
  { name: 'Example University', region: 'Dar es Salaam · Demo', status: 'Demo workspace', items: 73, returned: 41 },
  { name: 'Coastal Campus', region: 'Coastal region · Demo', status: 'Demo workspace', items: 46, returned: 28 },
  { name: 'Highland Institute', region: 'Northern zone · Demo', status: 'Demo workspace', items: 31, returned: 17 }
];

export const demoActivity = [
  { title: 'Found item submitted', detail: 'VF-0248 · Example University (Demo)', time: '09:12', kind: 'review' },
  { title: 'Private evidence requested', detail: 'CL-0219 · Blue water bottle', time: '08:42', kind: 'claim' },
  { title: 'Possible match suggested', detail: 'VF-0191 · Staff review still required', time: 'Yesterday', kind: 'match' }
];
