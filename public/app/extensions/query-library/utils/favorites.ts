import { UserStorage } from '@grafana/runtime/internal';

const userStorage = new UserStorage('saved-queries');

export const getUserStorageFavorites = async (): Promise<{ [key: string]: boolean }> => {
  const value = await userStorage.getItem('user-favorites');
  return value ? JSON.parse(value) : {};
};

export const setUserStorageFavorites = async (favorites: { [key: string]: boolean }): Promise<void> => {
  await userStorage.setItem('user-favorites', JSON.stringify(favorites));
};
