import axios from 'axios';

export const ENERGY_ENDPOINT = '/energy';
export const DEFAULT_ROOT_AREAS = ['RAC', 'NR1', 'NR2', 'UT_NEW', 'UTILITY'];

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
          { title: 'LVMDP_NR1', key: 'default:LVMDP_NR1' },
          { title: 'DB1', key: 'default:DB1' },
          { title: 'DB2', key: 'default:DB2' },
          {
            title: 'DB3',
            key: 'default:DB3',
            children: [
              { title: 'CHAMBER_AR1', key: 'default:CHAMBER_AR1' },
              { title: 'LP_OFFICE_REFF_2', key: 'default:LP_OFFICE_REFF_2' },
              { title: 'H_PRESS_MC1', key: 'default:H_PRESS_MC1' },
              { title: 'V_F_MALE_C_NR1', key: 'default:V_F_MALE_C_NR1' },
              { title: 'V_F_FEMALE_B_NR1', key: 'default:V_F_FEMALE_B_NR1' },
              { title: 'V_F_FEMALE_A_NR1', key: 'default:V_F_FEMALE_A_NR1' },
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
      { title: 'LVMDP_NR1', key: 'default:transformer:LVMDP_NR1' },
      { title: 'LVMDP_NR2', key: 'default:transformer:LVMDP_NR2' },
      { title: 'LVMDP_UT_NEW', key: 'default:transformer:LVMDP_UT_NEW' },
      { title: 'LVMDP_UTILITY', key: 'default:transformer:LVMDP_UTILITY' },
    ],
  },
];

export async function fetchProjectDevices() {
  const response = await axios.get('/api/project/devices');
  return Array.isArray(response.data?.devices) ? response.data.devices : [];
}

export async function fetchRootAreaNames() {
  const devices = await fetchProjectDevices();
  const merged = [...DEFAULT_ROOT_AREAS];

  for (const device of devices) {
    const name = String(device?.name || '').trim();
    if (name && !merged.includes(name)) {
      merged.push(name);
    }
  }

  return merged;
}

export async function fetchEcowatchAreaTree() {
  const devices = await fetchProjectDevices();
  const projectNodes = devices
    .map((device) => {
      const deviceName = String(device?.name || '').trim();
      if (!deviceName || DEFAULT_ROOT_AREAS.includes(deviceName) || deviceName === 'MAIN_ELECTRICAL') {
        return null;
      }

      return {
        title: deviceName,
        key: `project:${deviceName}`,
        children: (device.tags || []).map((tag) => ({
          title: String(tag?.name || '').trim(),
          key: `project:${deviceName}:${tag?.address || tag?.name || ''}`,
        })),
      };
    })
    .filter(Boolean);

  if (!projectNodes.length) {
    return DEFAULT_ECOWATCH_TREE;
  }

  return [
    ...DEFAULT_ECOWATCH_TREE,
    {
      title: 'PROJECT_DEVICES',
      key: 'project:PROJECT_DEVICES',
      children: projectNodes,
    },
  ];
}
