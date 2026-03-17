import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api', 
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export const energyService = {
  
  getSummaryData: async () => {
    try {
      const response = await apiClient.get('/energy-summary');
      return response.data;
    } catch (error) {
      console.error("Gagal mengambil data summary:", error);
      throw error; 
    }
  },

  getRankingData: async (timeFilter = 'Month') => {
    try {
      const response = await apiClient.get(`/energy-ranking?time=${timeFilter}`);
      return response.data;
    } catch (error) {
      console.error("Gagal mengambil data ranking:", error);
      throw error;
    }
  },

  getAnnualReport: async (year) => {
    try {
      const response = await apiClient.get(`/annual-report/${year}`);
      return response.data;
    } catch (error) {
      console.error("Gagal mengambil laporan tahunan:", error);
      throw error;
    }
  }

};