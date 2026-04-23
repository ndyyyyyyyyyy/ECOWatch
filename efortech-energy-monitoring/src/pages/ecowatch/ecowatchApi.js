export const ENERGY_ENDPOINT = '/energy';
export const DEFAULT_ROOT_AREAS = ['RAC', 'NR1', 'NR2', 'UT_NEW', 'UTILITY'];
const REAL_ROOT = 'Office';

export const DEFAULT_ECOWATCH_TREE = [
  {
    title: 'MAIN_ELECTRICAL',
    key: 'default:MAIN_ELECTRICAL',
    children: [
      { title: 'RAC', key: 'default:RAC', children: [{ title: 'LVMDP_RAC', key: 'default:LVMDP_RAC' }] },
      {
        title: 'NR1',
        key: 'default:NR1',
        children: [
          { title: 'DB1', key: 'default:DB1' },
          {
            title: 'DB3',
            key: 'default:DB3',
            children: [
              { title: 'CHAMBER_AR1', key: 'default:CHAMBER_AR1' },
              { title: 'H_PRESS_MC1', key: 'default:H_PRESS_MC1' },
              { title: 'V_F_MALE_C_NR1', key: 'default:V_F_MALE_C_NR1' },
              { title: 'V_F_MALE_B_NR1', key: 'default:V_F_MALE_B_NR1' },
              { title: 'V_F_MALE_A_NR1', key: 'default:V_F_MALE_A_NR1' },
            ],
          },
        ],
      },
      { title: 'NR2', key: 'default:NR2', children: [{ title: 'LVMDP_NR2', key: 'default:LVMDP_NR2' }] },
      { title: 'UT_NEW', key: 'default:UT_NEW', children: [{ title: 'LVMDP_UT_NEW', key: 'default:LVMDP_UT_NEW' }] },
      { title: 'UTILITY', key: 'default:UTILITY', children: [{ title: 'LVMDP_UTILITY', key: 'default:LVMDP_UTILITY' }] },
    ],
  },
  {
    title: 'ELECTRIC_TRANSFORMER',
    key: 'default:ELECTRIC_TRANSFORMER',
    children: [
      { title: 'LVMDP_RAC', key: 'default:transformer:LVMDP_RAC' },
      { title: 'LVMDP_NR2', key: 'default:transformer:LVMDP_NR2' },
      { title: 'LVMDP_UT_NEW', key: 'default:transformer:LVMDP_UT_NEW' },
      { title: 'LVMDP_UTILITY', key: 'default:transformer:LVMDP_UTILITY' },
    ],
  },
];

export async function fetchRootAreaNames() {
  return [...DEFAULT_ROOT_AREAS];
}

async function fetchProjectEcowatchDevices() {
  try {
    const response = await fetch('/api/project/devices', { credentials: 'include' });
    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return (payload.devices || []).filter((device) => {
      if (!device?.deployed) {
        return false;
      }

      return (device.tags || []).some((tag) => {
        const tagName = String(tag?.name || '').trim().toLowerCase();
        return tagName === 'kwh' || tagName === 'energy' || tagName === 'kw' || tagName === 'power' || tagName === 'p';
      });
    });
  } catch (error) {
    console.error('Failed to load project devices for real ecowatch nodes:', error);
    return [];
  }
}

export async function fetchEcowatchAreaTree() {
  const projectEcowatchDevices = await fetchProjectEcowatchDevices();
  if (projectEcowatchDevices.length === 0) {
    return DEFAULT_ECOWATCH_TREE;
  }

  const realNode = {
    title: REAL_ROOT,
    key: `project:${REAL_ROOT}`,
    children: projectEcowatchDevices.map((device) => ({
      title: String(device.name || '').trim(),
      key: `project:${String(device.name || '').trim()}`,
    })),
  };

  return [...DEFAULT_ECOWATCH_TREE, realNode];
}
