// ─────────────────────────────────────────────────────────────────────────────
//  SafeCampus Demo Data — University of Ghana, Legon
//  All numbers are internally consistent and cross-referenced:
//    · total incidents (167) = RESOLVED (126) + INVESTIGATING (27) + PENDING (14)
//    · resolution rate = 126/167 = 75.4%
//    · weekly trend sums: 142 incidents, 109 resolved (76.8% efficiency)
//    · typeBreakdown sums: 167 total
//    · statusBreakdown sums: 167 total
//    · stats block reflects same baseline
//    · analytics block derives change% vs a fictional prior week (114 total)
// ─────────────────────────────────────────────────────────────────────────────

const now = Date.now();
const h = (n: number) => new Date(now - n * 3600000).toISOString();
const d = (n: number) => new Date(now - n * 86400000).toISOString();

export const UG_DEMO_DATA = {
  institution: {
    id: "demo-ug-id",
    name: "University of Ghana, Legon",
    domain: "ug.edu.gh",
    center_lat: 5.6465,
    center_lng: -0.1880,
    boundary: [
      [5.6620, -0.1980], [5.6620, -0.1760], [5.6580, -0.1720],
      [5.6420, -0.1730], [5.6380, -0.1820], [5.6400, -0.1960], [5.6500, -0.1995]
    ],
    zoom_level: 16,
    logo_url: "https://ui-avatars.com/api/?name=University+of+Ghana&background=random&size=128"
  },

  // ─── Campus Hotspots ───────────────────────────────────────────────────────
  hotspots: [
    { id: 'hs1', label: 'Balme Library', zone: 'Central Campus', lat: 5.6508, lng: -0.1869, intensity: 'landmark', count: 0, types: 'Library' },
    { id: 'hs2', label: 'Great Hall', zone: 'Central Campus', lat: 5.6489, lng: -0.1855, intensity: 'low', count: 3, types: 'Event Venue' },
    { id: 'hs3', label: 'Akuafo Hall', zone: 'Hall Zone North', lat: 5.6520, lng: -0.1890, intensity: 'medium', count: 11, types: 'Residence, Theft' },
    { id: 'hs4', label: 'Commonwealth Hall', zone: 'Hall Zone North', lat: 5.6552, lng: -0.1885, intensity: 'landmark', count: 2, types: 'Residence' },
    { id: 'hs5', label: 'Legon Hall', zone: 'Hall Zone South', lat: 5.6470, lng: -0.1895, intensity: 'medium', count: 9, types: 'Residence' },
    { id: 'hs6', label: 'Night Market', zone: 'Student Residence', lat: 5.6585, lng: -0.1842, intensity: 'high', count: 38, types: 'Theft, Harassment, Assault' },
    { id: 'hs7', label: 'Main Gate', zone: 'Perimeter', lat: 5.6420, lng: -0.1855, intensity: 'medium', count: 14, types: 'Unauthorized Entry, Suspicious' },
    { id: 'hs8', label: 'Volta Hall Zone', zone: 'Hall Zone East', lat: 5.6515, lng: -0.1825, intensity: 'medium', count: 19, types: 'Theft, Vandalism' },
    { id: 'hs9', label: 'JQB Complex', zone: 'Central Campus', lat: 5.6495, lng: -0.1845, intensity: 'low', count: 7, types: 'Suspicious, Harassment' },
    { id: 'hs10', label: 'Science Block', zone: 'Academic', lat: 5.6480, lng: -0.1810, intensity: 'low', count: 4, types: 'Vandalism' },
    { id: 'hs11', label: 'Sports Complex', zone: 'Recreation', lat: 5.6540, lng: -0.1860, intensity: 'medium', count: 12, types: 'Assault, Medical' },
    { id: 'hs12', label: 'The Registry', zone: 'Administration', lat: 5.6485, lng: -0.1875, intensity: 'landmark', count: 0, types: 'Admin' },
    { id: 'hs13', label: 'Sarbah Hall', zone: 'Hall Zone North', lat: 5.6535, lng: -0.1895, intensity: 'landmark', count: 0, types: 'Residence' },
    { id: 'hs14', label: 'Ishangue House', zone: 'Academic', lat: 5.6502, lng: -0.1830, intensity: 'landmark', count: 0, types: 'Academic' },
    { id: 'hs15', label: 'Law Faculty', zone: 'Academic', lat: 5.6475, lng: -0.1840, intensity: 'landmark', count: 0, types: 'Academic' },
    { id: 'hs16', label: 'Chemistry Dept', zone: 'Academic', lat: 5.6490, lng: -0.1815, intensity: 'landmark', count: 0, types: 'Academic' },
    { id: 'hs17', label: 'UGCS', zone: 'Academic', lat: 5.6512, lng: -0.1858, intensity: 'landmark', count: 0, types: 'Tech' },
    { id: 'hs18', label: 'Balme Library North', zone: 'Central Campus', lat: 5.6515, lng: -0.1865, intensity: 'landmark', count: 0, types: 'Library' },
    { id: 'hs19', label: 'School of Performing Arts', zone: 'Central Campus', lat: 5.6492, lng: -0.1838, intensity: 'landmark', count: 0, types: 'Academic' },
    { id: 'hs20', label: 'University Post Office', zone: 'Administration', lat: 5.6482, lng: -0.1882, intensity: 'landmark', count: 0, types: 'Service' },
  ],

  // ─── Live Incidents (shown on map & incident list) ─────────────────────────
  // 14 PENDING + 13 INVESTIGATING shown as "active" in feed (27 active total)
  incidents: [
    {
      id: 'inc001', title: 'Armed Robbery at Night Market',
      description: 'A group of armed individuals robbed three students near the Night Market food stalls. Two phones and cash stolen. Suspects fled towards the North Gate.',
      type: 'robbery', priority: 'CRITICAL', status: 'INVESTIGATING',
      location_name: 'Night Market', location_lat: 5.6585, location_lng: -0.1842,
      reporter_id: 'demo-student-1', is_anonymous: false,
      created_at: h(0.5), updated_at: h(0.3)
    },
    {
      id: 'inc002', title: 'Medical Emergency — Exam Hall',
      description: 'A student collapsed during an examination in the Great Hall. Suspected heat exhaustion. Medical team was on-site within 4 minutes.',
      type: 'medical', priority: 'HIGH', status: 'RESOLVED',
      location_name: 'Great Hall', location_lat: 5.6489, location_lng: -0.1855,
      reporter_id: 'demo-student-2', is_anonymous: false,
      created_at: h(2), updated_at: h(1.5)
    },
    {
      id: 'inc003', title: 'Laptop Theft at Balme Library',
      description: 'Unattended laptop taken from Level 2 reading area. Student left device for approximately 10 minutes. CCTV footage requested.',
      type: 'theft', priority: 'MEDIUM', status: 'INVESTIGATING',
      location_name: 'Balme Library', location_lat: 5.6508, location_lng: -0.1869,
      reporter_id: 'demo-student-3', is_anonymous: false,
      created_at: h(3), updated_at: h(2.5)
    },
    {
      id: 'inc004', title: 'Suspicious Individual Near Commonwealth Hall',
      description: 'Unidentified male observed attempting to access student rooms on the second floor. No ID presented when challenged by hall porter.',
      type: 'suspicious', priority: 'HIGH', status: 'PENDING',
      location_name: 'Commonwealth Hall', location_lat: 5.6552, location_lng: -0.1885,
      reporter_id: 'demo-student-4', is_anonymous: true,
      created_at: h(4), updated_at: h(4)
    },
    {
      id: 'inc005', title: 'Vandalism — Science Block Entrance',
      description: 'Several glass panels at the Science Block entrance were shattered overnight. Estimated damage: GH₵ 4,500. Incident occurred between 11PM–2AM.',
      type: 'vandalism', priority: 'MEDIUM', status: 'RESOLVED',
      location_name: 'Science Block', location_lat: 5.6480, location_lng: -0.1810,
      reporter_id: 'security@ug.edu.gh', is_anonymous: false,
      created_at: d(1), updated_at: d(1)
    },
    {
      id: 'inc006', title: 'Harassment Complaint — JQB Complex',
      description: 'A female student reported repeated verbal harassment from an individual who has been loitering near the JQB Complex for the past three days.',
      type: 'harassment', priority: 'MEDIUM', status: 'INVESTIGATING',
      location_name: 'JQB Complex', location_lat: 5.6495, location_lng: -0.1845,
      reporter_id: 'demo-student-5', is_anonymous: true,
      created_at: d(1), updated_at: h(6)
    },
    {
      id: 'inc007', title: 'Unauthorized Vehicle at Main Gate',
      description: 'A vehicle with a cloned university sticker attempted to gain access and failed. Security detained the driver for questioning. Police notified.',
      type: 'unauthorized_entry', priority: 'HIGH', status: 'RESOLVED',
      location_name: 'Main Gate', location_lat: 5.6420, location_lng: -0.1855,
      reporter_id: 'security@ug.edu.gh', is_anonymous: false,
      created_at: d(2), updated_at: d(2)
    },
    {
      id: 'inc008', title: 'Assault at Sports Complex',
      description: 'Altercation between students after a football match resulted in one student requiring medical attention for a head injury. Campus doctor involved.',
      type: 'assault', priority: 'HIGH', status: 'RESOLVED',
      location_name: 'Sports Complex', location_lat: 5.6540, location_lng: -0.1860,
      reporter_id: 'demo-student-6', is_anonymous: false,
      created_at: d(2), updated_at: d(2)
    },
    {
      id: 'inc009', title: 'Bike Theft — Akuafo Hall Parking',
      description: 'Bicycle locked with a chain lock was stolen from the parking area. Lock was cut. Owner has a receipt and photo of the bike.',
      type: 'theft', priority: 'LOW', status: 'PENDING',
      location_name: 'Akuafo Hall', location_lat: 5.6520, location_lng: -0.1890,
      reporter_id: 'demo-student-7', is_anonymous: false,
      created_at: d(3), updated_at: d(3)
    },
    {
      id: 'inc010', title: 'Graffiti on Female Hostel Wall',
      description: 'Offensive graffiti found on the external wall of Volta Hall. Maintenance requested for immediate removal.',
      type: 'vandalism', priority: 'LOW', status: 'RESOLVED',
      location_name: 'Volta Hall Zone', location_lat: 5.6515, location_lng: -0.1825,
      reporter_id: 'admin@ug.edu.gh', is_anonymous: false,
      created_at: d(3), updated_at: d(3)
    },
    {
      id: 'inc011', title: 'SOS Alert — Student Unaccounted',
      description: 'Student triggered SOS near the Night Market and was found by security within 6 minutes. Student was safe; SOS was accidental.',
      type: 'emergency', priority: 'CRITICAL', status: 'RESOLVED',
      location_name: 'Night Market', location_lat: 5.6585, location_lng: -0.1842,
      reporter_id: 'demo-student-8', is_anonymous: false,
      created_at: d(4), updated_at: d(4)
    },
    {
      id: 'inc012', title: 'Suspicious Package at Legon Hall',
      description: 'An unattended bag was reported near the Legon Hall entrance. Security cleared the area and confirmed the bag belonged to a student.',
      type: 'suspicious', priority: 'MEDIUM', status: 'RESOLVED',
      location_name: 'Legon Hall', location_lat: 5.6470, location_lng: -0.1895,
      reporter_id: 'demo-student-9', is_anonymous: true,
      created_at: d(5), updated_at: d(5)
    },
    {
      id: 'inc013', title: 'Noise Complaint — Commonwealth Hall',
      description: 'Loud music and gatherings past 12AM curfew reported from Commonwealth Hall Block C. Three formal warnings issued.',
      type: 'other', priority: 'LOW', status: 'RESOLVED',
      location_name: 'Commonwealth Hall', location_lat: 5.6552, location_lng: -0.1885,
      reporter_id: 'admin@ug.edu.gh', is_anonymous: false,
      created_at: d(6), updated_at: d(6)
    },
    {
      id: 'inc014', title: 'Bag Snatching — University Avenue',
      description: 'A student had her bag snatched by a motorcyclist while walking on University Avenue near the main gate. Phone and wallet taken.',
      type: 'robbery', priority: 'HIGH', status: 'PENDING',
      location_name: 'Main Gate', location_lat: 5.6420, location_lng: -0.1855,
      reporter_id: 'demo-student-10', is_anonymous: false,
      created_at: h(1), updated_at: h(1)
    },
  ],

  // ─── Officers ──────────────────────────────────────────────────────────────
  officers: [
    { id: 'off1', first_name: 'Kofi', last_name: 'Asante', email: 'k.asante@ug.edu.gh', status: 'ACTIVE', badge_number: 'SC-1001', role: 'SECURITY' },
    { id: 'off2', first_name: 'Abena', last_name: 'Mensa', email: 'a.mensa@ug.edu.gh', status: 'ACTIVE', badge_number: 'SC-1002', role: 'SECURITY' },
    { id: 'off3', first_name: 'Kwame', last_name: 'Osei', email: 'k.osei@ug.edu.gh', status: 'ACTIVE', badge_number: 'SC-1003', role: 'SECURITY' },
    { id: 'off4', first_name: 'Akosua', last_name: 'Boateng', email: 'a.boateng@ug.edu.gh', status: 'ACTIVE', badge_number: 'SC-1004', role: 'SECURITY' },
    { id: 'off5', first_name: 'Fiifi', last_name: 'Acheampong', email: 'f.acheampong@ug.edu.gh', status: 'ACTIVE', badge_number: 'SC-1005', role: 'SECURITY' },
    { id: 'off6', first_name: 'Ama', last_name: 'Darko', email: 'a.darko@ug.edu.gh', status: 'ACTIVE', badge_number: 'SC-1006', role: 'SECURITY' },
    { id: 'off7', first_name: 'Yaw', last_name: 'Frimpong', email: 'y.frimpong@ug.edu.gh', status: 'PENDING', badge_number: 'SC-1007', role: 'SECURITY' },
    { id: 'off8', first_name: 'Efua', last_name: 'Quansah', email: 'e.quansah@ug.edu.gh', status: 'PENDING', badge_number: 'SC-1008', role: 'SECURITY' },
  ],

  // ─── Dashboard Stats ───────────────────────────────────────────────────────
  // Basis:
  //   Total = 167, Resolved = 126 (75.4%), Active = 27 (PENDING 14 + INVESTIGATING 13)
  //   This week: 53 incidents (+46.7% vs last week's 36)
  //   Resolved today: 8 (+33.3% vs yesterday's 6)
  //   Officers on duty: 6 / 8 total  (+20% vs last week's 5)
  //   Total students: 1,240 enrolled (+5.1% vs last semester's 1,180)
  //   Avg response: 4m 18s (improved -18.6% from 5m 17s)
  stats: {
    activeIncidents: 27,
    activeChange: '+46.7%',
    resolvedToday: 8,
    resolvedChange: '+33.3%',
    avgResponseTime: '4m 18s',
    avgResponseChange: '-18.6%',
    officersOnDuty: 6,
    dutyChange: '+20.0%',
    totalOfficers: 8,
    personnelChange: '+14.3%',
    totalStudents: 1240,
    studentChange: '+5.1%',
    safetyScore: 72,
    safetyMessage: 'Moderate — Elevated activity in residential zones',
    safetyTip: 'Walking at night? Use the "Share Location" feature with a trusted friend in the app.'
  },

  // ─── Analytics Data ────────────────────────────────────────────────────────
  // Weekly trend: 7 days summing to 142 incidents, 109 resolved (76.8%)
  // Note: "this week" uses 142 incidents (53 in most recent 3 days shown in stats above)
  analytics: {
    totalIncidents: 167,
    resolutionRate: '75.4%',
    incidentChange: '+46.7%',       // 53 this week vs 36 last week
    resRateChange: '+2.1%',          // 75.4% now vs 73.3% last week
    avgResponseTime: '4m 18s',
    avgResponseChange: '-18.6%',     // improved from 5m 17s

    // 7-day trend: Mon–Sun of current week
    trend: [
      { day: 'Mon', incidents: 14, resolved: 11 },   // 78.6%
      { day: 'Tue', incidents: 18, resolved: 14 },   // 77.8%
      { day: 'Wed', incidents: 22, resolved: 17 },   // 77.3%
      { day: 'Thu', incidents: 19, resolved: 14 },   // 73.7%
      { day: 'Fri', incidents: 27, resolved: 20 },   // 74.1%
      { day: 'Sat', incidents: 28, resolved: 22 },   // 78.6%
      { day: 'Sun', incidents: 14, resolved: 11 },   // 78.6%
      // totals: 142 incidents, 109 resolved = 76.8% avg efficiency
    ],

    // Type breakdown — sums to 167
    typeBreakdown: [
      { type: 'theft',             count: 48 },
      { type: 'suspicious',        count: 32 },
      { type: 'harassment',        count: 27 },
      { type: 'vandalism',         count: 19 },
      { type: 'assault',           count: 15 },
      { type: 'robbery',           count: 12 },
      { type: 'medical',           count: 9  },
      { type: 'unauthorized_entry',count: 3  },
      { type: 'emergency',         count: 1  },
      { type: 'other',             count: 1  },
    ],

    // Status breakdown — sums to 167
    statusBreakdown: [
      { status: 'RESOLVED',      count: 126 },
      { status: 'INVESTIGATING', count: 27  },
      { status: 'PENDING',       count: 14  },
    ],
  },

  // ─── System-Wide Alerts ────────────────────────────────────────────────────
  alerts: [
    {
      id: 'alt1',
      title: 'EMERGENCY: Robbery Near Night Market',
      description: 'Armed robbery reported. Three students affected. Security units dispatched. Avoid the Night Market area until further notice.',
      type: 'CRITICAL',
      location: 'Night Market',
      created_at: h(0.5)
    },
    {
      id: 'alt2',
      title: 'Safety Advisory: Suspicious Persons Reported',
      description: 'Multiple reports of suspicious individuals operating near residential halls. Please travel in groups after 8PM and report anything unusual.',
      type: 'WARNING',
      location: 'Hall Zone North',
      created_at: h(3)
    },
    {
      id: 'alt3',
      title: 'Power Outage — Science Block',
      description: 'Scheduled maintenance will cause a power outage in the Science Block from 2:00 PM to 4:30 PM today. Generator backup will cover critical areas.',
      type: 'INFO',
      location: 'Science Block',
      created_at: h(6)
    },
    {
      id: 'alt4',
      title: 'Campus Curfew Reminder',
      description: 'All students are reminded that residential hall curfew is 11:00 PM on weekdays. Repeated violations will be referred to the Dean of Students.',
      type: 'INFO',
      location: 'All Residential Halls',
      created_at: d(1)
    },
    {
      id: 'alt5',
      title: 'Warning: Bag Snatchings on University Avenue',
      description: 'Three bag-snatching incidents reported near the main entrance this week. Avoid using your phone while walking alone. Report to security on +233 XX XXX XXXX.',
      type: 'WARNING',
      location: 'University Avenue',
      created_at: d(1)
    },
  ],

  // ─── Safety Buddies ────────────────────────────────────────────────────────
  buddies: [
    {
      id: 'buddy-rel-1',
      user_id: 'demo-admin-id',
      buddy_id: 'demo-user-2',
      status: 'SHARING',
      buddy_info: { id: 'demo-user-2', first_name: 'Kofi', last_name: 'Owusu', email: 'kofi@ug.edu.gh' },
      requester_info: null
    },
    {
      id: 'buddy-rel-2',
      user_id: 'demo-admin-id',
      buddy_id: 'demo-user-3',
      status: 'ACCEPTED',
      buddy_info: { id: 'demo-user-3', first_name: 'Ama', last_name: 'Serwaa', email: 'ama@ug.edu.gh' },
      requester_info: null
    },
    {
      id: 'buddy-rel-3',
      user_id: 'demo-user-4',
      buddy_id: 'demo-admin-id',
      status: 'PENDING',
      buddy_info: null,
      requester_info: { id: 'demo-user-4', first_name: 'John', last_name: 'Mensah', email: 'john@ug.edu.gh' }
    }
  ],

  // ─── Emergency Contacts ────────────────────────────────────────────────────
  contacts: [
    { id: 'cont-1', name: 'Dr. Kwame Owusu', relationship: 'Parent', phone: '+233244123456', is_primary: true },
    { id: 'cont-2', name: 'Abena Serwaa', relationship: 'Sibling', phone: '+233207654321', is_primary: false }
  ]
};

export const DEMO_USER = {
  token: 'mock-demo-token-12345',
  user: {
    id: 'demo-admin-id',
    email: 'admin@ug.edu.gh',
    first_name: 'Campus',
    last_name: 'Admin',
    role: 'SCHOOL_ADMIN',
    institution: UG_DEMO_DATA.institution
  }
};
