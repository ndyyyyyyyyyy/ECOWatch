// Mock UserStorage before importing the module
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock('@grafana/runtime/internal', () => ({
  UserStorage: jest.fn().mockImplementation(() => ({
    getItem: mockGetItem,
    setItem: mockSetItem,
  })),
}));

import { getUserStorageFavorites, setUserStorageFavorites } from './favorites';

describe('favorites', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserStorageFavorites', () => {
    it('should return parsed favorites when storage contains valid JSON', async () => {
      const mockFavorites = { 'query-1': true, 'query-2': false, 'query-3': true };
      mockGetItem.mockResolvedValue(JSON.stringify(mockFavorites));

      const result = await getUserStorageFavorites();

      expect(mockGetItem).toHaveBeenCalledWith('user-favorites');
      expect(result).toEqual(mockFavorites);
    });

    it('should handle storage getItem promise rejection', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage error'));

      await expect(getUserStorageFavorites()).rejects.toThrow('Storage error');
      expect(mockGetItem).toHaveBeenCalledWith('user-favorites');
    });
  });

  describe('setUserStorageFavorites', () => {
    it('should stringify and save favorites to storage', async () => {
      const favorites = { 'query-1': true, 'query-2': false, 'query-3': true };
      mockSetItem.mockResolvedValue(undefined);

      await setUserStorageFavorites(favorites);

      expect(mockSetItem).toHaveBeenCalledWith('user-favorites', JSON.stringify(favorites));
    });

    it('should handle empty favorites object', async () => {
      const favorites = {};
      mockSetItem.mockResolvedValue(undefined);

      await setUserStorageFavorites(favorites);

      expect(mockSetItem).toHaveBeenCalledWith('user-favorites', JSON.stringify(favorites));
    });

    it('should handle large favorites object', async () => {
      const largeFavorites: { [key: string]: boolean } = {};
      for (let i = 0; i < 1000; i++) {
        largeFavorites[`query-${i}`] = i % 2 === 0;
      }
      mockSetItem.mockResolvedValue(undefined);

      await setUserStorageFavorites(largeFavorites);

      expect(mockSetItem).toHaveBeenCalledWith('user-favorites', JSON.stringify(largeFavorites));
    });

    it('should handle storage setItem promise rejection', async () => {
      const favorites = { 'query-1': true };
      mockSetItem.mockRejectedValue(new Error('Storage write error'));

      await expect(setUserStorageFavorites(favorites)).rejects.toThrow('Storage write error');
      expect(mockSetItem).toHaveBeenCalledWith('user-favorites', JSON.stringify(favorites));
    });
  });
});
